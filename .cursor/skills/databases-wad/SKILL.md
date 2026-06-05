---
name: databases-wad
description: Master skill for NetApp Workload Factory registered (continuous) drift assessment for managed databases. Routes to the engine-specific reference for MSSQL (SQL Server) or Oracle - account, host, and instance-level findings, on-demand re-assessment, patch scans, and dismissal of findings. Use when the user asks about registered / drift assessment, "what does Workload Factory say about this database?", on-demand re-assessment, patch scans, or dismissing findings, with or without specifying the engine. Does not cover offline / one-time WAD upload flows or any optimize / apply / remediate / fix flows.
---

# Workload Factory Registered Assessment

## Why this skill exists

Workload Factory continuously evaluates managed database hosts and instances against a NetApp golden configuration and stores a drift result per instance. This skill teaches you to read those results, trigger on-demand re-assessments, run patch scans, and dismiss findings via REST.

Supported engines: **MSSQL** (SQL Server) and **Oracle**. Each engine has its own URL segment, set of dimensions, and response shape — all detail lives in `references/`.

## When the user asks for something this skill doesn't do

This skill is **only** for registered (continuous) drift assessment. It does not cover:

- Offline / one-time WAD upload flow (`/offline-assessment/...`).
- Apply / remediate / "fix now" / optimize flows (`*-optimize`, `optimize/storage-configuration`, `optimize/storage-layout`, `database-hosts/optimize`).

If the user asks for those, say so and offer the drift-assessment capability instead.

## API common ground

**Base URL** — confirm environment with user before calling production:

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.workloads.netapp.com` |
| Staging | `https://staging.api.workloads.netapp.com` |

Every request path is relative to: `{base}/accounts/{accountId}/wlmdb/v1`

**Required headers on every call:**
```
Authorization: Bearer <access_token>
Content-Type: application/json   (POST only)
```

**Bearer token and `accountId`:** obtain from the parent **netapp-workload-factory** skill.

**Job polling** (after any trigger): `GET {base}/accounts/{accountId}/wlmdb/v1/jobs/{jobId}`
Terminal `status` values: `COMPLETED`, `FAILED`.

## Routing rules — pick an engine

1. **Explicit engine in the request** — "SQL Server", "MSSQL", "AOAG", "FCI", "MAXDOP" → MSSQL. "Oracle", "ASM", "RAC", "PDB", "CDB", "redo log", "SnapCenter" → Oracle. Load the matching reference and follow it.
2. **Identifier hints** — instance name `MSSQLSERVER` → MSSQL; Oracle SID / service name → Oracle.
3. **Cross-engine question** ("show me all drifted databases", "summarize the account") → run both engines' account-scope reads and merge results, labeled by engine.
4. **Ambiguous, no signal** → ask the user which engine before making any call.

Once an engine is picked, **read the corresponding reference file and follow it verbatim** — it owns all endpoint paths, dimension names, response shapes, and examples.

## Reference files

- **[`references/mssql.md`](references/mssql.md)** — MSSQL endpoints, dimensions (`storage`, `compute`, `license`, `host-os-patch`, `mssql-patch`, `rss-config`, `maxdop`, `mapped-ontap-volumes`, `clone`, `snapshot-policy`, `aws-backup`, `crr`, `high-availability`, `mtu-alignment`), response shapes, read / trigger / dismiss workflows, curl examples.
- **[`references/oracle.md`](references/oracle.md)** — Oracle endpoints, dimensions (`storage`, `compute`, `host-os-patch`, `oracle-security-patch`, `aws-backup`, `crr`, `snapcenter-snapshot`, `clone`, `mapped-ontap-volumes`), response shapes (including compound `storage` object and security-patch extras), read / trigger / dismiss workflows, curl examples.

## Workflow

1. **Identify engine** — apply routing rules above.
2. **Identify intent** — read, patch scan, trigger, or dismiss? If trigger or dismiss, go to step 4 first.
3. **Collect inputs** — `accountId`, `credentialsId`, `region`, `databaseHostId`, `databaseInstanceId` (where needed). If any are missing, ask; do not fabricate IDs.
4. **Mutating calls (trigger / dismiss) — confirm first** — state the engine, host, instance, and exactly what will be overwritten. Wait for explicit user confirmation before sending.
5. **Read the engine reference** and build the call per the endpoint table and examples there.
6. **Present results** — for drift reads, lead with not-optimized / severity counts; surface `recommendation` for each failing dimension. For triggers, poll until terminal state then re-fetch and present the new findings.

## Cross-engine account summary

When a single answer must cover both engines for the same `accountId` / `region`, call both account-scope GETs and merge:

```bash
# MSSQL
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
  | jq '{ engine: "mssql", count, rows: .assessmentsPerAccount }'

# Oracle
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
  | jq '{ engine: "oracle", count, rows: .assessmentsPerAccount }'
```

The per-host wrapper shape (`databaseHostId`, `databaseHostName`, `instancesAssessment[]`) is identical across engines; the per-instance `assessments` object differs — inspect engine by engine.

## Refusal template

```
That request is outside what this skill covers - I only handle registered (continuous) drift assessment for MSSQL and Oracle, not optimize/apply/fix actions and not the offline one-time WAD upload flow. You can run those from the Workload Factory UI or via the corresponding skill.
```
