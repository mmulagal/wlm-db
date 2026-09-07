#!/bin/sh
# Refuse a clone target before any mutating step: never mount a clone over an
# active ORACLE_HOME/datafile path, and never bind its listener to a port
# already in use.
#
# Run against targetInstanceId. Non-mutating; read-only.
#
# Required env: CLONE_SID, CLONE_PORT
#
# Output (stdout, single line of JSON):
#   {"status":"ok","cloneSid":"...","sidConflict":bool,"clonePort":N,"portInUse":bool}
#
# Caller must refuse (per ../../references/topology.md "Clone-specific target
# checks") when sidConflict=true or portInUse=true.
set -eu

clone_sid="${CLONE_SID:?}"
clone_port="${CLONE_PORT:?}"

sid_conflict="false"
if [ -f /etc/oratab ]; then
    while IFS=: read -r sid home rest; do
        case "$sid" in
            \#*|+*) continue ;;
        esac
        if [ "$sid" = "$clone_sid" ]; then
            sid_conflict="true"
            break
        fi
    done < /etc/oratab
fi

port_in_use="false"
if (sudo ss -ltn 2>/dev/null || sudo netstat -ltn 2>/dev/null) | grep -qE "[:.]${clone_port}[[:space:]]"; then
    port_in_use="true"
fi

printf '{"status":"ok","cloneSid":"%s","sidConflict":%s,"clonePort":%s,"portInUse":%s}\n' \
    "$clone_sid" "$sid_conflict" "$clone_port" "$port_in_use"
