const getStorageDetails = `

    # Function to find mount point details for a given file or directory.
    find_mountpoint() {
        local target="$1"
        local mountPoint
        mountPoint=$(findmnt -T "$target" -n -o SOURCE)
        if [ -n "$mountPoint" ]; then
            dns_name=$(echo "$mountPoint" | cut -d':' -f1)
            nfs_mount_point=$(echo "$mountPoint" | cut -d':' -f2-)
            # Check if dns_name already appears to be an IP address (simple check for digits and dots)
            if [[ $dns_name =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
                nfs_ip_address="$dns_name"
            else
                nfs_ip_address=$(dig +short "$dns_name")
            fi

            echo "$nfs_ip_address,$nfs_mount_point"
            return 0
        fi

        echo "Mount point not found for $1."
        return 1
    }

    get_data_file_path() {
        # Function to retrieve the data file path from the database.
        sudo -i -u oracle bash <<EOF
            sqlplus -S / as sysdba
            SET HEADING OFF
            SET LINESIZE 500
            SELECT file_name FROM dba_data_files WHERE ROWNUM = 1;
            EXIT;
EOF
    }

    # Query to retrieve data file path.
    DATA_FILE=$(get_data_file_path)
    DATA_FILE=$(echo "$DATA_FILE" | xargs)

    if [ -z "$DATA_FILE" ]; then
        echo "No data file path returned for instance"
    else
        # Determine the directory to use.
        if [ -e "$DATA_FILE" ]; then
            TARGET="$DATA_FILE"
        else
            TARGET=$(dirname "$DATA_FILE")
        fi

        mount_details=$(find_mountpoint "$TARGET")
    fi
`;

const discoverOracleHosts = `
    # Check if oratab exists
    if [ ! -f /etc/oratab ]; then
        echo "No /etc/oratab found on this instance."
        exit 0
    fi

    RESULTS="["  # start of the JSON array
    FIRST=1      # flag to determine the first object

    # Parse /etc/oratab, ignoring comment lines (#) and blank lines
    SIDS=$(grep -v '^#' /etc/oratab | awk -F: '{if ($1 != "" && $2 != "") print $1}')

    if [ -z "$SIDS" ]; then
        echo "No SIDs found in /etc/oratab."
        exit 0
    fi

    get_instance_details() {
        sudo -i -u oracle bash <<EOF
            sqlplus -S / as sysdba
                SET HEADING OFF
                SET LINESIZE 500
                SELECT JSON_OBJECT(
                        'instance_id' value INSTANCE_NUMBER,
                        'instance_name' value INSTANCE_NAME,
                        'host_name' value HOST_NAME,
                        'version' value VERSION,
                        'instance_state' value STATUS
                    ) AS instance_info
                FROM V\\$INSTANCE;
EOF
    }

    get_database_details() {
        sudo -i -u oracle bash <<EOF
            sqlplus -S / as sysdba
                SET HEADING OFF
                SET LINESIZE 500
                SELECT JSON_OBJECT(
                        'name' value NAME,
                        'database_id' value DBID,
                        'created' value CREATED,
                        'open_mode' value OPEN_MODE,
                        'is_cdb' value CDB
                    ) AS database_info
                FROM V\\$DATABASE;
EOF
    }

    get_pdb_databases_details() {
        sudo -i -u oracle bash <<EOF
            sqlplus -S / as sysdba
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

    for sid in $SIDS; do
        export ORACLE_SID="$sid"

        # Check if the instance is running by checking for its PMON process.
        if ! pgrep -f "ora_pmon_$ORACLE_SID" > /dev/null 2>&1; then
            echo "Instance $ORACLE_SID is not active. Skipping."
            continue
        fi

        {
            INSTANCE_DETAILS=$(get_instance_details)
            DATABASE_DETAILS=$(get_database_details)
            
            is_cdb=$(echo "$DATABASE_DETAILS" | grep -o '"is_cdb":"[^"]*"' | cut -d':' -f2 | tr -d '"')

            if [ "$is_cdb" == "YES" ]; then
                PDB_DATABASE_DETAILS=$(get_pdb_databases_details)
            else
                PDB_DATABASE_DETAILS="null"
            fi

            mount_details=${getStorageDetails}
            nfs_ip_address=$(echo "$mount_details" | cut -d',' -f1)
            nfs_mount_point=$(echo "$mount_details" | cut -d',' -f2)
        } || {
            echo "Failed to retrieve details for instance $ORACLE_SID. Skipping."
            continue
        }

        JSON_OBJ="{\\"sid\\":\\"$sid\\", \\"instance_details\\": $INSTANCE_DETAILS, \\"database_details\\": $DATABASE_DETAILS, \\"pdb_database_details\\": $PDB_DATABASE_DETAILS, \\"nfs_ip_address\\": \\"$nfs_ip_address\\", \\"nfs_mount_point\\": \\"$nfs_mount_point\\"}"

        # If not the first object, prepend a comma in the JSON array.
        if [ $FIRST -eq 1 ]; then
            RESULTS+="$JSON_OBJ"
            FIRST=0
        else
            RESULTS+=", $JSON_OBJ"
        fi

    done

    RESULTS+="]"  # end of the JSON array
    echo $RESULTS
`;

export default discoverOracleHosts;
