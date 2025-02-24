#!/bin/bash
exec > /var/log/netapp_wf/validate_vpc.log 2>&1

# Set args as variables
subnet=$1
region=$2
Stackname=$3
ResourceId=$4
IsTerraform=$5

echo "subnet: $subnet, region: $region, Stackname: $Stackname, ResourceId: $ResourceId"

# Get instance ID
token=$(curl -s -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" "http://169.254.169.254/latest/api/token")
instanceId=$(curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/instance-id")

failed=false
failedServices=()

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
    if [ "$IsTerraform" != "true" ]; then
       cfn-signal -e 1 -r "$FailureReason" --stack $Stackname --resource $ResourceId --region $region --id $instanceId
    fi
    sleep 60
    exit 1
else
    echo "{\"status\": \"Completed\", \"reason\": \"Done.\"}" | jq -c .
fi

echo "Sleeping for 60 seconds before exiting for cloudwatch logs to be updated"
sleep 60
