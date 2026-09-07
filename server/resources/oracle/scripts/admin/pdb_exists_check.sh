#!/bin/sh
# Preflight check: does PDB_NAME already exist in this CDB? Run before
# create_pdb.sh so a name collision surfaces as a clean envelope instead of
# an ORA-65012 mid-creation.
#
# V$PDBS' name column is NAME, not PDB_NAME — the latter doesn't exist and
# raises ORA-00904. Written in POSIX sh; see topology_check.sh header for why
# (SSM heredoc/shebang portability).
#
# Non-mutating; read-only.
#
# Required env: ORACLE_SID, PDB_NAME
#
# Output (stdout, single line of JSON):
#   {"status":"ok","exists":bool,"pdbName":"..."}
#   {"status":"error","error":...}
set -eu

oracle_sid="${ORACLE_SID:?}"
pdb_name="${PDB_NAME:?}"

pdb_name=$(printf '%s' "$pdb_name" | tr '[:lower:]' '[:upper:]')

case "$pdb_name" in
    *[!A-Za-z0-9_]*)
        printf '{"status":"error","error":"PDB_NAME must be alphanumeric/underscore only"}\n'
        exit 0
        ;;
esac

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

sql_file=$(mktemp /tmp/wlmdb_pdbcheck_sql.XXXXXX)
out_file=$(mktemp /tmp/wlmdb_pdbcheck_out.XXXXXX)
run_file=$(mktemp /tmp/wlmdb_pdbcheck_run.XXXXXX)
trap 'rm -f "$sql_file" "$out_file" "$run_file"' EXIT

cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR EXIT SQL.SQLCODE
SELECT COUNT(*) FROM V\$PDBS WHERE NAME = '$pdb_name';
EXIT;
SQLEOF

{
    printf 'export ORACLE_SID=%s\n' "$oracle_sid"
    printf 'export ORACLE_HOME=%s\n' "$oracle_home"
    printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
    printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1\n' "$sql_file" "$out_file"
} > "$run_file"
chmod 644 "$sql_file" "$run_file"
chmod 666 "$out_file"

sudo -i -u oracle bash "$run_file" || true
sql_output=$(cat "$out_file")

if echo "$sql_output" | grep -q 'ORA-'; then
    printf '{"status":"error","error":%s}\n' "$(echo "$sql_output" | grep -o 'ORA-[0-9]*.*' | head -1 | jq -Rs .)"
    exit 0
fi

count=$(echo "$sql_output" | tr -d '[:space:]')
case "$count" in
    ''|*[!0-9]*)
        printf '{"status":"error","error":%s}\n' "$(printf '%s' "$sql_output" | jq -Rs .)"
        exit 0
        ;;
esac

if [ "$count" -eq 0 ]; then
    printf '{"status":"ok","exists":false,"pdbName":"%s"}\n' "$pdb_name"
else
    printf '{"status":"ok","exists":true,"pdbName":"%s"}\n' "$pdb_name"
fi
