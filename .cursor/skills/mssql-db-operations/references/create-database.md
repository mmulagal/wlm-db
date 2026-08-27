# Create Database — WLMDB API Reference

**Prerequisite:** Run [inventory.md](inventory.md). Check `ssmStatus === Connected`. If `NotConnected` or `N/A`, do **not** POST here — use [clone-without-ssm.md](clone-without-ssm.md) create-database ONTAP runbook instead.

Environment: [../SKILL.md](../SKILL.md#environment-and-auth).

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `.../database-hosts` | Resolve `databaseHostId`, check `ssmStatus` |
| `GET` | `.../database-instances/{instanceId}/drive-information` | Drive letters, defaults |
| `GET` | `.../database-instances/{instanceId}/collation` | Default collation |
| `POST` | `.../database-hosts/{hostId}/database` | Create database → `202` + `jobId` |
| `GET` | `.../jobs/{jobId}` | Poll until terminal |

---

## Workflow (SSM connected)

1. Inventory + SSM check
2. Pre-read drive-information and collation
3. Resolve whether each selected drive is existing or available; set `isExisting` accordingly
4. Build and validate the payload (including `.mdf` / `.ldf` file extensions)
5. Confirm the exact payload with the user (destructive gate)
6. `POST .../database`
7. Poll job
8. Verify — re-fetch databases list and drive information

---

## Pre-reads

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/drive-information"

curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/collation"
```

---

## Create database

**Confirmation gate applies.**

```
POST /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database
```

Body:
```json
{
  "databaseName": "AdventureWorks",
  "dataFileConfig": {
    "fileName": "AdventureWorks.mdf",
    "volumeSize": 100,
    "drive": "E",
    "isExisting": false,
    "isVirtualMount": false
  },
  "logFileConfig": {
    "fileName": "AdventureWorks_log.ldf",
    "volumeSize": 50,
    "drive": "F",
    "isExisting": false,
    "isVirtualMount": false
  },
  "collation": "SQL_Latin1_General_CP1_CI_AS",
  "databaseInstanceId": "<required for multi-instance hosts>"
}
```

| Field | Notes |
|---|---|
| `databaseName` | 1–123 chars, `^[a-zA-Z_][a-zA-Z0-9_]*$` |
| data `fileName` | Include the `.mdf` extension, e.g. `AdventureWorks.mdf` |
| log `fileName` | Include the `.ldf` extension, e.g. `AdventureWorks_log.ldf` |
| `volumeSize` | GiB, minimum 1 |
| `drive` | Single letter `D`–`Z` |
| `isExisting` | `true` only when `drive` appears in `existingDriveInfo`; `false` when it appears in `availableDriveLetters` and a new volume must be provisioned |
| `isVirtualMount` | `true` for virtual mount point layout |

### Payload preflight

Before asking for confirmation or sending the POST:

1. Match each requested drive against the latest `drive-information` response.
2. Do not describe a letter from `availableDriveLetters` as an "existing drive." Treat it as a new drive and set `isExisting: false`.
3. If a requested letter appears in neither list, stop and ask the user to choose another drive.
4. Ensure data and log use different letters when both are new.
5. Ensure the data filename ends in `.mdf` and the log filename ends in `.ldf`. The backend validation assumes an extension and can otherwise fail asynchronously with `Cannot read properties of undefined (reading 'length')`.
6. State whether storage will be reused or newly provisioned in the confirmation prompt.

```bash
curl -sSk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database" \
  -d '{
    "databaseName": "AdventureWorks",
    "dataFileConfig": { "fileName": "AdventureWorks.mdf", "volumeSize": 100, "drive": "E", "isExisting": false, "isVirtualMount": false },
    "logFileConfig": { "fileName": "AdventureWorks_log.ldf", "volumeSize": 50, "drive": "F", "isExisting": false, "isVirtualMount": false },
    "collation": "SQL_Latin1_General_CP1_CI_AS",
    "databaseInstanceId": "'"$INSTANCE"'"
  }'
```

Capture `jobId` from `202` response.

---

## Poll job

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/${JOB_ID}"
```

Terminal `status`: `COMPLETED`, `FAILED`.

---

## Verify

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/databases"
```

Also re-fetch `drive-information`. For new drives, confirm the selected letters moved from `availableDriveLetters` to `existingDriveInfo` with `isNetappDrive: true`.

The databases inventory may lag after a `COMPLETED` job. Report this explicitly if the new database is not listed yet; do not characterize the inventory response itself as successful verification. The terminal job status plus newly mounted drives confirm orchestration completed, while direct SQL inventory remains pending.

---

## Server internals (troubleshooting only — not operator steps)

WLMDB server orchestrates: ONTAP volume/LUN provisioning (proxy) + SSM PowerShell for drive init and SQL `CREATE DATABASE`. Do not invoke SSM or proxy directly when `ssmStatus` is `Connected`.
