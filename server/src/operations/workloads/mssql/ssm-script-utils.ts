import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME, SQL_CASE_INSENSITIVE } from '../../../utils/consts';

/* eslint-disable no-useless-escape */

import { GOOGLE_DNS, REQUIRED_PS_MODULES_FOR_MANAGEMENT, SCRIPT_VERSON_FILE } from './const';
import { compressResponse, ontapRestRequest, enableCredSSP, invokeCommandWithCredSSP } from './common-templates';

const REQUIRED_DATABASE_CREATE_FILE_LIST: string = `
  'C:\\SSM\\Cleanup-ONTAP.ps1',
  'C:\\SSM\\Configure-LUNs.ps1',
  'C:\\SSM\\Create-Database.ps1',
  'C:\\SSM\\Invoke-virtualmount.ps1',
  'C:\\SSM\\NewDB_Initialize-Iscsidisk.ps1',
  'C:\\SSM\\Script-Version.txt'
`;

const GET_ACTIVE_NODE_DRIVE_INFO = (deploymentType: string, instanceName: string = DEFAULT_INSTANCE_NAME) => ` 
#Get ACTIVE NODE DRIVE INFO
Function GetSMBMappedDrivesWithPath() {
    $DriveLetterPath = @{}
    $Errors = ''
    #User List
    $RootKey = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey(“USERS”,$Computer)
    $SubKeyNames = $RootKey.GetSubKeyNames()
    ForEach ($SubKeyName in $SubKeyNames)
        {
            if (($SubKeyName.Contains(“_Classes”) -ne $True))
                {
                    #Drive List
                    try {
                    $NetworkKey = $RootKey.OpenSubKey($SubKeyName + “\\Network”)
                    } catch {$Errors += "$RootKey-$SubKeyName : $_."}
                    if ($NetworkKey -ne $Null)
                        {
                            $MappedDrives = $NetworkKey.GetSubKeyNames()
                           
                              ForEach ($MappedDrive in $MappedDrives)
                                {
                                  try {
                                  $DriveKey = $NetworkKey.OpenSubKey($MappedDrive)
                                  $DrivePath = ($DriveKey.GetValue(“RemotePath”) -split '\\share')[0].Trim('\\')
                                  if(! $DriveLetterPath.ContainsKey($MappedDrive.ToUpper()+':')) {
                                      $DriveLetterPath.Add($MappedDrive.ToUpper()+':', $DrivePath)            
                                  }  
                                }catch {$Errors += "$SubKeyName-$NetworkKey : $_."}     
                                }
                                
                        } 
                }
        }

    return $DriveLetterPath.Keys 
  }

$deploymentType  = '${deploymentType}'
$instanceName = '${instanceName}'

$sqlDrives = New-Object System.Collections.ArrayList

if ($deploymentType -eq 'FCI') {
    $sqlResource = ${instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'}
    $sqlgroup = Get-ClusterResource | Where-Object Name -eq "$sqlResource"
    if (-not [string]::IsNullOrEmpty($sqlgroup)) {
        $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
        $resourcegroup = $sqlserver.GetRelated() | Where Type -eq 'Physical Disk'

        foreach ($resource in $resourcegroup) {
            $sqldisks = $resource.GetRelated("MSCluster_Disk")
            foreach ($disk in $sqldisks) {
                $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
                $diskdrive = $diskpart.path
                $sqlDrives.Add($diskdrive) | Out-Null
            }
        }
    }
}

$disks = Get-WmiObject -Query "SELECT DeviceID, Model FROM Win32_DiskDrive"
$results = New-Object System.Collections.ArrayList

foreach ($disk in $disks) {
    $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"

    foreach ($partition in $partitions) {
        $logicalDisks = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"

        foreach ($logicalDisk in $logicalDisks) {
            $logicalDiskObject = [PSCustomObject]@{
                Manufacturer = $disk.Model
                LogicalDisk = $logicalDisk.DeviceID
                FileSystem = $logicalDisk.FreeSpace
            }

            if ($deploymentType -eq 'FCI' -and $sqlDrives -contains $logicalDisk.DeviceID) {
                $logicalDiskObject = $logicalDiskObject | Add-Member -MemberType NoteProperty -Name "Owner" -Value "SQL Server ($instanceName)" -PassThru
            }

            [void]$results.Add($logicalDiskObject)
        }
    }
}


$isoDriveLetters = Get-WmiObject -Class Win32_CDROMDrive -Property Drive | Select-Object -ExpandProperty Drive

foreach ($isoDriveLetter in $isoDriveLetters) {
    $isoObject = [PSCustomObject]@{
        Manufacturer = 'CD ROM'
        LogicalDisk = $isoDriveLetter
        FileSystem = 0
        Owner = 'null'
    }

    [void]$results.Add($isoObject)
}

$smbDriveLetters = GetSMBMappedDrivesWithPath

foreach ($driveLetter in $smbDriveLetters) {
    $smbObject = [PSCustomObject]@{
        Manufacturer = 'SMB'
        LogicalDisk = $driveLetter
        FileSystem = 0
        Owner = 'null'
    }

    [void]$results.Add($smbObject)
}
$results | ConvertTo-Json
 `;

/* Sample Resposne of GET_ACTIVE_NODE_DRIVE_INFO
[
    {
        "Manufacturer":  "NETAPP LUN C-Mode  Multi-Path Disk Device",
        "LogicalDisk":  "L:",
        "FileSystem":  80386654208,
        "Owner":  "SQL Server (MSSQLSERVER)"
    },
    {
        "Manufacturer":  "NETAPP LUN C-Mode  Multi-Path Disk Device",
        "LogicalDisk":  "Q:",
        "FileSystem":  10653229056,
        "Owner":  "Cluster Group"
    },
    {
        "Manufacturer":  "NETAPP LUN C-Mode  Multi-Path Disk Device",
        "LogicalDisk":  "F:",
        "FileSystem":  11181883392,
        "Owner":  "SQL Server (MSSQLSERVER)"
    },
    {
        "Manufacturer":  "NETAPP LUN C-Mode  Multi-Path Disk Device",
        "LogicalDisk":  "P:",
        "FileSystem":  1068367872,
        "Owner":  "SQL Server (MSSQLSERVER)"
    },
    {
        "Manufacturer":  "NETAPP LUN C-Mode  Multi-Path Disk Device",
        "LogicalDisk":  "R:",
        "FileSystem":  1068367872,
        "Owner":  "SQL Server (MSSQLSERVER)"
    },
*/

const GET_STANDBY_NODE_DRIVE_LIST = `$driveLetters = Get-WmiObject Win32_Volume | Select-Object -ExpandProperty DriveLetter
$driveLettersObject = [PSCustomObject]@{
    DriveLetters = $driveLetters
}
$driveLettersObject | ConvertTo-Json
`;

/* Sample Response of GET_STANDBY_NODE_DRIVE_LIST
{
    "DriveLetters":  [
                         "C:",
                         "S:",
                         "L:",
                         "T:",
                         "Q:",
                         "D:",
                         "E:",
                     ]
}
*/

const GET_DEFAULT_DRIVES = (
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean = false
) => `
#Get default drives script
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$executableInstanceName = "${executableInstanceName}"
$instanceName = "${instanceName}"
$defaultDrivesQuery = "SET NOCOUNT ON;
SELECT 
SERVERPROPERTY('InstanceDefaultDataPath') AS DefaultDataDrive,
SERVERPROPERTY('InstanceDefaultLogPath') AS DefaultLogDrive FOR JSON PATH;"

    ${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

#Get default collation and default version of SQL server
$defaultDrives = Call-SqlCmd -SqlCredential $sqlCredential -Query "$defaultDrivesQuery" -InstanceName "$executableInstanceName" -IsMultiQuery $True

Write-Output $defaultDrives | ConvertTo-Json
`;

const cpuQuery = `@"
    SET NOCOUNT ON; set quoted_identifier ON; DECLARE @ts BIGINT;
    DECLARE @lastNmin TINYINT;
    SET @lastNmin = 1;
    SELECT @ts =(SELECT cpu_ticks/(cpu_ticks/ms_ticks) FROM sys.dm_os_sys_info);
    SELECT TOP(@lastNmin)
            SQLProcessUtilization AS [percentUsed],
            SQLProcessUtilization AS [used],
            SQLProcessUtilization+SystemIdle+(100 - SystemIdle - SQLProcessUtilization) AS [total],
            100-SQLProcessUtilization AS [remaining]
    FROM (SELECT record.value('(./Record/@id)[1]','int')AS record_id,
    record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]','int')AS [SystemIdle],
    record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]','int')AS [SQLProcessUtilization],
    [timestamp]
    FROM (SELECT[timestamp], convert(xml, record) AS [record]
    FROM sys.dm_os_ring_buffers
    WHERE ring_buffer_type =N'RING_BUFFER_SCHEDULER_MONITOR'AND record LIKE'%%')AS x )AS y
    ORDER BY record_id DESC FOR JSON PATH
"@`;

const diskQuery = `@"
    SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum
    FROM sys.master_files mf1)
    ,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID
    FROM presel pr
    WHERE pr.RowNum = 1)
    SELECT SUM(ovs.total_bytes) AS total, SUM(ovs.available_bytes) AS remaining
    FROM roundtwo mf
    CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH
"@`;

const dbSizeQuery = `@"
    SET NOCOUNT ON;
    SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH
"@`;

const memoryQuery = `@"
    SET NOCOUNT ON; SELECT
    (processmem.physical_memory_in_use_kb * 1024) AS used,
    (sysmem.total_physical_memory_kb * 1024) AS total,
    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,
    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed
    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH
"@`;

// AOAG discovery query builder extracted for reuse in discovery scripts
const buildAoagQuery = `@"
SET NOCOUNT ON;
SELECT
    (SELECT SERVERPROPERTY('ServerName') AS serverName,
                    SERVERPROPERTY('IsHadrEnabled') AS isHadrEnabled,
                    SERVERPROPERTY('IsClustered') AS isClustered
     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS serverInfo,
    (SELECT
            ag.name AS agName,
            gp.primary_replica AS primaryReplica,
            routing.ReadRoutingTargets AS readRoutingTargets,
            (
                SELECT
                    ar.replica_server_name AS replica,
                    rs.role_desc AS role,
                    ar.availability_mode_desc AS availabilityMode,
                    ar.failover_mode_desc AS failoverMode,
                    rs.synchronization_health_desc AS syncHealth,
                    rs.connected_state_desc AS connectedState,
                    rs.is_local AS isLocalReplica,
                    ar.secondary_role_allow_connections_desc AS secondaryConnections,
                    ar.primary_role_allow_connections_desc AS primaryConnections,
                    ar.read_only_routing_url AS readRoutingUrl,
                    CASE
                        WHEN rs.role_desc = 'SECONDARY'
                         AND ar.secondary_role_allow_connections_desc IN ('ALL','READ_ONLY')
                        THEN 1 ELSE 0 END AS isReadReplica,
                    CASE
                        WHEN rs.role_desc = 'SECONDARY'
                         AND ar.secondary_role_allow_connections_desc IN ('ALL','READ_ONLY')
                         AND ar.read_only_routing_url IS NOT NULL
                        THEN 1 ELSE 0 END AS isRoutableReadReplica
                FROM sys.availability_replicas ar
                LEFT JOIN sys.dm_hadr_availability_replica_states rs
                    ON ar.replica_id = rs.replica_id
                WHERE ar.group_id = ag.group_id
                FOR JSON PATH
            ) AS replicas
        FROM sys.availability_groups ag
        LEFT JOIN sys.dm_hadr_availability_group_states gp
            ON ag.group_id = gp.group_id
        OUTER APPLY (
            SELECT STRING_AGG(rtarget.replica_server_name,' -> ')
                             WITHIN GROUP (ORDER BY rol.routing_priority) AS ReadRoutingTargets
            FROM sys.availability_replicas pr
            JOIN sys.availability_read_only_routing_lists rol
                ON rol.replica_id = pr.replica_id
            JOIN sys.availability_replicas rtarget
                ON rol.read_only_replica_id = rtarget.replica_id
            WHERE pr.group_id = ag.group_id
                AND pr.replica_server_name = gp.primary_replica
        ) routing
        FOR JSON PATH) AS availabilityGroups
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
"@`;

/**
 * Shared PowerShell function to resolve FCI virtual names to their current owner node + IP.
 * For FCI+AOAG, replica names are FCI virtual names (e.g., FCI012, FCI034) which don't match
 * physical cluster node names. This function bridges that gap by:
 *   1. Looking up each replica's FCI virtual name via SQL Network Name cluster resources
 *   2. Finding the current OwnerNode for that FCI group
 *   3. Resolving the owner node's IP from the cluster network interfaces
 * Returns: array of @{ fciName; ownerNode; ownerIp } for each FCI replica
 * Safe for standalone AOAG (returns empty array) and pure FCI (no AOAG context needed).
 */
const GET_FCI_OWNER_MAPPING_FUNCTION = `
    Function Get-FciOwnerMapping {
        param(
            [object]$AoagDetails,
            [array]$ClusterNodes
        )
        $mapping = @()
        try {
            if (-not $AoagDetails -or -not $AoagDetails.baseDeploymentType -or $AoagDetails.baseDeploymentType -ne 'FCI') {
                return $mapping
            }
            if (-not $AoagDetails.availabilityGroups) { return $mapping }

            # Collect unique FCI virtual names from replica names
            $fciNames = @{}
            foreach ($ag in $AoagDetails.availabilityGroups) {
                if (-not $ag.replicas) { continue }
                foreach ($replica in $ag.replicas) {
                    $replicaName = $replica.replica
                    if ([string]::IsNullOrEmpty($replicaName)) { continue }
                    # Extract FCI name (before backslash for named instances)
                    $fciName = if ($replicaName -match '\\\\') { $replicaName.Split('\\\\')[0] } else { $replicaName }
                    if (-not $fciNames.ContainsKey($fciName)) {
                        $fciNames[$fciName] = $true
                    }
                }
            }

            foreach ($fciName in $fciNames.Keys) {
                try {
                    # Try to find SQL Network Name resource for this FCI
                    $resourceName = "SQL Network Name (" + $fciName + ")"
                    $resource = Get-ClusterResource -Name $resourceName -ErrorAction SilentlyContinue

                    if (-not $resource) {
                        # Fallback: find SQL Network Name resource containing the FCI name
                        $sqlNetworkResources = Get-ClusterResource -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "SQL Network Name*" }
                        foreach ($res in $sqlNetworkResources) {
                            if ($res.Name -match [regex]::Escape($fciName)) {
                                $resource = $res
                                break
                            }
                        }
                    }

                    if ($resource) {
                        $ownerNode = $resource.OwnerGroup.OwnerNode.Name
                        if ($ownerNode -and $ClusterNodes) {
                            $ownerIp = ($ClusterNodes | Where-Object { $_.Node -eq $ownerNode } | Select-Object -First 1).Address
                            $mapping += @{
                                fciName = $fciName
                                ownerNode = $ownerNode
                                ownerIp = $ownerIp
                            }
                        }
                    }
                } catch {
                    Write-Information "Failed to get FCI owner mapping for '$fciName': $_"
                }
            }
        } catch {
            Write-Information "Failed to build FCI owner mapping: $_"
        }
        return $mapping
    }
`;

