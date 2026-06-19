# Logs analysis — API reference

Environment resolution (`$BASE`, `$ACCOUNT`, `$TOKEN`, `$CRED`, headers, demo / simulator behavior) is owned by [../SKILL.md](../SKILL.md#environment-and-auth). This file documents endpoints, routing, and response behavior only.

All paths relative to `/accounts/{accountId}/wlmdb/v1`. Replace `{db}` with `mssql` or `oracle`.

Examples assume `$TOKEN`, `$ACCOUNT`, `$CRED`, `$REGION`, `$HOST`, `$INSTANCE`, `$BASE` are exported.

**Demo / simulator:** In `Demo` / `StagingDemo`, every curl below also needs `-H "x-simulator: true"`.

---

## Read endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/{db}/credentials/{credId}/regions/{region}/logs-analysis/summary` | Latest report per database instance for the region (severity counts, error counts, time window) |
| GET | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis/reports?pageSize=100` | List of report identifiers `{ id, creationTime, startTime, endTime }` newest-first |
| GET | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?jobId=&id=` | Aggregated `remediationRecommendation[]` (filter by `jobId` or report `id`; omit both to aggregate across all reports for that instance) |

`pageSize` on `/logs-analysis/reports` defaults to **100** server-side; pass explicitly when paging (use `pageSize=100` unless you need fewer, e.g. compare last two scans with `pageSize=2`).

## Read routing

| User asks for | Endpoint | Do not use |
|---------------|----------|------------|
| Region-wide latest per instance | `GET .../logs-analysis/summary` | Instance-scoped GET without host/instance context |
| All recommendations for one instance | `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis` (no query) | Summary only |
| **Specific report by id** | **`GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}`** | **Summary — it cannot filter by report id** |
| Specific job | `GET .../logs-analysis?jobId={jobId}` | POST trigger |

When the user mentions **report id**, you **must** execute the `id` query-parameter GET on the instance path. If host, instance, or id are missing, resolve them (`database-hosts` → `reports` list → `id` GET) — do not substitute summary for report-by-id reads.

**Report-by-id workflow (required):**

1. Resolve `databaseHostId` and `databaseInstanceId` (from user, summary, or `GET .../database-hosts`).
2. If report id is missing, `GET .../logs-analysis/reports?pageSize=100` and use the newest id (or ask the user).
3. **Execute** `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}` — documenting this path is not sufficient; the curl must appear in the transcript.
4. Summarize `remediationRecommendation[]` (or explain 404 / empty). Do **not** stop at summary-only when the user asked for report-by-id scope.

## Recommended read workflow

For most "show me logs analysis results" tasks:

1. **Start at the summary** to see what exists and which instances have data:

   ```
   GET .../{db}/credentials/{credId}/regions/{region}/logs-analysis/summary
   ```

   The response includes `id`, `databaseHostId`, `databaseInstanceId`, and `latestReport.jobId` for every instance with at least one report.

2. **Fetch the aggregated remediation list** for the instance the user cares about:

   ```
   GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis
   ```

   Returns `{ remediationRecommendation: [...] }` aggregated across **all** reports for that instance (counts summed, hourly buckets merged, first/last occurrence widened).

3. **For a specific scan**, list reports and pass `id`:

   ```
   GET .../logs-analysis/reports?pageSize=100
   GET .../logs-analysis?id={reportId}
   ```

4. **For a specific job** (e.g. just-triggered), pass `jobId` instead.

## Examples

### Example 1 — Region-wide summary, ranked by severity

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/logs-analysis/summary" \
  | jq '.items
        | sort_by(-(.latestReport.severityCounts.critical // 0), -(.latestReport.severityCounts.severe // 0))
        | .[0:10]
        | .[] | {
            hostId: .databaseHostId,
            instanceId: .databaseInstanceId,
            lastScan: (.latestReport.creationTime / 1000 | strftime("%Y-%m-%d %H:%M")),
            errors: .latestReport.errorCount,
            critical: .latestReport.severityCounts.critical,
            severe: .latestReport.severityCounts.severe,
            important: .latestReport.severityCounts.important
          }'
```

### Example 2 — Aggregated remediation for one instance

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/logs-analysis" \
  | jq '.remediationRecommendation
        | sort_by(-.count) | .[0:10]
        | map({error, count, severity, cause, remediation})'
```

For Oracle, replace `mssql` with `oracle`.

### Example 3 — Compare last two scans

```bash
REPORTS=$(curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/logs-analysis/reports?pageSize=2")

for ID in $(echo "$REPORTS" | jq -r '.reports[].id'); do
  curl -sH "Authorization: Bearer $TOKEN" \
    "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/logs-analysis?id=$ID" \
    | jq "{ id: \"$ID\", count: (.remediationRecommendation | length) }"
done
```

## Important behaviors (read paths)

- **Empty vs missing data:**
  - `/logs-analysis/summary` → always HTTP 200; `{ items: [] }` when nothing to report.
  - `/logs-analysis/reports` → HTTP 404 when no reports exist for that instance.
  - `/logs-analysis` → HTTP 404 only when **zero** reports exist for that instance. If reports exist but yield no errors after aggregation, returns HTTP 200 with `{ remediationRecommendation: [] }`.
- **404 on `GET .../logs-analysis?id=...`:** No matching row for that host+instance+id (not "empty remediation"). Confirm the id via `GET .../logs-analysis/reports` with the same path params.
- **Timestamps:** All response time fields are epoch milliseconds.
- **Browser vs curl:** Reproduce DevTools requests verbatim (method, query, headers). In Demo / StagingDemo include `x-simulator: true` on every request.

## Aggregation (instance GET without `id` or `jobId`)

Bucketed by `uniqueErrorKey` (or SHA-derived hash of `errorCode`/message); `count` summed; `firstOccurrence` → min, `lastOccurrence` → max; `hourlyErrorCounts` merged on `hour`; `additionalInfo[].result` stringified if object; reports with `status !== 'success'` skipped.

## MSSQL severity → bucket

| Numeric severity | Bucket |
|---|---|
| 16 | `important` |
| 17 – 19 | `severe` |
| 20 – 24 | `critical` |
| Field absent | defaults to 17 → `severe` |
| Numeric outside 16–24 | dropped silently |

Oracle severities arrive as lowercase strings; values outside `important | severe | critical` are dropped. Summary `latestReport.severityCounts` uses the bucket names above.

## Prerequisites (read-only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/mssql/credentials/{credId}/regions/{region}/logs-analysis/pre-requisites?ec2InstanceId=...` *or* `?databaseHostId=...` | Provide exactly one. Comma-separate up to 5 IDs. |
| POST | `/oracle/credentials/{credId}/regions/{region}/logs-analysis/pre-requisites` | Body: `{ items: [{ databaseHostId?, ec2InstanceId?, databaseInstanceName }] }`. Oracle requires `databaseInstanceName` for the permission check. |

The Oracle prerequisites endpoint uses POST but is non-mutating (returns a readiness object).

Treat the host as ready iff every populated `*PreRequisites.ready` is `true`. When any `ready` is `false`, surface the corresponding `*.message` verbatim:

| Field | Message |
|---|---|
| `bedrockPreRequisites.message` | "Bedrock model %s should be enabled in the AWS account and accessible from the region %s." |
| `instanceProfilePreRequisites.message` | "Ensure that IAM instance profile attached to the SQL node has bedrock:InvokeModel permission attached." |
| `credentialsPreRequisites.message` | "Ensure that the credentials selected is valid and have the permission bedrock:GetFoundationModelAvailability and bedrock:ListInferenceProfiles permissions attached." |
| `networkingPreRequisites.message` | "Ensure that Bedrock Runtime Interface VPC endpoint is present and associated with the SQL node subnet route table." |
| `oraclePermissionsPreRequisites.message` | "Ensure that the user has access to the V$DIAG_ALERT_EXT view to fetch the alert logs data for logs analysis." |

## Trigger (destructive)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis` | optional (see below) | `{ jobId }` — poll status via `GET /jobs/{jobId}` |

Trigger is **fire-and-forget**: POST returns `jobId` immediately; SSM + Bedrock run in the background and write the report on completion.

Trigger body fields (all optional):

| Field | Default | Notes |
|-------|---------|-------|
| `logsAnalyzerFromTimestamp` | last report's `endTime` (or 24 h ago) | Epoch ms; future values are rejected with 400 |
| `logsCountToConsider` | `100` | Cap on errors processed |
| `logsWindowDuration` | `24` | Hours after `from` to scan |
| `logLevel` | analyzer default | Forwarded to the CLI |
| `inferenceConfig` | model default | `{ temperature, topP, maxTokens }` |
| `monitorUsage` | `false` | Emit token/cost telemetry |
| `logsAnalyzerS3SignedUrl` | auto pre-signed | Override the analyzer bundle URL |

## Pricing (read-only)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/pricing/region/{region}/logs-analysis` | `{ costPerError: <USD> }` |

## Trigger workflow (destructive)

A trigger consumes Bedrock tokens (real money), runs SSM on the EC2 host, and writes a new report. Always:

1. **Read prerequisites first** and inspect every populated `ready` field. If any is `false`, **stop** and surface the corresponding `*.message` to the user.
2. **Confirm with the user** — explicitly state the host, instance, scan window (default 24 h), and that Bedrock tokens will be consumed (cost reference: `/pricing/region/{region}/logs-analysis`).
3. **POST the trigger** and capture the returned `jobId`.
4. **Poll the job** (`GET /jobs/{jobId}`) until `status` is `COMPLETED` or `FAILED`.
5. **Fetch the report** for the new `jobId`.

In SAM environments, the POST must go through `prepare_bash` (with `destructive=true`) → user approval → `record_bash_decision(commandHash, approved=true)` → `bash`. The bash command string must match byte-for-byte across `prepare` and `bash` (whitespace, flags, quoting all matter — any difference produces `MISSING_PREPARE`). Subagents do not have access to `prepare_bash` / `record_bash_decision`; never delegate the trigger flow to a subagent.

### Example 4 — Trigger and poll

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/logs-analysis/pre-requisites?databaseHostId=$HOST" \
  | jq '.items[] | { ec2InstanceId, ready: [.bedrockPreRequisites.ready, .instanceProfilePreRequisites.ready, .credentialsPreRequisites.ready, .networkingPreRequisites.ready] | all }'

JOB=$(curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  -d '{"logsWindowDuration": 24}' \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/logs-analysis" \
  | jq -r .jobId)

while true; do
  STATUS=$(curl -sH "Authorization: Bearer $TOKEN" "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/$JOB" | jq -r .status)
  echo "$(date +%H:%M:%S) status=$STATUS"
  [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]] && break
  sleep 30
done

curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/logs-analysis?jobId=$JOB"
```
