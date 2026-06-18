---
name: fetch-logs-analysis-results
description: Fetch NetApp Workload Factory database logs analysis results (remediation recommendations, severity counts, latest reports) for managed MSSQL and Oracle instances. Use when the user asks to retrieve, list, summarize, trigger, or check prerequisites for database logs analysis. PostgreSQL is not supported.
metadata:
  author: wlm-db
  version: 1.0.0
---

# Database Logs Analysis (Workload Factory)

## Why this skill exists

Workload Factory runs AI-driven log analysis on managed MSSQL and Oracle database instances and persists each scan as a `logs_analysis_report` keyed by `accountId + databaseHostId + databaseInstanceId + jobId`. Each report contains an array of `RemediationRecommendation` objects, one per error pattern.

This skill covers two paths:

- **Read** (summary, list reports, fetch a report) — non-mutating.
- **Trigger** (`POST .../logs-analysis`) — destructive: consumes Bedrock tokens, runs SSM on the EC2 host, and writes a new report.

## API common ground

| Environment | Base URL |
|---|---|
| Production | `https://api.workloads.netapp.com` |
| Staging | `https://staging.api.workloads.netapp.com` |

All paths below are relative to `/accounts/{accountId}/wlmdb/v1`. Replace `{db}` with `mssql` or `oracle`.

| Header | Description |
|---|---|
| `Authorization` | `Bearer <access_token>` (required) |
| `Content-Type` | `application/json` (POST/PATCH) |
| `x-simulator` | `true` for simulator/test mode (optional) |
| `x-service-request-id` | Request correlation ID (optional) |
| `x-agent-id` | Agent ID header (optional) |

Jobs: trigger returns `{ jobId }`; poll `GET /accounts/{accountId}/wlmdb/v1/jobs/{jobId}` until `COMPLETED` or `FAILED`.

## Environment and auth

| Item | How to obtain |
|------|---------------|
| `Authorization: Bearer <token>` | Auth0 client-credentials exchange against `https://netapp-cloud-account.auth0.com/oauth/token` (audience `https://api.cloud.netapp.com`) |
| `accountId` | `GET https://api.bluexp.netapp.com/tenancy/account` → `accountId` |
| `credentialsId` (UUID v4) | `GET /accounts/{accountId}/credentials/v1/aws` |
| `region` | AWS region of the credential (`us-east-1`, …) |
| `databaseHostId`, `databaseInstanceId` | `GET /accounts/{accountId}/wlmdb/v1/{db}/credentials/{credentialsId}/regions/{region}/database-hosts` (each host carries nested `databaseInstances[]`) |
| `jobId` | Returned by trigger or surfaced as `latestReport.jobId` in summary responses; historical jobs via `GET /accounts/{accountId}/wlmdb/v1/jobs?type=LOGS_ANALYSIS` |

Route schemas reject malformed inputs with HTTP 400 (e.g. `params/credentialsId must match format "uuid"`, `ec2InstanceId` pattern `^i-[0-9a-z]{8,17}(?:,i-[0-9a-z]{8,17}){0,4}$`, up to 5 comma-separated).

## Routing

Read paths, prerequisites, trigger, pricing, and curl examples: [references/read.md](references/read.md).

**Report-by-id (must):** When the user mentions **report id**, execute `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}` — never substitute summary-only.

**Oracle prerequisites:** POST is read-only; body requires `databaseInstanceName` for the permission check.

## Reference files

| File | Contents |
|------|----------|
| [references/read.md](references/read.md) | Endpoints, routing, read/trigger/prereq workflows, Examples 1–4, aggregation, severity buckets |

## Workflow

1. **Identify intent** — read (summary / aggregate / report-by-id / job) vs trigger vs prerequisites.
2. **Resolve inputs** — `accountId`, `credentialsId`, `region`, `databaseHostId`, `databaseInstanceId`, optional `reportId` or `jobId`.
3. **Confirm if mutating** — trigger requires explicit user confirmation before POST (see Destructive operations).
4. **Read [references/read.md](references/read.md)** — endpoint tables and curl examples.
5. **Present** — summarize `remediationRecommendation[]` with severity, counts, cause, and remediation steps; cite scan window when known.

## Destructive operations

**Trigger** (`POST .../logs-analysis`) consumes Bedrock tokens (real money), runs SSM on the EC2 host, and writes a new report.

Before POST:

1. Read prerequisites; stop if any populated `ready` is `false`.
2. Confirm with the user — host, instance, scan window (default 24 h), Bedrock cost (`GET /pricing/region/{region}/logs-analysis`).
3. POST → poll job → fetch report by `jobId`.

In SAM environments: `prepare_bash` (destructive=true) → user approval → `record_bash_decision` → `bash`. Do not delegate trigger to subagents. SAM byte-for-byte bash matching: [references/read.md](references/read.md#trigger-workflow-destructive).

## Evals

Functional evals: `evals/evals.json`, `evals/trigger-eval.json`, `agents/grader.md`. Run via Cursor **`/skill`**; finish with `python3 .cursor/skills/evals/run.py finish --iteration <N>`.
