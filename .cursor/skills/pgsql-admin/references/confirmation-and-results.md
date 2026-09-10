# Shared contract: auth, inspect, confirmation, envelopes

Read this once before [database.md](database.md) or [clone.md](clone.md). Everything here
applies to both flows and is **not** repeated there.

Every remote command is wlmdb `POST .../pgsql/.../run-script` with a named `scriptId` plus
`args`. Never author, concatenate, or upload shell; never `aws ssm send-command` from the
operator machine. Send via
[`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh); trust output only after
[`../scripts/validate_operation_result.sh`](../scripts/validate_operation_result.sh).

Host how-to lives in `server/resources/pgsql/scripts/admin/`. Do not restate or replay those
steps.

## Environment and auth

`{base}/accounts/{accountId}/wlmdb/v1`. Wrapper maps `ENVIRONMENT` → `BASE_URL` (override
`WLMDB_BASE_URL` for local).

| `{base}` | `ENVIRONMENT` |
|----------|---------------|
| `https://api.workloads.netapp.com` | `Production`, `Demo` |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` |

Required: `ENVIRONMENT`, `ACCOUNT_ID` (`accountPublicId`), `CREDENTIALS_ID`, `TOKEN`. Read
env when set; otherwise parent **netapp-workload-factory** or ask. Demo / StagingDemo: header
`x-simulator: true`. Default demo account if `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset:
`account-j3aZttuL`. Tenancy fallback: BlueXP `GET .../tenancy/account`.

`POST {base}/accounts/{accountId}/wlmdb/v1/pgsql/credentials/{credentialsId}/regions/{region}/run-script`

## Required inputs

| Input | Required when | Description |
|---|---|---|
| `region` | always | AWS region of FSx + EC2 |
| `sourceInstanceId` | unregistered source | `^i-[0-9a-f]{8,17}$`; after HA, the primary's id |
| `databaseHostId` | inventory/deployed source | Workload Factory host id from `GET .../pgsql/.../database-hosts` (hosts appear via deploy, not a pgsql register API). First probe and `nodeTopology.ec2Details`. Once `deploymentType == "ha"`, do not send it **alone**. |
| `databaseInstanceId` | optional, with `databaseHostId` | Instance id from the pgsql **host-detail** payload (`database_instances` / topology). There is no `GET .../pgsql/.../database-hosts/:id/database-instances/:id` (MSSQL/Oracle only). `run-script` still validates it against the host's instance list. |
| `filesystemId` | inspect `need=filesystemId` | `^fs-[0-9a-f]{8,17}$`; never guess from an IP mount |
| `fsxUsername` / `fsxPassword` | inspect `need=fsxCredentials` | ONTAP REST; never echo; `FSX_*` args only |

Flow-specific inputs (`databaseName`, `owner`; `targetInstanceId`, `cloneName`, `clonePort`,
`retentionLabel`) are in that flow's file. Source is exactly one of `sourceInstanceId` or
`databaseHostId`. Do not invent ids. Validate regexes before POST; do not coerce.

**ONTAP names** (`SVM_NAME`, `DATA_VOLUME`, `LOG_VOLUME`, `CG_NAME`, `SNAPSHOT_NAME`,
`DATA_CLONE_VOLUME`, `WAL_CLONE_VOLUME`) must match `^[A-Za-z0-9_]+$`. A hyphen is **not**
legal (ONTAP `917888`). `cloneName` and `retentionLabel` may contain `-` for systemd/comments;
**replace `-` with `_`** when those labels are copied into an ONTAP volume, CG, or snapshot
name. `CG_NAME` is also max 30 characters. `run_ssm_operation.sh` rejects illegal ONTAP args
before POST.

## Step 1 — `scriptId: inspect`

Always first, on the host the operator named. Non-mutating. `REGION` is injected by the
server from the path region; do not send it in `args`. One envelope merges topology, volumes,
createdb preflight, and clone-target checks; apply the subset that applies.

```
{ "region": "...", "instanceId": "i-...", "comment": "pgsql inspect",
  "scriptId": "inspect", "args": {} }
```

| Arg | When |
|---|---|
| `DATABASE_NAME` / `OWNER` | createdb preflight (`alreadyExists` / `ownerExists`) |
| `CLONE_NAME` / `CLONE_PORT` / `CLONE_PGDATA` / `CLONE_LOGDIR` | clone destination checks |
| `FILESYSTEM_ID` / `FSX_USERNAME` / `FSX_PASSWORD` | re-inspect after `need_input` |

Trust the envelope's `nodeKind`, `nodeRole`, `deploymentType`. Do not re-derive role from
`postgresql.conf` or `wal_level` (`replica` is the v10+ default and is not HA).

## Step 2 — resolve the primary

Mutate only on the resolved postgres primary. A standby is read-only and has its own volume
pair. `nodeKind=pgpool` is not a createdb or clone source. There is no failover
orchestration, no cloning *from* the standby, no building a new standby, and no pgpool
registration. `cg-snapshot` is clone infrastructure only.

```
- [ ] nodeKind=pgpool → refuse as source
- [ ] nodeRole=none / standalone → this host is the source
- [ ] nodeRole=primary → this host is the source
- [ ] nodeRole=standby → resolve the peer, then inspect it:
        inventory: GET .../pgsql/.../database-hosts/{databaseHostId}
                   → nodeTopology.ec2Details[].id (no role field); peer = the id that
                     is not this host. One id only → ask the operator.
        unregistered: ask for the other node's EC2 id; show envelope `primaryHost`.
                      Do not ask for the peer's storage/fsxadmin creds.
- [ ] refuse if the candidate is not nodeRole=primary; never use standby volumes
- [ ] confirmation names the actual primary — never silently redirect
```

`run-script` with only `databaseHostId` executes on metadata `node1InstanceId` (failover can
hit the standby). When the body also names a matching `ec2InstanceId` (node1 or node2), SSM
runs on that instance. Once inspect says `deploymentType == "ha"`, every later call uses the
**bare** `instanceId` of the probed primary, or `databaseHostId` plus that matching
`ec2InstanceId`. Do not send `databaseHostId` alone.

`nodeDetails` is **not** on the PostgreSQL `database-hosts` response — use
`nodeTopology.ec2Details[].id` plus an on-host `inspect`.

`deploymentType == "ha"` is not a refusal — route to the primary. Validate a mutating source
with `validate_operation_result.sh <file> topology` (`standalone`+`none` or `ha`+`primary`).

### Source refusals

Stop (except `need_input`, below) and relay `reason` verbatim:

- `nodeKind=pgpool`; `status != "ok"`
- `dataMount.nfs` / `walMount.nfs` not true; empty `dataVolume`/`logVolume`;
  `dataVolume == logVolume`
- `dataMount.mountSvm` ≠ `walMount.mountSvm` when both set (a CG cannot span SVMs)
- same for `mountFilesystemId` across file systems

`mountSvm` / `mountFilesystemId` come from each NFS hostname and are empty on IP mounts (ask
`filesystemId`). Do not compare arg-derived `svmName`/`filesystemId` to each other.

## Step 3 — volumes and `need_input`

Run inspect against the **resolved primary**. Never guess an FSx id or ONTAP password.
`need_input` is not a hard failure. `svmUuid` is for the volume-confirmation prompt only,
never an arg.

| Envelope | Meaning | Ask, then re-inspect |
|---|---|---|
| `need=filesystemId` | NFS is an IP (or DNS had no `fs-…`) | `filesystemId` `^fs-[0-9a-f]{8,17}$` |
| `need=fsxCredentials` | `/netapp/wlmdb/<filesystemId>` missing | FSx username **and** password as `FSX_USERNAME` / `FSX_PASSWORD`, that call only; never echo |

If the operator supplies `FILESYSTEM_ID` and inspect then reports a non-empty
`dataMount.mountFilesystemId` / `walMount.mountFilesystemId` that differs, stop — re-inspect
with **no** `FILESYSTEM_ID` and confirm the host-discovered filesystem.

On `status == "ok"`, validate `validate_operation_result.sh <file> volumes`. Volume args
(`SVM_NAME`, `DATA_VOLUME`, `LOG_VOLUME`, `FILESYSTEM_ID`, and `FSX_USERNAME` /
`FSX_PASSWORD` only when `credsSource=operator`) go to `cg-snapshot` / `cg-flexclone` **only**
— `createdb` and `clone-recovery` reject them with 400.

Reuse an existing consistency group **only** when its `volumes[].name` set is exactly
`{datavol, walvol}` — never adopt a group with unrelated members, and never silently
rename/replace one.

## Step 4 — confirmation

Every mutation gets a confirmation in a **later turn**: CG create/adopt, CG snapshot,
FlexClone, mount/fstab/chown, `CREATE DATABASE`, clone unit start. The clone never touches
the target's existing `postgresql.service`. *"clone this"* is a request, not confirmation —
stop after asking, no `--apply` in the same turn.

```
Action: <create consistency group | create snapshot | create clone | create database>
Source: <resolved primary instanceId, …> region <region>
Routed from: <original host> (standby)   (when the operator named the standby)
Target: <targetInstanceId>            (clone only)
Coexists with: <existing PGDATA, port, nodeRole — or "no PostgreSQL running">
               (clone mount+start only; its service is not touched)
Resource name(s): …
Retention label: …                    (clone only)
Effect: …
```

After inspect returns a `volumes` envelope that validates, **stop** and list the volumes
before any mutating `run-script`:

```
Action: confirm mapped volumes
Source: <sourceInstanceId or databaseHostId> region <region>
Filesystem: <filesystemId>
SVM: <svmName> (<svmUuid>)
Data volume: <dataVolume>
WAL volume: <logVolume>
Effect: later mutating SSM/ONTAP calls will target only these two volumes
```

Wait for an explicit yes. If the operator rejects a name, stop — do not pick a different
volume from ONTAP yourself.

Order: **volumes**, then **FSx id/creds** if still missing (`need_input` or
`credsSource=operator`; skip when the host SSM parameter exists), then the mutation itself.
Inventory hosts usually skip the creds ask (`fsxn_ids` + host parameter). Unregistered hosts
hit it when NFS is IP-mounted or the WF SSM parameter was never written.

## Envelopes and failure

Every allowlisted script echoes exactly one JSON object as its last line of stdout. Validate
with `validate_operation_result.sh <file> <kind>` (`volumes` / `topology` / `target` /
`snapshot` / `database` / `clone`). An `error` field or a missing success field is failure
regardless of exit code.

**Remote scripts must leave stderr empty.** `extractSsmResponse` returns `{error}` whenever
`StandardErrorContent` is non-empty and **discards stdout entirely**, so a script that exits 0
and prints a perfect envelope still surfaces as a wlmdb HTTP 500 if anything wrote a single
line to stderr. Send diagnostics to `/dev/null` or fold them into the JSON envelope; never
`echo ... >&2`. For commands that fail loudly (`mount`, `systemctl start`), redirect with
`2>&1` and handle the failure explicitly.

| `kind` | Required success fields |
|---|---|
| `volumes` | `status`, `svmName`, `svmUuid`, `dataVolume`, `logVolume`, `filesystemId` |
| `topology` | `status`, `deploymentType`, `nodeRole` (`none` \| `primary` \| `standby`), `pgdata`, `walTarget`, `dataMount`, `walMount`, `pgVersionMajor` |
| `snapshot` | `status`, `consistencyGroupUuid`, `groupSnapshotUuid`, `memberSnapshots` (array of `{volumeUuid, volumeName, snapshotName}`), `retentionLabel` |
| `database` | `status`, `databaseName`, `owner`, `verified` (boolean; catalog query on the primary, plus a replication proof when `deploymentType=ha`) |
| `clone` | `status`, `clonedVolumes` (array of `{volumeUuid, volumeName, mountPath}`), `pgdata`, `port`, `serviceUnit` (the clone's own `postgresql-<cloneName>.service`), `serviceState`, `verified` (boolean, from `pg_isready` + `pg_is_in_recovery()` + a catalog query) |

Hard failure — stop, do not retry a mutation, report what already exists: non-2xx, envelope
`error`, `verified != true`. `status=need_input` is not a hard failure — ask and re-inspect.
SSM 401/403 / `TargetNotConnected` / similar → [ssm-unavailable.md](ssm-unavailable.md).
Never `pg_resetwal`. Never print FSx or PostgreSQL passwords.
