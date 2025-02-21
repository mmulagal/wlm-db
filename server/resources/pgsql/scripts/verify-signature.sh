#!/bin/bash
exec > /var/log/netapp_wf/verify_signature.log 2>&1

# Function to print usage
usage() {
    echo "Usage: $0 -f <FilePath> -s <SignatureFilePath> -p <PubFilePath> -r <ResourceID> -n <Stackname>"
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
        t) IsTerraform="$OPTARG" ;;  # Handle the IsTerraform parameter
        *) usage ;;
    esac
done

# Check if mandatory arguments are provided
if [ -z "$FilePath" ] || [ -z "$SignatureFilePath" ] || [ -z "$PubFilePath" ] || [ -z "$ResourceID" ] || [ -z "$Stackname" ]; then
    usage
fi
# Set error handling
set -e

# Get Instance ID
token=$(curl -s -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" "http://169.254.169.254/latest/api/token")
instanceID=$(curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/instance-id")

mkdir -p /home/ec2-user/cfn/log/
logfilename=/home/ec2-user/cfn/log/$(basename "$FilePath").log

# Verify signature
openssl dgst -sha256 -verify "$PubFilePath" -signature "$SignatureFilePath" "$FilePath" > "$logfilename" 2>&1

# Check if verified or not
if grep -q "Verified OK" "$logfilename"; then
    echo "Signature verified successfully."
else
    echo "Signature verification failed."
     if [ "$IsTerraform" != "true" ]; then
        cfn-signal --exit-code 1 --stack "$Stackname" --resource "$ResourceID" --reason "Verifying the signature of compressed files failed" --id "$instanceID"
    fi
    exit 1
fi