[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FSxID,

    [Parameter(Mandatory = $true)]
    [string]$FSxRegion
)

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
                        Start-Sleep -Seconds 5  # Allow time for setting to apply
                        
                        # Verify the setting was applied
                        $updatedProp = Get-NetAdapterAdvancedProperty -Name $AdapterName -ErrorAction SilentlyContinue | 
                            Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
                        
                        if ($updatedProp -and $updatedProp.DisplayValue -eq $maxJumboValue) {
                            Write-Output "Successfully set jumbo frames to $maxJumboValue on adapter: $AdapterName"
                        } else {
                            Write-Output "Warning: Jumbo frame setting may not have been applied correctly on adapter: $AdapterName"
                        }
                    } catch {
                        Write-Output "Warning: Failed to set jumbo frames on adapter $AdapterName. Exception: $($_.Exception.Message)"
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
        Write-Output "Warning: Failed to configure jumbo frames on adapter $AdapterName. Exception: $($_.Exception.Message)"
        return
    }
}

try {
    Start-Transcript -Path C:\cfn\log\SetJumboFrames.ps1.txt -Append
    $ErrorActionPreference = "Stop"
    
    # Load retry function and adapter targeting function with error handling
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    try {
        . "$ScriptsPath\common\InvokeRetryCommand.ps1"
    } catch {
        Write-Output "Warning: Could not load InvokeRetryCommand.ps1. Exception: $($_.Exception.Message)"
    }
    try {
        . "$ScriptsPath\common\Get-TargetAdapters.ps1"
    } catch {
        Write-Output "Warning: Could not load Get-TargetAdapters.ps1. Exception: $($_.Exception.Message)"
    }
        
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

# Restart computer to make jumbo frame settings effective
Write-Output "Jumbo frame configuration completed"
C:\cfn\scripts\common\Restart-Computer.ps1