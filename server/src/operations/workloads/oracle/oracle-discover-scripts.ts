import { LINUX_LOG_DIRECTORY } from '../../continuous-optimization/oracle/consts';
import {
    checkOracleModuleAvailability,
    getMappedOntapDataVolume,
    getOracleDefaultOrUserAuthCommand,
    getOracleHomePath,
    loadOracleUserPermissionsDetectionModule,
    oracleUserAuthLoginCommand,
    isASMManagedCheck,
    parseSqlplusOutput,
    parseSpfileProperties,
    dataguardDeploymentUtilities,
    defaultAuthDetectModule
} from './oracle-ssm-script-utils';

const debugLog = (logFileName: string) => `
log() {
    mkdir -p ${LINUX_LOG_DIRECTORY}
    echo "[DEBUG $(date '+%Y-%m-%d %H:%M:%S')] $1" >> ${logFileName}
}
`;

const getDataguardDeploymentDetails = `
    ${parseSqlplusOutput}
    ${dataguardDeploymentUtilities}
    dataguardDiscoveryErrorMsg=""

    # use check_dataguard_deployment before using this function
    get_dataguard_details_without_creds() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash -s -- "$ORACLE_SID" <<'EOF'
            dbUniqueName=""
            dbName=""
            associatedHosts=""
            isPrimaryNode=false
            export ORACLE_SID="$1"
            oracle_home=$(${getOracleHomePath('$ORACLE_SID')})
            export ORACLE_HOME="$oracle_home"
            proc_pattern="ora_(mrp|pr)[0-9]+_\${ORACLE_SID}\\b"
            spFilePath="$ORACLE_HOME/dbs/spfile$ORACLE_SID.ora"
            # For Oracle 21c, spfile will be located in ORACLE_BASE/dbs.
            if [ ! -f "$spFilePath" ]; then
                spFilePath="$ORACLE_BASE/dbs/spfile$ORACLE_SID.ora"
            fi
            if [[ ! -f "$spFilePath" ]]; then
                exit 1
            fi
            if [[ -f "$spFilePath" ]]; then
                dbUniqueName="${parseSpfileProperties('db_unique_name', '$spFilePath')}"
                dbName="${parseSpfileProperties('db_name', '$spFilePath')}"
            else
                dbUniqueName=""
                dbName=""
            fi

            if [[ -z "$dbUniqueName" ]]; then
                dbUniqueName="$ORACLE_SID"
            fi
            listener_file="\${ORACLE_HOME}/network/admin/listener.ora"
            associatedHosts=$(awk -v listener_file="$listener_file" '
                BEGIN {
                    # Pre-parse listener.ora to build service_name -> sid_name mapping
                    in_sid_desc = 0
                    global_db = ""
                    sid_name = ""
                    while ((getline line < listener_file) > 0) {
                        if (line ~ /\\(SID_DESC/) {
                            in_sid_desc = 1
                            global_db = ""
                            sid_name = ""
                        }
                        if (in_sid_desc) {
                            if (match(line, /GLOBAL_DBNAME[[:space:]]*=[[:space:]]*([^)]+)/, arr)) {
                                global_db = arr[1]
                                gsub(/^[[:space:]]+|[[:space:]]+$/, "", global_db)
                            }
                            if (match(line, /SID_NAME[[:space:]]*=[[:space:]]*([^)]+)/, arr)) {
                                sid_name = arr[1]
                                gsub(/^[[:space:]]+|[[:space:]]+$/, "", sid_name)
                            }
                        }
                        # End of SID_DESC block - store mapping
                        if (in_sid_desc && line ~ /\\)[[:space:]]*$/ && global_db != "" && sid_name != "") {
                            sid_map[toupper(global_db)] = sid_name
                            in_sid_desc = 0
                            global_db = ""
                            sid_name = ""
                        }
                    }
                    close(listener_file)
                }
                /^[[:alnum:]_]+[[:space:]]*=/ {
                    # start new entry - save previous if complete
                    if (host && port && svc) {
                        mapped_sid = sid_map[toupper(svc)]
                        if (mapped_sid == "") mapped_sid = ""
                        rec[++n] = sprintf("{\\"serviceName\\":\\"%s\\",\\"hostIp\\":\\"%s\\",\\"listenerPort\\":\\"%s\\",\\"sidName\\":\\"%s\\"}", svc, host, port, mapped_sid)
                    }
                    host = port = svc = ""
                }
                /\\(HOST[[:space:]]*=/ {
                    if (match($0, /\\(HOST *= *([0-9.]+)\\)/, m)) host = m[1]
                }
                /\\(PORT[[:space:]]*=/ {
                    if (match($0, /\\(PORT *= *([0-9]+)\\)/, m)) port = m[1]
                }
                /\\(SERVICE_NAME[[:space:]]*=/ {
                    if (match($0, /\\(SERVICE_NAME *= *([^) ]+)\\)/, m)) svc = m[1]
                }
                /^[[:space:]]*$/ {
                    if (host && port && svc) {
                        mapped_sid = sid_map[toupper(svc)]
                        if (mapped_sid == "") mapped_sid = ""
                        rec[++n] = sprintf("{\\"serviceName\\":\\"%s\\",\\"hostIp\\":\\"%s\\",\\"listenerPort\\":\\"%s\\",\\"sidName\\":\\"%s\\"}", svc, host, port, mapped_sid)
                    }
                    host = port = svc = ""
                }
                END {
                    if (host && port && svc) {
                        mapped_sid = sid_map[toupper(svc)]
                        if (mapped_sid == "") mapped_sid = ""
                        rec[++n] = sprintf("{\\"serviceName\\":\\"%s\\",\\"hostIp\\":\\"%s\\",\\"listenerPort\\":\\"%s\\",\\"sidName\\":\\"%s\\"}", svc, host, port, mapped_sid)
                    }
                    print "["
                    for (i = 1; i <= n; i++) {
                        printf("%s%s", rec[i], (i < n ? "," : ""))
                    }
                    print "]"
                }' "\${ORACLE_HOME}/network/admin/tnsnames.ora")
            
            isPrimaryNode=true
            if pgrep -f $proc_pattern >/dev/null 2>&1; then
                isPrimaryNode=false
            fi
            echo "{\\"dbUniqueName\\": \\"$dbUniqueName\\", \\"dbName\\": \\"$dbName\\", \\"associatedHosts\\": $associatedHosts, \\"isPrimaryNode\\": $isPrimaryNode }" | tr -d '\n' | tr -d ' '
EOF
    }

    ############################################################
    # All methods below this comment need sqlplus creds to run #
    ############################################################

    get_dataguard_details_with_creds() {
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        
        local db_info=""
        db_info=$(get_dataguard_db_name_and_db_unique_name "$ORACLE_SID")
        if [ $? -ne 0 ]; then
            echo "{\\"error\\": \\"$dataguardDiscoveryErrorMsg\\"}"
            return 1
        fi
        local dbUniqueName=$(echo "$db_info" | sed 's/.*"dbUniqueName":"\\([^"]*\\)".*/\\1/')
        local dbName=$(echo "$db_info" | sed 's/.*"dbName":"\\([^"]*\\)".*/\\1/')

        local role=""
        role=$(get_dataguard_role "$ORACLE_SID")
        if [ $? -ne 0 ]; then
            echo "{\\"error\\": \\"$dataguardDiscoveryErrorMsg\\"}"
            return 1
        fi

        local isPrimaryNode=""
        isPrimaryNode=$(is_primary_node "$ORACLE_SID")
        if [ $? -ne 0 ]; then
            echo "{\\"error\\": \\"$dataguardDiscoveryErrorMsg\\"}"
            return 1
        fi

        # Get associated hosts
        local associatedHosts=""
        associatedHosts=$(get_associated_hosts_with_creds "$ORACLE_SID")
        if [ $? -ne 0 ]; then
            associatedHosts="[]"
        fi
        local syncStatus=""
        syncStatus=$(get_dataguard_instance_sync_status "$ORACLE_SID" "$isCDB" "$pdbName")
        if [ $? -ne 0 ]; then
            syncStatus="{\\"instanceSyncStatus\\":\\"UNKNOWN\\"}"
        fi

        # Check if Active Data Guard is enabled (only possible for Physical Standby with READ ONLY WITH APPLY mode)
        local isActiveDataguard="false"
        if [ "$isPrimaryNode" == "false" ]; then
            isActiveDataguard=$(is_active_dataguard "$ORACLE_SID")
        fi
        local protectionLevel=""
        protectionLevel=$(get_dataguard_protection_and_performance_details "$ORACLE_SID")
        if [ $? -ne 0 ]; then
            protectionLevel="UNKNOWN"
        fi

        local openMode=""
        openMode=$(get_open_mode "$ORACLE_SID")

        echo "{\\"dbUniqueName\\":\\"$dbUniqueName\\",\\"dbName\\":\\"$dbName\\",\\"associatedHosts\\":$associatedHosts,\\"isPrimaryNode\\":$isPrimaryNode,\\"role\\":\\"$role\\",\\"status\\":$syncStatus,\\"isActiveDataguard\\":$isActiveDataguard,\\"protectionLevel\\":\\"$protectionLevel\\",\\"openMode\\":\\"$openMode\\"}" | tr -d '\n'
    }

`;

const GET_DATAGUARD_DETAILS_FOR_ALL_SIDS = (oracleSids: string[], ec2InstanceId: string) => `
# Get Dataguard details for all provided Oracle SIDs
oracleSids=(${oracleSids.map(sid => `"${sid}"`).join(' ')})
resultObject="{}"
for oracleSid in "\${oracleSids[@]}"; do
    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, '$oracleSid')}
    isDefaultAuth=$(is_default_auth "$oracleSid")
    isMounted=$(is_mounted_instance "$oracleSid")
    ${getDataguardDeploymentDetails}
    check_dataguard_deployment "$oracleSid"
    if [ $? -eq 0 ]; then
        # DataGuard is configured
        # Use creds path if we have default auth (even if MOUNTED) or user creds
        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
            dataguardDetails=$(get_dataguard_details_with_creds "$oracleSid" "NO" "")
        else
            # Fallback to no-creds path only if we truly have no authentication
            dataguardDetails=$(get_dataguard_details_without_creds "$oracleSid")
        fi
        resultObject=$(echo "$resultObject" | jq --arg key "$oracleSid" --argjson val "$dataguardDetails" '. + {($key): $val}')
    else
        resultObject=$(echo "$resultObject" | jq --arg key "$oracleSid" '. + {($key): {}}')
    fi
done

echo "$resultObject"
`;