/**
 * AOAG details script with Windows Cluster node details
 * Uses same pattern as sqlQueryExecutionWithAuth but adds:
 * 1. Wraps AOAG response under 'aoagDetails' key
 * 2. Adds 'windowsClusterNodes' with IPs (same as discovery's GetClusterDetails)
 * 3. Adds 'fciOwnerMapping' for FCI+AOAG to map FCI virtual names to owner node IPs
 * Returns: { instanceName: { aoagDetails: {...}, windowsClusterNodes: [...], fciOwnerMapping?: [...] } }
 */
const getAoagDetailsScript = (instances: string[], sqlAuthEnabled = false) => `
    $sqlInstances = '${JSON.stringify(instances)}' | ConvertFrom-Json
    $query = ${buildAoagQuery}
    try {
        $responseObject = @{}
        ${getSqlCredentials(sqlAuthEnabled)}
        ${enableCredSSP}
        ${invokeCommandWithCredSSP}
        if ($isAtleastOneCredentialIsOfDomain) {
            Enable-CredSSP
        }

        ${GET_FCI_OWNER_MAPPING_FUNCTION}
        
        # Get Windows Cluster nodes with IPs (same as discovery's GetClusterDetails)
        $windowsClusterNodes = @()
        try {
            $clusterServiceStatus = (Get-Service -Name "ClusSvc" -ErrorAction SilentlyContinue).Status
            if ($clusterServiceStatus -eq "Running") {
                $windowsClusterNodes = Get-ClusterNetworkInterface -ErrorAction SilentlyContinue | ForEach-Object {
                    @{
                        "Address" = $_.Address
                        "Node" = $_.Node
                    }
                }
            }
        } catch {
            Write-Information "Failed to get Windows Cluster nodes: $_"
        }
        
        # Database-level AG validation query - checks if THIS instance has databases in any AG
        $databaseAgQuery = @"
SET NOCOUNT ON;
SELECT 
    (SELECT COUNT(*) FROM sys.dm_hadr_database_replica_states WHERE is_local = 1) AS databasesInAgCount,
    (SELECT DISTINCT ag.name AS agName 
     FROM sys.dm_hadr_database_replica_states drs
     INNER JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
     INNER JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
     WHERE drs.is_local = 1
     FOR JSON PATH) AS participatingAgs
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
"@
        
        $sqlInstances | ForEach-Object {
            $serverInstanceName = $_
            $instanceName = "$env:COMPUTERNAME"
            if ($serverInstanceName -ne 'MSSQLSERVER') {
                $instanceName = "$env:COMPUTERNAME\\$serverInstanceName"
            }
            try {
                ${validateSQLInstanceCredentials}
                $sqlError = $null
                
                # First, check database-level AG participation for this instance
                $databasesInAgCount = 0
                $participatingAgs = @()
                try {
                    $dbAgResponse = $null
                    if ($sqlCredential.useDomainAuth -eq $True) {
                        $dbAgResponse = Invoke-CommandWithCredSSP -sqlquery $databaseAgQuery -instanceName $instanceName
                    } elseif ($sqlCredential.useSqlAuth -eq $True) {
                        $dbAgResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $instanceName -Q $databaseAgQuery -y 0 2>> $null
                    }
                    if ($($LASTEXITCODE -and $LASTEXITCODE -ne 0) -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
                        $dbAgResponse = sqlcmd -S $instanceName -Q $databaseAgQuery -y 0 2>> $null
                    }
                    if (-not [string]::IsNullOrEmpty($dbAgResponse) -and $dbAgResponse -ne "NULL") {
                        $dbAgParsed = $dbAgResponse | ConvertFrom-Json
                        $databasesInAgCount = $dbAgParsed.databasesInAgCount
                        if ($dbAgParsed.participatingAgs -is [string]) {
                            try { $participatingAgs = $dbAgParsed.participatingAgs | ConvertFrom-Json } catch { $participatingAgs = @() }
                        } else {
                            $participatingAgs = $dbAgParsed.participatingAgs
                        }
                    }
                } catch {
                    Write-Information "Database-level AG check failed for instance '$instanceName': $_"
                }
                
                if ($sqlCredential.useDomainAuth -eq $True) {
                    $sqlResponse = Invoke-CommandWithCredSSP -sqlquery $query -instanceName $instanceName
                } elseif ($sqlCredential.useSqlAuth -eq $True) {
                    $sqlResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $instanceName -Q $query -y 0 2>> $sqlError
                }

                if ($($LASTEXITCODE -and $LASTEXITCODE -ne 0) -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
                    $sqlResponse =  sqlcmd -S $instanceName -Q $query -y 0 2>> $sqlError
                }

                if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
                    throw $sqlError
                }
                
                # Wrap response under aoagDetails and add cluster nodes
                $instanceResult = @{}
                if (-not [string]::IsNullOrEmpty($sqlResponse) -and $sqlResponse -ne "NULL") {
                    $aoagParsed = $sqlResponse | ConvertFrom-Json
                    # Normalize nested JSON strings (same as discovery)
                    try { if ($aoagParsed.serverInfo -is [string]) { $aoagParsed.serverInfo = $aoagParsed.serverInfo | ConvertFrom-Json } } catch {}
                    try { if ($aoagParsed.availabilityGroups -is [string]) { $aoagParsed.availabilityGroups = $aoagParsed.availabilityGroups | ConvertFrom-Json } } catch {}
                    try { if ($aoagParsed.availabilityGroups) { foreach ($ag in $aoagParsed.availabilityGroups) { if ($ag.Replicas -is [string]) { $ag.Replicas = $ag.Replicas | ConvertFrom-Json } } } } catch {}
                    
                    # Check if HADR is enabled for this instance
                    $isHadrEnabled = $aoagParsed.serverInfo.isHadrEnabled -eq 1
                    
                    # Only return aoagDetails if HADR is enabled AND this instance has databases in AG
                    if ($isHadrEnabled -and $databasesInAgCount -gt 0) {
                        # Filter availabilityGroups to only include AGs this instance participates in
                        if ($participatingAgs -and $participatingAgs.Count -gt 0 -and $aoagParsed.availabilityGroups) {
                            $participatingAgNames = @($participatingAgs | ForEach-Object { $_.agName })
                            $aoagParsed.availabilityGroups = @($aoagParsed.availabilityGroups | Where-Object { $participatingAgNames -contains $_.agName })
                        }
                        
                        # Set baseDeploymentType inside aoagDetails based on isClustered
                        if ($aoagParsed.serverInfo -and $null -ne $aoagParsed.serverInfo.isClustered) {
                            $baseType = if ($aoagParsed.serverInfo.isClustered -eq 1) { 'FCI' } else { 'Standalone' }
                            $aoagParsed | Add-Member -MemberType NoteProperty -Name 'baseDeploymentType' -Value $baseType -Force
                        }
                        
                        # Remove isClustered from serverInfo as it's internal-only (used to calculate baseDeploymentType)
                        if ($aoagParsed.serverInfo) {
                            $cleanServerInfo = @{}
                            if ($aoagParsed.serverInfo.serverName) { $cleanServerInfo['serverName'] = $aoagParsed.serverInfo.serverName }
                            if ($null -ne $aoagParsed.serverInfo.isHadrEnabled) { $cleanServerInfo['isHadrEnabled'] = $aoagParsed.serverInfo.isHadrEnabled }
                            $aoagParsed.serverInfo = $cleanServerInfo
                        }
                        
                        $instanceResult['aoagDetails'] = $aoagParsed
                    }
                }
                # Add cluster nodes to each instance response
                if ($windowsClusterNodes -and $windowsClusterNodes.Count -gt 0) {
                    $instanceResult['windowsClusterNodes'] = $windowsClusterNodes
                }
                # Build FCI owner mapping for FCI+AOAG replica name → owner node IP resolution
                if ($instanceResult['aoagDetails']) {
                    $fciMapping = Get-FciOwnerMapping -AoagDetails $instanceResult['aoagDetails'] -ClusterNodes $windowsClusterNodes
                    if ($fciMapping -and $fciMapping.Count -gt 0) {
                        $instanceResult['fciOwnerMapping'] = $fciMapping
                    }
                }
                $responseObject[$serverInstanceName] = $instanceResult
            } catch {
                $responseObject[$serverInstanceName] = @{ 'error' = "$_.Exception.Message" }
            }
        }
        $response = $responseObject | ConvertTo-Json -Depth 10
        
        if([string]::IsNullOrEmpty($response)) {
            Write-Information "Failed to compress the response because the response is either null or empty. $response"
            return $response
        }
        ${compressResponse}
        return (Deflate-String $response)
    } catch {
        Write-Information $_.Exception.Message
        $responseObject.add('error', $_.Exception.Message)
        $responseObject | ConvertTo-Json -Depth 10
    }
`;

const RESOURCE_UTILIZATION = (instances: string[], sqlAuthEnabled = false) => `
    $cpuQuery = ${cpuQuery}
    $diskQuery = ${diskQuery}
    $dbSizeQuery = ${dbSizeQuery}
    $memoryQuery = ${memoryQuery}
    $instances = '${JSON.stringify(instances)}' | ConvertFrom-Json

    $queries = @(
        @{ "type" = "cpu"; "query" = $cpuQuery },
        @{ "type" = "disk"; "query" = $diskQuery },
        @{ "type" = "dbSize"; "query" = $dbSizeQuery },
        @{ "type" = "memory"; "query" = $memoryQuery }
    )

    $responseObject = @{}
    try {
        ${getSqlCredentials(sqlAuthEnabled)}

        ${enableCredSSP}
        ${invokeCommandWithCredSSP}
        if ($isAtleastOneCredentialIsOfDomain) {
            Enable-CredSSP
        }
        $instances | ForEach-Object {
            $instance = $_
            $instanceName = "$env:COMPUTERNAME"
            if ($instance -ne 'MSSQLSERVER') {
                $instanceName = "$env:COMPUTERNAME\\$instance"
            }
            try {
                $sqlError = $null
                ${validateSQLInstanceCredentials}

                $instanceResponse = @{}
                $queries | ForEach-Object {
                    $sqlError = $null
                    $type = $_.type
                    $query = $_.query

                    if ($sqlCredential.useDomainAuth -eq $True) {
                        $sqlResponse = Invoke-CommandWithCredSSP -sqlquery $query -instanceName $instanceName -IsMultiQuery $True
                    } elseif ($sqlCredential.useSqlAuth -eq $True) {
                        $sqlResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $instanceName -Q $query -y 0 2>> $sqlError
                    }

                    if ($($LASTEXITCODE -and $LASTEXITCODE -ne 0) -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
                        $sqlResponse =  sqlcmd -S $instanceName -Q $query -y 0 2>> $sqlError
                    }

                    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
                        throw $sqlError
                    }
                    $instanceResponse[$type] = $sqlResponse
                }
                $responseObject[$instance] = $instanceResponse
            } catch {
                $responseObject[$instance] = $_.Exception.Message
            }
        }
        # disableCredSSP is removed as most machines will be part of the domain and we are enabling CredSSP at the domain level.
        $response = $responseObject | ConvertTo-Json -Depth 5

        if([string]::IsNullOrEmpty($response)) {
            throw "Failed to compress the response because the response is either null or empty. $response"
        }
        ${compressResponse}
        return (Deflate-String $response)
    } catch {
        Write-Information $_.Exception.Message
        $responseObject.add('error', $_.Exception.Message)
        $responseObject | ConvertTo-Json -Depth 5
    }
`;

const GET_DEFAULT_COLLATION = (
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean = false
) => `
#Get default collation script
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$executableInstanceName = "${executableInstanceName}"
$instanceName = "${instanceName}"

$queryCollation = "SET NOCOUNT ON;SELECT CONVERT(nvarchar(128), SERVERPROPERTY('collation'));"
$queryVersion = "SET NOCOUNT ON;SELECT @@VERSION;"

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

#Get default collation and default version of SQL server
$defaultSqlCollation = Call-SqlCmd -SqlCredential $sqlCredential -Query "$queryCollation" -InstanceName "$executableInstanceName" -IsMultiQuery $True
$sqlVersion = Call-SqlCmd -SqlCredential $sqlCredential -Query "$queryVersion" -InstanceName "$executableInstanceName" -IsMultiQuery $True

Write-Output $defaultSqlCollation $sqlVersion | ConvertTo-Json

`;

