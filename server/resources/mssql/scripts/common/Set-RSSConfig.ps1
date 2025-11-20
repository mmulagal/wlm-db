[CmdletBinding()]
param()

function Set-RSSBestPractices {
    param (
        [string]$AdapterName
    )

    # Get current RSS settings
    $currentRssSettings = Get-NetAdapterRss -Name $AdapterName
    $parameters = @{}
    $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    $DesiredRssReceiveQueues = $vcpus
    $DesiredBaseProcessorNumber = $currentRssSettings.BaseProcessorNumber
    if($vcpus -ge 4) {
        $DesiredBaseProcessorNumber = 2
    }
    $DesiredRssProfile = 'NUMAStatic'
    if($vcpus -gt 8) {
        $DesiredRssReceiveQueues = 8
    }

    if ($currentRssSettings.Enabled -eq $false) {
        Write-Output "Enabling RSS on adapter: $AdapterName"
        try {
            Enable-NetAdapterRss -Name $AdapterName -NoRestart
        } catch {
            Write-Output "Warning: Failed to enable RSS on adapter $AdapterName. Exception: $($_.Exception.Message)"
        }
    }

    if ($currentRssSettings.NumberOfReceiveQueues -ne $DesiredRssReceiveQueues) {
        $parameters['NumberOfReceiveQueues'] = $DesiredRssReceiveQueues
    }

    if ($currentRssSettings.BaseProcessorNumber -ne $DesiredBaseProcessorNumber) {
        $parameters['BaseProcessorNumber'] = $DesiredBaseProcessorNumber
    }

    if ($currentRssSettings.Profile -ne $DesiredRssProfile) {
        $parameters['Profile'] = $DesiredRssProfile
    }

    if ($parameters.Count -gt 0) {
        Write-Output "Setting RSS best practices values on adapter: $AdapterName"
        $parameters['Name'] = $AdapterName
        try {
            Set-NetAdapterRss @parameters -NoRestart
            Write-Output "RSS best practices values have been set on adapter: $AdapterName"
        } catch {
            Write-Output "Warning: Failed to set RSS parameters on adapter $AdapterName. Exception: $($_.Exception.Message)"
        }
    }
}

try {
    Start-Transcript -Path C:\cfn\log\SetRssConfig.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    $adapters = Get-NetAdapterRss

    foreach ($adapter in $adapters) {
        try {
            Set-RSSBestPractices -AdapterName $adapter.Name
        } catch {
            Write-Output "Failed to set RSS best practices values on adapter. Exception: $_"
        }
    }
} catch {
    Write-Output "Failed to set RSS best practices values. Exception: $_"
}

# Restart computer to make RSS settings effective
C:\cfn\scripts\common\Restart-Computer.ps1
