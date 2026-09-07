# Oracle Create Database (Pluggable Database from PDB$SEED)

Creates one Pluggable Database inside an already-running Container Database (CDB) using
`CREATE PLUGGABLE DATABASE ... FROM PDB$SEED`. This is the only "create database" primitive
this skill supports — there is no lightweight equivalent for a non-CDB instance (that would
require full DBCA provisioning of a new instance, which is out of scope).

**Out of scope:** non-CDB targets (refuse — see Step 3), RAC/Data Guard CDBs, DBCA-based new
instance creation, and any PDB option beyond `ADMIN USER ... IDENTIFIED BY ...` (datafile
placement always follows the CDB's default file-name conversion / OMF settings).

Read [`confirmation-and-results.md`](confirmation-and-results.md) first for inputs, the
confirmation gate, and failure rules.

## Workflow

```
- [ ] 1. Resolve region, source identity (`sourceInstanceId` or `databaseHostId`[+`databaseInstanceId`]), oracleSid (the CDB), pdbName, pdbAdminUser/pdbAdminPassword, and wlmdb auth
- [ ] 2. Resolve mapped ONTAP volumes (non-mutating, only needed if this PDB creation will itself be wrapped in a snapshot — otherwise skip); topology discovery — confirm isCDB=true and openMode=READ WRITE
- [ ] 3. Refuse if isCDB=false (no PDB primitive exists for a non-CDB instance)
- [ ] 4. Preflight: pdbName does not already exist in DBA_PDBS; pdbName passes identifier rules and is normalized to uppercase
- [ ] 5. Confirmation: "create PDB" (pdbName, admin user, effect) → wait for explicit yes
- [ ] 6. Run CREATE PLUGGABLE DATABASE ... FROM PDB$SEED ... ADMIN USER ... IDENTIFIED BY ...; OPEN the PDB
- [ ] 7. Verify via V$PDBS / DBA_PDBS that the PDB exists and is OPEN READ WRITE
- [ ] 8. Validate the `database` envelope; report per Answer format
```

## Step 1: inputs

`region`, source identity (`sourceInstanceId` **or** `databaseHostId` with optional
`databaseInstanceId`; must already be a **standalone, running CDB** — this operation never
provisions a new instance), `oracleSid` (the CDB's SID), `pdbName` matching
`^[A-Za-z][A-Za-z0-9_$#]{0,29}$` (Oracle identifier rule; fold to uppercase before use —
Oracle folds unquoted identifiers, this is not a workaround), `pdbAdminUser` matching the
same pattern **and folded the same way**, and `pdbAdminPassword`. Ask for
`pdbAdminUser`/`pdbAdminPassword` in a dedicated turn; never echo, log, or write the password
to `result.json`.

Both identifiers reach the DDL double-quoted, so an unfolded `pdbAdminUser` is created
case-sensitively and every later unquoted login fails with `ORA-01017`. `create_pdb.sh` and
`pdb_exists_check.sh` fold both names themselves, so this is belt-and-braces rather than the
only line of defence — but report the uppercase form to the user, since that is the account
that will exist. Never fold `pdbAdminPassword`: passwords are case-sensitive.

## Step 2–3: topology and CDB check

Run the discovery script from [`topology.md`](topology.md). Refuse if
`deploymentType != "standalone"` — that includes `"dataguard-primary"`, which snapshot and clone
*do* accept but PDB creation does not: `CREATE PLUGGABLE DATABASE` propagates to the standby,
which then has to materialize the new datafiles or drop out of recovery. Then require **both**:

- `isCDB == true` — refuse otherwise: *"pdbName can only be created inside an existing CDB;
  <oracleSid> is a non-CDB instance. Creating a new non-CDB database requires full DBCA
  provisioning, which this skill does not support."*
- `openMode == "READ WRITE"` — refuse otherwise: *"the CDB must be OPEN READ WRITE to accept
  CREATE PLUGGABLE DATABASE; current open_mode is <openMode>."*

## Step 4: preflight

Send `scriptId: "pdb-exists-check"` (required `args`: `ORACLE_SID`, `PDB_NAME` —
uppercased). The server loads
[`pdb_exists_check.sh`](../../../../server/resources/oracle/scripts/admin/pdb_exists_check.sh).
Refuse if `exists == true` — never drop-and-recreate an existing PDB. Note: `V$PDBS`' name
column is `NAME`, not `PDB_NAME` — the latter raises `ORA-00904`; the script already gets
this right.

## Step 5: confirmation

Present the confirmation block from
[confirmation-and-results.md](confirmation-and-results.md) with `Action: create PDB`,
`pdbName` (uppercased), and `pdbAdminUser` (never the password). Wait for an explicit
affirmative before running any DDL.

## Step 6: create and open

After confirmation, send `scriptId: "create-pdb"` via `run_ssm_operation.sh --apply` with
`CONFIRM=true` (wlmdb `POST .../oracle/.../run-script`, never `aws ssm send-command`). The
server loads
[`create_pdb.sh`](../../../../server/resources/oracle/scripts/admin/create_pdb.sh). Required
`args`: `ORACLE_SID`, `PDB_NAME`, `PDB_ADMIN_USER`, `PDB_ADMIN_PASSWORD` — the password is
never embedded literally in a script body, since the script itself is a static, allowlisted
server-side file; only the value travels in `args`, injected as an environment variable at
execution time. The script writes the password to an oracle-owned, `chmod 400` temp SQL file
and deletes it immediately after use.

`ORA-65010: maximum number of pluggable databases created` on a CDB that already has 3 user
PDBs usually means the Oracle Enterprise Edition install is **not licensed for Multitenant**,
which hard-caps user PDBs at 3 regardless of the `MAX_PDBS` parameter — raising `MAX_PDBS`
will itself fail with `ORA-65334`/`ORA-02097`. Do not attempt to raise `MAX_PDBS` as a fix;
tell the operator the licensing constraint and ask them to either free a PDB slot (drop an
existing user PDB — their call, not this skill's) or pick a different CDB.

## Step 7–8: verify and validate

`verified != true` is a hard failure — never report success purely because `CREATE
PLUGGABLE DATABASE` returned no `ORA-` error; the `V$PDBS` open-mode query is the source of
truth. Validate with:

```bash
../scripts/validate_operation_result.sh path/to/result.json database
```

## Answer format

1. **Source** — `sourceInstanceId` or `databaseHostId`, region, `oracleSid` (CDB).
2. **PDB** — `pdbName` (uppercased), `adminUser`, `openMode` (verified from `V$PDBS`).
3. **Verification** — confirm the catalog query that proved the PDB exists and is open.

## Additional resources

| Resource | Purpose |
|---|---|
| [`confirmation-and-results.md`](confirmation-and-results.md) | Inputs, auth, confirmation gate, result envelope schemas |
| [`topology.md`](topology.md) | CDB / open-mode / standalone preflight |
| `scriptId: "pdb-exists-check"` | Step 4 preflight |
| `scriptId: "create-pdb"` | Step 6 create + open |
| [`../scripts/run_ssm_operation.sh`](../scripts/run_ssm_operation.sh) | Dry-run or POST the wlmdb run-script request (`scriptId` + `args`) |
| [`../scripts/validate_operation_result.sh`](../scripts/validate_operation_result.sh) | Validate the result envelope |
