# PostgreSQL Create Clone (full FlexClone recovery)

A running copy on a **target** host: crash-consistent consistency-group snapshot of the
source primary's data+WAL volumes, FlexClone both, then mount and start as its own
`postgresql-<cloneName>.service`. `PGDATA` and `pg_wal` are two FSx volumes, so one volume's
snapshot is not a recovery point — both stages are group operations.

The clone never adopts the destination's `postgresql.service`: a host already running
PostgreSQL (including the source itself) is a valid destination when version, port, unit
name, and mount paths are free.

**Out of scope:** cloning *from* a standby; building a new standby; pgpool registration;
`pg_dump`; cross-major version; a busy port/unit/mount or a live `PGDATA` at the clone path.

Prerequisite: [confirmation-and-results.md](confirmation-and-results.md) — auth, inspect,
primary resolution, volume confirmation, envelope and failure rules. Not repeated here.
Host how-to for snapshot / FlexClone / recovery is
`server/resources/pgsql/scripts/admin/{cg-snapshot,cg-flexclone,clone-recovery}.sh`.

## Workflow

```
- [ ] 1. inputs + derived ONTAP names
- [ ] 2. inspect source → resolve primary, confirm volumes
- [ ] 3. inspect target with CLONE_* → validate `target`
- [ ] 4. confirm, then cg-snapshot       (mutating)
- [ ] 5. confirm, then cg-flexclone      (mutating)
- [ ] 6. confirm, then clone-recovery    (mutating)
- [ ] 7. validate `clone`; report, or stop and list leftovers
```

Steps 4–6 get **separate** confirmations. Do not fold them into one prompt. If SSM cannot
reach the host, stop and print the numbered **Clone** steps in
[ssm-unavailable.md](ssm-unavailable.md).

## Inputs and derived names

| Input | Rule |
|---|---|
| `targetInstanceId` | destination EC2; may already run PostgreSQL; may be the source |
| `cloneName` | `^[a-zA-Z0-9_-]{1,40}$` — hyphens allowed for the unit and mount paths |
| `clonePort` | free on the target; must differ from the source port |
| `retentionLabel` | `^[a-zA-Z0-9_-]{1,40}$`, used as the snapshot comment |

ONTAP object names allow only `^[A-Za-z0-9_]+$` — derive a `cloneSlug` / `retentionSlug` by
replacing `-` with `_`, and refuse anything else. `run_ssm_operation.sh` also rejects
hyphens in those args.

| Arg | `scriptId` | How to set |
|---|---|---|
| `CG_NAME` | `cg-snapshot` | Reuse a known matching group (members exactly `{data, wal}`); else `wlmdb_pgsql_cg_<id>` from the data volume's trailing stamp (`wlmdb_pgsqldata_<stamp>` → 28 chars). Max 30 chars. Never the full volume name. |
| `SNAPSHOT_NAME` | `cg-snapshot` | e.g. `wlmdb_pgsql_<retentionSlug>_<UTC yyyymmddHHMMSS>` |
| `RETENTION_LABEL` | `cg-snapshot` | operator `retentionLabel` verbatim (hyphens OK — it is a comment) |
| `DATA_CLONE_VOLUME` / `WAL_CLONE_VOLUME` | `cg-flexclone` | `wlmdb_pgsqldata_<cloneSlug>` / `wlmdb_pgsqllog_<cloneSlug>` |
| `MEMBER_SNAPSHOTS` | `cg-flexclone` | JSON **string** of `memberSnapshots` from the snapshot envelope |

## Step 3 — inspect the target

A target has no clone `PGDATA` yet, so do **not** validate it as `topology`.

```
{ "region": "...", "instanceId": "i-target", "comment": "pgsql inspect clone target",
  "scriptId": "inspect",
  "args": { "CLONE_NAME": "...", "CLONE_PORT": "...",
            "CLONE_PGDATA": "/pgdata-clone-<cloneName>",
            "CLONE_LOGDIR": "/pglog-clone-<cloneName>" } }
```