const validateSQLInstanceConnectivity = (
    ec2instanceId: string,
    sqlInstanceNames: string[] = [DEFAULT_MSSQL_INSTANCE_NAME],
    windowsUser: boolean = false,
    checkManageReadiness: boolean = false,
    isReplicaInfoRequired: boolean = false,
    isGovCloud: boolean = false
) => ` 
    $env:Path += ';C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\'   
    $ProgressPreference = 'SilentlyContinue'
    $checkManageReadiness = [System.Convert]::ToBoolean('${checkManageReadiness}')
    $windowsUser = [System.Convert]::ToBoolean('${windowsUser}')
    $isReplicaInfoRequired = [System.Convert]::ToBoolean('${isReplicaInfoRequired}')
    $isGovCloud = [System.Convert]::ToBoolean('${isGovCloud}')
    if ($isGovCloud) {
        $credSuffix = ''
    } else {
        $credSuffix = '_temp'
    }

    $connection = Test-Connection -ComputerName ${GOOGLE_DNS} -Quiet -Count 1
    if ($connection -ne $True) {
        # Set the registry key to disable certificate revocation check in case of private subnet
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
    }
    $ssmmodulePath = (Get-Module -Name 'AWS.Tools.SimpleSystemsManagement' -ListAvailable).Path
    if($ssmmodulePath -is [System.Array]) {
        $ssmmodulePath = $ssmmodulePath[0]
    }
    Import-Module -Name $ssmmodulePath

    ${GET_FCI_OWNER_MAPPING_FUNCTION}

    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    try {
        $ec2instanceId = '${ec2instanceId}'
        $sqlInstanceNames = '${JSON.stringify(sqlInstanceNames)}' | ConvertFrom-Json

        # Check if sqlcmd is installed or not
        $sqlcmdInstalled = (Get-Command -Type Application sqlcmd 2> $null) -ne $null

        if (-not $sqlcmdInstalled) {
            $responseObject.add('sqlerror', 'sqlcmd utility is not available. Install it by referring to https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility. If the command is already installed,,  ensure the "Path" environment variable contains the path of the command and retry the operation')
            $responseObject.add('sqlInstanceConnectivity', $False)
        } else {
            $SQLCredStore = "/netapp/wlmdb/$ec2instanceId"
            $credobject =  (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 

            $responseObject['instances'] = @()

            $sqlquery = @"
                SET NOCOUNT ON;
                    SELECT 
                        SERVERPROPERTY('edition') AS sqlEdition,
                        (SELECT COUNT(*) FROM sys.databases) AS noOfDatabases
                        ${
                            // prettier-ignore
                            checkManageReadiness
        ? ',(SELECT permission_name FROM fn_my_permissions(NULL, \'SERVER\') FOR JSON PATH) as permissions'
        : ''
                        }
                    FOR JSON PATH
"@

            ${
                windowsUser
                    ? `
                    ${enableCredSSP} 
                    ${invokeCommandWithCredSSP}
                    Enable-CredSSP
                `
                    : ''
            }
            $sqlInstanceNames | ForEach-Object {
                $sqlinstancename = $_
                try {
                    ${
                        windowsUser
                            ? `
                            $domainList = $credobject.domain
                            if ($domainList -ne $null) {
                                $sqlCredentials = $domainList | Where-Object { $_.sqlinstancename.ToLower() -eq "$($sqlinstancename.ToLower())$credSuffix" } | Select-Object -First 1
                                if ($sqlCredentials -eq $null) {
                                    $sqlCredentials = $domainList | Where-Object { $_.sqlinstancename.ToUpper() -eq 'MSSQLSERVER' } | Select-Object -First 1
                                }
                            } else {
                                $sqlCredentials = $null
                            }
                        `
                            : `
                            $sqlList = $credobject.sql
                            if ($sqlList -ne $null) {
                                $sqlCredentials = $sqlList | Where-Object { $_.sqlinstancename.ToLower() -eq "$($sqlinstancename.ToLower())$credSuffix" } | Select-Object -First 1
                            } else {
                                $sqlCredentials = $null
                            }
                        `
                    }

                    if ($sqlCredentials -eq $null) {
                        $errorMessage = "No SQL instance found with the name $sqlinstancename"
                        throw $errorMessage
                    }

                    $sqlCredential = New-Object PSObject -Property @{
                        username = $sqlCredentials.username
                        password = $sqlCredentials.password
                    }
                    
                    $serverInstanceName = "$env:COMPUTERNAME"
                    If($sqlinstancename -ne 'MSSQLSERVER') {
                        $serverInstanceName = "$env:COMPUTERNAME\\$sqlinstancename"
                        
                    }

                    if ($sqlCredential.username -eq $null -or $sqlCredential.password -eq $null) {
                        $errorMessage = "SQL credentials not found for the instance $sqlinstancename"
                        throw $errorMessage
                    }

                    ${
                        windowsUser
                            ? '$sqlresult = Invoke-CommandWithCredSSP -sqlquery $sqlquery -instanceName $serverInstanceName -extraArguments -r1'
                            : '$sqlresult = Sqlcmd -S $serverInstanceName -U $sqlCredential.username -P $sqlCredential.password -Q $sqlquery -y 0 -r1 2> $null'
                    }

                    if([string]::IsNullOrEmpty($sqlresult)) {
                        $responseObject['instances'] += @{
                            sqlInstanceName = $sqlinstancename
                            sqlInstanceConnectivity = $False
                            sqlerror = "SQLCMD execution failed. Verify credentials."
                        }
                    }
                    else {
                        $sqlresult = $sqlresult | ConvertFrom-Json
                        $instanceResponse = @{
                            sqlInstanceName = $sqlinstancename
                            sqlEdition = $sqlresult.sqlEdition
                            noOfDatabases = $sqlresult.noOfDatabases
                            sqlInstanceConnectivity = $True
                        }
                        
                        if($checkManageReadiness -eq $True) {
                            $unavailablePsModuleList = @()
                            $currentSqlPermissions = $sqlresult.permissions | ForEach-Object { $_.permission_name }
                            $instanceResponse['sqlPermissions'] = $currentSqlPermissions
                            $requiredPsModuleList = @(${REQUIRED_PS_MODULES_FOR_MANAGEMENT})
                            $availablePsModuleList = (Get-Module -ListAvailable -Name $requiredPsModuleList).Name
                            If (Get-Command -Name pwsh -ErrorAction SilentlyContinue) {
                                $availablePsModuleList += 'Powershell 7'
                            }
                            $instanceResponse['availablePsModules'] = $availablePsModuleList
                        }
                        
                        # AOAG detection and details fetching (if isReplicaInfoRequired = true)
                        if ($isReplicaInfoRequired -eq $True) {
                            try {
                                # Database-level AG validation query - checks if THIS instance has databases in any AG
                                $databaseAgQuery = @"
SET NOCOUNT ON;
SELECT 
    (SELECT COUNT(*) FROM sys.dm_hadr_database_replica_states WHERE is_local = 1) AS databasesInAgCount,
    (SELECT DISTINCT ag.name AS agName 
     FROM sys.dm_hadr_database_replica_states drs
     INNER JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
     INNER JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
     WHERE drs.is_local = 1
     FOR JSON PATH) AS participatingAgs
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
"@
                                # AOAG details query
                                $aoagQuery = ${buildAoagQuery}
                                
                                $databasesInAgCount = 0
                                $participatingAgs = @()
                                
                                # Run database-level AG check
                                $dbAgResponse = $null
                                ${
                                    windowsUser
                                        ? '$dbAgResponse = Invoke-CommandWithCredSSP -sqlquery $databaseAgQuery -instanceName $serverInstanceName'
                                        : '$dbAgResponse = Sqlcmd -S $serverInstanceName -U $sqlCredential.username -P $sqlCredential.password -Q $databaseAgQuery -y 0 2> $null'
                                }
                                
                                if (-not [string]::IsNullOrEmpty($dbAgResponse) -and $dbAgResponse -ne "NULL") {
                                    $dbAgParsed = $dbAgResponse | ConvertFrom-Json
                                    $databasesInAgCount = $dbAgParsed.databasesInAgCount
                                    if ($dbAgParsed.participatingAgs -is [string]) {
                                        try { $participatingAgs = $dbAgParsed.participatingAgs | ConvertFrom-Json } catch { $participatingAgs = @() }
                                    } else {
                                        $participatingAgs = $dbAgParsed.participatingAgs
                                    }
                                }
                                
                                # Only fetch AOAG details if this instance has databases in AG
                                if ($databasesInAgCount -gt 0) {
                                    $aoagResponse = $null
                                    ${
                                        windowsUser
                                            ? '$aoagResponse = Invoke-CommandWithCredSSP -sqlquery $aoagQuery -instanceName $serverInstanceName'
                                            : '$aoagResponse = Sqlcmd -S $serverInstanceName -U $sqlCredential.username -P $sqlCredential.password -Q $aoagQuery -y 0 2> $null'
                                    }
                                    
                                    if (-not [string]::IsNullOrEmpty($aoagResponse) -and $aoagResponse -ne "NULL") {
                                        $aoagParsed = $aoagResponse | ConvertFrom-Json
                                        
                                        # Normalize nested JSON strings
                                        try { if ($aoagParsed.serverInfo -is [string]) { $aoagParsed.serverInfo = $aoagParsed.serverInfo | ConvertFrom-Json } } catch {}
                                        try { if ($aoagParsed.availabilityGroups -is [string]) { $aoagParsed.availabilityGroups = $aoagParsed.availabilityGroups | ConvertFrom-Json } } catch {}
                                        try { if ($aoagParsed.availabilityGroups) { foreach ($ag in $aoagParsed.availabilityGroups) { if ($ag.Replicas -is [string]) { $ag.Replicas = $ag.Replicas | ConvertFrom-Json } } } } catch {}
                                        
                                        $isHadrEnabled = $aoagParsed.serverInfo.isHadrEnabled -eq 1
                                        
                                        if ($isHadrEnabled) {
                                            # Filter availabilityGroups to only AGs this instance participates in
                                            if ($participatingAgs -and $participatingAgs.Count -gt 0 -and $aoagParsed.availabilityGroups) {
                                                $participatingAgNames = @($participatingAgs | ForEach-Object { $_.agName })
                                                $aoagParsed.availabilityGroups = @($aoagParsed.availabilityGroups | Where-Object { $participatingAgNames -contains $_.agName })
                                            }
                                            
                                            # Set baseDeploymentType based on isClustered
                                            if ($aoagParsed.serverInfo -and $null -ne $aoagParsed.serverInfo.isClustered) {
                                                $baseType = if ($aoagParsed.serverInfo.isClustered -eq 1) { 'FCI' } else { 'Standalone' }
                                                $aoagParsed | Add-Member -MemberType NoteProperty -Name 'baseDeploymentType' -Value $baseType -Force
                                            }
                                            
                                            # Remove isClustered from serverInfo (internal only)
                                            if ($aoagParsed.serverInfo) {
                                                $cleanServerInfo = @{}
                                                if ($aoagParsed.serverInfo.serverName) { $cleanServerInfo['serverName'] = $aoagParsed.serverInfo.serverName }
                                                if ($null -ne $aoagParsed.serverInfo.isHadrEnabled) { $cleanServerInfo['isHadrEnabled'] = $aoagParsed.serverInfo.isHadrEnabled }
                                                $aoagParsed.serverInfo = $cleanServerInfo
                                            }
                                            
                                            $instanceResponse['aoagDetails'] = $aoagParsed
                                        }
                                    }
                                    
                                    # Get Windows Cluster nodes with IPs for replica mapping
                                    try {
                                        $clusterServiceStatus = (Get-Service -Name "ClusSvc" -ErrorAction SilentlyContinue).Status
                                        if ($clusterServiceStatus -eq "Running") {
                                            $windowsClusterNodes = Get-ClusterNetworkInterface -ErrorAction SilentlyContinue | ForEach-Object {
                                                @{
                                                    "Address" = $_.Address
                                                    "Node" = $_.Node
                                                }
                                            }
                                            if ($windowsClusterNodes -and $windowsClusterNodes.Count -gt 0) {
                                                $instanceResponse['windowsClusterNodes'] = $windowsClusterNodes
                                            }
                                        }
                                    } catch {
                                        Write-Information "Failed to get Windows Cluster nodes: $_"
                                    }
                                    # Build FCI owner mapping for FCI+AOAG replica name → owner node IP resolution
                                    if ($instanceResponse['aoagDetails']) {
                                        $fciMapping = Get-FciOwnerMapping -AoagDetails $instanceResponse['aoagDetails'] -ClusterNodes $windowsClusterNodes
                                        if ($fciMapping -and $fciMapping.Count -gt 0) {
                                            $instanceResponse['fciOwnerMapping'] = $fciMapping
                                        }
                                    }
                                }
                            } catch {
                                Write-Information "AOAG detection failed for instance '$sqlinstancename': $_"
                            }
                        }
                        
                        $responseObject['instances'] += $instanceResponse
                    }
                } catch {
                    $responseObject['instances'] += @{
                        sqlInstanceName = $sqlinstancename
                        sqlInstanceConnectivity = $False
                        sqlerror = $_.Exception.Message
                    }
                }
            }
            # disableCredSSP is removed as most of machines will be part of domain and we are enabling CredSSP at domain level.
           
        }
    } catch {
        if (-not $responseObject.ContainsKey('sqlerror')) {
            $responseObject.add('sqlerror', $_.Exception.Message)
        }
        if (-not $responseObject.ContainsKey('sqlInstanceConnectivity')) {
            $responseObject.add('sqlInstanceConnectivity', $False)
        }
    }
`;

const installPowerShellModule = (module: string) => `
    $modulename = '${module}'
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    if (-not (Get-Module -ListAvailable -Name $modulename)) {
        $responseObject.add('requiredModuleError', "$modulename Module does not exist, installing it now")
        $null = Start-Job -ScriptBlock {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
            Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
            Install-Module -Name $args[0] -Force -AllowClobber
        } -ArgumentList $modulename
        return $responseObject | convertto-json
    }
`;

