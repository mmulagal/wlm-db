#!/bin/bash

Path=$1
InstanceId=$2
Location=$3
NodeName=$4

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
  fi
done