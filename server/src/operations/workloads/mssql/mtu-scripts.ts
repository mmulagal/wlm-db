import { WorkloadInstance } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';

const GET_NETWORK_FALLBACK_PORTS = `
    function Get-NetworkFallbackPorts {
        param(
            [Parameter(Mandatory = $true)]
            [array]$SqlProcesses
        )
        
        $fallbackPorts = @()
        $fallbackErrors = @()
        
        try {
            $anyListeningPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
                Where-Object { $_.OwningProcess -in $SqlProcesses.Id -and $_.LocalPort -ge 1024 } |
                Select-Object -First 1 -ExpandProperty LocalPort
            
            if ($anyListeningPort) {
                $fallbackPorts += $anyListeningPort.ToString()
            }
        } catch {
            $fallbackErrors += "Network fallback failed: $($_.Exception.Message)"
        }
        
        return @{
            ports = $fallbackPorts
            errors = $fallbackErrors
        }
    }
`;

const GET_SQL_SERVER_PORTS = `
    function Get-SqlServerPorts {
        param(
            [Parameter(Mandatory = $true)]
            [array]$SqlProcesses
        )
        
        $sqlPorts = @()
        $portErrors = @()
        
        # Get SQL Server instances from registry
        $sqlInstances = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL" -ErrorAction SilentlyContinue
        
        if ($sqlInstances) {
            $sqlInstances.PSObject.Properties | Where-Object { 
                $_.Name -notlike "PS*" 
            } | ForEach-Object {
                $tcpPath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\$($_.Value)\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll"
                $tcpSettings = Get-ItemProperty -Path $tcpPath -ErrorAction SilentlyContinue
                
                if ($tcpSettings.TcpPort -and $tcpSettings.TcpPort -ne "") {
                    # Static port configured
                    $sqlPorts += $tcpSettings.TcpPort
                } elseif ($tcpSettings.TcpDynamicPorts -ne "") {
                    # Dynamic port - get current listening port using Get-NetTCPConnection
                    $dynamicPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | 
                        Where-Object { $_.OwningProcess -in $SqlProcesses.Id -and $_.LocalPort -ge 1024 } |
                        Select-Object -First 1 -ExpandProperty LocalPort
                    
                    if ($dynamicPort) { $sqlPorts += $dynamicPort.ToString() }
                }
            }
        }
        
        # Add SQL Browser port if service is running
        $browserService = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
        if ($browserService.Status -eq "Running") { 
            # SQL Browser typically runs on port 1434 UDP, but check for TCP connections
            $browserProcess = Get-Process -Name "sqlbrowser" -ErrorAction SilentlyContinue
            if ($browserProcess) {
                $browserListeningPort = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
                    Where-Object { $_.OwningProcess -in $browserProcess.Id } |
                    Select-Object -First 1 -ExpandProperty LocalPort
                
                if ($browserListeningPort) { $sqlPorts += $browserListeningPort.ToString() }
            }
        }
        
        # If no ports found, try network fallback
        if ($sqlPorts.Count -eq 0) { 
            $networkResult = Get-NetworkFallbackPorts -SqlProcesses $SqlProcesses
            $sqlPorts += $networkResult.ports
            $portErrors += $networkResult.errors
        }
        
        return @{
            ports = ($sqlPorts | Select-Object -Unique)
            errors = $portErrors
        }
    }
`;

