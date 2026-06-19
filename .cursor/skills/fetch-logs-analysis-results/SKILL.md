---
name: fetch-logs-analysis-results
description: >
  Fetch and manage NetApp Workload Factory database logs analysis results — remediation
  recommendations, severity counts, latest reports, prerequisites, and on-demand log scans
  for managed MSSQL and Oracle instances. Use when the user asks about logs analysis, log scan,
  AI log analyzer, Bedrock log analysis, error-pattern remediation, SSM log collection,
  logs-analysis prerequisites or readiness, listing logs-analysis reports, fetching a report by id
  or jobId, or triggering a new logs-analysis run — even if they say "logs analyzer" or
  "remediation from database logs." Does not cover registered / continuous drift assessment or
  WAD (use databases-wad); TCO / Explore Savings (use wlm-db-tco); PostgreSQL logs analysis;
  offline one-time WAD collector upload; optimize / apply / remediate / fix flows; wlmdb
  source/route/UI edits; or running the logs-analyzer CLI package in this repo.
metadata:
  author: wlm-db
  version: 1.1.0
---

# Database Logs Analysis (Workload Factory)

Read and manage AI-driven log analysis for managed MSSQL and Oracle databases.

**Out of scope:** registered / drift assessment and WAD (use `databases-wad`); TCO / Explore Savings (use `wlm-db-tco`); PostgreSQL; offline one-time WAD upload; optimize / apply / fix; wlmdb UI/server code changes; local `logs-analyzer/` CLI unit tests or package runs.

Each scan is stored as a `logs_analysis_report` with `RemediationRecommendation` objects per error pattern. Two paths:

- **Read** (summary, list reports, fetch by id or jobId, prerequisites) — non-mutating.
- **Trigger** (`POST .../logs-analysis`) — destructive: consumes Bedrock tokens, runs SSM on the EC2 host, and writes a new report.

## Environment and auth

All paths use `{base}/accounts/{accountId}/wlmdb/v1`. Replace `{db}` with `mssql` or `oracle`.

| `{base}` | `ENVIRONMENT` | Auth0 issuer |
|----------|---------------|--------------|
| `https://api.workloads.netapp.com` | `Production`, `Demo` | `netapp-cloud-account.auth0.com` |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` | `staging-netapp-cloud-account.auth0.com` |

Read shell vars when set; do not re-prompt. If unset, get `TOKEN` and `ACCOUNT_ID` from parent **netapp-workload-factory** (Auth0 + tenancy) or ask the user.

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | yes | `Production`, `Staging`, `Demo`, or `StagingDemo` |
| `ACCOUNT_ID` | yes | Tenancy `accountPublicId` (e.g. `account-PzlmCZPM`) |
| `CREDENTIALS_ID` | yes | AWS credential UUID linked to the account |
| `TOKEN` | yes | Bearer token (Auth0 client credentials) |

Resolve at runtime:
```bash
echo "ENVIRONMENT=$ENVIRONMENT"
echo "ACCOUNT_ID=$ACCOUNT_ID"
echo "CREDENTIALS_ID=$CREDENTIALS_ID"
echo "TOKEN=$TOKEN"
```

**Demo:** `Demo` / `StagingDemo` need `x-simulator: true` on every curl. Default demo account when `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset: `account-j3aZttuL`. Demo credentials differ from production without the simulator header.

**Tenancy:** If `ACCOUNT_ID` unset — `GET https://api.bluexp.netapp.com/tenancy/account` (production) or `GET https://staging.api.bluexp.netapp.com/tenancy/account` (staging); use `accountPublicId`.

**Headers:**
```
Authorization: Bearer ${TOKEN}
Content-Type: application/json   (POST only)
x-simulator: true                (Demo / StagingDemo only)
```

**Other inputs:** resolve `region`, `databaseHostId`, and `databaseInstanceId` from the user or `GET .../{db}/credentials/{CREDENTIALS_ID}/regions/{region}/database-hosts`. Historical jobs: `GET .../jobs?type=LOGS_ANALYSIS`. Route schemas reject malformed inputs with HTTP 400.

Jobs: trigger returns `{ jobId }`; poll `GET .../jobs/{jobId}` until `COMPLETED` or `FAILED`.

## Required inputs

Ask only if not already provided. Never fabricate IDs.

