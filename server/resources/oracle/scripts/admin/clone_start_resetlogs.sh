#!/bin/sh
set -eu

clone_sid="${CLONE_SID:?}"
clone_oracle_home="${CLONE_ORACLE_HOME:?}"
phase="${PHASE:?}"

case "$phase" in
    mount|open) ;;
    *)
        printf '{"status":"error","error":"PHASE must be mount or open, got %s"}\n' "$phase"
        exit 0
        ;;
esac

# STARTUP MOUNT reads init<CLONE_SID>.ora; without it Oracle fails at LRM-00109 with no ORA-
# prefix, which the ORA- grep below would not surface as an error.
if [ "$phase" = "mount" ] \
    && [ ! -f "${clone_oracle_home}/dbs/init${clone_sid}.ora" ] \
    && [ ! -f "${clone_oracle_home}/dbs/spfile${clone_sid}.ora" ]; then
    printf '{"status":"error","error":"no init%s.ora or spfile%s.ora in %s/dbs — run clone_bootstrap_pfile.sh first"}\n' \
        "$clone_sid" "$clone_sid" "$clone_oracle_home"
    exit 0
fi

sql_file=$(mktemp /tmp/wlmdb_resetlogs_sql.XXXXXX)
out_file=$(mktemp /tmp/wlmdb_resetlogs_out.XXXXXX)
run_file=$(mktemp /tmp/wlmdb_resetlogs_run.XXXXXX)
rman_file=$(mktemp /tmp/wlmdb_resetlogs_rman.XXXXXX)
rman_out=$(mktemp /tmp/wlmdb_resetlogs_rmanout.XXXXXX)
rman_run=$(mktemp /tmp/wlmdb_resetlogs_rmanrun.XXXXXX)
rename_sql=$(mktemp /tmp/wlmdb_resetlogs_rename.XXXXXX)
trap 'rm -f "$sql_file" "$out_file" "$run_file" "$rman_file" "$rman_out" "$rman_run" "$rename_sql"' EXIT

if [ "$phase" = "mount" ]; then
    cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR EXIT SQL.SQLCODE
STARTUP MOUNT;
SELECT 'OPEN_MODE=' || OPEN_MODE FROM V\$DATABASE;
SELECT 'DF=' || NAME FROM V\$DATAFILE;
SELECT 'LF=' || MEMBER FROM V\$LOGFILE;
EXIT;
SQLEOF
else
    cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR CONTINUE
ALTER DATABASE OPEN RESETLOGS;
ALTER DATABASE OPEN;
WHENEVER SQLERROR EXIT SQL.SQLCODE
SELECT 'OPEN_MODE=' || OPEN_MODE FROM V\$DATABASE;
SELECT 'INVALID_COUNT=' || COUNT(*) FROM DBA_OBJECTS WHERE STATUS != 'VALID';
EXIT;
SQLEOF
fi

{
    printf 'export ORACLE_SID=%s\n' "$clone_sid"
    printf 'export ORACLE_HOME=%s\n' "$clone_oracle_home"
    printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
    printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1\n' "$sql_file" "$out_file"
} > "$run_file"
chmod 644 "$sql_file" "$run_file"
chmod 666 "$out_file"

sudo -i -u oracle bash "$run_file" || true
sql_output=$(cat "$out_file")

if [ "$phase" = "mount" ] && echo "$sql_output" | grep -q 'ORA-01081'; then
    # Already started from a prior PHASE=mount whose CloudWatch fetch failed.
    cat > "$sql_file" <<SQLEOF
SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500
WHENEVER SQLERROR EXIT SQL.SQLCODE
SELECT 'OPEN_MODE=' || OPEN_MODE FROM V\$DATABASE;
SELECT 'DF=' || NAME FROM V\$DATAFILE;
SELECT 'LF=' || MEMBER FROM V\$LOGFILE;
EXIT;
SQLEOF
    sudo -i -u oracle bash "$run_file" || true
    sql_output=$(cat "$out_file")
fi
if echo "$sql_output" | grep -q 'ORA-'; then
    ora_line=$(echo "$sql_output" | grep -o 'ORA-[0-9]*.*' | grep -vE 'ORA-01139|ORA-01531' | head -1 || true)
    if [ "$phase" != "open" ] || [ -n "$ora_line" ]; then
        if [ -n "$ora_line" ]; then
            printf '{"status":"error","error":%s}\n' "$(printf '%s' "$ora_line" | jq -Rs .)"
            exit 0
        fi
        if [ "$phase" != "open" ]; then
            printf '{"status":"error","error":%s}\n' "$(echo "$sql_output" | grep -o 'ORA-[0-9]*.*' | head -1 | jq -Rs .)"
            exit 0
        fi
    fi
fi

open_mode=$(echo "$sql_output" | grep -oP 'OPEN_MODE=\K.+' | head -1 || true)
if [ -z "$open_mode" ]; then
    printf '{"status":"error","error":%s}\n' "$(printf '%s' "$sql_output" | jq -Rs .)"
    exit 0
fi

if [ "$phase" = "mount" ]; then
    mounted="false"
    [ "$open_mode" = "MOUNTED" ] && mounted="true"
    if [ "$mounted" != "true" ]; then
        printf '{"status":"error","error":"STARTUP MOUNT did not leave the clone MOUNTED","openMode":"%s"}\n' "$open_mode"
        exit 0
    fi
    clone_root="/oradata/clone_${clone_sid}"
    df_lines=$(printf '%s\n' "$sql_output" | grep '^DF=' | sed 's/^DF=//')
    if [ -z "$df_lines" ]; then
        printf '{"status":"error","error":"no V\$DATAFILE rows after STARTUP MOUNT"}\n'
        exit 0
    fi
    need_rman="false"
    old_ifs="$IFS"
    IFS='