const loadStorageDetectionModules = `
    ${parseSqlplusOutput}

    # Function to find mount point details for a given file or directory.
    find_mountpoint() {
        local target="$1"
        local mount_info
        mount_info=$(findmnt -T "$target" -n -o SOURCE,FSTYPE)
        read source fstype <<< "$mount_info"
    
        if [ -n "$source" ]; then
            if [[ "$fstype" == nfs* ]]; then
                dns_name=$(echo "$source" | cut -d':' -f1)
                mountPoint=$(echo "$source" | cut -d':' -f2-)
                protocol="NFS"
                # Check if dns_name already appears to be an IP address (simple check for digits and dots)
                if [[ $dns_name =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
                    mountIp="$dns_name"
                else
                    mountIp=$(dig +short "$dns_name")
                fi
            else
                return 1
            fi
            
            echo "$mountIp,$mountPoint,$protocol"
            return 0
        fi

        echo "Mount point not found for $1."
        return 1
    }
    
    get_oracle_db_file_paths() {
        # Function to retrieve the db file path from the database.
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        local isASMManaged="$4"
        local matching="NOT LIKE"
        local alter_cmd=""
        local sqlplus_output=""
        local parsed_output=""
        if [ "$isCDB" == "YES" ]; then
            alter_cmd="ALTER SESSION SET CONTAINER=$pdbName;"
        fi

        if [ "$isASMManaged" == "YES" ]; then
            matching="LIKE"
        fi

        sqlplus_output=$(sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            sqlplus_output=\\$($sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SET FEEDBACK OFF
            SET TERMOUT OFF
            SET PAGESIZE 0
            SET TRIMSPOOL ON
            $alter_cmd
            SELECT 
                '{' || CHR(10) ||
                '    "REDO_LOGS": {' || CHR(10) ||
                '        "directories": [' || 
                    NVL((SELECT LISTAGG('"' || redo_dir || '"', ', ') WITHIN GROUP (ORDER BY redo_dir)
                        FROM (SELECT DISTINCT substr(member,1,instr(member,'/',-1)-1) as redo_dir FROM v\\$logfile)), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || redo_dir || '": ' || copy_count, ', ') WITHIN GROUP (ORDER BY redo_dir)
                        FROM (SELECT substr(member,1,instr(member,'/',-1)-1) as redo_dir, COUNT(*) as copy_count 
                              FROM v\\$logfile GROUP BY substr(member,1,instr(member,'/',-1)-1))), '') ||
                '}' || CHR(10) ||
                '    },' || CHR(10) ||
                '    "ARCHIVE_LOGS": {' || CHR(10) ||
                '        "directories": [' || 
                    NVL(( SELECT LISTAGG('"' || archive_dir || '"', ', ') WITHIN GROUP (ORDER BY archive_dir)
                        FROM (
                            SELECT DISTINCT
                                CASE d.destination
                                        WHEN 'USE_DB_RECOVERY_FILE_DEST'
                                            THEN (SELECT value
                                                    FROM v\\$parameter
                                                    WHERE name = 'db_recovery_file_dest')
                                        ELSE d.destination
                                END AS archive_dir
                            FROM   v\\$archive_dest_status d
                            WHERE  d.destination IS NOT NULL
                            AND  LENGTH(TRIM(d.destination)) > 0
                            AND  d.type = 'LOCAL'
                        )
                        WHERE LENGTH(TRIM(archive_dir)) > 0
                        AND (archive_dir LIKE '/%' OR archive_dir LIKE '+%') ), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || archive_dir || '": 1', ', ') WITHIN GROUP (ORDER BY archive_dir)
                        FROM (
                            SELECT DISTINCT
                                CASE d.destination
                                        WHEN 'USE_DB_RECOVERY_FILE_DEST'
                                            THEN (SELECT value
                                                    FROM v\\$parameter
                                                    WHERE name = 'db_recovery_file_dest')
                                        ELSE d.destination
                                END AS archive_dir
                            FROM   v\\$archive_dest_status d
                            WHERE  d.destination IS NOT NULL
                            AND  LENGTH(TRIM(d.destination)) > 0
                            AND  d.type = 'LOCAL'
                        )
                        WHERE LENGTH(TRIM(archive_dir)) > 0
                        AND (archive_dir LIKE '/%' OR archive_dir LIKE '+%') ), '') ||
                '}' || CHR(10) ||
                '    },' || CHR(10) ||
                '    "CONTROL_FILES": {' || CHR(10) ||
                '        "directories": [' || 
                    NVL((SELECT LISTAGG('"' || ctrlfile_dir || '"', ', ') WITHIN GROUP (ORDER BY ctrlfile_dir)
                        FROM (SELECT DISTINCT substr(name,1,instr(name,'/',-1)-1) as ctrlfile_dir FROM v\\$controlfile)), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || ctrlfile_dir || '": ' || copy_count, ', ') WITHIN GROUP (ORDER BY ctrlfile_dir)
                        FROM (SELECT substr(name,1,instr(name,'/',-1)-1) as ctrlfile_dir, COUNT(*) as copy_count 
                              FROM v\\$controlfile GROUP BY substr(name,1,instr(name,'/',-1)-1))), '') ||
                '}' || CHR(10) ||
                '    },' || CHR(10) ||
                '    "TEMP_FILES": {' || CHR(10) ||
                '        "directories": [' || 
                    NVL((SELECT LISTAGG('"' || tempfile_dir || '"', ', ') WITHIN GROUP (ORDER BY tempfile_dir)
                        FROM (SELECT DISTINCT substr(file_name,1,instr(file_name,'/',-1)-1) as tempfile_dir FROM dba_temp_files)), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || tempfile_dir || '": ' || copy_count, ', ') WITHIN GROUP (ORDER BY tempfile_dir)
                        FROM (SELECT substr(file_name,1,instr(file_name,'/',-1)-1) as tempfile_dir, COUNT(*) as copy_count 
                              FROM dba_temp_files GROUP BY substr(file_name,1,instr(file_name,'/',-1)-1))), '') ||
                '}' || CHR(10) ||
                '    },' || CHR(10) ||
                '    "DATA_FILES": {' || CHR(10) ||
                '        "directories": [' || 
                    NVL((SELECT LISTAGG('"' || data_dir || '"', ', ') WITHIN GROUP (ORDER BY data_dir)
                        FROM (SELECT DISTINCT SUBSTR(file_name, 1, INSTR(file_name, '/', -1) - 1) AS data_dir 
                            FROM dba_data_files WHERE file_name $matching '+%')), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || data_dir || '": ' || copy_count, ', ') WITHIN GROUP (ORDER BY data_dir)
                        FROM (SELECT SUBSTR(file_name, 1, INSTR(file_name, '/', -1) - 1) AS data_dir, COUNT(*) as copy_count 
                              FROM dba_data_files WHERE file_name $matching '+%' 
                              GROUP BY SUBSTR(file_name, 1, INSTR(file_name, '/', -1) - 1))), '') ||
                '}' || CHR(10) ||
                '    },' || CHR(10) ||
                '   "FRA": {' || CHR(10) ||
                '        "directories": [' || 
                        NVL((SELECT LISTAGG('"' || fra_dir || '"', ', ') WITHIN GROUP (ORDER BY fra_dir)
                            FROM (SELECT DISTINCT name as fra_dir FROM v\\$RECOVERY_FILE_DEST)), '') || 
                '],' || CHR(10) ||
                '        "copies_per_directory": {' ||
                    NVL((SELECT LISTAGG('"' || fra_dir || '": 1', ', ') WITHIN GROUP (ORDER BY fra_dir)
                        FROM (SELECT DISTINCT name as fra_dir FROM v\\$RECOVERY_FILE_DEST)), '') ||
                '}' || CHR(10) ||
                '    }' || CHR(10) ||
                '}'
            AS json_output
            FROM dual;
EOSQL
)
            echo "\\$sqlplus_output"
EOF
)
        parsed_output=$(parse_sqlplus_output "$sqlplus_output")
        if [ $? -ne 0 ]; then
            jq -nc --arg error "$parsed_output" '{"error": $error}'
            return 1
        fi

        echo "$parsed_output"
    }

    get_data_file_paths() {
        # Function to retrieve the data file path from the database. Getting the distinct file paths here as data files in some cases can spread across multiple mounted directories.
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        local alter_cmd=""
        if [ "$isCDB" == "YES" ]; then
            alter_cmd="ALTER SESSION SET CONTAINER=$pdbName;"
        fi

        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SET FEEDBACK OFF
            SET TERMOUT OFF
            $alter_cmd
            SELECT DISTINCT
                SUBSTR(file_name,
                        1,
                        INSTR(file_name, '/', -1) - 1) AS data_dir
            FROM   dba_data_files
            WHERE  file_name NOT LIKE '+%';
EOSQL
EOF
    }

    get_disk_details() {
        local ORACLE_SID="$1"
        local diskgroupName="$2"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command << 'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT d.name
            FROM v\\$asm_disk d
            JOIN v\\$asm_diskgroup g ON d.group_number = g.group_number
            WHERE g.name = '$diskgroupName';
EOSQL
EOF
}

    get_disk_device_path() {
        local ORACLE_SID="$1"
        local diskName="$2"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command << 'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT path 
                FROM v$asm_disk 
                WHERE name = '$diskName'
                AND header_status = 'MEMBER';
            EXIT;
EOSQL
EOF
    }

    get_unique_asm_disk_groups() {
    
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        local alter_cmd=""
        if [ "$isCDB" == "YES" ]; then
            alter_cmd="ALTER SESSION SET CONTAINER=$pdbName;"
        fi

        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SET FEEDBACK OFF
            SET TERMOUT OFF
            $alter_cmd
            SELECT DISTINCT SUBSTR(file_name, 2, INSTR(file_name, '/') - 2) AS diskgroup
            FROM dba_data_files
            WHERE file_name LIKE '+%';
EOSQL
EOF
}

    get_loop_device_associated_with_disk() {
        local diskName="$1"
        local toolInUse="$2"
        local udevInfo=""
        if [ "$toolInUse" == "asmlib" ]; then
            udevInfo=$(sudo udevadm info --query=all --name="/dev/oracleasm/disks/$diskName")
        else
            udevInfo=$(sudo udevadm info --query=all --name=$(cat "/dev/oracleafd/disks/$diskName"))
        fi

        # Process the output only if it contains a valid device
        local loopDev=$(echo "$udevInfo" | grep "^E: DEVNAME=" | cut -d '=' -f2)

        if [ -n "$loopDev" ]; then
            echo "$loopDev"
            return 0
        else
            return 1
        fi
    }

    get_back_file_path() {
        # back-file path refers to the underlying file or block device that the loop device is associated with. 
        local loopDevice="$1"
        local backFilePath=$(sudo -u oracle bash -c "losetup -l --noheadings $loopDevice 2>/dev/null | awk '{print \\$6}'")
        if [ $? -eq 0 ]; then
            echo "$backFilePath"
            return 0
        else
            return 1
        fi
    }

    get_asm_nfs_details() {
        local diskName="$1"
        local toolInUse="$2"
        loopDevice=$(get_loop_device_associated_with_disk $diskName $toolInUse)
        if [ -n "$loopDevice" ]; then
            backFilePath=$(get_back_file_path "$loopDevice")
            if [ -n "$backFilePath" ]; then
                mount_details=$(find_mountpoint "$backFilePath")
                mountIP=$(echo "$mount_details" | cut -d',' -f1)
                mountPoint=$(echo "$mount_details" | cut -d',' -f2)
                protocol=$(echo "$mount_details" | cut -d',' -f3)
                echo "$mountIP,$mountPoint,$protocol"
                return 0
            else
                echo "No loop device path found for disk $diskName"
                return 1
            fi
        else
            return 1
        fi
    }

    get_asm_iscsi_details() {
        local diskName="$1"
        local toolInUse="$2"
        
        if [ "$toolInUse" == "asmlib" ]; then
            rawUdevInfo=$(udevadm info --query=all --name="/dev/oracleasm/disks/$diskName")
        else
            rawUdevInfo=$(udevadm info --query=all --name=$(cat "/dev/oracleafd/disks/$diskName"))
        fi
        serialUdevInfo=$(printf '%b' "$rawUdevInfo")
        isMultipath=$(echo "$serialUdevInfo" | grep "DM_UUID=mpath-")

        if [ -n "$isMultipath" ]; then
            deviceName=$(echo "$serialUdevInfo" | grep "DEVNAME=" | awk -F= '{print $2}')
            multipathMountPointDetails=$(get_multipath_mount_details "$deviceName")
            mountIp=$(echo "$multipathMountPointDetails" | cut -d',' -f1)
            iscsiSerialNumber=$(echo "$multipathMountPointDetails" | cut -d',' -f2)
            protocol=$(echo "$multipathMountPointDetails" | cut -d',' -f3)
            mountPoint="$iscsiSerialNumber"
        else
            mountDevice=$(echo "$serialUdevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
            mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
            iscsiSerialNumber=$(echo "$serialUdevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
            mountPoint=$(echo "$mountDevice" | sed 's/.*ip-[0-9\\.]*://')

            if echo "$mountPoint" | grep -q "iscsi"; then
                protocol="iSCSI"
            else
                protocol="others"
            fi
            mountPoint=$iscsiSerialNumber
        fi
        echo "$mountIp,$mountPoint,$protocol"
    }

    is_oracle_afd_setup() {
        if lsmod | grep -q '^oracleafd'; then
            echo "true"
        else
            echo "false"
        fi
    }

    is_asmlib_setup() {
        if lsmod | grep -q '^oracleasm'; then
            echo "true"
        else
            echo "false"
        fi
    }

    get_diskgroup_mappings() {

        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        diskGroups=$(get_unique_asm_disk_groups "$ORACLE_SID" "$isCDB" "$pdbName")
        
        diskgroupMappings="["
        if [ -n "$diskGroups" ]; then
            while IFS= read -r diskGroup; do
                
                # Skip empty lines
                if [ -z "$diskGroup" ]; then
                    continue
                fi
                
                # Get first disk from the disk group, all disks in a diskgroup must follow same protocol & storage type. 
                diskName=$(get_disk_details "$ORACLE_SID" "$diskGroup" | head -n 2 | tail -n 1)
                if [ -n "$diskName" ]; then

                    isAsmLibSetup=$(is_asmlib_setup)
                    isAfdSetup=$(is_oracle_afd_setup)
                    
                    toolInUse="asmlib"
                    if [ "$isAfdSetup" == "true" ]; then
                        toolInUse="afd"
                    fi

                    if [[ "$isAsmLibSetup" == "false" && "$isAfdSetup" == "false" ]]; then
                        echo "Neither ASMLIB nor AFD is set up on the system."
                        continue
                    fi

                    result=$(get_asm_nfs_details "$diskName" "$toolInUse") || result=$(get_asm_iscsi_details "$diskName" "$toolInUse")
                    if [ $? -ne 0 ]; then
                        echo "Failed to get NFS or iSCSI details for disk $diskName"
                        continue
                    fi
                    mountIP=$(echo "$result" | cut -d',' -f1)
                    mountPoint=$(echo "$result" | cut -d',' -f2)
                    protocol=$(echo "$result" | cut -d',' -f3)

                    json_obj="{\\"isAsmManaged\\":\\"true\\", \\"mountIP\\":\\"$mountIP\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\"}"
                    
                    if [ "$diskgroupMappings" == "[" ]; then
                        diskgroupMappings+="$json_obj"
                    else
                        diskgroupMappings+=", $json_obj"
                    fi
                fi
            done <<< "$diskGroups"
            diskgroupMappings+="]"
        fi
        echo "$diskgroupMappings"
    }

    ${isASMManagedCheck}

get_data_directories_without_creds() {
        local ORACLE_SID="$1"
        local ORACLE_HOME="$2"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            spFilePath="\\$ORACLE_HOME/dbs/spfile\\$ORACLE_SID.ora"

            # For Oracle 21c, spfile will be located in ORACLE_BASE/dbs.
            if [ ! -f "\\$spFilePath" ]; then
                spFilePath="\\$ORACLE_BASE/dbs/spfile\\$ORACLE_SID.ora"
                if [ ! -f "\\$spFilePath" ]; then
                    echo "SPFILE not found"
                    exit 1
                fi
            fi
            controlFilesPath=\\$(strings "\\$spFilePath" | grep -i control_files | sed "s/.*=//;s/'//g" | tr ',' '\n' | sed '/^$/d')

            # Get the first control file path from the list, not all control files need to be checked as control files are usually exact copies of each other for an instance.
            controlFile=$(echo "\\$controlFilesPath" | head -n 1)


            # Data files entries are in the form of 'file_name = /path/to/datafile.dbf', so we will grep for '.dbf' to find data file paths and get the unique directories.
            uniqueDataFileDirectories=\\$(strings \\$controlFile | grep -i '\\.dbf' | xargs -n1 dirname | sort | uniq)
            echo "\\$uniqueDataFileDirectories"
EOF
}

get_multipath_device_info() {
    local device="$1"
    local dev_name=$(basename "$device")
    
    # Get multipath information
    local multipath_info=$(sudo multipath -ll "$dev_name" 2>/dev/null)
    if [ $? -ne 0 ] || [ -z "$multipath_info" ]; then
        multipath_info=$(sudo multipath -ll "$device" 2>/dev/null)
    fi
    echo "$multipath_info"
}

get_multipath_mount_details() {
    local device="$1"
    local multipath_info=$(get_multipath_device_info "$device")
    local underlying_devices=$(echo "$multipath_info" | grep -oE 'sd[a-z]+' | sort -u)
    
    # Try each device until we find one with valid mount information
    for dev in $underlying_devices; do
        local path_device="/dev/$dev"
        local rawUdevInfo=$(udevadm info --query=all --name=$path_device 2>/dev/null)
        local serialUdevInfo=$(printf '%b' "$rawUdevInfo")

        if [ -n "$serialUdevInfo" ]; then
            # Look for disk/by-path information
            local mountDevice=$(echo "$serialUdevInfo" | grep "disk/by-path" | grep "ip-" | head -n1 | awk '{print $2}')

            if [ -n "$mountDevice" ]; then
                local mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
                local iscsiSerialNumber=$(echo "$serialUdevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
                local protocol="iSCSI"
                echo "$mountIp,$iscsiSerialNumber,$protocol"
                return 0
            fi
        fi
    done
}

        get_directory_mount_details() {
        dataDirectory="$1"
        dataDirectories=$(echo "$dataDirectory" | tr ',' '\n' | sort -u)
        if [ -z "$dataDirectories" ]; then
            echo "[]"
            return 0
        fi
        dataDirectoryMappings="["
        while IFS= read -r dataDirectory; do
            {
                # Skip empty lines
                if [ -z "$dataDirectory" ]; then
                    continue
                fi

                mount_info=$(findmnt -T "$dataDirectory" -n -o SOURCE,FSTYPE)
                read source fstype <<< "$mount_info"

                if [ -n "$source" ]; then
                    if [[ "$fstype" != nfs* ]]; then
                        # Check if it's a multipath device
                        if echo "$source" | grep -q "^/dev/mapper/" || echo "$source" | grep -q "^/dev/dm-"; then
                            # Multipath device - use first available underlying device
                            multipathMountPointDetails=$(get_multipath_mount_details "$source")

                            mountIp=$(echo "$multipathMountPointDetails" | cut -d',' -f1)
                            iscsiSerialNumber=$(echo "$multipathMountPointDetails" | cut -d',' -f2)
                            protocol=$(echo "$multipathMountPointDetails" | cut -d',' -f3)
                            mountPoint="$iscsiSerialNumber"
                            jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\", \\"directoryPath\\":\\"$dataDirectory\\"}"
                            
                        else
                            rawUdevInfo=$(udevadm info --query=all --name=$source)
                            serialUdevInfo=$(printf '%b' "$rawUdevInfo")
                            mountDevice=$(echo "$serialUdevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
                            mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
                            iscsiSerialNumber=$(echo "$serialUdevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
                            mountPoint=$(echo "$mountDevice" | sed 's/.*ip-[0-9\\.]*://')
                            if echo "$mountPoint" | grep -q "iscsi"; then
                                protocol="iSCSI"
                                mountPoint=$iscsiSerialNumber
                                jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\", \\"directoryPath\\":\\"$dataDirectory\\"}"
                            # Check if it's an EBS device (after iSCSI check)
                            elif is_ebs_device "$source" "$dataDirectory"; then
                                volume_id=$(get_ebs_volume_details "$source" "$dataDirectory")
                                protocol="EBS"
                                jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"volumeId\\":\\"$volume_id\\", \\"protocol\\":\\"$protocol\\", \\"directoryPath\\":\\"$dataDirectory\\"}"
                            else
                                protocol="others"
                                mountPoint=$iscsiSerialNumber
                                jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\", \\"directoryPath\\":\\"$dataDirectory\\"}"
                            fi
                        fi
                    elif [[ "$fstype" == nfs* ]]; then
                        dns_name=$(echo "$source" | cut -d':' -f1)
                        mountPoint=$(echo "$source" | cut -d':' -f2-)
                        protocol="NFS"
                        # Check if dns_name already appears to be an IP address (simple check for digits and dots)
                        if [[ $dns_name =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
                            mountIp="$dns_name"
                        else
                            mountIp=$(dig +short "$dns_name")
                        fi
                        jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\", \\"directoryPath\\":\\"$dataDirectory\\"}"
                    else
                        continue
                    fi

                    if [ "$dataDirectoryMappings" == "[" ]; then
                        dataDirectoryMappings+="$jsonObj"
                    else
                        dataDirectoryMappings+=", $jsonObj"
                    fi

                fi
            } || {
                continue
            }
        done <<< "$dataDirectories"
        dataDirectoryMappings+="]"
        echo "$dataDirectoryMappings"
    }

    get_non_asm_nfs_or_iscsi_storage_details() {
        
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        local credsAvailable="$4"
        local ORACLE_HOME="$5"
        
        if [ "$credsAvailable" == "true" ]; then
            dataDirectories=$(get_data_file_paths "$ORACLE_SID" "$isCDB" "$pdbName")
        else
            dataDirectories=$(get_data_directories_without_creds "$ORACLE_SID" "$ORACLE_HOME")
            if [ $? -ne 0 ]; then
                dataDirectories=""    
            fi
        fi
        echo $(get_directory_mount_details "$dataDirectories")
    }

    is_setup_running_iscsi_sessions() {
        local iqns
        iqns=$(sudo iscsiadm -m session 2>/dev/null | grep -oP 'iqn\\.[^ ]+')
        if [ -z "$iqns" ]; then
            echo "false"
        else
            echo "true"
        fi
    }

    is_setup_asm_managed() {
        if pgrep -lf '^asm_pmon_+' >/dev/null 2>&1 ; then
            echo "true"
        else
            echo "false"
        fi
    }

    get_asm_iscsi_storage_details_without_creds() {
        iqns=$(sudo iscsiadm -m session | grep -oP 'iqn\\.[^ ]+')

        iscsiStorageMappings="["
        for iqn in $iqns; do
            # Get device path for this IQN
            device=$(ls -l /dev/disk/by-path/ | grep "$iqn" | awk '{print $9}' | head -n 1)
            if [ -z "$device" ]; then
                continue
            fi
            source="/dev/disk/by-path/$device"
            rawUdevInfo=$(sudo udevadm info --query=all --name="$source")
            serialUdevInfo=$(printf '%b' "$rawUdevInfo")
            mountDevice=$(echo "$serialUdevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
            mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
            iscsiSerialNumber=$(echo "$serialUdevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
            mountPoint=$(echo "$mountDevice" | sed 's/.*ip-[0-9\\.]*://')
            if echo "$mountPoint" | grep -q "iscsi"; then
                protocol="iSCSI"
            else
                protocol="others"
            fi
            mountPoint="$iscsiSerialNumber"
            jsonObj="{\\"isAsmManaged\\":\\"true\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\"}"
            if [ "$iscsiStorageMappings" == "[" ]; then
                iscsiStorageMappings+="$jsonObj"
            else
                iscsiStorageMappings+=", $jsonObj"
            fi
        done

        iscsiStorageMappings+="]"
        echo "$iscsiStorageMappings"
    }
    
    get_asm_nfs_storage_details_without_creds() {
        nfsStorageMappings="["
        nfsSources=$(sudo findmnt -t nfs,nfs4 -o SOURCE,TARGET | tail -n +2 | awk '{print $1}')
        while IFS= read -r source; do
            dns_name=$(echo "$source" | cut -d':' -f1)
            mountPoint=$(echo "$source" | cut -d':' -f2-)
            protocol="NFS"
        
            if [[ $dns_name =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
                mountIp="$dns_name"
            else
                mountIp=$(dig +short "$dns_name")
            fi
            jsonObj="{\\"isAsmManaged\\":\\"true\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\"}"

            if [ "$nfsStorageMappings" == "[" ]; then
                nfsStorageMappings+="$jsonObj"
            else
                nfsStorageMappings+=", $jsonObj"
            fi
        done <<< "$nfsSources"
        nfsStorageMappings+="]"
        echo "$nfsStorageMappings"
    }

    is_ebs_device() {
        local device_path="$1"
        local directory_path="$2"
        
        # Method 1: Check device naming patterns (nvme or xvd)
        if [[ "$device_path" =~ ^/dev/(nvme[0-9]+n[0-9]+|xvd[a-z]+) ]]; then
            return 0
        fi
        
        # Method 2: Check filesystem type - EBS uses local filesystems
        if command -v lsblk >/dev/null 2>&1; then
            local fstype=$(lsblk -no FSTYPE "$device_path" 2>/dev/null | head -n1)
            if [[ "$fstype" =~ ^(ext[2-4]|xfs|btrfs)$ ]]; then
                return 0
            fi
        fi
        
        # Method 3: Check directory path pattern and verify not NFS
        if [[ "$directory_path" =~ (ebs|/data|/u01|/oracle) ]] && ! mount | grep -q "$directory_path.*nfs"; then
            local real_device=$(df "$directory_path" 2>/dev/null | tail -1 | awk '{print $1}')
            if [[ "$real_device" =~ ^/dev/(nvme|xvd|sd) ]]; then
                return 0
            fi
        fi
        
        return 1
    }

    get_ebs_volume_details() {
        local device_path="$1"
        local directory_path="$2"
        local volume_id=""
        
        # Get actual device from directory if not provided
        if [ -z "$device_path" ]; then
            device_path=$(df "$directory_path" 2>/dev/null | tail -1 | awk '{print $1}')
        fi
        
        # Convert partition to whole device (e.g., nvme0n1p3 -> nvme0n1)
        local whole_device="$device_path"
        if [[ "$device_path" =~ (nvme[0-9]+n[0-9]+)p[0-9]+ ]]; then
            whole_device="/dev/\${BASH_REMATCH[1]}"
        fi
        
        # Try udevadm to get serial number
        if command -v udevadm >/dev/null 2>&1; then
            local serial=$(sudo udevadm info --query=all --name="$whole_device" 2>/dev/null | grep "ID_SERIAL_SHORT=" | cut -d'=' -f2)
            if [ -n "$serial" ]; then
                # Add hyphen after 'vol' if missing: vol02c901c8ceea1e154 -> vol-02c901c8ceea1e154
                if [[ "$serial" =~ ^vol-?([0-9a-f]+)$ ]]; then
                    echo "vol-\${BASH_REMATCH[1]}"
                    return 0
                fi
            fi
        fi
        
        # Try nvme-cli method as fallback
        if [[ "$whole_device" =~ nvme ]] && command -v nvme >/dev/null 2>&1; then
            local serial=$(sudo nvme id-ctrl "$whole_device" 2>/dev/null | grep -E '^sn\\s*:' | awk '{print $3}')
            if [[ "$serial" =~ ^vol-[0-9a-f]+$ ]]; then
                echo "$serial"
                return 0
            elif [[ "$serial" =~ ^[0-9a-f]{20}$ ]]; then
                echo "vol-$serial"
                return 0
            fi
        fi
        
        # Fallback: create identifier based on device
        if [ -n "$device_path" ]; then
            echo "ebs-$(basename "$device_path")"
        else
            echo "ebs-$(basename "$directory_path")"
        fi
    }

    get_oracle_db_mount_details() {
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        
        # Get Oracle DB file paths
        db_paths_json=$(get_oracle_db_file_paths "$ORACLE_SID" "$isCDB" "$pdbName" "NO" | tr -d '\n')
        # Validate JSON (e.g., ORA- error messages from ALTER SESSION failures in Data Guard can produce malformed output)
        if ! echo "$db_paths_json" | jq empty 2>/dev/null; then
            jq -nc --arg error "Failed to parse Oracle file paths for SID $ORACLE_SID." '{"error": $error}'
            return 1
        fi
        db_paths_error=$(echo "$db_paths_json" | jq -r '.error // empty')
        if [ -n "$db_paths_error" ]; then
            jq -nc --arg error "$db_paths_error" '{"error": $error}'
            return 1
        fi
        oracleMountDetails="{"
        for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES" "FRA"; do
            paths=$(echo "$db_paths_json" | jq -r ".$fileType.directories[]" 2>/dev/null)
            paths_csv=$(echo "$paths" | tr '\n' ',' | sed 's/,$//')
            
            # Get mount details for these paths
            if [ -n "$paths_csv" ]; then
                mountDetails=$(get_directory_mount_details "$paths_csv")
                updatedMountDetails="[]"
                for mountDetail in $(echo "$mountDetails" | jq -c '.[]'); do
                    directoryPath=$(echo "$mountDetail" | jq -r '.directoryPath')
                    
                    # Get the copy count for this specific directory path
                    copiesCount=$(echo "$db_paths_json" | jq -r --arg ft "$fileType" --arg path "$directoryPath" '.[$ft].copies_per_directory[$path] // 0')
                    
                    if [ "$copiesCount" == "null" ] || [ -z "$copiesCount" ]; then
                        copiesCount=0
                    fi
                    
                    mountDetail=$(echo "$mountDetail" | jq --arg cc "$copiesCount" '. + {copiesCount: ($cc | tonumber)}')
                    updatedMountDetails=$(echo "$updatedMountDetails" | jq --argjson md "$mountDetail" '. += [$md]')
                done
                mountDetails="$updatedMountDetails"
            else
                mountDetails="[]"
            fi
            if [ "$oracleMountDetails" != "{" ]; then
                oracleMountDetails+=","
            fi
            oracleMountDetails+="\\"$fileType\\":$mountDetails"
        done
        
        oracleMountDetails+="}"
        echo "$oracleMountDetails"
    }

    get_oracle_db_asm_mount_details() {
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"

        # Get Oracle DB file paths
        db_paths_json=$(get_oracle_db_file_paths "$ORACLE_SID" "$isCDB" "$pdbName" "YES" | tr -d '\n')
        # Validate JSON (e.g., ORA- error messages from ALTER SESSION failures in Data Guard can produce malformed output)
        if ! echo "$db_paths_json" | jq empty 2>/dev/null; then
            jq -nc --arg error "Failed to parse Oracle file paths for SID $ORACLE_SID." '{"error": $error}'
            return 1
        fi
        db_paths_error=$(echo "$db_paths_json" | jq -r '.error // empty')
        if [ -n "$db_paths_error" ]; then
            jq -nc --arg error "$db_paths_error" '{"error": $error}'
            return 1
        fi
        local isAsmLibSetup=$(is_asmlib_setup)
        local isAfdSetup=$(is_oracle_afd_setup)
                    
        local toolInUse="asmlib"
        if [ "$isAfdSetup" == "true" ]; then
            toolInUse="afd"
        fi
        oracleMountDetails="{"
        for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES" "FRA"; do
            diskgroups_csv=$(jq -r --arg ft "$fileType" '.[$ft].directories[]? | split("/") | .[0] | ltrimstr("+")' <<< "$db_paths_json" | sort -u | paste -sd ',' -)

            mountDetails="["
            if [ -n "$diskgroups_csv" ]; then
                for diskGroup in $(echo "$diskgroups_csv" | tr ',' ' '); do
                    diskNames=$(get_disk_details "$ORACLE_SID" "$diskGroup")
                    if [ -n "$diskNames" ]; then
                        # Get the copy count for this disk group
                        diskgroupPath="+$diskGroup"
                        copiesCount=$(echo "$db_paths_json" | jq -r --arg ft "$fileType" --arg dg "$diskgroupPath" '
                            .[$ft].copies_per_directory | 
                            to_entries | 
                            map(select(.key | startswith($dg)) | .value) | 
                            add // 0
                            ')
                        if [ "$copiesCount" == "null" ] || [ -z "$copiesCount" ]; then
                            copiesCount=0
                        fi
                        while IFS= read -r diskName; do
                            [ -z "$diskName" ] && continue
                            result=$(get_asm_nfs_details "$diskName" "$toolInUse") || result=$(get_asm_iscsi_details "$diskName" "$toolInUse")
                            if [ $? -ne 0 ]; then
                                continue
                            fi
                            mountIP=$(echo "$result" | cut -d',' -f1)
                            mountPoint=$(echo "$result" | cut -d',' -f2)
                            protocol=$(echo "$result" | cut -d',' -f3)

                            json_obj="{\\"isAsmManaged\\":\\"true\\", \\"mountIP\\":\\"$mountIP\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\", \\"diskName\\":\\"$diskName\\", \\"diskGroup\\":\\"$diskGroup\\", \\"copiesCount\\":$copiesCount}"

                            if [ "$mountDetails" == "[" ]; then
                                mountDetails+="$json_obj"
                            else
                                mountDetails+=", $json_obj"
                            fi
                        done <<< "$diskNames"
                    fi
                done
                mountDetails+="]"
            else
                mountDetails="[]"
            fi
            if [ "$oracleMountDetails" != "{" ]; then
                oracleMountDetails+=","
            fi
            oracleMountDetails+="\\"$fileType\\":$mountDetails"
        done

        oracleMountDetails+="}"
        echo "$oracleMountDetails"
    }
`;

