---
name: fetch-logs-analysis-results
description: Fetch NetApp Workload Factory database logs analysis results (remediation recommendations, severity counts, latest reports) for managed MSSQL and Oracle instances. Use when the user asks to retrieve, list, summarize, trigger, or check prerequisites for database logs analysis. PostgreSQL is not supported.
---

# Database Logs Analysis (Workload Factory)

## Overview

Workload Factory runs AI-driven log analysis on managed MSSQL and Oracle database instances and persists each scan as a `logs_analysis_report` keyed by `accountId + databaseHostId + databaseInstanceId + jobId`. Each report contains an array of `RemediationRecommendation` objects, one per error pattern.

This skill covers two paths:

- **Read** (summary, list reports, fetch a report) — non-mutating.
- **Trigger** (`POST .../logs-analysis`) — destructive: consumes Bedrock tokens, runs SSM on the EC2 host, and writes a new report. Confirm with the user before running. In SAM environments, route through `prepare_bash` → user approval → `record_bash_decision` → `bash`.

## When to Use

Apply this skill when the user asks to:

- "What does logs analysis say about instance X?"
- "Show me the latest logs analysis summary for region Y"
- "List all logs analysis reports for this database host"
- "Fetch the report for jobId / reportId Z"
- "Trigger logs analysis for instance X"
- "Check logs analysis prerequisites for EC2 instance / database host"

Do **not** use this skill for writing or extending the analyzer package itself, or for implementing simulator mocks.

## Prerequisites: Auth and IDs

| Item | How to obtain |
|------|---------------|
| `Authorization: Bearer <token>` | Auth0 client-credentials exchange against `https://netapp-cloud-account.auth0.com/oauth/token` (audience `https://api.cloud.netapp.com`) |
| `accountId` | `GET https://api.bluexp.netapp.com/tenancy/account` → `accountId` |
| `credentialsId` (UUID v4) | `GET /credentials/v1/aws` |
| `region` | AWS region of the credential (`us-east-1`, …) |
| `databaseHostId`, `databaseInstanceId` | `GET /wlmdb/v1/{db}/credentials/{credentialsId}/regions/{region}/database-hosts` (each host carries nested `databaseInstances[]`) |
| `jobId` | Returned by trigger or surfaced as `latestReport.jobId` in summary responses; historical jobs via `GET /wlmdb/v1/jobs?type=LOGS_ANALYSIS` |

Route schemas reject malformed inputs with HTTP 400 (e.g. `params/credentialsId must match format "uuid"`, `ec2InstanceId` pattern `^i-[0-9a-z]{8,17}(?:,i-[0-9a-z]{8,17}){0,4}$`, up to 5 comma-separated).

## Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://api.workloads.netapp.com` |
| Staging | `https://staging.api.workloads.netapp.com` |

All paths below are relative to `/accounts/{accountId}/wlmdb/v1`. Replace `{db}` with `mssql` or `oracle`.

## Common Headers

| Header | Description |
|---|---|
| `Authorization` | `Bearer <access_token>` (required) |
| `Content-Type` | `application/json` (POST/PATCH) |
| `x-simulator` | `true` for simulator/test mode (optional) |
| `x-service-request-id` | Request correlation ID (optional) |
| `x-agent-id` | Agent ID header (optional) |

If MCP tools prefixed with `mcp_netapp-wf-sta` are available, prefer them over raw `curl`.

## Endpoints

### Read

| Method | Path | Returns |
|--------|------|---------|
| GET | `/{db}/credentials/{credId}/regions/{region}/logs-analysis/summary` | Latest report per database instance for the region (severity counts, error counts, time window) |
| GET | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis/reports?pageSize=100` | List of report identifiers `{ id, creationTime, startTime, endTime }` newest-first |
| GET | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?jobId=&id=` | Aggregated `remediationRecommendation[]` (filter by `jobId` or report `id`; omit both to aggregate across all reports for that instance) |

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
2. If report id is missing, `GET .../logs-analysis/reports?pageSize=20` and use the newest id (or ask the user).
3. **Execute** `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}` — documenting this path is not sufficient; the curl must appear in the transcript.
4. Summarize `remediationRecommendation[]` (or explain 404 / empty). Do **not** stop at summary-only when the user asked for report-by-id scope.

