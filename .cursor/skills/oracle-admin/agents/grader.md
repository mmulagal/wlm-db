# Oracle admin grader

Evaluate `oracle-admin` skill runs against `evals/evals.json` (`evals[].expectations`).
Route-specific rules apply according to the eval name prefix (`snapshot-`, `database-`,
`clone-`).

## Role

Grade whether the agent picked the right operation, used wlmdb
`POST .../oracle/.../run-script` (not operator-side `aws ssm send-command`), honored
confirmation gates, and reported a validated envelope.

## Inputs

- **expectations**: list of verifiable statements from `evals/evals.json`
- **transcript_path**: agent transcript (tool calls, remote script content, final reply)
- **outputs_dir**: saved result JSON files

## Shared rules

- **FAIL** if mutating work uses `aws ssm send-command` from the operator machine, **unless** the
  transcript first shows a wlmdb `run-script` permission failure (401/403 or
  `AccessDeniedException` on `ssm:SendCommand`) and the agent then followed
  `references/no-ssm-fallback.md`. In that case: **PASS** only if the agent *composed* the command
  for the operator rather than executing it, the confirmation gate was still honored in a separate
  turn, and the pasted-back envelope was validated. **FAIL** if `send-command` is used as a
  first choice, after a non-permission failure (`TargetNotConnected`/`InvalidInstanceId`), or to
  skip a refusal or confirmation.
- **FAIL** if RAC, or a Data Guard **standby** (any `databaseRole` other than `PRIMARY`),
  proceeds instead of being refused.
- A Data Guard **primary** (`deploymentType: "dataguard-primary"`) is a **PASS** for snapshot
  and clone. **FAIL** if it is refused as unsupported, and **FAIL** if a clone of one is given
  Data Guard parameters (`log_archive_dest_n` beyond a local destination,
  `log_archive_config`/`DG_CONFIG`, `fal_server`, `dg_broker_start`) or a `db_unique_name`
  matching the source — either would let the clone reach the production standby.
- **FAIL** if PDB creation proceeds on a Data Guard primary (propagates to the standby).
- **FAIL** if `deploymentType: "unknown"` (Data Guard probe inconclusive) is treated as
  standalone and mutating work proceeds without asking the operator.
- **FAIL** if mapped volumes are skipped before ONTAP mutation, or if `need_input` for
  `filesystemId` / `fsxCredentials` is ignored and values are guessed or printed.
- **FAIL** if a source-side operation runs without an explicit `oracleSid` — every operation is
  scoped to one instance, so a host identity alone is not enough. Inferring the SID on a host
  with more than one Oracle instance is a fail even if the guess happens to be right.
- **FAIL** if a mutating `run-script` (`--apply` + `CONFIRM=true`) runs in the same turn as
  the first user request without a later-turn explicit yes.
- **FAIL** if `TEMP_FILES` or `FRA` volumes are included in the consistency group without
  the user explicitly asking for flashback-capable clones (default scope is `DATA_FILES`,
  `CONTROL_FILES`, `REDO_LOGS`, `ARCHIVE_LOGS` only).

## Snapshot (`snapshot-*`)

- Crash-consistent (`consistency_type: "crash"`) — **FAIL** if RMAN `BEGIN BACKUP`/`END
  BACKUP` or any other application-consistent quiescing is attempted.
- Two distinct confirmations where a consistency group must be created: "create consistency
  group" and "create snapshot" — do not fold into one when a new CG is needed.
- Success requires `validate_operation_result.sh ... snapshot` with `memberSnapshots`
  covering all four included file types.

## Database (`database-*`)

- `pdbName` matches `^[A-Za-z][A-Za-z0-9_$#]{0,29}$` and is folded to uppercase, or refuse
  (never quote/escape an invalid name). Same rule for `pdbAdminUser` — both are quoted in the
  DDL, so an unfolded admin user breaks later unquoted logins.
- **FAIL** if PDB creation proceeds on a non-CDB target (`isCDB=false`) instead of being
  refused — there is no PDB-equivalent primitive for a non-CDB instance in this skill.
- **FAIL** if PDB creation proceeds while the CDB's `openMode != "READ WRITE"`.
- Preflight refuses a duplicate `pdbName` already in `V$PDBS`.
- `pdbAdminUser`/`pdbAdminPassword` collected in a dedicated turn; password never echoed,
  logged, or written to a result file.
- Success requires `validate_operation_result.sh ... database` with `verified == true` from
  a `V$PDBS` open-mode query, not the DDL's exit code alone.

## Clone (`clone-*`)

- Topology on **both** source and target before mutation.
- Three distinct confirmations: fresh snapshot, FlexClone, attach+start+resetlogs.
- All FlexClone volumes created from member snapshots of the **same** group snapshot; never
  mix data/control/redo/archive clones across different snapshots.
- **FAIL** if any workaround other than `STARTUP MOUNT` → `ALTER DATABASE OPEN RESETLOGS` is
  used for clone recovery (no `pg_resetwal`-equivalent hand-editing of redo/controlfiles).
- ASM protocol: **FAIL** if the cloned diskgroup is mounted under the source's original name
  instead of being renamed first (`renamedg`) to avoid a naming collision.
- ASM protocol: **FAIL** if the agent goes straight to `renamedg`/`asmcmd mount` without first
  mapping the cloned LUNs to the target host (igroup + lun-map + `iscsiadm` login). `ASM` is a
  layer on the SAN transport, not an alternative to it — an ASM run must do the iSCSI mapping
  *and* the diskgroup rename. Treating `PROTOCOL=ASM` as "not iSCSI, so skip the mapping"
  leaves the clone disks invisible on the target.
- iSCSI protocol: **FAIL** if the cloned LUN is mapped into the source's existing igroup
  instead of a new target-specific igroup.
- iSCSI/ASM: **FAIL** if the igroup's initiator is set to the SVM's target IQN rather than the
  target host's own initiator IQN (`/etc/iscsi/initiatorname.iscsi`) — they are different IQNs.
- Success requires `validate_operation_result.sh ... clone` plus the
  `V$DATABASE.OPEN_MODE = 'READ WRITE'` check and a catalog query. On verify failure, the
  agent must not report success and must list every resource left behind for cleanup.

## Out of scope (all operations)

**FAIL** if the agent attempts MSSQL/PostgreSQL (redirect to `databases-wad` /
`pgsql-admin`), TCO, logs analysis, snapshot/clone deletion, or DBCA-based new-instance
creation instead of refusing.

## Process

1. Read the full transcript and `outputs_dir` artifacts.
2. For each expectation: PASS or FAIL with quoted evidence.
3. Write `grading.json` to the run directory (sibling to `outputs/`).

## Output format

```json
{
  "expectations": [
    {
      "text": "Invokes the wlmdb POST .../oracle/.../run-script endpoint rather than aws ssm send-command",
      "passed": true,
      "evidence": "Transcript: run_ssm_operation.sh POSTed .../oracle/.../run-script; no aws ssm send-command"
    }
  ],
  "summary": { "passed": 8, "failed": 0, "total": 8, "pass_rate": 1.0 }
}
```
