---
name: wlm-db-tco
description: >
  Fetches and runs NetApp Workload Factory Explore Savings TCO for MSSQL and Oracle —
  automatic cloud (MSSQL EBS/FSxW; Oracle EBS only), manual what-if (MSSQL EBS/FSxW;
  Oracle EBS only), and on-prem collector data for both engines.
  Use when the user mentions TCO, storage savings, explore savings, cost breakdown,
  migration ROI, FSx for ONTAP comparison, manual what-if TCO, or on-prem assessment —
  even if they do not say "Explore Savings." Also triggers for Oracle FSxW requests to
  redirect to Oracle EBS (Oracle has no FSxW path). Do not trigger for PostgreSQL TCO,
  wlmdb source/route/UI edits, drift assessment, logs analysis, apply/remediate flows, or
  post-migration managed-host savings dashboards. PostgreSQL is not supported.
---

# Explore Savings / TCO (Workload Factory Databases)

Compare existing database storage and compute costs against recommended **FSx for ONTAP** on AWS.

| Path | Credentials | Data source |
|------|-------------|-------------|
| **Automatic EBS** | Yes | Discovered EC2 + EBS (MSSQL and Oracle) |
| **Automatic FSxW** | Yes | Discovered FSx for Windows (**MSSQL only**) |
| **Manual EBS / FSxW** | No | User-supplied config (Oracle: EBS only) |
| **On-prem MSSQL / Oracle** | No | Collector upload |

Cloud automatic: **two POSTs** (summary + `/calculations`). On-prem: **one POST** (`explore-savings` includes calculations).

## Mode routing

```
Engine? MSSQL (default) or Oracle (/oracle/... on same path shapes; Oracle has no FSxW)
EC2/FSxW under WF credentials?
├─ EBS → references/automatic-ebs.md (bulk hosts[], two POSTs)
├─ FSxW → references/automatic-fsxw.md (MSSQL only; single-instance, two POSTs)
├─ Hypothetical → references/manual-cloud.md (Oracle: EBS only)
└─ On-prem SQL Server / Oracle?
   ├─ Uploaded → references/onprem-mssql.md or references/onprem-oracle.md
   └─ Not uploaded → Upload workflow below (destructive)
```

**Out of scope:** PostgreSQL TCO; wlmdb source/route/UI edits; post-migration managed-host savings dashboards (redirect to the appropriate product surface).

**Oracle FSxW:** Oracle has no FSxW path (automatic or manual). Redirect to Oracle EBS.