const getInstanceStorageDetails = `
    isASMManaged=$(check_asm_managed $sid)
    storageDetails="["
    if [ "$isASMManaged" == "TRUE" ]; then
        # If multiple PDBs are present, loop through each PDB. As underlying storage & protocol can differ for each PDB.
        if [ "$is_cdb" == "YES" ]; then
            for pdb_name in $pdb_names; do
                pdbStorageDetails=$(get_diskgroup_mappings "$sid" "$is_cdb" "$pdb_name")
                if [ "$storageDetails" == "[" ]; then
                    storageDetails+="$pdbStorageDetails"
                else
                    storageDetails+=", $pdbStorageDetails"
                fi
            done
        else
            singleInstanceDbStorageDetails=$(get_diskgroup_mappings "$sid" "$is_cdb" "null")
            storageDetails+="$singleInstanceDbStorageDetails"
        fi
    else
        if [ "$is_cdb" == "YES" ]; then
            for pdb_name in $pdb_names; do
                pdbStorageDetails=$(get_non_asm_nfs_or_iscsi_storage_details "$sid" "$is_cdb" "$pdb_name" "true" "$oracle_home")
                if [ "$storageDetails" == "[" ]; then
                    storageDetails+="$pdbStorageDetails"
                else
                    storageDetails+=", $pdbStorageDetails"
                fi
            done
        else
            singleInstanceDbStorageDetails=$(get_non_asm_nfs_or_iscsi_storage_details "$sid" "$is_cdb" "null" "true" "$oracle_home")
            storageDetails+="$singleInstanceDbStorageDetails"
        fi
    fi
    storageDetails+="]"
`;

const getStorageWithoutCreds = `
    isASMManaged=$(is_setup_asm_managed)
    if [ "$isASMManaged" == "true" ]; then
        isSetupRunningISCSISessions=$(is_setup_running_iscsi_sessions)
        if [ "$isSetupRunningISCSISessions" == "true" ]; then
            storageDetails=$(get_asm_iscsi_storage_details_without_creds)
        else
            storageDetails=$(get_asm_nfs_storage_details_without_creds)
        fi

        # there can be a case where iscsi sessions are running but no iscsi devices are found, so try getting nfs storage details in that case.
        if [ "$isSetupRunningISCSISessions" == "true" ] && [ "$storageDetails" == "[]" ]; then
            storageDetails=$(get_asm_nfs_storage_details_without_creds)
        fi
    else
        storageDetails=$(get_non_asm_nfs_or_iscsi_storage_details "$sid" "NO" "null" "false" "$oracle_home")
    fi
`;

const getOracleServiceInstanceConnections = `
    get_tns_connection() {
        dbSid="$1"
        oracle_home=$(${getOracleHomePath('$dbSid')})
        tns_file=$(printf "%s/network/admin/tnsnames.ora" $oracle_home)
        tns_config=$(sudo -i -u oracle bash <<EOF
            export ORACLE_HOME="$oracle_home"
            TNS_config=$(awk -v alias="$dbSid" '
                BEGIN { IGNORECASE = 1; found = 0 }
                /^[[:space:]]*#/ { next }
                /^[[:space:]]*$/ { if(found) exit; else next }
                /^[[:alnum:]_]+[[:space:]]*=/ {
                    n = $1; sub(/=.*/,"",n)
                    if (toupper(n) == toupper(alias)) {
                        found = 1
                    } else if(found) {
                        exit
                    }
                }
                found {
                    if (match($0, /HOST[[:space:]]*=[[:space:]]*([^)]*)/, h))
                        host = h[1]
                    if (match($0, /PORT[[:space:]]*=[[:space:]]*([^)]*)/, p)) {
                        port = p[1]
                        printf "%s:%s", host, port
                        exit
                    }
                }
            ' $tns_file)
        echo "\\$TNS_config"
EOF
    )
    echo $tns_config
}
`;

