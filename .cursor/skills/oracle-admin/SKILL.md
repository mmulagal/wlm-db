---
name: oracle-admin
description: >
  Standalone or single-instance Oracle admin on FSx for ONTAP via the hidden wlmdb
  POST .../oracle/.../run-script endpoint: volume-level crash-consistent snapshot,
  create a Pluggable Database (PDB) from PDB$SEED inside a running CDB, and full
  FlexClone recovery onto a target EC2 host — across NFS, iSCSI, and ASM-managed
  storage. Use when the user asks to snapshot, clone/copy, or create a database on
  an Oracle EC2 instance, including snapshotting or cloning a Data Guard primary.
  Do not trigger for RAC or Data Guard standby Oracle,
  MSSQL/PostgreSQL (see databases-wad or pgsql-admin), TCO/Explore Savings, logs
  analysis, snapshot/clone deletion, DBCA-based whole-instance provisioning, or
  RMAN/application-consistent backups.
metadata:
  author: wlm-db
  version: 1.0.0
---

# Oracle admin (snapshot / create-PDB / create-clone)

Take a volume-level crash-consistent snapshot, create a Pluggable Database, or clone a
**single-instance** Oracle host (CDB or non-CDB) on FSx for ONTAP. Every remote command goes
through wlmdb `POST .../oracle/.../run-script` — never `aws ssm send-command` from the
operator machine.

**Out of scope:** RAC and Data Guard **standby** Oracle (use `databases-wad` for read-only drift
assessment of those) — a Data Guard **primary** is supported for snapshot and clone, but not for
PDB creation, see [references/topology.md](references/topology.md);
MSSQL/PostgreSQL (`databases-wad` / `pgsql-admin`); TCO / Explore
Savings (`wlm-db-tco`); logs analysis (`fetch-logs-analysis-results`); deleting/expiring
snapshots or clones; RMAN `BEGIN BACKUP` / any application-consistent quiescing; DBCA-based
creation of a brand-new Oracle instance (only PDB-from-seed creation inside an already
running CDB is supported); non-CDB "create database" (there is no PDB-equivalent primitive
for a non-CDB instance).

Read [references/confirmation-and-results.md](references/confirmation-and-results.md) first
for auth, identity (registered `databaseHostId` vs unregistered `ec2InstanceId`), protocol
detection, volume confirmation, the FSx id/creds intermediary, and result envelopes.

## Routing

1. **Create a snapshot** (volume-level, crash-consistent, no RMAN quiescing) →
   [references/snapshot.md](references/snapshot.md)
2. **Create a Pluggable Database** (`CREATE PLUGGABLE DATABASE ... FROM PDB$SEED` inside an
   existing running CDB) → [references/database.md](references/database.md)
3. **Clone / running copy on another host** (fresh snapshot + FlexClone + mount/recover) →
   [references/clone.md](references/clone.md)
4. Ambiguous ("do something with this oracle box") → ask which of snapshot, create-PDB, or
   clone before any mutating call.

Once routed, **follow that reference verbatim**. Shared discovery lives in:

| Resource | Purpose |
|---|---|
| [references/mapped-ontap-volumes.md](references/mapped-ontap-volumes.md) | Resolve per-file-type ONTAP volumes across NFS/iSCSI/ASM (ask FSx id/creds on `need_input`) |
| [references/topology.md](references/topology.md) | SID/CDB/PDB/protocol discovery; RAC/Data Guard-standby refusal rules and what makes a Data Guard primary safe to clone |
| [references/ontap-consistency-groups.md](references/ontap-consistency-groups.md) | Consistency group, crash-consistent snapshot, FlexClone creation |
| [references/clone-recovery.md](references/clone-recovery.md) | Target-host mount/attach (per protocol), controlfile fix-up, `OPEN RESETLOGS`, verification |
| [references/no-ssm-fallback.md](references/no-ssm-fallback.md) | When `run-script` is refused for lack of SSM permission: hand the operator the equivalent `aws ssm send-command` and validate what they paste back |
| [scripts/run_ssm_operation.sh](scripts/run_ssm_operation.sh) | Dry-run or POST run-script with a `scriptId` + `args` payload |
| [scripts/validate_operation_result.sh](scripts/validate_operation_result.sh) | Validate result envelopes |
| [`server/resources/oracle/scripts/admin/`](../../../server/resources/oracle/scripts/admin/) | The allowlisted scripts each `scriptId` loads server-side — see below |

**Do not send `command`/`commandFile`/`scriptBase64` to `run-script` anymore.** Every
mutating or discovery call sends `scriptId` + `args` via `run_ssm_operation.sh`; the wlmdb
server loads the matching file from
[`server/resources/oracle/scripts/admin/`](../../../server/resources/oracle/scripts/admin/)
(allowlisted by
[`oracle-admin-scripts.ts`](../../../server/src/operations/workloads/oracle/oracle-admin-scripts.ts)),
validates `args` against that script's required/optional list, and executes it — the client
never ships script text. Each reference doc below names the `scriptId` to send and the
`args` it needs; it does not embed the script body (nested-heredoc/shebang portability under
SSM's shell, `V$PDBS.NAME` not `PDB_NAME`, ONTAP `fields=**`/query-string quirks, and Python
warnings-to-stderr corrupting the JSON envelope are all fixed in the server-side files, not
just described in the docs). Only fall back to
[no-ssm-fallback.md](references/no-ssm-fallback.md) for something `run-script` cannot do
(SSM permission failure) — never invent a new inline script for a `scriptId` that does not
exist yet; add it to `server/resources/oracle/scripts/admin/` and
`oracle-admin-scripts.ts` first. Run
[`server/resources/oracle/scripts/admin/test_syntax.sh`](../../../server/resources/oracle/scripts/admin/test_syntax.sh)
after editing anything in that directory.
