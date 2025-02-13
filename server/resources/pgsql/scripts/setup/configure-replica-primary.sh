#!/bin/bash

# Parse command-line arguments
while getopts "i:s:" opt; do
    case $opt in
        i) secondary_server_IP="$OPTARG" ;;
        s) service_account_password="$OPTARG" ;;
    esac
done

# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}


# (1) Define variables for file paths.
PG_DATA_DIR="/mnt/data"
PG_CONF="$PG_DATA_DIR/postgresql.conf"
PG_HBA="$PG_DATA_DIR/pg_hba.conf"

# (2) Update postgresql.conf parameters
echo "Updating $PG_CONF ..."
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
sudo sed -i "s/^#\?wal_level.*/wal_level = replica/" "$PG_CONF"
sudo sed -i "s/^#\?max_wal_senders.*/max_wal_senders = 10/" "$PG_CONF"
sudo sed -i "s/^#\?wal_keep_size.*/wal_keep_size = 64MB/" "$PG_CONF"
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
check_status "Failed to create user re"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$service_account_password';"
check_status "Failed to create/alter users"

# (6) Update pg_hba.conf to allow replication from secondary's IP
echo "host    replication     replicator      $secondary_server_IP         md5" | sudo tee -a "$PG_HBA"
check_status "Failed to add entry to pg_hba.conf"

# (7) Restart PostgreSQL again after pg_hba.conf change
echo "Restarting PostgreSQL to apply pg_hba.conf changes..."
sudo systemctl restart postgresql
check_status "Failed to restart PostgreSQL service"