param(
    [string]$Path,
    [string]$InstanceId,
    [string]$Location,
    [string]$NodeName
)

$counter = 0
$timeout = if ($NodeName -in @('Validation-Node-1', 'Validation-Node-2')) { 150 } else { 720 } # 150 * 10 seconds = 25 minutes, 720 * 10 seconds = 2 hours

Write-Output "Starting wait_for_tag.ps1 with timeout: $timeout (10-second intervals)"

do {
    $tag = & "${Path}\scripts\check_tag.ps1" $InstanceId $Location
    Write-Output "Tag value: $tag"
    
    if ($tag -eq 'completed') {
        Write-Output "Tag completed"
        break
    }
    elseif ($tag -eq 'failed') {
        Write-Output "$NodeName failed to deploy"
        exit 1
    }
    else {
        Write-Output "Waiting for $NodeName tag... (counter: $counter)"
        Start-Sleep -Seconds 10
        $counter++
        Write-Output "Counter value: $counter"
        if ($counter -ge $timeout) {
            Write-Output "$NodeName tag was not created within the timeout period. Stopping deployment."
            exit 1
        }
    }
} while ($true)