function PollForTag {
    param (
        [string]$Region,
        [string]$InstanceId,
        [string]$TagKey,
        [string]$TagValue,
        [int]$MaxRetries = 30,
        [int]$WaitTime = 60
    )

    $RetryCount = 0
    $TagFound = $false

    while (-not $TagFound -and $RetryCount -lt $MaxRetries) {
        try {
            $Tags = Get-EC2Tag -Region $Region -ResourceId $InstanceId
            $Tag = $Tags | Where-Object { $_.Key -eq $TagKey -and $_.Value -eq $TagValue }
            $FailureTag = $Tags | Where-Object { $_.Key -eq "user_data" -and $_.Value -eq "failed" }

            if ($Tag) {
                $TagFound = $true
                Write-Output "Tag '$TagKey' with value '$TagValue' found."
            }
            elseif ($FailureTag) {
                throw "Tag 'user_data' with value 'failed' found. Stopping polling."
            }
            else {
                Write-Output "Tag not found, retrying in $WaitTime seconds..."
                Start-Sleep -Seconds $WaitTime
            }
        }
        catch {
            Write-Output "Error checking tag: $_"
            Start-Sleep -Seconds $WaitTime
        }
        $RetryCount++
    }

    if (-not $TagFound) {
        throw "Tag '$TagKey' with value '$TagValue' not found after $MaxRetries attempts"
    }
}