Validate `validate_operation_result.sh <file> target`. Refuse on `status != "ok"`; empty or
unequal `pgVersionMajor` vs source; `pgdataConflict`, `portInUse`, `unitConflict`, or
`mountConflict` true; `null` port/unit fields (the arg was omitted). Name the offending
values — several of these stay `status=ok` with the detail in their own field, so `reason`
alone is not enough.

`nodeRole != "none"` is **not** a refusal. Carry `nodeRole`, `serviceState`, and the existing
`pgdata` into the mount+start confirmation. Never stop or repoint the target's
`postgresql.service` to make room.

## Step 4 — `cg-snapshot` (on the primary)

Confirm a **new** group snapshot, not a reused one. If no matching CG is known, first confirm
creating `CG_NAME`: it **adopts** the two existing volumes, creates no volumes and moves no
data. Reuse an existing group only when its members are exactly `{data, wal}`. Then one POST
— the script find-or-creates the group and takes the snapshot. It is crash-consistent; do
not request `consistency_type: application`.

```
{ "region": "...", "instanceId": "i-...", "comment": "pgsql cg snapshot",
  "scriptId": "cg-snapshot",
  "args": { "SVM_NAME": "...", "DATA_VOLUME": "...", "LOG_VOLUME": "...",
            "FILESYSTEM_ID": "...", "CG_NAME": "...", "SNAPSHOT_NAME": "...",
            "RETENTION_LABEL": "..." } }
```

Validate `snapshot` and keep `memberSnapshots`. Do not validate this envelope as `clone`.

## Step 5 — `cg-flexclone` (on the primary)

Confirm the two clone volume names and the parent snapshot. Pass each member's own
`snapshotName` — never mix data and WAL from different snapshots.

```
{ "region": "...", "instanceId": "i-...", "comment": "pgsql cg flexclone",
  "scriptId": "cg-flexclone",
  "args": { "SVM_NAME": "...", "DATA_VOLUME": "...", "LOG_VOLUME": "...",
            "FILESYSTEM_ID": "...", "DATA_CLONE_VOLUME": "...",
            "WAL_CLONE_VOLUME": "...", "MEMBER_SNAPSHOTS": "[...]" } }
```

Do not mount or start PostgreSQL here. Carry `dataCloneUuid` / `walCloneUuid` to step 6.

## Step 6 — `clone-recovery` (on the target)

Confirm mount paths, port, the new unit, and any existing cluster on the target
(`PGDATA` / port / `nodeRole`) with "its service is not touched". Then one POST.

```
{ "region": "...", "instanceId": "i-target", "comment": "pgsql clone recovery",
  "scriptId": "clone-recovery",
  "args": { "CLONE_NAME": "...", "CLONE_PORT": "...", "NFS_SERVER": "...",
            "DATA_CLONE_VOLUME": "...", "WAL_CLONE_VOLUME": "...",
            "DATA_CLONE_UUID": "...", "WAL_CLONE_UUID": "..." } }
```

`NFS_SERVER` is the source inspect `dataMount.server` **verbatim** — do not rebuild it from
svm/filesystem/region (the host is the FSx SVM id `svm-…`). Every key is required; a missing
one aborts the remote script.

Validate `clone`: expect two `clonedVolumes`, `pgdata`, a numeric `port`, `serviceUnit`
starting with `postgresql-` (never `postgresql.service`), `serviceState=running`,
`verified=true`.

The unit is started but **not enabled**, while the fstab entries persist. Say so in the
answer (`systemctl enable postgresql-<cloneName>` if they want it after reboot).

## On failure at steps 4–6

Stop. No retry with the same args, no `pg_resetwal`, never `systemctl stop postgresql`.
Report which stage failed and what already exists: CG, snapshot, FlexClone volumes, mounts.
The remote script already stops **only** `postgresql-<cloneName>` when its verify fails.

## Answer

1. **Source** — primary id, region, `PGDATA`, WAL target, `pgVersionMajor`; routed-from if any.
2. **Snapshot** — group UUID and member snapshot names.
3. **Clone volumes** — names, UUIDs, and mount paths.
4. **Target** — instance, clone `PGDATA`, port, unit and state, enabled-at-boot (no), plus
   any co-located existing cluster.
5. **Verification** — from the envelope (`verified`, `serviceState`); do not re-run SQL from
   the operator machine.