const MAP_INTERFACES_TO_PORTS = `
    # Network address patterns for easier maintenance
    $WILDCARD_PATTERN = "^(0\\.0\\.0\\.0|::)$|^$"
    $LOOPBACK_PATTERN = "^(127\\.0\\.0\\.1|::1)$"
    $SPECIAL_ADDRESSES_PATTERN = "^(0\\.0\\.0\\.0|::|127\\.0\\.0\\.1|::1|169\\.254\\.\\d+\\.\\d+|fe80:)"

    function Get-BestConnectionForPort {
        param($connectionsForPort)
        
        # Find the best connection - prefer specific IPs over wildcards/loopbacks
        $bestConnection = $connectionsForPort | Where-Object { 
            $_.LocalAddress -notmatch $SPECIAL_ADDRESSES_PATTERN -and
            -not [string]::IsNullOrEmpty($_.LocalAddress)
        } | Select-Object -First 1
        
        # If no specific IP, use any connection (wildcard or loopback)
        if (-not $bestConnection) {
            $bestConnection = $connectionsForPort | Select-Object -First 1
        }
        
        return $bestConnection
    }

    function Get-TargetInterfacesForAddress {
        param($localAddress)
        
        $targetInterfaces = @()
        
        switch -Regex ($localAddress) {
            $WILDCARD_PATTERN {
                # Wildcard or empty - all primary interfaces
                $targetInterfaces = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | 
                    Select-Object -ExpandProperty InterfaceIndex
            }
            $LOOPBACK_PATTERN {
                # Loopback - map to primary network interface (exclude loopback interfaces)
                $loopbackIndexes = Get-NetAdapter | Where-Object { $_.InterfaceType -eq 24 } | Select-Object -ExpandProperty InterfaceIndex
                $targetInterfaces = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | 
                    Where-Object { $loopbackIndexes -notcontains $_.InterfaceIndex } |
                    Sort-Object RouteMetric | 
                    Select-Object -First 1 -ExpandProperty InterfaceIndex
            }
            default {
                # Specific IP - find its interface
                $interfaceWithIP = Get-NetIPAddress | Where-Object { 
                    $_.IPAddress -eq $localAddress -and $_.AddressState -eq "Preferred"
                } | Select-Object -First 1
                
                if ($interfaceWithIP) {
                    $targetInterfaces = @($interfaceWithIP.InterfaceIndex)
                }
            }
        }
        
        return $targetInterfaces
    }

    function Add-PortToInterfaces {
        param(
            $interfacePortMap,
            $targetInterfaces,
            [int]$localPort
        )
        
        foreach ($interfaceIndex in $targetInterfaces) {
            if (-not $interfacePortMap.ContainsKey($interfaceIndex)) {
                $interfacePortMap[$interfaceIndex] = @()
            }
            $interfacePortMap[$interfaceIndex] += $localPort
        }
    }

    function Get-InterfacePortMapping {
        param(
            [Parameter(Mandatory = $true)]
            [array]$SqlProcesses
        )
        
        $interfacePortMap = @{}
        $sqlConnections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | 
            Where-Object { $_.OwningProcess -in $SqlProcesses.Id }
        
        # Get unique ports first to avoid duplicates
        $uniquePorts = $sqlConnections | Select-Object LocalPort -Unique
        
        foreach ($portInfo in $uniquePorts) {
            $localPort = $portInfo.LocalPort
            
            # Get all connections for this port
            $connectionsForPort = $sqlConnections | Where-Object { $_.LocalPort -eq $localPort }
            
            # Find the best connection for this port
            $bestConnection = Get-BestConnectionForPort -connectionsForPort $connectionsForPort
            
            if ($bestConnection) {
                # Get target interfaces for this address
                $targetInterfaces = Get-TargetInterfacesForAddress -localAddress $bestConnection.LocalAddress
                
                # Add port to target interfaces
                Add-PortToInterfaces -interfacePortMap $interfacePortMap -targetInterfaces $targetInterfaces -localPort $localPort
            }
        }
        
        $interfaceKeys = @($interfacePortMap.Keys)
        foreach ($interfaceIndex in $interfaceKeys) {
            $interfacePortMap[$interfaceIndex] = $interfacePortMap[$interfaceIndex] | Select-Object -Unique
        }
        
        return $interfacePortMap
    }
`;

const GET_INTERFACE_IP_ADDRESSES = `
    function Get-InterfaceIpAddresses {
        param(
            [Parameter(Mandatory = $true)]
            [int]$InterfaceIndex
        )
        
        $ipAddresses = @()
        try {
            $ipConfigs = Get-NetIPAddress -InterfaceIndex $InterfaceIndex -ErrorAction SilentlyContinue
            foreach ($ipConfig in $ipConfigs) {
                $familyString = ""
                if ($ipConfig.AddressFamily -eq 2) {
                    $familyString = "IPv4"
                } elseif ($ipConfig.AddressFamily -eq 23) {
                    $familyString = "IPv6"
                }
                
                # Only add IP addresses with valid family types
                if (-not [string]::IsNullOrEmpty($familyString)) {
                    $ipAddresses += [PSCustomObject]@{
                        address = $ipConfig.IPAddress
                        family = $familyString
                    }
                }
            }
        }
        catch {
            # Continue without IP addresses if collection fails
        }
        
        return $ipAddresses
    }
`;

