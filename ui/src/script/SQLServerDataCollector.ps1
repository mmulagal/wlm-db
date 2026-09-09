<#
===============================================================================
        NETAPP CONSOLE WORKLOAD FACTORY - SQL SERVER DATA COLLECTOR
        Version 1.0.0
        Copyright (c) 2025 NetApp, Inc. All rights reserved.
===============================================================================
 
.SYNOPSIS
Collects detailed information about the Windows system and SQL Server instances on a specified remote computer.

.DESCRIPTION
This PowerShell script, `SQLServerDataCollector.ps1`, collects comprehensive data about the Windows operating system and SQL Server instances on a specified remote computer. 
The script gathers information such as OS edition, CPU count, RAM size, network configuration, disk details, and SQL Server instance details. 
The collected data is output in JSON format, which can be used for further analysis or reporting.

.PREREQUISITES
# - PowerShell 5.0 or later
# - Necessary permissions to access WMI and SQL Server on the remote computer
# - Network connectivity to the remote computer

.USAGE
1. Download the script file `SQLServerDataCollector.ps1`.
2. Open PowerShell with administrative privileges.
3. Navigate to the directory where the script is downloaded.
4. Run the script with the required parameters.
5. Script should be run with a Windows local login OR domain login that has admin rights on the system. Domain login is needed for cluster configuration.
6. User should have admin privileges on SQL Server instance to get full report.
7. If the Windows login does not have required access to the SQL Server instance, provide the local SQL user credentials for collection with '-SqlUserName' parameter.
8. Collection should not have any performance impact on the SQL Server instance and finishes within few minutes.
9. Script collects configuration information of the host node and partner node in case of FCI/AOAG. Most of the performance stats are captured from historic counter data in SQL Server(4hrs). Memory usage is point-in-time.

.PARAMETER instanceNames
(Optional) Array of SQL Server instance names to query. If not specified, the script will attempt to gather information from all available SQL Server instances on the remote computer.

.PARAMETER SqlUserName
(Optional) SQL Server username for authentication. If not specified, Windows Authentication will be used.

.EXAMPLE
.\SQLServerDataCollector.ps1 -instanceNames "MSSQLSERVER", "MSSQLSERVER1" -SqlUserName "sa"
This example runs the script to collect data from the "MSSQLSERVER" and "MSSQLSERVER1" SQL Server instances using the SQL Server username "sa" for authentication.

.NOTES
Version: 1.0.0

#>

param (
    [string[]]$InstanceNames = @(),
    [string]$SqlUsername
)
# Script version
$scriptVersion = "1.0.0"