### Prerequisites (read-only)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/mssql/credentials/{credId}/regions/{region}/logs-analysis/pre-requisites?ec2InstanceId=...` *or* `?databaseHostId=...` | Provide exactly one. Comma-separate up to 5 IDs. |
| POST | `/oracle/credentials/{credId}/regions/{region}/logs-analysis/pre-requisites` | Body: `{ items: [{ databaseHostId?, ec2InstanceId?, databaseInstanceName }] }`. Oracle requires `databaseInstanceName` for the permission check. |

The Oracle prerequisites endpoint uses POST but is non-mutating (returns a readiness object).

### Trigger (destructive)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/{db}/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis` | optional (see below) | `{ jobId }` — poll status via `GET /jobs/{jobId}` |

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

### Pricing (read-only)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/pricing/region/{region}/logs-analysis` | `{ costPerError: <USD> }` |

## Recommended Read Workflow

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
   GET .../logs-analysis/reports?pageSize=20
   GET .../logs-analysis?id={reportId}
   ```

4. **For a specific job** (e.g. just-triggered), pass `jobId` instead.

## Trigger Workflow (destructive)

A trigger consumes Bedrock tokens (real money), runs SSM on the EC2 host, and writes a new report. Always:

1. **Read prerequisites first** and inspect every populated `ready` field. If any is `false`, **stop** and surface the corresponding `*.message` to the user.
2. **Confirm with the user** — explicitly state the host, instance, scan window (default 24 h), and that Bedrock tokens will be consumed (cost reference: `/pricing/region/{region}/logs-analysis`).
3. **POST the trigger** and capture the returned `jobId`.
4. **Poll the job** (`GET /jobs/{jobId}`) until `status` is `COMPLETED` or `FAILED`.
5. **Fetch the report** for the new `jobId`.

In SAM environments, the POST must go through `prepare_bash` (with `destructive=true`) → user approval → `record_bash_decision(commandHash, approved=true)` → `bash`. The bash command string must match byte-for-byte across `prepare` and `bash` (whitespace, flags, quoting all matter — any difference produces `MISSING_PREPARE`). Subagents do not have access to `prepare_bash` / `record_bash_decision`; never delegate the trigger flow to a subagent.

## Examples

All examples assume `$TOKEN`, `$ACCOUNT`, `$CRED`, `$REGION`, `$HOST`, `$INSTANCE`, `$BASE` (e.g. `https://api.workloads.netapp.com`) are set.

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

## Response Shapes

### `RemediationRecommendation` — element of `remediationRecommendation[]`

```ts
{
  error: string;                      // Raw error line / pattern
  context?: string;                   // Surrounding log context
  cause: string;                      // LLM-derived root cause
  count: number;                      // Aggregated occurrences across all reports queried
  severity?: string;                  // MSSQL: numeric (as string). Oracle: 'severe' | 'important' | 'critical'
  errorCode?: string;
  uniqueErrorKey?: string;            // Stable dedup key. When absent, server hashes from the MSSQL error pattern.
  remediation: string[];              // Ordered remediation steps
  firstOccurrence?: number;           // Epoch ms (widened on aggregation)
  lastOccurrence?: number;            // Epoch ms (widened on aggregation)
  sql?: string[];                     // Suggested SQL to run
  tags?: string[];
  additionalInfo?: Array<{ query?: string; result?: string; error?: string }>;
  hourlyErrorCounts?: Array<{ hour: number; count: number }>; // hour = epoch ms truncated to hour
}
```

**Aggregation rules** (when neither `id` nor `jobId` is passed): bucketed by `uniqueErrorKey` (or a SHA-derived hash of `errorCode`/message); `count` summed; `firstOccurrence` → min, `lastOccurrence` → max; `hourlyErrorCounts` merged on `hour`; `additionalInfo[].result` stringified if it arrived as an object; reports with `status !== 'success'` are skipped.

### `ReportIdentifier` — element of `reports[]`

```ts
{ id: string; creationTime: number; startTime?: number; endTime?: number; }   // all times epoch ms
```

Sorted by `creationTime` desc; `pageSize` defaults to 100.

### `LatestReport` — element of `items[]` from the summary endpoint

```ts
{
  id: string;
  databaseHostId: string;
  databaseInstanceId: string;
  latestReport: {
    jobId: string;
    creationTime: number;
    errorCount: number;               // remediationRecommendation.length of the latest report
    startTime?: number;
    endTime?: number;
    severityCounts?: { important?: number; severe?: number; critical?: number };
  };
}
```

### MSSQL severity → bucket

| Numeric severity | Bucket |
|---|---|
| 16 | `important` |
| 17 – 19 | `severe` |
| 20 – 24 | `critical` |
| Field absent | defaults to 17 → `severe` |
| Numeric outside 16–24 | dropped silently |

