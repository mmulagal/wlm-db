#!/bin/bash

InstanceId=$1
Region=$2

while true; do
  tag_value=$(aws ec2 describe-tags --filters "Name=resource-id,Values=$InstanceId" "Name=key,Values=user_data" --region $Region --output text --query 'Tags[].Value')

  if [[ $tag_value == "completed" ]]; then
    echo "completed"
    break
  elif [[ $tag_value == "failed" ]]; then
    echo "failed"
    break
  else
    echo "The 'user_data' tag was not found."
    sleep 10
  fi
done