// Note: the `_isSystemDatabase` parameter is retained for signature backwards-compatibility with
// existing callers (none of which currently set it to `$true`). The optimized combined-query
// pipeline below no longer branches on system-vs-user databases. Remove the parameter once all
// call sites are confirmed to be passing `$false`.
const getMappedOntapVolumesScript = (
    fsxid: string,
    fsxregion: string,
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    _isSystemDatabase: string = '$false',
    instances: string[] = [],
    sqlAuthEnabled: boolean = false,
    fields: string = '',
    includeLogVolumes: boolean = false,
    svmOntapUuid: string = '',
    instanceLevelFsxnIds: Record<string, object> = {},
    includeAoag: boolean = false
) => `
    #Get Mapped Ontap Volumes
    $WarningPreference     = 'SilentlyContinue'
    $ProgressPreference    = 'SilentlyContinue'
    $ErrorActionPreference = 'Continue'

    if ($null -eq $responseObject) {
        $responseObject = @{}
    }

    $LogFilesPath = 'C:\\cfn\\log'
    if (-not (Test-Path -LiteralPath $LogFilesPath -PathType Container)) {
        New-Item -Path $LogFilesPath -ItemType Directory -Force | Out-Null
    }

    $includeLogVolumes = [System.Convert]::ToBoolean('${includeLogVolumes}')
    $includeAoag       = [System.Convert]::ToBoolean('${includeAoag}')

    try {
        #Requires -Module AWS.Tools.SimpleSystemsManagement

        $FSxID                = '${fsxid}'
        $FSxRegion            = '${fsxregion}'
        $instances            = '${JSON.stringify(instances)}' | ConvertFrom-Json
        $additionalFields     = '${fields}'
        $svmOntapUuid         = '${svmOntapUuid}'
        $instanceLevelFsxnIds = '${JSON.stringify(instanceLevelFsxnIds)}' | ConvertFrom-Json

        # ---------- One-time machine / metadata lookups (cached) ----------
        $cs                  = Get-CimInstance -ClassName Win32_ComputerSystem
        $vcpus               = $cs.NumberOfLogicalProcessors
        $isPartOfDomain      = [bool]$cs.PartOfDomain
        $machineDomain       = $cs.Domain
        $computerName        = $env:COMPUTERNAME

        $sqlAuthEnabled                   = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
        $sqlCredentials                   = $null
        $isAtleastOneCredentialIsOfDomain = $false
        $ec2InstanceId                    = $null
        $instanceType                     = $null
        $connection                       = $null   # tri-state: $null = not yet probed

        if ($sqlAuthEnabled) {
            try {
                # Single IMDSv2 token + parallel-style minimal calls via Invoke-RestMethod (cheaper than Invoke-WebRequest).
                $token = Invoke-RestMethod -Method PUT -Uri 'http://169.254.169.254/latest/api/token' \`
                    -Headers @{ 'X-aws-ec2-metadata-token-ttl-seconds' = '60' } -TimeoutSec 3
                $imdsHeaders = @{ 'X-aws-ec2-metadata-token' = $token }

                $instanceType  = Invoke-RestMethod -Uri 'http://169.254.169.254/latest/meta-data/instance-type' -Headers $imdsHeaders -TimeoutSec 3
                $ec2InstanceId = Invoke-RestMethod -Uri 'http://169.254.169.254/latest/meta-data/instance-id'   -Headers $imdsHeaders -TimeoutSec 3
            } catch {
                Write-Information "IMDS lookup failed: $($_.Exception.Message)"
            }

            # Get-Module -ListAvailable scans the entire PSModulePath on disk and is slow.
            # Get-Module (loaded modules only) + a fast PSModulePath probe is much cheaper.
            $ssmInstallationPath = $null
            $loadedSsm = Get-Module -Name AWS.Tools.SimpleSystemsManagement -ErrorAction SilentlyContinue
            if ($loadedSsm) {
                $ssmInstallationPath = $loadedSsm.Path
            } else {
                foreach ($mp in ($env:PSModulePath -split ';')) {
                    if ([string]::IsNullOrEmpty($mp)) { continue }
                    $candidate = Join-Path $mp 'AWS.Tools.SimpleSystemsManagement'
                    if (Test-Path -LiteralPath $candidate) {
                        $ssmInstallationPath = $candidate
                        break
                    }
                }
            }

            if ($vcpus -ge 2 -and -not [string]::IsNullOrEmpty($ssmInstallationPath) -and -not [string]::IsNullOrEmpty($ec2InstanceId)) {
                try {
                    # Fast TCP probe (port 53) to internet host instead of ICMP Test-Connection
                    # (ICMP is often blocked or slow ~2-4s; TCP probe with 1s timeout is much faster).
                    $tcp = New-Object System.Net.Sockets.TcpClient
                    try {
                        $iar = $tcp.BeginConnect('${GOOGLE_DNS}', 53, $null, $null)
                        $connection = $iar.AsyncWaitHandle.WaitOne(1000) -and $tcp.Connected
                        if ($connection) { $tcp.EndConnect($iar) | Out-Null }
                    } catch {
                        $connection = $false
                    } finally {
                        $tcp.Close()
                    }

                    if (-not $connection) {
                        Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\' \`
                            -Name State -Value 146944 -Force | Out-Null
                    }

                    $sqlCredentials = ((Get-SSMParameter -WithDecryption 1 -Name "/netapp/wlmdb/$ec2InstanceId").Value | ConvertFrom-Json)
                    $isAtleastOneCredentialIsOfDomain = ($sqlCredentials.domain.Count -gt 0)
                } catch {
                    $sqlCredentials = $null
                }
            }
        }

        # ---------- Build per-instance credential objects (no network calls) ----------
        $sqlInstances = foreach ($serverInstanceName in $instances) {
            $executableInstance = if ($serverInstanceName -ne 'MSSQLSERVER') { "$computerName\\$serverInstanceName" } else { $computerName }

            $credential   = $null
            $sqlCredential = @{}
            if ($null -ne $sqlCredentials) {
                $credential = $sqlCredentials.domain.Where({ $_.sqlinstancename -eq $serverInstanceName -or $_.sqlinstancename.ToUpper() -eq 'MSSQLSERVER' }, 'First', 1)
                $credential = if ($credential) { $credential[0] } else { $null }

                if ($credential -and -not [string]::IsNullOrEmpty($credential.username) -and -not [string]::IsNullOrEmpty($credential.password)) {
                    $sqlCredential['useDomainAuth'] = $true
                    $sqlCredential['username']      = $credential.username
                    $sqlCredential['password']      = $credential.password
                } else {
                    $sqlCredential['useDomainAuth'] = $false
                    $credential = $sqlCredentials.sql.Where({ $_.sqlinstancename -eq $serverInstanceName }, 'First', 1)
                    $credential = if ($credential) { $credential[0] } else { $null }
                    if ($credential -and -not [string]::IsNullOrEmpty($credential.username) -and -not [string]::IsNullOrEmpty($credential.password)) {
                        $sqlCredential['useSqlAuth'] = $true
                        $sqlCredential['username']   = $credential.username
                        $sqlCredential['password']   = $credential.password
                    } else {
                        $sqlCredential['useSqlAuth'] = $false
                    }
                }
            } else {
                $sqlCredential['useDomainAuth'] = $false
                $sqlCredential['useSqlAuth']    = $false
            }

            [pscustomobject]@{
                sqlCredential      = $sqlCredential
                executableInstance = $executableInstance
                serverInstanceName = $serverInstanceName
            }
        }

        # ---------- TLS / certificate setup (done once, NOT per-instance) ----------
        # Use ServerCertificateValidationCallback (faster, no Add-Type roundtrip if already set).
        if (-not ('TrustAllCertsPolicy' -as [type])) {
            Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) { return true; }
}
"@
        }
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        # If upstream already determined connectivity, don't re-probe.
        if ($null -eq $connection) {
            $tcp = New-Object System.Net.Sockets.TcpClient
            try {
                $certHost = $(if ($FSxRegion -like 'us-gov-*') { 'fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com' } else { 'fsx-aws-certificates.s3.amazonaws.com' })
                $iar = $tcp.BeginConnect($certHost, 443, $null, $null)
                $connection = $iar.AsyncWaitHandle.WaitOne(1500) -and $tcp.Connected
                if ($connection) { $tcp.EndConnect($iar) | Out-Null }
            } catch {
                $connection = $false
            } finally {
                $tcp.Close()
            }
            if (-not $connection) {
                Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\' \`
                    -Name State -Value 146944 -Force | Out-Null
            }
        }

        $isprivatesubnet = -not $connection
        $regionCertificate = $null
        if (-not $isprivatesubnet) {
            try {
                $certHost = $(if ($FSxRegion -like 'us-gov-*') { 'fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com' } else { 'fsx-aws-Certificates.s3.amazonaws.com' })
                $FSxCertificateUri = "https://$certHost/bundle-$FSxRegion.pem"
                # Stream cert into memory then write a temp file for Import-Certificate (avoids Invoke-WebRequest progress overhead)
                $tempCertFile = [System.IO.Path]::GetTempFileName()
                Invoke-WebRequest -Uri $FSxCertificateUri -OutFile $tempCertFile -UseBasicParsing
                $importedCert = Import-Certificate -FilePath $tempCertFile -CertStoreLocation Cert:\\LocalMachine\\Root
                # The imported cert IS the cert we want; no need to re-enumerate the entire root store.
                $regionCertificate = $importedCert
                Remove-Item -LiteralPath $tempCertFile -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Information "Certificate import failed: $($_.Exception.Message)"
            }
        }

        # ---------- Functions defined ONCE outside the per-instance loop ----------

        Function Invoke-ONTAPRequest {
            param(
                [Parameter(Mandatory = $true)]
                [string]$ApiEndpoint,
                [string]$ApiQueryFilter = '',
                [string]$ApiQueryFields = '',
                [string]$method         = 'GET',
                [string]$body,
                [string]$FSxCredentialsInBase64 = $FSxCredentialsInBase64,
                [string]$FSxHostName            = $FSxHostName
            )

            Write-Information "Invoke ONTAP rest request $ApiEndpoint $ApiQueryFilter $ApiQueryFields $method $body"

            $sb = [System.Text.StringBuilder]::new(128)
            [void]$sb.Append('https://').Append($FSxHostName).Append('/api').Append($ApiEndpoint)
            $hasFilter = -not [string]::IsNullOrEmpty($ApiQueryFilter)
            $hasFields = -not [string]::IsNullOrEmpty($ApiQueryFields)
            if ($hasFilter -or $hasFields) { [void]$sb.Append('?') }
            if ($hasFilter) { [void]$sb.Append($ApiQueryFilter) }
            if ($hasFilter -and $hasFields) { [void]$sb.Append('&') }
            if ($hasFields) { [void]$sb.Append($ApiQueryFields) }

            $Params = @{
                URI         = $sb.ToString()
                Method      = $method
                Headers     = @{ Authorization = "Basic $FSxCredentialsInBase64" }
                ContentType = 'application/json'
            }
            if (-not [string]::IsNullOrEmpty($body)) { $Params['Body'] = $body }

            if (-not $isprivatesubnet -and $null -ne $regionCertificate) {
                return Invoke-RestMethod @Params -Certificate $regionCertificate
            }
            return Invoke-RestMethod @Params
        }

        Function Is-CredSSPEnabled {
            try {
                $credsspStatus = Get-WSManCredSSP
                return ($credsspStatus -match 'The machine is configured to allow delegating fresh credentials')
            } catch {
                Write-Information "Error checking CredSSP status: $($_.Exception.Message)"
                return $false
            }
        }

        Function Enable-CredSSP {
            if (Is-CredSSPEnabled) { return }
            try {
                $ServerName = if ($script:isPartOfDomain) { "*.$script:machineDomain" } else { '*' }
                Start-Transcript -Path 'C:\\cfn\\log\\EnableCredSSP-ManageOps.txt' -Append | Out-Null
                Enable-WSManCredSSP -Role Client -DelegateComputer $ServerName -Force | Out-Null
                Enable-WSManCredSSP -Role Server -Force | Out-Null

                $parentkey = 'hklm:\\SOFTWARE\\Policies\\Microsoft\\Windows'
                $key       = "$parentkey\\CredentialsDelegation"
                $freshkey  = "$key\\AllowFreshCredentials"
                $ntlmkey   = "$key\\AllowFreshCredentialsWhenNTLMOnly"
                New-Item -Path $parentkey -Name 'CredentialsDelegation' -Force | Out-Null
                New-Item -Path $key -Name 'AllowFreshCredentials' -Force | Out-Null
                New-Item -Path $key -Name 'AllowFreshCredentialsWhenNTLMOnly' -Force | Out-Null
                New-ItemProperty -Path $key -Name AllowFreshCredentials -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFresh -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name AllowFreshCredentialsWhenNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $key -Name ConcatenateDefaults_AllowFreshNTLMOnly -Value 1 -PropertyType Dword -Force | Out-Null
                New-ItemProperty -Path $freshkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null
                New-ItemProperty -Path $ntlmkey -Name 1 -Value "WSMAN/$ServerName" -PropertyType String -Force | Out-Null

                if (-not (Is-CredSSPEnabled)) { throw 'Failed to enable CredSSP.' }
            } catch {
                Write-Error "Error enabling CredSSP: $($_.Exception.Message)"
            }
        }

        Function Invoke-CommandWithCredSSP {
            param (
                [Parameter(Mandatory = $true)]
                [string]$sqlquery,
                [string]$instanceName,
                [string]$extraArguments,
                [boolean]$IsMultiQuery = $false
            )

            if ($null -eq $extraArguments) { $extraArguments = '' }
            if ($instanceName) { $serverInstanceName = $instanceName }

            $securePassword = ConvertTo-SecureString -String $sqlCredential.password -AsPlainText -Force
            $Credential     = New-Object Management.Automation.PSCredential ($sqlCredential.username, $securePassword)

            $scriptblock = {
                param ($sqlquery, $extraArguments)
                Sqlcmd -S $using:serverInstanceName -Q $sqlquery -y 0 $extraArguments 2> $null
            }

            $output = Invoke-Command -ScriptBlock $scriptblock -ArgumentList $sqlquery, $extraArguments \`
                -Credential $Credential -ComputerName $env:computername -Authentication credssp -ErrorAction Stop

            if ($IsMultiQuery) {
                return $output | ForEach-Object { ($_ -split '\\s{2,}')[-1] }
            }
            return $output
        }

        Function Get-FSxNDetails {
            param([string]$fsxId = $FSxID)
            Write-Debug "fsxId to get ontap creds: $fsxId"
            $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$fsxId" -WithDecryption $true).Value | Out-String | ConvertFrom-Json
            $FSxUserName = $SsmParameter.fsx.username
            $FSxPassword = $SsmParameter.fsx.password
            $FSxPasswordSecureString = ConvertTo-SecureString $FSxPassword -AsPlainText -Force
            $FSxCredentials          = New-Object System.Management.Automation.PSCredential($FSxUserName, $FSxPasswordSecureString)
            $FSxCredentialsInBase64  = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
            $FSxHostName             = "management.$fsxId.fsx.$FSxRegion.amazonaws.com"
            $FSxIPUsed               = $false
            try {
                $req = [System.Net.WebRequest]::Create("https://$FSxHostName")
                $req.Timeout = 5000
                $resp = $req.GetResponse()
                $resp.Close()
            } catch {
                Write-Information "FSxNHTTP_Response: $($_.Exception.Message)"
                if ($_.Exception.Message -like '*remote server returned an error*') {
                    Write-Information 'Server connection works, returned error for 0 arguments'
                } else {
                    Write-Information "FSxN Management domain $FSxHostName is not resolved. Switching to management IP."
                    $FileSystemDetails = Get-FSXFileSystem -FileSystemId $fsxId
                    $FSxHostName = $FileSystemDetails.ontapconfiguration.Endpoints.Management.IpAddresses
                    if ($FSxHostName -is [array]) { $FSxHostName = $FSxHostName[0] }
                    $FSxIPUsed = $true
                }
            }
            return @{
                FSxCredentialsInBase64 = $FSxCredentialsInBase64
                FSxHostName            = $FSxHostName
                FSxCredentials         = $FSxCredentials
                FSxIPUsed              = $FSxIPUsed
            }
        }

        Function Get-VolumeIdsList($sqlJsonResponse) {
            $seen      = New-Object 'System.Collections.Generic.HashSet[string]'
            $volumeIds = New-Object 'System.Collections.Generic.List[string]'
            foreach ($record in $sqlJsonResponse) {
                $vid = $record.volumeId
                if ($null -eq $vid) { continue }
                $cleanVolumeId = $vid.Replace(' ', '').Replace("\`r", '').Replace("\`n", '')
                if ($seen.Add($cleanVolumeId)) { $volumeIds.Add($cleanVolumeId) }
            }
            return $volumeIds
        }

        Function Get-SerialNumberOfWinVolumes($winvolumes) {
            try {
                $VolumeSerialMapping = @{}
                $Lunserialnumbers    = New-Object 'System.Collections.Generic.List[object]'
                $BusTypes            = New-Object 'System.Collections.Generic.List[object]'

                # Single Get-Disk call cached as Number -> object hashtable.
                $allDisks      = Get-Disk | Select-Object SerialNumber, Number, BusType
                $diskByNumber  = @{}
                foreach ($d in $allDisks) { $diskByNumber[[int]$d.Number] = $d }

                # Single Get-Partition call (much faster than Get-Volume | Get-Partition per-volume),
                # cached as AccessPath -> partition. AccessPaths include drive letters and mount points.
                $partitionByAccessPath = @{}
                foreach ($p in (Get-Partition | Where-Object { $_.AccessPaths })) {
                    foreach ($ap in $p.AccessPaths) {
                        if (-not [string]::IsNullOrEmpty($ap)) {
                            $partitionByAccessPath[$ap] = $p
                        }
                    }
                }

                foreach ($volumeid in $winvolumes) {
                    if ($null -eq $volumeid) {
                        Write-Debug 'Skipping volume with null volumeid'
                        continue
                    }

                    $part = $partitionByAccessPath[$volumeid]
                    if ($null -eq $part) {
                        # Fallback: original (slower) lookup path if the access-path index missed.
                        $part = Get-Volume -Path $volumeid -ErrorAction SilentlyContinue | Get-Partition -ErrorAction SilentlyContinue | Select-Object -First 1
                    }

                    $disk = $null
                    if ($null -ne $part -and $diskByNumber.ContainsKey([int]$part.DiskNumber)) {
                        $disk = $diskByNumber[[int]$part.DiskNumber]
                    }
                    $serialNumber = if ($null -ne $disk) { $disk.SerialNumber } else { $null }
                    $BusType      = if ($null -ne $disk) { $disk.BusType }      else { $null }

                    $VolumeSerialMapping[$volumeid] = $serialNumber
                    $Lunserialnumbers.Add($serialNumber)
                    $BusTypes.Add($BusType)
                }

                $filteredLunSerials = $Lunserialnumbers | Where-Object { $null -ne $_ -and -not $_.StartsWith('vol') } | Select-Object -Unique
                if (($null -eq $filteredLunSerials -or @($filteredLunSerials).Count -eq 0) -and $BusTypes.Count -gt 0 -and $BusTypes -notcontains 'iSCSI') {
                    throw 'We support only iSCSI volumes'
                }

                return @{
                    Lunserialnumbers    = $filteredLunSerials
                    VolumeSerialMapping = $VolumeSerialMapping
                }
            } catch {
                throw "An error occurred while getting the serial numbers of Windows volumes: $_"
            }
        }

        Function Get-LunFromSerialNumber($SerialNumbers, $VolumeSerialMapping) {
            Write-Debug "Get ONTAP lun name from serial numbers for: $VolumeSerialMapping"

            $sb = [System.Text.StringBuilder]::new(256)
            foreach ($SerialNumber in $SerialNumbers) {
                if ($SerialNumber -ne '') {
                    if ($sb.Length -gt 0) { [void]$sb.Append('|') }
                    [void]$sb.Append([System.Web.HttpUtility]::UrlEncode($SerialNumber))
                }
            }
            $QueryFilter = $sb.ToString()
            if ($svmOntapUuid -ne '') { $QueryFilter += "&svm.uuid=$svmOntapUuid" }

            $LunNamesList         = New-Object 'System.Collections.Generic.List[string]'
            $VolumeLunMapping     = @{}
            $VolumeLunUuidMapping = @{}
            $LunDetails           = New-Object 'System.Collections.Generic.List[object]'

            if ($QueryFilter -ne '') {
                $Params = @{
                    ApiEndPoint            = '/storage/luns'
                    ApiQueryFilter         = "serial_number=$QueryFilter"
                    FSxCredentialsInBase64 = $visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64
                    FSxHostName            = $visitedFilesystems.$instanceLevelFsxnId.FSxHostName
                }
                $Response   = Invoke-ONTAPRequest @Params
                $LunRecords = $Response.records

                Write-Debug "Lun Records Mapping: $($LunRecords | ConvertTo-Json)"

                $volumeIdsBySerial = @{}
                foreach ($volumeId in $VolumeSerialMapping.Keys) {
                    $serial = $VolumeSerialMapping[$volumeId]
                    if ($null -eq $serial) { continue }
                    $list = $volumeIdsBySerial[$serial]
                    if ($null -eq $list) {
                        $list = New-Object 'System.Collections.Generic.List[object]'
                        $volumeIdsBySerial[$serial] = $list
                    }
                    $list.Add($volumeId)
                }

                foreach ($record in $LunRecords) {
                    $LunNamesList.Add($record.name)
                    $LunDetails.Add(@{
                        uuid          = $record.uuid
                        name          = $record.name
                        serial_number = $record.serial_number
                    })
                    $matchingVolumes = $volumeIdsBySerial[$record.serial_number]
                    if ($null -ne $matchingVolumes) {
                        $lunName = $record.name -replace '^\\/vol\\/(.*?)\\/.*$', '$1'
                        $uuid    = $record.uuid
                        foreach ($volumeId in $matchingVolumes) {
                            $VolumeLunMapping[$volumeId]     = $lunName
                            $VolumeLunUuidMapping[$volumeId] = $uuid
                        }
                    }
                }
            }
            [string[]]$LunNames = $LunNamesList.ToArray()
            Write-Debug "Lun volume Mapping: $($VolumeLunMapping | ConvertTo-Json)"
            Write-Debug "Lun volume Uuid Mapping: $($VolumeLunUuidMapping | ConvertTo-Json)"
            Write-Debug "Lun names: $LunNames"
            return @{
                LunNames             = $LunNames
                VolumeLunMapping     = $VolumeLunMapping
                VolumeLunUuidMapping = $VolumeLunUuidMapping
                LunDetails           = $LunDetails
            }
        }

        Function Get-VolumeIdFromName($Names, $volumeLunMapping) {
            Write-Debug "Get Volume Id from name: $Names"

            $sb = [System.Text.StringBuilder]::new(256)
            foreach ($Name in $Names) {
                if ($Name -ne '') {
                    if ($sb.Length -gt 0) { [void]$sb.Append('|') }
                    [void]$sb.Append([System.Web.HttpUtility]::UrlEncode($Name))
                }
            }
            $QueryFilter = $sb.ToString()

            $svmUuid = $instanceLevelFsxnIds.$serverInstanceName.svmUuid
            if (-not [string]::IsNullOrEmpty($svmUuid)) {
                $QueryFilter += "&svm.uuid=$svmUuid"
            } elseif ($svmOntapUuid -ne '') {
                $QueryFilter += "&svm.uuid=$svmOntapUuid"
            }

            $VolumeNameMapping = @{}
            $Response          = $null

            if ($QueryFilter -ne '') {
                $Params = @{
                    ApiEndPoint            = '/storage/volumes'
                    ApiQueryFilter         = "name=$QueryFilter&fields=snapshot_count,$additionalFields"
                    FSxCredentialsInBase64 = $visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64
                    FSxHostName            = $visitedFilesystems.$instanceLevelFsxnId.FSxHostName
                }
                $Response = Invoke-ONTAPRequest @Params

                $volumeIdsByLunName = @{}
                foreach ($volumeId in $VolumeLunMapping.Keys) {
                    $lunName = $VolumeLunMapping[$volumeId]
                    if ($null -eq $lunName) { continue }
                    $list = $volumeIdsByLunName[$lunName]
                    if ($null -eq $list) {
                        $list = New-Object 'System.Collections.Generic.List[object]'
                        $volumeIdsByLunName[$lunName] = $list
                    }
                    $list.Add($volumeId)
                }

                foreach ($record in $Response.records) {
                    $matching = $volumeIdsByLunName[$record.name]
                    if ($null -ne $matching) {
                        $value = @{ uuid = $record.uuid; name = $record.name }
                        foreach ($volumeId in $matching) {
                            $VolumeNameMapping[$volumeId] = $value
                        }
                    }
                }
            }
            Write-Debug "final Mapping: $($VolumeLunMapping | ConvertTo-Json)"

            return @{
                Response          = $Response
                volumeNameMapping = $VolumeNameMapping
            }
        }

        Function GetSMBVolumes {
            param(
                [Parameter(Mandatory = $true)]
                [string[]]$sqlresponse
            )

            $SmbShares = $sqlresponse | ConvertFrom-Json

            $sb = [System.Text.StringBuilder]::new(256)
            foreach ($SmbShare in $SmbShares) {
                $volname = $SmbShare.volumename
                if ($volname -ne '') {
                    if ($sb.Length -gt 0) { [void]$sb.Append('|') }
                    [void]$sb.Append([System.Web.HttpUtility]::UrlEncode($volname))
                }
            }
            $QueryFilter = $sb.ToString()

            $volumeIds = New-Object 'System.Collections.Generic.List[object]'
            if ($QueryFilter -ne '') {
                $Params = @{
                    ApiEndPoint            = '/protocols/cifs/shares'
                    ApiQueryFilter         = "name=$QueryFilter&fields=volume"
                    FSxCredentialsInBase64 = $visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64
                    FSxHostName            = $visitedFilesystems.$instanceLevelFsxnId.FSxHostName
                }
                $cifsShares  = Invoke-ONTAPRequest @Params
                $cifsRecords = $cifsShares.records

                foreach ($record in $cifsRecords) {
                    $volumeIds.Add([pscustomobject]@{ uuid = $record.volume.uuid })
                }
            }
            if ($volumeIds.Count -eq 1) { return @(, $volumeIds.ToArray()) }
            return $volumeIds.ToArray()
        }

        Function updateVolumeMappings($sqlJsonResponse, $volumeNameMapping, $volumeLunUuidMapping) {
            try {
                $groupedEntries  = [ordered]@{}
                $dataLunSetByKey = @{}
                $logLunSetByKey  = @{}

                foreach ($dbMapping in $sqlJsonResponse) {
                    $rawVolumeId = $dbMapping.VolumeId
                    if ($null -eq $rawVolumeId) { continue }
                    $volumeId = ($rawVolumeId -replace "\`r", '' -replace "\`n", '').Replace(' ', '')

                    if ($null -ne $volumeNameMapping -and $volumeNameMapping.ContainsKey($volumeId)) {
                        $value           = $volumeNameMapping[$volumeId]
                        $rawDatabaseName = $dbMapping.DatabaseName
                        $databaseName    = if ($null -ne $rawDatabaseName) { $rawDatabaseName -replace "\`r", '' -replace "\`n", '' } else { $rawDatabaseName }
                        $ontapVolumeUuid = $value['uuid']
                        $groupKey        = "$databaseName|$ontapVolumeUuid"

                        if (-not $groupedEntries.Contains($groupKey)) {
                            $groupedEntries[$groupKey] = @{
                                databaseName    = $databaseName
                                ontapVolumeuuid = $ontapVolumeUuid
                                dataLunUuids    = New-Object 'System.Collections.Generic.List[string]'
                                logLunUuids     = New-Object 'System.Collections.Generic.List[string]'
                            }
                            $dataLunSetByKey[$groupKey] = New-Object 'System.Collections.Generic.HashSet[string]'
                            $logLunSetByKey[$groupKey]  = New-Object 'System.Collections.Generic.HashSet[string]'
                        }

                        $lunUuid = $null
                        if ($null -ne $volumeLunUuidMapping -and $volumeLunUuidMapping.ContainsKey($volumeId)) {
                            $lunUuid = $volumeLunUuidMapping[$volumeId]
                        }
                        if ([string]::IsNullOrEmpty($lunUuid)) { continue }

                        # FileType (sys.database_files / master_files type): 0 = ROWS (MDF/NDF), 1 = LOG (LDF).
                        # Other values (2 FILESTREAM, 4 FULLTEXT, etc.) are not mapped to data or log LUN lists.
                        $fileType = [int]$dbMapping.FileType
                        if ($fileType -eq 0) {
                            if ($dataLunSetByKey[$groupKey].Add($lunUuid)) {
                                $groupedEntries[$groupKey]['dataLunUuids'].Add($lunUuid)
                            }
                        } elseif ($fileType -eq 1) {
                            if ($logLunSetByKey[$groupKey].Add($lunUuid)) {
                                $groupedEntries[$groupKey]['logLunUuids'].Add($lunUuid)
                            }
                        }
                    }
                }

                $newArray = New-Object 'System.Collections.Generic.List[object]'
                foreach ($key in $groupedEntries.Keys) {
                    $entry = $groupedEntries[$key]
                    $newArray.Add(@{
                        databaseName    = $entry['databaseName']
                        ontapVolumeuuid = $entry['ontapVolumeuuid']
                        dataLunUuids    = @($entry['dataLunUuids'].ToArray())
                        logLunUuids     = @($entry['logLunUuids'].ToArray())
                    })
                }
                return $newArray.ToArray()
            } catch {
                Write-Debug "updateVolumeMappings failed: $($_.Exception.Message)"
                throw $_.Exception.Message
            }
        }

        Function Process-Records($inputObject) {
            $output = New-Object 'System.Collections.Generic.List[object]'
            if ($null -ne $inputObject.records) {
                foreach ($record in $inputObject.records) {
                    $props = @{}
                    foreach ($p in $record.PSObject.Properties) {
                        if ($p.Name -ne '_links') { $props[$p.Name] = $p.Value }
                    }
                    $output.Add([PSCustomObject]$props)
                }
            }
            return @{ records = $output.ToArray() }
        }

        Function Deflate-String([string]$stringToCompress) {
            if ([string]::IsNullOrEmpty($stringToCompress)) {
                Write-Information 'The string to compress is either null or empty.'
                return $null
            }

            $memoryStream  = New-Object System.IO.MemoryStream
            $deflateStream = New-Object System.IO.Compression.DeflateStream($memoryStream, [System.IO.Compression.CompressionMode]::Compress)
            $buffer        = [System.Text.Encoding]::UTF8.GetBytes($stringToCompress)
            $deflateStream.Write($buffer, 0, $buffer.Length)
            $deflateStream.Dispose()

            $bytes         = $memoryStream.ToArray()
            $memoryStream.Dispose()
            $encodedString = [Convert]::ToBase64String($bytes)
            if ($encodedString.Length -ge 24000) { return $stringToCompress }
            return $encodedString
        }

        $visitedFileSystems = @{}
        $instanceRespones   = @{}

        if ($isAtleastOneCredentialIsOfDomain) { Enable-CredSSP }

        foreach ($si in $sqlInstances) {
            try {
                $sqlCredential      = $si.sqlCredential
                $executableInstance = $si.executableInstance
                $serverInstanceName = $si.serverInstanceName

                $instanceLevelFsxnId = $instanceLevelFsxnIds.$serverInstanceName.fsxId
                Write-Debug "Instance Level FSxN Id: $instanceLevelFsxnId"
                if ([string]::IsNullOrEmpty($instanceLevelFsxnId)) { $instanceLevelFsxnId = $FSxID }

                if ($null -ne $instanceLevelFsxnId -and -not $visitedFileSystems.ContainsKey($instanceLevelFsxnId)) {
                    $FSxNDetails = Get-FSxNDetails -fsxId $instanceLevelFsxnId
                    $visitedFileSystems[$instanceLevelFsxnId] = @{
                        FSxCredentialsInBase64 = $FSxNDetails.FSxCredentialsInBase64
                        FSxHostName            = $FSxNDetails.FSxHostName
                    }
                }

                # ---------- Build inner SELECT fragments (chosen once per loop) ----------
                if ($includeLogVolumes) {
                    $volumeListInnerSelect = @"
SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                            WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) ${SQL_CASE_INSENSITIVE} != 'TEMPDB'
                            FOR JSON PATH
"@
                    $databaseVolumeMapInnerSelect = @"
SELECT DISTINCT
                            DB_NAME(mf.database_id) AS DatabaseName,
                            vs.logical_volume_name as VolumeName,
                            vs.volume_id as VolumeId,
                            mf.type as FileType,
                            vs.volume_mount_point as MountPoint
                        FROM
                            sys.master_files AS mf
                        CROSS APPLY
                            sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE
                            vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        FOR JSON PATH
"@
                } else {
                    $volumeListInnerSelect = @"
SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                        CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) ${SQL_CASE_INSENSITIVE} = 'MDF'
                        AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) ${SQL_CASE_INSENSITIVE} != 'TEMPDB'
                        FOR JSON PATH
"@
                    $databaseVolumeMapInnerSelect = @"
SELECT DISTINCT
                            DB_NAME(mf.database_id) AS DatabaseName,
                            vs.logical_volume_name as VolumeName,
                            vs.volume_id as VolumeId,
                            mf.type as FileType,
                            vs.volume_mount_point as MountPoint
                        FROM
                            sys.master_files AS mf
                        CROSS APPLY
                            sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE
                            vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        FOR JSON PATH
"@
                }

                if ($includeAoag) {
                    $databasesInnerSelect = @"
SELECT
            databaseId = d.database_id,
            databaseName = d.name,
            creationDate = d.create_date,
            databaseStatus = d.state_desc,
            databaseSize = t.databaseSize,
            collationName = d.collation_name,
            availabilityGroup = ag.name,
            replicaRole = ars.role_desc,
            synchronizationState = drs.synchronization_state_desc,
            isReadableSecondary = CASE WHEN ar.secondary_role_allow_connections > 0 THEN 1 ELSE 0 END
            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))
            FROM sys.master_files GROUP BY database_id ) t
            JOIN sys.databases d ON d.database_id = t.database_id
LEFT JOIN sys.dm_hadr_database_replica_states drs ON drs.database_id = d.database_id AND drs.is_local = 1
LEFT JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
LEFT JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = drs.replica_id AND ars.is_local = 1
LEFT JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
            ORDER BY d.name
            FOR JSON PATH
"@
                } else {
                    $databasesInnerSelect = @"
SELECT
            databaseId = d.database_id,
            databaseName = d.name,
            creationDate = d.create_date,
            databaseStatus = d.state_desc,
            databaseSize = t.databaseSize,
            collationName = d.collation_name
            FROM ( SELECT database_id, logSize = CAST(SUM(CASE WHEN [type] = 1 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            rowSize = CAST(SUM(CASE WHEN [type] = 0 THEN size END) * 8. * 1024 AS DECIMAL(18,2)),
            databaseSize = CAST(SUM(size) * 8. * 1024 AS DECIMAL(18,2))
            FROM sys.master_files GROUP BY database_id ) t
            JOIN sys.databases d ON d.database_id = t.database_id
            ORDER BY d.name
            FOR JSON PATH
"@
                }

                $backupsInnerSelect = @"
SELECT
    DISTINCT backupset.database_name as backedupDatabases
    FROM msdb.dbo.backupset AS backupset
    INNER JOIN msdb.dbo.backupmediafamily AS backupmedia
    ON backupset.media_set_id = backupmedia.media_set_id
    WHERE backupmedia.device_type = 2
    AND backupset.type ${SQL_CASE_INSENSITIVE} = 'D' FOR JSON PATH
"@

                $combinedSqlQuery = @"
SET NOCOUNT ON;
DECLARE @VolumeList nvarchar(max) = ($volumeListInnerSelect);
DECLARE @DatabaseVolumeMap nvarchar(max) = ($databaseVolumeMapInnerSelect);
DECLARE @Databases nvarchar(max) = ($databasesInnerSelect);
DECLARE @BackedUpDatabases nvarchar(max) = ($backupsInnerSelect);
SELECT (SELECT
    JSON_QUERY(ISNULL(@VolumeList, N'[]')) AS volumeList,
    JSON_QUERY(ISNULL(@DatabaseVolumeMap, N'[]')) AS databaseVolumeMap,
    JSON_QUERY(ISNULL(@Databases, N'[]')) AS databases,
    JSON_QUERY(ISNULL(@BackedUpDatabases, N'[]')) AS backedUpDatabases
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
"@

                $MappedVolumesErrorFile = "C:\\cfn\\log\\mapped_volumes_err_\${serverInstanceName}_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()).log"
                if ($sqlCredential.useDomainAuth -eq $true) {
                    $combinedResponse = Invoke-CommandWithCredSSP -sqlquery $combinedSqlQuery -instanceName $executableInstance -extraArguments -r1
                } elseif ($sqlCredential.useSqlAuth -eq $true) {
                    $combinedResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $executableInstance -Q $combinedSqlQuery -y 0 -r1 2>&1
                } else {
                    $combinedResponse = sqlcmd -S $executableInstance -Q $combinedSqlQuery -y 0 -r1 2>&1
                }

                if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
                    $combinedResponse | Out-File -FilePath $MappedVolumesErrorFile
                    throw $combinedResponse
                }

                if (-not ($combinedResponse.Count -gt 0)) {
                    throw "Couldn't get database windows volumes"
                }

                $combinedParsed = $null
                try {
                    $combinedParsed = ($combinedResponse -join '') | ConvertFrom-Json
                } catch {
                    $combinedResponse | Out-File -FilePath $MappedVolumesErrorFile
                    throw "Failed to parse combined SQL response: $($_.Exception.Message)"
                }

                # The volume list is consumed by GetSMBVolumes which immediately ConvertFrom-Jsons
                # its input. Re-serialize once with minimal depth so the contract is preserved.
                $volumeListArray = if ($null -ne $combinedParsed.volumeList) { @($combinedParsed.volumeList) } else { @() }
                $sqlresponse     = $volumeListArray | ConvertTo-Json -Compress -Depth 5
                if ([string]::IsNullOrEmpty($sqlresponse)) { $sqlresponse = '[]' }

                $sqlJsonResponseParsed = if ($null -ne $combinedParsed.databaseVolumeMap) { @($combinedParsed.databaseVolumeMap) } else { @() }

                # Failures fetching $databasesSummary / $sqlNativeBackupEnabledDatabases must not
                # abort the volume mapping flow; downstream consumers treat empty arrays as
                # "no data available".
                $databasesSummary = @()
                try {
                    if ($null -ne $combinedParsed.databases) { $databasesSummary = @($combinedParsed.databases) }
                } catch {
                    Write-Information "Failed to read databases summary for $serverInstanceName : $($_.Exception.Message)"
                }

                $sqlNativeBackupEnabledDatabases = @()
                try {
                    if ($null -ne $combinedParsed.backedUpDatabases) { $sqlNativeBackupEnabledDatabases = @($combinedParsed.backedUpDatabases) }
                } catch {
                    Write-Information "Failed to read native SQL backup status for $serverInstanceName : $($_.Exception.Message)"
                }

                $volumeIds = Get-VolumeIdsList $sqlJsonResponseParsed
                Write-Debug "volume List: $volumeIds"

                $result        = Get-SerialNumberOfWinVolumes $volumeIds
                $SerialNumbers = $result.Lunserialnumbers

                Write-Debug "Serial Numbers: $SerialNumbers"
                Write-Debug "Volume Serial Mapping: $($result.VolumeSerialMapping | ConvertTo-Json)"

                $lunResult        = Get-LunFromSerialNumber $SerialNumbers $result.VolumeSerialMapping
                $VolumeNames      = $lunResult.LunNames
                $volumeLunMapping = $lunResult.VolumeLunMapping

                Write-Debug "Volume Names: $VolumeNames"
                Write-Debug "Volume Lun Mapping: $($volumeLunMapping | ConvertTo-Json)"

                if (-not ($VolumeNames.Count -gt 0)) {
                    throw "Couldn't get associated Ontap LUN volume names"
                }

                $volumeResult      = Get-VolumeIdFromName $VolumeNames $volumeLunMapping
                $volumes           = $volumeResult.Response
                $volumeNameMapping = $volumeResult.volumeNameMapping
                Write-Debug "Volume Ids: $($volumes | ConvertTo-Json)"
                Write-Debug "Volume Name mapping: $($volumeNameMapping | ConvertTo-Json)"

                $cifsVolumes = GetSMBVolumes $sqlresponse
                Write-Debug "CIFS Volumes:  $($cifsVolumes | ConvertTo-Json)"

                if ($cifsVolumes) {
                    if ($null -ne $volumes.records) {
                        $volumes['records'] += $cifsVolumes
                    } else {
                        $volumes = @{ records = $cifsVolumes }
                    }
                }

                $processedRecords = Process-Records $volumes
                Write-Debug "Processed volumes:  $($processedRecords | ConvertTo-Json)"

                # VolumeId -> MountPoint, single pass over the parsed SQL response.
                $volumeMountPointMapping = @{}
                foreach ($row in $sqlJsonResponseParsed) {
                    $rowVolumeId = $row.VolumeId
                    if ($null -eq $rowVolumeId) { continue }
                    $rowVolumeId = ($rowVolumeId -replace "\`r", '' -replace "\`n", '').Replace(' ', '')
                    if ($volumeMountPointMapping.ContainsKey($rowVolumeId)) { continue }
                    $rowMountPoint = $row.MountPoint
                    if ($null -ne $rowMountPoint) { $rowMountPoint = $rowMountPoint -replace "\`r", '' -replace "\`n", '' }
                    $volumeMountPointMapping[$rowVolumeId] = $rowMountPoint
                }

                # Build serial -> (driveLetter, ontapVolumeuuid) once.
                $enrichmentBySerial = @{}
                foreach ($volId in $result.VolumeSerialMapping.Keys) {
                    $sn = $result.VolumeSerialMapping[$volId]
                    if ($null -eq $sn) { continue }
                    $e = $enrichmentBySerial[$sn]
                    if ($null -eq $e) {
                        $e = @{ driveLetter = ''; ontapVolumeuuid = '' }
                        $enrichmentBySerial[$sn] = $e
                    }
                    if ([string]::IsNullOrEmpty($e['driveLetter']) -and $volumeMountPointMapping.ContainsKey($volId)) {
                        $e['driveLetter'] = $volumeMountPointMapping[$volId]
                    }
                    if ([string]::IsNullOrEmpty($e['ontapVolumeuuid']) -and $null -ne $volumeNameMapping -and $volumeNameMapping.ContainsKey($volId)) {
                        $e['ontapVolumeuuid'] = $volumeNameMapping[$volId]['uuid']
                    }
                }
                $enrichedLunDetailsList = New-Object 'System.Collections.Generic.List[object]'
                foreach ($lunEntry in $lunResult.LunDetails) {
                    $e = $enrichmentBySerial[$lunEntry.serial_number]
                    $enrichedLunDetailsList.Add(@{
                        uuid            = $lunEntry.uuid
                        name            = $lunEntry.name
                        serial_number   = $lunEntry.serial_number
                        driveLetter     = if ($null -ne $e) { $e['driveLetter'] }     else { '' }
                        ontapVolumeuuid = if ($null -ne $e) { $e['ontapVolumeuuid'] } else { '' }
                    })
                }
                $enrichedLunDetails = $enrichedLunDetailsList.ToArray()

                $volumeDBMap = updateVolumeMappings $sqlJsonResponseParsed $volumeNameMapping $lunResult.VolumeLunUuidMapping
                Write-Debug "final volume details: $($volumeDBMap | ConvertTo-Json)"

                $instanceResponse = @{
                    volumes                         = $processedRecords
                    volumeDBMap                     = $volumeDBMap
                    luns                            = $enrichedLunDetails
                    databasesSummary                = $databasesSummary
                    sqlNativeBackupEnabledDatabases = $sqlNativeBackupEnabledDatabases
                }
                $instanceRespones[$serverInstanceName] = $instanceResponse
            } catch {
                Write-Information "An error occurred while processing the records: $_.Exception.Message"
                $instanceRespones[$serverInstanceName] = "error: $_"
            }
        }

        # disableCredSSP is removed as most of machines will be part of domain and we are enabling CredSSP at domain level.
        $response = $instanceRespones | ConvertTo-Json -Depth 10 -Compress

        if ([string]::IsNullOrEmpty($response)) {
            throw "Failed to compress the response because the response is either null or empty. $response"
        }

        return (Deflate-String $response)
    } catch {
        return $_.Exception.Message
    }
`;

