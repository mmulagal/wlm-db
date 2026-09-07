# Clone recovery: attach, fix up, and open the clone

Runs on `targetInstanceId` after the FlexClone volumes from
[ontap-consistency-groups.md](ontap-consistency-groups.md) exist. All steps below are mutating
— only run them after the confirmations in
[confirmation-and-results.md](confirmation-and-results.md).

`PROTOCOL` from the mapped-volumes envelope selects the attach path, but it is **not** three
mutually exclusive transports. `ASM` is a volume manager layered *on top of* the SAN
transport, not an alternative to it: on FSx for ONTAP an ASM disk **is** a LUN, which is why
`mapped_ontap_volumes.py` resolves ASM disks through `V$ASM_DISK` + `udevadm` iSCSI serials
and falls back to `protocol: "iSCSI"` per mount. Since `ASM` outranks the transport beneath it
in the envelope, read `PROTOCOL=ASM` as "**iSCSI plus a diskgroup rename**", never as "not
iSCSI". Skipping the LUN mapping leaves the clone disks invisible on the target host, and
`renamedg`/`asmcmd mount` then fail with no disks to operate on.

| `PROTOCOL` | Run |
| --- | --- |
| `NFS` | step 1a only |
| `iSCSI` | step 1b only |
| `ASM` | step 1b, **then** step 1c |

## 1a. Attach the cloned volumes — NFS

Send `scriptId: "clone-attach-nfs"` — the server loads
[`clone_attach_nfs.sh`](../../../../server/resources/oracle/scripts/admin/clone_attach_nfs.sh),
which mounts every cloned volume at a fresh mount point under `/oradata/clone_<CLONE_SID>/`,
never the source's original mount path even when source and target are the same host.
Required `args`: `CLONE_SID`, `SVM_DATA_LIF`, `CLONE_VOLUMES_JSON` (JSON array of
`{"fileType":..., "cloneVolumeName":...}`, one entry per `memberSnapshots` role from step 3
of [ontap-consistency-groups.md](ontap-consistency-groups.md)). Mutating.

## 1b. Map the cloned LUNs to the target host — iSCSI **and** ASM

Required for `PROTOCOL=iSCSI` *and* `PROTOCOL=ASM`. Until this runs, the cloned LUNs are not
mapped to `targetInstanceId` and the target sees no clone disks at all.

The FlexClone volume carries the source LUN's serial and any existing igroup mapping — map
it under a **new** LUN path/igroup on the target so it does not collide with the source:

```bash
# ONTAP REST, from inside the remote script — never the server-side ontap-gateway.ts proxy
# (this skill runs everything from the host, matching the consistency-group calls' pattern).
# host_initiator_iqn: the TARGET HOST's own initiator, from /etc/iscsi/initiatorname.iscsi.
# svm_target_iqn: the SVM's iSCSI target name, from GET protocols/san/iscsi/services.
# These are two different IQNs — do not reuse one variable for both.
host_initiator_iqn=$(sed -n 's/^InitiatorName=//p' /etc/iscsi/initiatorname.iscsi)

igroup_body=$(jq -n --arg name "${targetinstanceid}-clone-${clonesid}" --arg svm "$svmname" --arg initiator "$host_initiator_iqn" \
    '{name:$name,svm:{name:$svm},protocol:"iscsi",os_type:"linux",initiators:[{name:$initiator}]}')
ontap_request POST "protocols/san/igroups?return_records=true" "$igroup_body"

# One lun-map call per cloned LUN — every file type in the clone needs mapping, not just the
# first. Map each clone_lun_path from the FlexClone output into the new igroup.
lun_map_body=$(jq -n --arg lunpath "$clone_lun_path" --arg igroup "${targetinstanceid}-clone-${clonesid}" \
    '{lun:{name:$lunpath},igroup:{name:$igroup}}')
ontap_request POST "protocols/san/lun-maps?return_records=true" "$lun_map_body"

iscsiadm -m discovery -t sendtargets -p "${svm_iscsi_lif}:3260"
iscsiadm -m node -T "$svm_target_iqn" -p "${svm_iscsi_lif}:3260" --login
# Discover the new /dev/mapper/<wwid> via multipath -ll before mounting/importing into ASM.
```

