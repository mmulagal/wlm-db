function Set-RSSBestPractices {
    param (
        [string]$AdapterName
    )

    # Get current RSS settings
    $currentRssSettings = Get-NetAdapterRss -Name $AdapterName

    $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    $DesiredRssReceiveQueues = $vcpus
    $DesiredBaseProcessorNumber = 2
    $DesiredRssProfile = 'NUMAStatic'
    if($vcpus -gt 8) {
        $DesiredRssReceiveQueues = 8
    }

    if ($currentRssSettings.Enabled -eq $false) {
        Write-Output "Enabling RSS on adapter: $AdapterName"
        Enable-NetAdapterRss -Name $AdapterName
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
        Set-NetAdapterRss @parameters
        Write-Output "RSS best practices values have been set on adapter: $AdapterName"
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