Oracle severities arrive as lowercase strings already; values outside `important | severe | critical` are dropped.

### Pre-Requisites response

```ts
{
  items: Array<{
    errorMessage?: string;            // Set if the entire pre-req check failed for this host
    databaseHostId?: string;
    ec2InstanceId?: string;
    databaseInstanceName?: string;    // Oracle only
    bedrockPreRequisites?:           { ready?: boolean; message?: string };
    instanceProfilePreRequisites?:   { ready?: boolean; message?: string };
    credentialsPreRequisites?:       { ready?: boolean; message?: string };
    networkingPreRequisites?:        { ready?: boolean; message?: string };
    oraclePermissionsPreRequisites?: { ready?: boolean; message?: string };  // Oracle only
  }>;
}
```

Treat the host as ready iff every populated `*PreRequisites.ready` is `true`.

Verbatim messages emitted on failure:

| Field | Message |
|---|---|
| `bedrockPreRequisites.message` | "Bedrock model %s should be enabled in the AWS account and accessible from the region %s." |
| `instanceProfilePreRequisites.message` | "Ensure that IAM instance profile attached to the SQL node has bedrock:InvokeModel permission attached." |
| `credentialsPreRequisites.message` | "Ensure that the credentials selected is valid and have the permission bedrock:GetFoundationModelAvailability and bedrock:ListInferenceProfiles permissions attached." |
| `networkingPreRequisites.message` | "Ensure that Bedrock Runtime Interface VPC endpoint is present and associated with the SQL node subnet route table." |
| `oraclePermissionsPreRequisites.message` | "Ensure that the user has access to the V$DIAG_ALERT_EXT view to fetch the alert logs data for logs analysis." |

## Important Behaviors

- **Empty vs missing data:**
  - `/logs-analysis/summary` → always HTTP 200; `{ items: [] }` when nothing to report.
  - `/logs-analysis/reports` → HTTP 404 when no reports exist for that instance.
  - `/logs-analysis` → HTTP 404 only when **zero** reports exist for that instance. If reports exist but yield no errors after aggregation, returns HTTP 200 with `{ remediationRecommendation: [] }`.
- **Timestamps**: All response time fields are epoch milliseconds.
- **PostgreSQL not supported**: routes only exist for MSSQL and Oracle; `pgsql` paths return 404 "Route not found".
- **Trigger is fire-and-forget**: the POST returns a `jobId` immediately; SSM execution + Bedrock analysis runs in the background and writes the report on completion.

## Evals

Functional evals: `evals/evals.json`, `evals/trigger-eval.json`, `agents/grader.md`. Run via [../evals/ORCHESTRATE.md](../evals/ORCHESTRATE.md); finish with `python3 .cursor/skills/evals/run.py finish --iteration <N>`.

## Troubleshooting (console vs curl / agent)

- **404 on `GET .../logs-analysis?id=...`**: In this repo, that handler loads rows from `logs_analysis_reports` scoped by `accountId`, `databaseHostId` (`resource_id`), and `databaseInstanceId`, and filters `id` when `id` is present. A 404 means **no matching row** for that combination (not “empty remediation”). Confirm the id exists for that instance with `GET .../logs-analysis/reports` and the same path params.
- **Same URL, different bodies**: Reproduce the browser request **verbatim** (method, query string, and headers). If DevTools sends `x-simulator: true` (common on demo / marketing flows), include it in curl or you may hit a different data path than the UI. *Note:* the WLMDB `getLogsAnalysisReport` implementation does not branch on `x-simulator`; any simulator-specific behavior for this route would be **outside** `logs-analyzer-operations.ts` (e.g. edge or another tier).
- **Secrets**: Do not paste bearer tokens into chat or commit them; rotate any token that was exposed.

## Server-Internal References (WLMDB repo only)

These paths only resolve in the WLMDB server checkout. API consumers can ignore this section.

| File | Purpose |
|------|---------|
| `server/src/routes/logs-analyzer.ts` | Route registration |
| `server/src/operations/logs-analyzer/logs-analyzer-operations.ts` | Read / trigger / aggregate logic |
| `server/src/lib/database/logs-analysis-reports.ts` | Prisma queries |
| `server/src/routes/types/logs-analyzer.types.ts` | Request/response TypeBox schemas |
| `server/src/utils/logs-analyzer/logs-analyzer-consts.ts` | Severity ranges, model IDs, error patterns |