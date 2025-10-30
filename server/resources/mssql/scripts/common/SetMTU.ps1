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
    
    # Load retry function
    $ScriptsPath = Split-Path -Path (Split-Path -Path $MyInvocation.MyCommand.Path -Parent) 
    . "$ScriptsPath\common\InvokeRetryCommand.ps1"

    Write-Output "Starting MTU optimization"
    Write-Output "Target MTU: $TargetMTU"

    # Setup ONTAP REST API
    Add-Type @"
        using System.Net;
        using System.Security.Cryptography.X509Certificates;
        public class TrustAllCertsPolicy : ICertificatePolicy {
            public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) { return true; }
        }
"@
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    # Get FSx details
    try {
        $SsmParameterLocal = Invoke-WithRetry -Command {
            (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | ConvertFrom-Json
        }
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("$($SsmParameterLocal.fsx.username):$($SsmParameterLocal.fsx.password)"))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"
    } catch {
        Write-Output "Error getting FSx details: $($_.Exception.Message)"
        Write-Output "Cannot proceed without FSx credentials. Exiting gracefully."
        return
    }
    
    # Test FSx connectivity and fallback to IP if needed
    try {
        $null = [System.Net.WebRequest]::Create("https://$FSxHostName").GetResponse()
    } catch {
        if ($_.Exception.Message -notlike "*remote server returned an error*") {
            $FileSystemDetails = Invoke-WithRetry -Command {
                Get-FSXFileSystem -FileSystemId $FSxID
            }
            $FSxHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses[0]
        }
    }

    # ONTAP REST API function
    Function Invoke-ONTAPRequest {
        param([string]$ApiEndpoint, [string]$ApiQueryFields = '')
        $uri = "https://$FSxHostName/api$ApiEndpoint" + $(if ($ApiQueryFields) { "?$ApiQueryFields" } else { "" })
        $headers = @{"Authorization" = "Basic $FSxCredentialsInBase64"}
        $params = @{
            Uri = $uri
            Method = 'GET'
            Headers = $headers
            ContentType = 'application/json'
        }
        return Invoke-WithRetry -Command {
            Invoke-RestMethod @params
        }
    }

    Write-Output "Querying FSx network interfaces for FSx ID: $FSxID"
    
    # Get FSx IP addresses for precise adapter targeting
    $fsxIPAddresses = @()
    try {
        $Response = Invoke-ONTAPRequest -ApiEndpoint "/network/ip/interfaces" -ApiQueryFields "fields=ip.address"
        $fsxIPAddresses = $Response.records | Where-Object { $_.ip.address } | ForEach-Object { $_.ip.address }
        Write-Output "Found $($fsxIPAddresses.Count) FSx IP addresses"
    } catch {
        Write-Output "Warning: Could not query FSx IP addresses: $($_.Exception.Message)"
    }

    # Identify target adapters with active FSx connections
    $targetAdapters = @()
    if ($fsxIPAddresses.Count -gt 0) {
        $fsxConnections = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | 
            Where-Object { $_.RemoteAddress -in $fsxIPAddresses }
        
        if ($fsxConnections.Count -gt 0) {
            $fsxInterfaceIndexes = $fsxConnections | ForEach-Object {
                $connection = $_
                $ipConfig = Get-NetIPAddress | Where-Object { $_.IPAddress -eq $connection.LocalAddress } | Select-Object -First 1
                if ($ipConfig) { $ipConfig.InterfaceIndex }
            } | Select-Object -Unique | Where-Object { $_ }
            
            $targetAdapters = $fsxInterfaceIndexes | ForEach-Object {
                Get-NetAdapter -InterfaceIndex $_ -ErrorAction SilentlyContinue
            } | Where-Object { 
                $_.Status -eq "Up" -and $_.InterfaceType -ne 24 -and 
                $_.Name -notlike "*Loopback*" -and $_.Name -notlike "*Virtual*"
            }
            
            Write-Output "Identified $($targetAdapters.Count) adapters with active FSx connections"
        }
    }
    
    # Fallback to primary adapters if no FSx-specific ones found
    if ($targetAdapters.Count -eq 0) {
        Write-Output "No FSx-specific adapters identified, targeting primary network adapters"
        $targetAdapters = Get-NetAdapter | Where-Object { 
            $_.Status -eq "Up" -and $_.InterfaceType -ne 24 -and 
            $_.Name -notlike "*Loopback*" -and $_.Name -notlike "*Virtual*" -and $_.LinkSpeed
        } | Sort-Object LinkSpeed -Descending | Select-Object -First 2
    }

    if ($targetAdapters.Count -eq 0) {
        throw "No suitable network adapters found for FSx optimization"
    }

    Write-Output "Targeting $($targetAdapters.Count) network adapters for MTU optimization"

    # Process each adapter
    $responseObject = @{
        optimizedInterfaces = @()
        errors = @()
        success = $true
    }

    foreach ($adapter in $targetAdapters) {
        try {
            $interfaceName = $adapter.Name
            Write-Output "Processing adapter: $interfaceName (LinkSpeed: $($adapter.LinkSpeed))"

            # Handle jumbo frames setup
            $jumboProp = Get-NetAdapterAdvancedProperty -Name $interfaceName -ErrorAction SilentlyContinue | 
                Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
            
            if ($jumboProp) {
                # Filter for numeric values and safely convert to integers for sorting
                $numericValues = $jumboProp.ValidDisplayValues | Where-Object { 
                    $_ -ne "Disabled" -and $_ -match '^\d+$' 
                } | ForEach-Object { 
                    try { [int]$_ } catch { $null } 
                } | Where-Object { $_ -ne $null }
                
                $maxJumboValue = if ($numericValues.Count -gt 0) {
                    ($numericValues | Sort-Object -Descending | Select-Object -First 1).ToString()
                } else { $null }

                if ($maxJumboValue -and [int]$maxJumboValue -ge $TargetMTU) {
                    if ($jumboProp.DisplayValue -ne $maxJumboValue) {
                        Write-Output "Enabling jumbo frames for $interfaceName with value $maxJumboValue"
                        Set-NetAdapterAdvancedProperty -Name $interfaceName -DisplayName $jumboProp.DisplayName -DisplayValue $maxJumboValue -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 2
                    } else {
                        Write-Output "Jumbo frames already enabled for $interfaceName"
                    }
                } else {
                    Write-Output "Warning: Adapter $interfaceName does not support target MTU $TargetMTU (max: $maxJumboValue)"
                }
            } else {
                Write-Output "Warning: No jumbo frame property found for $interfaceName"
            }

            # Set MTU with improved error detection
            Write-Output "Setting MTU to $TargetMTU for adapter: $interfaceName"
            $netshResult = & netsh interface ipv4 set subinterface "$interfaceName" mtu=$TargetMTU store=persistent 2>&1

            if ($LASTEXITCODE -eq 0 -and $netshResult -notmatch "The parameter is incorrect") {
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
                        fsxRelated = ($fsxIPAddresses.Count -gt 0)
                    }
                } else {
                    $actualMTU = if ($updatedAdapter) { $updatedAdapter.MtuSize } else { "unknown" }
                    Write-Output "MTU verification failed for '$interfaceName': Expected $TargetMTU, got $actualMTU"
                    $responseObject.errors += "MTU verification failed for '$interfaceName': Expected $TargetMTU, got $actualMTU"
                }
            } else {
                Write-Output "Failed to set MTU for '$interfaceName': $netshResult"
                $responseObject.errors += "Failed to set MTU for '$interfaceName': $netshResult"
            }

        } catch {
            Write-Output "Error processing adapter '$interfaceName': $($_.Exception.Message)"
            $responseObject.errors += "Error processing adapter '$interfaceName': $($_.Exception.Message)"
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