#!/bin/sh
# Confirm ORACLE_SID is a single-instance, PRIMARY-role database (no RAC, no
# Data Guard standby) before any snapshot/PDB/clone operation proceeds, and
# report whether that PRIMARY is a Data Guard member.
#
# A Data Guard PRIMARY is a supported snapshot/clone source and reports
# deploymentType="dataguard-primary" with status="ok"; only a non-PRIMARY role is
# refused outright. PDB creation still requires deploymentType="standalone",
# because CREATE PLUGGABLE DATABASE propagates to the standby.
#
# Written in POSIX sh (not bash) and avoids nested heredocs inside command
# substitution: SSM's AWS-RunShellScript wrapper prepends `export ...` lines
# ahead of the script body, which pushes any `#!/bin/bash` shebang off line 1
# and can make the runtime fall back to `sh`/`dash`. A `<<EOF` nested inside
# `$(...)` is a bash-only construct and fails there with a bare
# "syntax error near unexpected token '<'". Using temp files instead of
# nested heredocs keeps this portable across sh/dash/bash.
#
# Non-mutating; read-only. Run via ../build_run_script_payload.sh.
#
# Required env: ORACLE_SID
# Optional env: PROTOCOL (echoed back into the envelope; default NFS)
#
# Output (stdout, single line of JSON):
#   {"status":"ok","reason":null,"oracleHome":...,
#    "deploymentType":"standalone"|"dataguard-primary"|"dataguard-standby"|"rac"|"unknown",
#    "databaseRole":"PRIMARY","dataGuardConfigured":bool|null,"standbyDestCount":N|null,
#    "isCDB":bool,"openMode":...,"protocol":...}
#   {"status":"unsupported","reason":"...RAC..."|"...Data Guard..."}
#   {"status":"error","error":...}
#
# dataGuardConfigured/standbyDestCount are null when the Data Guard probe could not
# answer — null means unknown, NOT "no Data Guard". That case reports
# deploymentType="unknown" so a caller gating on "standalone" fails safe instead of
# treating an unprobed Data Guard primary as a plain standalone database.
#
# See ../../references/topology.md for the refusal rules callers must apply
# to this envelope (RAC, Data Guard, non-CDB PDB requests, etc).
set -eu

oracle_sid="${ORACLE_SID:?}"

oracle_home=""
if [ -f /etc/oratab ]; then
    while IFS=: read -r sid home rest; do
        case "$sid" in
            \#*|+*) continue ;;
        esac
        if [ "$sid" = "$oracle_sid" ]; then
            oracle_home="$home"
            break
        fi
    done < /etc/oratab
fi
if [ -z "$oracle_home" ]; then
    printf '{"status":"error","error":"SID %s not found in /etc/oratab"}\n' "$oracle_sid"
    exit 0
fi

sql_file=$(mktemp /tmp/wlmdb_topology_sql.XXXXXX)
out_file=$(mktemp /tmp/wlmdb_topology_out.XXXXXX)
run_file=$(mktemp /tmp/wlmdb_topology_run.XXXXXX)
dg_sql_file=$(mktemp /tmp/wlmdb_topology_dgsql.XXXXXX)
dg_out_file=$(mktemp /tmp/wlmdb_topology_dgout.XXXXXX)
trap 'rm -f "$sql_file" "$out_file" "$run_file" "$dg_sql_file" "$dg_out_file"' EXIT

cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR EXIT SQL.SQLCODE
SELECT 'OPEN_MODE=' || OPEN_MODE || '|CDB=' || CDB || '|ROLE=' || DATABASE_ROLE || '|RAC=' || (SELECT CASE WHEN UPPER(VALUE)='TRUE' THEN 'true' ELSE 'false' END FROM v\$parameter WHERE NAME='cluster_database' AND ROWNUM=1) FROM v\$database;
EXIT;
SQLEOF

# Data Guard probe runs as its OWN sqlplus call against its own output file. v\$archive_dest_status
# and the dg_broker_start/log_archive_config parameters are not uniformly queryable across
# versions/editions, and an ORA- from this probe must not turn a healthy topology check into an
# error envelope — a failure here degrades to dataGuardConfigured:null, never to a false refusal.
cat > "$dg_sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
SELECT 'DGBROKER=' || NVL(UPPER((SELECT VALUE FROM v\$parameter WHERE NAME='dg_broker_start' AND ROWNUM=1)),'FALSE') || '|DGCONFIG=' || (CASE WHEN NVL(LENGTH(TRIM((SELECT VALUE FROM v\$parameter WHERE NAME='log_archive_config' AND ROWNUM=1))),0) > 0 THEN 'true' ELSE 'false' END) || '|STANDBYS=' || TO_CHAR((SELECT COUNT(*) FROM v\$archive_dest_status WHERE TARGET='STANDBY' AND STATUS <> 'INACTIVE')) FROM DUAL;
EXIT;
SQLEOF

