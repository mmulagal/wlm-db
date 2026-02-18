#!/bin/bash
# ===============================================================================
#         NETAPP CONSOLE WORKLOAD FACTORY - ORACLE DATA COLLECTOR
#         Version 1.0.0
#         Copyright (c) 2025 NetApp, Inc. All rights reserved.
# ===============================================================================
#
# DESCRIPTION:
# This master script collects performance data from the host system
# and from multiple, separate Oracle instances running on the same server.
# Produces a SINGLE combined JSON file per instance with host and DB info.
#
# HELP_START
# USAGE:
#   Interactive mode:  ./OracleDataCollector.sh
#   Non-interactive:   ./OracleDataCollector.sh [OPTIONS]
#
# OPTIONS:
#   -u, --user USERNAME     Database username (optional, uses OS auth if not provided)
#   -p, --password PASSWORD Database password (optional, prompts if user provided without password)
#                           WARNING: Passing password via -p exposes it in the process list.
#                           For security, omit -p and enter the password when prompted.
#   -s, --sids "SID1 SID2"  Space-separated list of SIDs (optional, auto-detects if not provided)
#   -h, --help              Show this help message
#
# EXAMPLES:
#   ./OracleDataCollector.sh                          # Interactive mode
#   ./OracleDataCollector.sh -s "ORCL TESTDB"         # OS auth with specific SIDs
#   ./OracleDataCollector.sh -u system                # Prompt for password, auto-detect SIDs
#   ./OracleDataCollector.sh -u system -s ORCL        # Prompt for password, specific SID
# HELP_END
#
# ===============================================================================

# L26: Bash version guard
if [ -z "$BASH_VERSION" ]; then
    echo "ERROR: This script requires bash." >&2
    exit 1
fi

# L17b: Enable pipefail for better pipeline error detection
set -o pipefail

# M3: Temp file cleanup trap
CLEANUP_FILES=()
cleanup() { [[ ${#CLEANUP_FILES[@]} -gt 0 ]] && rm -f "${CLEANUP_FILES[@]}"; }
trap cleanup EXIT INT TERM

# H3c: JSON value escaping function (handles backslashes, quotes, control chars)
escape_json_val() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr -d $'\r\n\b\f'
}

# L10: Marker-based help extraction
show_help() {
    sed -n '/^# HELP_START$/,/^# HELP_END$/p' "$0" | sed '1d;$d' | sed 's/^# //' | sed 's/^#//'
    exit 0
}

DB_USER=""
DB_PASS=""
SID_LIST=""
INTERACTIVE_MODE=true
FAILURE_COUNT=0  # M4: Track failures for exit code
INTERNAL_PHASE2=false
PHASE2_DATA_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--user)
            DB_USER="$2"
            INTERACTIVE_MODE=false
            shift 2
            ;;
        -p|--password)
            DB_PASS="$2"
            INTERACTIVE_MODE=false
            shift 2
            ;;
        -s|--sids)
            SID_LIST="$2"
            INTERACTIVE_MODE=false
            shift 2
            ;;
        --internal-phase2)
            INTERNAL_PHASE2=true
            PHASE2_DATA_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo "==============================================================================="
echo "|| NetApp Console Workload Factory - Oracle Data Collector"
echo "==============================================================================="
echo ""

# -------------------------------------------------------------------------------
# Phase 2 fast-path: if invoked internally as oracle user, load pre-collected data
# -------------------------------------------------------------------------------
if [ "$INTERNAL_PHASE2" = true ]; then
    if [ -z "$PHASE2_DATA_FILE" ] || [ ! -f "$PHASE2_DATA_FILE" ]; then
        echo "ERROR: Phase 2 data file not found: $PHASE2_DATA_FILE" >&2
        exit 1
    fi
    echo "[Phase 2] Running as $(id -un) user for database collection..."
    # Source the pre-collected data (HOST_INFO_JSON, DB_USER, DB_PASS, SID_LIST, etc.)
    # shellcheck disable=SC1090
    source "$PHASE2_DATA_FILE"
    echo "[Phase 2] Host info and credentials loaded from phase 1."
else

# -------------------------------------------------------------------------------
# Phase 1: Collect host info as current user (root gets better data)
# -------------------------------------------------------------------------------

# --- Step 1: Get User Inputs for Database Collection (Interactive or CLI) ---

