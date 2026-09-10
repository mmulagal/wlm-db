---
name: oracle-optimize
description: >-
  Assess and apply Oracle optimize / fix configurations in NetApp Workload Factory —
  currently AWS Backup (enable FSx for ONTAP automatic backup, retention days, backup
  window) and File system headroom (storage sizing). Use when the user asks to optimize,
  apply, enable, or fix an Oracle database configuration — e.g. "enable AWS backup for
  this Oracle database", "optimize the backup configuration", "fix file system headroom",
  or "apply the recommended storage sizing fix" — including checking whether a config is
  already optimized before offering to fix it. Does not cover registered / drift-only
  reads (databases-wad), TCO / Explore Savings (wlm-db-tco), logs analysis, MSSQL optimize,
  or any Oracle optimize type other than AWS Backup and File system headroom (storage
  layout, storage configuration, compute host OS, clone — not yet implemented).
metadata:
  author: wlm-db
  version: 1.0.0
---

# Oracle Optimize Configuration (Workload Factory)

Assess an Oracle database instance, decide whether a configuration is already optimized, and — with explicit confirmation — apply the fix and poll it to completion.

**Implemented types:** AWS Backup, File system headroom. **Out of scope:** any other Oracle optimize type (storage layout, storage configuration, compute host OS, clone) until a reference file exists for it; MSSQL optimize; registered drift reads/re-assess/dismiss (`databases-wad`); TCO / Explore Savings (`wlm-db-tco`); logs analysis; PostgreSQL.

## Environment and auth

All paths use `{base}/accounts/{accountId}/wlmdb/v1` (assessment reads use **v2**, not v1 — see below).

| `{base}` | `ENVIRONMENT` | Auth0 issuer |
|----------|---------------|--------------|
| `https://api.workloads.netapp.com` | `Production`, `Demo` | `netapp-cloud-account.auth0.com` |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` | `staging-netapp-cloud-account.auth0.com` |

Read shell vars when set; do not re-prompt. If unset, get `TOKEN` and `ACCOUNT_ID` from parent **netapp-workload-factory** (Auth0 + tenancy) or ask the user.

| Variable | Required | Description |
|----------|----------|--------------|
| `ENVIRONMENT` | yes | `Production`, `Staging`, `Demo`, or `StagingDemo` |
| `ACCOUNT_ID` | yes | Tenancy `accountPublicId` (e.g. `account-PzlmCZPM`) |
| `CREDENTIALS_ID` | yes | AWS credential UUID linked to the account |
| `TOKEN` | yes | Bearer token (Auth0 client credentials) |

Resolve at runtime (`BASE_URL` from `ENVIRONMENT`):
```bash
case "$ENVIRONMENT" in
  Production|Demo) BASE_URL=https://api.workloads.netapp.com ;;
  Staging|StagingDemo) BASE_URL=https://staging.api.workloads.netapp.com ;;
esac
echo "ENVIRONMENT=$ENVIRONMENT"
echo "BASE_URL=$BASE_URL"
echo "ACCOUNT_ID=$ACCOUNT_ID"
echo "CREDENTIALS_ID=$CREDENTIALS_ID"
```

**Demo:** `Demo` / `StagingDemo` need `x-simulator: true` on every curl. Default demo account when `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset: `account-j3aZttuL`.

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
| `databaseHostId` | always | Managed database host ID |
| `databaseInstanceId` | always | Database instance ID |
| optimize type | ambiguous | `aws-backup` or `headroom` — ask if the user just says "optimize this database" with no dimension named |
| `backupRetentionDays`, `backupStartTime` | AWS Backup only, before POST | Not present on the assessment; collect from the user and validate (see [references/aws-backup.md](references/aws-backup.md)) |

## APIs

| Step | Method | Path |
|------|--------|------|
| 1. Assess | `GET` | `{base}/accounts/{accountId}/wlmdb/v2/oracle/credentials/{CREDENTIALS_ID}/regions/{region}/database-hosts/{databaseHostId}/database-instances/{databaseInstanceId}/assessment?fields={field}` |
| 2. Optimize | `POST` | `{base}/accounts/{accountId}/wlmdb/v1/oracle/database-hosts/optimize` |
| 3. Poll | `GET` | `{base}/accounts/{accountId}/wlmdb/v1/jobs/{jobId}` — every **10 seconds** until `COMPLETED` or `FAILED` |

Use the **v2** assessment endpoint (`assessments[]` array), not v1 (flattened per-dimension object) — v1 renames `id`→`name` and drops the error/status distinction this workflow depends on. `{field}` for `fields=` is `aws-backup` (AWS Backup) or `storage` (File system headroom — headroom has no dedicated top-level field name; it lives inside the `storage` compound section).

Response shape: `{ assessments: [...], dismissedConfigurations: [], metadata: {...} }`. Each item in `assessments[]` is either a **finding** (`id`, `status`, `objectsInViolation`, `totalObjectsInViolation`, `recommendation`, ...) or an **error item** (same static fields but no `status` key — only `errorMessage`). `metadata.fileSystemId` carries the FSx filesystem id used by AWS Backup's payload.

## Workflow

Execute in order. Stop and report if any step fails.

