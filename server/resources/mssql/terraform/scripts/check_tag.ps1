param(
    [string]$InstanceId,
    [string]$Region,
    [string]$NodeName,
    [string]$AwsProfile
)

$counter = 0
$timeout = if ($NodeName -in @('Validation-Node-1', 'Validation-Node-2')) { 180 } else { 1080 } # 180 / 60 seconds = 30 minutes, 1080 / 60 seconds = 3 hours

Write-Output "Checking tag for InstanceId: $InstanceId in Region: $Region with timeout: $timeout (10-second intervals)"

while ($true) {
    $tag_value = aws ec2 describe-tags --filters "Name=resource-id,Values=$InstanceId" "Name=key,Values=user_data" --region $Region --profile $AwsProfile --output text --query 'Tags[].Value'
    Write-Output "Tag value retrieved: $tag_value"

    if ($tag_value -eq "completed") {
        Write-Output "completed"
        break
    }
    elseif ($tag_value -eq "failed") {
        Write-Output "failed"
        break
    }
    else {
        Write-Output "The 'user_data' tag was not found. Waiting... (counter: $counter)"
        Start-Sleep -Seconds 10
        $counter++
        if ($counter -ge $timeout) {
            Write-Output "$NodeName tag was not created within the timeout period. Stopping deployment."
            exit 1
        }
    }
}