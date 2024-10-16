#!/bin/bash

Path=$1
InstanceId=$2
Location=$3
NodeName=$4

counter=0
if [[ "$NodeName" == "Validation-Node-1" || "$NodeName" == "Validation-Node-2" ]]; then
    timeout=150 # 150 * 10 seconds = 25 minutes
else
    timeout=540 # 540 * 10 seconds = 1 hour 30 minutes
fi

while true; do
  tag=$(sh "${Path}/scripts/check_tag.sh" "${InstanceId}" "${Location}")
  if [ "$tag" = 'completed' ]; then
    break
  elif [ "$tag" = 'failed' ]; then
    echo "${NodeName} failed to deploy"
    exit 1
  else
    echo "Waiting for ${NodeName} tag..."
    sleep 10
    ((counter++))
    if [ $counter -ge $timeout ]; then
        echo "${NodeName} tag was not created within the timeout period. Stopping deployment."
        exit 1
    fi
  fi
done