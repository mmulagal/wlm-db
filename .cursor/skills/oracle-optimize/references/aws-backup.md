# AWS Backup — Oracle optimize reference

Environment resolution (`$BASE_URL`, `$ACCOUNT_ID`, `$TOKEN`, `$CREDENTIALS_ID`, headers, demo / simulator behavior) is owned by [../SKILL.md](../SKILL.md#environment-and-auth). This file documents the assessment lookup, POST payload, and validation for the **AWS Backup** optimize type only.

Examples below assume `$BASE_URL`, `$ACCOUNT_ID`, `$TOKEN`, `$CREDENTIALS_ID`, `$REGION`, `$HOST`, `$INSTANCE` are exported.

## 1. Assess

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v2/oracle/credentials/${CREDENTIALS_ID}/regions/${REGION}/database-hosts/${HOST}/database-instances/${INSTANCE}/assessment?fields=aws-backup" \
  -H "Authorization: Bearer ${TOKEN}"
```

(Add `-H "x-simulator: true"` in Demo / StagingDemo.)

Find the item where **`id === "backup-configuration"`** in the response's `assessments[]` array — **not** `id === "aws-backup"`. The query parameter (`fields=aws-backup`) and the optimize `type`/`configurationName` (`aws-backup`) both use the dimension name; the assessment item itself uses the golden-config id `backup-configuration`. Do not conflate the two when searching the response.

### Real example — not-optimized

```json
{
  "id": "backup-configuration",
  "name": "Backup configuration",
  "type": "resiliency",
  "severity": "warning",
  "recommendation": "Backup Configuration recommendation: Enable FSx Backup or AWS Backup for Oracle database volumes to support data retention and compliance. If using both, consider removing redundant backups manually.",
  "categories": ["Reliability"],
  "status": "not-optimized",
  "recommended": "aws-backup-enabled",
  "objectsInViolation": [
    { "ontapVolumeName": "fs-67613950", "ontapVolumeUuid": "fs-67613950" }
  ],
  "totalObjectsAssessed": 3,
  "totalObjectsInViolation": 3,
  "violationDetails": [
    { "objectName": "oracledata2", "value": "Disabled", "objectType": "Volume", "recommended": "Enabled" },
    { "objectName": "oraclearch2", "value": "Disabled", "objectType": "Volume", "recommended": "Enabled" },
    { "objectName": "oracleredo2", "value": "Disabled", "objectType": "Volume", "recommended": "Enabled" }
  ]
}
```

**`objectsInViolation` shape gotcha:** for `backup-configuration` this is an array of `OntapVolume` objects (`{ ontapVolumeName, ontapVolumeUuid }`), not plain strings like most other dimensions. When summarizing violations for the user, read `ontapVolumeName` off each entry (fall back to the raw value if it is a string). `violationDetails[]` still uses plain volume-name strings in `objectName` (`oracledata2`, `oraclearch2`, `oracleredo2`) — use those for the human-readable "these volumes lack backups" list.

**Optimized example:** `status: "optimized"`, `objectsInViolation: []`, `totalObjectsInViolation: 0` — tell the user it's already optimized, no POST.

**Error example:** item has `errorMessage` and no `status` key — surface the message, no POST.

Also read `metadata.fileSystemId` from the top-level response (e.g. `"fs-67613950"`) — this is required for the POST payload and is **not** on the `backup-configuration` item itself.

## 2. Collect user input (required before POST, not on the assessment)

| Field | Format | Validation — reject and disable Continue / Optimize on any failure |
|---|---|---|
| `backupRetentionDays` | integer | Required, non-empty. Digits only (no decimal point, comma, or letters). Not negative. Greater than 0. Range **1–90 inclusive**. Must not be a 3-digit number — max 2 digits, 90 is the largest allowed value. |
| `backupStartTime` | `HH:MM` (UTC, zero-padded) | Required; hour and minute both non-empty. Both must be numbers, zero-padded. Not negative. Hour `00` is valid (do not require greater than 0). Hour in range **0–23**. Minute in range **0–59**. Submitted value must be `HH:MM` between `00:00` and `23:59` inclusive. |

Reject examples for `backupRetentionDays`: `0`, `-1`, `91`, `100` (3 digits), `3.5`, `""`, `"7,"`, `"abc"`.
Reject examples for `backupStartTime`: `24:00`, `12:60`, `2:30` (not zero-padded), `""`, `-1:00`.

Server-side constraints match this exactly: `backupRetentionDays` integer `minimum: 1, maximum: 90`; `backupStartTime` pattern `^([01]\d|2[0-3]):[0-5]\d$` ([FsxBackupOptimizationFields](../../../../server/src/routes/types/continuous-optimization.types.ts)). Do not send a POST with values that fail client-side validation even if the user insists — surface the inline error instead.

Do not skip collecting these even if the user says "use the defaults" — there is no server-side default; both fields are required in the payload.

## 3. Optimize

```bash
curl -sSk -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/oracle/database-hosts/optimize" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "aws-backup",
    "hostsToOptimize": [
      {
        "configurationName": "aws-backup",
        "databaseHosts": [
          {
            "id": "'"${HOST}"'",
            "credentialsId": "'"${CREDENTIALS_ID}"'",
            "region": "'"${REGION}"'",
            "databases": ["'"${INSTANCE}"'"],
            "fsxFileSystemId": "{metadata.fileSystemId from step 1}",
            "backupRetentionDays": 7,
            "backupStartTime": "02:30"
          }
        ]
      }
    ]
  }'
```

Returns `{ "jobId": "..." }`.

| Payload field | Source |
|---|---|
| `type`, `configurationName` | Literal `"aws-backup"` |
| `databaseHosts[].id` | `$HOST` (`databaseHostId`) |
| `credentialsId`, `region` | `$CREDENTIALS_ID`, `$REGION` from env — do not expect these echoed in `metadata` |
| `databases` | `["${INSTANCE}"]` (`databaseInstanceId`) |
| `fsxFileSystemId` | `metadata.fileSystemId` from the step-1 GET response |
| `backupRetentionDays`, `backupStartTime` | User-supplied, validated per the table above |

## 4. Poll

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/jobs/{jobId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

Poll every **10 seconds** until `status` is `COMPLETED` or `FAILED`. `COMPLETED` → the AWS Backup configuration is now optimized. `FAILED` → report not optimized and surface the job's `error` field if present.