const restGetUtilForOntap = (
    fsxid: string,
    fsxregion: string,
    apiEndpoint: string,
    apiQueryFilter: string,
    apiQueryFields: string
) => `
    $WarningPreference = 'SilentlyContinue';
    $ProgressPreference = 'SilentlyContinue'
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    try {
        #Requires -Module AWS.Tools.SimpleSystemsManagement

        $FSxID = '${fsxid}'
        $FSxRegion = '${fsxregion}'
        $APIEndpoint = '${apiEndpoint}'
        $APIQueryFilter = '${apiQueryFilter}'
        $ApiQueryFields = '${apiQueryFields}'

        ${ontapRestRequest}
     
        $responseObject = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
    } catch {
        $responseObject = @{
            error = $_.Exception.Message
        }
    }
    $response = $responseObject | ConvertTo-Json -Depth 5

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    ${compressResponse}
    return (Deflate-String $response)
`;
// prettier-ignore
const INSTANCE_DETAILS = 'Get-WmiObject win32_service | Where-Object {$_.DisplayName -like "sql server (*)"} | Select-Object @{Name=\'instanceName\'; Expression={$_.Name}}, @{Name=\'instanceState\'; Expression={$_.State}} | ConvertTo-Json -Compress';

const copyPowerShellModule = (s3SignedURL: string, modules: string) => `
    $ProgressPreference = 'SilentlyContinue'
    $s3SignedUrl = '${s3SignedURL}'
    $moduleNames = ${modules}

    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    $destinationPath = "C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules\\"


    # Check if any module is not installed
    function Check-ModuleInstalled {
        param(
            [Parameter(Mandatory=$true)]
            [string[]]$moduleNames
        )

        foreach ($module in $moduleNames) {
            if (-not (Get-Module -ListAvailable -Name $module)) { return $false }
        }
        return $true
    }

    # Call the function
    $allModulesInstalled = Check-ModuleInstalled -moduleNames $moduleNames

    if (-not $allModulesInstalled) {
        try {
            # Create modules folder if it doesn't exist
            if (-not (Test-Path $destinationPath)) {
                $null = New-Item -ItemType Directory -Path $destinationPath
            }
            
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $Null = Invoke-WebRequest -Uri $s3SignedUrl -OutFile "$Env:Temp\\aws_ssm.zip"
            $Null = Expand-Archive -Path "$Env:Temp\\aws_ssm.zip" -DestinationPath $Env:Temp -Force

            foreach ($module in @("AWS.Tools.Common", "AWS.Tools.SimpleSystemsManagement")) {
                $modulePath = "$destinationPath\\$module"
                if (-not (Test-Path -Path $modulePath)) {
                    $null = New-Item -ItemType Directory -Path $modulePath
                    $Null = Copy-Item -Path "$Env:Temp\\aws_ssm\\$module\\*" -Destination $modulePath -Recurse
                }
            }
            # Ensure the modules are available for use
            $allInstalled = Check-ModuleInstalled -moduleNames $moduleNames

            if (-not $allInstalled) {
                $responseObject.add('installStatus', "Few modules are not installed")
            } else {
                $responseObject.add('installStatus', "All modules are installed")
            }
        } catch {
            $responseObject['installFailure'] = $_.Exception.Message
        }
    } else {
        $responseObject['installStatus'] = "All modules are already installed"
    }
`;

