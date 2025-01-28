#!/bin/bash
exec > /var/log/netapp_wf/configure-pgsql.log 2>&1
echo "Setting up the postgresql environment..."

# Parse command-line arguments
while getopts "d:l:v:w:" opt; do
    case $opt in
        d) fsxdatavolumename="$OPTARG" ;;
        l) fsxlogvolumename="$OPTARG" ;;
        v) pgsql_version="$OPTARG" ;;
        w) service_account_password="$OPTARG" ;;
    esac
done

fsxdatamountpoint=/$fsxdatavolumename
fsxlogmountpoint=/$fsxlogvolumename
archive_dir=/$fsxlogvolumename/logs/archived_logs

# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

# Configure passwordless sudo for ec2-user
echo "ec2-user ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/ec2-user
check_status "Failed to configure passwordless sudo for ec2-user"

# Create postgres user and group, set permissions
if ! id "postgres" &>/dev/null; then
    sudo groupadd -f postgres
    sudo useradd -g postgres postgres
    check_status "Failed to create postgres user and group"
fi

# Install PostgreSQL and NFS utilities based on the specified version
sudo yum install -y $pgsql_version  $pgsql_version-server nfs-utils
check_status "Failed to install PostgreSQL or NFS utilities"

# Add PostgreSQL binaries to PATH
export PATH=$PATH:/usr/bin

# Set permissions for directories
sudo chmod 0700 /$fsxdatavolumename /$fsxlogvolumename
sudo chown -R postgres:postgres /$fsxdatavolumename /$fsxlogvolumename
check_status "Failed to set permissions"

# Remove existing contents of /$fsxdatavolumename directory
sudo rm -rf /$fsxdatavolumename/*

# Initialize the database cluster on the FSxN mounted volume
sudo -u postgres /usr/bin/initdb -D /$fsxdatavolumename
check_status "Failed to initialize PostgreSQL database cluster on FSxN volume"

# Increase shared memory limits
# echo "kernel.shmmax = 68719476736" | sudo tee -a /$fsxdatavolumename/postgresql.conf
# echo "kernel.shmall = 4294967296" | sudo tee -a /$fsxdatavolumename/postgresql.conf
# sudo sysctl --system

# check_status "Failed to increase shared memory limits"

# Increase shared buffer in postgresql.conf
# sudo sed -i "s|^shared_buffers =.*|shared_buffers = 4GB|" /$fsxdatavolumename/postgresql.conf

# Increase work_mem in postgresql.conf
# sudo sed -i "s|^#work_mem =.*|work_mem = 32MB|" /$fsxdatavolumename/postgresql.conf

# Update PostgreSQL configuration to use the new data and log directories
sudo sed -i "s|^#data_directory =.*|data_directory = '/$fsxdatavolumename'|" /$fsxdatavolumename/postgresql.conf
sudo sed -i "s|^#log_directory =.*|log_directory = '/$fsxlogvolumename'|" /$fsxdatavolumename/postgresql.conf
check_status "Failed to update PostgreSQL configuration"

# Changing dynamic_shared_memory_type to mmap
sudo sed -i "s|^dynamic_shared_memory_type =.*|dynamic_shared_memory_type = mmap|" /$fsxdatavolumename/postgresql.conf

# Change the PGDATA environment variable
sudo sed -i "s|^Environment=PGDATA=.*|Environment=PGDATA=/$fsxdatavolumename|" /usr/lib/systemd/system/postgresql.service

# Add RequiresMountsFor to the PostgreSQL service unit file, so that the service starts after the FSxN volumes are mounted
sudo mkdir -p /etc/systemd/system/postgresql.service.d
sudo echo "[Unit]" > /etc/systemd/system/postgresql.service.d/override.conf
sudo echo "RequiresMountsFor=$fsxdatamountpoint" >> /etc/systemd/system/postgresql.service.d/override.conf
sudo echo "RequiresMountsFor=$fsxlogmountpoint" >> /etc/systemd/system/postgresql.service.d/override.conf

# Reload the systemd configuration
sudo systemctl daemon-reload
check_status "Failed to reload systemd configuration"

# Enable the PostgreSQL service to start on boot
sudo systemctl enable postgresql
check_status "Failed to enable PostgreSQL service"

# Start the PostgreSQL service
sudo systemctl start postgresql
check_status "Failed to start PostgreSQL service"

# Switch to postgres user and move wal logs to log volume
sudo chown -R postgres:postgres /$fsxdatavolumename/pg_wal
# Ensure the target directory is empty
sudo rm -rf /$fsxlogvolumename/pg_wal
sudo -u postgres mv /$fsxdatavolumename/pg_wal /$fsxlogvolumename/pg_wal
check_status "Failed to move WAL logs"

# Create soft link to moved wal dir
sudo -u postgres ln -s /$fsxlogvolumename/pg_wal /$fsxdatavolumename/pg_wal
check_status "Failed to create soft link for WAL logs"

# Create postgresql archive log dir
sudo -u postgres mkdir -p $archive_dir
check_status "Failed to create PostgreSQL archive log directory"

# Restart the PostgreSQL service
sudo systemctl restart postgresql
check_status "Failed to restart PostgreSQL service"

# Set password for postgres user
sudo -u postgres /usr/bin/psql -c "ALTER USER postgres PASSWORD '$service_account_password';"
check_status "Failed to set password for postgres user"

# Verify the data directory
data_directory=$(sudo -u postgres /usr/bin/psql -t -c "SHOW data_directory;" | xargs)
if [ "$data_directory" = "/$fsxdatavolumename" ]; then
    echo "PostgreSQL data directory is correctly set to the FSxN mounted volume: $data_directory"
else
    echo "Error: PostgreSQL data directory is not set to the FSxN mounted volume. Current data directory: $data_directory"
    exit 1
fi

# pgvector installation
dnf install -y make $pgsql_version-server-devel
cd /home/ec2-user/cfn/pgvector
make
check_status "Failed to build pgvector"
make install
check_status "Failed to install pgvector"

# Create pgvector extension
sudo -u postgres /usr/bin/psql -c "CREATE EXTENSION vector;"
