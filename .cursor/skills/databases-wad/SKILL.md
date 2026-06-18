---
name: databases-wad
description: Master skill for NetApp Workload Factory registered (continuous) drift assessment for managed databases. Routes to the engine-specific reference for MSSQL (SQL Server) or Oracle - account, host, and instance-level findings, on-demand re-assessment, patch scans, and dismissal of findings. Use when the user asks about registered / drift assessment, "what does Workload Factory say about this database?", on-demand re-assessment, patch scans, or dismissing findings, with or without specifying the engine. Does not cover offline / one-time WAD upload flows or any optimize / apply / remediate / fix flows.
metadata:
  author: wlm-db
  version: 1.0.0
---

# Workload Factory Registered Drift Assessment

Read and manage continuous drift findings for managed MSSQL and Oracle databases.

**Out of scope:** TCO / Explore Savings (use the `wlm-db-tco` skill); offline / one-time WAD collector upload; optimize / apply / remediate / fix; logs analysis; post-migration managed-host savings dashboards; PostgreSQL.

## Environment and auth

All paths use `{base}/accounts/{accountId}/wlmdb/v1`.

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

## Required inputs

Ask only if not already provided. Never fabricate IDs.

| Input | Required when | Description |
|---|---|---|
| `region` | always | AWS region (e.g. `us-east-1`) |
| `engine` | ambiguous routing | `mssql` or `oracle` |
| `databaseHostId` | host- or instance-scope calls | Managed database host ID |
| `databaseInstanceId` | instance-scope calls | Database instance ID |

## Routing rules — pick an engine

1. **Explicit engine** — "SQL Server", "MSSQL", "AOAG", "FCI", "MAXDOP" → MSSQL. "Oracle", "ASM", "RAC", "PDB", "CDB", "redo log", "SnapCenter" → Oracle. Load the matching reference.
2. **Identifier hints** — instance name `MSSQLSERVER` → MSSQL; Oracle SID / service name → Oracle.
3. **Cross-engine question** ("show me all drifted databases", "summarize the account") → run both engines' account-scope reads and merge results, labeled by engine.
4. **Ambiguous, no signal** → ask the user which engine before making any call.

Once an engine is picked, **read the corresponding reference file and follow it verbatim** — it owns endpoint paths, dimension names, response shapes, and examples: [references/mssql.md](references/mssql.md), [references/oracle.md](references/oracle.md).

## Destructive confirmation gate (required)

These calls **mutate state** and must not run without explicit user confirmation in the same or a later turn:

- `POST .../assessment` — re-assessment trigger; **overwrites** the stored assessment.
- `POST .../assessment/dismiss` — hides a finding from future reports (or un-hides when `dismissed: false`).

Before sending, **state**:

- Engine (`mssql` or `oracle`)
- `databaseHostId` and `databaseInstanceId`
- Dimension (`configurationName`) for dismiss
- That the stored assessment will be **overwritten** (re-assessment) or the finding will be **hidden** (dismiss)
- Whether `dismissed: true` (hide) or `dismissed: false` (un-hide)

**Stop after asking.** In that turn: no `POST .../assessment`, no `POST .../assessment/dismiss`, no answer that pretends the action happened.

Phrases like *"re-scan it"*, *"please refresh the assessment"*, or *"dismiss this finding"* are **requests**, not confirmation. Accept confirmation only when the user clearly affirms (e.g. *"yes, re-assess"*, *"confirmed"*, *"go ahead"*).

Read calls (`GET .../assessment`, `GET .../assessment/patch-scan`, `GET .../jobs/{jobId}`) do **not** require this gate.

## Workflow

Execute the relevant skill(s) in order. Stop and report if any step fails.

---

### Skill 1 — Read drift

Pick the smallest scope that answers the question.

**Account scope** — rank all drifted hosts/instances:
```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/credentials/${CREDENTIALS_ID}/regions/{region}/assessment?pageSize=200" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Host scope** — drill into one host:
```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/credentials/${CREDENTIALS_ID}/regions/{region}/database-hosts/{hostId}/assessment" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Instance scope** — full per-dimension detail:
```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/credentials/${CREDENTIALS_ID}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment?fields={dimensions}" \
  -H "Authorization: Bearer ${TOKEN}"
```

Replace `{engine}` with `mssql` or `oracle`. See the engine reference for valid `{dimensions}`. Paginate with `nextToken` until absent. In Demo / StagingDemo modes add `-H "x-simulator: true"`.

---

### Skill 2 — Trigger re-assessment or patch scan

**Confirmation gate applies** (see above). Wait for explicit user confirmation before sending.

Trigger re-assessment:
```bash
curl -sSk -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/credentials/${CREDENTIALS_ID}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Capture `jobId` from the `202` response, then poll until terminal:
```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/jobs/{jobId}" \
  -H "Authorization: Bearer ${TOKEN}"