Confirm the target actually sees one new device per cloned LUN (`multipath -ll`, or match the
LUN serials from the mapped-volumes envelope) before continuing. For `PROTOCOL=iSCSI` mount the
new devices at fresh paths under `/oradata/clone_<CLONE_SID>/`, following the same
never-reuse-the-source's-path rule as 1a. For `PROTOCOL=ASM`, continue to 1c.

## 1c. Rename and mount the cloned diskgroup — ASM only

Runs **after** 1b: `renamedg` and `asmcmd` can only act on disks the host can already see.

A FlexClone of an ASM-managed volume retains the source diskgroup's on-disk header — the
clone will collide with the source diskgroup name (including on the source host itself, if
`targetInstanceId == sourceInstanceId`). Make ASM discover the newly mapped disks, then rename
before mounting:

```bash
# Make the ASM layer see the LUNs mapped in 1b — one tool or the other, never both. Same
# AFD-before-ASMLib detection mapped_ontap_volumes.py's detect_asm_tool() does via `lsmod`.
if lsmod | grep -q oracleafd; then
    sudo -i -u grid asmcmd afd_scan       # AFD: disks appear as AFD:<label>
else
    oracleasm scandisks                   # ASMLib: disks appear under /dev/oracleasm/disks/
fi

# asm_diskstring must match the CLONE's device paths from 1b, not the source's — renamedg
# cannot find the disks otherwise. Runs both phases (config file, then the rename).
sudo -i -u grid bash -s -- "$source_diskgroup" "${source_diskgroup}_CLONE" "$clone_asm_diskstring" <<'EOF'
    renamedg dgname="$1" newdgname="$2" \
        asm_diskstring="$3" config="/tmp/renamedg_${1}.cfg" verbose=true
EOF

sudo -i -u grid asmcmd mount "${source_diskgroup}_CLONE"
```

`renamedg` requires the diskgroup to be **dismounted** on every instance that can currently
see it — if `targetInstanceId == sourceInstanceId`, mount the clone's disks under different
device paths than the source's so the source diskgroup stays mounted and only the clone's
copy is renamed.

## 2. Bootstrap the clone's parameter file and oratab entry

A brand-new `cloneSid` has no spfile, no pfile, and no `/etc/oratab` entry — the source's
spfile lives in the *source* host's `$ORACLE_HOME/dbs`, not on the cloned volumes, so nothing
on the target defines the instance yet. `STARTUP MOUNT` without one fails at
`ORA-01078`/`LRM-00109` before it reaches any recovery step.

Send `scriptId: "clone-bootstrap-pfile"` — the server loads
[`clone_bootstrap_pfile.sh`](../../../../server/resources/oracle/scripts/admin/clone_bootstrap_pfile.sh),
which writes `$ORACLE_HOME/dbs/init<CLONE_SID>.ora` pointing `control_files` at the clone's
own controlfile copies (the new mount paths from step 1a–1c — for ASM, the renamed
diskgroup) and appends the `cloneSid` line to `/etc/oratab`. Required `args`: `CLONE_SID`,
`CLONE_ORACLE_HOME`, `SOURCE_DB_NAME`, `CONTROL_FILES` (comma-separated). Optional:
`IS_CDB=true`, `DB_BLOCK_SIZE`, `SGA_TARGET`, `PGA_AGGREGATE_TARGET`, `UNDO_TABLESPACE`,
`ARCHIVE_LOG_DEST`, `DIAGNOSTIC_DEST`, `COMPATIBLE`. Mutating.

`SOURCE_DB_NAME` is the **source** database's `db_name`, not `cloneSid`: it is baked into the
cloned controlfile, and a mismatch is `ORA-01103` at mount. Changing it requires
`DBNEWID`/`nid`, which is out of scope — the clone's separate identity comes from
`db_unique_name`, which the script sets to `cloneSid`. Set `IS_CDB=true` for a CDB source, and
point `ARCHIVE_LOG_DEST` at the clone's own archive mount, never the source's.

## 3. Controlfile path fix-up (database MOUNTED)