const readSsmParameter = (instance: string) =>
    `
        $serverInstanceName = "${instance}"
        ${getSqlCredentials(true)}
        ${validateSQLInstanceCredentials}
    `;

// All the queries using the following template must respond in JSON format (use FOR JSON PATH), else the conversion will fail.
const sqlQueryExecution = (
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    query: string,
    sqlAuthEnabled: boolean
) =>
    `
    $query = "${query}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}

    ${slqcmdExecutionTemplate}
    
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }
    $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}"

    if([string]::IsNullOrEmpty($queryResponse)) {
        Write-Information "Failed to compress the response because the response is either null or empty. $queryResponse"
        return $queryResponse
    }
    $normalizedResponse = ($queryResponse -join "\`n")
    try {
        $queryResponse = $normalizedResponse | ConvertFrom-Json
    } catch {
        $preview = $normalizedResponse
        if ($preview.Length -gt 200) { $preview = $preview.Substring(0, 200) }
        throw "SQL query returned invalid JSON response. Response: $preview. Error: $($_.Exception.Message)"
    }
    $queryResponse = $queryResponse | ConvertTo-Json -Depth 5
    
    ${compressResponse}
    return (Deflate-String $queryResponse) 
`;

const slqcmdExecutionTemplate = `
Function Call-SqlCmd {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$SqlCredential,

        [Parameter(Mandatory = $true)]
        [string]$Query,

        [Parameter(Mandatory = $true)]
        [string]$InstanceName,

        [Parameter(Mandatory = $false)]
        [string]$ExtraArguments,

        [Parameter(Mandatory = $false)]
        [boolean]$IsMultiQuery = $False,

        # SuppressStderr: When $True, redirects stderr to $null (2> $null) to prevent sqlcmd errors
        # from being captured in SSM StandardErrorContent. Use this when you want SQL query failures
        # to be handled gracefully without blocking the entire SSM script execution.
        # Default is $False to preserve existing behavior for scripts that need error output.
        [Parameter(Mandatory = $false)]
        [boolean]$SuppressStderr = $False

    )
    $sqlresponse = $null
    if ($sqlCredential.useDomainAuth -eq $True) {
        ${enableCredSSP}
        ${invokeCommandWithCredSSP}
        Enable-CredSSP
        $sqlresponse = Invoke-CommandWithCredSSP -sqlquery $Query -instanceName $InstanceName -extraArguments $ExtraArguments -IsMultiQuery $IsMultiQuery;
        # disableCredSSP is removed as most of machines will be part of domain and we are enabling CredSSP at domain level.
    } elseif ($sqlCredential.useSqlAuth -eq $True) {
        if ([string]::IsNullOrEmpty($ExtraArguments)) {
            if ($SuppressStderr) {
                $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0 2> $null;
            } else {
                $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0;
            }
        }
        else {
            if ($SuppressStderr) {
                $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments 2> $null;
            } else {
                $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments;
            }
        }
    }

    # Fallback to native Windows auth (sqlcmd without credentials) when:
    # 1. SQL auth was attempted and failed ($LASTEXITCODE non-zero from sqlcmd)
    # 2. Domain auth (CredSSP) was attempted but returned no response — CredSSP may fail due to
    #    policy/config issues while plain Windows auth can still work for local SQL instances.
    #    We check $sqlresponse instead of $LASTEXITCODE because Invoke-Command (cmdlet) does not
    #    set $LASTEXITCODE, so it would be stale from earlier native commands like Enable-CredSSP.
    # 3. Neither auth type was configured — try Windows auth as the only option.
    if (($sqlCredential.useSqlAuth -eq $True -And $LASTEXITCODE -And $LASTEXITCODE -ne 0) -Or ($sqlCredential.useDomainAuth -eq $True -And [string]::IsNullOrEmpty($sqlresponse)) -Or ($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
        if ([string]::IsNullOrEmpty($ExtraArguments)) {
            if ($SuppressStderr) {
                $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0 2> $null;
            } else {
                $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0;
            }
        }
        else {
            if ($SuppressStderr) {
                $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments 2> $null;
            } else {
                $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments;
            }
        }
    }
    return $sqlresponse
}
`;

