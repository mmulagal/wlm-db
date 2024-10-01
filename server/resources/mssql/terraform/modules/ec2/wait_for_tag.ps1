param(
    [string]$path,
    [string]$instanceId,
    [string]$location
)

do {
    $tag = & "${path}\check_tag.ps1" $instanceId $location
    if ($tag -eq 'completed') {
        break
    }
    elseif ($tag -eq 'failed') {
        Write-Output 'Sql Node failed to deploy'
        exit 1
    }
    else {
        Write-Output 'Waiting for Sql node tag...'
        Start-Sleep -Seconds 10
    }
} while ($true)