param(
    [string]$Path,
    [string]$InstanceId,
    [string]$Location,
    [string]$NodeName,
    [string]$AwsProfile
)

$wait_for_tag_log_file = "${Path}\logs\${NodeName}_wait_for_tag_windows.log"
$check_tag_log_file = "${Path}\logs\${NodeName}_check_tag.log"

# Check if the logs directory exists, if not, create it
if (-not (Test-Path -Path "${Path}\logs")) {
    New-Item -ItemType Directory -Force -Path "${Path}\logs"
}

Write-Output "Starting wait_for_tag.ps1" | Tee-Object -FilePath $wait_for_tag_log_file -Append

# Execute the check_tag script and log the output to check_tag.log
& "${Path}\scripts\check_tag.ps1" -InstanceId $InstanceId -Region $Location -NodeName $NodeName -AwsProfile $AwsProfile 2>&1 | Tee-Object -FilePath $check_tag_log_file -Append

# Read the last line of the check_tag log file to get the tag status
$tag = Get-Content -Path $check_tag_log_file | Select-Object -Last 1
Write-Output "Tag value: $tag" | Tee-Object -FilePath $wait_for_tag_log_file -Append

if ($tag -eq 'completed') {
    Write-Output "Tag completed" | Tee-Object -FilePath $wait_for_tag_log_file -Append
}
elseif ($tag -eq 'failed') {
    Write-Output "$NodeName failed to deploy" | Tee-Object -FilePath $wait_for_tag_log_file -Append
    exit 1
}
else {
    Write-Output "$NodeName tag was not created within the timeout period. Stopping deployment." | Tee-Object -FilePath $wait_for_tag_log_file -Append
    exit 1
}