const loadDatabaseDetectionModules = `
    get_instance_details() {
        local ORACLE_SID="$1"
        local isMounted="\${2:-false}"
        
        if [ "$isDefaultAuth" == "true" ]; then
            if [[ "$isMounted" == "true" ]]; then
                # For MOUNTED instances, use v$database.OPEN_MODE instead of v$instance.STATUS
                # v$instance.STATUS shows "STARTED" but we need the actual open mode ("MOUNTED")
                # Cross-join works because both v$instance and v$database are single-row views
                sudo -i -u oracle bash <<EOF
                    export ORACLE_SID="$ORACLE_SID"
                    export ORACLE_HOME="$ORACLE_HOME"
                    export PATH="$ORACLE_HOME/bin:\\$PATH"
                    $sqlplus_command <<'EOSQL'
                        SET HEADING OFF
                        SET LINESIZE 500
                        SET FEEDBACK OFF
                        SET PAGESIZE 0
                        SELECT JSON_OBJECT(
                                'instance_id' value i.INSTANCE_NAME,
                                'instance_name' value i.INSTANCE_NAME,
                                'host_name' value i.HOST_NAME,
                                'version' value i.VERSION,
                                'instance_state' value d.OPEN_MODE
                            ) AS instance_info
                        FROM v\\$instance i, v\\$database d;
EOSQL
EOF
            else
                # For non-MOUNTED (OPEN) instances, STATUS from v$instance is correct
                sudo -i -u oracle bash <<EOF
                    export ORACLE_SID="$ORACLE_SID"
                    export ORACLE_HOME="$ORACLE_HOME"
                    export PATH="$ORACLE_HOME/bin:\\$PATH"
                    $sqlplus_command <<'EOSQL'
                        SET HEADING OFF
                        SET LINESIZE 500
                        SELECT JSON_OBJECT(
                                'instance_id' value INSTANCE_NAME,
                                'instance_name' value INSTANCE_NAME,
                                'host_name' value HOST_NAME,
                                'version' value VERSION,
                                'instance_state' value STATUS
                            ) AS instance_info
                        FROM V\\$INSTANCE;
EOSQL
EOF
            fi
        else
            # No credentials available - try to get open_mode via OS auth for MOUNTED instances
            local open_mode="OPEN"
            if [[ "$isMounted" == "true" ]]; then
                open_mode_result=$(sudo -i -u oracle bash -s -- "$ORACLE_SID" <<'EOF'
                    export ORACLE_SID="$1"
                    sqlplus -S / as sysdba 2>/dev/null <<'EOSQL'
                        SET HEADING OFF
                        SET FEEDBACK OFF
                        SET PAGESIZE 0
                        SELECT open_mode FROM v$database;
                        EXIT;
EOSQL
EOF
)
                parsed_open_mode=$(parse_sqlplus_output "$open_mode_result")
                if [ $? -eq 0 ] && [ -n "$parsed_open_mode" ]; then
                    open_mode="$parsed_open_mode"
                fi
            fi

            local result="{\\"instance_name\\": \\"$ORACLE_SID\\", \\"instance_state\\": \\"$open_mode\\", \\"version\\": \\"undefined\\", \\"instance_id\\": \\"$ORACLE_SID\\", \\"hostname\\": \\"undefined\\"}"
            echo $result
        fi
    }

    get_database_details() {
        local ORACLE_SID="$1"
        local jsonRes
        jsonRes=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
                WHENEVER SQLERROR EXIT SQL.SQLCODE
                SET HEADING OFF
                SET LINESIZE 500
                SELECT JSON_OBJECT(
                    'name' value NAME,
                    'database_id' value DBID,
                    'created' value CREATED,
                    'open_mode' value OPEN_MODE,
                    'is_cdb' value CDB,
                    'status' VALUE CASE
                            WHEN open_mode = 'READ WRITE' THEN 'ONLINE'
                            ELSE 'OFFLINE'
                        END
                )
                FROM V\\$DATABASE;
EOSQL
EOF
) || return 1
    
        echo $jsonRes
    }

    get_pdb_databases_details() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'pdb_id' value PDB_ID,
                'pdb_name' value PDB_NAME,
                'status' value STATUS
            )
        ) AS pdb_info
            FROM DBA_PDBS;
EOSQL
EOF
    }

    get_pdbs_sizes() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT JSON_OBJECTAGG(
                    p.PDB_NAME VALUE ROUND(SUM(df.BYTES), 2)
                ) AS pdb_sizes_json
            FROM V\\$DATAFILE df
            JOIN DBA_PDBS p ON df.CON_ID = p.CON_ID
            GROUP BY p.PDB_NAME;
EOSQL
EOF
    }

    get_cdb_or_single_instance_db_size() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT ROUND(SUM(BYTES), 2) AS db_size_gb
            FROM   DBA_DATA_FILES;
EOSQL
EOF
    }

    get_pdbs_active_status() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'pdb_name' VALUE NAME,
                    'open_mode' VALUE OPEN_MODE,
                    'creation_time' VALUE TO_CHAR(CREATION_TIME, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'status' VALUE CASE
                            WHEN open_mode = 'READ WRITE' THEN 'ONLINE'
                            ELSE 'OFFLINE'
                        END
                    )
                ) AS pdb_status_json
            FROM V\\$PDBS;
EOSQL
EOF
    }

    get_pdbs_count() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF
            SET LINESIZE 500
            SELECT COUNT(*) AS pdb_count FROM DBA_PDBS;
EOSQL
EOF
    }

    get_open_pdb_names() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF FEEDBACK OFF PAGESIZE 0 LINESIZE 500
            SELECT NAME FROM V\\$PDBS
            WHERE NAME != 'PDB\\$SEED'
            AND OPEN_MODE IN ('READ WRITE', 'READ ONLY');
EOSQL
EOF
    }

    get_mounted_pdb_names() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            export ORACLE_HOME="$ORACLE_HOME"
            export PATH="$ORACLE_HOME/bin:\\$PATH"
            $sqlplus_command <<'EOSQL'
            SET HEADING OFF FEEDBACK OFF PAGESIZE 0 LINESIZE 500
            SELECT NAME FROM V\\$PDBS
            WHERE NAME != 'PDB\\$SEED'
            AND OPEN_MODE NOT IN ('READ WRITE', 'READ ONLY');
EOSQL
EOF
    }
`;

