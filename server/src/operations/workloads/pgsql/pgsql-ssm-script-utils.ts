const checkCommandStatus = `
check_status() {
    if [ $? -ne 0 ]; then
    echo "$1"
    exit 1;
    fi
}
`;

const getMappedOntapDataVolume = (fsxnId: string, region: string) => `
    ${checkCommandStatus}
    filesystemid="${fsxnId}"
    region="${region}"

    dataDir=$(systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
    check_status "Failed to get data directory"

    mount_path=$(findmnt -n -o SOURCE $dataDir)
    check_status "Failed to get mount path"

    dnsName=$(echo "$mount_path" | cut -d':' -f1) 
    check_status "Failed to extract DNS name"

    junctionPath=$(echo "$mount_path" | cut -d':' -f2) 
    check_status "Failed to extract junction path"

    ipAddress=$(dig +short $dnsName)
    check_status "Failed to resolve IP address"

    svmEndpoint='svm/svms?fields=ip_interfaces'
    ${ontapRestApi}
    result=$(ontap_request 'GET' $svmEndpoint)
    check_status "Failed to fetch SVM endpoint data"

    svmResult=$(echo "$result" | jq --arg ip_address "$ipAddress" '
    .records[] |
    select(.ip_interfaces[] | select(.name == "nfs_smb_management_1" and .ip.address == $ip_address)) |
     {name: .name, uuid: .uuid}
    ')
    check_status "Failed to get matching SVM with IP address"

    svmName=$(echo "$svmResult" | jq -r '.name')
    check_status "Failed to extract SVM name"

    volEndpoint="storage/volumes?svm.name=$svmName&nas.path=$junctionPath"
    response=$(ontap_request 'GET' $volEndpoint)
    check_status "Failed to fetch volume endpoint data"

    mountedVolume=$(echo "$response" | jq -r '.records[0].name')
    check_status "Failed to extract mounted volume name"
`;

const getPgSqlStorageSavings = (fsxnId: string, region: string, endpoint: string) => `
    #!/bin/bash
    #PG SQL Storage Savings
    filesystemid="${fsxnId}"
    region="${region}"
 
    ${getMappedOntapDataVolume(fsxnId, region)}
    endpoint="${endpoint}&name=$mountedVolume"
    ${ontapRestApi}
    result=$(ontap_request 'GET' $endpoint)
    echo $result
`;

const getPgSqlProtection = (fsxnId: string, region: string) => `
    #!/bin/bash
    #pgsql protection script
    filesystemid="${fsxnId}"
    region="${region}"
 
    ${checkCommandStatus}
    ${getMappedOntapDataVolume(fsxnId, region)}
    endpoint="storage/volumes?fields=snapshot_count&name=$mountedVolume"
    ${ontapRestApi}
    result=$(ontap_request 'GET' $endpoint)
    check_status "Failed to fetch protection data"
    echo $result
`;

const ontapRestApi = `
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value"  --output text)
    
    # Convert creds to a valid JSON string
    creds=$(echo "$creds" | sed "s/'/\\"/g" | sed 's/\\([a-zA-Z0-9_]*\\):/"\\1":/g')
    
    fsxusername=$(echo $creds | jq -r '.fsx.username')
    fsxpassword=$(echo $creds | jq -r '.fsx.password')
    
    cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem
 
    ontap_request () {
        management_ip=management.$filesystemid.fsx.$region.amazonaws.com
        auth=$(printf '%s:%s' $fsxusername $fsxpassword | base64)
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
        return_result=$(curl "\${args[@]}")
        echo $return_result
    }
`;

const getPgsqlInstanceData = `
    data_dir=$(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
    sudo -u postgres pg_controldata $data_dir | jq -R -s -c 'split("\\n")[:-1]'
`;

export { getPgSqlStorageSavings, getPgsqlInstanceData, getPgSqlProtection };
