---
name: pgsql-admin
description: >
  PostgreSQL admin on FSx for ONTAP via the hidden wlmdb
  POST .../pgsql/.../run-script endpoint: CREATE DATABASE, and full FlexClone
  recovery onto a target EC2 host as a separate instance with its own service
  unit and port — including onto a host that already runs PostgreSQL. Standalone
  hosts and streaming-replication HA (operations run on the primary). Use when
  the user asks to create a database, or clone/copy a PostgreSQL EC2 instance,
  including HA/replica/standby/primary. Do not trigger for MSSQL/Oracle (see
  databases-wad), TCO/Explore Savings, snapshot-only backup (no clone), snapshot
  deletion, or logical pg_dump copies.
  metadata:
  author: wlm-db
  version: 1.0.0
---

# PostgreSQL admin

Create a database or clone a PostgreSQL host on FSx for ONTAP. Standalone and
streaming-replication HA are in scope: mutating work always runs on the **resolved
primary**. Every remote command goes through wlmdb `POST .../pgsql/.../run-script` — never
`aws ssm send-command` from the operator machine. Send only a named `scriptId` plus `args`;
never author, concatenate, or upload shell.

A clone never adopts the destination's `postgresql.service`; it creates and starts its own
unit, so a host already running PostgreSQL is a valid destination.

**Out of scope:** cloning *from* a standby, building a new standby, pgpool registration;
MSSQL/Oracle (use `databases-wad`); TCO / Explore Savings (`wlm-db-tco`); a snapshot-only
backup (no clone product — `cg-snapshot` is clone infrastructure only); deleting/expiring
snapshots; logical (`pg_dump` / `pg_basebackup`) copies; table/schema/role creation inside
an existing database.

Read [references/confirmation-and-results.md](references/confirmation-and-results.md) first.
It is the shared contract for both flows — auth, identity (inventory `databaseHostId` vs
unregistered `ec2InstanceId`), the `inspect` probe, primary resolution and HA targeting
(bare primary `instanceId`, or `databaseHostId` plus that matching `ec2InstanceId`), volume
confirmation and the FSx id/creds intermediary, result envelopes, and failure handling.
The flow files do not repeat it.

## Routing

1. **Create a database** (`createdb`, optional owner) →
   [references/database.md](references/database.md)
2. **Clone / running copy** (fresh `cg-snapshot` + FlexClone + mount/start as its own
   `postgresql-<cloneName>.service` on another host, or alongside an existing cluster) →
   [references/clone.md](references/clone.md)
3. Ambiguous ("do something with postgres") → ask which of create-database or clone before
   any mutating call.

Once routed, **follow that reference verbatim**. Loop is always **inspect → interpret the
envelope → confirm → named mutating `scriptId`**. Reference markdown is the agent contract
(args, confirms, refusals). Host how-to lives in
`server/resources/pgsql/scripts/admin/<scriptId>.sh` — read those to understand behaviour;
never copy their steps into an authored script. When SSM cannot reach the host, hand over to
[references/ssm-unavailable.md](references/ssm-unavailable.md).

## Allowlisted `scriptId`s

| `scriptId` | Does |
|---|---|
| `inspect` | Read-only probe: topology + volumes + createdb preflight + clone target checks |
| `createdb` | CREATE DATABASE + catalog / LSN verify |
| `cg-snapshot` | Clone infrastructure: find-or-create CG + crash-consistent group snapshot |
| `cg-flexclone` | FlexClone data + WAL from member snapshots |
| `clone-recovery` | Mount, sanitize, start `postgresql-<cloneName>.service` |

## Local helpers

| Script | Purpose |
|---|---|
| [scripts/run_ssm_operation.sh](scripts/run_ssm_operation.sh) | Dry-run or POST run-script (`scriptId` + `args`) |
| [scripts/validate_operation_result.sh](scripts/validate_operation_result.sh) | Validate result envelopes |
| [scripts/selfcheck.sh](scripts/selfcheck.sh) | Assert envelope rules and `bash -n` on `scripts/*.sh` |