const BUILD_INTERFACE_OBJECTS = `
    function Build-SqlInterfaceObjects {
        param(
            [Parameter(Mandatory = $true)]
            [hashtable]$InterfacePortMap
        )
        
        $sqlInterfaces = @()
        
        foreach ($interfaceIndex in $InterfacePortMap.Keys) {
            try {
                $adapter = Get-NetAdapter -InterfaceIndex $interfaceIndex -ErrorAction SilentlyContinue
                if ($adapter -and $adapter.Status -eq "Up") {
                    # Remove duplicate ports for this interface
                    $interfacePorts = $InterfacePortMap[$interfaceIndex] | Select-Object -Unique
                    
                    # Get IP addresses for this interface
                    $ipAddresses = Get-InterfaceIpAddresses -InterfaceIndex $interfaceIndex
                    
                    $sqlInterfaces += [PSCustomObject]@{
                        name = $adapter.Name
                        mtu = $adapter.MtuSize
                        interfaceIndex = $adapter.InterfaceIndex
                        ports = @($interfacePorts)
                        ipAddresses = @($ipAddresses)
                    }
                }
            } catch { 
                continue 
            }
        }
        
        return $sqlInterfaces
    }
`;

const FETCH_MSSQL_INSTANCE_MTU_DETAILS = `
    #Get MSSQL Instance MTU Details

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{
        sqlInterfaces = @()
        error = $null
    }

    try {
        # Get SQL Server processes
        $sqlProcesses = Get-Process -Name "sqlservr" -ErrorAction SilentlyContinue
        if (-not $sqlProcesses) {
            $responseObject.error = "No SQL Server processes found"
            $response = $responseObject | ConvertTo-Json -Depth 4 -Compress
            return $response
        }

        ${GET_NETWORK_FALLBACK_PORTS}
        ${GET_SQL_SERVER_PORTS}
        ${MAP_INTERFACES_TO_PORTS}
        ${GET_INTERFACE_IP_ADDRESSES}
        ${BUILD_INTERFACE_OBJECTS}

        # Get SQL Server ports
        $sqlPortsResult = Get-SqlServerPorts -SqlProcesses $sqlProcesses

        # Map interfaces to ports
        $interfacePortMap = Get-InterfacePortMapping -SqlProcesses $sqlProcesses
        
        # Build interface objects with MTU details
        $sqlInterfaces = Build-SqlInterfaceObjects -InterfacePortMap $interfacePortMap
        $responseObject.sqlInterfaces = @($sqlInterfaces)

        if ($responseObject.sqlInterfaces.Count -eq 0) {
            $errorMessage = "No SQL Server network interfaces found"
            if ($sqlPortsResult.errors.Count -gt 0) {
                $errorMessage += ". Port discovery errors: " + ($sqlPortsResult.errors -join "; ")
            }
            $responseObject.error = $errorMessage
        }

    } catch {
        $responseObject.error = $_.Exception.Message
    }

    $response = $responseObject | ConvertTo-Json -Depth 4 -Compress
    if ([string]::IsNullOrEmpty($response)) {
        $responseObject.error = "Failed to generate response"
        $response = '{"sqlInterfaces":[],"error":"Failed to generate response"}'
    }
    return $response`;

const FETCH_FSX_MTU_DETAILS = (instanceRecord: WorkloadInstance) => `
    #Get FSx MTU Details

    $WarningPreference = 'SilentlyContinue';
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    ${ontapRestRequest}

    $responseObject = @{
        fsxInterfaces = @()
        error = $null
    }

    try {
        function Get-FSxNetworkInterfaces {
            $fsxInterfaces = @()
            
            try {
                # Get FSx ethernet ports - using correct endpoint
                $ApiEndpoint = "/network/ethernet/ports"
                $ApiQueryFields = "fields=name,mtu"
                $Response = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFields $ApiQueryFields
            
                foreach ($fsxInterface in $Response.records) {
                    if ($fsxInterface.name -and $fsxInterface.mtu) {
                        $fsxInterfaces += @{
                            Name = $fsxInterface.name
                            MTU = $fsxInterface.mtu
                        }
                    }
                }
                
                return $fsxInterfaces
                
            } catch {
                if ($_.Exception.Response.GetResponseStream) {
                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                    $responseBody = $reader.ReadToEnd()
                    Write-Information "Response Body: $responseBody"
                    $reader.Close()
                }
                throw "Failed to get FSx IP interfaces: $($_.Exception.Message)"
            }
        }

        $responseObject.fsxInterfaces = Get-FSxNetworkInterfaces

    } catch {
        if ($null -eq $responseObject) { $responseObject = @{} }
        $responseObject.error = $_.Exception.Message
    }

    $response = $responseObject | ConvertTo-Json -Compress
    if ([string]::IsNullOrEmpty($response)) {
        throw "Failed to generate response because the response is either null or empty. $response"
    }
    $response
`;

