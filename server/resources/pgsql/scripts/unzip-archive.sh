#!/bin/bash
exec > /var/log/netapp_wf/unzip_archive.log 2>&1

usage() {
    echo "Usage: $0 -s <source> -d <destination>"
    exit 1
}

# Parse command-line arguments
while getopts "s:d:" opt; do
    case $opt in
        s) Source="$OPTARG" ;;
        d) Destination="$OPTARG" ;;
        *) usage ;;
    esac
done

# Check if source and destination are provided
if [ -z "$Source" ] || [ -z "$Destination" ]; then
    usage
fi

echo "Unpacking $Source to $Destination"
unzip "$Source" -d "$Destination"
chmod -R 755 /home/ec2-user/cfn
