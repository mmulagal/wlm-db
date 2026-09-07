# Oracle Create Clone (standalone, full FlexClone recovery)

Produces a fully running, independently addressable Oracle instance on a target host by
cloning the source's `DATA_FILES`, `CONTROL_FILES`, `REDO_LOGS`, and `ARCHIVE_LOGS` volumes
from one atomic crash-consistent snapshot — not a storage volume alone. Every mutating stage
(group creation, snapshot, FlexClone, attach/mount, start+resetlogs) is gated by its own
explicit confirmation.

**Out of scope:** RAC sources or targets, Data Guard **standby** sources, cross-major-version
clones, cloning onto a host with an already-active conflicting `ORACLE_SID`/listener port, and
any clone deletion/refresh/resync (create-only).

A Data Guard **primary** is a supported source: the clone gets a freshly generated pfile with no
redo-transport parameters and a `db_unique_name` of `cloneSid`, so it cannot join the production
Data Guard configuration. See [topology.md](topology.md) "Data Guard" for what makes that safe
and what would break it. PDB creation on a Data Guard primary remains refused.

Read [`confirmation-and-results.md`](confirmation-and-results.md) first for inputs, the
confirmation gate, and failure rules.

## Workflow

```
- [ ] 1. Resolve region, source identity (`sourceInstanceId` or `databaseHostId`[+`databaseInstanceId`]), oracleSid (mandatory — the ONE instance to clone; ask, never infer), targetInstanceId, cloneSid, clonePort, retentionLabel, and wlmdb auth
- [ ] 2. Resolve mapped ONTAP volumes on the source (references/mapped-ontap-volumes.md)
       ├─ need_input → ask filesystemId / FSx creds, re-run
       └─ ok → volume confirmation → FSx id/creds intermediary if host SSM param is missing
- [ ] 3. Topology discovery on source (standalone, protocol, CDB-or-not) with those volume args
- [ ] 4. Target checks: SSM reachable, cloneSid not already in /etc/oratab, clonePort free, same Oracle major version as source
- [ ] 5. Confirmation: "create clone snapshot" (this is a NEW snapshot, not a reused one) → create it
- [ ] 6. Confirmation: "create FlexClone volumes" (names, sizes inherited from parents) → create them
- [ ] 7. Confirmation: "attach + start + resetlogs" (target mount/attach details, port, that the instance will be opened) → execute
- [ ] 8. Attach cloned volumes (protocol-specific), bootstrap pfile + oratab entry, STARTUP MOUNT (PHASE=mount), fix up controlfile paths while mounted, ALTER DATABASE OPEN RESETLOGS (PHASE=open)
- [ ] 9. Verify V$DATABASE.OPEN_MODE = 'READ WRITE' and a catalog query
- [ ] 10. Validate the `clone` envelope; report per Answer format (or stop-and-report on failure)
```

## Step 1: inputs

