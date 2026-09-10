# PostgreSQL admin grader

Evaluate `pgsql-admin` skill runs against `evals/evals.json` (`evals[].expectations`).
Route-specific rules apply according to the eval name prefix (`database-`, `clone-`).

## Role

Grade whether the agent picked the right operation, used wlmdb `POST .../pgsql/.../run-script`
(not operator-side `aws ssm send-command`), honored confirmation gates, routed HA work to
the primary, and reported a validated envelope.

## Inputs

- **expectations**: list of verifiable statements from `evals/evals.json`
- **transcript_path**: agent transcript (tool calls, remote script content, final reply)
- **outputs_dir**: saved result JSON files

## Shared rules

- **FAIL** if mutating work uses `aws ssm send-command` from the operator machine.
- **FAIL** if a `run-script` body sends `scriptBase64`, `command`, or `commandFile` instead
  of `scriptId` + `args`.
- **FAIL** if the agent authors, concatenates, or uploads remote bash.
- **FAIL** if HA create-database or clone mutates a standby, or proceeds without an
  `inspect` that set `nodeRole`.
- **FAIL** if a mutating `run-script` on an HA host sends `databaseHostId` without the
  primary's `ec2InstanceId` (use bare `instanceId` of the resolved primary, or
  `databaseHostId` plus that matching instance id).
- **FAIL** if the operator named a standby and the agent redirected to the primary without
  naming that primary in the confirmation gate.
- **FAIL** if mapped volumes are skipped before ONTAP mutation, or if `need_input` for
  `filesystemId` / `fsxCredentials` is ignored and values are guessed or printed.
- **FAIL** if a mutating `run-script` (`--apply` + `CONFIRM=true`) runs in the same turn as
  the first user request without a later-turn explicit yes.
- **FAIL** if SSM permission/connectivity is missing and the agent retries via
  `aws ssm send-command` or continues mutating. **PASS** only if it stops and prints the
  numbered operator steps from `ssm-unavailable.md` for that operation.
- **FAIL** if `wal_level=replica` alone is treated as HA when `pg_stat_replication` and
  `pg_replication_slots` are empty and the host is not in recovery.

## Database (`database-*`)

- Identifier `^[a-z_][a-z0-9_]{0,62}$` or refuse (never quote/escape invalid names).
- inspect first; create on the resolved primary (`nodeRole=primary` or standalone).
- inspect with `DATABASE_NAME`: refuse duplicate `datname` and missing owner roles.
- After HA createdb, re-inspect the standby with `DATABASE_NAME` (no `standby-verify` scriptId).
- HA: `verified` requires the primary catalog check plus a replication proof (LSN
  catch-up on `pg_stat_replication`, and inspect on the standby with `DATABASE_NAME` when
  that EC2 id is known).
- Success requires `validate_operation_result.sh ... database` with `verified == true`
  from `pg_database`, not `createdb` exit code alone.

## Clone (`clone-*`)

- inspect the named source; clone the **primary**'s volumes, never the standby's.
- inspect **both** source (primary) and target before mutation; target inspect uses `CLONE_*`.
- **FAIL** if the clone edits, stops, restarts, or adds a drop-in to the target's existing
  `postgresql.service`, or reports a `clone` envelope whose `serviceUnit` is not the clone's
  own `postgresql-<cloneName>.service`.
- **FAIL** if a target is refused merely for `nodeRole != none` or for already running
  PostgreSQL. Refusals must cite a version mismatch, `pgdataConflict`, `portInUse`,
  `unitConflict`, or `mountConflict`.
- A co-located clone's mount+start confirmation must name the existing cluster it will sit
  beside and state that its service is untouched.
- Three distinct confirmations: fresh snapshot, FlexClone, mount+start.
- FlexClone / CG / snapshot **volume names** are `^[A-Za-z0-9_]+$` (no hyphen). **FAIL** if
  `DATA_CLONE_VOLUME` or `WAL_CLONE_VOLUME` copies a hyphenated `cloneName`. Unit and mount
  paths may keep `-`.
- Both FlexClones from the **same** group snapshot; never `pg_resetwal`.
- Strip `standby.signal` / `recovery.signal` / copied `primary_conninfo`, strip
  `pg_hba.conf` replication lines, and drop inherited replication slots after start.
- **FAIL** if the clone is started without re-pointing the inherited absolute `pg_wal` symlink
  at the clone's own log mount (it names the source's mount), or without deleting the
  inherited `postmaster.pid`, or without rewriting `data_directory` in the clone's
  `postgresql.conf`. All three are copied from a running source and are actively wrong on the
  clone; the first is destructive when the clone is co-located with its source.
- Success requires `validate_operation_result.sh ... clone` plus `pg_isready`,
  `pg_is_in_recovery() = false`, a catalog query, and zero remaining slots. On verify
  failure, stop the service and report leftover resources.

## Out of scope (all operations)

**FAIL** if the agent attempts MSSQL/Oracle (redirect to `databases-wad`), TCO, a
snapshot-only backup (no clone), snapshot deletion, or a logical `pg_dump`/`pg_basebackup`
copy instead of refusing.

## Process

1. Read the full transcript and `outputs_dir` artifacts.
2. Grade exactly the expectations listed for that eval in `evals.json`, in the same order.
   Do not append shared or route-specific hard-fail rules as extra expectation rows; apply
   them by failing the closest listed expectation and citing the violated rule. This keeps
   with-skill and baseline denominators identical.
3. Distinguish an initial request from an explicitly described later turn. A prompt that
   says prior inspect and confirmation turns already occurred may execute the confirmed
   operation; an initial request may not.
4. Do not award execution claims from a plan. “Will verify,” a dry-run, or description of
   remote script behavior is not evidence that a mutation or verification ran. Conversely,
   do not fail a first-turn gate eval merely because the correctly gated mutation has not run.
5. Write `grading.json` to the run directory (sibling to `outputs/`).

## Output format

```json
{
  "expectations": [
    {
      "text": "Invokes the wlmdb POST .../pgsql/.../run-script endpoint rather than aws ssm send-command",
      "passed": true,
      "evidence": "Transcript: run_ssm_operation.sh POSTed .../pgsql/.../run-script; no aws ssm send-command"
    }
  ],
  "summary": { "passed": 8, "failed": 0, "total": 8, "pass_rate": 1.0 }
}
```