if [ "$INTERACTIVE_MODE" = true ]; then
    read -p "Enter the database username (press Enter for OS authentication): " DB_USER

    if [ -n "$DB_USER" ]; then
        read -s -p "Enter the password for $DB_USER: " DB_PASS
        echo ""
    else
        DB_PASS=""
        echo "No username provided. Will use OS authentication (/ as sysdba)."
    fi

    read -p "Enter the list of Oracle SIDs (space-separated, or press Enter to auto-detect): " SID_LIST
else
    echo "Running in non-interactive mode..."
    if [ -n "$DB_USER" ]; then
        if [ -z "$DB_PASS" ]; then
            read -s -p "Enter the password for $DB_USER: " DB_PASS
            echo ""
        fi
        echo "  - Username: $DB_USER"
    else
        echo "  - Authentication: OS authentication (/ as sysdba)"
    fi
    if [ -n "$SID_LIST" ]; then
        echo "  - SIDs: $SID_LIST"
    else
        echo "  - SIDs: Auto-detect"
    fi
fi

# Auto-detect SIDs from /etc/oratab if not provided
if [ -z "$SID_LIST" ]; then
    echo ""
    echo "No SIDs provided. Auto-detecting from /etc/oratab..."
    
    if [ -f /etc/oratab ]; then
        # L29: Avoid useless cat
        SID_LIST=$(grep -v "^#" /etc/oratab | grep -v "^$" | grep -v "^\*" | cut -d: -f1 | tr '\n' ' ')
        
        if [ -z "$SID_LIST" ]; then
            echo "WARNING: No Oracle SIDs found in /etc/oratab."
            echo "Proceeding with host information collection only."
        else
            echo "[OK] Found SIDs: $SID_LIST"
        fi
    else
        echo "WARNING: /etc/oratab not found. Cannot auto-detect SIDs."
        echo "Proceeding with host information collection only."
    fi
fi

# --- Step 2: Identify Storage Protocol ---

echo ""
echo "-------------------------------------------------------------------------------"
echo "|| Detecting Storage Protocol..."
echo "-------------------------------------------------------------------------------"

STORAGE_PROTOCOL="Unknown"
STORAGE_DETAILS=""
NFS_MOUNT_DETAILS=""  # M1: Initialize to prevent unset variable issues

# Check for iSCSI
if [ -d /sys/class/iscsi_session ] && [ "$(ls -A /sys/class/iscsi_session 2>/dev/null)" ]; then
    ISCSI_SESSIONS=$(ls /sys/class/iscsi_session | wc -l)
    STORAGE_PROTOCOL="iSCSI"
    STORAGE_DETAILS="Active iSCSI sessions: $ISCSI_SESSIONS"
    echo "[OK] Detected: iSCSI ($ISCSI_SESSIONS active sessions)"
    
    if command -v iscsiadm &> /dev/null; then
        ISCSI_TARGETS=$(iscsiadm -m session 2>/dev/null | wc -l)
        STORAGE_DETAILS="$STORAGE_DETAILS, Targets: $ISCSI_TARGETS"
    fi
fi

# Check for NFS mounts
NFS_MOUNTS=$(mount | grep -E "type nfs|type nfs4" | wc -l)
if [ "$NFS_MOUNTS" -gt 0 ]; then
    if [ "$STORAGE_PROTOCOL" = "iSCSI" ]; then
        STORAGE_PROTOCOL="Mixed (iSCSI + NFS)"
    else
        STORAGE_PROTOCOL="NFS"
    fi
    # M1: Conditional comma to avoid leading comma
    if [ -n "$STORAGE_DETAILS" ]; then
        STORAGE_DETAILS="$STORAGE_DETAILS, NFS mounts: $NFS_MOUNTS"
    else
        STORAGE_DETAILS="NFS mounts: $NFS_MOUNTS"
    fi
    echo "[OK] Detected: NFS ($NFS_MOUNTS mounts)"
    
    NFS_MOUNT_DETAILS=$(mount | grep -E "type nfs|type nfs4" | awk '{print $1 " -> " $3}' | tr '\n' '; ' | sed 's/; $//')
fi

