#!/usr/bin/env bash

# Remote: createdb on the primary, catalog-verify, and (on HA) LSN replication proof.
# Envelope kind: database. Mutating. Only after the create-database confirmation.
# Args: DATABASE_NAME (required), OWNER (optional), DEPLOYMENT_TYPE (standalone|ha).
# Never interpolate an unvalidated identifier; DATABASE_NAME was regex-checked by the skill.
set -euo pipefail

# Refuse non-Workload Factory postgres layouts (pgpool node, missing WAL symlink).
if [[ -f /usr/local/etc/pgpool.conf ]] || systemctl cat pgpool >/dev/null 2>&1; then
    echo '{"status":"unsupported","reason":"host is a pgpool node, not a postgres data host"}'
    exit 0
fi
data_dir=$(sudo systemctl cat postgresql 2>/dev/null | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}' || true)
if [[ -z "$data_dir" ]]; then
    echo '{"status":"unsupported","reason":"PostgreSQL service or PGDATA not found"}'
    exit 0
fi
if [[ ! -L "$data_dir/pg_wal" ]]; then
    echo '{"status":"unsupported","reason":"pg_wal is not a symlink to a separate WAL volume"}'
    exit 0
fi
sudo pg_isready >/dev/null 2>&1 || {
    echo '{"status":"unsupported","reason":"PostgreSQL is not running"}'
    exit 0
}

databaseName="${DATABASE_NAME:?}"
owner="${OWNER:-}"

deployment_type="${DEPLOYMENT_TYPE:-standalone}"
if [[ -n "$owner" ]]; then
    sudo -u postgres createdb --owner="$owner" "$databaseName"
else
    sudo -u postgres createdb "$databaseName"
fi
verified_owner=$(sudo -u postgres psql -tAc "SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$databaseName'" | tr -d '[:space:]')
catalog_ok="false"
[[ -n "$verified_owner" ]] && catalog_ok="true"

create_lsn=$(sudo -u postgres psql -tAc "SELECT pg_current_wal_lsn();" 2>/dev/null | tr -d '[:space:]' || true)
replicated="false"
if [[ -n "$create_lsn" ]]; then
    replicated=$(sudo -u postgres psql -tAc "SELECT EXISTS (SELECT 1 FROM pg_stat_replication WHERE state = 'streaming' AND replay_lsn IS NOT NULL AND replay_lsn >= '$create_lsn'::pg_lsn);" 2>/dev/null | tr -d '[:space:]' || true)
    [[ "$replicated" == "t" ]] && replicated="true" || replicated="false"
fi

verified="$catalog_ok"
if [[ "$deployment_type" == "ha" ]]; then
    verified="false"
    [[ "$catalog_ok" == "true" && "$replicated" == "true" ]] && verified="true"
fi

printf '{"status":"ok","databaseName":"%s","owner":"%s","verified":%s,"replicated":%s,"standbyVerified":null}\n' \
    "$databaseName" "$verified_owner" "$verified" "$replicated"