1. **Resolve inputs** — `ENVIRONMENT`, `ACCOUNT_ID`, `CREDENTIALS_ID`, `TOKEN`, `region`, `databaseHostId`, `databaseInstanceId`, and the optimize type (ask if ambiguous).
2. **Load the matching reference** — [references/aws-backup.md](references/aws-backup.md) or [references/headroom.md](references/headroom.md) — for the exact assessment item `id`, `fields=` value, and POST payload shape. Refuse (see Refusal template) if the user names an unimplemented type.
3. **GET the v2 assessment**, scoped with `fields=` to the type.
4. **Find the assessment item** by its `id` (not the `fields=`/optimize-type name — they can differ; e.g. AWS Backup's item `id` is `backup-configuration`, not `aws-backup`).
5. **Error item** (has `errorMessage`, no `status` key) → report the `errorMessage` verbatim and **exit**. Do not offer optimize.
6. **Optimized** (`status === "optimized"` and `totalObjectsInViolation === 0` / `objectsInViolation` empty) → tell the user the configuration is already optimized and **exit**. Do not POST.
7. **Not optimized** (`status` is `not-optimized` or `under-provisioned`, or `totalObjectsInViolation > 0`) → summarize the finding (`recommendation`, violating objects from `objectsInViolation` / `violationDetails[]`) and **offer** to run the fix. Collect any type-specific user fields (AWS Backup only). **Do not POST** until the user explicitly confirms (see Confirmation gate). `analyzing` / `not-applicable` → report the state as-is; do not offer optimize.
   - **`over-provisioned`** (headroom) → summarize the finding and **exit**. Do not offer the fix and do not POST: Workload Factory does not automate capacity decrease, so the optimize job can only fail. Tell the user capacity must be reduced manually.
8. **Build the POST payload** from the reference file (assessment `metadata` + user fields as required) and `POST .../oracle/database-hosts/optimize` → `{ jobId }`.
9. **Poll** `GET .../jobs/{jobId}` every **10 seconds** until `status` is `COMPLETED` or `FAILED`.
10. **`COMPLETED`** → tell the user the configuration is now optimized. **`FAILED`** → tell the user it is **not** optimized and include the job's `error` message if present. Either way, **exit**.

## Confirmation gate (required before POST)

`POST .../oracle/database-hosts/optimize` **mutates live infrastructure** — AWS Backup enables FSx for ONTAP automatic backups; headroom resizes the FSx filesystem. Before sending it, **state**:

- Optimize type, `databaseHostId`, `databaseInstanceId`
- What will change (AWS Backup: FSx filesystem id, retention days, backup start time; headroom: that FSx capacity will grow)

**Stop after asking.** In that turn: no `POST .../optimize`, no answer that pretends the fix happened.

Phrases like *"optimize this now"*, *"fix the backup configuration"*, or *"apply the headroom fix"* on first ask are **requests**, not confirmation. Accept confirmation only when the user clearly affirms in the same or a later turn (e.g. *"yes, go ahead"*, *"confirmed"*). Invalid AWS Backup field values (see [references/aws-backup.md](references/aws-backup.md)) block the POST regardless of confirmation — surface the validation error instead.

`GET` assessment and `GET` job are not gated.

## Routing

| User names | Reference | Assessment item `id` | `fields=` |
|---|---|---|---|
| AWS backup, FSx automatic backup, backup configuration | [references/aws-backup.md](references/aws-backup.md) | `backup-configuration` | `aws-backup` |
| File system headroom, storage sizing, headroom | [references/headroom.md](references/headroom.md) | `headroom` | `storage` |
| Anything else (storage layout, storage configuration, compute host OS, clone, MSSQL) | none — refuse | — | — |

## Refusal template

```
That request is outside what this skill covers today — I can assess and optimize Oracle AWS Backup
and File system headroom configurations, not [storage layout / compute host OS / clone / MSSQL
optimize / TCO / logs analysis / registered drift reads], and not PostgreSQL. For registered drift
reads, re-assessment, or dismissing findings, use databases-wad. For TCO, use wlm-db-tco.
```

## Answer format

1. **Assessment state** — optimized / not-optimized / error, with `recommendation` and violating objects when not optimized.
2. **Context** — optimize type, `databaseHostId`, `databaseInstanceId`, region, credential.
3. **Action taken** — `read`, `offered` (awaiting confirmation), `optimized` (include `jobId` and terminal status), or `refused` (out of scope).
4. **Demo / simulator note** — when `ENVIRONMENT` ∈ {`Demo`, `StagingDemo`}, state that results came from the simulator.

## Evaluations

Regression prompts and grading live in [evals/evals.json](evals/evals.json). Grader: [agents/grader.md](agents/grader.md). Description trigger set: [evals/trigger-eval.json](evals/trigger-eval.json).

Run artifacts: `.cursor/skills/oracle-optimize-workspace/iteration-<N>/eval-<id>/` (sibling workspace, gitignored). Finish with `python3 .cursor/skills/evals/run.py finish --iteration <N>`.

## Additional resources

| Resource | Purpose |
|----------|---------|
| [references/aws-backup.md](references/aws-backup.md) | AWS Backup assessment lookup, POST payload, field validation |
| [references/headroom.md](references/headroom.md) | File system headroom assessment lookup and POST payload |
| [../evals/README.md](../evals/README.md) | Eval framework; run via Cursor **`/skill`** |
