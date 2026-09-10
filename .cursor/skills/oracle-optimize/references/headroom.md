# File system headroom — Oracle optimize reference

Environment resolution (`$BASE_URL`, `$ACCOUNT_ID`, `$TOKEN`, `$CREDENTIALS_ID`, headers, demo / simulator behavior) is owned by [../SKILL.md](../SKILL.md#environment-and-auth). This file documents the assessment lookup and POST payload for the **File system headroom** (storage sizing) optimize type only.

Examples below assume `$BASE_URL`, `$ACCOUNT_ID`, `$TOKEN`, `$CREDENTIALS_ID`, `$REGION`, `$HOST`, `$INSTANCE` are exported.

## 1. Assess

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v2/oracle/credentials/${CREDENTIALS_ID}/regions/${REGION}/database-hosts/${HOST}/database-instances/${INSTANCE}/assessment?fields=storage" \
  -H "Authorization: Bearer ${TOKEN}"
```

(Add `-H "x-simulator: true"` in Demo / StagingDemo.)

Headroom has no dedicated top-level `fields=` value of its own — it is part of the `storage` compound section, so request `fields=storage` and then find the item where **`id === "headroom"`** in the response's `assessments[]` array.

### Real example — error item (permission failure)

```json
{
  "id": "headroom",
  "name": "File system headroom",
  "type": "storage",
  "severity": "critical",
  "recommendation": "To optimize storage performance, provision file system capacity as 1.2 times of total size of provisioned volume.",
  "categories": ["Performance efficiency"],
  "errorMessage": "Failed to fetch FSx storage details or CloudWatch metrics; Error: BadRequestError: Failed to fetch credentials. HTTPError: Request failed with status code 403 (Forbidden): GET https://staging.api.workloads.netapp.com/accounts/account-3JuDht6X/credentials/v1/generic/fc42c7ba-53b9-48e0-bca1-25a6bbdb9085?decrypt=true",
  "subType": "sizing",
  "resourceType": "File system (FSx for ONTAP)"
}
```

This item has **no `status` key** — only `errorMessage`. Surface the message verbatim and exit; do not offer to optimize.

**Not-optimized example (other than errored):** `status: "not-optimized"` or `"under-provisioned"` with `objectsInViolation` naming the affected EC2 instance / filesystem and `violationDetails[]` showing current vs. recommended headroom. Summarize and offer to fix.

**Over-provisioned example:** `status: "over-provisioned"` — summarize the finding but **do not offer the fix and do not POST**. Capacity decrease is not automated: the UI marks this status as unfixable, and the optimize job rejects it with `File system headroom is over-provisioned. Capacity decrease is not automated for <fileSystemId>`, ending `FAILED`. Tell the user capacity must be reduced manually.

**Optimized example:** `status: "optimized"`, `objectsInViolation: []`, `totalObjectsInViolation: 0` — tell the user it's already optimized, no POST.

## 2. Collect user input

**None.** Headroom optimize needs no extra user-entered fields — it is a plain "fix now" action. Do not ask for anything beyond the confirmation gate in [../SKILL.md](../SKILL.md#confirmation-gate-required-before-post).

## 3. Optimize

```bash
curl -sSk -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/oracle/database-hosts/optimize" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "storage-sizing",
    "hostsToOptimize": [
      {
        "configurationName": "headroom",
        "databaseHosts": [
          {
            "id": "'"${HOST}"'",
            "credentialsId": "'"${CREDENTIALS_ID}"'",
            "region": "'"${REGION}"'",
            "databases": ["'"${INSTANCE}"'"]
          }
        ]
      }
    ]
  }'
```

Returns `{ "jobId": "..." }`.

| Payload field | Source |
|---|---|
| `type` | Literal `"storage-sizing"` |
| `configurationName` | Literal `"headroom"` |
| `databaseHosts[].id` | `$HOST` (`databaseHostId`) |
| `credentialsId`, `region` | `$CREDENTIALS_ID`, `$REGION` from env |
| `databases` | `["${INSTANCE}"]` (`databaseInstanceId`) |

Unlike AWS Backup, there is **no** `fsxFileSystemId`, `backupRetentionDays`, or `backupStartTime` on this payload — do not add them. The server resizes the FSx filesystem directly from the host/instance identifiers alone.

**Caveat:** the golden-config entry for `headroom` is marked `disabled: process.env.NODE_ENV === 'production'` in the server source. This may mean the fix is unavailable in production — mention this as a possibility if a production POST is rejected or the item is absent from a production assessment, but do not assert it as guaranteed behavior.

## 4. Poll

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/jobs/{jobId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

Poll every **10 seconds** until `status` is `COMPLETED` or `FAILED`. `COMPLETED` → file system headroom is now optimized. `FAILED` → report not optimized and surface the job's `error` field if present.