| Input | Required when | Description |
|---|---|---|
| `region` | always | AWS region (e.g. `us-east-1`) |
| `engine` | ambiguous routing | `mssql` or `oracle` |
| `databaseHostId` | instance-scope calls | Managed database host ID |
| `databaseInstanceId` | instance-scope calls | Database instance ID |
| `reportId` or `jobId` | report-by-id or job-scoped read | From user, summary, or reports list |

## Routing rules

1. **Identify intent** — read (summary / aggregate / report-by-id / job) vs trigger vs prerequisites.
2. **Pick engine** — "SQL Server", "MSSQL" → `mssql`; "Oracle", SID/service → `oracle`. PostgreSQL → refuse (see Refusal template).
3. **Pick scope** — region summary, instance aggregate, specific report (`id`), or job (`jobId`).
4. **Load reference** — read [references/read.md](references/read.md) for endpoint paths, query params, curl examples, aggregation, severity buckets, prerequisites messages, trigger body fields, and pricing.

**Report-by-id (must):** When the user mentions **report id**, execute `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}` — never substitute summary-only.

**Oracle prerequisites:** POST is read-only; body requires `databaseInstanceName` for the permission check.

## Workflow

Execute in order. Stop and report if any step fails.

1. **Resolve inputs** — `ENVIRONMENT`, `ACCOUNT_ID`, `CREDENTIALS_ID`, `TOKEN`, `region`, engine, host/instance, optional `reportId` or `jobId`.
2. **Confirm if mutating** — trigger requires explicit user confirmation (see Destructive operations).
3. **Load [references/read.md](references/read.md)** — pick the matching read, prerequisite, trigger, or pricing section and follow its curl examples verbatim (add `x-simulator: true` in Demo / StagingDemo).
4. **Present** — per Answer format below.

## Destructive operations

**Trigger** (`POST .../logs-analysis`) consumes Bedrock tokens (real money), runs SSM on the EC2 host, and writes a new report.

Before POST:

1. Read prerequisites; stop if any populated `ready` is `false`.
2. Confirm with the user — host, instance, scan window (default 24 h), Bedrock cost (`GET /pricing/region/{region}/logs-analysis`).
3. POST → poll job → fetch report by `jobId`.

Phrases like *"trigger logs analysis now"*, *"run a log scan"*, or *"please analyze the logs"* are **requests**, not confirmation. Accept confirmation only when the user clearly affirms (e.g. *"yes, trigger it"*, *"confirmed"*, *"go ahead"*). **Stop after asking** — no POST in that turn.

In SAM environments: `prepare_bash` (destructive=true) → user approval → `record_bash_decision` → `bash`. Do not delegate trigger to subagents. SAM byte-for-byte bash matching: [references/read.md](references/read.md#trigger-workflow-destructive).

Read calls (summary, reports list, instance GET, prerequisites, pricing, job poll) do **not** require this gate.

## Answer format

Present logs-analysis results in this structure:

1. **Severity and error counts** — from `latestReport.severityCounts` (summary) or aggregated `remediationRecommendation[]`.
2. **Top recommendations** — error pattern, count, severity, cause, remediation steps.
3. **Context** — engine, `databaseHostId`, `databaseInstanceId`, region, credential, scan window or report id / jobId.
4. **Action taken** — `read`, `prerequisites checked`, `triggered` (include `jobId` and terminal job `status`), or `refused` (out of scope / PostgreSQL).
5. **Demo / simulator note** — when `ENVIRONMENT` ∈ {`Demo`, `StagingDemo`}, state that results came from the simulator.

## Refusal template

```
That request is outside what this skill covers — I handle Workload Factory logs analysis (read, prerequisites, and confirmed trigger) for MSSQL and Oracle, not registered drift / WAD assessment, TCO / Explore Savings, PostgreSQL logs analysis, optimize / apply / fix actions, or local logs-analyzer CLI work. For drift use databases-wad; for TCO use wlm-db-tco.
```

## Evaluations

Regression prompts and grading live in [evals/evals.json](evals/evals.json). Grader: [agents/grader.md](agents/grader.md). Description trigger set: [evals/trigger-eval.json](evals/trigger-eval.json).

Run artifacts: `.cursor/skills/fetch-logs-analysis-results-workspace/iteration-<N>/eval-<id>/` (sibling workspace, gitignored). Finish with `python3 .cursor/skills/evals/run.py finish --iteration <N>`.

## Additional reference

For full endpoint specs, routing tables, request/response shapes, severity mapping, prerequisites field messages, trigger body defaults, and curl examples, see [references/read.md](references/read.md).
