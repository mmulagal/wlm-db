#!/bin/bash
exec > /var/log/netapp_wf_configure.log 2>&1
echo "Setting up the environment..."

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

cert_url=https://fsx-aws-certificates.s3.amazonaws.com/bundle-$region.pem
curl -s -o /tmp/bundle-$region.pem $cert_url
check_status "Failed to download certificate"

ontap_request () {
    management_ip=management.$filesystemid.fsx.$region.amazonaws.com
    auth=$(printf '%s:%s' "$fsxusername" "$fsxpassword" | base64)
    ontap_result=curl -s -H "Basic $auth" \
        -X $1 \
        --cacert /tmp/bundle-$region.pem \
        ${$3:+ --json "$3"} \
        "https://$management_ip/api/$2"
}

# Check if data volume exists
data_volume_exists=$($ontap_result 'GET' 'storage/volumes' | grep -c '"name": "'$fsxdatavolumename'"')
if [ $data_volume_exists -eq 0 ]; then
    echo "Creating data volume..."
    ontap_request 'POST' 'storage/volumes' '{ "name":"'$fsxdatavolumename'","size":"10G", "nas": { "path":"'$fsxdatamountpoint'" }, "svm": { "name": "'$fsxsvmname'" }, "aggregates": [ { "name": "'$fsxaggrname'" } ] }'
    check_status "Failed to create data volume"
else
    echo "Data volume already exists."
fi

# Check if log volume exists
log_volume_exists=$($ontap_result 'GET' 'storage/volumes' | grep -c '"name": "'$fsxlogvolumename'"')
if [ $log_volume_exists -eq 0 ]; then
    echo "Creating log volume..."
    ontap_request 'POST' 'storage/volumes' '{ "name":"'$fsxlogvolumename'","size":"1G","nas": { "path":"'$fsxlogmountpoint'" }, "svm": { "name": "'$fsxsvmname'" }, "aggregates": [ { "name": "'$fsxaggrname'" } ] }'
    check_status "Failed to create log volume"
else
    echo "Log volume already exists."
fi

# Create directories
sudo mkdir -p /$fsxdatavolumename /$fsxlogvolumename
check_status "Failed to create directories"

# Add NFS entries to /etc/fstab
echo "$nfs_ip:$fsxdatamountpoint /$fsxdatavolumename nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab
echo "$nfs_ip:$fsxlogmountpoint /$fsxlogvolumename nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab

# Mount NFS volumes
sudo mount -t nfs $nfs_ip:$fsxdatamountpoint /$fsxdatavolumename
check_status "Failed to mount data volume"

sudo mount -t nfs $nfs_ip:$fsxlogmountpoint /$fsxlogvolumename
check_status "Failed to mount log volume"
