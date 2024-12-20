#!/bin/bash
exec > /var/log/netapp_wf/validate-fsx.log 2>&1
echo "Validating FSx file system by connecting to ONTAP rest api."

# Parse command-line arguments
while getopts "e:f:r:s:n:a:d:l:p:" opt; do
    case $opt in
        e) performfsxvalidation="$OPTARG" ;;
        f) filesystemid="$OPTARG" ;;
        r) region="$OPTARG" ;;
        n) stackname="$OPTARG" ;;
        p) parentstackname="$OPTARG" ;;
        s) resource="$OPTARG" ;;

    esac
done

token=$(curl -s -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" "http://169.254.169.254/latest/api/token")
instanceId=$(curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/instance-id")

if [ "$performfsxvalidation" != "true" ]; then
    echo "New FSx file system. Skipping the validation."
    echo "{\"status\": \"Completed\", \"reason\": \"Done.\"}" | jq -c .
    cfn-signal --exit-code 0 --stack $stackname --resource $resource --region $region --id $instanceId
    exit 0
fi

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
        -o /dev/null
        --write-out "%{http_code}"
        $request_body
    )
    return_result=$(curl "${args[@]}")
    echo $return_result
}

result=$(ontap_request 'GET' 'cluster?fields=version')
echo "ONTAP version API response code: $result"
if [[ ($result -ge 200 && $result -lt 299) || ($result -ge 500 && $result -lt 600) ]]; then
    echo "{\"status\": \"Completed\", \"reason\": \"Done.\"}" | jq -c .
    cfn-signal --exit-code 0 --stack $stackname --resource $resource --region $region --id $instanceId
else
    FailureReason="Unable to reach storage. 1. Check storage credentials are valid 2. Check if routing table allows connection from the subnet 3. Check if storage security group allows HTTPS(443) and NFS(2049) tcp ports."
    echo "{\"status\": \"Failed\", \"reason\": \"$FailureReason\"}" | jq -c .
    cfn-signal --exit-code 1 --reason "$FailureReason" --stack $stackname --resource $resource --region $region --id $instanceId
    exit 1
fi
