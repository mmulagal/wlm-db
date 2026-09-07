# Shared inputs, confirmation, and result contracts

Shared by snapshot, create-PDB, and clone operations in this skill. Never call ONTAP,
sqlplus, or ASM directly from the operator machine — every mutating or discovery command
described here runs **on the target EC2 host via the hidden wlmdb
`POST .../oracle/.../run-script` endpoint**, which loads an allowlisted script by `scriptId`
and forwards it to SSM
`AWS-RunShellScript`. Use [`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh)
to send (or dry-run) every request, and
[`../scripts/validate_operation_result.sh`](../scripts/validate_operation_result.sh) to
validate the returned JSON before trusting it.

## Environment and auth

All paths use `{base}/accounts/{accountId}/wlmdb/v1`.

| `{base}` | `ENVIRONMENT` | Auth0 issuer |
|----------|---------------|--------------|
| `https://api.workloads.netapp.com` | `Production`, `Demo` | `netapp-cloud-account.auth0.com` |
| `https://staging.api.workloads.netapp.com` | `Staging`, `StagingDemo` | `staging-netapp-cloud-account.auth0.com` |

Read shell vars when set; do not re-prompt. If unset, get `TOKEN` and `ACCOUNT_ID` from parent
**netapp-workload-factory** (Auth0 + tenancy) or ask the user.

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | yes | `Production`, `Staging`, `Demo`, or `StagingDemo` |
| `ACCOUNT_ID` | yes | Tenancy `accountPublicId` (e.g. `account-PzlmCZPM`) |
| `CREDENTIALS_ID` | yes | AWS credential UUID linked to the account |
| `TOKEN` | yes | Bearer token (Auth0 client credentials) |

Resolve at runtime (`BASE_URL` from `ENVIRONMENT`):
```bash
case "$ENVIRONMENT" in
  Production|Demo) BASE_URL=https://api.workloads.netapp.com ;;
  Staging|StagingDemo) BASE_URL=https://staging.api.workloads.netapp.com ;;
esac
```

**Demo:** `Demo` / `StagingDemo` need `x-simulator: true` on every curl. Default demo account
when `ENVIRONMENT=Demo` and `ACCOUNT_ID` unset: `account-j3aZttuL`.

**Tenancy:** If `ACCOUNT_ID` unset — `GET https://api.bluexp.netapp.com/tenancy/account`
(production) or the staging equivalent; use `accountPublicId`.

**Headers:**
```
Authorization: Bearer ${TOKEN}
Content-Type: application/json   (POST only)
x-simulator: true                (Demo / StagingDemo only)
```

The run-script path is:
`POST {base}/accounts/{accountId}/wlmdb/v1/oracle/credentials/{credentialsId}/regions/{region}/run-script`

## Scope

**Single-instance Oracle only** — CDB or non-CDB, NFS, iSCSI, or ASM-managed storage. If
topology discovery (see [topology.md](topology.md)) reports a RAC deployment or a Data Guard
**standby**, refuse immediately — do not attempt any snapshot, clone, or PDB creation on those
hosts. There is no multi-node coordination, ASM RAC-aware locking, or failover/replication
handling in this skill.

A Data Guard **primary** is in scope for snapshot and clone (the clone is built with a fresh
pfile carrying no redo transport, so it cannot join the configuration), but **not** for PDB
creation, since `CREATE PLUGGABLE DATABASE` propagates to the standby. See
[topology.md](topology.md) "Data Guard".

## Required inputs

| Input | Required when | Description |
|---|---|---|
| `region` | always | AWS region of the target FSx file system and EC2 host, e.g. `us-east-1` |
| `sourceInstanceId` | unregistered source | EC2 instance ID of the Oracle host, `^i-[0-9a-f]{8,17}$` |
| `databaseHostId` | registered source | Workload Factory host id from inventory (`GET .../database-hosts`). Server resolves the active EC2 node. |
| `databaseInstanceId` | optional, registered source | Workload Factory instance id on that host (`GET .../database-instances`). Requires `databaseHostId`. Does not select the instance — it only asserts the instance exists on the host; `oracleSid` is the selector. Worth passing on a multi-instance registered host. If it names a different instance than `ORACLE_SID`, `run-script` rejects the call with `400` rather than running against the SID (an Oracle instance's registered name is its SID; compared case-insensitively). |
| `oracleSid` | always, source-side | The `/etc/oratab` SID of the CDB or non-CDB instance to operate on, `^[A-Za-z][A-Za-z0-9_$#]{0,7}$` (Oracle SID length limit). This is what scopes every operation to **one** instance rather than the whole host — ask for it, never infer it on a host with more than one instance. Target-side calls in the clone flow (`clone_target_preflight.sh`, target `oracle_version_check.sh`) take `CLONE_SID` instead and have no source SID. |
| `targetInstanceId` | clone only | EC2 instance ID of the clone's destination host, same format as `sourceInstanceId` (destination may be unregistered) |
| `retentionLabel` | snapshot, clone | Short label (`^[a-zA-Z0-9_-]{1,40}$`) recorded in the snapshot/clone name and comment so an operator knows when it is safe to delete it |
| `pdbName` | PDB creation | `^[A-Za-z][A-Za-z0-9_$#]{0,29}$`; normalized to uppercase before use (Oracle folds unquoted identifiers) |
| `pdbAdminUser` / `pdbAdminPassword` | PDB creation | Mandatory admin account for the new PDB (`ADMIN USER x IDENTIFIED BY y`); ask in a dedicated turn, pass only as env vars, never echo/log/write to `result.json`. `pdbAdminUser` takes the same pattern and the same uppercase fold as `pdbName` — it is quoted in the DDL, so an unfolded name breaks later unquoted logins with `ORA-01017`. The password is never folded. |
| `filesystemId` | when mapped-volumes returns `need_input` / `filesystemId` | FSx for ONTAP id, `^fs-[0-9a-f]{8,17}$`. Ask; never guess from an IP mount or LUN serial. |
| `fsxUsername` / `fsxPassword` | when mapped-volumes returns `need_input` / `fsxCredentials` | ONTAP REST user on that filesystem. Ask in advance of any ONTAP `run-script`. Never echo; pass only as `FSX_USERNAME` / `FSX_PASSWORD` args for that call. |

The **source** is identified by exactly one of: `sourceInstanceId` (unregistered / undiscovered
EC2) or `databaseHostId` (registered inventory host, optionally with `databaseInstanceId`). Do
not invent an EC2 id for a registered host — pass `databaseHostId` and let `run-script` resolve
it. Ask only if neither identity is already provided by the user or context. Never fabricate an
EC2 instance ID, host id, region, account, credentials id, SID, or PDB admin password.

Validate every identifier against its regex **before** building any remote command. Reject
with a specific error naming the field — never silently coerce or truncate a value (except the
documented uppercase-fold for `pdbName` and `pdbAdminUser`, which is Oracle's own identifier
rule, not a workaround).

Volume names, LUN serials, ASM disk/diskgroup names, and the SVM/filesystem identity are not
guessed by the operator — resolve them via
[mapped-ontap-volumes.md](mapped-ontap-volumes.md). `filesystemId` and FSx credentials are
operator inputs **only when host-side discovery cannot derive them** (unregistered IP mount,
or missing `/netapp/wlmdb/<filesystemId>`). Pass the resolved envelope as `args` on later
`run-script` calls.

## Confirmation gate (required before any mutation)

These are mutating and must never run without an explicit, later-turn user confirmation:

- Creating or modifying an ONTAP consistency group (adopting existing volumes).
- Creating a consistency-group snapshot.
- Creating an ONTAP FlexClone volume.
- Mounting an NFS volume, or mapping a LUN to the target host (igroup + lun-map). ASM needs
  that same LUN mapping *plus* renaming/mounting the cloned diskgroup — both are mutating.
- Any Oracle DDL (`CREATE PLUGGABLE DATABASE`).
- `ALTER DATABASE OPEN RESETLOGS`, or starting/stopping the Oracle instance or listener.
- Any optimize / remediate SSM that writes ONTAP or host storage config.

Before sending the confirmation prompt, run every read-only preflight/discovery check first
so the prompt is accurate. State, in the same message:

```
Action: <create consistency group | create snapshot | create clone | create PDB | optimize>
Source: <sourceInstanceId or databaseHostId> SID <oracleSid> region <region>
Target: <targetInstanceId>            (clone only)
Resource name(s): <snapshot/clone/PDB name(s)>
Retention label: <retentionLabel>      (snapshot/clone only)
Effect: <plain description of what will be created/started/mounted>
```

Phrases like *"snapshot it"*, *"clone this instance"*, or *"create the PDB"* are
**requests**, not confirmation. Only proceed after a clear affirmative in a later message
(*"yes"*, *"go ahead"*, *"confirmed"*). **Stop after asking** — no mutating `run-script`
call, no `--apply` flag, in the same turn as the prompt.

## Volume confirmation (required after mapped-volumes, before mutation)

After a `volumes` envelope validates, **stop** and list the volumes per file type. Do not
send a mutating `run-script` in the same turn:

```
Action: confirm mapped volumes
Source: <sourceInstanceId or databaseHostId> SID <oracleSid> region <region>
Protocol: <NFS | iSCSI | ASM>
Filesystem: <filesystemId>
SVM: <svmName> (<svmUuid>)
Volumes included in the consistency group:
  DATA_FILES:    <volume/LUN names>
  CONTROL_FILES: <volume/LUN names>
  REDO_LOGS:     <volume/LUN names>
  ARCHIVE_LOGS:  <volume/LUN names>
Excluded (see mapped-ontap-volumes.md): TEMP_FILES, FRA
Effect: later mutating SSM/ONTAP calls will target only these volumes
```

Wait for an explicit yes. If the operator rejects a name, stop — do not pick a different
volume from ONTAP yourself.

## FSx id and credentials (intermediary, before the mutating POST)

After volume confirmation and **before** the mutating `run-script` POST, collect anything
ONTAP still needs that is not already on the host. Ask in a dedicated turn; do not fold this
into the mutating call.

- If `filesystemId` is still missing, or discovery used `need=filesystemId`: ask for
  `filesystemId` (`^fs-[0-9a-f]{8,17}$`) now.
- If discovery used operator creds (`credsSource=operator`) or returned
  `need=fsxCredentials`: ask for `fsxUsername` and `fsxPassword` now if not already
  collected. Pass them only as `FSX_USERNAME` / `FSX_PASSWORD` args on the following POST.
  Never print them, never write them to `result.json` (the wrapper redacts password-like
  keys).
- If the host already has `/netapp/wlmdb/<filesystemId>` and discovery did not need operator
  creds, skip this ask — later scripts use the same SSM parameter.

Registered hosts usually skip this step (inventory/`fsxn_ids` + host parameter).
Unregistered hosts hit it when NFS is IP-mounted, iSCSI target discovery has no cached
filesystem id, or the WF SSM parameter was never written.

## Result envelopes

Every remote script must echo exactly one JSON object as its last line of stdout. Validate it
with `validate_operation_result.sh <file> <kind>` before reporting success. An envelope with a
non-null `error` field, or missing a required success field, is always a failure — never treat
partial output as success.

| `kind` | Required success fields |
|---|---|
| `volumes` | `status`, `protocol` (`NFS`/`iSCSI`/`ASM` — `ASM` outranks the transport beneath it), `isASMManaged`, `svmName`, `svmUuid`, `filesystemId`, `volumesByFileType` (object keyed by `DATA_FILES`/`CONTROL_FILES`/`REDO_LOGS`/`ARCHIVE_LOGS`, each an array of `{volumeName, volumeUuid}` or `{lunName, lunUuid}`) |
| `topology` | `status`, `oracleHome`, `deploymentType` (`standalone`/`dataguard-primary` proceed; `rac`/`dataguard-standby` refused; `unknown` means the Data Guard probe could not answer — ask, do not assume standalone), `databaseRole`, `dataGuardConfigured` (bool or null), `standbyDestCount` (int or null), `isCDB`, `openMode`, `protocol` |
| `snapshot` | `status`, `consistencyGroupUuid`, `groupSnapshotUuid`, `memberSnapshots` (array of `{volumeUuid, volumeName, snapshotName, fileType}`), `retentionLabel` |
| `database` | `status`, `pdbName`, `adminUser`, `openMode`, `verified` (boolean, from a post-creation `v$pdbs` query) |
| `clone` | `status`, `clonedVolumes` (array of `{volumeUuid, volumeName, mountPath, fileType}`), `cloneSid`, `openMode`, `listenerPort`, `verified` (boolean, from `v$database.open_mode` + a catalog query) |

## Failure handling

- Treat a non-zero exit status from any remote command, a non-2xx wlmdb response, or a JSON
  envelope with a populated `error` as a hard failure. Stop and report it; never retry
  destructively or improvise a workaround. `status=need_input` is **not** a hard failure —
  ask the named field and re-run mapped-volumes.
- One documented exception to "stop and report": if `run-script` failed because the caller or
  wlmdb's IAM role **lacks SSM permission** (401/403, or `AccessDeniedException` on
  `ssm:SendCommand`), follow [no-ssm-fallback.md](no-ssm-fallback.md) — hand the operator the
  equivalent `aws ssm send-command` to run themselves and validate what they paste back. That is
  the only sanctioned use of `aws ssm send-command` in this skill, and the agent still never runs
  it itself. A `TargetNotConnected`/`InvalidInstanceId` failure is *not* a permissions problem and
  has no fallback — report and stop.
- Never run `ALTER DATABASE OPEN RESETLOGS` without first confirming a clean, recoverable
  controlfile/redo state (see [clone-recovery.md](clone-recovery.md)); never mount a clone
  volume over an already-active `ORACLE_HOME`/datafile path; never rename an ASM diskgroup to
  collide with an existing one.
- Never print the FSx/ONTAP credential resolved from the `/netapp/wlmdb/<filesystemId>` SSM
  parameter, the PDB admin password, or any ASM/`sqlplus` connect string containing a
  password, in a transcript or saved output file. Remote scripts must only echo status text
  and the final JSON envelope.
