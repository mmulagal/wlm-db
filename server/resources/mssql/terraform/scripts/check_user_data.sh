# Step 1: Create a script that checks the user_data tag
# This is a shell script example. You may need to adjust it based on your environment and requirements.
# Save this script as check_user_data_tag.sh
```bash
#!/bin/bash
INSTANCE_ID=$1
REGION=$2

USER_DATA_TAG=$(aws ec2 describe-tags --filters "Name=resource-id,Values=$INSTANCE_ID" "Name=key,Values=user_data" --region $REGION --output text --query 'Tags[*].Value')

if [ "$USER_DATA_TAG" == "failed" ]; then
  exit 1
fi