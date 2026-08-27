# Clone with SSM (Sandbox) — WLMDB API Reference

**Prerequisite:** Run [inventory.md](inventory.md). Check `ssmStatus === Connected`. If `NotConnected` or `N/A`, do **not** POST here — use [clone-without-ssm.md](clone-without-ssm.md) manual ONTAP runbook.

Environment: [../SKILL.md](../SKILL.md#environment-and-auth).

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `.../database-hosts/sandboxes` | List all sandboxes in region |
| `GET` | `.../database-instances/{instanceId}/sandboxes` | Sandboxes for one instance |
| `GET` | `.../database-hosts/{hostId}/database-mount-points?databaseName={name}&databaseInstanceId={instanceId}` | Mount drive options |
| `POST` | `.../sandboxes` | Create sandbox → `202` + `jobId` |
| `GET` | `.../sandboxes/{sandboxName}/connection-string` | SQL connection string after success |
| `GET` | `.../jobs/{jobId}` | Poll job |

Path prefix: `/mssql/credentials/{credId}/regions/{region}`.

---

## Workflow

1. Inventory + SSM check
2. Pre-read sandboxes (name conflict) and mount-points
3. Confirm with user (destructive gate)
4. `POST .../sandboxes`
5. Poll job
6. Fetch connection string

---

## Pre-reads

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/sandboxes"

curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-mount-points?databaseName=${SOURCE_DB}&databaseInstanceId=$INSTANCE"
```

---

## Create sandbox

**Confirmation gate applies.**

```
POST /mssql/credentials/{credId}/regions/{region}/sandboxes
```

Body:
```json
{
  "source": {
    "host": "<databaseHostId>",
    "instance": "MSSQLSERVER",
    "database": "ProductionDB"
  },
  "destination": {
    "host": "<databaseHostId>",
    "instance": "MSSQLSERVER",
    "database": "ProductionDB_Dev"
  },
  "mountPoints": {
    "dataDrive": "E",
    "logDrive": "F"
  },
  "tag": "Development"
}
```

| Field | Notes |
|---|---|
| `source.host` / `destination.host` | `databaseHostId` (not EC2 instance ID) |
| `source.database` / `destination.database` | Max 27 chars, `^[a-zA-Z_][a-zA-Z0-9_]*$` |
| `mountPoints.dataDrive` / `logDrive` | Single letter `D`–`Z` |
| `tag` | `Development`, `QA`, `Integration`, `Training`, `Analytics`, `Other` |

```bash
curl -sSk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/sandboxes" \
  -d '{
    "source": { "host": "'"$HOST"'", "instance": "MSSQLSERVER", "database": "ProductionDB" },
    "destination": { "host": "'"$HOST"'", "instance": "MSSQLSERVER", "database": "ProductionDB_Dev" },
    "mountPoints": { "dataDrive": "E", "logDrive": "F" },
    "tag": "Development"
  }'
```

Capture `jobId` from `202` response.

---

## Poll job

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/${JOB_ID}"
```

---

## Connection string (after COMPLETED)

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/ProductionDB_Dev/connection-string"
```

---

## Server internals (troubleshooting only)

WLMDB orchestrates: validation (SSM) → volume mapping (SSM) → ONTAP snapshot/FlexClone (proxy) → LUN signature (SSM) → virtual mount (SSM) → SQL clone DB (SSM). Do not invoke SSM or proxy directly when using this reference.