const CHECK_SCRIPT_AVAILABILITY_AND_VERSION = `
    $result = @{};
    $result['isCreatePossible'] = $False;
    $result['scriptVersion'] = $Null;

    try {
        $databaseCreateFileList = @(${REQUIRED_DATABASE_CREATE_FILE_LIST})
        $isDatabaseCreatePossible = If ((Test-path -path $databaseCreateFileList -PathType Leaf) -contains $False) { $False } Else { $True }
    } catch {
        Write_Error -Message $_.Exception.Message
        $isDatabaseCreatePossible = $False
        $result['isCreatePossible'] = $False;
        $result['scriptVersion'] = $Null;
    }
    
    if($isDatabaseCreatePossible -eq $True) {
        $result['isCreatePossible'] = $True;
        $file = "${SCRIPT_VERSON_FILE}"
        if (Test-Path $file -PathType Leaf) {
            # File exists
            $val = Get-Content $file | ConvertFrom-Json
            $result['scriptVersion'] = $val.scriptVersion
        }     
    }
    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult  
`;

// {
// Sample Output - there's an error in one of the instances
// StandardOutputContent: '{\r\n' +
//     '    "FCI1":  "ScriptHalted",\r\n' +
//     '    "MSSQLSERVER":  "[{\\"name\\":\\"master\\"},{\\"name\\":\\"tempdb\\"},{\\"name\\":\\"model\\"},{\\"name\\":\\"msdb\\"},{\\"name\\":\\"snapmay21_db1\\"},{\\"name\\":\\"snapmay21maydb1\\"},{\\"name\\":\\"MAY28DB1\\"},{\\"name\\":\\"snapmay21maydb1_snapcenter\\"},{\\"name\\":\\"TEST1\\"},{\\"name\\":\\"TEST230\\"},{\\"name\\":\\"EVENING\\"},{\\"name\\":\\"EVENINGCLone31\\"},{\\"name\\":\\"YASH\\"},{\\"name\\":\\"CLONE_AWS_BACKUP\\"},{\\"name\\":\\"EVENING_IO_PROGRESS\\"},{\\"name\\":\\"EVENING_JUNE3\\"},{\\"name\\":\\"EVENING_11\\"},{\\"name\\":\\"EVENING_12\\"},{\\"name\\":\\"EVENING_13\\"},{\\"name\\":\\"EVENING_14\\"},{\\"name\\":\\"Multiple_MDF_NDF\\"},{\\"name\\":\\"DETECT_MANAGE_CLONE\\"},{\\"name\\":\\"treebo\\"},{\\"name\\":\\"JUNE09\\"},{\\"name\\":\\"JUNE10DB1\\"},{\\"name\\":\\"sandbox_1717994450010\\"},{\\"name\\":\\"Multiple_MDF_NDF_SNAPCENTER\\"},{\\"name\\":\\"JUNE09clonebothnodes\\"},{\\"name\\":\\"JUNE09bothnodes22\\"},{\\"name\\":\\"JUNE09d1\\"},{\\"name\\":\\"NODE1DB\\"},{\\"name\\":\\"corrupt_db\\"},{\\"name\\":\\"corruptdb_clone1\\"},{\\"name\\":\\"corrupt_dbclone2\\"}]"\r\n' +
//     '}\r\n',
// StandardErrorContent: ''
// }

const validateSQLInstanceCredentials = `
    $credential = $null
    $sqlCredential = @{}
    if(-Not [string]::IsNullOrEmpty($sqlCredentials)) {
        $credential =  $sqlCredentials.domain.Where({$_.sqlinstancename -eq $serverInstanceName -Or $_.sqlinstancename.toUpper() -eq 'MSSQLSERVER'})[0]
        if (-Not [string]::IsNullOrEmpty($credential) -And -Not [string]::IsNullOrEmpty($credential.username) -And -Not [string]::IsNullOrEmpty($credential.password)) {
            $sqlCredential.add('useDomainAuth', $True)
            $sqlCredential.add('username', $credential.username)
            $sqlCredential.add('password', $credential.password)
        }
        else {
            $sqlCredential.add('useDomainAuth', $False)
            $credential =  $sqlCredentials.sql.Where({$_.sqlinstancename -eq $serverInstanceName})[0] 
            if (-Not [string]::IsNullOrEmpty($credential) -And -Not [string]::IsNullOrEmpty($credential.username) -And -Not [string]::IsNullOrEmpty($credential.password)) {
                $sqlCredential.add('useSqlAuth', $True)
                $sqlCredential.add('username', $credential.username)
                $sqlCredential.add('password', $credential.password)
            }
            else {
                $sqlCredential.add('useSqlAuth', $False)
            }
        }
    }
    else {
        $sqlCredential.add('useDomainAuth', $False)
        $sqlCredential.add('useSqlAuth', $False)
    }
`;

const getSqlCredentials = (sqlAuthEnabled: boolean) => `
    $ProgressPreference = 'SilentlyContinue'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlCredentials = $null
    if ($sqlAuthEnabled) {
        $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "60"} -Method PUT -Uri 'http://169.254.169.254/latest/api/token'
        $instanceType = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -Uri "http://169.254.169.254/latest/meta-data/instance-type" -ErrorAction Stop -UseBasicParsing).Content
        $ssmInstallationPath = (Get-Module -Name AWS.Tools.SimpleSystemsManagement -ListAvailable).Path

        if (($vcpus -ge 2) -and (-Not [string]::IsNullOrEmpty($ssmInstallationPath))) {
            try {
                $ec2InstanceId = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -Uri "http://169.254.169.254/latest/meta-data/instance-id" -ErrorAction Stop -UseBasicParsing).Content
                $connection = Test-Connection -ComputerName ${GOOGLE_DNS} -Quiet -Count 1
                if ($connection -eq $False) {
                    # Set the registry key to disable certificate revocation check in case of private subnet
                    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
                }
                $sqlCredentials = ((Get-SSMParameter -WithDecryption 1 -Name /netapp/wlmdb/$ec2InstanceId).Value | ConvertFrom-Json)
                $isAtleastOneCredentialIsOfDomain = $sqlCredentials.domain.Count -gt 0
            } catch {
                $sqlCredentials = $null
            }
        }
    }
`;

const sqlQueryExecutionWithAuth = (instances: string[], query: string, sqlAuthEnabled = false) => `
    $sqlInstances = '${JSON.stringify(instances)}' | ConvertFrom-Json
    $query = "${query}"
    try {
        $responseObject = @{}
        ${getSqlCredentials(sqlAuthEnabled)}
        ${enableCredSSP}
        ${invokeCommandWithCredSSP}
        if ($isAtleastOneCredentialIsOfDomain) {
            Enable-CredSSP
        }
        $sqlInstances | ForEach-Object {
            $serverInstanceName = $_
            $instanceName = "$env:COMPUTERNAME"
            if ($serverInstanceName -ne 'MSSQLSERVER') {
                $instanceName = "$env:COMPUTERNAME\\$serverInstanceName"
            }
            try {
                ${validateSQLInstanceCredentials}
                $sqlError = $null
                if ($sqlCredential.useDomainAuth -eq $True) {
                    $sqlResponse = Invoke-CommandWithCredSSP -sqlquery $query -instanceName $instanceName
                } elseif ($sqlCredential.useSqlAuth -eq $True) {
                    $sqlResponse = sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $instanceName -Q $query -y 0 2>> $sqlError
                }

                if ($($LASTEXITCODE -and $LASTEXITCODE -ne 0) -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
                    $sqlResponse =  sqlcmd -S $instanceName -Q $query -y 0 2>> $sqlError
                }

                if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
                    throw $sqlError
                }
                
                if ([string]::IsNullOrEmpty($sqlResponse) -or $sqlResponse -eq "NULL") {
                    $errorMessage = "SQL response is null or empty. $sqlResponse"
                    Write-Information $errorMessage
                    throw $errorMessage
                }
                try {
                    $normalizedResponse = ($sqlResponse -join "\`n")
                    $responseObject[$serverInstanceName] = $normalizedResponse | ConvertFrom-Json
                } catch {
                    $preview = $normalizedResponse
                    if ($preview.Length -gt 200) { $preview = $preview.Substring(0, 200) }
                    throw "SQL query for instance $serverInstanceName returned invalid JSON response. Response: $preview. Error: $($_.Exception.Message)"
                }
            } catch {
                $responseObject[$serverInstanceName] = "error: $($_.Exception.Message)"
            }
        }
        # disableCredSSP is removed as most of machines will be part of domain and we are enabling CredSSP at domain level.
        $response = $responseObject | ConvertTo-Json -Depth 5

        if([string]::IsNullOrEmpty($response)) {
            Write-Information "Failed to compress the response because the response is either null or empty. $response"
            return $response
        }
        ${compressResponse}
        return (Deflate-String $response)
    } catch {
        Write-Information $_.Exception.Message
        $responseObject.add('error', $_.Exception.Message)
        $responseObject | ConvertTo-Json -Depth 5
    }
`;

