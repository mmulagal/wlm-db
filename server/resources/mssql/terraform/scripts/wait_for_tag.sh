#!/bin/bash

Path=$1
InstanceId=$2
Location=$3
NodeName=$4

log_file="${Path}/logs/${NodeName}_check_tag.log"
echo "Starting wait_for_tag.sh"

# Run the check_tag.sh script and log its output
sh "${Path}/scripts/check_tag.sh" "${InstanceId}" "${Location}" "${NodeName}" >> "$log_file" 2>&1

# Read the last line of the log file to get the tag status
tag=$(tail -n 1 "$log_file")
echo "Tag value: $tag"

if [ "$tag" = 'completed' ]; then
  echo "Tag completed"
elif [ "$tag" = 'failed' ]; then
  echo "${NodeName} failed to deploy"
  exit 1
else
  echo "${NodeName} tag was not created within the timeout period. Stopping deployment."
  exit 1
fi