# Check for FC (Fibre Channel)
if [ -d /sys/class/fc_host ] && [ "$(ls -A /sys/class/fc_host 2>/dev/null)" ]; then
    FC_ADAPTERS=$(ls /sys/class/fc_host | wc -l)
    if [ "$STORAGE_PROTOCOL" != "Unknown" ]; then
        STORAGE_PROTOCOL="$STORAGE_PROTOCOL + FC"
    else
        STORAGE_PROTOCOL="Fibre Channel"
    fi
    # M1: Conditional comma
    if [ -n "$STORAGE_DETAILS" ]; then
        STORAGE_DETAILS="$STORAGE_DETAILS, FC adapters: $FC_ADAPTERS"
    else
        STORAGE_DETAILS="FC adapters: $FC_ADAPTERS"
    fi
    echo "[OK] Detected: Fibre Channel ($FC_ADAPTERS adapters)"
fi

# Check for local storage
if command -v lsblk &> /dev/null; then
    LOCAL_DISKS=$(lsblk -d -n -o NAME,TYPE 2>/dev/null | grep -c disk || echo "0")
elif [ -d /sys/block ]; then
    LOCAL_DISKS=$(ls -d /sys/block/sd* /sys/block/nvme* /sys/block/vd* 2>/dev/null | wc -l || echo "0")
else
    LOCAL_DISKS="0"
fi
if [ "$STORAGE_PROTOCOL" = "Unknown" ]; then
    STORAGE_PROTOCOL="Local/DAS"
    STORAGE_DETAILS="Local disks: $LOCAL_DISKS"
    echo "[OK] Detected: Local/DAS storage"
fi

echo "Storage Protocol Summary: $STORAGE_PROTOCOL"

# --- Step 3: Collect Host Information ---

echo ""
echo "-------------------------------------------------------------------------------"
echo "|| Collecting Host System Information..."
echo "-------------------------------------------------------------------------------"

# H9b: Use COLLECTED_HOSTNAME to avoid shadowing bash built-in
COLLECTED_HOSTNAME=$(hostname)

# Get OS Information
if [ -f /etc/os-release ]; then
    HOST_OS=$(grep PRETTY_NAME /etc/os-release | cut -d'=' -f2 | tr -d '"')
else
    HOST_OS=$(uname -s -r)
fi

# Get CPU Count
if command -v nproc &> /dev/null; then
    HOST_CPU_COUNT=$(nproc)
elif command -v sysctl &> /dev/null; then
    HOST_CPU_COUNT=$(sysctl -n hw.ncpu 2>/dev/null || echo "1")
elif [ -f /proc/cpuinfo ]; then
    HOST_CPU_COUNT=$(grep -c ^processor /proc/cpuinfo)
else
    HOST_CPU_COUNT="1"
fi

# Get Total RAM in Bytes
if command -v free &> /dev/null; then
    HOST_RAM_BYTES=$(free -b | awk '/^Mem:/ {print $2}')
elif command -v sysctl &> /dev/null; then
    HOST_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
elif [ -f /proc/meminfo ]; then
    HOST_RAM_BYTES=$(awk '/MemTotal/ {printf "%.0f", $2 * 1024}' /proc/meminfo)
else
    HOST_RAM_BYTES="0"
fi

# H7b: Validate numeric values
HOST_CPU_COUNT=$(printf "%d" "$HOST_CPU_COUNT" 2>/dev/null || echo 1)
HOST_RAM_BYTES=$(printf "%d" "$HOST_RAM_BYTES" 2>/dev/null || echo 0)

# Get a Unique Host ID
HOST_ID=""
if [ -f /sys/class/dmi/id/product_uuid ] && [ -r /sys/class/dmi/id/product_uuid ]; then
    HOST_ID=$(cat /sys/class/dmi/id/product_uuid 2>/dev/null | tr -d '[:space:]')
fi
if [ -z "$HOST_ID" ] && [ -f /etc/machine-id ] && [ -r /etc/machine-id ]; then
    HOST_ID=$(cat /etc/machine-id 2>/dev/null | tr -d '[:space:]')
fi
if [ -z "$HOST_ID" ]; then
    HOST_ID="$COLLECTED_HOSTNAME"
fi

# Get all configured IP addresses
if hostname -I &> /dev/null; then
    HOST_IPS=$(hostname -I | sed 's/ $//')
elif command -v ip &> /dev/null; then
    # M2: Use grep -oE instead of grep -oP for portability
    HOST_IPS=$(ip -4 addr show | grep -oE 'inet [0-9.]+' | awk '{print $2}' | grep -v '127.0.0.1' | tr '\n' ' ' | sed 's/ $//')