const GET_FCI_NAME = `
Function Get-FCIName {
    param (
        [string]$sqlServerNameToFind
    )

    $ipResources = Get-ClusterResource -ErrorAction SilentlyContinue | Where-Object {$_.ResourceType -eq "IP Address"}

    $filteredResources = $ipResources | Where-Object {
        $_.OwnerGroup -match "^SQL Server \(([^)]+)\)"
    } | Select-Object @{Name='FCIName'; Expression={[regex]::Match($_.Name, '\\(([^)]+)\\)').Groups[1].Value}},
                  @{Name='SQLServerName'; Expression={[regex]::Match($_.OwnerGroup, 'SQL Server \\(([^)]+)\\)').Groups[1].Value}}

    $fciName = $filteredResources | Where-Object { $_.SQLServerName -eq $sqlServerNameToFind } | Select-Object -ExpandProperty FCIName

    return $fciName
}
`;

const trendGraphCreateScriptForMssql = (databaseHostId: string, ec2InstanceId: string) => `
Start-Transcript -Path "C:\\cfn\\log\\instance_performance_collection.log.txt" -Append | Out-Null

$moduleFound = Get-Module -ListAvailable -Name AWS.Tools.CloudWatch

# Initialize result as an array to collect results for each batch
$result = @()

if (-not $moduleFound) {
    $result = @{
        success  = $false
        response = $null
        error    = "AWS.Tools.CloudWatch not found."
    }
    $result | ConvertTo-Json -Depth 5
}
elseif ($moduleFound) {   
    try {
        Import-Module AWS.Tools.CloudWatch -ErrorAction Stop
        $WarningPreference = "SilentlyContinue"

        $databaseHostId = '${databaseHostId}'
        $ec2InstanceId = '${ec2InstanceId}'

        # Fetch all SQL instances from the registry
        Function FetchAllRunningSQLInstances {
            $sqlServiceList = Get-WmiObject win32_service | Where-Object {
                $_.DisplayName -like 'sql server (*' -and $_.State -eq 'Running'
            }

            $finalInstancesList = @()

            ForEach ($sqlService in $sqlServiceList) {
                $instanceName = $sqlService.Name -Replace "MSSQL\\$", ""
                $finalInstancesList += $instanceName
            }
            return $finalInstancesList
        }

        $cpuUtilquery = @"
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; WITH CPUUsage AS (
    SELECT
        DATEADD(ms, -1 * (rb.timestamp - si.ms_ticks), GETDATE()) AS EventTime,
        CAST(x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS INT) AS SQLProcessUtilization
    FROM
        sys.dm_os_ring_buffers AS rb
    CROSS JOIN
        sys.dm_os_sys_info AS si
    CROSS APPLY
        (SELECT CONVERT(XML, rb.record) AS record) AS x
    WHERE
        rb.ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
)
SELECT
    MAX(SQLProcessUtilization) AS MaxCPUUtilizationPercentage
FROM
    CPUUsage
WHERE
    EventTime >= DATEADD(hour, -6, GETDATE())
FOR JSON PATH
"@

        $performanceQuery = @"
SET NOCOUNT ON;
DECLARE @StartTime DATETIME
DECLARE @TimeInSeconds FLOAT

-- Set start time to 6 hours ago
SET @StartTime = DATEADD(HOUR, -6, GETDATE())
SET @TimeInSeconds = DATEDIFF(SECOND, @StartTime, GETDATE())

SELECT
    READ_IOPS,
    WRITE_IOPS,
    READ_THROUGHPUT,
    WRITE_THROUGHPUT,
    READ_LATENCY,
    WRITE_LATENCY,
    SERVER_IO_LATENCY
FROM (
    SELECT
        MAX(CASE WHEN num_of_reads = 0 THEN 0 ELSE CAST(num_of_reads AS FLOAT)/@TimeInSeconds END) AS READ_IOPS,
        MAX(CASE WHEN num_of_writes = 0 THEN 0 ELSE CAST(num_of_writes AS FLOAT)/@TimeInSeconds END) AS WRITE_IOPS,
        MAX(CASE WHEN num_of_bytes_read = 0 THEN 0 ELSE CAST(num_of_bytes_read AS FLOAT)/@TimeInSeconds/1024 END) AS READ_THROUGHPUT,
        MAX(CASE WHEN num_of_bytes_written = 0 THEN 0 ELSE CAST(num_of_bytes_written AS FLOAT)/@TimeInSeconds/1024 END) AS WRITE_THROUGHPUT,
        MAX(CASE WHEN num_of_reads = 0 THEN 0 ELSE io_stall_read_ms / num_of_reads END) AS READ_LATENCY,
        MAX(CASE WHEN num_of_writes = 0 THEN 0 ELSE io_stall_write_ms / num_of_writes END) AS WRITE_LATENCY,
        MAX(CASE WHEN (num_of_reads + num_of_writes) = 0 THEN 0 ELSE CAST(io_stall AS FLOAT) / (num_of_reads + num_of_writes) END) AS SERVER_IO_LATENCY
    FROM sys.dm_io_virtual_file_stats(null,null)
) AS subquery
FOR JSON PATH;
"@

        $combinedMetrics = @()

        $credsFromParameterStore = $null
        try {
            $credsFromParameterStore = (Get-SSMParameter -WithDecryption 1 -Name /netapp/wlmdb/$ec2InstanceId).Value | ConvertFrom-Json
        }
        catch {
            $credsFromParameterStore = $null
        }

        $instancesList = FetchAllRunningSQLInstances
        $credsspSet = $false
        ${enableCredSSP} 
        ${invokeCommandWithCredSSP}
        foreach ($instanceName in $instancesList) {
            $metrics = @()
            $sqlCmdParams = @()
            $sqlAuth = $false
            $windowsAuth = $false

            $windowsInstanceName =  $env:computerName 
            if ($instanceName -ne "MSSQLSERVER") {
                $sqlCmdParams += @("-S", "$env:computerName\\$instanceName")
                $windowsInstanceName = "$env:computerName\\$instanceName"
            }

            if($credsFromParameterStore.sql -ne $null){
                $sqlCredential = $credsFromParameterStore.sql.Where({ $_.sqlInstanceName -eq $instanceName })[0]

                if (-Not [string]::IsNullOrEmpty($sqlCredential) -and -Not [string]::IsNullOrEmpty($sqlCredential.username) -and -Not [string]::IsNullOrEmpty($sqlCredential.password)) {
                    $sqlAuth = $true
                    $sqlCmdParams += @("-U", $sqlCredential.username, "-P", $sqlCredential.password)
                }
            } 
            if($credsFromParameterStore.domain -ne $null){
                $sqlCredential = $credsFromParameterStore.domain.Where({ $_.sqlInstanceName -eq $instanceName })[0]
                if (-Not [string]::IsNullOrEmpty($sqlCredential) -and -Not [string]::IsNullOrEmpty($sqlCredential.username) -and -Not [string]::IsNullOrEmpty($sqlCredential.password)) 
                {
                    $windowsAuth = $true
                    $DomainCreds = (New-Object PSCredential($sqlCredential.username,(ConvertTo-SecureString $sqlCredential.password -AsPlainText -Force)))
                    if (-not $credsspSet) {
                        Enable-CredSSP
                    }
                    $credsspSet = $true
            }
                }

            try {
                if ($windowsAuth) {
                    $cpuResponse = Invoke-CommandWithCredSSP -sqlquery $cpuUtilquery -instanceName $windowsInstanceName -IsMultiQuery $True                  
                }
                else {
                    $cpuResponse = sqlcmd @sqlCmdParams -Q $cpuUtilquery -y 0
                }
                
                $cpuJsonResponse = $cpuResponse -join "\`n" | ConvertFrom-Json
            }
            catch {
                $cpuError = $_.Exception.Message
            }

            try {
                if ($windowsAuth) {
                    $perfResponse  = Invoke-CommandWithCredSSP -sqlquery $performanceQuery -instanceName $windowsInstanceName -IsMultiQuery $True
                }
                else {
                    $perfResponse = sqlcmd @sqlCmdParams -Q $performanceQuery -y 0
                }
                
                $perfJsonResponse = $perfResponse -join "\`n" | ConvertFrom-Json
            }
            catch {
                $perfError = $_.Exception.Message
            }

            if ($cpuJsonResponse) {
                $metrics += @{
                    MetricName      = "cpuUsed"
                    Value           = $cpuJsonResponse.MaxCPUUtilizationPercentage
                    Unit            = "Percent"
                    SqlInstanceName = $instanceName
                }
            }

            if ($perfJsonResponse) {
                $metrics += @{
                    MetricName      = "readIops"
                    Value           = $perfJsonResponse.READ_IOPS
                    Unit            = "None"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "writeIops"
                    Value           = $perfJsonResponse.WRITE_IOPS
                    Unit            = "None"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "readThroughput"
                    Value           = $perfJsonResponse.READ_THROUGHPUT
                    Unit            = "Kilobytes/Second"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "writeThroughput"
                    Value           = $perfJsonResponse.WRITE_THROUGHPUT
                    Unit            = "Kilobytes/Second"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "readLatency"
                    Value           = $perfJsonResponse.READ_LATENCY
                    Unit            = "Milliseconds"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "writeLatency"
                    Value           = $perfJsonResponse.WRITE_LATENCY
                    Unit            = "Milliseconds"
                    SqlInstanceName = $instanceName
                }
                $metrics += @{
                    MetricName      = "serverIOLatency"
                    Value           = $perfJsonResponse.SERVER_IO_LATENCY
                    Unit            = "Milliseconds"
                    SqlInstanceName = $instanceName
                }
            }

            # Output the metrics for verification if any exist
            if ($metrics.Count -gt 0) {
                Write-Output "Metrics created for instance $instanceName. \`n"
                $combinedMetrics += $metrics
            }
            else {
                Write-Output "Metrics creation skipped for instance $instanceName due to errors. \`n"
                if ($cpuError) { Write-Output "CPU Error: $cpuError" }
                if ($perfError) { Write-Output "Performance Error: $perfError" }
            }
        }

        $batchSize = 20
        $metricDataArray = @()

        foreach ($metric in $combinedMetrics) {
            $metricDataArray += @{
                MetricName = $metric.MetricName
                Value      = $metric.Value
                Unit       = $metric.Unit
                Dimensions = @(
                    @{
                        Name  = "sqlInstanceName"
                        Value = $metric.SqlInstanceName
                    },
                    @{
                        Name  = "databaseHostId"
                        Value = $databaseHostId
                    }
                )
            }
        }

        # Send in batches of 20
        $batchResponse = ""
        for ($i = 0; $i -lt $metricDataArray.Count; $i += $batchSize) {
            $batch = $metricDataArray[$i..([Math]::Min($i + $batchSize - 1, $metricDataArray.Count - 1))]
            try {
                Write-CWMetricData -Namespace "netapp/wlmdb/performance" -MetricData $batch
                $response = "Successfully sent batch $($i / $batchSize + 1)"
                $batchResponse += "$response\`n"
       
            }
            catch {
                $response = "Error sending batch $($i / $batchSize + 1): $($_.Exception.Message)"
                $batchResponse += "$response\`n"
            }
        }
        $result += @{
            success  = $true
            response = $batchResponse
            error    = $_.Exception.Message
        }
    }
    catch {
        $result = @{
            success  = $false
            response = $null
            error    = $_.Exception.Message
        }
    }
}
$result | ConvertTo-Json -Depth 5
exit 0
`;

const GET_NODE_IP_ADDRESS = `
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600"} -Method PUT -Uri http://169.254.169.254/latest/api/token
	$ipAddress = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token} -Method GET -Uri http://169.254.169.254/latest/meta-data/local-ipv4
    @{ ipAddress = $ipAddress } | ConvertTo-Json -Compress
`;

const GET_FQDN = `
    $fqdn = [System.Net.Dns]::GetHostByName($env:computerName).HostName
    @{ fqdn = $fqdn } | ConvertTo-Json -Compress
`;

const GET_CLUSTER_NAME_AND_FCI_INSTANCES = `
    $clusterName = $null
    $fciActiveInstances = @()
    Try {
        $clusterName = (Get-Cluster -ErrorAction SilentlyContinue).Name
        $localNode = Get-ClusterNode -Name $env:COMPUTERNAME -ErrorAction SilentlyContinue
        if (-not $localNode) {
            $localNode = Get-ClusterNode -Name (hostname) -ErrorAction SilentlyContinue
        }
        if ($localNode) {
            Get-ClusterGroup -ErrorAction SilentlyContinue | Where-Object {
                $_.OwnerNode.Id -eq $localNode.Id
            } | ForEach-Object {
                if ($_.Name -match '^SQL Server(?: \\((.+)\\))?$') {
                    $fciActiveInstances += if ($Matches[1]) { $Matches[1] } else { 'MSSQLSERVER' }
                }
            }
        }
    }
    Catch {
        $clusterName = $null
        $fciActiveInstances = @()
    }
    @{ clusterName = $clusterName; fciActiveInstances = @($fciActiveInstances) } | ConvertTo-Json -Compress
`;

export {
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_STANDBY_NODE_DRIVE_LIST,
    GET_DEFAULT_DRIVES,
    GET_DEFAULT_COLLATION,
    RESOURCE_UTILIZATION,
    validateSQLInstanceConnectivity,
    installPowerShellModule,
    getMappedOntapVolumesScript,
    restGetUtilForOntap,
    INSTANCE_DETAILS,
    copyPowerShellModule,
    sqlQueryExecution,
    readSsmParameter,
    slqcmdExecutionTemplate,
    CHECK_SCRIPT_AVAILABILITY_AND_VERSION,
    sqlQueryExecutionWithAuth,
    compressResponse,
    GET_FCI_NAME,
    trendGraphCreateScriptForMssql,
    GET_NODE_IP_ADDRESS,
    GET_FQDN,
    GET_CLUSTER_NAME_AND_FCI_INSTANCES,
    buildAoagQuery,
    getAoagDetailsScript,
    GET_FCI_OWNER_MAPPING_FUNCTION
};
