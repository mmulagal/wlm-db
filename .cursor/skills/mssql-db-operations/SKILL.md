---
name: mssql-db-operations
description: >-
    Operate MSSQL databases on AWS in NetApp Workload Factory — list SQL Server hosts,
    create databases, sandbox clones, sandbox lifecycle (refresh, re-baseline, split, delete),
    ONTAP snapshots, and manual ONTAP runbooks when SSM is unavailable. Use when the user
    asks about MSSQL DB operator tasks, SQL Server database hosts, inventory, create database,
    sandbox, clone, FlexClone, ONTAP snapshot, FSx, SSM connectivity, refresh, re-baseline,
    split sandbox, or delete sandbox on AWS. Does not cover Oracle/PGSQL, registered drift
    assessment (databases-wad), TCO (wlm-db-tco), or logs analysis.
metadata:
    author: wlm-db
    version: 1.0.0
---

# MSSQL DB Operator (Workload Factory)

Create databases, sandbox clones, and lifecycle operations on managed MSSQL hosts. When SSM is available, use WLMDB REST APIs. When SSM is not available, **show the user** numbered **ONTAP CLI** plus host/SQL instructions — do not execute them.

**Out of scope:** Oracle/PGSQL; registered drift / WAD (`databases-wad`); TCO / Explore Savings (`wlm-db-tco`); logs analysis; optimize / apply / fix; CVO skills in `wfcvo/`.

## Environment and auth

All WLMDB paths use `{base}/accounts/{accountId}/wlmdb/v1`. ONTAP proxy paths use `{base}/accounts/{accountId}/proxy/v1/targets/{fsxId}/https/`.

| `{base}`                                   | `ENVIRONMENT`            | Auth0 issuer                             |
| ------------------------------------------ | ------------------------ | ---------------------------------------- |
| `https://api.workloads.netapp.com`         | `Production`, `Demo`     | `netapp-cloud-account.auth0.com`         |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` | `staging-netapp-cloud-account.auth0.com` |

Read shell vars when set; do not re-prompt. If unset, get `TOKEN` and `ACCOUNT_ID` from parent **netapp-workload-factory** (Auth0 + tenancy) or ask the user.

| Variable         | Required | Description                                         |
| ---------------- | -------- | --------------------------------------------------- |
| `ENVIRONMENT`    | yes      | `Production`, `Staging`, `Demo`, or `StagingDemo`   |
| `ACCOUNT_ID`     | yes      | Tenancy `accountPublicId` (e.g. `account-PzlmCZPM`) |
| `CREDENTIALS_ID` | yes      | AWS credential UUID linked to the account           |
| `TOKEN`          | yes      | Bearer token (Auth0 client credentials)             |

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
echo "TOKEN=$TOKEN"
```

**Demo:** `Demo` / `StagingDemo` need `x-simulator: true` on every curl. Default demo account when `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset: `account-j3aZttuL`.

**Tenancy:** If `ACCOUNT_ID` unset — `GET https://api.bluexp.netapp.com/tenancy/account` (production) or `GET https://staging.api.bluexp.netapp.com/tenancy/account` (staging); use `accountPublicId`.

**Headers (WLMDB API):**

```
Authorization: Bearer ${TOKEN}
Content-Type: application/json   (POST/PATCH/DELETE with body)
x-simulator: true                (Demo / StagingDemo only)
```

**Headers (ONTAP proxy):**

```
Authorization: Bearer ${TOKEN}
x-endpoint: management.{fsxId}.fsx.{region}.amazonaws.com
x-simulator: true                (Demo / StagingDemo only)
```

## Required inputs

Ask only if not already provided. Never fabricate IDs.

| Input                     | Required when                   | Description                            |
| ------------------------- | ------------------------------- | -------------------------------------- |
| `region`                  | always                          | AWS region (e.g. `us-east-1`)          |
| `databaseHostId`          | host-scoped ops                 | From inventory — never guess           |
| `databaseInstanceId`      | instance-scoped ops             | From inventory or host detail          |
| `fsxId`, volume name/uuid | ONTAP snapshot / no-SSM runbook | From host `fsxnResourceInfo` or user   |
| `sandboxName`             | lifecycle                       | Max 27 chars, `[a-zA-Z_][a-zA-Z0-9_]*` |

Resolve `databaseHostId` and `databaseInstanceId` from `GET .../database-hosts` when the user gives a hostname only. See [references/inventory.md](references/inventory.md).

## Workflow router

Pick exactly one reference and follow it verbatim:

| User intent                                    | Reference                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| List / find MSSQL servers                      | [references/inventory.md](references/inventory.md)                 |
| ONTAP snapshot on FSx volume                   | [references/ontap-snapshot.md](references/ontap-snapshot.md)       |
| Create new user database                       | [references/create-database.md](references/create-database.md)     |
| Create sandbox / SQL clone                     | [references/clone-with-ssm.md](references/clone-with-ssm.md)       |
| Delete / refresh / re-baseline / split sandbox | [references/sandbox-lifecycle.md](references/sandbox-lifecycle.md) |
| Clone or ops without SSM                       | [references/clone-without-ssm.md](references/clone-without-ssm.md) — show ONTAP CLI + Standalone/FCI host/SQL; do not execute |

If ambiguous ("clone my database"), ask: **full sandbox via WLMDB (needs SSM)** vs **manual ONTAP steps (no SSM)**.