elif command -v ifconfig &> /dev/null; then
    HOST_IPS=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | tr '\n' ' ' | sed 's/ $//')
else
    HOST_IPS="Unknown"
fi

# H3c: Use escape_json_val for all JSON string values
STORAGE_DETAILS_ESCAPED=$(escape_json_val "$STORAGE_DETAILS")
NFS_MOUNT_DETAILS_ESCAPED=$(escape_json_val "$NFS_MOUNT_DETAILS")
HOST_OS_ESCAPED=$(escape_json_val "$HOST_OS")
HOST_ID_ESCAPED=$(escape_json_val "$HOST_ID")
HOSTNAME_ESCAPED=$(escape_json_val "$COLLECTED_HOSTNAME")
HOST_IPS_ESCAPED=$(escape_json_val "$HOST_IPS")
STORAGE_PROTOCOL_ESCAPED=$(escape_json_val "$STORAGE_PROTOCOL")

# Store host info JSON block
HOST_INFO_JSON=$(cat <<HOSTEOF
"hostInfo": {
"collectionTimestamp": "$(date -u +"%Y%m%d%H%M%S")",
"hostname": "$HOSTNAME_ESCAPED",
"operatingSystem": "$HOST_OS_ESCAPED",
"cpuCount": $HOST_CPU_COUNT,
"totalRamBytes": $HOST_RAM_BYTES,
"uniqueHostId": "$HOST_ID_ESCAPED",
"ipAddresses": "$HOST_IPS_ESCAPED",
"storageProtocol": "$STORAGE_PROTOCOL_ESCAPED",
"storageDetails": "$STORAGE_DETAILS_ESCAPED",
"nfsMounts": "$NFS_MOUNT_DETAILS_ESCAPED"
}
HOSTEOF
)

echo "[OK] Host information collected successfully."

# --- User switching: if not oracle, hand off to oracle for DB collection ---

ORACLE_OS_USER="oracle"
CURRENT_USER=$(id -un)

if [ "$CURRENT_USER" != "$ORACLE_OS_USER" ]; then
    echo ""
    echo "-------------------------------------------------------------------------------"
    echo "|| Switching to '$ORACLE_OS_USER' user for database collection..."
    echo "-------------------------------------------------------------------------------"
    echo "  Current user: $CURRENT_USER"

    # Write all phase 1 data to a temp file so phase 2 can source it
    PHASE2_DATA_FILE=$(mktemp /tmp/oracle_collector_phase2_XXXXXX)
    CLEANUP_FILES+=("$PHASE2_DATA_FILE")
    declare -p HOST_INFO_JSON DB_USER DB_PASS SID_LIST COLLECTED_HOSTNAME STORAGE_PROTOCOL > "$PHASE2_DATA_FILE"
    chmod 644 "$PHASE2_DATA_FILE"

    # Resolve absolute path to this script
    SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

    if [ "$CURRENT_USER" = "root" ]; then
        su - "$ORACLE_OS_USER" -c "bash \"$SCRIPT_PATH\" --internal-phase2 \"$PHASE2_DATA_FILE\""
    else
        sudo su - "$ORACLE_OS_USER" -c "bash \"$SCRIPT_PATH\" --internal-phase2 \"$PHASE2_DATA_FILE\""
    fi
    EXIT_CODE=$?
    rm -f "$PHASE2_DATA_FILE"
    exit $EXIT_CODE
fi

# End of phase 1 block (not phase 2)
fi

