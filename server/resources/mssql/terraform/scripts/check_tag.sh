#!/bin/bash

InstanceId=$1
Region=$2
NodeName=$3
AwsProfile=$4

counter=0
if [ "$NodeName" = "Validation-Node-1" ] || [ "$NodeName" = "Validation-Node-2" ]; then
    timeout=180 # 80 10-second intervals = 30 minutes
else
    timeout=1080 # 1080 10-second intervals = 3 hours
fi

echo "Checking tag for InstanceId: $InstanceId in Region: $Region with timeout: $timeout (10-second intervals)"

while true; do
  tag_value=$(aws ec2 describe-tags --filters "Name=resource-id,Values=$InstanceId" "Name=key,Values=user_data" --region $Region --profile $AwsProfile --output text --query 'Tags[].Value')
  echo "Tag value retrieved: $tag_value"

  if [ "$tag_value" = "completed" ]; then
    echo "completed"
    exit 0
  elif [ "$tag_value" = "failed" ]; then
    echo "failed"
    exit 1
  else
    echo "The 'user_data' tag was not found. Waiting... (counter: $counter)"
    sleep 10
    ((counter++))
    if [ $counter -ge $timeout ]; then
        echo "${NodeName} tag was not created within the timeout period. Stopping deployment."
        exit 1
    fi
  fi
done