#!/bin/bash
exec > /var/log/netapp_wf/configure-pgpool.log 2>&1
# Parse command-line arguments
while getopts "a:b:c:" opt; do
    case $opt in
        a) parent_stack_name="$OPTARG" ;;
        b) service_account_password="$OPTARG" ;;
        c) fsxdatavolumename="$OPTARG" ;;
    esac
done

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

#Generate ssh keys for passwordless authentication for failover commands
ssh-keygen -t rsa -f /home/ec2-user/.ssh/id_rsa_pgpool -N ""
PUBLIC_KEY=$(cat /home/ec2-user/.ssh/id_rsa_pgpool.pub)
aws ssm put-parameter --name "/netapp/wlmdb/${parent_stack_name}_pgPoolPubKey" --value "$PUBLIC_KEY" --type "String"

echo "Parent Stack Name: $parent_stack_name"
interval=10  # Polling interval in seconds
elapsed_time=0
timeout=60

while [ $elapsed_time -lt $timeout ]; do
    primary_instance_details=$(aws ssm get-parameter --name "/netapp/wlmdb/${parent_stack_name}_primary" --query "Parameter.Value" --output text 2>>"/var/log/netapp_wf/configure-pgpool.log")
    secondary_instance_details=$(aws ssm get-parameter --name "/netapp/wlmdb/${parent_stack_name}_secondary" --query "Parameter.Value" --output text 2>>"/var/log/netapp_wf/configure-pgpool.log")
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
if is_valid_json "$primary_instance_details"; then
    valid_primary_instance_details="$primary_instance_details"
else
    valid_primary_instance_details=$(convert_to_json_string "$primary_instance_details")
fi

primary_ip_details=$(extract_ip "$valid_primary_instance_details")
primary_server_IP=$(echo "$primary_ip_details" | awk '{print $1}')
echo "primary server ip details fetched"

if is_valid_json "$secondary_instance_details"; then
    valid_secondary_instance_details="$secondary_instance_details"
else
    valid_secondary_instance_details=$(convert_to_json_string "$secondary_instance_details")
fi

secondary_ip_details=$(extract_ip "$valid_secondary_instance_details")
secondary_server_IP=$(echo "$secondary_ip_details" | awk '{print $1}')
secondary_server_IP_without_Cidr="${secondary_server_IP%/*}"
echo "secondary server ip details fetched"

# Path to the pgpool.conf file
PGPOOL_CONF="/usr/local/etc/pgpool.conf"
PG_HBA="/usr/local/etc/pool_hba.conf"

# Function to update or add a configuration parameter
update_config() {
    local param="$1"
    local value="$2"
    local config_file="$3"
    
    if grep -q "^#${param} = " "$config_file"; then
        sudo sed -i "s|^#${param} = .*|${param} = ${value}|" "$config_file"
    else
        echo "${param} = ${value}" >> "$config_file"
    fi
}

# First, install the necessary dependencies for building Pgpool-II from source
 
sudo yum groupinstall -y "Development Tools"
sudo yum install -y openssl-devel libmemcached-devel libevent-devel
sudo yum install -y postgresql-devel
 
cd /home/ec2-user/cfn/pgpool-II-4.6.0

# Configure and build
sudo ./configure
sudo make
sudo make install
 
# # Create the postgres user and group:
sudo groupadd postgres
sudo useradd -g postgres postgres

sudo mkdir -p /var/run/pgpool
sudo mkdir -p /var/log/pgpool
sudo chown postgres:postgres /var/run/pgpool
sudo chmod +x /home/ec2-user/cfn/scripts/setup/failover.sh

cp /usr/local/etc/pgpool.conf.sample /usr/local/etc/pgpool.conf
cp /usr/local/etc/pcp.conf.sample /usr/local/etc/pcp.conf
cp /usr/local/etc/pool_hba.conf.sample /usr/local/etc/pool_hba.conf

# Add the md5 password for the replicator user to the pool_passwd file
sudo /usr/local/bin/pg_md5 -m -u replicator "$service_account_password"
# Update or add the required parameters
update_config "listen_addresses" "'*'" "$PGPOOL_CONF"
update_config "port" "9999" "$PGPOOL_CONF"

# Add primary server details
update_config "backend_hostname0" "'${primary_server_IP}'" "$PGPOOL_CONF"
update_config "backend_port0" "5432" "$PGPOOL_CONF"
update_config "backend_weight0" "1" "$PGPOOL_CONF"
update_config "backend_data_directory0" "'/${fsxdatavolumename}'" "$PGPOOL_CONF"
update_config "backend_flag0" "'ALLOW_TO_FAILOVER'" "$PGPOOL_CONF"
update_config "backend_application_name0" "'server0'" "$PGPOOL_CONF"

# Add secondary server details
update_config "backend_hostname1" "'${secondary_server_IP_without_Cidr}'" "$PGPOOL_CONF"
update_config "backend_port1" "5432" "$PGPOOL_CONF"
update_config "backend_weight1" "1" "$PGPOOL_CONF"
update_config "backend_data_directory1" "'/${fsxdatavolumename}'" "$PGPOOL_CONF"
update_config "backend_flag1" "'ALLOW_TO_FAILOVER'" "$PGPOOL_CONF"
update_config "backend_application_name1" "'server1'" "$PGPOOL_CONF"

# Additional configurations
update_config "enable_pool_hba" "on" "$PGPOOL_CONF"
update_config "pool_passwd" "'/usr/local/etc/pool_passwd'" "$PGPOOL_CONF"
update_config "num_init_children" "32" "$PGPOOL_CONF"
update_config "max_pool" "4" "$PGPOOL_CONF"
update_config "log_destination" "'stderr'" "$PGPOOL_CONF"
update_config "logging_collector" "on" "$PGPOOL_CONF"
update_config "log_directory" "'/var/log/pgpool'" "$PGPOOL_CONF"
update_config "log_filename" "'pgpool.log'" "$PGPOOL_CONF"
update_config "load_balance_mode" "on" "$PGPOOL_CONF"
update_config "health_check_period" "10" "$PGPOOL_CONF"
update_config "health_check_timeout" "20" "$PGPOOL_CONF"
update_config "health_check_user" "'replicator'" "$PGPOOL_CONF"
update_config "health_check_password" "'${service_account_password}'" "$PGPOOL_CONF"
update_config "health_check_database" "'postgres'" "$PGPOOL_CONF"
update_config "health_check_max_retries" "3" "$PGPOOL_CONF"
update_config "sr_check_period" "10" "$PGPOOL_CONF"
update_config "sr_check_user" "'replicator'" "$PGPOOL_CONF"
update_config "sr_check_password" "'${service_account_password}'" "$PGPOOL_CONF"
update_config "sr_check_database" "'postgres'" "$PGPOOL_CONF"
update_config "failover_command" "'/home/ec2-user/cfn/scripts/setup/failover.sh %d %h %p %D %m %H %M %P %r %R %N %S'" "$PGPOOL_CONF"
update_config "failover_on_backend_error" "on" "$PGPOOL_CONF"

echo "host    all             all             $primary_server_IP/32         trust" | sudo tee -a "$PG_HBA"
echo "host    all             all             $secondary_server_IP         trust" | sudo tee -a "$PG_HBA"

# Wait for PostgreSQL to start in the primary and secondary servers
sleep 5m
#Start pgpool
sudo pgpool
echo "pgpool.conf has been updated successfully."
