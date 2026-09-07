#!/bin/sh
# Create a Pluggable Database from PDB$SEED inside an already-running CDB and
# open it. Run only after topology_check.sh confirms isCDB=true and
# openMode="READ WRITE", and pdb_exists_check.sh confirms exists=false — see
# ../../references/database.md and ../../references/confirmation-and-results.md
# for the required preflight/confirmation sequence.
#
# Mutating. Written in POSIX sh; see topology_check.sh header for why.
#
# Required env: ORACLE_SID, PDB_NAME, PDB_ADMIN_USER, PDB_ADMIN_PASSWORD
#
# Output (stdout, single line of JSON):
#   {"status":"ok","pdbName":"...","adminUser":"...","openMode":"READWRITE","verified":true}
#   {"status":"error","error":...}  (e.g. ORA-65010 max PDBs — see database.md
#    for the Multitenant-licensing note; not something this script can fix)
set -eu

oracle_sid="${ORACLE_SID:?}"
pdb_name="${PDB_NAME:?}"
admin_user="${PDB_ADMIN_USER:?}"
admin_password="${PDB_ADMIN_PASSWORD:?}"


pdb_name=$(printf '%s' "$pdb_name" | tr '[:lower:]' '[:upper:]')
admin_user=$(printf '%s' "$admin_user" | tr '[:lower:]' '[:upper:]')

for identifier_name in pdb_name:"$pdb_name" admin_user:"$admin_user"; do
    value="${identifier_name#*:}"
    case "$value" in
        *[!A-Za-z0-9_]*)
            printf '{"status":"error","error":"%s must be alphanumeric/underscore only"}\n' "${identifier_name%%:*}"
            exit 0
            ;;
    esac
done

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

sql_file=$(mktemp /tmp/wlmdb_createpdb_sql.XXXXXX)
out_file=$(mktemp /tmp/wlmdb_createpdb_out.XXXXXX)
run_file=$(mktemp /tmp/wlmdb_createpdb_run.XXXXXX)
trap 'rm -f "$sql_file" "$out_file" "$run_file"' EXIT

cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR EXIT SQL.SQLCODE
CREATE PLUGGABLE DATABASE "$pdb_name" ADMIN USER "$admin_user" IDENTIFIED BY "$admin_password";
ALTER PLUGGABLE DATABASE "$pdb_name" OPEN;
SELECT OPEN_MODE FROM V\$PDBS WHERE NAME = '$pdb_name';
EXIT;
SQLEOF

{
    printf 'export ORACLE_SID=%s\n' "$oracle_sid"
    printf 'export ORACLE_HOME=%s\n' "$oracle_home"
    printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
    printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1\n' "$sql_file" "$out_file"
} > "$run_file"

# The SQL file carries PDB_ADMIN_PASSWORD in cleartext — restrict to the
# oracle user immediately, before sudo hands control to it.
chown oracle "$sql_file" "$out_file" 2>/dev/null || true
chmod 400 "$sql_file"
chmod 600 "$out_file"
chmod 644 "$run_file"

sudo -i -u oracle bash "$run_file" || true
sql_output=$(cat "$out_file")

if echo "$sql_output" | grep -q 'ORA-'; then
    printf '{"status":"error","error":%s}\n' "$(echo "$sql_output" | grep -o 'ORA-[0-9]*.*' | head -1 | jq -Rs .)"
    exit 0
fi

open_mode=$(echo "$sql_output" | tr -d '[:space:]')
verified="false"
[ "$open_mode" = "READWRITE" ] && verified="true"

printf '{"status":"ok","pdbName":"%s","adminUser":"%s","openMode":"%s","verified":%s}\n' \
    "$pdb_name" "$admin_user" "$open_mode" "$verified"
