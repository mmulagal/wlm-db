#!/bin/bash

# Function to print usage
usage() {
    echo "Usage: $0 -f <FilePath> -s <SignatureFilePath> -p <PubFilePath> -r <ResourceID> -n <Stackname> [-t <IsTerraform>]"
    exit 1
}

# Parse command-line arguments
while getopts "f:s:p:r:n:t:" opt; do
    case $opt in
        f) FilePath="$OPTARG" ;;
        s) SignatureFilePath="$OPTARG" ;;
        p) PubFilePath="$OPTARG" ;;
        r) ResourceID="$OPTARG" ;;
        n) Stackname="$OPTARG" ;;
        t) IsTerraform="$OPTARG" ;;
        *) usage ;;
    esac
done

# Check if mandatory arguments are provided
if [ -z "$FilePath" ] || [ -z "$SignatureFilePath" ] || [ -z "$PubFilePath" ] || [ -z "$ResourceID" ] || [ -z "$Stackname" ]; then
    usage
fi

# Set error handling
set -e

# Start logging
logfile="/cfn/log/verifysignature.log"
exec > >(tee -a "$logfile") 2>&1

# Get Instance ID
token=$(curl -s -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" "http://169.254.169.254/latest/api/token")
instanceID=$(curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/instance-id")

logfilename=$(basename "$FilePath")

# Verify signature
openssl dgst -sha256 -verify "$PubFilePath" -signature "$SignatureFilePath" "$FilePath" > "/cfn/log/$logfilename.txt" 2>&1

# Check if verified or not
if grep -q "Verified OK" "/cfn/log/$logfilename.txt"; then
    echo "Signature verified successfully."
else
    echo "Signature verification failed."
    exit 1
fi