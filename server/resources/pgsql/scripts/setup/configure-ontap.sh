#!/bin/bash
exec > /var/log/netapp_wf/configure-ontap.log 2>&1
echo "Setting up the ontap environment..."

# Parse command-line arguments
while getopts "f:r:s:n:a:d:l:v:p:" opt; do
    case $opt in
        f) filesystemid="$OPTARG" ;;
        r) region="$OPTARG" ;;
        s) fsxsvmid="$OPTARG" ;;
        n) fsxsvmname="$OPTARG" ;;
        a) fsxaggrname="$OPTARG" ;;
        d) fsxdatavolumename="$OPTARG" ;;
        l) fsxlogvolumename="$OPTARG" ;;
        v) svmuuid="$OPTARG" ;;
        p) parentstackname="$OPTARG" ;;
    esac
done

fsxdatamountpoint=/$fsxdatavolumename
fsxlogmountpoint=/$fsxlogvolumename
datadirname="${fsxdatavolumename/_replica/}" # Remove _replica from the data volume name
logdirname="${fsxlogvolumename/_replica/}" # Remove _replica from the log volume name

nfs_ip=$fsxsvmid.$filesystemid.fsx.$region.amazonaws.com

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

extract_credentials() {
    local json_string="$1"
    local fsxusername=$(echo "$json_string" | jq -r '.fsx.username')
    local fsxpassword=$(echo "$json_string" | jq -r '.fsx.password')
    echo "$fsxusername $fsxpassword"
}

creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$parentstackname" --with-decryption --query "Parameter.Value" --output text)
if is_valid_json "$creds"; then
    valid_creds="$creds"
else
    valid_creds=$(convert_to_json_string "$creds")
fi

credentials=$(extract_credentials "$valid_creds")
fsxusername=$(echo "$credentials" | awk '{print $1}')
fsxpassword=$(echo "$credentials" | awk '{print $2}')

cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem

ontap_request () {
    management_ip=management.$filesystemid.fsx.$region.amazonaws.com
    auth=$(printf '%s:%s' "$fsxusername" "$fsxpassword" | base64)
    method=$1
    endpoint=$2

    if [ "$3" != "" ]; then
        request_body="--json $3"
    fi

    args=(
        --silent
        --show-error
        --header "Authorization: Basic $auth"
        --request $method
        --cacert $cert_path
        --location https://$management_ip/api/$endpoint
        $request_body
    )
    echo "ONTAP rest API params: ${args[@]}"
    return_result=$(curl "${args[@]}")
    echo $return_result
}

check_and_create_ontap_volumes() {
    local return_result=""
    # Check if data volume exists
    ontap_request 'GET' "storage/volumes?name=$fsxdatavolumename&svm.name=$fsxsvmname"
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
    ontap_request 'GET' "storage/volumes?name=$fsxlogvolumename&svm.name=$fsxsvmname"
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

# Update NFS transfer size
ontap_request 'PATCH' "protocols/nfs/services/$svmuuid" '{"transport":{"tcp_max_transfer_size":262144}}'
check_status "Failed to update NFS transfer size"

# Create directories
sudo mkdir -p /$datadirname /$logdirname
check_status "Failed to create directories"

# Mount NFS volumes
sudo mount -t nfs $nfs_ip:$fsxdatamountpoint /$datadirname
check_status "Failed to mount data volume"

sudo mount -t nfs $nfs_ip:$fsxlogmountpoint /$logdirname
check_status "Failed to mount log volume"

# Add NFS entries to /etc/fstab
echo "$nfs_ip:$fsxdatamountpoint /$datadirname nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab
echo "$nfs_ip:$fsxlogmountpoint /$logdirname nfs rw,hard,nointr,bg,vers=4,proto=tcp,rsize=262144,wsize=262144 0 0" | sudo tee -a /etc/fstab

# store credentials in SSM

max_attempts=4
attempt=1
while [ $attempt -le $max_attempts ]; do
  aws ssm put-parameter --name "/netapp/wlmdb/$filesystemid" --value "{fsx:{username: '$fsxusername', password: '$fsxpassword'}}" --type SecureString --overwrite && break
  sleep_time=$((attempt * 2))
  echo "Attempt $attempt failed, retrying in $sleep_time seconds..."
  sleep $sleep_time
  attempt=$((attempt+1))
done

if [ $attempt -gt $max_attempts ]; then
  echo "Failed to update parameter after $max_attempts attempts."
fi
