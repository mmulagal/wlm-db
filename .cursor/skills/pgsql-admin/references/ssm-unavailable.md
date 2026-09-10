# Manual steps when Workload Factory SSM is unavailable

The skill automates via wlmdb `POST .../pgsql/.../run-script` (SSM `AWS-RunShellScript`
on the EC2). If that path cannot run, **stop automating**. Do not retry with
`aws ssm send-command` from the operator machine, and do not guess ONTAP or host state.

Print the matching numbered list below (fill in any IDs already known). The operator
completes the work over SSH, EC2 Instance Connect, AWS console Session Manager, and/or
FSx / ONTAP System Manager.

## When this applies

Treat the first failed `run-script` as SSM-unavailable when the HTTP status is 401/403,
or the body/message mentions any of: `AccessDenied`, `AccessDeniedException`,
`UnauthorizedOperation`, `InvalidInstanceId`, `TargetNotConnected`, `UnrecognizedClientException`,
or that the instance is not in a valid state to receive commands.

This is **not** `status=need_input` for `filesystemId` / `fsxCredentials` (that is a
missing Parameter Store entry — ask and re-run `inspect`).

## Create database

`CREATE DATABASE` uses the **existing** cluster on the **primary**. It does **not** provision
new ONTAP volumes (unlike an Oracle create-database on new disks). The new database lives on
the already-mounted `PGDATA` / WAL volumes and, on HA, arrives on the standby over WAL.

1. Identify the **primary**. If the host you can reach is a standby (`pg_is_in_recovery()`
   is `t`, or `PGDATA/standby.signal` exists), get a shell on the primary instead — do not
   run `createdb` on a standby.
2. Get a shell on the primary EC2 (`sourceInstanceId` of the primary, or the primary
   behind `databaseHostId`) via SSH, EC2 Instance Connect, or AWS console Session Manager.
3. Confirm the service is up: `sudo systemctl is-active postgresql` and
   `sudo -u postgres pg_isready`. Confirm `SELECT pg_is_in_recovery();` is `f`.
4. Confirm the existing FSx data and WAL volumes are mounted (`findmnt` on `PGDATA` and
   the `pg_wal` target). Do not create or remount volumes for this operation.
5. Preflight the name `^[a-z_][a-z0-9_]{0,62}$`. Refuse rather than quote an invalid name.
6. Confirm the database does not already exist:
   `sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '<databaseName>'"`.
7. If an owner was requested, confirm that role exists in `pg_roles`. Do not fall back to
   a different owner.
8. Create it under the `postgres` OS account:
   `sudo -u postgres createdb --owner='<owner>' '<databaseName>'`
   (omit `--owner` when using the cluster default).
9. Verify from the catalog, not from `createdb`'s exit code:
   `sudo -u postgres psql -tAc "SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname = '<databaseName>'"`.
10. On HA, confirm the standby replayed it: `pg_stat_replication` shows `streaming` with
    `replay_lsn` at or past `pg_current_wal_lsn()`, and if you have a shell on the standby,
    `SELECT 1 FROM pg_database WHERE datname = '<databaseName>'`.

## Clone (FlexClone + running instance)

A clone is two new ONTAP volumes (data + WAL) from one crash-consistent snapshot of the
**primary**, mounted on the **target** host, then PostgreSQL started there. Both volumes
must come from the **same** group snapshot. Do not clone from a standby's volumes. The
target may already run PostgreSQL — including an HA node, or the source host itself — because
the clone gets its own mount paths, port, and `postgresql-<cloneName>.service` unit.

1. Identify the **primary** source (not a standby). Get a shell on the **source primary**
   and a shell on the **target** host (SSH / Instance Connect / AWS console Session Manager).
   Confirm the target has no active `PGDATA` at the planned mount path, that `clonePort` is
   free (`ss -ltn "sport = :<clonePort>"`), that no `postgresql-<cloneName>.service` already
   exists, and that neither clone mount path is already mounted. A PostgreSQL already running
   on the target is fine — the clone gets its own unit and port.
2. On the source **primary**, identify the existing data and WAL volume names (NFS mounts on `PGDATA`
   and the `pg_wal` symlink target). Note `filesystemId`, SVM, and region.
3. In FSx / ONTAP System Manager, create or reuse a consistency group whose members are
   **exactly** those two volumes — do not add unrelated volumes.
4. Create a **crash-consistent** consistency-group snapshot (not application-consistent;
   do not run `pg_backup_start` / quiesce). Record the group snapshot and each member
   snapshot name.
5. Create two FlexClone volumes from that same group snapshot — data clone from the data
   member snapshot, WAL clone from the WAL member snapshot. Never mix snapshots.
6. On the target, create mount dirs (e.g. `/pgdata-clone-<cloneName>` and
   `/pglog-clone-<cloneName>`), mount both clones over NFSv4 with
   `rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144`, append matching
   `/etc/fstab` lines if missing, and `chown -R postgres:postgres` the mounts.
7. Strip clone-unsafe replication files: delete `standby.signal` and `recovery.signal`;
   remove `primary_conninfo` / `primary_slot_name` from `postgresql.auto.conf`; delete
   `host replication` / `hostssl replication` lines from `pg_hba.conf`. Never run
   `pg_resetwal`. Then two clone-specific fixes that are easy to miss:
   - Re-point `pg_wal`: it is an **absolute** symlink to the *source's* log mount. Replace it
     with a link to `<clone log mount>/pg_wal` and confirm `readlink -f` lands inside that
     mount. Left alone on a host that also runs the source, the clone writes WAL into the live
     cluster's `pg_wal`.
   - Delete the inherited `postmaster.pid`; the PID it names may still be alive on this host,
     and PostgreSQL refuses to start against a lock file naming a live process.
8. Configure the clone: set `data_directory`, `log_directory`, `port`, and `cluster_name` in
   the clone's own `postgresql.conf` (inside the cloned data volume).
9. Give the clone its **own** service. Copy the host's packaged unit
   (`systemctl show -p FragmentPath --value postgresql`) to
   `/etc/systemd/system/postgresql-<cloneName>.service`, set `Environment=PGDATA=` to the
   clone's data mount, delete the `ExecStartPre=...check-db-dir` line, add a drop-in with
   `RequiresMountsFor=` for both mounts, then `systemctl daemon-reload`. Never edit,
   restart, or add a drop-in to the host's own `postgresql.service` — on a host that is
   already serving a database, that takes the existing cluster down.
10. `sudo systemctl start postgresql-<cloneName>`. Then drop inherited replication slots:
    `SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots;` — leftover
    slots pin WAL until the clone volume fills.
11. Verify: `pg_isready -p <clonePort>`, `SELECT pg_is_in_recovery();` is `f`,
    `SELECT 1` succeeds, and `SELECT count(*) FROM pg_replication_slots` is `0`. If any
    check fails, `systemctl stop postgresql-<cloneName>`, leave the FlexClone volumes and
    mounts in place, and inspect — do not force recovery.