```
Terminal `status` values: `COMPLETED`, `FAILED`. After `COMPLETED`, re-fetch the instance assessment (Skill 1, instance scope) and present the new findings.

On-demand patch scan (read, no job, no confirmation gate):
```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/credentials/${CREDENTIALS_ID}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment/patch-scan?field={field}" \
  -H "Authorization: Bearer ${TOKEN}"
```
Allowed `{field}` values per engine — see the engine reference.

Stop and report if the trigger, polling, or re-fetch fails.

---

### Skill 3 — Dismiss a finding

**Confirmation gate applies** (see above). Wait for explicit user confirmation before sending.

```bash
curl -sSk -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/{engine}/assessment/dismiss" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "configurationsToDismiss": [
      {
        "databaseHostId": "{hostId}",
        "databaseInstanceId": "{instanceId}",
        "configurationName": "{dimension}",
        "dismissed": true
      }
    ]
  }'
```

Set `dismissed: false` to un-dismiss. Stop and report if the call fails.

---

## Cross-engine account summary

When a single answer must cover both engines for the same `ACCOUNT_ID` / `region`, call both account-scope GETs and merge:

```bash
curl -sSk -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/mssql/credentials/${CREDENTIALS_ID}/regions/{region}/assessment?pageSize=200" \
  | jq '{ engine: "mssql", count, rows: .assessmentsPerAccount }'

curl -sSk -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/oracle/credentials/${CREDENTIALS_ID}/regions/{region}/assessment?pageSize=200" \
  | jq '{ engine: "oracle", count, rows: .assessmentsPerAccount }'
```

The per-host wrapper shape (`databaseHostId`, `databaseHostName`, `instancesAssessment[]`) is identical across engines; the per-instance `assessments` object differs — inspect engine by engine.

## Answer format

Present drift results in this structure:

1. **Not-optimized count and severity** — total failing dimensions and a severity breakdown (Critical / Severe / Important) from the assessment.
2. **Top failing dimensions** — list each failing dimension with its `recommendation` text.
3. **Context** — engine, `databaseHostId` / `databaseHostName`, `databaseInstanceId`, region, credential.
4. **Action taken** — `read`, `re-assessed` (include `jobId` and terminal `status`), `patch-scanned`, `dismissed` / `un-dismissed`.
5. **Demo / simulator note** — when `ENVIRONMENT` ∈ {`Demo`, `StagingDemo`}, state that results came from the simulator.

For multi-host or cross-engine answers, also include the **Final report** table below.

## Final report

```
## Drift Assessment Report

| Engine | Host                | Instance     | Not-Optimized | Severity (C/S/I)   | Action            |
|--------|---------------------|--------------|---------------|--------------------|-------------------|
| mssql  | host-prod-sql-01    | MSSQLSERVER  | 4             | 1 / 2 / 1          | Read              |
| mssql  | host-prod-sql-02    | MSSQLSERVER  | 0             | 0 / 0 / 0          | Re-assessed       |
| oracle | host-prod-orcl-01   | ORCL         | 6             | 2 / 3 / 1          | Read              |
| oracle | host-prod-orcl-02   | ORCL         | 1             | 0 / 0 / 1          | Dismissed (clone) |

Top recommendations:
- mssql / host-prod-sql-01 / storage:               {recommendation}
- oracle / host-prod-orcl-01 / oracleSecurityPatch: {recommendation}
```

Severity counts: C = critical, S = severe, I = important. Lead with the not-optimized total, then surface `recommendation` for each failing dimension.

## Refusal template

```
That request is outside what this skill covers — I only handle registered (continuous) drift assessment for MSSQL and Oracle, not TCO / Explore Savings, optimize / apply / fix actions, logs analysis, or the offline one-time WAD upload flow. You can run those from the Workload Factory UI or via the corresponding skill (for example, wlm-db-tco for storage savings).
```

## Evaluations

Regression prompts and grading live in [evals/evals.json](evals/evals.json). Grader: [agents/grader.md](agents/grader.md). Description trigger set: [evals/trigger-eval.json](evals/trigger-eval.json).

## Additional reference

For full endpoint specs, dimension lists, response shapes, and curl examples, see:
- [references/mssql.md](references/mssql.md) — MSSQL endpoints and dimensions (`storage`, `compute`, `license`, `host-os-patch`, `mssql-patch`, `rss-config`, `maxdop`, `mapped-ontap-volumes`, `clone`, `snapshot-policy`, `aws-backup`, `crr`, `high-availability`, `mtu-alignment`).
- [references/oracle.md](references/oracle.md) — Oracle endpoints and dimensions (`storage`, `compute`, `host-os-patch`, `oracle-security-patch`, `aws-backup`, `crr`, `snapcenter-snapshot`, `clone`, `mapped-ontap-volumes`).
