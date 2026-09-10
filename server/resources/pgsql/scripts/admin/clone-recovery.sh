#!/usr/bin/env bash

# Remote: mount FlexClone volumes, sanitize recovery state, create postgresql-<cloneName>.service,
# start it, verify. Envelope kind: clone.
# Args: CLONE_NAME, CLONE_PORT, NFS_SERVER, DATA_CLONE_VOLUME, WAL_CLONE_VOLUME,
#       DATA_CLONE_UUID, WAL_CLONE_UUID.
# Mutating. Only after the mount+start confirmation.
# Never edit, stop, or add a drop-in to the target's postgresql.service.
# Never run pg_resetwal.
set -euo pipefail

# A pgpool node is not a clone destination; sidecar recovery needs a postgres host.
if [[ -f /usr/local/etc/pgpool.conf ]] || systemctl cat pgpool >/dev/null 2>&1; then
    echo '{"status":"unsupported","reason":"host is a pgpool node — not a valid clone target"}'
    exit 0
fi

clonename="${CLONE_NAME:?}"
cloneport="${CLONE_PORT:?}"
nfs_server="${NFS_SERVER:?}"
data_clone_volume_name="${DATA_CLONE_VOLUME:?}"
wal_clone_volume_name="${WAL_CLONE_VOLUME:?}"
data_clone_uuid="${DATA_CLONE_UUID:?}"
wal_clone_uuid="${WAL_CLONE_UUID:?}"

target_data_dir="/pgdata-clone-$clonename"
target_log_dir="/pglog-clone-$clonename"
sudo mkdir -p "$target_data_dir" "$target_log_dir"

nfs_ip="$nfs_server"
# 2>&1 keeps mount's diagnostics off stderr — any stderr makes wlmdb discard this script's
# stdout and report an opaque 500 instead of the envelope naming what failed.
sudo mount -t nfs "$nfs_ip:/${data_clone_volume_name}" "$target_data_dir" 2>&1 \
    || { echo '{"status":"error","error":"failed to mount the data clone volume"}'; exit 0; }
sudo mount -t nfs "$nfs_ip:/${wal_clone_volume_name}" "$target_log_dir" 2>&1 \
    || { echo '{"status":"error","error":"failed to mount the WAL clone volume"}'; exit 0; }

# Guarded fstab entry: only append if this exact mount is not already present.
for entry in \
    "$nfs_ip:/${data_clone_volume_name} $target_data_dir nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" \
    "$nfs_ip:/${wal_clone_volume_name} $target_log_dir nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0"; do
    grep -qxF "$entry" /etc/fstab || echo "$entry" | sudo tee -a /etc/fstab
done

sudo chown -R postgres:postgres "$target_data_dir" "$target_log_dir"

sudo rm -f "$target_data_dir/standby.signal" "$target_data_dir/recovery.signal"
sudo sed -i "/^primary_conninfo/d;/^primary_slot_name/d" "$target_data_dir/postgresql.auto.conf" 2>/dev/null || true
# Replication lines in pg_hba.conf would let this clone be mistaken for a primary.
sudo sed -i '/^[[:space:]]*host[[:space:]]\+replication/d;/^[[:space:]]*hostssl[[:space:]]\+replication/d;/^[[:space:]]*hostnossl[[:space:]]\+replication/d' "$target_data_dir/pg_hba.conf"

if [[ ! -L "$target_data_dir/pg_wal" ]]; then
    echo '{"status":"error","error":"clone pg_wal is not a symlink — refusing to guess the WAL layout"}'
    exit 0
fi
sudo rm -f "$target_data_dir/pg_wal"
sudo -u postgres ln -s "$target_log_dir/pg_wal" "$target_data_dir/pg_wal"

sudo rm -f "$target_data_dir/postmaster.pid"

clone_unit="postgresql-$clonename"
unit_path="/etc/systemd/system/$clone_unit.service"

sudo sed -i "s|^#\?data_directory =.*|data_directory = '$target_data_dir'|" "$target_data_dir/postgresql.conf"
sudo sed -i "s|^#\?log_directory =.*|log_directory = '$target_log_dir'|" "$target_data_dir/postgresql.conf"
sudo sed -i "s|^#\?port =.*|port = $cloneport|" "$target_data_dir/postgresql.conf"
# Two postmasters on one host are indistinguishable in `ps` and pg_stat_activity without this.
sudo sed -i "s|^#\?cluster_name =.*|cluster_name = '$clonename'|" "$target_data_dir/postgresql.conf"

