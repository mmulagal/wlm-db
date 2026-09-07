# ONTAP consistency groups for crash-consistent Oracle snapshots

A single-instance Oracle database spreads `DATA_FILES`, `CONTROL_FILES`, `REDO_LOGS`, and
`ARCHIVE_LOGS` across one or more FSx for ONTAP volumes (NFS) or LUNs (iSCSI/ASM) — see
[mapped-ontap-volumes.md](mapped-ontap-volumes.md). A snapshot of only some of them is not a
valid recovery point. Use an ONTAP **application consistency group** so every included
volume is captured with one write-fenced, crash-consistent snapshot — no RMAN
`BEGIN BACKUP`/`END BACKUP` or any other quiescing is needed or performed.

Volume/LUN names and the SVM/filesystem identity **must** come from the
[mapped-ontap-volumes.md](mapped-ontap-volumes.md) envelope, passed as `args`
(`SVM_NAME`, `PROTOCOL`, `FILESYSTEM_ID`, `REGION`, plus the per-file-type volume list). Do
not parse an NFS export path or iSCSI target IQN to guess a volume name.

All calls below run **inside the `run-script` remote script** on the source host, resolving
ONTAP credentials from `/netapp/wlmdb/<filesystemId>` (or operator-supplied
`FSX_USERNAME`/`FSX_PASSWORD`) exactly like [mapped-ontap-volumes.md](mapped-ontap-volumes.md)
does. Never resolve or print these credentials from the operator machine.

## Step 1–2: find-or-create the consistency group, then snapshot

Send `scriptId: "consistency-group-snapshot"` — do not re-derive the ONTAP calls inline. The
server loads
[`consistency_group_snapshot.py`](../../../../server/resources/oracle/scripts/admin/consistency_group_snapshot.py),
which find-or-creates the consistency group over `VOLUME_NAMES` (adopting existing volumes
only, never creating new ones) and takes the crash-consistent group snapshot in one mutating
call, gated by the "create consistency group"/"create snapshot" confirmations in
[confirmation-and-results.md](confirmation-and-results.md). Required `args`: `ORACLE_SID`,
`FILESYSTEM_ID`, `SVM_NAME`, `RETENTION_LABEL`, `VOLUME_NAMES` (comma-separated),
`VOLUME_FILE_TYPES_JSON` (JSON map of volume name → file-type role, or an array of roles if
one physical volume backs more than one role), `CG_NAME`. Optional: `FSX_USERNAME`,
`FSX_PASSWORD`. Send it mutating via
[`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh).

Reuse an existing consistency group **only** when its `volumes[].name` set is exactly the
resolved `VOLUME_NAMES` set — never adopt a group with unrelated members, and never silently
rename/replace one. `consistency_type: "crash"` is explicit in the script even though it is
ONTAP's default — never change it to `"application"` (that implies RMAN or another quiescing
step this skill does not perform). The snapshot-detail fetch uses `fields=**` — without it
ONTAP omits `snapshot_volumes` and `memberSnapshots` comes back empty even though the
snapshot itself succeeded.

## Step 3: create FlexClone volumes from the member snapshots (clone skill only)

For each entry in `memberSnapshots`, send `scriptId: "flexclone-create"` using that entry's
own `snapshotName` — this is what keeps every file type's clone at the exact same atomic
point captured by the group snapshot. The server loads
[`flexclone_create.py`](../../../../server/resources/oracle/scripts/admin/flexclone_create.py).
Required `args` per invocation: `FILESYSTEM_ID`, `SVM_NAME`, `CLONE_NAME`, `PARENT_VOLUME`
(= `memberSnapshots[i].volumeName`), `PARENT_SNAPSHOT` (= `memberSnapshots[i].snapshotName`).
Optional: `FSX_USERNAME`, `FSX_PASSWORD`. Mutating; gated by the "create FlexClone volumes"
confirmation.

Run it once per `memberSnapshots` entry (data, control, redo, and archive volumes) — never
omit one, and never clone a data-file volume from one snapshot while cloning a redo-log
volume from a different one. What happens to the resulting clone volumes next depends on
protocol (NFS mount, iSCSI igroup/LUN mapping, or — for ASM — that same igroup/LUN mapping
followed by a diskgroup rename+mount) — see
[clone-recovery.md](clone-recovery.md).

## Validation

Always confirm `status == "ok"` and the expected fields are present via
`../scripts/validate_operation_result.sh <file> snapshot` (or `clone`) before reporting
success to the user. An `error` field anywhere in the envelope means the operation failed,
even if an HTTP 200 was returned by ONTAP for an earlier sub-step.