The cloned controlfile still references the source's original mount paths/LUN device names.
Mount the clone first by sending `scriptId: "clone-start-resetlogs"` with `PHASE=mount`
(required `args`: `CLONE_SID`, `CLONE_ORACLE_HOME`, `PHASE`). The server loads
[`clone_start_resetlogs.sh`](../../../../server/resources/oracle/scripts/admin/clone_start_resetlogs.sh),
which runs `STARTUP MOUNT` and nothing else in this phase, then do the fix-up, then open with
`PHASE=open` in step 4. RMAN needs the controlfile **mounted** to catalog or switch
anything, so the fix-up cannot run before `STARTUP MOUNT` — it runs in the window between
the two phases.

`ponytail:` this stays agent-composed rather than a fixed script in `server/resources/oracle/scripts/admin/` — the
exact fix-up depends on the _discovered_ datafile/redo-log paths at run time (how many
datafiles, their old vs. new mount points), which a static, pre-written script can't safely
hardcode without risking a wrong `SET NEWNAME` mapping. Ceiling: every clone run needs an
agent-composed RMAN script for this one step. Upgrade path: if this becomes a frequent flow,
add a script that takes a `{oldPath: newPath}` JSON map (built from step 1's mount output +
a discovered old-path listing) and drives `CATALOG START WITH` / `SET NEWNAME FOR DATAFILE`
generically instead of per-run prose.

For NFS/iSCSI-non-ASM clones: rename via `RMAN> CATALOG START WITH` + `SET NEWNAME FOR
DATAFILE ... TO` + `SWITCH DATABASE TO COPY`, driven from the new mount points from step 1a/1b.
For ASM clones, the renamed diskgroup (e.g. `+DATA_CLONE`) already carries new file names; no
per-file rename is needed, but the controlfile's diskgroup reference in the pfile/spfile's
`control_files` parameter must still point at the renamed diskgroup.

## 4. Open with resetlogs and verify

Oracle has no `pg_resetwal` equivalent — a clone's redo logs are the exact point-in-time
copy captured by the group snapshot, so recovery is always a plain
`STARTUP MOUNT` → `ALTER DATABASE OPEN RESETLOGS`. The instance is already mounted from step
3, so send `scriptId: "clone-start-resetlogs"` again with `PHASE=open` (required `args`:
`CLONE_SID`, `CLONE_ORACLE_HOME`, `PHASE`) — it runs `ALTER DATABASE OPEN RESETLOGS` plus the
verification queries below in one mutating call, and refuses to report `verified: true`
unless `V$DATABASE.OPEN_MODE = 'READ WRITE'`:

```sql
SELECT OPEN_MODE FROM V$DATABASE;                    -- must be READ WRITE
SELECT COUNT(*) FROM DBA_OBJECTS WHERE STATUS != 'VALID';  -- sanity: catalog is queryable
```

New listener entry for the clone's `clonePort` is a separate, manual step — editing
`listener.ora`/`tnsnames.ora` safely depends on the existing file's format on that host; never
reuse the source's listener.ora entry or bind the clone to the source's port.

**Never skip resetlogs verification.** A clone that reports success without this check is not
verified — treat a missing or failed verification query the same as a hard failure, even if
`STARTUP`/`OPEN RESETLOGS` returned no error. Populate the `clone` envelope's `verified` field
from `clone_start_resetlogs.sh`'s `verified` output, not from the absence of an `ORA-` error
alone.

`ponytail:` like step 1a–1c, not live-tested end-to-end this session (source instance deleted
before reaching this stage) — it's a direct, deterministic translation of the former inline
template. The generated pfile in step 2 carries only the parameters needed to mount and open
(`db_name`, `db_unique_name`, `control_files`, plus whichever optional ones are passed).
Ceiling: a source that depends on other non-default parameters needs them supplied explicitly.
Upgrade path: `CREATE PFILE FROM SPFILE` on the source during step 5 of
[clone.md](clone.md), ship it with the snapshot, and rewrite its paths on the target.

## 5. Result envelope

Emit the `clone` kind from [confirmation-and-results.md](confirmation-and-results.md):
`status`, `clonedVolumes` (with `mountPath`/LUN path and `fileType` per entry),
`cloneSid`, `openMode`, `listenerPort`, `verified`.
