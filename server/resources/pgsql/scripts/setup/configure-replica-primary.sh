#!/bin/bash
exec > /var/log/netapp_wf/configure-replica-primary.log 2>&1
# Parse command-line arguments
while getopts "a:b:c:" opt; do
    case $opt in
        a) parent_stack_name="$OPTARG" ;;
        b) service_account_password="$OPTARG" ;;
        c) fsxdatavolumename="$OPTARG" ;;
    esac
done

# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

is_valid_json() {
    echo "$1" | jq empty > /dev/null 2>&1
    return $?
}

convert_to_json_string() {
    local json_string="$1"
    # Replace single quotes with double quotes and add double quotes around keys
    echo "$json_string" | sed "s/'/\"/g" | sed 's/\([a-zA-Z0-9_]*\):/"\1":/g'
}

extract_ip() {
    local json_string="$1"
    local privateIp=$(echo "$json_string" | jq -r '.private_ip')
    echo "$privateIp"
}

echo "Parent Stack Name: $parent_stack_name"
interval=10  # Polling interval in seconds
elapsed_time=0
timeout=60

while [ $elapsed_time -lt $timeout ]; do
    instance_details=$(aws ssm get-parameter --name "/netapp/wlmdb/${parent_stack_name}_secondary" --query "Parameter.Value" --output text 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "SSM parameter found"
        break
    else
        echo "SSM parameter not found. Retrying in $interval seconds..."
        sleep $interval
        elapsed_time=$((elapsed_time + interval))
    fi
done
echo "instance_details fetched"
if is_valid_json "$instance_details"; then
    valid_instance_details="$instanceDetails"
else
    valid_instance_details=$(convert_to_json_string "$instance_details")
fi

ip_details=$(extract_ip "$valid_instance_details")
secondary_server_IP=$(echo "$ip_details" | awk '{print $1}')
echo "ip details fetched"

# Delete the parameter from SSM
aws ssm delete-parameter --name "/netapp/wlmdb/${parent_stack_name}_secondary"

# (1) Define variables for file paths.
PG_DATA_DIR="/$fsxdatavolumename"
PG_CONF="$PG_DATA_DIR/postgresql.conf"
PG_HBA="$PG_DATA_DIR/pg_hba.conf"

# (2) Update postgresql.conf parameters
echo "Updating $PG_CONF ..."
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
sudo sed -i "s/^#\?wal_level.*/wal_level = replica/" "$PG_CONF"
sudo sed -i "s/^#\?max_wal_senders.*/max_wal_senders = 10/" "$PG_CONF"
sudo sed -i "s/^#\?wal_keep_size.*/wal_keep_size = 1024MB/" "$PG_CONF"
sudo sed -i "s/^#\?hot_standby.*/hot_standby = on/" "$PG_CONF"
sudo sed -i "s/^#\?password_encryption.*/password_encryption = 'md5'/" "$PG_CONF"
check_status "Failed to configure postgresql.conf"

# (3) Ensure password_encryption in runtime config
echo "Setting password_encryption to 'md5' via ALTER SYSTEM..."
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"
check_status "Failed to set password_encryption via ALTER SYSTEM"

# (4) Restart PostgreSQL to apply changes
echo "Restarting PostgreSQL..."
sudo systemctl restart postgresql
check_status "Failed to restart PostgreSQL service"

# (5) Create the replicator user and set passwords
echo "Creating/altering replication user and postgres user..."
sudo -u postgres psql -c "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD '$service_account_password';"
check_status "Failed to create user"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$service_account_password';"
check_status "Failed to alter users"

# (6) Update pg_hba.conf to allow replication from secondary's IP
echo "host    replication     replicator      $secondary_server_IP         md5" | sudo tee -a "$PG_HBA"
check_status "Failed to add entry to pg_hba.conf"

# (7) Restart PostgreSQL again after pg_hba.conf change
echo "Restarting PostgreSQL to apply pg_hba.conf changes..."
sudo systemctl restart postgresql
check_status "Failed to restart PostgreSQL service"