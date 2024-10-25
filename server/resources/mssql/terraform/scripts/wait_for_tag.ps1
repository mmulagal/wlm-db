param(
    [string]$Path,
    [string]$InstanceId,
    [string]$Location,
    [string]$NodeName
)

$log_file = "${Path}\logs\${NodeName}_check_tag.log"
Write-Output "Starting wait_for_tag.ps1" | Tee-Object -FilePath $log_file -Append

$tag = & "${Path}\scripts\check_tag.ps1" -InstanceId $InstanceId -Region $Location -NodeName $NodeName 2>&1 | Tee-Object -FilePath $log_file -Append
Write-Output "Tag value: $tag" | Tee-Object -FilePath $log_file -Append

if ($tag -eq 'completed') {
    Write-Output "Tag completed" | Tee-Object -FilePath $log_file -Append
}
elseif ($tag -eq 'failed') {
    Write-Output "$NodeName failed to deploy" | Tee-Object -FilePath $log_file -Append
    exit 1
}
else {
    Write-Output "$NodeName tag was not created within the timeout period. Stopping deployment." | Tee-Object -FilePath $log_file -Append
    exit 1
}