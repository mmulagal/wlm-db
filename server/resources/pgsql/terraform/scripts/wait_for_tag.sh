#!/bin/bash

Path=$1
InstanceId=$2
Location=$3
NodeName=$4
AwsProfile=$5

wait_for_tag_log_file="${Path}/logs/${NodeName}_wait_for_tag_linux.log"
check_tag_log_file="${Path}/logs/${NodeName}_check_tag.log"

# Check if the logs directory exists, if not, create it
if [ ! -d "${Path}/logs" ]; then
  mkdir -p "${Path}/logs"
fi

echo "Starting wait_for_tag.sh" | tee -a "$wait_for_tag_log_file"

# Run the check_tag.sh script and log its output to check_tag.log
sh "${Path}/scripts/check_tag.sh" "${InstanceId}" "${Location}" "${NodeName}" "${AwsProfile}" >> "$check_tag_log_file" 2>&1

# Read the last line of the check_tag log file to get the tag status
tag=$(tail -n 1 "$check_tag_log_file")
echo "Tag value: $tag" | tee -a "$wait_for_tag_log_file"

if [ "$tag" = 'completed' ]; then
  echo "Tag completed" | tee -a "$wait_for_tag_log_file"
elif [ "$tag" = 'failed' ]; then
  echo "${NodeName} failed to deploy" | tee -a "$wait_for_tag_log_file"
  exit 1
else
  echo "${NodeName} tag was not created within the timeout period. Stopping deployment." | tee -a "$wait_for_tag_log_file"
  exit 1
fi