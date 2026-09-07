# Fallback: wlmdb `run-script` is not permitted

Normally **every** remote command goes through wlmdb `POST .../oracle/.../run-script` and the
agent never touches `aws ssm send-command` — that rule stands everywhere else in this skill.
This doc is the single exception: when `run-script` is refused for **permission** reasons, hand
the operator the equivalent `aws ssm send-command` to run from their own machine, then validate
what they paste back.

The agent still never executes `aws ssm send-command` itself. It composes the command, the
operator runs it. Nothing in the confirmation gate, the refusal rules, or envelope validation
relaxes here.

## 1. Confirm it is actually a permissions failure

Read `httpCode` and `output` from the saved `result.json` — do not guess from the fact that the
call failed. Only the first two rows below are what this fallback is for.

| Symptom in the failed response | Cause | Action |
|---|---|---|
| `httpCode` 401/403 | The wlmdb token/account cannot use the `run-script` endpoint | This fallback |
| `AccessDeniedException` naming `ssm:SendCommand` / `ssm:GetCommandInvocation` | wlmdb's IAM role lacks SSM on that instance | This fallback |
| `TargetNotConnected`, `InvalidInstanceId`, "instance not in a valid state" | The SSM agent is not running, or the instance is not SSM-managed at all | **Not** a permissions problem — `aws ssm send-command` will fail the same way. Report it and stop; the agent/instance profile has to be fixed first |
| Anything else (5xx, ONTAP errors, an envelope with `error`) | Not a transport problem | Normal failure handling in [confirmation-and-results.md](confirmation-and-results.md) — stop and report |

The operator needs `ssm:SendCommand` **and** `ssm:GetCommandInvocation` on that instance, and
the instance must already be SSM-managed.

## 2. Resolve the raw EC2 instance id

`run-script` accepts `databaseHostId` and resolves the EC2 node itself. `aws ssm send-command`
does not — it needs the literal `i-...` id. For a registered host, resolve it from inventory or
ask the operator. Never fabricate one, and never assume the host's only node is the right one on
a multi-node host.

## 3. Build the exact same script

Do **not** re-author the operation inline. `run-script` loads the script text from an
allowlisted file in the repo — [`server/resources/oracle/scripts/admin/`](../../../../server/resources/oracle/scripts/admin/)
— by `scriptId` (see
[`oracle-admin-scripts.ts`](../../../../server/src/operations/workloads/oracle/oracle-admin-scripts.ts)
for the `scriptId` → file mapping), so the byte-identical script text is just that file, not
something to extract from a JSON payload:

```bash
cp server/resources/oracle/scripts/admin/<script>.sh op.sh   # .sh scriptIds
```

For a `.py` scriptId (`mapped-ontap-volumes`, `consistency-group-snapshot`,
`flexclone-create`), SSM's `AWS-RunShellScript` runs the command as a shell script, so a
hand-copied `.py` file would be parsed as shell and fail — wrap it exactly as
`oracle-admin-scripts.ts`'s `loadOracleAdminScript()` does:

```bash
{
    printf 'PYTHON=$(command -v python3 || command -v python) || {\n'
    printf '    echo '"'"'{"status":"error","error":"no python interpreter found on host"}'"'"'\n'
    printf '    exit 1\n'
    printf '}\n'
    printf '"$PYTHON" - <<'"'"'WLMDB_PY'"'"'\n'
    cat server/resources/oracle/scripts/admin/<script>.py
    printf '\nWLMDB_PY\n'
} > op.sh
```

`run-script` turns `args` into `export` lines ahead of the body (plus `REGION`, and
`DATABASE_HOST_ID`/`DATABASE_INSTANCE_ID` on a registered host). `send-command` will not, so
prepend them yourself — see the reference doc for the `scriptId` you are running for its
required/optional `args`:

```bash
{ printf 'export ORACLE_SID=%s\n' "<value>"; ...; cat op.sh; } > op_full.sh
```

For secrets (`FSX_PASSWORD`, `PDB_ADMIN_PASSWORD`), do **not** write them into `op_full.sh`
on disk. Tell the operator which variable to prepend and let them type the value into their
own shell. Never print a secret into chat or into a file you echo back.

## 4. Run it and collect the envelope

`--parameters file://` avoids shell-quoting the whole script:

`executionTimeout` is set explicitly for the same reason wlmdb sets it: the snapshot and clone
scripts wait on ONTAP jobs for up to 15 minutes, and a shorter cap kills the command while the
ONTAP job runs on — leaving a snapshot or clone that the envelope reports as failed.

```bash
jq -Rs '{commands:[.], executionTimeout:["1800"]}' op_full.sh > params.json
CMD_ID=$(aws ssm send-command --region <region> --instance-ids <i-...> \
    --document-name AWS-RunShellScript --comment "<comment>" \
    --parameters file://params.json --query 'Command.CommandId' --output text)
aws ssm get-command-invocation --region <region> --command-id "$CMD_ID" \
    --instance-id <i-...> --query StandardOutputContent --output text
```

The last line of that output is the single-line JSON envelope. Have the operator paste it back.

## 5. Validate exactly as if wlmdb had returned it

```bash
scripts/validate_operation_result.sh path/to/result.json <volumes|topology|snapshot|database|clone>
```

Same required fields, same rule that a populated `error` or a missing field is a hard failure.
An operator-run command is not more trustworthy than a wlmdb-run one — a pasted envelope that
does not validate is a failure, and `verified: true` still has to come from the script's own
output, never from the operator saying it worked.

## Rules that do not relax

- **Confirmation gate**: a mutating command is still gated by an explicit later-turn yes before
  you hand it over (see [confirmation-and-results.md](confirmation-and-results.md)). Handing the
  operator a `CREATE PLUGGABLE DATABASE` / `OPEN RESETLOGS` / FlexClone command **is** the
  mutating step for gating purposes.
- **You lose the mechanical gate, so the discipline is entirely yours.** `--apply` plus
  `CONFIRM=true` are enforced by `run_ssm_operation.sh`, which this route bypasses — nothing will
  refuse a premature mutating `send-command` on your behalf. Never hand over a mutating command
  in the same turn as the confirmation prompt.
- **Preflights first**: the read-only checks (mapped volumes, topology, `clone_target_preflight.sh`,
  version match) still run before any mutation, by this same manual route if needed. Every
  refusal still applies — RAC, Data Guard standby, `sidConflict`, `portInUse`, version mismatch.
- **Order still matters**: the clone sequence is unchanged — attach, bootstrap pfile/oratab,
  `PHASE=mount`, controlfile fix-up, `PHASE=open` (see [clone-recovery.md](clone-recovery.md)).
  Each is its own `send-command`; do not merge them because they are manual now.
- **Report the route**: say in the final answer that the operation ran via operator-run
  `aws ssm send-command` after a wlmdb permission failure, so the missing audit trail on the
  wlmdb side is visible.
