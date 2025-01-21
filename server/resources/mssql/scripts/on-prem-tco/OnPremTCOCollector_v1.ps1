<#
.SYNOPSIS
Collects detailed information about the Windows system and SQL Server instances on a specified remote computer.

.DESCRIPTION
This PowerShell script, `OnPremTCOCollector.ps1`, collects comprehensive data about the Windows operating system and SQL Server instances on a specified remote computer. 
The script gathers information such as OS edition, CPU count, RAM size, network configuration, disk details, and SQL Server instance details. 
The collected data is output in JSON format, which can be used for further analysis or reporting.

.PREREQUISITES
# - PowerShell 3.0 or later
# - Necessary permissions to access WMI and SQL Server on the remote computer
# - Network connectivity to the remote computer

.USAGE
1. Download the script file `OnPremTCOCollector.ps1`.
2. Open PowerShell with administrative privileges.
3. Navigate to the directory where the script is downloaded.
4. Run the script with the required parameters.

.PARAMETER instanceNames
(Optional) Array of SQL Server instance names to query. If not specified, the script will attempt to gather information from all available SQL Server instances on the remote computer.

.PARAMETER SqlUserName
(Optional) SQL Server username for authentication. If not specified, Windows Authentication will be used.

.EXAMPLE
.\OnPremTCOCollector.ps1 -instanceNames "MSSQLSERVER", "MSSQLSERVER1" -SqlUserName "sa"
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

    $ipResources = Get-ClusterResource | Where-Object {$_.ResourceType -eq "IP Address"} -ErrorAction SilentlyContinue

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

    $sqlcmd = "sqlcmd -S $InstanceName -Q `"$Query`" -y 0 "

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
    $windowsConfig.Add("windowsClusterName", $windowsClusterName)
    $remoteClusterNodes = $nodeNames | Where-Object { $_ -ne $hostname }
    foreach ($node in $remoteClusterNodes) {
        $clusterResult = GetClusterNodeDetails -nodeName $node
        $windowsConfig["nodeDetails"] += $clusterResult
    }
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
SET NOCOUNT ON; SELECT count(name) FROM sys.databases;
"@

    collation = @"
SET NOCOUNT ON; SELECT SERVERPROPERTY('Collation') AS ServerCollation;
"@

    cpuUtilization = @"
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; WITH CPUUsage AS (
    SELECT
        DATEADD(ms, -1 * (rb.timestamp - si.ms_ticks), GETDATE()) AS EventTime,
        CAST(x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS INT) AS SystemIdle,
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
    MAX(100 - SystemIdle) AS MaxCPUUtilizationPercentage
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
    STR(CAST(SUM(num_of_writes) AS FLOAT) / @TimeInSeconds, 10, 2) AS writeIops,
    STR(CAST(SUM(num_of_reads) AS FLOAT) / @TimeInSeconds, 10, 2) AS readIops,
    STR(CAST(SUM(num_of_bytes_written) AS FLOAT) / @TimeInSeconds, 20, 2) AS writeBytesPerSec,
    STR(CAST(SUM(num_of_bytes_read) AS FLOAT) / @TimeInSeconds, 20, 2) AS readBytesPerSec
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
        size * 8 / 1024 AS size_mb, 
        physical_name
    FROM 
        sys.master_files
),
db_space_cte AS (
    SELECT 
        database_id,
        SUM(CASE WHEN type = 0 THEN size_mb ELSE 0 END) AS data_size_mb,
        SUM(CASE WHEN type = 1 THEN size_mb ELSE 0 END) AS log_size_mb,
        MAX(physical_name) AS physical_name
    FROM 
        db_size_cte
    GROUP BY 
        database_id
)
SELECT 
    d.name AS databaseName,
    ds.data_size_mb + ds.log_size_mb AS allocatedSizeMb, 
    ds.data_size_mb AS dataSizeMb,
    ds.log_size_mb AS logSizeMb,
    (CAST(FILEPROPERTY(mf.file_id, 'SpaceUsed') AS INT) * 8 / 1024) AS usedDataSizeMb,
    LEFT(ds.physical_name, CHARINDEX(':', ds.physical_name)) AS driveLetter,
    vs.total_bytes / 1048576 AS driveTotalSizeMb,
    vs.available_bytes / 1048576 AS driveAvailableSizeMb 
FROM 
    sys.databases d
JOIN 
    db_space_cte ds ON d.database_id = ds.database_id
JOIN 
    sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 0
CROSS APPLY 
    sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
WHERE 
    d.name NOT IN ('tempdb', 'master', 'model', 'msdb')
ORDER BY 
    d.name FOR JSON PATH
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
            try {
                # Attempt to convert the output from JSON and back to JSON to standardize the format
                $tempOutput = $output[0] | ConvertFrom-Json
                $jsonOutput = $tempOutput | ConvertTo-Json -Depth 4
                $instanceResults[$queryKey] = $jsonOutput
            }
            catch {
                # If conversion fails, store the raw output
                $instanceResults[$queryKey] = $output
            }
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
            break
        }
        default {
            $instanceResults['deploymentType'] = 'standalone'
            $ownerNodeQuery = "SET NOCOUNT ON; SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') FOR JSON PATH; "
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

# Convert the final output to JSON with a depth of 8
$jsonResults = $finalOutput | ConvertTo-Json -Depth 8

# Define the output file path
$outputFilePath = Join-Path -Path $PSScriptRoot -ChildPath ("TCOResponse-" + $dateString + ".json")

# Write the JSON results to the output file
$jsonResults | Out-File -FilePath $outputFilePath 

# Output a completion message with the file path
Write-Output "TCO data collection completed. Output file path: $outputFilePath"