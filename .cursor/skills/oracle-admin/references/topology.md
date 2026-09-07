# Oracle topology discovery

Run after [mapped-ontap-volumes.md](mapped-ontap-volumes.md). Confirms the target `oracleSid`
is a **single-instance** database (no RAC, no Data Guard standby) using the
**already-resolved** volume/LUN identity as `args` — do not re-parse mount points here.
Refuse (do not proceed to snapshot/clone/PDB creation) on any unsupported result.

Required `args` from the volumes envelope: `SVM_NAME`, `PROTOCOL`, `FILESYSTEM_ID` (plus
`REGION`, injected by `run_ssm_operation.sh`).

## Remote script

Send `scriptId: "topology-check"` (required `args`: `ORACLE_SID`; optional: `PROTOCOL`,
`SVM_NAME`, `FILESYSTEM_ID`) via
[`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh) as a **non-mutating**
command against the source (`instanceId` or `databaseHostId`), or `targetInstanceId` when
checking a clone destination (see "Clone-specific target checks" below). The server loads
[`topology_check.sh`](../../../../server/resources/oracle/scripts/admin/topology_check.sh)
as-is — do not re-derive it from `oracle-ssm-script-utils.ts` inline. That file already
handles the SSM heredoc/shebang portability issue (see its header comment) that an inline
`<<EOF` nested in `$(...)` hits under `sh`/`dash`.

## Data Guard

A Data Guard **primary** is a supported **snapshot and clone** source. The script reports it as
`status: "ok"` with `deploymentType: "dataguard-primary"`, `dataGuardConfigured: true`, and
`standbyDestCount`. A **standby** (any `databaseRole` other than `PRIMARY`) is still refused
outright, and PDB creation is still refused on a Data Guard primary — see below.

Cloning a Data Guard primary is safe because the clone never inherits the source's redo
transport: [`clone_bootstrap_pfile.sh`](../../../../server/resources/oracle/scripts/admin/clone_bootstrap_pfile.sh)
generates a **fresh minimal pfile** rather than copying the source spfile, so
`log_archive_dest_n`, `log_archive_config`/`DG_CONFIG`, `fal_server`, and `dg_broker_start` are
absent by construction, and `db_unique_name` is set to `cloneSid` — which is what Data Guard
identifies a member by. The cloned controlfile still carries Data Guard metadata (standby redo
logs), but that is inert with no Data Guard parameters set. **Never add Data Guard parameters to
a clone's pfile**: a clone that joins the configuration can ship redo to the production standby.

`dataGuardConfigured: null` with `deploymentType: "unknown"` means the probe could not answer —
**not** that Data Guard is absent. Ask the operator rather than assuming standalone.

Cross-checking [`getDataguardDetailsForAllInstances`](../../../../server/src/operations/workloads/oracle/oracle-operations.ts)
is still useful for naming the standby in the confirmation, but a positive association no longer
refuses a snapshot or clone on its own.

## Refusal rules

Stop and report — do not proceed to any mutating stage — when the `topology` envelope has:

- `status != "ok"` (read `reason` and relay it verbatim to the user).
- `deploymentType` is `"rac"` or `"dataguard-standby"`.
- `deploymentType` is `"unknown"` and the operator has not confirmed the Data Guard state.
- PDB creation requested but `deploymentType != "standalone"` — a Data Guard primary is refused
  for PDB creation even though it is allowed for snapshot/clone, because
  `CREATE PLUGGABLE DATABASE` propagates to the standby, which must materialize the new
  datafiles or fall out of recovery.
- PDB creation requested but `isCDB != true` (see [database.md](database.md)).
- PDB creation requested but `openMode` is not `READ WRITE` (a mounted-but-not-open CDB
  cannot accept `CREATE PLUGGABLE DATABASE`).

## Clone-specific target checks

When validating a clone destination (`targetInstanceId`), do **not** require mapped ONTAP
volumes — the target may not host Oracle yet. Send two scriptIds against the target instead
of `topology-check`:

- `scriptId: "clone-target-preflight"` (required `args`: `CLONE_SID`, `CLONE_PORT`) —
  refuse if `sidConflict=true` (an `ORACLE_SID` in `/etc/oratab` already matches the planned
  `cloneSid`; never mount a clone over an active `ORACLE_HOME`/datafile path) or
  `portInUse=true`.
- `scriptId: "oracle-version-check"` (required `args`: `ORACLE_SID` — the source's own SID
  on the source host, and any already-running SID on the target host) — run against **both**
  hosts, then compare `versionBanner` yourself. Refuse on any major-version mismatch rather
  than attempting a cross-version recovery.