'
    for old in $df_lines; do
        IFS="$old_ifs"
        [ -n "$old" ] || continue
        case "$old" in
            "$clone_root"/*) ;;
            *) need_rman="true" ;;
        esac
        IFS='
'
    done
    IFS="$old_ifs"
    missing=""
    if [ "$need_rman" = "true" ]; then
        : > "$rman_file"
        printf 'RUN {\n' >> "$rman_file"
        IFS='
'
        for old in $df_lines; do
            IFS="$old_ifs"
            [ -n "$old" ] || continue
            base=$(basename "$old")
            new=$(find "$clone_root/data_files" -type f -name "$base" 2>/dev/null | head -1)
            [ -n "$new" ] || new=$(find "$clone_root" -type f -name "$base" 2>/dev/null | head -1)
            if [ -z "$new" ]; then
                missing="${missing}${base},"
            else
                printf '  SET NEWNAME FOR DATAFILE '\''%s'\'' TO '\''%s'\'';\n' "$old" "$new" >> "$rman_file"
            fi
            IFS='
'
        done
        IFS="$old_ifs"
        if [ -n "$missing" ]; then
            printf '{"status":"error","error":"no clone copy found for datafile basename(s): %s"}\n' "$missing"
            exit 0
        fi
        printf '  SWITCH DATAFILE ALL;\n}\n' >> "$rman_file"
        chmod 644 "$rman_file"
        : > "$rman_out"
        chmod 666 "$rman_out"
        {
            printf 'export ORACLE_SID=%s\n' "$clone_sid"
            printf 'export ORACLE_HOME=%s\n' "$clone_oracle_home"
            printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
            printf '"$ORACLE_HOME/bin/rman" target / cmdfile "%s" > "%s" 2>&1\n' "$rman_file" "$rman_out"
        } > "$rman_run"
        chmod 644 "$rman_run"
        sudo -i -u oracle bash "$rman_run" || true
        rman_output=$(cat "$rman_out")
        if echo "$rman_output" | grep -qE 'RMAN-[0-9]{5}:|ORA-[0-9]'; then
            printf '{"status":"error","error":%s}\n' "$(printf '%s' "$rman_output" | jq -Rs .)"
            exit 0
        fi
    fi
    : > "$rename_sql"
    printf 'SET HEADING OFF FEEDBACK OFF TERMOUT OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 500\nWHENEVER SQLERROR EXIT SQL.SQLCODE\n' >> "$rename_sql"
    lf_lines=$(printf '%s\n' "$sql_output" | grep '^LF=' | sed 's/^LF=//')
    rename_count=0
    IFS='
'
    for old in $lf_lines; do
        IFS="$old_ifs"
        [ -n "$old" ] || continue
        case "$old" in
            "$clone_root"/*)
                IFS='
'
                continue
                ;;
        esac
        base=$(basename "$old")
        new=$(find "$clone_root/redo_logs" -type f -name "$base" 2>/dev/null | head -1)
        [ -n "$new" ] || new=$(find "$clone_root" -type f -name "$base" 2>/dev/null | head -1)
        if [ -z "$new" ]; then
            missing="${missing}${base},"
        elif [ "$old" != "$new" ]; then
            printf 'ALTER DATABASE RENAME FILE '\''%s'\'' TO '\''%s'\'';\n' "$old" "$new" >> "$rename_sql"
            rename_count=$((rename_count + 1))
        fi
        IFS='
'
    done
    IFS="$old_ifs"
    if [ -n "$missing" ]; then
        printf '{"status":"error","error":"no clone copy found for redo member basename(s): %s"}\n' "$missing"
        exit 0
    fi
    if [ "$rename_count" -gt 0 ]; then
        printf "SELECT 'OPEN_MODE=' || OPEN_MODE FROM V\$DATABASE;\nEXIT;\n" >> "$rename_sql"
        chmod 644 "$rename_sql"
        {
            printf 'export ORACLE_SID=%s\n' "$clone_sid"
            printf 'export ORACLE_HOME=%s\n' "$clone_oracle_home"
            printf 'export PATH="$ORACLE_HOME/bin:$PATH"\n'
            printf '"$ORACLE_HOME/bin/sqlplus" -s / as sysdba < "%s" > "%s" 2>&1\n' "$rename_sql" "$out_file"
        } > "$run_file"
        sudo -i -u oracle bash "$run_file" || true
        rename_output=$(cat "$out_file")
        if echo "$rename_output" | grep -q 'ORA-'; then
            printf '{"status":"error","error":%s}\n' "$(echo "$rename_output" | grep -o 'ORA-[0-9]*.*' | head -1 | jq -Rs .)"
            exit 0
        fi
    fi
    printf '{"status":"ok","cloneSid":"%s","phase":"mount","openMode":"%s","mounted":true}\n' \
        "$clone_sid" "$open_mode"
    exit 0
fi

invalid_count=$(echo "$sql_output" | grep -oP 'INVALID_COUNT=\K[0-9]+' | head -1 || true)
if [ -z "$invalid_count" ]; then
    printf '{"status":"error","error":%s}\n' "$(printf '%s' "$sql_output" | jq -Rs .)"
    exit 0
fi

verified="false"
[ "$open_mode" = "READ WRITE" ] && verified="true"

printf '{"status":"ok","cloneSid":"%s","phase":"open","openMode":"%s","verified":%s,"invalidObjectCount":%s}\n' \
    "$clone_sid" "$open_mode" "$verified" "$invalid_count"
