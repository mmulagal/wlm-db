param(
    [string]$instance_id,
    [string]$region
)

while ($true) {
    $tag_value = aws ec2 describe-tags --filters "Name=resource-id,Values=$instance_id" "Name=key,Values=user_data" --region $region --output text --query 'Tags[].Value'

    if ($tag_value -eq "completed") {
        Write-Output "completed"
        break
    }
    elseif ($tag_value -eq "failed") {
        Write-Output "failed"
        break
    }
    else {
        Write-Output "The 'user_data' tag was not found."
        Start-Sleep -Seconds 10
    }
}