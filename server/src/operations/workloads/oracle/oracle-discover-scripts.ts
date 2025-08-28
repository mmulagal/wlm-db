import {
    checkOracleModuleAvailability,
    getMappedOntapDataVolume,
    getOracleDefaultOrUserAuthCommand,
    loadOracleUserPermissionsDetectionModule,
    oracleUserAuthLoginCommand
} from './oracle-ssm-script-utils';

const loadStorageDetectionModules = `

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
            SET PAGESIZE 0
            SET TRIMSPOOL ON
            $alter_cmd
            SELECT 
                '{' || CHR(10) ||
                '    "REDO_LOGS": [' || 
                    NVL((SELECT LISTAGG('"' || redo_dir || '"', ', ') WITHIN GROUP (ORDER BY redo_dir)
                        FROM (SELECT DISTINCT substr(member,1,instr(member,'/',-1)-1) as redo_dir FROM v\\$logfile)), '') || 
                '],' || CHR(10) ||
                '    "ARCHIVE_LOGS": [' || 
                    NVL((SELECT LISTAGG('"' || archive_dir || '"', ', ') WITHIN GROUP (ORDER BY archive_dir)
                        FROM (SELECT DISTINCT substr(name,1,instr(name,'/',-1)-1) as archive_dir FROM v\\$archived_log)), '') || 
                '],' || CHR(10) ||
                '    "CONTROL_FILES": [' || 
                    NVL((SELECT LISTAGG('"' || ctrlfile_dir || '"', ', ') WITHIN GROUP (ORDER BY ctrlfile_dir)
                        FROM (SELECT DISTINCT substr(name,1,instr(name,'/',-1)-1) as ctrlfile_dir FROM v\\$controlfile)), '') || 
                '],' || CHR(10) ||
                '    "TEMP_FILES": [' || 
                    NVL((SELECT LISTAGG('"' || tempfile_dir || '"', ', ') WITHIN GROUP (ORDER BY tempfile_dir)
                        FROM (SELECT DISTINCT substr(file_name,1,instr(file_name,'/',-1)-1) as tempfile_dir FROM dba_temp_files)), '') || 
                '],' || CHR(10) ||
                '    "DATA_FILES": [' || 
                    NVL((SELECT LISTAGG('"' || data_dir || '"', ', ') WITHIN GROUP (ORDER BY data_dir)
                        FROM (SELECT DISTINCT SUBSTR(file_name, 1, INSTR(file_name, '/', -1) - 1) AS data_dir 
                            FROM dba_data_files WHERE file_name NOT LIKE '+%')), '') || 
                ']' || CHR(10) ||
                '}'
            AS json_output
            FROM dual;
EOSQL
EOF
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
            $sqlplus_command
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
EOF
    }

    get_disk_details() {
        local ORACLE_SID="$1"
        local diskgroupName="$2"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT d.name
            FROM v\\$asm_disk d
            JOIN v\\$asm_diskgroup g ON d.group_number = g.group_number
            WHERE g.name = '$diskgroupName' AND ROWNUM = 1;
EOF
}

    get_disk_device_path() {
        local ORACLE_SID="$1"
        local diskName="$2"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT path 
                FROM v$asm_disk 
                WHERE name = '$diskName'
                AND header_status = 'MEMBER';
            EXIT;
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
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SET FEEDBACK OFF
            SET TERMOUT OFF
            $alter_cmd
            SELECT DISTINCT SUBSTR(file_name, 2, INSTR(file_name, '/') - 2) AS diskgroup
            FROM dba_data_files
            WHERE file_name LIKE '+%';
EOF
}

    get_loop_device_associated_with_disk() {
        local diskName="$1"
        local udevInfo=$(sudo udevadm info --query=all --name="/dev/oracleasm/disks/$diskName")

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
        loopDevice=$(get_loop_device_associated_with_disk $diskName)
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
        
        udevInfo=$(udevadm info --query=all --name="/dev/oracleasm/disks/$diskName")
        mountDevice=$(echo "$udevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
        mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
        iscsiSerialNumber=$(echo "$udevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
        mountPoint=$(echo "$mountDevice" | sed 's/.*ip-[0-9\\.]*://')

        if echo "$mountPoint" | grep -q "iscsi"; then
            protocol="iSCSI"
        else
            protocol="others"
        fi
        mountPoint=$iscsiSerialNumber
        echo "$mountIp,$mountPoint,$protocol"
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
                diskName=$(get_disk_details "$ORACLE_SID" "$diskGroup")
                if [ -n "$diskName" ]; then
                    
                    result=$(get_asm_nfs_details "$diskName") || result=$(get_asm_iscsi_details $diskName)
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

    check_asm_managed() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF;
            SET FEEDBACK OFF;
            SET VERIFY OFF;
            SET PAGESIZE 0;
            SELECT CASE 
                    WHEN COUNT(*) > 0 THEN 'TRUE'
                    ELSE 'FALSE'
                END
            FROM dba_data_files
            WHERE file_name LIKE '+%';
            EXIT;
EOF
}

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
                    return 1
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
                        udevInfo=$(udevadm info --query=all --name=$source)
                        mountDevice=$(echo "$udevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
                        mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
                        iscsiSerialNumber=$(echo "$udevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
                        mountPoint=$(echo "$mountDevice" | sed 's/.*ip-[0-9\\.]*://')
                        if echo "$mountPoint" | grep -q "iscsi"; then
                            protocol="iSCSI"
                        else
                            protocol="others"
                        fi

                        mountPoint=$iscsiSerialNumber
                        jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\"}"
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
                        jsonObj="{\\"isAsmManaged\\":\\"false\\", \\"mountIP\\":\\"$mountIp\\", \\"mountPoint\\":\\"$mountPoint\\", \\"protocol\\":\\"$protocol\\"}"
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
            udevInfo=$(sudo udevadm info --query=all --name="$source")
            mountDevice=$(echo "$udevInfo" | grep -m 1 "disk/by-path" | awk '{print $2}')
            mountIp=$(echo "$mountDevice" | sed -n 's#^disk/by-path/ip-\\([0-9\\.]\\+\\):.*#\\1#p')
            iscsiSerialNumber=$(echo "$udevInfo" | grep "ID_SCSI_SERIAL" | awk -F= '{print $2}')
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

    get_oracle_db_mount_details() {
        local ORACLE_SID="$1"
        local isCDB="$2"
        local pdbName="$3"
        
        # Get Oracle DB file paths
        db_paths_json=$(get_oracle_db_file_paths "$ORACLE_SID" "$isCDB" "$pdbName")
        oracleMountDetails="{"
        for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES"; do
            paths=$(echo "$db_paths_json" | jq -r ".$fileType[]" 2>/dev/null)
            paths_csv=$(echo "$paths" | tr '\n' ',' | sed 's/,$//')
            
            # Get mount details for these paths
            if [ -n "$paths_csv" ]; then
                mountDetails=$(get_directory_mount_details "$paths_csv")
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
    }`;

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
    else
        storageDetails=$(get_non_asm_nfs_or_iscsi_storage_details "$sid" "NO" "null" "false" "$oracle_home")
    fi