## Inventory-first rule

Before create DB, clone, lifecycle, or SSM checks:

1. Run [references/inventory.md](references/inventory.md) if host/instance IDs are unknown.
2. Read `ssmStatus` on the host (`Connected` / `NotConnected` / `N/A`).
3. Route by SSM availability (see below).

## SSM routing

| `ssmStatus`             | Action                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Connected`             | Use WLMDB APIs for create DB, sandbox, lifecycle                                                                                                       |
| `NotConnected` or `N/A` | **Do not** POST WLMDB create-db / sandboxes / lifecycle. **Do not** run ONTAP CLI or proxy. Show the user the numbered CLI in [references/clone-without-ssm.md](references/clone-without-ssm.md) (ONTAP + Standalone vs FCI host/SQL) |

For unmanaged hosts not in the managed list, use `GET .../discover` and check `ssmState` (`connected` / `notconnected`). See inventory reference.

**FCI:** For clustered create-db, both nodes should show SSM connected; inspect `clusterNodeDetails`.

## WLMDB API-first (when SSM connected)

Do **not** invoke AWS SSM Run Command or WF proxy directly for create-database, sandbox create, or lifecycle — the WLMDB server orchestrates SSM + ONTAP internally.

| Operation             | Method   | Path pattern                                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| Create database       | `POST`   | `.../database-hosts/{hostId}/database` → `202` + `jobId`                                         |
| Create sandbox        | `POST`   | `.../sandboxes` → `202` + `jobId`                                                                |
| Refresh / re-baseline | `PATCH`  | `.../sandboxes/{sandboxName}` body `{ "action": "REFRESH" \| "RE-BASELINE", "snapshot": "..." }` |
| Delete sandbox        | `DELETE` | `.../sandboxes/{sandboxName}` → `202` + `jobId`                                                  |
| Split sandbox         | `POST`   | `.../sandboxes/{sandboxName}/split` → `200` + `jobId`                                            |
| Poll job              | `GET`    | `.../jobs/{jobId}` until `COMPLETED` or `FAILED`                                                 |

Full curl examples: see the matching reference file.

## Destructive confirmation gate

Applies to mutating operations:

-   `POST .../database`, `POST .../sandboxes`
-   `PATCH .../sandboxes/{sandboxName}`, `DELETE .../sandboxes/{sandboxName}`
-   `POST .../sandboxes/{sandboxName}/split` (irreversible)
-   ONTAP proxy `POST` snapshot / FlexClone / LUN map

Before executing, state: operation, target host/database/sandbox, irreversibility (especially **split** and **delete**), and that storage/SQL state will change. **Stop until explicit user confirmation** (_"yes"_, _"go ahead"_, _"confirmed"_).

Phrases like _"create the sandbox"_ or _"delete it"_ are **requests**, not confirmation.

**No gate** for reads: list hosts, sandboxes, snapshots, split-estimate, connection-string, drive-information, collation.

## Job polling

After async WLMDB responses (`202` or split `200` with `jobId`):

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/wlmdb/v1/jobs/{jobId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

Poll until `status` is `COMPLETED` or `FAILED`.

For ONTAP proxy mutating POSTs, poll:

```bash
curl -sSk "${BASE_URL}/accounts/${ACCOUNT_ID}/proxy/v1/targets/${FSX_ID}/https/api/cluster/jobs/{uuid}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-endpoint: management.${FSX_ID}.fsx.${REGION}.amazonaws.com"
```

Until `state` is `success` or `failure`.

## Answer format

1. **Operation** — what was requested and which path (WLMDB API vs ONTAP manual runbook).
2. **Context** — host name, `databaseHostId`, `databaseInstanceId`, `ssmStatus`, region.
3. **Action taken** — reads performed, confirmation asked, `jobId` / ONTAP job UUID, terminal status. For no-SSM: inventory only, then numbered ONTAP CLI + host/SQL (not executed).
4. **Result or next steps** — connection string, or the full manual ONTAP CLI + host/SQL steps if no SSM.
5. **Demo note** — when `ENVIRONMENT` ∈ {`Demo`, `StagingDemo`}, state simulator was used.

## Refusal template

```
That request is outside what this skill covers — I handle MSSQL DB operator tasks (inventory, create database, sandbox clone, lifecycle, ONTAP snapshots, manual ONTAP runbooks without SSM), not registered drift assessment (databases-wad), TCO (wlm-db-tco), logs analysis, Oracle/PGSQL, or optimize/apply/fix flows.
```

## Additional reference

-   [references/inventory.md](references/inventory.md) — list managed hosts, discover unmanaged, resolve IDs
-   [references/ontap-snapshot.md](references/ontap-snapshot.md) — FSx volume snapshot via proxy
-   [references/create-database.md](references/create-database.md) — create DB via WLMDB API
-   [references/clone-with-ssm.md](references/clone-with-ssm.md) — sandbox clone via WLMDB API
-   [references/sandbox-lifecycle.md](references/sandbox-lifecycle.md) — delete, refresh, re-baseline, split
-   [references/clone-without-ssm.md](references/clone-without-ssm.md) — manual ONTAP CLI + Standalone/FCI host/SQL when SSM unavailable

## Evaluations

Regression prompts: [evals/evals.json](evals/evals.json). Grader: [agents/grader.md](agents/grader.md).
