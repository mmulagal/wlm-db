[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FSxID,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion
)

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
        Enable-NetAdapterRss -Name $AdapterName -NoRestart
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
        Set-NetAdapterRss @parameters -NoRestart
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

function Set-JumboFrames {
    param (
        [string]$AdapterName
    )
    
    try {
        # Get jumbo frame property
        $jumboProp = Get-NetAdapterAdvancedProperty -Name $AdapterName -ErrorAction SilentlyContinue | 
            Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
        
        if ($jumboProp) {
            Write-Output "Found jumbo frames property '$($jumboProp.DisplayName)' on adapter: $AdapterName"
            Write-Output "Current value: $($jumboProp.DisplayValue)"
            Write-Output "Valid values: $($jumboProp.ValidDisplayValues -join ', ')"
            
            # Filter for numeric values and safely convert to integers for sorting
            $numericValues = $jumboProp.ValidDisplayValues | Where-Object { 
                $_ -ne "Disabled" -and $_ -match '^\d+$' 
            } | ForEach-Object { 
                try { [int]$_ } catch { $null } 
            } | Where-Object { $_ -ne $null -and $_ -ge 9000 }
            
            $maxJumboValue = if ($numericValues.Count -gt 0) {
                ($numericValues | Sort-Object -Descending | Select-Object -First 1).ToString()
            } else { $null }
            
            if ($maxJumboValue) {
                Write-Output "Maximum available jumbo frame value: $maxJumboValue"
                
                # Check if update is needed
                $needsUpdate = $false
                
                if ($jumboProp.DisplayValue -eq "Disabled") {
                    Write-Output "Jumbo frames are currently disabled. Enabling with value $maxJumboValue"
                    $needsUpdate = $true
                } elseif ($jumboProp.DisplayValue -ne $maxJumboValue) {
                    Write-Output "Current value ($($jumboProp.DisplayValue)) differs from optimal value ($maxJumboValue). Updating..."
                    $needsUpdate = $true
                } else {
                    Write-Output "Jumbo frames already set to optimal value $maxJumboValue on adapter: $AdapterName"
                }
                
                if ($needsUpdate) {
                    try {
                        Write-Output "Setting jumbo frames to $maxJumboValue on adapter: $AdapterName"
                        Set-NetAdapterAdvancedProperty -Name $AdapterName -DisplayName $jumboProp.DisplayName -DisplayValue $maxJumboValue -NoRestart -ErrorAction Stop
                        Start-Sleep -Seconds 2  # Allow time for setting to apply
                        
                        # Verify the setting was applied
                        $updatedProp = Get-NetAdapterAdvancedProperty -Name $AdapterName -ErrorAction SilentlyContinue | 
                            Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
                        
                        if ($updatedProp -and $updatedProp.DisplayValue -eq $maxJumboValue) {
                            Write-Output "Successfully set jumbo frames to $maxJumboValue on adapter: $AdapterName"
                        } else {
                            Write-Output "Warning: Jumbo frame setting may not have been applied correctly on adapter: $AdapterName"
                        }
                    } catch {
                        Write-Output "Error setting jumbo frames on adapter $AdapterName`: $($_.Exception.Message)"
                        throw
                    }
                }
            } else {
                Write-Output "Warning: No suitable jumbo frame values (>= 9000) available for adapter: $AdapterName"
                Write-Output "Available values: $($jumboProp.ValidDisplayValues -join ', ')"
            }
        } else {
            Write-Output "Warning: No jumbo frame property found on adapter: $AdapterName"
        }
    } catch {
        Write-Output "Failed to configure jumbo frames on adapter $AdapterName. Exception: $($_.Exception.Message)"
        throw
    }
}

try {
    
    # Load retry function and adapter targeting function
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1"
    . "$ScriptsPath\common\Get-TargetAdapters.ps1"
        
    # Get target adapters for jumbo frames using FSx-aware function in try-catch block
    $targetAdapters = @()
    try {
        $targetAdapters = Get-TargetAdapters -FSxID $FSxID -FSxRegion $FSxRegion
        
        # Filter out adapters with null or empty names
        $targetAdapters = $targetAdapters | Where-Object { 
            $_.Name -and $_.Name.Trim() -ne "" 
        }
        
        Write-Output "Successfully identified $($targetAdapters.Count) FSx target adapters for jumbo frames"
    } catch {
        Write-Output "Failed to get FSx-specific adapters for jumbo frames. Exception: $_"
        $targetAdapters = @()
    }

    # Configure jumbo frames on FSx target adapters
    foreach ($adapter in $targetAdapters) {
        try {
            # Additional validation for adapter name
            if (-not $adapter.Name -or $adapter.Name.Trim() -eq "") {
                Write-Output "Skipping adapter with empty name"
                continue
            }
            
            Write-Output "Processing adapter for jumbo frames: $($adapter.Name)"
            
            # Set jumbo frames (FSx-targeted flow)
            Set-JumboFrames -AdapterName $adapter.Name
            
        } catch {
            Write-Output "Failed to configure jumbo frames on adapter $($adapter.Name). Exception: $_"
        }
    }
    
} catch {
    Write-Output "Failed to configure jumbo frames on adapters. Exception: $_"
}

# Restart computer to make RSS settings effective
C:\cfn\scripts\common\Restart-Computer.ps1