`region`, source identity (`sourceInstanceId` **or** `databaseHostId` with optional
`databaseInstanceId`), `oracleSid` (source SID), `targetInstanceId` (clone destination EC2
id — may be unregistered), `cloneSid` (new `ORACLE_SID` for the clone, same format as
`oracleSid`, must differ from every SID already in the target's `/etc/oratab`), `clonePort`
(new listener port), `retentionLabel` for the clone's own snapshot, plus
`TOKEN`/`ACCOUNT_ID`/`CREDENTIALS_ID`/`ENVIRONMENT`. Ask for anything missing.

**`oracleSid` is mandatory and non-inferable here.** A clone copies exactly one instance, never
every instance on the host, and `oracleSid` is the only input that selects which one — it is
what every source-side remote script receives as `ORACLE_SID`. Never default it, never infer it
from the host when the host has more than one Oracle instance in `/etc/oratab`, and never fall
back to "the only one discovered": ask. A host identity alone (`sourceInstanceId` or
`databaseHostId`) is not a complete source for this workflow.

`databaseInstanceId` stays optional because it does **not** pick the instance — server-side it
only asserts that the instance exists on `databaseHostId`, and the SSM target is resolved from
the host's registered EC2 node either way. Pass it anyway on a registered multi-instance host so
the request records which instance it means. When both are given they must agree: `run-script`
rejects a pair whose `databaseInstanceId` names a different instance than `ORACLE_SID` with
`400 ORACLE_SID <sid> does not match databaseInstanceId <id>`, since for Oracle a registered
instance's name **is** its SID. Compared case-insensitively.

## Step 2: mapped ONTAP volumes (source)

Run [`mapped-ontap-volumes.md`](mapped-ontap-volumes.md) against the source
(non-mutating). On `need_input`, ask for `filesystemId` / FSx creds and re-run. On
`status=ok`, confirm the volume list, then collect FSx id/creds if the host SSM parameter is
missing, before any mutating POST. Validate with `validate_operation_result.sh <file>
volumes`. Pass `SVM_NAME`, `PROTOCOL`, `FILESYSTEM_ID`, and the per-file-type volume/LUN
names as `args` on later source `run-script` calls. The target host does not need this
lookup — it may not host Oracle yet.

## Step 3–4: topology and target validation

Run [`topology.md`](topology.md) against **both** hosts (source with volume `args`; target
without — see "Clone-specific target checks"). Apply its base refusal rules to the source,
and its clone-specific checks to the target: matching Oracle major version, no conflicting
`cloneSid` in `/etc/oratab`, and `clonePort` not already listening. Refuse and stop on any
mismatch — never guess compatibility or proceed with a downgraded feature set. All remote
execution goes through `run_ssm_operation.sh` / wlmdb `POST .../run-script`, never
`aws ssm send-command`.

## Step 5: fresh snapshot (own confirmation)

A clone always starts from a **new** consistency-group snapshot — never an existing one that
may be stale. Follow [snapshot.md](snapshot.md)'s mapped volumes, topology, consistency
group, snapshot confirmation, snapshot creation, and validation steps using `retentionLabel`
and the resolved volume `args`. This is a distinct confirmation from the ones in steps 6 and
7 below — do not fold them into one prompt.

## Step 6: FlexClone volumes (own confirmation)

Present a confirmation naming the new volume names (derived from `cloneSid`) and their
source snapshot before running "Step 3: create FlexClone volumes from the member snapshots"
in [`ontap-consistency-groups.md`](ontap-consistency-groups.md). Use each member snapshot's
own `snapshotName` from the step 5 envelope — never mix a data-file-volume clone from one
snapshot with a redo-log-volume clone from a different one, and never omit
`ARCHIVE_LOGS`.

## Step 7: attach, fix up, start (own confirmation)

Present a confirmation naming the target host, the attach/mount method for the detected
protocol (NFS mount / iSCSI igroup+LUN mapping / ASM = that same igroup+LUN mapping **then**
a diskgroup rename+mount), `cloneSid`,
`clonePort`, and that the Oracle instance will be started and opened with `RESETLOGS` — this
is the last and most consequential stage. Then follow
[`clone-recovery.md`](clone-recovery.md) exactly: attach, bootstrap the pfile/oratab entry,
`STARTUP MOUNT` (`PHASE=mount`), the controlfile fix-up while mounted, `OPEN RESETLOGS`
(`PHASE=open`), and the verification checks. Never skip verification even if `sqlplus` reports
no error.

## Step 8–9: recover and verify

Oracle clone recovery has no `pg_resetwal` equivalent — never attempt to hand-edit or
truncate redo logs. The only recovery path is `STARTUP MOUNT` followed by
`ALTER DATABASE OPEN RESETLOGS`, immediately followed by the `V$DATABASE.OPEN_MODE` and
catalog verification in [clone-recovery.md](clone-recovery.md). Treat a missing or failed
verification the same as a hard failure.

## Step 10: validate

```bash
../scripts/validate_operation_result.sh path/to/result.json clone
```

On any failure at steps 5–8, stop immediately: do not attempt an alternate recovery path, do
not retry the mutating step automatically, and report every resource already created
(consistency group, snapshot, FlexClone volumes, attach/mount state) so an operator can clean
up or resume manually.

## Answer format

1. **Source** — `sourceInstanceId` or `databaseHostId`, region, `oracleSid`, protocol,
   CDB/non-CDB.
2. **Snapshot used** — group snapshot UUID and member snapshot names tagged by file type
   (from step 5).
3. **Clone volumes** — names/UUIDs and target mount/attach paths.
4. **Target** — `targetInstanceId`, `cloneSid`, `clonePort`, `openMode`.
5. **Verification** — `V$DATABASE.OPEN_MODE = READ WRITE` and the catalog query result.
6. On failure: exactly which stage failed and every resource left behind for cleanup.

## Additional resources

| Resource                                                                             | Purpose                                                              |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [`confirmation-and-results.md`](confirmation-and-results.md)                         | Inputs, auth, confirmation gate, result envelope schemas             |
| [`mapped-ontap-volumes.md`](mapped-ontap-volumes.md)                                 | Resolve source per-file-type ONTAP volume names/UUIDs                |
| [`topology.md`](topology.md)                                                         | Source/target discovery and refusal rules                            |
| [`ontap-consistency-groups.md`](ontap-consistency-groups.md)                         | Consistency group, snapshot, and FlexClone remote script templates   |
| [`clone-recovery.md`](clone-recovery.md)                                             | Target attach/mount, controlfile fix-up, resetlogs, and verification |
| [`snapshot.md`](snapshot.md)                                                         | Reused snapshot-creation steps                                       |
| [`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh)                 | Dry-run or POST the wlmdb run-script request                         |
| [`../scripts/validate_operation_result.sh`](../scripts/validate_operation_result.sh) | Validate the result envelope                                         |
