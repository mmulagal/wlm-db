[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]
    $FSxID,

    [Parameter(Mandatory = $true)]
    [string]
    $FSxRegion,

    [Parameter(Mandatory = $false)]
    [int]
    $TargetMTU = 9001
)

try {
    Start-Transcript -Path C:\cfn\log\SetMTU.ps1.txt -Append
    $ErrorActionPreference = "Stop"  # Set to 'Stop' to ensure errors are caught by try-catch
    
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

    Write-Output "Starting MTU optimization"
    Write-Output "Target MTU: $TargetMTU"

    # Get target adapters using the imported function (handles all FSx logic internally)
    try {
        $targetAdapters = Get-TargetAdapters -FSxID $FSxID -FSxRegion $FSxRegion
        
        # Filter out adapters with null or empty names
        $targetAdapters = $targetAdapters | Where-Object { 
            $_.Name -and $_.Name.Trim() -ne "" 
        }
        
        if ($targetAdapters.Count -eq 0) {
            Write-Output "No valid target adapters found after filtering"
            Write-Output "MTU optimization will be skipped - no suitable network adapters available"
            return
        }
        
        Write-Output "Found $($targetAdapters.Count) valid target adapters"
    } catch {
        Write-Output "Error retrieving target adapters: $($_.Exception.Message)"
        Write-Output "MTU optimization will be skipped due to adapter detection failure"
        return
    }

    # Process each adapter
    $responseObject = @{
        optimizedInterfaces = @()
        errors = @()
        success = $true
    }

    foreach ($adapter in $targetAdapters) {
        try {
            $interfaceName = $adapter.Name
            
            # Additional validation for adapter name
            if (-not $interfaceName -or $interfaceName.Trim() -eq "") {
                Write-Output "Skipping adapter with empty name"
                continue
            }
            
            Write-Output "Processing adapter: $interfaceName (LinkSpeed: $($adapter.LinkSpeed))"

            # Check jumbo frames setup (without modifying)
            $jumboProp = Get-NetAdapterAdvancedProperty -Name $interfaceName -ErrorAction SilentlyContinue | 
                Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
            
            if ($jumboProp) {
                Write-Output "Jumbo frames property '$($jumboProp.DisplayName)' found"
                Write-Output "Current jumbo frames setting: $($jumboProp.DisplayValue)"
                
                # Check if jumbo frames are properly configured for target MTU
                if ($jumboProp.DisplayValue -eq "Disabled") {
                    Write-Output "WARNING: Jumbo frames are disabled on adapter '$interfaceName'"
                    Write-Output "Skipping MTU optimization for this adapter as enabling jumbo frames requires restart"
                    Write-Output "Note: MTU $TargetMTU requires jumbo frames to be enabled for optimal performance"
                    continue
                }
                
                # Verify jumbo frame value supports target MTU
                try {
                    $currentJumboValue = [int]$jumboProp.DisplayValue
                    if ($currentJumboValue -lt $TargetMTU) {
                        Write-Output "WARNING: Current jumbo frame value ($currentJumboValue) is less than target MTU ($TargetMTU)"
                        Write-Output "Skipping MTU optimization for this adapter as increasing jumbo frames requires restart"
                        Write-Output "Note: For optimal performance, set jumbo frames to a value >= $TargetMTU"
                        continue
                    } else {
                        Write-Output "Jumbo frames properly configured: $currentJumboValue (>= $TargetMTU)"
                    }
                } catch {
                    Write-Output "WARNING: Could not parse jumbo frame value '$($jumboProp.DisplayValue)' as integer"
                    Write-Output "Skipping MTU optimization for this adapter due to jumbo frame value parsing issue"
                    Write-Output "Note: Cannot verify jumbo frame compatibility with target MTU $TargetMTU"
                    continue
                }
            } else {
                Write-Output "WARNING: No jumbo frame property found for $interfaceName"
                Write-Output "Skipping MTU optimization for this adapter as jumbo frame support is required"
                Write-Output "Note: Target MTU $TargetMTU requires jumbo frame support for optimal performance"
                continue
            }

            # Set MTU with improved error detection and validation
            Write-Output "Setting MTU to $TargetMTU for adapter: $interfaceName"
            
            # Get the interface index for more reliable netsh commands
            $adapterDetails = Get-NetAdapter -Name $interfaceName -ErrorAction SilentlyContinue
            if (-not $adapterDetails) {
                Write-Output "WARNING: Cannot retrieve adapter details for '$interfaceName'"
                Write-Output "Skipping MTU optimization for this adapter"
                continue
            }
            
            $interfaceIndex = $adapterDetails.InterfaceIndex
            Write-Output "Using interface index: $interfaceIndex for adapter: $interfaceName"
            
            # Try using interface index first, then fall back to name
            $netshResult = $null
            $mtuSetSuccessfully = $false
            
            # Method 1: Use interface index (more reliable)
            try {
                Write-Output "Attempting MTU set using interface index: $interfaceIndex"
                $netshResult = & netsh interface ipv4 set subinterface $interfaceIndex mtu=$TargetMTU store=persistent 2>&1
                if ($LASTEXITCODE -eq 0 -and $netshResult -notmatch "The parameter is incorrect") {
                    $mtuSetSuccessfully = $true
                    Write-Output "MTU set successfully using interface index"
                }
            } catch {
                Write-Output "Method 1 (interface index) failed: $($_.Exception.Message)"
            }
            
            # Method 2: Use quoted interface name (fallback)
            if (-not $mtuSetSuccessfully) {
                try {
                    Write-Output "Attempting MTU set using quoted interface name: '$interfaceName'"
                    $netshResult = & netsh interface ipv4 set subinterface "`"$interfaceName`"" mtu=$TargetMTU store=persistent 2>&1
                    if ($LASTEXITCODE -eq 0 -and $netshResult -notmatch "The parameter is incorrect") {
                        $mtuSetSuccessfully = $true
                        Write-Output "MTU set successfully using quoted interface name"
                    }
                } catch {
                    Write-Output "Method 2 (quoted name) failed: $($_.Exception.Message)"
                }
            }

            if ($mtuSetSuccessfully) {
                # Verify MTU was actually set correctly
                Start-Sleep -Seconds 1  # Give system time to apply the change
                $updatedAdapter = Get-NetAdapter -Name $interfaceName -ErrorAction SilentlyContinue
                
                if ($updatedAdapter -and $updatedAdapter.MtuSize -eq $TargetMTU) {
                    Write-Output "Successfully set MTU for adapter: $interfaceName (verified: $($updatedAdapter.MtuSize))"
                    $responseObject.optimizedInterfaces += @{
                        name = $interfaceName
                        status = "MTU update successful"
                        targetMTU = $TargetMTU
                        actualMTU = $updatedAdapter.MtuSize
                        linkSpeed = $adapter.LinkSpeed
                        fsxRelated = $true
                    }
                } else {
                    $actualMTU = if ($updatedAdapter) { $updatedAdapter.MtuSize } else { "unknown" }
                    Write-Output "WARNING: MTU verification failed for '$interfaceName': Expected $TargetMTU, got $actualMTU"
                }
            } else {
                Write-Output "WARNING: Failed to set MTU for '$interfaceName': $netshResult"
            }

        } catch {
            Write-Output "Warning: Error processing adapter '$interfaceName': $($_.Exception.Message)"
        }
    }

    # Summary
    $successCount = $responseObject.optimizedInterfaces.Count
    $errorCount = $responseObject.errors.Count
    
    Write-Output "MTU optimization completed for FSx ID: $FSxID"
    Write-Output "- Successfully optimized: $successCount adapters"
    Write-Output "- Errors encountered: $errorCount"
    
    if ($errorCount -gt 0) {
        Write-Output "Errors:"
        $responseObject.errors | ForEach-Object { Write-Output "  - $_" }
    }

    if ($successCount -gt 0) {
        Write-Output "MTU optimization completed successfully"
        Write-Output "Optimized interfaces:"
        $responseObject.optimizedInterfaces | ForEach-Object { 
            Write-Output "  - $($_.name): $($_.status)" 
        }
    } else {
        Write-Output "MTU optimization completed with errors"
    }

} catch {
    Write-Output "Error during MTU optimization: $($_.Exception.Message)"
    Write-Output "Script will exit gracefully without throwing error"
    
    # Ensure we have a response object even if there was a critical error
    if (-not $responseObject) {
        $responseObject = @{
            optimizedInterfaces = @()
            errors = @("Critical error: $($_.Exception.Message)")
            success = $false
        }
    }
    
    # Log final summary even on error
    Write-Output "MTU optimization completed with critical error"
    Write-Output "- Successfully optimized: 0 adapters"
    Write-Output "- Critical error encountered: $($_.Exception.Message)"
    
} finally {
    try {
        Stop-Transcript
    } catch {
        # Ignore transcript errors to ensure graceful exit
        Write-Output "Note: Could not stop transcript properly"
    }
    
    # Ensure script exits with success code (0) even on errors
    exit 0
}