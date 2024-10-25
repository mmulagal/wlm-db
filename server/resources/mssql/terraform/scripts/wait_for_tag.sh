#!/bin/bash

Path=$1
InstanceId=$2
Location=$3
NodeName=$4

counter=0
if [ "$NodeName" = "Validation-Node-1" ] || [ "$NodeName" = "Validation-Node-2" ]; then
    timeout=150 # 150 * 10 seconds = 25 minutes
else
    timeout=720 # 720 * 10 seconds = 2 hours
fi

echo "Starting wait_for_tag.sh with timeout: $timeout (10-second intervals)"

while true; do
  tag=$(sh "${Path}/scripts/check_tag.sh" "${InstanceId}" "${Location}")
  echo "Tag value: $tag"
  
  if [ "$tag" = 'completed' ]; then
    echo "Tag completed"
    break
  elif [ "$tag" = 'failed' ]; then
    echo "${NodeName} failed to deploy"
    exit 1
  else
    echo "Waiting for ${NodeName} tag... (counter: $counter)"
    sleep 10
    ((counter++))
    echo "Counter value: $counter"
    if [ $counter -ge $timeout ]; then
        echo "${NodeName} tag was not created within the timeout period. Stopping deployment."
        exit 1
    fi
  fi
done