Read the reference file for the chosen mode, plus [references/examples.md](references/examples.md) when executing curls. For automatic FSxW without an instance id, also read [references/automatic-ebs.md#discovery](references/automatic-ebs.md#discovery). Cloud paths use `/mssql/...`; for Oracle automatic or manual EBS, substitute `/oracle/...` (no FSxW). On-prem: user names one MSSQL resource → `POST .../resources/{resourceId}/explore-savings`; Oracle on-prem is bulk only.

This skill auto-applies from TCO / explore-savings triggers in the frontmatter description (not manual-only invocation).

## Task checklist

After mode is chosen:

```
- [ ] Read shell env vars; resolve TOKEN and ACCOUNT_ID if unset
- [ ] Read the mode reference + examples.md for curl patterns (see Additional resources)
- [ ] Run API calls per that reference
- [ ] Execute validate_response.sh on saved JSON (see Utility scripts)
- [ ] Present results per Answer format below (**all six sections required**)
```

Requires `curl`, `jq`, and network access.

## Utility scripts

**`scripts/validate_response.sh`** — execute after saving API JSON (do not read the script as documentation):

```bash
./scripts/validate_response.sh path/to/file.json cloud-summary
# modes: cloud-summary | cloud-calculations | onprem-explore
```

**`scripts/run_onprem_upload.sh`** — explicit confirmed upload helper (mutating), including jobs polling:

```bash
ENGINE=oracle FILE_PATH=/path/to/oracle-collector.json CONFIRM_UPLOAD=true \
./scripts/run_onprem_upload.sh
```

## Environment and auth

All paths use `{base}/accounts/{accountId}/wlmdb/v1`.

| `{base}` | `ENVIRONMENT` | Auth0 issuer |
|----------|---------------|--------------|
| `https://api.workloads.netapp.com` | `Production`, `Demo` | `netapp-cloud-account.auth0.com` |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` | `staging-netapp-cloud-account.auth0.com` |

Read shell vars when set; do not re-prompt. If unset, get `TOKEN` and `ACCOUNT_ID` from parent **netapp-workload-factory** (Auth0 + tenancy) or ask the user.

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | `Production`, `Staging`, `Demo`, or `StagingDemo` |
| `ACCOUNT_ID` | Tenancy `accountPublicId` (e.g. `account-PzlmCZPM`) |
| `CREDENTIALS_ID` | AWS credential UUID — automatic cloud only |
| `TOKEN` | Bearer token (Auth0 client credentials) |


**Demo:** `Demo` / `StagingDemo` need `x-simulator: true`. Default demo account when `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset: `account-j3aZttuL`. Demo credentials differ from production without the simulator header.

**Tenancy:** If `ACCOUNT_ID` unset — `GET https://api.bluexp.netapp.com/tenancy/account` (production) or `GET https://staging.api.bluexp.netapp.com/tenancy/account` (staging); use `accountPublicId`.

**Headers:** `Authorization: Bearer $TOKEN`; JSON bodies need `Content-Type: application/json`. Pass `-H "x-simulator: true"` on all curls in demo modes.

## Answer format

**Mandatory:** Every TCO reply must include **all six sections** below as separate headings (1–6). If the API returned no data or an error, state **N/A** for that section — do not omit sections.

Present TCO results to the user in this structure:

1. **Monthly savings** — `existing − recommended` from `totalSummary` (USD/month). Note if negative (FSx costs more).
2. **Cost comparison** — existing vs recommended (and `optimized` when present).
3. **Compute** — recommended instance type; `finding` (`OPTIMIZED`, `NOT_OPTIMIZED`, `INSUFFICIENT_DATA`).
4. **License** — edition and monthly price when returned.
5. **Storage** — EBS/FSxW/FSx totals; include calculation breakdown if `/calculations` was fetched.
6. **Context** — region, instance id(s) or resource id(s), credential used; note Demo/simulator if applicable.

On-prem: read from `storageSavings.totalSummary` and nested `calculations` in one response.

Field reference: [references/shared-fields.md](references/shared-fields.md).

## Automatic cloud workflow (summary)

When the user names region + credential but not an instance id:

1. Discover — see [automatic-ebs.md](references/automatic-ebs.md#discovery).
2. Pick or validate `ec2InstanceId` (`^i-[0-9a-f]{8,17}$`).
3. Optional instance detail to choose EBS vs FSxW backend.
4. Run mode-specific POSTs from the reference file.
5. Present per **Answer format** (all six sections — use N/A when a block is missing from the response).

## Manual cloud workflow (summary)

1. Build `ec2Instances[]` from user specs (Oracle: `oracleDeploymentType` — not MSSQL field names).
2. `POST .../manual-storage-savings/{ebs|fsxw}` then same body to `.../calculations` (Oracle: EBS only).
3. Present per Answer format.

Details: [references/manual-cloud.md](references/manual-cloud.md).

## Upload workflow (destructive)

On-prem collector upload **writes assessment data** via `POST .../{mssql|oracle}/onprem-tco/upload`. Treat it like a production data change.

### Confirmation gate (required before upload)

Phrases like *"please upload"*, *"here's my collector file"*, or attaching a filename are **requests**, not confirmation. Do **not** call upload until the user gives an **explicit yes** after you show:

- Engine (`mssql` or `oracle`)
- Filename and that you have a readable path (or need the user to provide one)
- That records will be **created or updated** in their account
- Target `regionCode` for the follow-on explore-savings step

**Stop after asking.** In that turn: no `POST .../upload`, no explore-savings on existing resources as a substitute, no TCO numbers — unless the user only asked to run TCO on data **already** uploaded (separate on-prem workflow).

**Anti-patterns (do not):**

- Treat *"please upload"* or a filename attachment as confirmation.
- Run explore-savings on existing resources when the user asked to upload a new collector file.
- Return TCO numbers in the same turn as the confirmation prompt.

Accept confirmation only when the user clearly affirms (e.g. *"yes, upload it"*, *"confirmed"*, *"go ahead"*). If the file path is missing, ask for it before upload even after confirmation.

### Steps (after explicit confirmation)

1. `GET .../{mssql|oracle}/onprem-tco/collector` if the customer still needs the script.
2. `POST .../{mssql|oracle}/onprem-tco/upload` with `fileName` and `fileContent` where `fileContent` is **base64(gzip(base64(raw-json-bytes)))** — not raw gzip. Use `scripts/run_onprem_upload.sh` or mirror its Python encoding step.
3. Poll `GET .../jobs/{jobId}` until `COMPLETED` or `FAILED`.
4. `GET .../{mssql|oracle}/onprem-tco/resources` → explore-savings per on-prem reference.

Details: [onprem-mssql.md](references/onprem-mssql.md), [onprem-oracle.md](references/onprem-oracle.md), [examples.md](references/examples.md) example 8.

## Additional resources

| Resource | Purpose |
|----------|---------|
| [references/automatic-ebs.md](references/automatic-ebs.md) | Discovered EC2 + EBS (bulk, two POSTs) |
| [references/automatic-fsxw.md](references/automatic-fsxw.md) | FSx for Windows (MSSQL only, two POSTs) |
| [references/manual-cloud.md](references/manual-cloud.md) | Hypothetical what-if (no credentials) |
| [references/onprem-mssql.md](references/onprem-mssql.md) | On-prem SQL Server explore-savings |
| [references/onprem-oracle.md](references/onprem-oracle.md) | On-prem Oracle explore-savings |
| [references/shared-fields.md](references/shared-fields.md) | Snapshot fields and response mapping |
| [references/examples.md](references/examples.md) | curl command examples |
| [../evals/ORCHESTRATE.md](../evals/ORCHESTRATE.md) | Eval loop ([skill-creator](https://www.skills.sh/anthropics/skills/skill-creator)) |

