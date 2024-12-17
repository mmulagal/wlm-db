#!/bin/bash
exec > /var/log/netapp_wf/configure-ontap.log 2>&1
echo "Setting up the ontap environment..."

# Parse command-line arguments
while getopts "f:r:u:p:s:n:a:d:l:" opt; do
    case $opt in
        f) filesystemid="$OPTARG" ;;
        r) region="$OPTARG" ;;
        u) fsxusername="$OPTARG" ;;
        p) fsxpassword="$OPTARG" ;;
        s) fsxsvmid="$OPTARG" ;;
        n) fsxsvmname="$OPTARG" ;;
        a) fsxaggrname="$OPTARG" ;;
        d) fsxdatavolumename="$OPTARG" ;;
        l) fsxlogvolumename="$OPTARG" ;;
    esac
done

fsxdatamountpoint=/$fsxdatavolumename
fsxlogmountpoint=/$fsxlogvolumename

nfs_ip=$fsxsvmid.$filesystemid.fsx.$region.amazonaws.com

# Function to check the status of the previous command and exit on failure
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}

# Ping the IP address 1.1.1.1
ping -c 2 1.1.1.1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    is_public_network=true
else
    is_public_network=false
fi

if [ $is_public_network = true ]; then
    cert_url=https://fsx-aws-certificates.s3.amazonaws.com/bundle-$region.pem
    cert_path=/tmp/bundle-$region.pem
    curl -s -o $cert_path $cert_url
else
    cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem
fi

ontap_request () {
    management_ip=management.$filesystemid.fsx.$region.amazonaws.com
    auth=$(printf '%s:%s' "$fsxusername" "$fsxpassword" | base64)
    method=$1
    endpoint=$2

    if [ "$3" != "" ]; then
        request_body="--json $3"
    fi

    args=(
        --header "Authorization: Basic $auth"
        --request $method
        --cacert $cert_path
        --location https://$management_ip/api/$endpoint
        $request_body
    )
    echo ${args[@]}
    return_result=$(curl "${args[@]}")
}

check_and_create_ontap_volumes() {
    local return_result=""
    # Check if data volume exists
    ontap_request 'GET' "storage/volumes?name=$fsxdatavolumename"
    data_volume=$(echo $return_result | jq -r '.records[0].name')
    if [ "$data_volume" != "$fsxdatavolumename" ]; then
        echo "Creating data volume..."
        local data='{"name":"'$fsxdatavolumename'","size":"10G","nas":{"path":"'$fsxdatamountpoint'"},"svm":{"name":"'$fsxsvmname'"},"aggregates":[{"name":"'$fsxaggrname'"}]}'
        ontap_request 'POST' 'storage/volumes' "$data"
        check_status "Failed to create data volume"
    else
        echo "Data volume already exists."
    fi

    # Check if log volume exists
    ontap_request 'GET' "storage/volumes?name=$fsxlogvolumename"
    log_volume=$(echo $return_result | jq -r '.records[0].name')
    if [ "$log_volume" != "$fsxlogvolumename" ]; then
        echo "Creating log volume..."
        local data='{"name":"'$fsxlogvolumename'","size":"1G","nas":{"path":"'$fsxlogmountpoint'"},"svm":{"name":"'$fsxsvmname'"},"aggregates":[{"name":"'$fsxaggrname'"}]}'
        ontap_request 'POST' 'storage/volumes' "$data"
        check_status "Failed to create log volume"
    else
        echo "Log volume already exists."
    fi
}

check_and_create_ontap_volumes

# Create directories
sudo mkdir -p /$fsxdatavolumename /$fsxlogvolumename
check_status "Failed to create directories"

# Mount NFS volumes
sudo mount -t nfs $nfs_ip:$fsxdatamountpoint /$fsxdatavolumename
check_status "Failed to mount data volume"

sudo mount -t nfs $nfs_ip:$fsxlogmountpoint /$fsxlogvolumename
check_status "Failed to mount log volume"

# Add NFS entries to /etc/fstab
echo "$nfs_ip:$fsxdatamountpoint /$fsxdatavolumename nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab
echo "$nfs_ip:$fsxlogmountpoint /$fsxlogvolumename nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab
