#!/bin/sh
# Make a freshly attached clone startable: write $ORACLE_HOME/dbs/init<CLONE_SID>.ora
# pointing at the clone's OWN controlfile copies, and register CLONE_SID in /etc/oratab.
# Without this, STARTUP MOUNT for a brand-new CLONE_SID fails at ORA-01078/LRM-00109 —
# the source's spfile lives in the source host's $ORACLE_HOME/dbs, not on the cloned
# volumes, so nothing on the target defines the instance.
#
# Run on targetInstanceId AFTER the attach step (clone_attach_nfs.sh or the iSCSI/ASM
# equivalent) and BEFORE clone_start_resetlogs.sh PHASE=mount — see
# ../../references/clone-recovery.md.
#
# Mutating (writes a parameter file and appends to /etc/oratab). Written in POSIX sh;
# see topology_check.sh header for why.
#
# Required env: CLONE_SID, CLONE_ORACLE_HOME,
#               SOURCE_DB_NAME — the SOURCE database's db_name, NOT CLONE_SID. It is baked
#                 into the cloned controlfile, and a mismatch is ORA-01103 at mount. Renaming
#                 it needs DBNEWID/nid, which is out of scope for this skill.
#               CONTROL_FILES — comma-separated paths to the clone's controlfile copies,
#                 under the NEW mount paths reported by the attach step
# Optional env: IS_CDB=true (adds enable_pluggable_database, required for a CDB source),
#               DB_BLOCK_SIZE (must match the source; wrong value fails at open),
#               SGA_TARGET, PGA_AGGREGATE_TARGET, UNDO_TABLESPACE,
#               ARCHIVE_LOG_DEST (clone's own archive mount; never the source's),
#               DIAGNOSTIC_DEST, COMPATIBLE
#
# Output (stdout, single line of JSON):
#   {"status":"ok","cloneSid":...,"pfilePath":...,"controlFiles":[...],
#    "oratabRegistered":bool,"parameters":{...}}
#   {"status":"error","error":...}
set -eu

clone_sid="${CLONE_SID:?}"
clone_oracle_home="${CLONE_ORACLE_HOME:?}"
source_db_name="${SOURCE_DB_NAME:?}"
control_files="${CONTROL_FILES:?}"

case "$clone_sid" in
    *[!A-Za-z0-9_]*)
        printf '{"status":"error","error":"CLONE_SID must be alphanumeric/underscore only"}\n'
        exit 0
        ;;
esac
case "$source_db_name" in
    *[!A-Za-z0-9_]*)
        printf '{"status":"error","error":"SOURCE_DB_NAME must be alphanumeric/underscore only"}\n'
        exit 0
        ;;
esac
if [ ! -d "$clone_oracle_home" ]; then
    printf '{"status":"error","error":"CLONE_ORACLE_HOME %s does not exist on this host"}\n' "$clone_oracle_home"
    exit 0
fi

# Every listed controlfile must already exist — an absent one means the attach step did not
# mount the CONTROL_FILES clone volume, and mounting against it would fail later anyway.
control_files_quoted=""
control_files_json=""
old_ifs="$IFS"
IFS=,
for cf in $control_files; do
    IFS="$old_ifs"
    if [ -z "$cf" ]; then
        continue
    fi
    if [ ! -f "$cf" ]; then
        printf '{"status":"error","error":"controlfile %s not found — is the CONTROL_FILES clone volume attached?"}\n' "$cf"
        exit 0
    fi
    if [ -n "$control_files_quoted" ]; then
        control_files_quoted="${control_files_quoted}, "
        control_files_json="${control_files_json},"
    fi
    control_files_quoted="${control_files_quoted}'${cf}'"
    control_files_json="${control_files_json}$(printf '%s' "$cf" | jq -Rs .)"
    IFS=,
done
IFS="$old_ifs"

if [ -z "$control_files_quoted" ]; then
    printf '{"status":"error","error":"CONTROL_FILES resolved to no paths"}\n'
    exit 0
fi

pfile_path="${clone_oracle_home}/dbs/init${clone_sid}.ora"
if [ -e "$pfile_path" ]; then
    printf '{"status":"error","error":"%s already exists — refusing to overwrite an existing parameter file"}\n' "$pfile_path"
    exit 0
fi

# db_name is the SOURCE's, deliberately: it must match the cloned controlfile. db_unique_name
# carries the clone's identity instead, which is what keeps it distinguishable from the source.
{
    printf "*.db_name='%s'\n" "$source_db_name"
    printf "*.db_unique_name='%s'\n" "$clone_sid"
    printf "*.control_files=%s\n" "$control_files_quoted"
    [ "${IS_CDB:-}" = "true" ] && printf "*.enable_pluggable_database=TRUE\n"
    [ -n "${DB_BLOCK_SIZE:-}" ] && printf "*.db_block_size=%s\n" "$DB_BLOCK_SIZE"
    [ -n "${SGA_TARGET:-}" ] && printf "*.sga_target=%s\n" "$SGA_TARGET"
    [ -n "${PGA_AGGREGATE_TARGET:-}" ] && printf "*.pga_aggregate_target=%s\n" "$PGA_AGGREGATE_TARGET"
    [ -n "${UNDO_TABLESPACE:-}" ] && printf "*.undo_tablespace='%s'\n" "$UNDO_TABLESPACE"
    [ -n "${ARCHIVE_LOG_DEST:-}" ] && printf "*.log_archive_dest_1='LOCATION=%s'\n" "$ARCHIVE_LOG_DEST"
    [ -n "${DIAGNOSTIC_DEST:-}" ] && printf "*.diagnostic_dest='%s'\n" "$DIAGNOSTIC_DEST"
    [ -n "${COMPATIBLE:-}" ] && printf "*.compatible='%s'\n" "$COMPATIBLE"
    true
} > "$pfile_path"

chown oracle:oinstall "$pfile_path" 2>/dev/null || true
chmod 640 "$pfile_path"

# clone_target_preflight.sh guarantees CLONE_SID is absent from oratab, so this is normally a
# plain append; the guard keeps a re-run from doubling the entry.
oratab_registered="false"
if [ -f /etc/oratab ] && grep -q "^${clone_sid}:" /etc/oratab; then
    oratab_registered="true"
else
    printf '%s:%s:N\n' "$clone_sid" "$clone_oracle_home" | sudo tee -a /etc/oratab >/dev/null
    oratab_registered="true"
fi

printf '{"status":"ok","cloneSid":"%s","pfilePath":"%s","controlFiles":[%s],"oratabRegistered":%s,"parameters":{"dbName":"%s","dbUniqueName":"%s","isCDB":%s}}\n' \
    "$clone_sid" "$pfile_path" "$control_files_json" "$oratab_registered" \
    "$source_db_name" "$clone_sid" "${IS_CDB:-false}"