const checkOraclePermissionsInDiscovery = `

    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    ec2InstanceId=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/instance-id)
    ${loadOracleUserPermissionsDetectionModule}
    ${oracleUserAuthLoginCommand}

    check_oracle_missing_permissions() {
        local oracleSid="$1"
        result=$(get_oracle_user_auth_login_command "$oracleSid" "$ec2InstanceId")
        sqlplus_command=$(echo "$result" | cut -d'|' -f1)

        # Extract username from sqlplus_command
        username=$(sed -n 's/.* -S \\([^/]*\\)\\/.*/\\1/p' <<< "$sqlplus_command")
        missingPermissions="[]"
        if [ -z "$username" ]; then
            # credentials not available, so cannot check permissions.
            missingPermissions="[\\"CREATE SESSION\\", \\"SELECT CATALOG ROLE\\", \\"SET CONTAINER ROLE\\", \\"SET CONTAINER_DATA\\"]"
        else 
            isCreateSessionRoleGranted=$(is_create_session_granted)

            if [ "$username" == "sys" ]; then
                # SYS user has all privileges, so we don't need to check for permissions.
                missingPermissions="[]"
            elif [ "$isCreateSessionRoleGranted" == "false" ]; then
                missingPermissions="[\\"CREATE SESSION\\"]"
            else
                isSelectCatalogRoleGranted=$(check_for_select_catalog_permission)

                isCDBInstance=$(is_cdb_instance)

                if [ $isCDBInstance == "true" ]; then
                    # Perform actions specific to CDB instances
                    isSetContainerRoleGranted=$(check_for_set_container_permission)
                    isContainerDataPermissionGranted=$(check_for_container_data_permission)

                    missingPermissions="["
                    if [ "$isSetContainerRoleGranted" == "false" ]; then
                        missingPermissions="$missingPermissions\\"SET CONTAINER ROLE\\","
                    fi
                    if [ "$isContainerDataPermissionGranted" == "false" ]; then
                        missingPermissions="$missingPermissions\\"SET CONTAINER_DATA\\","
                    fi
                    if [ "$isSelectCatalogRoleGranted" == "false" ]; then
                        missingPermissions="$missingPermissions\\"SELECT CATALOG ROLE\\","
                    fi
                    # Remove trailing comma if any
                    missingPermissions="\${missingPermissions%,}]"
                else
                    # Perform actions specific to non-CDB instances
                    if [ "$isSelectCatalogRoleGranted" == "false" ]; then
                        missingPermissions="[\\"SELECT CATALOG ROLE\\"]"
                    fi
                fi
            fi
        fi

        echo "$missingPermissions"
    }

    check_remediation_missing_permissions() {
        local oracleSid="$1"
        result=$(get_oracle_user_auth_login_command "$oracleSid" "$ec2InstanceId")
        sqlplus_command=$(echo "$result" | cut -d'|' -f1)

        # Extract username from sqlplus_command
        username=$(sed -n 's/.* -S \\([^/]*\\)\\/.*/\\1/p' <<< "$sqlplus_command")
        remediationMissingPermissions="[]"
        if [ -z "$username" ]; then
            # credentials not available, so cannot check permissions.
            remediationMissingPermissions="[\\"ALTER SYSTEM\\"]"
        else
            isAlterSystemGranted=$(check_for_alter_system_permission)

            if [ "$isAlterSystemGranted" == "false" ]; then
                remediationMissingPermissions="[\\"ALTER SYSTEM\\"]"
            fi
        fi

        echo "$remediationMissingPermissions"
    }
`;

const discoverOracleHosts = `
    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi

    # Use default auth command for SQLPlus in discovery scripts
    sqlplus_command="sqlplus -S / as sysdba"

    RESULTS="["  # start of the JSON array
    FIRST=1      # flag to determine the first object

    # Parse /etc/oratab, ignoring comment lines (#), lines starting with (+) and blank lines
    # SIDS=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    if [ -z "$oratab_entries" ]; then
        echo "No entries found in /etc/oratab."
        exit 0
    fi

    ${defaultAuthDetectModule}
    ${loadDatabaseDetectionModules}
    ${loadStorageDetectionModules}
    ${checkOracleModuleAvailability}
    ${getDataguardDeploymentDetails}

    hostname=$(hostname -f 2>/dev/null || hostname)
    RESULTS="{\\"hostname\\":\\"$hostname\\", \\"dbInstances\\":["

    while IFS=: read -r sid oracle_home; do
        InstanceDiscoverErrorMsg=""
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        isDefaultAuth=$(is_default_auth "$sid")
        if [ $? -ne 0 ]; then
            InstanceDiscoverErrorMsg="failed to retrieve authentication details for instance '$sid'"
        fi
        isMounted=$(is_mounted_instance "$sid")
        modulesAvailability=$(check_oracle_module_availability)

        {
            INSTANCE_DETAILS=$(get_instance_details "$sid" "$isMounted")
            DATABASE_DETAILS=$(get_database_details "$sid")
            if [ $? -ne 0 ]; then
                DATABASE_DETAILS='{"error": "failed to retrieve database details for instance '$sid'"}'
            fi

            if [ "$isDefaultAuth" == "true" ]; then
                # For MOUNTED instances (e.g., physical standby), skip PDB queries
                # DBA_PDBS is not accessible in MOUNTED mode (ORA-01219)
                if [[ "$isMounted" == "true" ]]; then
                    PDB_DATABASE_DETAILS="[]"
                    is_cdb="NO"
                else
                    is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')
                    if [[ "$is_cdb" == "YES" ]]; then
                        PDB_DATABASE_DETAILS=$(get_pdb_databases_details "$sid")
                        pdb_names=$(get_open_pdb_names "$sid" | tr -d ' ' | tr '\\n' ' ')
                    else
                        PDB_DATABASE_DETAILS="[]"
                    fi
                fi

                ${getInstanceStorageDetails}
                # Default auth enabled means the user has sysdba privileges, so no missing permissions.
                missingPermissions="[]"
                remediationMissingPermissions="[]"
            else
                PDB_DATABASE_DETAILS="[]"
                is_cdb="NO"
                ${getStorageWithoutCreds}
                ${checkOraclePermissionsInDiscovery}
                isAwsCliInstalled=$(echo "$modulesAvailability" | grep -o '"isAwsCliInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
                isJqInstalled=$(echo "$modulesAvailability" | grep -o '"isJqInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
                if [[ "$isAwsCliInstalled" == "true"  && "$isJqInstalled" == "true" ]]; then
                    missingPermissions=$(check_oracle_missing_permissions "$sid")
                    remediationMissingPermissions=$(check_remediation_missing_permissions "$sid")
                else
                    missingPermissions="[\\"na\\"]"
                fi
            fi
        } || {
            InstanceDiscoverErrorMsg="Failed to retrieve details for instance $sid. Skipping."
        }
        isDataguardDeployed=false
        dataguardDetails="{}"    
        check_dataguard_deployment "$sid"
        if [ $? -eq 0 ]; then
            
            isDataguardDeployed=true
            # Use with-creds path when we have default auth (works even for MOUNTED standbys)
            if [ "$isDefaultAuth" == "true" ]; then
                dataguardDetails=$(get_dataguard_details_with_creds "$sid" "NO" "")
            elif [ "$oracleCredsAvailable" == "true" ]; then
                dataguardDetails=$(get_dataguard_details_with_creds "$sid" "NO" "")
            else
                dataguardDetails=$(get_dataguard_details_without_creds "$sid")
            fi
        fi

        if [ -n "$InstanceDiscoverErrorMsg" ]; then
            JSON_OBJ="{\\"sid\\":\\"$sid\\", \\"error\\":\\"$InstanceDiscoverErrorMsg\\" }"
        else
            JSON_OBJ="{\\"sid\\":\\"$sid\\", \\"instance_details\\": $INSTANCE_DETAILS, \\"database_details\\": $DATABASE_DETAILS, \\"pdb_database_details\\": $PDB_DATABASE_DETAILS, \\"storage_details\\": $storageDetails, \\"is_default_auth\\": $isDefaultAuth, \\"modules_availability\\": $modulesAvailability, \\"missing_permissions\\": $missingPermissions, \\"remediation_missing_permissions\\": $remediationMissingPermissions, \\"isDataguardDeployed\\": $isDataguardDeployed, \\"dataguard_details\\": $dataguardDetails }"
        fi


        # If not the first object, prepend a comma in the JSON array.
        if [ $FIRST -eq 1 ]; then
            RESULTS+="$JSON_OBJ"
            FIRST=0
        else
            RESULTS+=", $JSON_OBJ"
        fi

    done <<< "$oratab_entries"

    RESULTS+="]}"  # end of the JSON array
    echo $RESULTS
`;

const getStorageDetailsForRegisteredInstances = (ec2InstanceId: string, dbSid: string) => `
    # Function to get storage details for registered Oracle instances.
    ec2InstanceId="${ec2InstanceId}"
    dbSid="${dbSid}"
    dbSid_temp="${dbSid}_temp"
    oracleCredsAvailable="false"

    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi


    # Parse /etc/oratab, ignoring comment lines (#), lines starting with (+) and blank lines
    # SIDS=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    if [ -z "$oratab_entries" ]; then
        echo "No entries found in /etc/oratab."
        exit 0
    fi

    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
    ${loadOracleUserPermissionsDetectionModule}
    ${loadDatabaseDetectionModules}

    while IFS=: read -r sid oracle_home; do
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        if [ "$sid" != "$dbSid" ]; then
            continue
        fi

        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
            if [ "$(is_cdb_instance)" == "true" ]; then
                is_cdb="YES"
                pdb_names=$(get_open_pdb_names "$dbSid" | tr -d ' ' | tr '\\n' ' ')
                mounted_pdb_names=$(get_mounted_pdb_names "$dbSid" | tr -d ' ' | tr '\\n' ' ')
            else
                is_cdb="NO"
                pdb_names=""
                mounted_pdb_names=""
            fi
            ${loadStorageDetectionModules}
            ${getInstanceStorageDetails}
        else
            ${getStorageWithoutCreds}
            mounted_pdb_names=""
        fi

        if [ -n "$pdb_names" ]; then
            pdb_names_json=$(echo "$pdb_names" | awk '{for(i=1;i<=NF;i++) printf "\\"%s\\"%s", $i, (i<NF?",":"") }')
            pdb_names="[$pdb_names_json]"
        else
            pdb_names="[]"
        fi
        mounted_pdb_names_json="[]"
        if [ -n "$mounted_pdb_names" ]; then
            mounted_pdb_names_json="["
            firstMpdb=true
            for mpdb in $mounted_pdb_names; do
                if [ "$firstMpdb" = true ]; then
                    firstMpdb=false
                else
                    mounted_pdb_names_json+=","
                fi
                mounted_pdb_names_json+="\\"$mpdb\\""
            done
            mounted_pdb_names_json+="]"
        fi
        results="{\\"storage_details\\": $storageDetails, \\"is_cdb\\": \\"$is_cdb\\", \\"pdb_names\\": $pdb_names, \\"mounted_pdbs\\": $mounted_pdb_names_json}"
    done <<< "$oratab_entries"

    echo $results
`;

