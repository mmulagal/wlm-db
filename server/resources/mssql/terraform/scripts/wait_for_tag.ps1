param(
    [string]$Path,
    [string]$InstanceId,
    [string]$Location,
    [string]$NodeName
)

$counter = 0
$timeout = if ($NodeName -in @('Validation-Node-1', 'Validation-Node-2')) { 150 } else { 540 } # 150 * 10 seconds = 25 minutes, 540 * 10 seconds = 1 hour 30 minutes

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
        $counter++
        if ($counter -ge $timeout) {
            Write-Output "$NodeName tag was not created within the timeout period. Stopping deployment."
            exit 1
        }
    }
} while ($true)