const OPTIMIZE_NETWORK_INTERFACE_MTU = (targetMTU: number, interfaceNames: string[]) => `
    #Optimize Network Interface MTU Settings

    $WarningPreference = 'SilentlyContinue';
    $targetMTU = ${targetMTU}
    $interfaceNames = @(${interfaceNames.map(name => `"${name}"`).join(', ')})
    
    
    $responseObject = @{
    optimizedInterfaces = @()
    errors = @()
    success = $true
}

foreach ($interfaceName in $interfaceNames) {
    try {
        # Check if adapter exists
        $adapter = Get-NetAdapter -Name $interfaceName -ErrorAction SilentlyContinue
        if (-not $adapter) {
            $responseObject.errors += "Adapter '$interfaceName' not found"
            $responseObject.success = $false
            continue
        }

        # Find Jumbo Frame property and its valid values
        $jumboProp = Get-NetAdapterAdvancedProperty -Name $interfaceName | Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
        if (-not $jumboProp) {
            $responseObject.errors += "Jumbo frame property not found for '$interfaceName'"
            $responseObject.success = $false
            continue
        }
        $validValues = $jumboProp.ValidDisplayValues

        # Select the highest non-disabled value
        $maxJumboValue = ($validValues | Where-Object { $_ -ne "Disabled" } | Sort-Object {[int]$_} -Descending | Select-Object -First 1)

        # Check if any valid jumbo values were found
        if (-not $maxJumboValue) {
            $responseObject.errors += "No valid jumbo frame values found for '$interfaceName' (all values may be disabled)"
            $responseObject.success = $false
            continue
        }

        # Check if target MTU is larger than the maximum valid jumbo value
        if ([int]$targetMTU -gt [int]$maxJumboValue) {
            $responseObject.errors += "Target MTU '$targetMTU' is larger than the maximum supported jumbo frame value '$maxJumboValue' for '$interfaceName'."
            $responseObject.success = $false
            continue
        }

        # Set jumbo value only if not already set
        if ($jumboProp.DisplayValue -ne "$maxJumboValue") {
            Set-NetAdapterAdvancedProperty -Name $interfaceName -DisplayName $jumboProp.DisplayName -DisplayValue "$maxJumboValue"
            Start-Sleep -Seconds 2 # Give time for the change to apply

            # Verify change
            $jumboPropAfter = Get-NetAdapterAdvancedProperty -Name $interfaceName | Where-Object { $_.DisplayName -like "*Jumbo*" } | Select-Object -First 1
            if ($jumboPropAfter.DisplayValue -ne "$maxJumboValue") {
                $responseObject.errors += "Failed to enable jumbo frames for '$interfaceName'"
                $responseObject.success = $false
                continue
            }
        }

        $netshResult = & netsh interface ipv4 set subinterface "$interfaceName" mtu=$targetMTU store=persistent 2>&1

        if ($netshResult -match "The parameter is incorrect") {
            $responseObject.errors += "Failed to set MTU for '$interfaceName': $netshResult"
            $responseObject.success = $false
            continue
        }

        $responseObject.optimizedInterfaces += @{
            name = $interfaceName
            status = "MTU update successful"
            jumboValue = $maxJumboValue
        }
    } catch {
        $responseObject.errors += "Error processing '$interfaceName': $($_.Exception.Message)"
        $responseObject.success = $false
    }
}

$response = $responseObject | ConvertTo-Json -Depth 4 -Compress
return $response
`;

export { FETCH_MSSQL_INSTANCE_MTU_DETAILS, FETCH_FSX_MTU_DETAILS, OPTIMIZE_NETWORK_INTERFACE_MTU };