const fetchOracleDatabasesCount = (ec2InstanceId: string, dbSid: string) => `
    ec2InstanceId="${ec2InstanceId}"
    dbSid="${dbSid}"
    oracleCredsAvailable="false"

    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi


    # Parse /etc/oratab, ignoring comment lines (#), lines starting with (+) and blank lines
    # SIDS=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    if [ -z "$oratab_entries" ]; then
        echo "No entries found in /etc/oratab."
        exit 0
    fi

    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
    ${loadDatabaseDetectionModules}

    while IFS=: read -r sid oracle_home; do
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        if [ "$sid" != "$dbSid" ]; then
            continue
        fi

        isDefaultAuth=$(is_default_auth "$sid")

        DATABASE_DETAILS=$(get_database_details "$sid")
        
        
        is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')


        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
            if [ "$is_cdb" == "YES" ]; then
                databasesCount=$(get_pdbs_count "$sid")
            else
                databasesCount=1
            fi
        else
            databasesCount=0
        fi
        
        results="{\\"databases_count\\": $databasesCount}"
    done <<< "$oratab_entries"

    echo $results
`;

const fetchOracleDatabasesDetails = (ec2InstanceId: string, dbSid: string) => `
    ec2InstanceId="${ec2InstanceId}"
    dbSid="${dbSid}"
    oracleCredsAvailable="false"

    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "[]"
        exit 0
    fi


    # Parse /etc/oratab, ignoring comment lines (#), lines starting with (+) and blank lines
    # SIDS=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    if [ -z "$oratab_entries" ]; then
        echo "No entries found in /etc/oratab."
        exit 0
    fi

    ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
    ${loadDatabaseDetectionModules}
    ${parseSqlplusOutput}

    while IFS=: read -r sid oracle_home; do
        errorMessage=""
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        if [ "$sid" != "$dbSid" ]; then
            continue
        fi

        isDefaultAuth=$(is_default_auth "$sid")
        
        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
            DATABASE_DETAILS=$(get_database_details "$sid")
            root_db_size=$(parse_sqlplus_output "$(get_cdb_or_single_instance_db_size "$sid")")
            sqlplus_exit_code=$?
            if [ $sqlplus_exit_code -ne 0 ]; then
                errorMessage=$root_db_size
            fi
            is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')

            if [ "$is_cdb" == "YES" ]; then
                pdbs_size=$(get_pdbs_sizes "$sid")
                pdbs_status=$(get_pdbs_active_status "$sid")
            else
                pdbs_size="null"
                pdbs_status="null"
            fi
        else
            DATABASE_DETAILS='{"error": "failed to retrieve database details, credentials not available for instance '$sid'"}'
            pdbs_size="null"
            pdbs_status="null"
            root_db_size="null"
            is_cdb="NO"
        fi
        ${getOracleServiceInstanceConnections}
        service_name=$(get_tns_connection "$sid" 2>/dev/null || true)
        service_name=$(echo "$service_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -z "$service_name" ] || [ "$service_name" = "null" ]; then
            service_name=""
        fi

        if [ -n "$errorMessage" ]; then
            results="{\\"error\\": \\"$errorMessage\\"}"
        else
            results="{\\"database_details\\": $DATABASE_DETAILS, \\"pdbs_size\\": $pdbs_size, \\"root_db_size\\": \\"$root_db_size\\", \\"pdbs_status\\": $pdbs_status, \\"is_cdb\\": \\"$is_cdb\\", \\"service_name\\": \\"$service_name\\"}"
        fi
    done <<< "$oratab_entries"
    echo "$results" | tr -d '\r\n' | tr -d '\n' 
`;

const getOracleDbMountDetails = (ec2InstanceId: string, oracleSids: string[]) => `
    oratab_entries=$(grep -Ev '^(#|\\+)' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1":"$2}')
    # Convert oracleSids to bash array and filter oratab_entries
    oracleSidsString="${oracleSids.join(',')}"
    IFS=',' read -ra oracleSidsArray <<< "$oracleSidsString"

    # Create filtered oratab entries containing only the specified SIDs
    filtered_oratab_entries=""
    while IFS=: read -r sid oracle_home; do
        for target_sid in "\${oracleSidsArray[@]}"; do
            if [ "$sid" = "$target_sid" ]; then
                if [ -z "$filtered_oratab_entries" ]; then
                    filtered_oratab_entries="$sid:$oracle_home"
                else
                    filtered_oratab_entries="$filtered_oratab_entries"$'\n'"$sid:$oracle_home"
                fi
                break
            fi
        done
    done <<< "$oratab_entries"

    # Use filtered entries instead of all oratab_entries
    oratab_entries="$filtered_oratab_entries"
    # Initialize final result JSON
    finalResult="{"
    firstSid=true
    while IFS=: read -r sid oracle_home; do
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi
        ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, '$sid')}
        ${loadDatabaseDetectionModules}
        ${loadStorageDetectionModules}

        isDefaultAuth=$(is_default_auth "$sid")

        export ORACLE_HOME="$oracle_home"
        export PATH="$oracle_home/bin:$PATH"
        if [ "$isDefaultAuth" == "true" ]; then
            sqlplus_command="$oracle_home/bin/sqlplus -S / as sysdba"
        fi

        {
            INSTANCE_DETAILS=$(get_instance_details "$sid")
            DATABASE_DETAILS=$(get_database_details "$sid")
            if [ $? -ne 0 ]; then
                DATABASE_DETAILS='{"error": "failed to retrieve database details for instance '$sid'"}'
            fi
            
            is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')

            if [ "$is_cdb" == "YES" ]; then
                pdb_names=$(get_open_pdb_names "$sid" | tr -d ' ' | tr '\\n' ' ')
                mounted_pdb_names=$(get_mounted_pdb_names "$sid" | tr -d ' ' | tr '\\n' ' ')
            else
                mounted_pdb_names=""
            fi
            
            isASMManaged=$(check_asm_managed $sid)
            # Add comma if not first SID
            if [ "$firstSid" = true ]; then
                firstSid=false
            else
                finalResult+=","
            fi

            # Build mountedPdbs JSON array
            mountedPdbsJson="[]"
            if [ -n "$mounted_pdb_names" ]; then
                mountedPdbsJson="["
                firstMounted=true
                for mpdb in $mounted_pdb_names; do
                    if [ "$firstMounted" = true ]; then
                        firstMounted=false
                    else
                        mountedPdbsJson+=","
                    fi
                    mountedPdbsJson+="\\"$mpdb\\""
                done
                mountedPdbsJson+="]"
            fi
            
            if [ "$isASMManaged" == "TRUE" ]; then
                if [ "$is_cdb" == "YES" ]; then
                    mountDetailsFailed=false
                    mountDetailsError=""
                    finalResult+="\\"$sid\\": {\\"isCDB\\": true, \\"isASMManaged\\": true, \\"mountedPdbs\\": $mountedPdbsJson, \\"pdbMountDetails\\": {"
                    firstPdb=true
                    
                    for pdb_name in $pdb_names; do
                        if [ "$firstPdb" = true ]; then
                            firstPdb=false
                        else
                            finalResult+=","
                        fi
                        
                        # Get mount details for this PDB
                        pdbMountDetails=$(get_oracle_db_asm_mount_details "$sid" "$is_cdb" "$pdb_name")
                        if [ $? -ne 0 ]; then
                            mountDetailsFailed=true
                            if [ -z "$mountDetailsError" ]; then
                                mountDetailsError=$(echo "$pdbMountDetails" | jq -r '.error // empty' 2>/dev/null)
                                if [ -z "$mountDetailsError" ]; then
                                    mountDetailsError="Mount detail retrieval failed for PDB $pdb_name."
                                fi
                            fi
                        fi
                        finalResult+="\\"$pdb_name\\": $pdbMountDetails"
                    done
                    
                    if [ "$mountDetailsFailed" = true ]; then
                        escapedMountDetailsError=$(jq -Rn --arg error "$mountDetailsError" '$error')
                        finalResult+="}, \\"error\\": $escapedMountDetailsError}"
                    else
                        finalResult+="}}"
                    fi
                else
                    mountDetails=$(get_oracle_db_asm_mount_details "$sid" "$is_cdb" "")
                    if [ $? -ne 0 ]; then
                        mountDetailsError=$(echo "$mountDetails" | jq -r '.error // empty' 2>/dev/null)
                        if [ -z "$mountDetailsError" ]; then
                            mountDetailsError="Mount detail retrieval failed for SID $sid."
                        fi
                        escapedMountDetailsError=$(jq -Rn --arg error "$mountDetailsError" '$error')
                        finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": true, \\"error\\": $escapedMountDetailsError}"
                    else
                        finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": true, \\"mountDetails\\": $mountDetails}"
                    fi
                fi
            else
                if [ "$is_cdb" == "YES" ]; then
                    # Handle CDB with PDBs
                    mountDetailsFailed=false
                    mountDetailsError=""
                    finalResult+="\\"$sid\\": {\\"isCDB\\": true, \\"isASMManaged\\": false, \\"mountedPdbs\\": $mountedPdbsJson, \\"pdbMountDetails\\": {"
                    firstPdb=true
                    
                    for pdb_name in $pdb_names; do
                        if [ "$firstPdb" = true ]; then
                            firstPdb=false
                        else
                            finalResult+=","
                        fi
                        
                        # Get mount details for this PDB
                        pdbMountDetails=$(get_oracle_db_mount_details "$sid" "$is_cdb" "$pdb_name")
                        if [ $? -ne 0 ]; then
                            mountDetailsFailed=true
                            if [ -z "$mountDetailsError" ]; then
                                mountDetailsError=$(echo "$pdbMountDetails" | jq -r '.error // empty' 2>/dev/null)
                                if [ -z "$mountDetailsError" ]; then
                                    mountDetailsError="Mount detail retrieval failed for PDB $pdb_name."
                                fi
                            fi
                        fi
                        finalResult+="\\"$pdb_name\\": $pdbMountDetails"
                    done
                    
                    if [ "$mountDetailsFailed" = true ]; then
                        escapedMountDetailsError=$(jq -Rn --arg error "$mountDetailsError" '$error')
                        finalResult+="}, \\"error\\": $escapedMountDetailsError}"
                    else
                        finalResult+="}}"
                    fi
                else
                    # Handle single instance DB
                    mountDetails=$(get_oracle_db_mount_details "$sid" "$is_cdb" "")
                    if [ $? -ne 0 ]; then
                        mountDetailsError=$(echo "$mountDetails" | jq -r '.error // empty' 2>/dev/null)
                        if [ -z "$mountDetailsError" ]; then
                            mountDetailsError="Mount detail retrieval failed for SID $sid."
                        fi
                        escapedMountDetailsError=$(jq -Rn --arg error "$mountDetailsError" '$error')
                        finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": false, \\"error\\": $escapedMountDetailsError}"
                    else
                        finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": false, \\"mountDetails\\": $mountDetails}"
                    fi
                fi
            fi
        } || {
            echo "Failed to retrieve details for instance $sid. Skipping."
            continue
        }
    done <<< "$oratab_entries"
    finalResult+="}"
    mountPointData=$(echo "$finalResult" | tr -d '\n')
`;

