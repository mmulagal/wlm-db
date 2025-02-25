#!/bin/bash
exec > /var/log/netapp_wf/configure-replica-secondary.log 2>&1
while getopts "a:b:c:d:" opt; do
    case $opt in
        a) parent_stack_name="$OPTARG" ;;
        b) service_account_password="$OPTARG" ;;
        c) fsxdatavolumename="$OPTARG" ;;
        d) fsxlogvolumename="$OPTARG" ;;
    esac
done

export PGPASSWORD=$service_account_password
# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

echo "Sleeping for 2 minutes." # for replication to be completed on node1
sleep 2m
echo "starting execution"

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
    instance_details=$(aws ssm get-parameter --name "/netapp/wlmdb/${parent_stack_name}_primary" --query "Parameter.Value" --output text 2>/dev/null)
    
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
primary_server_IP=$(echo "$ip_details" | awk '{print $1}')
echo "ip details fetched"

# Delete the parameter from SSM
aws ssm delete-parameter --name "/netapp/wlmdb/${parent_stack_name}_primary"

# (1) Stop PostgreSQL
echo "Stopping PostgreSQL..."
sudo systemctl stop postgresql

# (2) Backup existing data directory
sudo cp -R /$fsxdatavolumename /${fsxdatavolumename}_backup
check_status "Failed to backup $fsxdatavolumename"

# (3) Remove current data directory
echo "Removing $fsxdatavolumename directory"
sudo rm -rf /$fsxdatavolumename/ || true
check_status "Failed to remove $fsxdatavolumename"

# (4) Run pg_basebackup to recreate standby data directory
echo "Running pg_basebackup from primary server..."
sudo -E pg_basebackup -h $primary_server_IP -D /$fsxdatavolumename -U replicator -P -v -R -X stream -C -S slaveslot1
check_status "Failed to run pg_basebackup"

# (5) Ensure proper permissions
echo "Setting permissions on /mnt/data and /mnt/log..."
sudo chmod 0700 /$fsxdatavolumename /$fsxlogvolumename
sudo chown -R postgres:postgres /$fsxdatavolumename /$fsxlogvolumename
check_status "Failed to set permissions"

# (6) Start PostgreSQL
echo "Starting PostgreSQL..."
sudo systemctl start postgresql
check_status "Failed to start PostgreSQL service"