`;

const loadDatabaseDetectionModules = `
    get_instance_details() {
        local ORACLE_SID="$1"
        if [ "$isDefaultAuth" == "true" ]; then

            sudo -i -u oracle bash <<EOF
                export ORACLE_SID="$ORACLE_SID"
                $sqlplus_command
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
EOF
        else
            # instance name & id are same as ORACLE_SID, hostname is not available in /etc/oratab.
            # version is not available in /etc/oratab, so setting it to undefined. checking pgrep -f "ora_pmon_$sid" earlier to ensure the instance is running.

            local result="{\\"instance_name\\": \\"$ORACLE_SID\\", \\"instance_state\\": \\"OPEN\\", \\"version\\": \\"undefined\\", \\"instance_id\\": \\"$ORACLE_SID\\", \\"hostname\\": \\"undefined\\"}"
            echo $result
        fi
    }

    get_database_details() {
        local ORACLE_SID="$1"
        local jsonRes
        jsonRes=$(sudo -i -u oracle bash <<EOF
            set -e
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
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
EOF
) || return 1
    
        echo $jsonRes
    }

    get_pdb_databases_details() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
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
EOF
    }

    get_pdbs_sizes() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT JSON_OBJECTAGG(
                    p.PDB_NAME VALUE ROUND(SUM(df.BYTES), 2)
                ) AS pdb_sizes_json
            FROM V\\$DATAFILE df
            JOIN DBA_PDBS p ON df.CON_ID = p.CON_ID
            GROUP BY p.PDB_NAME;
