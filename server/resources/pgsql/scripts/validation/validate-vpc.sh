#!/bin/bash
exec > /var/log/netapp_wf/validate_vpc.log 2>&1

# Set args as variables
subnet=$1
region=$2
Stackname=$3
ResourceId=$4

echo "subnet: $subnet, region: $region, Stackname: $Stackname, ResourceId: $ResourceId"

# Get instance ID
instanceId=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

# Tries to enable TLS 1.2
function enableTLS12 {
    if [[ $(openssl version | awk '{print $2}' | cut -d'.' -f2) -lt 12 ]]; then
        export SSL_PROTOCOL=TLSv1_2
    fi
}

failed=false
failedServices=()
enableTLS12

# Example for serviceURLMap='{"S3": "s3.us-east-2.amazonaws.com"}'
# Convert input string to associative array
serviceURLMap='{"S3": "s3.'$region'.amazonaws.com"}'
declare -A serviceURLHashTable
serviceURLHashTable=$(echo "$serviceURLMap" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"')

for service in "${!serviceURLHashTable[@]}"; do
    out=$(curl -s -o /dev/null -w "%{http_code}" "https://cloudformation.$region.amazonaws.com")

    if [[ ($out -ge 200 && $out -lt 299) || ($out -ge 500 && $out -lt 600) ]]; then
        # Was able to connect to service, continue testing
        continue
    else
        failedServices+=("$service")
        failed=true
    fi
done

if [ $failed = true ]; then
    FailureReason="Failed to connect to AWS Cloud Formation endpoint. Check if the security group allows HTTPS(443) tcp port and subnet is associated with the endpoint."
    echo "{\"status\": \"Failed\", \"reason\": \"$FailureReason\"}" | jq -c .
    cfn-signal -e 1 -r "$FailureReason"
    aws cloudformation signal-resource --stack-name "$Stackname" --status FAILURE --logical-resource-id "$ResourceID" --unique-id "$instanceId"
    exit 1
else
    echo "{\"status\": \"Completed\", \"reason\": \"Done.\"}" | jq -c .
    echo ""
    cfn-signal -e $? --stack $Stackname --resource $ResourceId --region $region
fi

echo "Sleeping for 60 seconds before exiting for cloudwatch logs to be updated"
sleep 60