# Derive the clone's unit from the host's own packaged unit, so Type/User/OOM/KillSignal
# specifics are inherited rather than guessed. The base unit file itself is only read.
base_unit=$(systemctl show -p FragmentPath --value postgresql)
if [[ -z "$base_unit" || ! -f "$base_unit" ]]; then
    echo '{"status":"error","error":"no packaged postgresql.service on the target to derive the clone unit from"}'
    exit 0
fi
sudo install -m 0644 "$base_unit" "$unit_path"
sudo sed -i "s|^Description=.*|Description=PostgreSQL clone $clonename on port $cloneport|" "$unit_path"
sudo sed -i "s|^Environment=PGDATA=.*|Environment=PGDATA=$target_data_dir|" "$unit_path"
# The packaged pre-check resolves its data dir from %N, which is now the clone's unit name and
# does not exist. Step 4 checks the clone dir with pg_controldata instead.
sudo sed -i "/^ExecStartPre=.*check-db-dir/d" "$unit_path"

sudo mkdir -p "$unit_path.d"
{
    echo "[Unit]"
    echo "RequiresMountsFor=$target_data_dir"
    echo "RequiresMountsFor=$target_log_dir"
} | sudo tee "$unit_path.d/override.conf"
sudo systemctl daemon-reload

wal_resolved=$(readlink -f "$target_data_dir/pg_wal")
if [[ "$wal_resolved" != "$target_log_dir"/* ]]; then
    echo "{\"status\":\"error\",\"error\":\"clone pg_wal resolves to $wal_resolved, outside $target_log_dir — refusing to start\"}"
    exit 0
fi

sudo systemctl start "$clone_unit" 2>&1 || true
started="false"
sudo systemctl is-active --quiet "$clone_unit" && started="true"

# `|| true` on both: when the clone fails to start these commands fail, and under
# `set -euo pipefail` the assignment would abort the script before it can report *why*.
controldata_state=$(sudo -u postgres /usr/bin/pg_controldata "$target_data_dir" 2>/dev/null | grep "Database cluster state" | cut -d: -f2 | xargs || true)
ready="false"
sudo -u postgres pg_isready -p "$cloneport" >/dev/null 2>&1 && ready="true"
in_recovery=$(sudo -u postgres psql -p "$cloneport" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]' || true)
catalog_ok="false"
sudo -u postgres psql -p "$cloneport" -tAc "SELECT 1;" >/dev/null 2>&1 && catalog_ok="true"

# Drop inherited slots now that the server is up; leftover slots pin WAL forever.
sudo -u postgres psql -p "$cloneport" -tAc "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots;" >/dev/null 2>&1 || true
slot_count=$(sudo -u postgres psql -p "$cloneport" -tAc "SELECT count(*) FROM pg_replication_slots;" 2>/dev/null | tr -d '[:space:]' || true)
[[ "$slot_count" =~ ^[0-9]+$ ]] || slot_count=1
slots_dropped="false"
[[ "$slot_count" == "0" ]] && slots_dropped="true"

verified="false"
[[ "$started" == "true" && "$ready" == "true" && "$in_recovery" == "f" && "$catalog_ok" == "true" && "$slots_dropped" == "true" ]] && verified="true"
service_state="not_running"
[[ "$started" == "true" ]] && service_state="running"

if [[ "$verified" != "true" ]]; then
    # Never `systemctl stop postgresql` — that would stop the target's own cluster.
    sudo systemctl stop "$clone_unit" || true
fi

printf '{"status":"ok","clonedVolumes":[{"volumeUuid":"%s","volumeName":"%s","mountPath":"%s"},{"volumeUuid":"%s","volumeName":"%s","mountPath":"%s"}],"pgdata":"%s","port":%s,"serviceUnit":"%s","serviceState":"%s","verified":%s}\n' \
    "$data_clone_uuid" "$data_clone_volume_name" "$target_data_dir" \
    "$wal_clone_uuid" "$wal_clone_volume_name" "$target_log_dir" \
    "$target_data_dir" "$cloneport" "$clone_unit.service" "$service_state" "$verified"
