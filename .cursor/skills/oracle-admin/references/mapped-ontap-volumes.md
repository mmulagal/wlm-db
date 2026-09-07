# Mapped ONTAP volumes (NFS, iSCSI, ASM)

Do not re-derive Oracle-to-ONTAP volume mapping from scratch — this repo already has a
working, protocol-generic implementation used by the continuous WAD/one-time-WAD flows. Reuse
it verbatim inside the `run-script` payload instead of writing new curl/ONTAP logic:

- `get_mapped_volumes` (and its helpers `make_ontap_config`, `ontap_request`, `find_svm_by_ip`,
  `get_nfs_volume_mapping`, `get_iscsi_volume_mapping`) in
  [`pythonOntapUtilities`](../../../../server/src/operations/workloads/oracle/oracle-ssm-script-utils.ts) —
  resolves NFS junction paths, iSCSI LUN serials, and ASM-managed disks to ONTAP volume/LUN
  identity.
- `parse_oratab` and `FILE_TYPES` in
  [`pythonOracleHelpers`](../../../../server/src/operations/continuous-optimization/oracle/ssm-scripts/one-time-wad/oracle-collectors.ts) —
  SID discovery and the six Oracle file-type categories
  (`REDO_LOGS`, `ARCHIVE_LOGS`, `CONTROL_FILES`, `TEMP_FILES`, `DATA_FILES`, `FRA`).

Run this **first**, before topology or any mutating script. Later `run-script` calls pass the
resolved names/LUN serials as `args` instead of re-parsing mount points.

## Included vs. excluded file types

Only `DATA_FILES`, `CONTROL_FILES`, `REDO_LOGS`, and `ARCHIVE_LOGS` volumes go into the
consistency group used by snapshot/clone:

- `ARCHIVE_LOGS` is included — without it, a clone/snapshot can only recover to the last
  online-redo checkpoint, not further back.
- `TEMP_FILES` is excluded — Oracle recreates tempfiles automatically on open; they carry no
  recoverable state.
- `FRA` (Fast Recovery Area) is excluded.
  <br>`ponytail:` this drops flashback-log continuity from the clone/snapshot. Ceiling: a
  clone opened with `OPEN RESETLOGS` cannot use `FLASHBACK DATABASE` to a pre-clone SCN.
  Upgrade path: add `FRA` to the file-type filter below and to the consistency group in
  [ontap-consistency-groups.md](ontap-consistency-groups.md) if an operator needs
  flashback-capable clones.

```python
INCLUDED_FILE_TYPES = ["DATA_FILES", "CONTROL_FILES", "REDO_LOGS", "ARCHIVE_LOGS"]
```

## When to ask the operator

Do not guess an FSx id, LUN serial, or ONTAP password. Prefer host-side discovery; ask only
on gaps:

| Envelope | Meaning | What to ask, then re-run this script |
|---|---|---|
| `status=need_input`, `need=filesystemId` | NFS/iSCSI source resolved to an IP or unrecognized DNS/target (no `fs-…` found) | `filesystemId` matching `^fs-[0-9a-f]{8,17}$` |
| `status=need_input`, `need=fsxCredentials` | `/netapp/wlmdb/<filesystemId>` is missing on the host | FSx ONTAP username **and** password (never echo them; pass as `FSX_USERNAME` / `FSX_PASSWORD` args for this call only) |

If the operator already supplied `filesystemId` / creds, put them in `args` on the first
attempt (`FILESYSTEM_ID`, optionally `FSX_USERNAME` + `FSX_PASSWORD`) so discovery does not
round-trip.

After a successful `volumes` envelope, follow the **volume confirmation** then **FSx
id/creds intermediary** gates in
[confirmation-and-results.md](confirmation-and-results.md) before any mutating POST.

## Driver script

Send `scriptId: "mapped-ontap-volumes"` (required `args`: `ORACLE_SID`; optional:
`FILESYSTEM_ID`, `FSX_USERNAME`, `FSX_PASSWORD`) non-mutating via
[`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh). The server loads
[`mapped_ontap_volumes.py`](../../../../server/resources/oracle/scripts/admin/mapped_ontap_volumes.py)
as-is — it already inlines the equivalent of `pythonOntapUtilities` / `pythonOracleHelpers`
(oratab parsing, NFS/iSCSI/ASM mount discovery, CDB/PDB detection, and the ONTAP REST calls)
as real, standalone Python; do not rewrite this from the TS template-literal strings inline.
If you do need to touch its ONTAP/Oracle helper functions, keep them in sync with the copies
in
[`consistency_group_snapshot.py`](../../../../server/resources/oracle/scripts/admin/consistency_group_snapshot.py)
and
[`flexclone_create.py`](../../../../server/resources/oracle/scripts/admin/flexclone_create.py)
— the request/config plumbing is intentionally duplicated (these run standalone on the host,
independent of the server's TS sources), not imported.

Validate with `validate_operation_result.sh <file> volumes` only when `status == "ok"`. If
`status == "need_input"`, ask the operator (table above) and re-run — do not treat it as a
hard failure.

Then put these into `args` for every later `run-script` call: `SVM_NAME`, `PROTOCOL`,
`FILESYSTEM_ID`, and the per-file-type volume/LUN names from `volumesByFileType`. Never print
`fsx_username` / `fsx_password` / `FSX_PASSWORD` / any ONTAP `Authorization` header.
