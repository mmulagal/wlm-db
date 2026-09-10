# PostgreSQL Create Database

One database on a standalone host or the **primary** of streaming-replication HA, using the
existing cluster — no new ONTAP volumes. Name plus optional existing owner; cluster defaults
for template/encoding/locale/tablespace.

Prerequisite: [confirmation-and-results.md](confirmation-and-results.md) — auth, inspect,
primary resolution, volume confirmation, envelope and failure rules. Not repeated here.

## Workflow

```
- [ ] 1. inspect the named host with DATABASE_NAME (and OWNER if given) → resolve primary
- [ ] 2. validate topology + volumes; confirm the volume list
- [ ] 3. refuse per the table below, or confirm create database
- [ ] 4. scriptId createdb on the primary (CONFIRM=true --apply)
- [ ] 5. if HA and the standby EC2 id is known: read-only inspect of the standby
- [ ] 6. validate database envelope; report
```

If `run-script` fails because SSM permission or connectivity is missing, stop and print the
numbered **Create database** steps in [ssm-unavailable.md](ssm-unavailable.md).

## Inputs

| Input | Rule |
|---|---|
| `databaseName` | `^[a-z_][a-z0-9_]{0,62}$` — refuse, do not quote or sanitize |
| `owner` | optional; same regex; the role must already exist |

The host must already run PostgreSQL — this flow never provisions a host.

## Refusals

After validating `topology` and `volumes`, each refusal names its next step:

| Check | Tell the operator |
|---|---|
| `serviceState != "running"` | envelope `reason`; stop |
| HA and not primary | instance + role; retry on the primary or supply the peer id |
| `alreadyExists == true` | the existing name; pick another — never drop/recreate |
| `ownerExists == false` | the missing role; create it or pick another — never default the owner |
| name fails the regex | quote the pattern; ask for a valid lowercase identifier |

Do not trust volumes from a standby inspect.

## `createdb`

```
{ "region": "...", "instanceId": "i-...", "comment": "pgsql createdb",
  "scriptId": "createdb",
  "args": { "DATABASE_NAME": "...", "OWNER": "...", "DEPLOYMENT_TYPE": "standalone" } }
```

`DEPLOYMENT_TYPE` is `standalone` or `ha` (the remote script applies the HA verify rule).
Omit `OWNER` for the cluster default. These three keys are the only ones accepted — volume
keys 400.

## Verification

```bash
../scripts/validate_operation_result.sh path/to/result.json database
```

`verified != true` is failure — not the `createdb` exit code.

On HA with a known standby id, run a read-only inspect there with `DATABASE_NAME`;
`alreadyExists != true` is a hard failure even when the primary envelope reported
`replicated: true`. When the standby id is unknown, `replicated: true` is sufficient — say
the standby was not queried. On standalone, `verified` is catalog-only.

## Answer

1. **Source** — primary `instanceId` (and `databaseHostId` if standalone inventory);
   routed-from if the operator named a standby.
2. **Database** — name and owner from the envelope; "cluster defaults" for
   template/encoding/locale.
3. **Verification** — catalog result, and on HA whether the standby was inspected.
