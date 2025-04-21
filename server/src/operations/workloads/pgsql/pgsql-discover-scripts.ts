const discoverPgsqlHosts = `
    # Checking for PostgreSQL server
    set -e
    data_dir=$(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
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
        if [[ -z $data_dir ]]; then
            echo "Error: Data directory not found"
        else
            nfs_string=$(sudo findmnt -n -o SOURCE $data_dir)
            if [[ -z $nfs_string ]]; then
                echo "Mounted volume not found"
            else
                dns_name=$(echo "$nfs_string" | cut -d':' -f1)
                nfs_mount_point=$(echo "$nfs_string" | cut -d':' -f2-)
                nfs_ip_address=$(dig +short $dns_name)
                echo "$nfs_ip_address,$nfs_mount_point"
            fi
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
        count=$(sudo psql -U postgres -t -A -c "SELECT count(*) FROM pg_database WHERE datistemplate = false;" 2>/dev/null)
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
        replicas=$(sudo psql -U postgres -t -A -c "SELECT json_agg(t) FROM (SELECT client_addr FROM pg_stat_replication) t;" 2>/dev/null)
        echo "\${replicas:-[]}"
    }

    get_replica_type() {
        r_type=$(sudo psql -U postgres -t -A -c "SELECT pg_is_in_recovery();" 2>/dev/null)
        if [[ $r_type == "t" ]]; then
            echo "replica"
        else
            echo "primary"
        fi
    }

    get_primary_host() {
        primary_conninfo=$(sudo -u postgres psql -t -A -c "SHOW primary_conninfo;" 2>/dev/null | xargs)
        echo $primary_conninfo | grep -oP "host=\\K\\S+" || echo "unknown"
    }

    get_server_instance_id() {
        sudo pg_controldata $data_dir | grep "Database system identifier" | awk -F': +' '{print $2}'
    }

    get_postgres_info() {
        local version=$(get_version)
        local mount_details=$(get_mount_details)
        local nfs_ip_address=$(echo "$mount_details" | cut -d',' -f1)
        local nfs_mount_point=$(echo "$mount_details" | cut -d',' -f2)
        local status=$(get_server_running_status)
        local hostname=$(hostname)
        local postgres_server=$(get_postgres_server)
        local database_count=$(get_database_count)
        local deployment_type=$(get_deployment_type)
        local replica_info="null"
        local primary_host="null"
        local server_instance_id=$(get_server_instance_id)

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
            \\"ebs_volume_id\\": \\"null\\",
            \\"server_instance_id\\": \\"\${server_instance_id:-null}\\"
        }"
    }

    get_postgres_info
`;

export { discoverPgsqlHosts };
