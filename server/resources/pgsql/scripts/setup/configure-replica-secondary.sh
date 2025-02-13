#!/bin/bash

while getopts "a:b:" opt; do
    case $opt in
        a) primary_server_IP="$OPTARG" ;;
        b) service_account_password="$OPTARG" ;;
    esac
done

# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

# (1) Stop PostgreSQL
echo "Stopping PostgreSQL..."
sudo systemctl stop postgresql

# (2) Backup existing data directory
echo "Backing up /mnt/data to /mnt/data_backup..."
sudo cp -R /mnt/data/ /mnt/data_backup
check_status "Failed to backup /mnt/data"

# (3) Remove current data directory
echo "Removing /mnt/data..."
sudo rm -rf /mnt/data/
check_status "Failed to remove /mnt/data"

# (4) Run pg_basebackup to recreate standby data directory
# Replace 192.168.1.100 with the IP address of your primary server if different
echo "Running pg_basebackup from primary server..."
PGPASSWORD=$service_account_password pg_basebackup -h $primary_server_IP -D /mnt/data/ -U replicator -P -v -R -X stream -C -S slaveslot1
check_status "Failed to run pg_basebackup"

# (5) Ensure proper permissions
echo "Setting permissions on /mnt/data and /mnt/log..."
sudo chmod 0700 /mnt/data /mnt/log
sudo chown -R postgres:postgres /mnt/data /mnt/log
check_status "Failed to set permissions"

# (7) Start PostgreSQL
echo "Starting PostgreSQL..."
sudo systemctl start postgresql
check_status "Failed to start PostgreSQL service"