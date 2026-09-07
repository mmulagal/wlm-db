# Oracle Create Snapshot (volume-level, crash-consistent)

Produces one crash-consistent ONTAP consistency-group snapshot covering every volume/LUN
backing `DATA_FILES`, `CONTROL_FILES`, `REDO_LOGS`, and `ARCHIVE_LOGS` for a single-instance
Oracle SID — a standalone route, not only a step embedded in the clone workflow. No RMAN
`BEGIN BACKUP`/`END BACKUP` or other application-consistent quiescing is performed.

**Out of scope:** RAC sources, Data Guard **standby** sources (a Data Guard *primary* is
supported), application-consistent (RMAN) snapshots, and snapshot deletion/expiration (ask the
operator to do that outside this skill).

Read [`confirmation-and-results.md`](confirmation-and-results.md) first for inputs, the
confirmation gate, and failure rules.

## Workflow

```
- [ ] 1. Resolve region, source identity (`sourceInstanceId` or `databaseHostId`[+`databaseInstanceId`]), oracleSid, retentionLabel, and wlmdb auth
- [ ] 2. Resolve mapped ONTAP volumes for DATA_FILES/CONTROL_FILES/REDO_LOGS/ARCHIVE_LOGS (references/mapped-ontap-volumes.md)
       ├─ need_input → ask filesystemId / FSx creds, re-run
       └─ ok → volume confirmation → FSx id/creds intermediary if host SSM param is missing
- [ ] 3. Topology discovery with those volume args — refuse on RAC/Data Guard standby (a Data Guard primary is allowed)
- [ ] 4. Confirmation: "create consistency group" (if one does not already exist for these exact volumes)
- [ ] 5. Confirmation: "create snapshot" (retentionLabel, effect) → create the crash-consistent group snapshot
- [ ] 6. Validate the `snapshot` envelope; report per Answer format (or stop-and-report on failure)
```

## Step 1: inputs

`region`, source identity (`sourceInstanceId` **or** `databaseHostId` with optional
`databaseInstanceId`), `oracleSid`, `retentionLabel`, plus
`TOKEN`/`ACCOUNT_ID`/`CREDENTIALS_ID`/`ENVIRONMENT` (see
[confirmation-and-results.md](confirmation-and-results.md)). Ask for anything missing before
running any discovery.

## Step 2: mapped ONTAP volumes

Run [`mapped-ontap-volumes.md`](mapped-ontap-volumes.md) via `run_ssm_operation.sh`
(non-mutating). On `need_input`, ask for `filesystemId` and/or FSx username+password and
re-run. On `status=ok`, confirm the volume list (see the "Volume confirmation" gate), then
collect FSx id/creds if the host's SSM parameter is missing. Validate with
`validate_operation_result.sh <file> volumes`. Pass the resolved `SVM_NAME`, `PROTOCOL`,
`FILESYSTEM_ID`, and per-file-type volume names as `args` on later `run-script` calls.

## Step 3: topology

Run the discovery script from [`topology.md`](topology.md) with the volume `args`. Refuse on
`deploymentType` of `"rac"` or `"dataguard-standby"`; `"standalone"` and `"dataguard-primary"`
both proceed. Oracle can be snapshotted whether it is currently `MOUNTED` or `OPEN` — a
crash-consistent snapshot does not require the instance to be in any particular open mode, and
it is read-only with respect to the source, so it does not disturb redo transport on a Data
Guard primary. On `"unknown"` (the Data Guard probe could not answer), ask the operator before
proceeding rather than assuming standalone.

## Step 4–5: consistency group and snapshot (own confirmation)

Present the confirmation block from
[confirmation-and-results.md](confirmation-and-results.md) with `Action: create consistency
group` (only if one does not already exist over the exact resolved volume set) and then a
**separate** confirmation with `Action: create snapshot`, naming `retentionLabel`. Only after
an explicit yes, run "Step 1" and "Step 2" from
[`ontap-consistency-groups.md`](ontap-consistency-groups.md) via
`run_ssm_operation.sh --apply` with `CONFIRM=true`.

## Step 6: validate

```bash
../scripts/validate_operation_result.sh path/to/result.json snapshot
```

On failure, stop immediately and report which sub-step failed (group lookup/creation vs.
snapshot creation) and, if a consistency group was created before the snapshot step failed,
say so — do not delete it automatically.

## Answer format

1. **Source** — `sourceInstanceId` or `databaseHostId`, region, `oracleSid`, protocol.
2. **Consistency group** — UUID and the exact volume/LUN names it covers.
3. **Snapshot** — group snapshot UUID, each member snapshot name tagged by file type, and
   `retentionLabel`.
4. On failure: exactly which stage failed and every resource already created.

## Additional resources

| Resource | Purpose |
|---|---|
| [`confirmation-and-results.md`](confirmation-and-results.md) | Inputs, auth, confirmation gate, result envelope schemas |
| [`mapped-ontap-volumes.md`](mapped-ontap-volumes.md) | Resolve per-file-type ONTAP volumes |
| [`topology.md`](topology.md) | Standalone/RAC/Data Guard refusal rules |
| [`ontap-consistency-groups.md`](ontap-consistency-groups.md) | Consistency group and snapshot remote script templates |
| [`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh) | Dry-run or POST the wlmdb run-script request |
| [`../scripts/validate_operation_result.sh`](../scripts/validate_operation_result.sh) | Validate the result envelope |
