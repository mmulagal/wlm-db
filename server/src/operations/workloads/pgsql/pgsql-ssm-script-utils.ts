const getMappedOntapDataVolume = `
    response=$(findmnt -n -o SOURCE "$(sudo systemctl cat postgresql | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}')")
    mountedVolume=""
    # Check if response is not empty
    if [[ -n "$response" ]]; then
        # Split the response by ':' and get the second part
        part=$(echo "$response" | cut -d':' -f2)
        trimmed_part="\${part:1}"
        mountedVolume=$(echo "$trimmed_part" | xargs)
    else
        echo "Mounted Volume Response is empty or null"
    fi
`;

const getPgSqlStorageSavings = (fsxnId: string, region: string, endpoint: string) => `
    #!/bin/bash
    #PG SQL Storage Savings
    filesystemid="${fsxnId}"
    region="${region}"
 
    ${getMappedOntapDataVolume}
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
 
    ${getMappedOntapDataVolume}
    endpoint="storage/volumes?fields=snapshot_count&name=$mountedVolume"
    ${ontapRestApi}
    result=$(ontap_request 'GET' $endpoint)
    corrected_res=$(echo "$result" | sed 's/.records\\n$//')
    echo "$corrected_res" | jq -c '.records[]' | while read -r record; do
    uuid=$(echo "$record" | jq -r '.uuid')
    name=$(echo "$record" | jq -r '.name')
    snapshot_count=$(echo "$record" | jq -r '.snapshot_count')

    jq -n --arg uuid "$uuid" --arg name "$name" --arg snapshot_count "$snapshot_count" \
    '{uuid: $uuid, name: $name, snapshotCount: $snapshot_count}'
    done
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

const getPgsqlInstanceData = (fsxDataVolumeName: string) => `
    sudo -u postgres pg_controldata /${fsxDataVolumeName} | jq -R -s -c 'split("\\n")[:-1]'
`;

export { getPgSqlStorageSavings, getPgsqlInstanceData, getPgSqlProtection };
