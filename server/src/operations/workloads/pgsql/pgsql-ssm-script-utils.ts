import { CLOUDFLARE_DNS_IP } from '../../../utils/consts';

const checkCommandStatus = `
    check_status() {
        if [ $? -ne 0 ]; then
        echo "{\\"error\\": \\"$1\\"}"
        exit 0;
        fi
    }
`;

const getMappedOntapDataVolume = (fsxnId: string, region: string) => `
    ${checkCommandStatus}
    filesystemid="${fsxnId}"
    region="${region}"

    dataDir=$(systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
    check_status "Failed to get data directory"

    mount_path=$(sudo findmnt -n -o SOURCE --target $dataDir)
    check_status "Failed to get mount path"

    dnsName=$(echo "$mount_path" | cut -d':' -f1) 
    check_status "Failed to extract DNS name"

    junctionPath=$(echo "$mount_path" | cut -d':' -f2) 
    check_status "Failed to extract junction path"

    if [[ $dnsName =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
        ipAddress=$dnsName
    else
        ipAddress=$(dig +short $dnsName)
    fi

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
 
    ${getMappedOntapDataVolume(fsxnId, region)}
    endpoint="${endpoint}&svm.name=$svmName&name=$mountedVolume"
    result=$(ontap_request 'GET' $endpoint)
    echo $result
`;

const getPgSqlProtection = (fsxnId: string, region: string) => `
    #!/bin/bash
    #pgsql protection script
 
    ${getMappedOntapDataVolume(fsxnId, region)}
    endpoint="storage/volumes?fields=snapshot_count&svm.name=$svmName&name=$mountedVolume"
    result=$(ontap_request 'GET' $endpoint)
    check_status "Failed to fetch protection data"
    echo $result
`;

const ontapRestApi = `
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value"  --output text 2>/dev/null)
    check_status "Credentials not found for $filesystemid in SSM Parameter Store. Please ensure the credentials are stored in SSM Parameter Store with the name /netapp/wlmdb/$filesystemid"
    
    # Convert creds to a valid JSON string
    # First, replace single quotes with double quotes
    # Second sed is for adding quotes around keys, only if there are no quotes already
    creds=$(echo "$creds" | sed "s/'/\\"/g" | sed 's/\\([^"{},: ]\\+\\):/"\\1":/g')
    
    fsxusername=$(echo $creds | jq -r '.fsx.username')
    fsxpassword=$(echo $creds | jq -r '.fsx.password')
    
    cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem
 
    # Check if the certificate file exists
    if [ ! -f $cert_path ]; then
        # Check for public network to determine if we are in a public or private network
        if ping -c 1 -W 1 ${CLOUDFLARE_DNS_IP} > /dev/null 2>&1; then
            # Public network: download the certificate
            certsUrl="https://fsx-aws-Certificates.s3.amazonaws.com/bundle-$region.pem"
            if [ ! -f /tmp/fsx_bundle.pem ]; then
                curl -sS -o /tmp/fsx_bundle.pem "$certsUrl"
            fi
            cert_option="--cacert /tmp/fsx_bundle.pem"
        else
            # Private network: use --insecure
            cert_option="--insecure"
        fi
    else
        cert_option="--cacert $cert_path"
    fi

    ontap_request () {
        management_ip=management.$filesystemid.fsx.$region.amazonaws.com
        if ! ping -c 1 -W 2 "$management_ip" > /dev/null 2>&1; then
            management_ip=$(aws fsx describe-file-systems --file-system-id $filesystemid --region $region --query "FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]" --output text)
            cert_option="--insecure"
        fi
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
            $cert_option
            --location https://$management_ip/api/$endpoint
            $request_body
        )

        local response=$(curl "\${args[@]}" --write-out "HTTPSTATUS:%{http_code}")
        http_status=$(echo "$response" | sed -n 's/.*HTTPSTATUS:\\([0-9]*\\)$/\\1/p')
        return_result=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

        # Check for 4xx or 5xx errors
        if [[ $http_status -ge 400 ]]; then
            check_status $return_result
        fi
        echo $return_result
    }
`;

const getPgsqlInstanceData = `
    data_dir=$(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')
    sudo -u postgres pg_controldata $data_dir | jq -R -s -c 'split("\\n")[:-1]'
`;

export { getPgSqlStorageSavings, getPgsqlInstanceData, getPgSqlProtection };
