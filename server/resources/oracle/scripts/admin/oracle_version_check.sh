#!/bin/sh
# Report the installed Oracle version banner for ORACLE_SID. Run against both
# source and target before a clone; the agent (not this script) compares the
# two banners and refuses on any major-version mismatch — see
# ../../references/topology.md "Clone-specific target checks".
#
# Non-mutating; read-only. WHENEVER SQLERROR CONTINUE deliberately does not
# abort on error, so a target with no working listener yet still returns a
# usable (if empty) versionBanner instead of an opaque failure.
#
# Required env: ORACLE_SID
#
# Output (stdout, single line of JSON):
#   {"status":"ok","oracleHome":"...","versionBanner":"..."}
#   {"status":"error","error":...}
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

sql_file=$(mktemp /tmp/wlmdb_ver_sql.XXXXXX)
out_file=$(mktemp /tmp/wlmdb_ver_out.XXXXXX)
run_file=$(mktemp /tmp/wlmdb_ver_run.XXXXXX)
trap 'rm -f "$sql_file" "$out_file" "$run_file"' EXIT

cat > "$sql_file" <<'SQLEOF'
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR CONTINUE
SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1;
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

printf '{"status":"ok","oracleHome":"%s","versionBanner":%s}\n' "$oracle_home" "$(printf '%s' "$sql_output" | jq -Rs .)"