{
    printf 'export ORACLE_SID=%s\n' "$oracle_sid"
    printf 'export ORACLE_HOME=%s\n' "$oracle_home"
    printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
    printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1\n' "$sql_file" "$out_file"
    printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1 || true\n' "$dg_sql_file" "$dg_out_file"
} > "$run_file"
chmod 644 "$sql_file" "$dg_sql_file" "$run_file"
chmod 666 "$out_file" "$dg_out_file"

sudo -i -u oracle bash "$run_file" || true
sql_output=$(cat "$out_file")

if echo "$sql_output" | grep -q 'ORA-'; then
    printf '{"status":"error","error":%s}\n' "$(echo "$sql_output" | grep -o 'ORA-[0-9]*.*' | head -1 | jq -Rs .)"
    exit 0
fi

open_mode=$(echo "$sql_output" | grep -oP 'OPEN_MODE=\K[^|]+' || true)
is_cdb=$(echo "$sql_output" | grep -oP 'CDB=\K[^|]+' || true)
db_role=$(echo "$sql_output" | grep -oP 'ROLE=\K[^|]+' || true)
is_rac=$(echo "$sql_output" | grep -oP 'RAC=\K.+' || true)

if [ -z "$open_mode" ] || [ -z "$db_role" ]; then
    printf '{"status":"error","error":%s}\n' "$(printf '%s' "$sql_output" | jq -Rs .)"
    exit 0
fi

status="ok"
reason="null"
if [ "$is_rac" = "true" ]; then
    status="unsupported"; reason='"cluster_database=TRUE indicates RAC — single-instance only"'
elif [ "$db_role" != "PRIMARY" ]; then
    status="unsupported"; reason='"database_role is not PRIMARY — Data Guard standby is refused"'
fi

is_cdb_bool="false"
[ "$is_cdb" = "YES" ] && is_cdb_bool="true"

# A PRIMARY that ships redo is still a Data Guard member. It is a supported snapshot/clone
# source (see ../../references/topology.md), but the caller has to know, so surface it rather
# than reporting a bare "standalone". null means the probe could not answer, not "no Data Guard".
dg_output=$(cat "$dg_out_file" 2>/dev/null || true)
dg_broker=$(echo "$dg_output" | grep -oP 'DGBROKER=\K[^|]+' | head -1 || true)
dg_config=$(echo "$dg_output" | grep -oP 'DGCONFIG=\K[^|]+' | head -1 || true)
standby_count=$(echo "$dg_output" | grep -oP 'STANDBYS=\K[0-9]+' | head -1 || true)

data_guard_configured="null"
standby_count_json="null"
if [ -n "$dg_config" ] && [ -n "$dg_broker" ]; then
    standby_count_json="${standby_count:-0}"
    if [ "$dg_config" = "true" ] || [ "$dg_broker" = "TRUE" ] || [ "${standby_count:-0}" -gt 0 ]; then
        data_guard_configured="true"
    else
        data_guard_configured="false"
    fi
fi

# deploymentType must never over-claim "standalone": callers gate PDB creation on it, and an
# unknown probe result has to fail safe. Ordered most- to least-specific.
if [ "$is_rac" = "true" ]; then
    deployment_type="rac"
elif [ "$db_role" != "PRIMARY" ]; then
    deployment_type="dataguard-standby"
elif [ "$data_guard_configured" = "true" ]; then
    deployment_type="dataguard-primary"
elif [ "$data_guard_configured" = "null" ]; then
    deployment_type="unknown"
else
    deployment_type="standalone"
fi

printf '{"status":"%s","reason":%s,"oracleHome":"%s","deploymentType":"%s","databaseRole":"%s","dataGuardConfigured":%s,"standbyDestCount":%s,"isCDB":%s,"openMode":"%s","protocol":"%s"}\n' \
    "$status" "$reason" "$oracle_home" "$deployment_type" "$db_role" "$data_guard_configured" \
    "$standby_count_json" "$is_cdb_bool" "$open_mode" "${PROTOCOL:-NFS}"
