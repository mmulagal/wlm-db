Function Invoke-ONTAPRequest {
    param(
        [string]$ApiEndpoint, 
        [string]$ApiQueryFields = '',
        [string]$FSxHostName,
        [string]$FSxCredentialsInBase64
    )
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

function Get-TargetAdapters {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FSxID,
        
        [Parameter(Mandatory = $true)]
        [string]$FSxRegion
    )
    
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
        Write-Output "Cannot proceed without FSx credentials. Using fallback adapter selection."
        return Get-FallbackAdapters
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
    Write-Output "Querying FSx network interfaces for FSx ID: $FSxID"
    
    # Get FSx IP addresses for precise adapter targeting
    $fsxIPAddresses = @()
    try {
        $Response = Invoke-ONTAPRequest -ApiEndpoint "/network/ip/interfaces" -ApiQueryFields "fields=ip.address" -FSxHostName $FSxHostName -FSxCredentialsInBase64 $FSxCredentialsInBase64
        $fsxIPAddresses = $Response.records | Where-Object { $_.ip.address } | ForEach-Object { $_.ip.address }
        Write-Output "Found $($fsxIPAddresses.Count) FSx IP addresses"
    } catch {
        Write-Output "Warning: Could not query FSx IP addresses: $($_.Exception.Message)"
    }
    
    $targetAdapters = @()
    
    # Identify target adapters with active FSx connections
    if ($fsxIPAddresses.Count -gt 0) {
        Write-Output "Searching for adapters with active FSx connections..."
        
        $fsxConnections = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | 
            Where-Object { $_.RemoteAddress -in $fsxIPAddresses }
        
        if ($fsxConnections.Count -gt 0) {
            Write-Output "Found $($fsxConnections.Count) active FSx connections"
            
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
        } else {
            Write-Output "No active FSx connections found"
        }
    }
    
    # Fallback to primary adapters if no FSx-specific ones found
    if ($targetAdapters.Count -eq 0) {
        $targetAdapters = Get-FallbackAdapters
    }

    if ($targetAdapters.Count -eq 0) {
        throw "No suitable network adapters found for FSx optimization"
    }

    Write-Output "Targeting $($targetAdapters.Count) network adapters for FSx network optimization"
    
    # Return the target adapters
    return $targetAdapters
}

function Get-FallbackAdapters {
    Write-Output "No FSx-specific adapters identified, targeting primary network adapters"
    
    $adapters = Get-NetAdapter | Where-Object { 
        $_.Status -eq "Up" -and $_.InterfaceType -ne 24 -and 
        $_.Name -notlike "*Loopback*" -and $_.Name -notlike "*Virtual*" -and $_.LinkSpeed
    } | Sort-Object LinkSpeed -Descending | Select-Object -First 2
    
    Write-Output "Found $($adapters.Count) primary network adapters"
    return $adapters
}