const getMappedOntapDataVolumeForInstance = (
    ec2InstanceId: string,
    oracleSids: string[],
    fsxnId: string,
    region: string
) => `
    ${debugLog(`${LINUX_LOG_DIRECTORY}/mappedontapvolumes.log`)}

    # Ensure log directory exists
    mkdir -p ${LINUX_LOG_DIRECTORY}

    log "Starting getMappedOntapDataVolumeForInstance"
    log "Parameters: ec2InstanceId=${ec2InstanceId}, oracleSids=${oracleSids.join()}, fsxnId=${fsxnId}, region=${region}"

    # Redirect stderr to log file to prevent Oracle/sqlplus noise from polluting SSM StandardErrorContent
    exec 2>>${LINUX_LOG_DIRECTORY}/mappedontapvolumes.log

    ${getOracleDbMountDetails(ec2InstanceId, oracleSids)}
    processMountDetail() {
        local mountDetail="$1"
        local fileTypeVolumes="[]"
        local mountIP=$(echo "$mountDetail" | jq -r '.mountIP')
        local mountPoint=$(echo "$mountDetail" | jq -r '.mountPoint')
        local mountProtocol=$(echo "$mountDetail" | jq -r '.protocol')
        local isAsm=$(echo "$mountDetail" | jq -r '.isAsmManaged')
        local copiesCount=$(echo "$mountDetail" | jq -r '.copiesCount // 0')
        local volumeName
        local volumeId
        local lunName
        local lunId
        local volumeEntry
        local lunExists
        local lunRecord
        local diskName
        local diskGroup

        log "Extracted mount details - IP: $mountIP, Point: $mountPoint, Protocol: $mountProtocol, ASM: $isAsm"

        if [ -z "$protocol" ]; then
            protocol="$mountProtocol"
        fi
        
        if [ "$isAsm" == "true" ]; then
            isASMManaged="true"
            diskName=$(echo "$mountDetail" | jq -r '.diskName')
            diskGroup=$(echo "$mountDetail" | jq -r '.diskGroup')
        fi
        
        log "Calling getMappedOntapDataVolume for mountIP: $mountIP, mountPoint: $mountPoint, protocol: $mountProtocol"
        ${getMappedOntapDataVolume(fsxnId, region, '$mountIP', '$mountPoint', '$mountProtocol')}
        
        volumeName="$mountedVolume"
        volumeId="$mountedVolumeId"
        log "Retrieved volume mapping - Name: $volumeName, ID: $volumeId, SVM: $svmName"
        
        if [ "$mountProtocol" == "iSCSI" ]; then
            # For iSCSI, extract LUN details
            lunName=$(echo "$response" | jq -r '.records[0].name')
            volumeEntry="{\\"volumeName\\": \\"$volumeName\\",\\"volumeId\\": \\"$volumeId\\", \\"svmName\\": \\"$svmName\\", \\"svmId\\": \\"$svmId\\", \\"lunName\\": \\"$lunName\\", \\"lunId\\": \\"$lunId\\", \\"copiesCount\\": $copiesCount}"

            lunExists=$(echo "$lunRecords" | jq --arg serial "$mountPoint" --arg name "$response" '.[] | select(.serial == $serial)')
            if [ -z "$lunExists" ]; then
                lunRecord="{\\"name\\": \\"$(echo "$response" | jq -r '.records[0].name')\\", \\"serial\\": \\"$mountPoint\\"}"
                lunRecords=$(echo "$lunRecords" | jq --argjson lr "$lunRecord" '. += [$lr]')
                log "Added new LUN record: $lunRecord"
            fi
        else
            # For NFS
            log "Processing NFS protocol"
            volumeEntry="{\\"volumeName\\": \\"$volumeName\\", \\"volumeId\\": \\"$volumeId\\", \\"svmName\\": \\"$svmName\\",\\"svmId\\": \\"$svmId\\", \\"copiesCount\\": $copiesCount}"
            log "LUN record already exists for serial: $mountPoint"
        fi
        
        if [ "$isASMManaged" == "true" ]; then
            log "Adding ASM metadata to volume entry"
            volumeEntry=$(echo "$volumeEntry" | jq --arg diskName "$diskName" '. + {diskName: $diskName}')
            volumeEntry=$(echo "$volumeEntry" | jq --arg diskGroup "$diskGroup" '. + {diskGroup: $diskGroup}')
        fi
        
        fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson ve "$volumeEntry" '. += [$ve]')
        log "Created volume entry: $volumeEntry"
        echo "$fileTypeVolumes"
    }
    filesystemid="${fsxnId}"
    region="${region}"
    volumeMappings="[]"
    lunRecords="[]"
    protocol=""

    log "Initialized variables - filesystemid: $filesystemid, region: $region"
    
    for sid in $(echo "$mountPointData" | jq -r 'keys[]'); do
        log "Processing SID: $sid"
        sidData=$(echo "$mountPointData" | jq -r --arg sid "$sid" '.[$sid]')

        errorMessage=$(echo "$sidData" | jq -r 'if .error == null or .error == false then "" elif (.error | type) == "string" then .error else "Mount detail retrieval failed for Oracle instance." end')
        if [ -n "$errorMessage" ]; then
            log "Mount detail retrieval failed for SID: $sid, skipping volume mapping. Error: $errorMessage"
            sidMapping=$(jq -nc --arg sid "$sid" --arg error "$errorMessage" '{($sid): {error: $error}}')
            volumeMappings=$(echo "$volumeMappings" | jq --argjson sm "$sidMapping" '. += [$sm]')
            continue
        fi

        isCDB=$(echo "$sidData" | jq -r '.isCDB')
        isASMManaged=$(echo "$sidData" | jq -r '.isASMManaged')
        
        if [ "$isCDB" == "false" ]; then
            log "Processing single tenant instance for SID: $sid"
            # Single tenant instance
            ontapVolumes='{}'
            for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES" "FRA"; do
                log "Processing file type: $fileType for SID: $sid"
                fileTypeVolumes="[]"
                mountDetails=$(echo "$sidData" | jq -c --arg ft "$fileType" '.mountDetails[$ft] // []')
                # Check if mountDetails is empty
                if [ "$(echo "$mountDetails" | jq 'length')" -eq 0 ]; then
                    log "No mount details found for file type: $fileType"
                    ontapVolumes=$(echo "$ontapVolumes" | jq --arg ft "$fileType" '.[$ft] = []')
                    continue
                else
                    log "Processing $mountDetailsCount mount details for file type: $fileType"
                    for mountDetail in $(echo "$mountDetails" | jq -c '.[]'); do
                        volMappings=$(processMountDetail "$mountDetail")
                        if [ -z "$protocol" ]; then
                            protocol=$(echo "$mountDetail" | jq -r '.protocol')
                        fi
                        fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson r "$volMappings" '. += $r')
                    done
                    
                    ontapVolumes=$(echo "$ontapVolumes" | jq --arg ft "$fileType" --argjson ftv "$fileTypeVolumes" '.[$ft] = $ftv')
                    log "Completed processing file type: $fileType with $(echo "$fileTypeVolumes" | jq 'length') volumes"
                fi
            done

            sidMapping="{\\"$sid\\": {\\"isCDB\\": false, \\"ontapVolumes\\": $ontapVolumes}}"
            volumeMappings=$(echo "$volumeMappings" | jq --argjson sm "$sidMapping" '. += [$sm]')
            log "Added single tenant SID mapping for: $sid"
            
        else
            log "Processing CDB-PDB instance for SID: $sid"
            # CDB-PDB instance
            pdbVolumes='{}'
            
            for pdb in $(echo "$sidData" | jq -r '.pdbMountDetails | keys[]'); do
                log "Processing PDB: $pdb for SID: $sid"
                pdbOntapVolumes='{}'
                
                for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES" "FRA"; do
                    log "Processing file type: $fileType for PDB: $pdb"
                    fileTypeVolumes="[]"
                    mountDetails=$(echo "$sidData" | jq -c --arg pdb "$pdb" --arg ft "$fileType" '.pdbMountDetails[$pdb][$ft] // []')
                    
                    # Check if mountDetails is empty
                    if [ "$(echo "$mountDetails" | jq 'length')" -eq 0 ]; then
                        log "No mount details found for file type: $fileType in PDB: $pdb"
                        pdbOntapVolumes=$(echo "$pdbOntapVolumes" | jq --arg ft "$fileType" '.[$ft] = []')
                        continue
                    else
                        log "Processing $mountDetailsCount mount details for file type: $fileType in PDB: $pdb"
                        for mountDetail in $(echo "$mountDetails" | jq -c '.[]'); do
                            volMappings=$(processMountDetail "$mountDetail")
                            if [ -z "$protocol" ]; then
                                protocol=$(echo "$mountDetail" | jq -r '.protocol')
                            fi
                            fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson r "$volMappings" '. += $r')
                        done
                        
                        pdbOntapVolumes=$(echo "$pdbOntapVolumes" | jq --arg ft "$fileType" --argjson ftv "$fileTypeVolumes" '.[$ft] = $ftv')
                        log "Completed processing file type: $fileType for PDB: $pdb with $(echo "$fileTypeVolumes" | jq 'length') volumes"
                    fi
                done
                
                pdbVolumes=$(echo "$pdbVolumes" | jq --arg pdb "$pdb" --argjson pov "$pdbOntapVolumes" '.[$pdb] = $pov')
                log "Completed processing PDB: $pdb"
            done
            sidMapping="{\\"$sid\\": {\\"isCDB\\": true, \\"ontapVolumes\\": $pdbVolumes}}"
            volumeMappings=$(echo "$volumeMappings" | jq --argjson sm "$sidMapping" '. += [$sm]')
            log "Added CDB-PDB SID mapping for: $sid"
        fi
    done

    log "Creating final result JSON"
    result=$(jq -n \
        --arg protocol "$protocol" \
        --argjson lunRecords "$lunRecords" \
        --arg isASMManaged "$isASMManaged" \
        --argjson volumeMappings "$volumeMappings" \
        '{
            protocol: $protocol,
            lunRecords: $lunRecords,
            isASMManaged: ($isASMManaged == "true"),
            volumeMappings: $volumeMappings
        }')
    
    log "Final result created with protocol: $protocol, ASM managed: $isASMManaged, volume mappings count: $(echo "$volumeMappings" | jq 'length'), LUN records count: $(echo "$lunRecords" | jq 'length')"
    log "getMappedOntapDataVolumeForInstance completed successfully"
    
    echo "$result" | tr -d '\n'

`;

export {
    discoverOracleHosts,
    getStorageDetailsForRegisteredInstances,
    fetchOracleDatabasesCount,
    fetchOracleDatabasesDetails,
    getMappedOntapDataVolumeForInstance,
    debugLog,
    GET_DATAGUARD_DETAILS_FOR_ALL_SIDS
};
