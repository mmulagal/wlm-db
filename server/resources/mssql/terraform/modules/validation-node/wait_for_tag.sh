#!/bin/bash

path=$1
instanceId=$2
location=$3

while true; do
  tag=$(sh "${path}/check_tag.sh" "${instanceId}" "${location}")
  if [ "$tag" = 'completed' ]; then
    break
  elif [ "$tag" = 'failed' ]; then
    echo 'Validation Node failed to deploy'
    exit 1
  else
    echo 'Waiting for validation node tag...'
    sleep 10
  fi
done