EOF
    }

    get_cdb_or_single_instance_db_size() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT ROUND(SUM(BYTES), 2) AS db_size_gb
            FROM   DBA_DATA_FILES;
EOF
    }

    get_pdbs_active_status() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'pdb_name' VALUE NAME,
                    'open_mode' VALUE OPEN_MODE,
                    'status' VALUE CASE
                            WHEN open_mode = 'READ WRITE' THEN 'ONLINE'
                            ELSE 'OFFLINE'
                        END
                    )
                ) AS pdb_status_json
            FROM V\\$PDBS;
EOF
    }

    get_pdbs_count() {
        local ORACLE_SID="$1"
        sudo -i -u oracle bash <<EOF
            export ORACLE_SID="$ORACLE_SID"
            $sqlplus_command
            SET HEADING OFF
            SET LINESIZE 500
            SELECT COUNT(*) AS pdb_count FROM DBA_PDBS;
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

    is_default_auth() {
        local ORACLE_SID="$1"
        local result
        result=$(sudo -i -u oracle bash <<EOF
                export ORACLE_SID="$ORACLE_SID"
                sqlplus -S / as sysdba 2>/dev/null <<EOSQL
                WHENEVER SQLERROR EXIT SQL.SQLCODE
                SET HEADING OFF
                SET FEEDBACK OFF
                SET VERIFY OFF
                SET PAGESIZE 0
                SELECT 'OK' FROM dual;
                EXIT;
EOSQL
EOF
)
        if echo "$result" | grep -q "^OK"; then
            echo "true"
        else
            echo "false"
        fi
}
    ${loadDatabaseDetectionModules}
    ${loadStorageDetectionModules}
    ${checkOracleModuleAvailability}

    while IFS=: read -r sid oracle_home; do
        # Check if the instance is running by checking for its PMON process.
        # Skip if the instance process is not running.
        if ! pgrep -f "ora_pmon_$sid" > /dev/null 2>&1; then
            continue
        fi

        isDefaultAuth=$(is_default_auth "$sid")
        modulesAvailability=$(check_oracle_module_availability)

        {
            INSTANCE_DETAILS=$(get_instance_details "$sid")
            DATABASE_DETAILS=$(get_database_details "$sid")
            if [ $? -ne 0 ]; then
                DATABASE_DETAILS='{"error": "failed to retrieve database details for instance '$sid'"}'
            fi
            
            is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')

            if [ "$is_cdb" == "YES" ]; then
                PDB_DATABASE_DETAILS=$(get_pdb_databases_details "$sid")
                pdb_names=$(echo "$PDB_DATABASE_DETAILS" | grep -o '"pdb_name":"[^"]*"' | sed 's/"pdb_name":"\\([^"]*\\)"/\\1/g')
            else
                PDB_DATABASE_DETAILS="null"
            fi


            if [ "$isDefaultAuth" == "true" ]; then
                ${getInstanceStorageDetails}
                # Default auth enabled means the user has sysdba privileges, so no missing permissions.
                missingPermissions="[]"
            else
                ${getStorageWithoutCreds}
                ${checkOraclePermissionsInDiscovery}
                isAwsCliInstalled=$(echo "$modulesAvailability" | grep -o '"isAwsCliInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
                isJqInstalled=$(echo "$modulesAvailability" | grep -o '"isJqInstalled": *"[^"]*"' | sed 's/.*: *"\\([^"]*\\)"/\\1/')
                if [[ "$isAwsCliInstalled" == "true"  && "$isJqInstalled" == "true" ]]; then
                    missingPermissions=$(check_oracle_missing_permissions "$sid")
                else
                    missingPermissions="[\\"na\\"]"
                fi
            fi
        } || {
            echo "Failed to retrieve details for instance $ORACLE_SID. Skipping."
            continue
        }

        JSON_OBJ="{\\"sid\\":\\"$sid\\", \\"instance_details\\": $INSTANCE_DETAILS, \\"database_details\\": $DATABASE_DETAILS, \\"pdb_database_details\\": $PDB_DATABASE_DETAILS, \\"storage_details\\": $storageDetails, \\"is_default_auth\\": $isDefaultAuth, \\"modules_availability\\": $modulesAvailability, \\"missing_permissions\\": $missingPermissions}"

        # If not the first object, prepend a comma in the JSON array.
        if [ $FIRST -eq 1 ]; then
            RESULTS+="$JSON_OBJ"
            FIRST=0
        else
            RESULTS+=", $JSON_OBJ"
        fi

    done <<< "$oratab_entries"

    RESULTS+="]"  # end of the JSON array
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
            ${loadStorageDetectionModules}
            ${getInstanceStorageDetails}
        else
            ${getStorageWithoutCreds}
        fi

        results="{\\"storage_details\\": $storageDetails}"
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
        
        if [[ "$isDefaultAuth" == "true" || "$oracleCredsAvailable" == "true" ]]; then
            DATABASE_DETAILS=$(get_database_details "$sid")
            root_db_size=$(get_cdb_or_single_instance_db_size "$sid")
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
        fi
        
        results="{\\"database_details\\": $DATABASE_DETAILS, \\"pdbs_size\\": $pdbs_size, \\"root_db_size\\": $root_db_size, \\"pdbs_status\\": $pdbs_status, \\"is_cdb\\": \\"$is_cdb\\"}"
    done <<< "$oratab_entries"

    echo $results
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

        {
            INSTANCE_DETAILS=$(get_instance_details "$sid")
            DATABASE_DETAILS=$(get_database_details "$sid")
            if [ $? -ne 0 ]; then
                DATABASE_DETAILS='{"error": "failed to retrieve database details for instance '$sid'"}'
            fi
            
            is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')

            if [ "$is_cdb" == "YES" ]; then
                PDB_DATABASE_DETAILS=$(get_pdb_databases_details "$sid")
                #pdb_names will be array of pdb names: pdb1 pdb2
                pdb_names=$(echo "$PDB_DATABASE_DETAILS" | grep -o '"pdb_name":"[^"]*"' | sed 's/"pdb_name":"\\([^"]*\\)"/\\1/g')
            else
                PDB_DATABASE_DETAILS="null"
            fi
            
            isASMManaged=$(check_asm_managed $sid)
            # Add comma if not first SID
            if [ "$firstSid" = true ]; then
                firstSid=false
            else
                finalResult+=","
            fi
            
            if [ "$isASMManaged" == "TRUE" ]; then
                # TODO: get PDB/instance level mount details for ASM managed databases, currently we are not asking for ASM creds
                if [ "$is_cdb" == "YES" ]; then
                    finalResult+="\\"$sid\\": {\\"isCDB\\": true, \\"isASMManaged\\": true, \\"pdbMountDetails\\": {}}"
                else
                    finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": true, \\"mountDetails\\": {}}"
                fi
            else
                if [ "$is_cdb" == "YES" ]; then
                    # Handle CDB with PDBs
                    finalResult+="\\"$sid\\": {\\"isCDB\\": true, \\"isASMManaged\\": false, \\"pdbMountDetails\\": {"
                    firstPdb=true
                    
                    for pdb_name in $pdb_names; do
                        if [ "$firstPdb" = true ]; then
                            firstPdb=false
                        else
                            finalResult+=","
                        fi
                        
                        # Get mount details for this PDB
                        pdbMountDetails=$(get_oracle_db_mount_details "$sid" "$is_cdb" "$pdb_name")
                        finalResult+="\\"$pdb_name\\": $pdbMountDetails"
                    done
                    
                    finalResult+="}}"
                else
                    # Handle single instance DB
                    mountDetails=$(get_oracle_db_mount_details "$sid" "$is_cdb" "")
                    finalResult+="\\"$sid\\": {\\"isCDB\\": false, \\"isASMManaged\\": false, \\"mountDetails\\": $mountDetails}"
                fi
            fi
        } || {
            echo "Failed to retrieve details for instance $sid. Skipping."
            continue
        }
    done <<< "$oratab_entries"
    finalResult+="}"
    mountPointData=$(echo "$finalResult" | tr -d '\n' | tr -d ' ')
`;

const getMappedOntapDataVolumeForInstance = (
    ec2InstanceId: string,
    oracleSids: string[],
    fsxnId: string,
    region: string
) => `
    ${getOracleDbMountDetails(ec2InstanceId, oracleSids)}
    processMountDetail() {
        local mountDetail="$1"
        local fileTypeVolumes="[]"
        local mountIP=$(echo "$mountDetail" | jq -r '.mountIP')
        local mountPoint=$(echo "$mountDetail" | jq -r '.mountPoint')
        local mountProtocol=$(echo "$mountDetail" | jq -r '.protocol')
        local isAsm=$(echo "$mountDetail" | jq -r '.isAsmManaged')
        local volumeName
        local volumeId
        local lunName
        local lunId
        local volumeEntry
        local lunExists
        local lunRecord

        
        if [ -z "$protocol" ]; then
            protocol="$mountProtocol"
        fi
        
        if [ "$isAsm" == "true" ]; then
            isASMManaged="true"
        fi

        ${getMappedOntapDataVolume(fsxnId, region, '$mountIP', '$mountPoint', '$mountProtocol')}
        
        volumeName="$mountedVolume"
        volumeId="$mountedVolumeId"
        
        if [ "$mountProtocol" == "iSCSI" ]; then
            # For iSCSI, extract LUN details
            lunName=$(echo "$response" | jq -r '.records[0].name')
            volumeEntry="{\\"volumeName\\": \\"$volumeName\\",\\"volumeId\\": \\"$volumeId\\", \\"svmName\\": \\"$svmName\\", \\"svmId\\": \\"$svmId\\", \\"lunName\\": \\"$lunName\\", \\"lunId\\": \\"$lunId\\"}"

            lunExists=$(echo "$lunRecords" | jq --arg serial "$mountPoint" --arg name "$response" '.[] | select(.serial == $serial)')
            if [ -z "$lunExists" ]; then
                lunRecord="{\\"name\\": \\"$(echo "$response" | jq -r '.records[0].name')\\", \\"serial\\": \\"$mountPoint\\"}"
                lunRecords=$(echo "$lunRecords" | jq --argjson lr "$lunRecord" '. += [$lr]')
            fi
        else
            # For NFS
            volumeEntry="{\\"volumeName\\": \\"$volumeName\\", \\"volumeId\\": \\"$volumeId\\", \\"svmName\\": \\"$svmName\\",\\"svmId\\": \\"$svmId\\"}"
        fi
        
        fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson ve "$volumeEntry" '. += [$ve]')
        echo "$fileTypeVolumes"
    }
    filesystemid="${fsxnId}"
    region="${region}"
    volumeMappings="[]"
    lunRecords="[]"
    protocol=""
    
    for sid in $(echo "$mountPointData" | jq -r 'keys[]'); do
        sidData=$(echo "$mountPointData" | jq -r --arg sid "$sid" '.[$sid]')
        isCDB=$(echo "$sidData" | jq -r '.isCDB')
        isASMManaged=$(echo "$sidData" | jq -r '.isASMManaged')
        if [ "$isASMManaged" == "true" ]; then
            # TO-DO: add logic for ASM, Skip ASM managed instances for now
            continue
        fi
        
        if [ "$isCDB" == "false" ]; then
            # Single tenant instance
            ontapVolumes='{}'
            for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES"; do
                fileTypeVolumes="[]"
                mountDetails=$(echo "$sidData" | jq -c --arg ft "$fileType" '.mountDetails[$ft] // []')
                # Check if mountDetails is empty
                if [ "$(echo "$mountDetails" | jq 'length')" -eq 0 ]; then
                    ontapVolumes=$(echo "$ontapVolumes" | jq --arg ft "$fileType" '.[$ft] = []')
                    continue
                else
                    for mountDetail in $(echo "$mountDetails" | jq -c '.[]'); do
                        volMappings=$(processMountDetail "$mountDetail")
                        if [ -z "$protocol" ]; then
                            protocol=$(echo "$mountDetail" | jq -r '.protocol')
                        fi
                        fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson r "$volMappings" '. += $r')
                    done
                    
                    ontapVolumes=$(echo "$ontapVolumes" | jq --arg ft "$fileType" --argjson ftv "$fileTypeVolumes" '.[$ft] = $ftv')
                fi
            done

            sidMapping="{\\"$sid\\": {\\"isCDB\\": false, \\"ontapVolumes\\": $ontapVolumes}}"
            volumeMappings=$(echo "$volumeMappings" | jq --argjson sm "$sidMapping" '. += [$sm]')
            
        else
            # CDB-PDB instance
            pdbVolumes='{}'
            
            for pdb in $(echo "$sidData" | jq -r '.pdbMountDetails | keys[]'); do
                pdbOntapVolumes='{}'
                
                for fileType in "REDO_LOGS" "ARCHIVE_LOGS" "CONTROL_FILES" "TEMP_FILES" "DATA_FILES"; do
                    fileTypeVolumes="[]"
                    mountDetails=$(echo "$sidData" | jq -c --arg pdb "$pdb" --arg ft "$fileType" '.pdbMountDetails[$pdb][$ft] // []')
                    
                    # Check if mountDetails is empty
                    if [ "$(echo "$mountDetails" | jq 'length')" -eq 0 ]; then
                        pdbOntapVolumes=$(echo "$pdbOntapVolumes" | jq --arg ft "$fileType" '.[$ft] = []')
                        continue
                    else
                        for mountDetail in $(echo "$mountDetails" | jq -c '.[]'); do
                            volMappings=$(processMountDetail "$mountDetail")
                            if [ -z "$protocol" ]; then
                                protocol=$(echo "$mountDetail" | jq -r '.protocol')
                            fi
                            fileTypeVolumes=$(echo "$fileTypeVolumes" | jq --argjson r "$volMappings" '. += $r')
                        done
                        
                        pdbOntapVolumes=$(echo "$pdbOntapVolumes" | jq --arg ft "$fileType" --argjson ftv "$fileTypeVolumes" '.[$ft] = $ftv')
                    fi
                done
                
                pdbVolumes=$(echo "$pdbVolumes" | jq --arg pdb "$pdb" --argjson pov "$pdbOntapVolumes" '.[$pdb] = $pov')
            done
            sidMapping="{\\"$sid\\": {\\"isCDB\\": true, \\"ontapVolumes\\": $pdbVolumes}}"
            volumeMappings=$(echo "$volumeMappings" | jq --argjson sm "$sidMapping" '. += [$sm]')
        fi
    done

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
    
    echo "$result" | tr -d '\n' | tr -d ' '

`;

export {
    discoverOracleHosts,
    getStorageDetailsForRegisteredInstances,
    fetchOracleDatabasesCount,
    fetchOracleDatabasesDetails,
    getMappedOntapDataVolumeForInstance
};
