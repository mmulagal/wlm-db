const discoverPgsqlHosts = `
    # Checking for PostgreSQL server
    set -e
    data_dir=$(sudo systemctl cat postgresql 2>/dev/null | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
    if [[ $? -ne 0 ]]; then
        echo "{
            \\"error\\": \\"Either PostgreSQL is not installed, or the service is not configured properly.\\",
            \\"status\\": \\"no_pgsql\\"
        }"
        exit 1
    fi
    if [[ -z $data_dir ]]; then
        echo "{
            \\"error\\": \\"PostgreSQL data directory not found\\",
            \\"status\\": \\"no_pgsql\\"
        }"
        exit 0
    fi

    get_version() {
        if sudo command -v psql > /dev/null; then
            if sudo systemctl is-active --quiet postgresql || systemctl is-active --quiet postgresql-16 || systemctl is-active --quiet postgresql-15; then
                echo $(psql --version)
            else
                echo "Error: PostgreSQL server is installed but not running."
            fi
        else
            echo "Error: PostgreSQL server is not installed."
        fi
    }

    get_mount_details() {
        is_nfs="false"
        mount_response=$(sudo findmnt -n -o FSTYPE,SOURCE --target $data_dir)
        fs_type=$(echo "$mount_response" | awk '{print $1}')
        if [[ -z $mount_response || -z $fs_type || $fs_type != "nfs"* ]]; then
            DEVICE=$(sudo df --output=source "$data_dir" | tail -n 1)
            if [[ $DEVICE == *"nvme"* ]]; then
                if ! command -v nvme &> /dev/null; then
                    # echo "nvme-cli is not installed. Installing..."
                    sudo yum install -y nvme-cli
                fi
                VOLUME_ID=$(sudo /usr/sbin/ebsnvme-id $DEVICE | grep "Volume ID" | awk '{print $3}')
                echo $is_nfs,$VOLUME_ID
            else
                echo $is_nfs,$DEVICE
            fi
        else
            nfs_string=$(echo "$mount_response" | awk '{print $2}')
            dns_name=$(echo "$nfs_string" | cut -d':' -f1)
            nfs_mount_point=$(echo "$nfs_string" | cut -d':' -f2-)
            if [[ $dns_name =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
                nfs_ip_address=$dns_name
            else
                nfs_ip_address=$(dig +short $dns_name)
            fi
            is_nfs="true"
            echo "$is_nfs,$nfs_ip_address,$nfs_mount_point"
        fi
    }

    is_default_auth() {
        if ! sudo psql -U postgres -c "\\q" > /dev/null 2>&1; then
            return 1
        else
            return 0
        fi
    }

    get_server_running_status() {
        if sudo pg_isready -U 'postgres' > /dev/null 2>&1; then
            echo "running"
        else
            echo "not_running"
        fi
    }

    get_postgres_server() {
        listen_addresses=$(sudo cat "$data_dir/postgresql.conf" | grep listen_addresses | cut -d"'" -f2)
        echo "\${listen_addresses:-null}"
    }

    get_database_count() {
        if is_default_auth; then
            count=$(sudo psql -U postgres -t -A -c "SELECT count(*) FROM pg_database WHERE datistemplate = false;" 2>/dev/null)
        fi
        echo "\${count:-0}"
    }

    get_deployment_type() {
        wal_level=$(sudo grep -E "^wal_level" "$data_dir/postgresql.conf" | cut -d '=' -f 2 | xargs)
        if [[ $wal_level == "replica" ]]; then
            echo "ha"
        else
            echo "standalone"
        fi
    }

    get_replica_info() {
        if is_default_auth; then
            replicas=$(sudo psql -U postgres -t -A -c "SELECT json_agg(t) FROM (SELECT client_addr FROM pg_stat_replication) t;" 2>/dev/null)
        fi
        echo "\${replicas:-[]}"
    }

    get_replica_type() {
        if is_default_auth; then
            r_type=$(sudo psql -U postgres -t -A -c "SELECT pg_is_in_recovery();" 2>/dev/null)
        fi
        if [[ $r_type == "t" ]]; then
            echo "replica"
        else
            echo "primary"
        fi
    }

    get_primary_host() {
        if is_default_auth; then
            primary_conninfo=$(sudo -u postgres psql -t -A -c "SHOW primary_conninfo;" 2>/dev/null | xargs)
        fi
        echo $primary_conninfo | grep -oP "host=\\K\\S+" || echo "unknown"
    }

    get_server_instance_id() {
        sudo pg_controldata $data_dir | grep "Database system identifier" | awk -F': +' '{print $2}'
    }

    get_postgres_info() {
        local version=$(get_version)
        local mount_details=$(get_mount_details)
        local is_nfs=$(echo "$mount_details" | cut -d',' -f1)
        if [[ $is_nfs == "true" ]]; then
            local nfs_ip_address=$(echo "$mount_details" | cut -d',' -f2)
            local nfs_mount_point=$(echo "$mount_details" | cut -d',' -f3)
        else
            local ebs_volume=$(echo "$mount_details" | cut -d',' -f2)
        fi
        local status=$(get_server_running_status)
        local hostname=$(hostname)
        local postgres_server=$(get_postgres_server)
        local database_count=$(get_database_count)
        local deployment_type=$(get_deployment_type)
        local replica_info="null"
        local primary_host="null"
        local server_instance_id=$(get_server_instance_id)
        local default_auth=$(is_default_auth)
        if [[ $deployment_type == "ha" ]]; then
            local replica_type=$(get_replica_type)
            if [[ $replica_type == "replica" ]]; then
                primary_host=$(get_primary_host)
            else
                replica_info=$(get_replica_info)
            fi
        fi

        echo "{
            \\"version\\": \\"\${version:-null}\\",
            \\"nfs_ip_address\\": \\"\${nfs_ip_address:-null}\\",
            \\"status\\": \\"\${status:-null}\\",
            \\"hostname\\": \\"\${hostname:-null}\\",
            \\"nfs_mount_point\\": \\"\${nfs_mount_point:-null}\\",
            \\"postgres_server\\": \\"\${postgres_server:-null}\\",
            \\"database_count\\": \${database_count:-0},
            \\"deployment_type\\": \\"\${deployment_type:-null}\\",
            \\"replica_type\\": \\"\${replica_type:-null}\\",
            \\"replica_info\\": \${replica_info},
            \\"primary_host\\": \\"\${primary_host:-null}\\",
            \\"ebs_volume\\": \\"\${ebs_volume:-null}\\",
            \\"server_instance_id\\": \\"\${server_instance_id:-null}\\",
            \\"default_auth\\": \\"\${default_auth:-null}\\"
        }"
    }

    get_postgres_info
`;

export { discoverPgsqlHosts };