# Collect basic host information
$osEdition = (Get-WmiObject -Class Win32_OperatingSystem).Caption
$cpuCount = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
$ramSize = (Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB
$hostId =  Get-WmiObject -Class Win32_ComputerSystemProduct | Select-Object -ExpandProperty UUID 

# Function to get the FCI name for a given SQL Server instance
function Get-FCIName {
    param (
        [string]$sqlServerNameToFind
    )

    $ipResources = Get-ClusterResource -ErrorAction SilentlyContinue | Where-Object {$_.ResourceType -eq "IP Address"}

    $filteredResources = $ipResources | Where-Object {
        $_.OwnerGroup -match "^SQL Server \(([^)]+)\)"
    } | Select-Object @{Name='FCIName'; Expression={[regex]::Match($_.Name, '\(([^)]+)\)').Groups[1].Value}},
                  @{Name='SQLServerName'; Expression={[regex]::Match($_.OwnerGroup, 'SQL Server \(([^)]+)\)').Groups[1].Value}}

    $fciName = $filteredResources | Where-Object { $_.SQLServerName -eq $sqlServerNameToFind } | Select-Object -ExpandProperty FCIName

    return $fciName
}

# Function to execute a SQL query using sqlcmd
function Invoke-SQLQuery {
    param (
        [string]$QueryKey,
        [string]$Query,
        [string]$InstanceName,
        [string]$SqlUserName,
        [string]$SqlPassword
    )

    $sqlcmd = "sqlcmd -S $InstanceName -C -Q `"$Query`" -y 0 -s `",`" "

    if (![string]::IsNullOrEmpty($SqlUserName) -and ![string]::IsNullOrEmpty($SqlPassword)) {
        $sqlcmd += " -U $SqlUserName -P $SqlPassword"
    }

    try {
        $output = Invoke-Expression -Command $sqlcmd
        return $output
    } catch {
        return $null
    }
}

# Function to get drive details for a given node
function GetDriveDetails {
    param (
        [string]$nodeName
    )
# Define the script block to run on the remote node
$scriptBlock = {
    # Retrieve the disk drives with DeviceID and Model properties
    $disks = Get-CimInstance -ClassName Win32_DiskDrive | Select-Object DeviceID, Model

    # Initialize an array to store the results
    $results = @()

    # Iterate over each disk
    foreach ($disk in $disks) {
        # Retrieve the partitions associated with the current disk
        $partitions = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition"

        # Iterate over each partition
        foreach ($partition in $partitions) {
            # Retrieve the logical disks associated with the current partition
            $logicalDisks = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition"

            # Iterate over each logical disk
            foreach ($logicalDisk in $logicalDisks) {
                # Create a custom object with the desired properties
                $result = [PSCustomObject]@{
                    deviceId = $disk.DeviceID
                    model = $disk.Model
                    driveLetter = $logicalDisk.DeviceID
                }

                # Add the result to the array
                $results += $result
            }
        }
    }

    # Convert the results to JSON and return the JSON string directly
    $results | ConvertTo-Json -Depth 3
}

# Run the script block on the remote node and capture the JSON string
$jsonResults = Invoke-Command -ComputerName $nodeName -ScriptBlock $scriptBlock
return $jsonResults
    
    }
 

# Function to get cluster node details for a given node
function GetClusterNodeDetails {

 param (
        [string]$nodeName
    )

    $hostId =  Get-CimInstance -ClassName Win32_ComputerSystemProduct -ComputerName $nodeName | Select-Object -ExpandProperty UUID 

      # Retrieve OS edition
    $osEdition = (Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $nodeName).Caption

    # Retrieve CPU count
    $cpuCount = (Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName $nodeName).NumberOfLogicalProcessors

    # Retrieve RAM size
    $ramSize = (Get-CimInstance -ClassName Win32_PhysicalMemory -ComputerName $nodeName | Measure-Object -Property Capacity -Sum).Sum / 1GB

    $networkConfiguration =Get-CimInstance -ClassName Win32_NetworkAdapter -ComputerName $nodeName | Where-Object { $_.Speed -ne $null } | Select-Object @{Name='name';Expression={$_.Name}}, @{Name='speedMbps';Expression={$_.Speed / 1MB}}, @{Name='adapterType';Expression={$_.AdapterType}}

    $driveDetails = GetDriveDetails($nodeName)

   $nodeDetails = @{
        "hostId" = $hostId
        "osEdition" = $osEdition
        "numberOfVcpus"  = $cpuCount
        "ramSize" = $ramSize
        "networkConfiguration" = $networkConfiguration
        "driveDetails" = $driveDetails
        "hostName" = $nodeName
    }
    return $nodeDetails
}

# Function to get AOAG partner details
function Get-AoagPartnerDetails{
    param(
        [string]$instanceName
    )

    $partnerInstanceResults = @{}
    ForEach ($queryKey in $queries.Keys) {
        $query = $queries[$queryKey]
        # Execute the query using the verified SQL credentials
        $output = Invoke-SQLQuery -QueryKey $queryKey -Query $query -InstanceName $instanceName -SqlUsername $verifiedSqlUsername -SqlPassword $verifiedSqlPassword
        if ($output) {
            $partnerInstanceResults[$queryKey] = $output           
        } else {
            
            $partnerInstanceResults[$queryKey] = @{ "error" = "Error running query '$queryKey' on instance $aoagPartnerInstance" } | ConvertTo-Json
        }
    }
        $partnerInstanceResults['deploymentType'] = 'AOAG'
        $partnerInstanceResults["ownerNodes"] = Invoke-SQLQuery -Query $ownerNodeQuery -InstanceName $instanceName -SqlUsername $SqlUserName -SqlPassword $SqlPassword 
        $partnerInstanceResults["aoagReadReplica"] = Invoke-SQLQuery -Query $aoagReadReplicaQuery -InstanceName $instanceName -SqlUsername $SqlUserName -SqlPassword $SqlPassword 
        $partnerInstanceResults["isReadReplica"] = Invoke-SQLQuery -Query $isReadReplicaQuery -InstanceName $instanceName -SqlUsername $SqlUserName -SqlPassword $SqlPassword

        $filteredInstanceName = $instanceName.Split('\')[-1]
        $partnerInstanceResults['sqlInstanceName'] = $filteredInstanceName
        $partnerInstanceResults.Remove('isClustered')
        $partnerInstanceResults.Remove('isHadrEnabled')

    return $partnerInstanceResults

}

# Collect basic host information
$osEdition = (Get-WmiObject -Class Win32_OperatingSystem).Caption
$cpuCount = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
$ramSize = (Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB
$networkConfiguration = Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.Speed -ne $null } | Select-Object @{Name='name';Expression={$_.Name}}, @{Name='speedMbps';Expression={$_.Speed / 1MB}}, @{Name='adapterType';Expression={$_.AdapterType}}
$driveDetails = GetDriveDetails(hostname)

# Prompt for SQL password if SQL username is provided
if($SqlUserName){
    $encryptedSqlPassword = Read-Host -Prompt "Enter Password" -AsSecureString
    $SqlPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($encryptedSqlPassword)
)
}

# Initialize cluster-related variables
$nodeNames = @()
$hostName = hostname
$belongsToCluster = $false

# Check if the host belongs to a cluster
try {
    $clusterNodes = Get-ClusterNode -ErrorAction SilentlyContinue
    if ($clusterNodes) {
        $nodeNames = $clusterNodes | Select-Object -ExpandProperty Name
        $belongsToCluster = $true
      
    }
} catch {
    $belongsToCluster = $false
}

# Collect host details
$hostDetails = @{
    "osEdition" = $osEdition
    "numberOfVcpus" = $cpuCount
    "ramSize" = $ramSize
    "networkConfiguration" = $networkConfiguration
    "driveDetails" = $driveDetails
    "hostId" = $hostId
    "hostName" = $hostName
}

# Initialize Windows configuration details
$windowsConfig = @{
    "belongsToCluster" = $belongsToCluster
    "nodeDetails" = @()
}

# Add host details to the node details
$windowsConfig["nodeDetails"] += $hostDetails

# If the host belongs to a cluster, collect cluster node details
if($belongsToCluster){
    $windowsConfig.Add("clusterNodeNames", $nodeNames)
    $windowsClusterName = Get-Cluster | Select-Object -ExpandProperty Name
    $windowsConfig.Add("windowsSystemName", $windowsClusterName)
    $remoteClusterNodes = $nodeNames | Where-Object { $_ -ne $hostname }
    foreach ($node in $remoteClusterNodes) {
        $clusterResult = GetClusterNodeDetails -nodeName $node
        $windowsConfig["nodeDetails"] += $clusterResult
    }
}
else{
    $windowsName = hostname
    $windowsConfig.Add("windowsSystemName", $windowsName)
    $windowsConfig.Add("clusterNodeNames", @($windowsName))
}

# Collect SQL Server instances
$sqlServiceList = Get-WmiObject win32_service | Where-Object { $_.DisplayName -like 'sql server (*' }
$finalInstancesList = @()

ForEach ($sqlService in $sqlServiceList) {
    $isDefaultInstance = -Not $sqlService.Name.Contains('$')
    $instanceName = $sqlService.Name -Replace "MSSQL\$", ""
    $fciName = Get-FCIName -sqlServerNameToFind $instanceName -ErrorAction SilentlyContinue
    if ($fciName) {
    $serverInstance = if ($isDefaultInstance) { 
        $fciName 
    } else { 
        "$fciName\$instanceName" 
    }
    } else {
        $serverInstance = if ($isDefaultInstance) { 
        "$Env:ComputerName" 
    } else { 
        "$Env:ComputerName\$instanceName" 
    }
}
    if ($instanceNames.Count -gt 0) {
        if ($instanceNames -contains $instanceName) {
            $finalInstancesList += $serverInstance
        }
        } else {
            $finalInstancesList += $serverInstance
        }
}

# Define SQL queries to be executed
$queries = @{
instanceGuid = @"
SET NOCOUNT ON;SELECT [service_broker_guid] FROM sys.databases WHERE [name] = N'msdb'
"@

memUtilization = @"
SET NOCOUNT ON; SELECT
                                    (processmem.physical_memory_in_use_kb * 1024) AS used,
                                    (sysmem.total_physical_memory_kb * 1024) AS total,
                                    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,
                                    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed
                                    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH
"@

    sqlEdition = @"
SET NOCOUNT ON; SELECT SERVERPROPERTY('Edition'); 
"@

    sqlVersion = @"
SET NOCOUNT ON;SELECT @@VERSION AS SQLServerVersion;
"@

    noOfDatabases = @"
SET NOCOUNT ON;
SELECT COUNT(name) AS DatabaseCount
FROM sys.databases
WHERE name NOT IN ('tempdb', 'model', 'msdb');
"@

    collation = @"
SET NOCOUNT ON; SELECT SERVERPROPERTY('Collation') AS ServerCollation;
"@

    cpuUtilization = @"
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
    EventTime >= DATEADD(hour, -6, GETDATE());
"@

    isHadrEnabled = @"
SET NOCOUNT ON; SELECT SERVERPROPERTY('IsHadrEnabled')
"@

    isClustered = @"
SET NOCOUNT ON; SELECT SERVERPROPERTY('IsClustered')
"@

    iops = @"
SET NOCOUNT ON;
DECLARE @SQLRestartDateTime Datetime;
DECLARE @TimeInSeconds Float;

SELECT @SQLRestartDateTime = create_date 
FROM sys.databases 
WHERE database_id = 2;

SET @TimeInSeconds = Datediff(s, @SQLRestartDateTime, GetDate());

SELECT 
    STR(CAST(SUM(num_of_writes) AS FLOAT) / NULLIF(@TimeInSeconds, 0), 10, 2) AS writeIops,
    STR(CAST(SUM(num_of_reads) AS FLOAT) / NULLIF(@TimeInSeconds, 0), 10, 2) AS readIops,
    STR(CAST(SUM(num_of_bytes_written) AS FLOAT) / NULLIF(@TimeInSeconds, 0), 20, 2) AS writeBytesPerSec,
    STR(CAST(SUM(num_of_bytes_read) AS FLOAT) / NULLIF(@TimeInSeconds, 0), 20, 2) AS readBytesPerSec
FROM 
    sys.dm_io_virtual_file_stats(null, null) FOR JSON PATH;
"@

    licenceUsageDetails = @"
SET NOCOUNT ON;

IF (SELECT CASE WHEN CONVERT(sysname, SERVERPROPERTY('EngineEdition')) = '3' THEN 1 ELSE 0 END) = 1
BEGIN
    -- SQL Server is Enterprise Edition
    IF OBJECT_ID('tempdb.dbo.#EnterpriseFeaturesDB') IS NOT NULL
        DROP TABLE #EnterpriseFeaturesDB;

    CREATE TABLE #EnterpriseFeaturesDB
    (
        DatabaseName VARCHAR(100),
        Feature_Name VARCHAR(100)
    );

    EXEC sp_MSforeachdb
    N'
    USE [?];
    IF (SELECT COUNT(*) FROM sys.dm_db_persisted_sku_features) > 0
    BEGIN
        INSERT INTO #EnterpriseFeaturesDB
        SELECT DB_NAME() AS DatabaseName, Feature_Name
        FROM sys.dm_db_persisted_sku_features;
    END';

    -- Create a table to store the results
    CREATE TABLE #Results (IsUsingFeature INT, FeatureDescription VARCHAR(100));

    -- Modify each SELECT statement to insert into the results table
    INSERT INTO #Results
    SELECT IIF(COUNT(1) > 0, 1, 0), 'User Databases are using Enterprise Level Features'
    FROM #EnterpriseFeaturesDB
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You have Availability Groups with > 1 database'
    FROM sys.availability_databases_cluster Databaselist
    INNER JOIN sys.availability_groups_cluster Groups ON Databaselist.group_id = Groups.group_id
    GROUP BY [name] HAVING COUNT([database_name]) > 1
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You have read-only Replicas'
    FROM sys.availability_replicas
    WHERE secondary_role_allow_connections <> 0
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You have Asynchronous commit Replicas'
    FROM sys.availability_replicas
    WHERE availability_mode = 0
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You are using Resource Governor'
    FROM sys.dm_resource_governor_resource_pools
    WHERE name NOT IN ('internal', 'default')
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You are using peer-to-peer replication'
    FROM sys.dm_repl_articles
    WHERE intPublicationOptions = 0x1
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You are using R or Python extensions'
    FROM sys.dm_external_script_requests
    WHERE language IN ('R', 'Python')
    UNION SELECT IIF(COUNT(1) > 0, 1, 0), 'Tempdb metadata memory-optimized is enabled'
    FROM sys.configurations
    WHERE name = N'tempdb metadata memory-optimized'
    AND value_in_use = 1
    UNION
    SELECT IIF(COUNT(1) > 48, 1, 0), 'SQL Server has > 48 vCPU'
    FROM sys.dm_os_schedulers WITH (NOLOCK)
    WHERE scheduler_id < 255 AND [status] = 'VISIBLE ONLINE'
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'SQL Server has > 128 GB Memory'
    FROM sys.dm_os_sys_memory
    WHERE total_physical_memory_kb / 1024 / 1024 > 128
    UNION
    SELECT IIF(COUNT(1) > 0, 1, 0), 'You are using asynchronous mirroring'
    FROM sys.database_mirroring
    WHERE mirroring_safety_level = 1;

    -- Finally, select from the results table using the FOR JSON clause
    SELECT * FROM #Results FOR JSON PATH;
END
"@

    vcpusPerInstance = @"
SET NOCOUNT ON;
SELECT COUNT(*)
FROM sys.dm_os_schedulers
WHERE status = 'VISIBLE ONLINE';
"@

    storageDetailsByDb = @"
SET NOCOUNT ON;

WITH db_size_cte AS (
    SELECT 
        database_id,
        type,
        CAST(size AS BIGINT) * 8 / 1024 AS size_mb, 
        physical_name,
        file_id
    FROM 
        sys.master_files
),
db_space_cte AS (
    SELECT 
        database_id,
        type,
        size_mb,
        physical_name,
        file_id
    FROM 
        db_size_cte
),
drive_info_cte AS (
    SELECT 
        ds.database_id,
        ds.type,
        ds.size_mb,
        ds.physical_name,
        LEFT(ds.physical_name, CHARINDEX(':', ds.physical_name)) AS driveLetter,
        vs.total_bytes / 1048576 AS driveTotalSizeMb,
        vs.available_bytes / 1048576 AS driveAvailableSizeMb,
        ds.file_id
    FROM 
        db_space_cte ds
    CROSS APPLY 
        sys.dm_os_volume_stats(ds.database_id, ds.file_id) vs
),
aggregated_db_info AS (
    SELECT 
        d.name AS databaseName,
        SUM(CASE WHEN ds.type = 0 THEN ds.size_mb ELSE 0 END) AS dataSizeMb,
        SUM(CASE WHEN ds.type = 1 THEN ds.size_mb ELSE 0 END) AS logSizeMb,
        SUM(ds.size_mb) AS allocatedSizeMb,
        ds.driveLetter,
        ds.driveTotalSizeMb,
        ds.driveAvailableSizeMb
    FROM 
        sys.databases d
    JOIN 
        drive_info_cte ds ON d.database_id = ds.database_id
    WHERE 
        d.name NOT IN ('tempdb', 'model', 'msdb')
    GROUP BY 
        d.name, ds.driveLetter, ds.driveTotalSizeMb, ds.driveAvailableSizeMb
)
SELECT 
    databaseName,
    allocatedSizeMb, 
    dataSizeMb,
    logSizeMb,
    driveLetter,
    driveTotalSizeMb,
    driveAvailableSizeMb
FROM 
    aggregated_db_info
ORDER BY 
    databaseName, driveLetter FOR JSON PATH;
"@ 

}

# Initialize an empty array to store results for each SQL instance
$results = @()

# Loop through each SQL instance in the finalInstancesList
ForEach ($instance in $finalInstancesList) {
    # Initialize an empty hashtable to store results for the current instance
    $instanceResults = @{}
    
    # Determine the instance name based on the format of the instance string
    if ($instance -match '\\') {
        $instanceName = $instance.Split('\')[-1]
    }else{
        $instanceName = "MSSQLSERVER"
    }
    
    # Check if SQL authentication details are provided
    if($SqlUserName){
        # Test SQL authentication by running a simple query
        $sqlAuthTest = Invoke-SQLQuery -Query "select @@version" -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword

        if($sqlAuthTest) {
            Write-Output "sql auth verified "
            $verifiedSqlUsername = $SqlUserName
            $verifiedSqlPassword = $SqlPassword
        } else {
            Write-Output "Given sql username and password is not valid for instance $instanceName. Trying windows auth"
        }
    }
    
    # Loop through each query in the queries hashtable
    ForEach ($queryKey in $queries.Keys) {
        $query = $queries[$queryKey]
        # Execute the query using the verified SQL credentials
        $output = Invoke-SQLQuery -QueryKey $queryKey -Query $query -InstanceName $instance -SqlUsername $verifiedSqlUsername -SqlPassword $verifiedSqlPassword
        if ($output) {
            $jsonResp = $output -join ""
            $jsonResp = $jsonResp.Trim()
            $instanceResults[$queryKey] = $jsonResp
        } else {
            Write-Output "Error running query '$queryKey' on instance $instance"
            $instanceResults[$queryKey] = @{ "error" = "Error running query '$queryKey' on instance $instance" } | ConvertTo-Json
        }
    }
    
    # Determine the deployment type based on the instance results
    switch ($true) {
        { $instanceResults['isClustered'] -eq 1 } {
            $instanceResults['deploymentType'] = 'fci'
            $clusterNodeQuery = "SET NOCOUNT ON; 
            SELECT 
            NodeName as nodeName, 
            CASE 
                WHEN is_current_owner = 1 THEN 'Primary'
                ELSE 'Standby'
            END AS nodeRole
            FROM sys.dm_os_cluster_nodes FOR JSON PATH; "
            $instanceResults["ownerNodes"] = Invoke-SQLQuery -Query $clusterNodeQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword
            break
        }
        { $instanceResults['isHadrEnabled'] -eq 1 } {
            $instanceResults['deploymentType'] = 'AOAG'
            $ownerNodeQuery = "SET NOCOUNT ON; SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS [primary] FOR JSON PATH; "
            $instanceResults["ownerNodes"] = Invoke-SQLQuery -Query $ownerNodeQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword 
            $isReadReplicaExistsQuery = "SET NOCOUNT ON;SELECT 
            CASE 
                WHEN EXISTS (
                    SELECT 1
                    FROM sys.dm_hadr_availability_replica_states ars
                    WHERE ars.is_local = 1
                ) 
                THEN 'True'
                ELSE 'False'
            END
        "
            # Many instances may not have read replicas, but have HADR enabled, so we need to check if read replica exists otherwise assign deploymentType as Standalone
            $checkIfReadReplicaExists = Invoke-SQLQuery -Query $isReadReplicaExistsQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword
            
            # If the query returns a false, set the deploymentType standalone
        if ($checkIfReadReplicaExists -match 'True') {
            $isReadReplicaQuery = "SET NOCOUNT ON;SELECT 
            CASE 
                WHEN EXISTS (
                    SELECT 1
                    FROM sys.dm_hadr_availability_replica_states ars
                    WHERE ars.role_desc = 'SECONDARY' AND ars.is_local = 1
                ) 
                THEN 'True'
                ELSE 'False'
            END
            "
            $instanceResults["isReadReplica"] = Invoke-SQLQuery -Query $isReadReplicaQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword
        
            $aoagReadReplicaQuery = "SET NOCOUNT ON; SELECT  
            d.name AS databaseName,
            drs.replica_id AS replicaId,
            ar.replica_server_name AS replicaServerName,
            drs.synchronization_state_desc AS syncStateDesc,
            ars.role_desc AS replicaRole
            FROM 
                sys.dm_hadr_database_replica_states drs
            JOIN 
                sys.databases d ON d.database_id = drs.database_id
            JOIN 
                sys.dm_hadr_availability_replica_states ars ON drs.replica_id = ars.replica_id
            JOIN 
                sys.availability_replicas ar ON ars.replica_id = ar.replica_id
            WHERE 
                ars.role_desc = 'SECONDARY' AND drs.is_local = 1
            ORDER BY 
                d.name FOR JSON PATH;  
         "
        $instanceResults["aoagReadReplica"] = Invoke-SQLQuery -Query $aoagReadReplicaQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword 
        
        $aoagPartnerInstanceQuery = " SET NOCOUNT ON;
            SELECT DISTINCT
                ar.replica_server_name
            FROM 
                sys.dm_hadr_availability_replica_states ars
            JOIN 
                sys.availability_replicas ar ON ars.replica_id = ar.replica_id;"

        $aoagPartnerInstance = Invoke-SQLQuery -Query $aoagPartnerInstanceQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword
        # Split the response into lines
        $replicaNames = $aoagPartnerInstance -split "`n"

        # Filter out the instance name that matches $instanceName
        $filteredNames = $replicaNames | Where-Object { $_ -ne $instance }

        foreach ($name in $filteredNames) { 
            # Get the AOAG partner details for each partner instance
            $partnerInstanceResults = Get-AoagPartnerDetails -instanceName $name
            $results += $partnerInstanceResults
         }
        } else {
            $instanceResults['deploymentType'] = 'standalone'
        }

        break
        }
        default {
            $instanceResults['deploymentType'] = 'standalone'
            $ownerNodeQuery = "SET NOCOUNT ON; SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS [primary] FOR JSON PATH; "
            $instanceResults["ownerNodes"] = Invoke-SQLQuery -Query $ownerNodeQuery -InstanceName $instance -SqlUsername $SqlUserName -SqlPassword $SqlPassword
        }
    }

    # Remove temporary keys used for determining deployment type
    $instanceResults.Remove('isClustered')
    $instanceResults.Remove('isHadrEnabled')
    # Add the SQL instance name to the results
    $instanceResults['sqlInstanceName'] = $instanceName

    # Add the instance results to the overall results array
    $results += $instanceResults
}

# Initialize the final output hashtable
$finalOutput = @{}

# Get the current date and time in the specified format
$dateString = Get-Date -Format "yyyyMMddHHmmss"

# Add script version and timestamp to the final output
$finalOutput['scriptVersion'] = $scriptVersion

$finalOutput['timestamp'] = $dateString 

# Add Windows configuration details to the final output
$finalOutput['windowsConfig'] = $windowsConfig

# Add SQL Server information to the final output
$finalOutput['sqlServerInfo'] = $results

# Convert the final output to JSON with a depth of 15
$jsonResults = $finalOutput | ConvertTo-Json -Depth 15

# Define the output file path
$outputFilePath = Join-Path -Path $PSScriptRoot -ChildPath ("SQLServerDataResponse-" + $dateString + ".json")

# Write the JSON results to the output file
$jsonResults | Out-File -FilePath $outputFilePath 

# Output a completion message with the file path
Write-Output "SQL Server data collection completed. Output file path: $outputFilePath"