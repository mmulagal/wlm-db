#!/bin/bash
exec > /var/log/netapp_wf_rename-host.log 2>&1
echo "Renaming the host..."

check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

sudo hostnamectl set-hostname $1
check_status "Failed to rename the host"

sudo sed -i "/^127.0.0.1/ s/$/ $1/" /etc/hosts
check_status "Failed to update /etc/hosts"