# Function to merge host info into instance JSON
merge_host_into_instance_json() {
    local INSTANCE_JSON_FILE="$1"
    local TEMP_FILE
    TEMP_FILE=$(mktemp)
    CLEANUP_FILES+=("$TEMP_FILE")
    
    if [ ! -f "$INSTANCE_JSON_FILE" ]; then
        echo "WARNING: Instance JSON file not found: $INSTANCE_JSON_FILE"
        return 1
    fi
    
    # L30: Check the file starts with { before merging
    if ! head -1 "$INSTANCE_JSON_FILE" | grep -q '^\s*{'; then
        echo "WARNING: Instance JSON file does not start with '{': $INSTANCE_JSON_FILE"
        return 1
    fi
    
    # Insert hostInfo after the opening brace of the JSON
    awk -v hostinfo="$HOST_INFO_JSON" '
        NR==1 && /^\{/ {
            print "{"
            print hostinfo ","
            next
        }
        { print }
    ' "$INSTANCE_JSON_FILE" > "$TEMP_FILE"
    
    # L23: Use cat+rm to preserve original file permissions
    cat "$TEMP_FILE" > "$INSTANCE_JSON_FILE" && rm -f "$TEMP_FILE"
    
    return 0
}

# --- Step 4: Loop Through Each SID and Collect Database Data ---

GENERATED_FILES=""

if [ -n "$SID_LIST" ]; then
    echo ""
    echo "-------------------------------------------------------------------------------"
    echo "|| Starting Database Collection for SIDs: $SID_LIST"
    echo "-------------------------------------------------------------------------------"

    # H2: Save PATH/LD_LIBRARY_PATH before the loop
    SAVED_PATH="$PATH"
    SAVED_LD_LIBRARY_PATH="$LD_LIBRARY_PATH"

    # M14: Disable globbing during SID iteration
    set -f
    for SID in $SID_LIST
    do
        # H2: Reset to saved values each iteration
        PATH="$SAVED_PATH"
        LD_LIBRARY_PATH="$SAVED_LD_LIBRARY_PATH"

        echo ""
        echo ">>> Processing SID: $SID <<<"

        export ORACLE_SID=$SID
        
        ORACLE_HOME=$(grep "^${SID}:" /etc/oratab 2>/dev/null | cut -d: -f2)
        if [ -n "$ORACLE_HOME" ] && [ -d "$ORACLE_HOME" ]; then
            export ORACLE_HOME
            export PATH=$ORACLE_HOME/bin:$PATH
            export LD_LIBRARY_PATH=$ORACLE_HOME/lib:$LD_LIBRARY_PATH
        elif command -v oraenv &> /dev/null; then
            export ORAENV_ASK=NO
            . oraenv 2>/dev/null
        else
            echo "WARNING: Could not set Oracle environment for SID '$SID'."
        fi

        if [ -z "$ORACLE_HOME" ] || [ ! -d "$ORACLE_HOME" ]; then
            echo "ERROR: Failed to set environment for SID '$SID'. Check if it is configured correctly in /etc/oratab."
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            continue
        fi

        echo "Environment set. ORACLE_HOME is $ORACLE_HOME"

        if [ ! -f "OracleDataCollectorController.sql" ]; then
            echo "WARNING: OracleDataCollectorController.sql not found in current directory. Skipping SQL collection for $SID."
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            continue
        fi

        # L25: Record timestamp before sqlplus to detect stale files
        BEFORE_TIMESTAMP=$(date +%s)

        SQLPLUS_OUTPUT=$(mktemp)
        CLEANUP_FILES+=("$SQLPLUS_OUTPUT")
        
        if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ]; then
            echo "Connecting with provided credentials..."
            sqlplus -s /nolog <<SQL_EOF 2>&1 | tee "$SQLPLUS_OUTPUT"
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
CONNECT ${DB_USER}/"${DB_PASS}"
@OracleDataCollectorController.sql
SQL_EOF
            SQLPLUS_EXIT_CODE=${PIPESTATUS[0]}
        elif [ -n "$DB_USER" ]; then
            echo "Connecting with username (will prompt for password)..."
            sqlplus "$DB_USER" <<SQL_EOF 2>&1 | tee "$SQLPLUS_OUTPUT"
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
@OracleDataCollectorController.sql
SQL_EOF
            SQLPLUS_EXIT_CODE=${PIPESTATUS[0]}
        else
            echo "Attempting OS authentication (/ as sysdba)..."
            sqlplus -s /nolog <<SQL_EOF 2>&1 | tee "$SQLPLUS_OUTPUT"
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
CONNECT / AS SYSDBA
@OracleDataCollectorController.sql
SQL_EOF
            SQLPLUS_EXIT_CODE=${PIPESTATUS[0]}
        fi

        # L11: Robust error counting - ensure clean single integer
        ORA_ERRORS=$(grep -c "ORA-" "$SQLPLUS_OUTPUT" 2>/dev/null || true)
        ORA_ERRORS=$(echo "$ORA_ERRORS" | tr -d '[:space:]')
        ORA_ERRORS=${ORA_ERRORS:-0}
        SP2_ERRORS=$(grep -c "SP2-" "$SQLPLUS_OUTPUT" 2>/dev/null || true)
        SP2_ERRORS=$(echo "$SP2_ERRORS" | tr -d '[:space:]')
        SP2_ERRORS=${SP2_ERRORS:-0}
        
        rm -f "$SQLPLUS_OUTPUT"
        rm -f NUL 2>/dev/null
        
        if [ "$SQLPLUS_EXIT_CODE" -eq 0 ] && [ "$ORA_ERRORS" -eq 0 ] && [ "$SP2_ERRORS" -eq 0 ]; then
            echo "[OK] Successfully processed SID: $SID"
            
            # L25: Only consider files newer than BEFORE_TIMESTAMP
            # Temporarily re-enable globbing for file detection (set -f is active for SID loop)
            set +f
            INSTANCE_JSON=""
            for candidate in Oracle*DataResponse*-${SID}-*.json; do
                if [ -f "$candidate" ]; then
                    FILE_MOD=$(stat -c %Y "$candidate" 2>/dev/null || stat -f %m "$candidate" 2>/dev/null || perl -e 'print((stat shift)[9])' "$candidate" 2>/dev/null || echo 0)
                    if [ "$FILE_MOD" -ge "$BEFORE_TIMESTAMP" ]; then
                        INSTANCE_JSON="$candidate"
                        break
                    fi
                fi
            done
            
            # Fallback to ls -t if stat-based detection didn't find anything
            if [ -z "$INSTANCE_JSON" ]; then
                INSTANCE_JSON=$(ls -t Oracle*DataResponse*-${SID}-*.json 2>/dev/null | head -1)
            fi
            set -f  # Re-disable globbing for SID loop
            
            if [ -n "$INSTANCE_JSON" ] && [ -f "$INSTANCE_JSON" ]; then
                echo "  Merging host information into: $INSTANCE_JSON"
                if merge_host_into_instance_json "$INSTANCE_JSON"; then
                    echo "[OK] Combined output saved to: $INSTANCE_JSON"
                    GENERATED_FILES="$GENERATED_FILES $INSTANCE_JSON"
                else
                    echo "WARNING: Failed to merge host info into $INSTANCE_JSON"
                    FAILURE_COUNT=$((FAILURE_COUNT + 1))
                fi
            else
                echo "WARNING: Could not find generated JSON file for SID: $SID"
                FAILURE_COUNT=$((FAILURE_COUNT + 1))
            fi
        else
            echo "WARNING: Errors detected while processing SID: $SID"
            if [ "$SQLPLUS_EXIT_CODE" -ne 0 ]; then
                echo "  - SQL*Plus exit code: $SQLPLUS_EXIT_CODE"
            fi
            if [ "$ORA_ERRORS" -gt 0 ]; then
                echo "  - ORA- errors found: $ORA_ERRORS"
            fi
            if [ "$SP2_ERRORS" -gt 0 ]; then
                echo "  - SP2- errors found: $SP2_ERRORS"
            fi
            echo "  Please review the output above for details."
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    done
    set +f  # M14: Re-enable globbing
