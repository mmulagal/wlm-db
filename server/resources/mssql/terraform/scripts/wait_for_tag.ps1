param(
    [string]$Path,
    [string]$InstanceId,
    [string]$Location,
    [string]$NodeName
)

do {
    $tag = & "${Path}\scripts\check_tag.ps1" $InstanceId $Location
    if ($tag -eq 'completed') {
        break
    }
    elseif ($tag -eq 'failed') {
        Write-Output "$NodeName failed to deploy"
        exit 1
    }
    else {
        Write-Output "Waiting for $NodeName tag..."
        Start-Sleep -Seconds 10
    }
} while ($true)