else
    echo ""
    echo "-------------------------------------------------------------------------------"
    echo "|| Skipping Database Collection"
    echo "-------------------------------------------------------------------------------"
    echo "Reason: No Oracle SIDs found or provided."
    echo "Host information has been collected successfully."
fi

echo ""
echo "==============================================================================="
echo "|| All processing complete."
echo "==============================================================================="
echo ""
echo "Summary:"
echo "  - Hostname: $COLLECTED_HOSTNAME"
echo "  - Storage Protocol: $STORAGE_PROTOCOL"
if [ -n "$SID_LIST" ]; then
    echo "  - Database SIDs Processed: $SID_LIST"
    if [ -n "$DB_USER" ]; then
        echo "  - Authentication Method: User credentials ($DB_USER)"
    else
        echo "  - Authentication Method: OS authentication"
    fi
    if [ -n "$GENERATED_FILES" ]; then
        echo ""
        echo "Generated Output Files (combined host + instance data):"
        for f in $GENERATED_FILES; do
            echo "  - $f"
        done
    fi
    if [ "$FAILURE_COUNT" -gt 0 ]; then
        echo ""
        echo "  WARNING: $FAILURE_COUNT SID(s) had errors during processing."
    fi
else
    echo "  - Database Collection: Skipped (No SIDs found)"
fi
echo ""
echo "==============================================================================="

# M4: Exit with non-zero if any failures occurred
exit $((FAILURE_COUNT > 0 ? 1 : 0))
