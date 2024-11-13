param (
    [string[]]$InstanceNames = @(),
    [string]$SqlUsername
)

$osEdition = (Get-WmiObject -Class Win32_OperatingSystem).Caption
$cpuCount = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
$ramSize = (Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB


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


function Invoke-SQLQuery {
    param (
        [string]$Query,
        [string]$InstanceName,
        [string]$SqlUsername,
        [string]$SqlPassword
    )

    $sqlcmd = "sqlcmd -S $InstanceName -Q `"$Query`" -W -h -1 "

    if (![string]::IsNullOrEmpty($SqlUsername) -and ![string]::IsNullOrEmpty($SqlPassword)) {
        $sqlcmd += " -U $SqlUsername -P $SqlPassword"
    }

    try {
        $output = Invoke-Expression -Command $sqlcmd
        return $output
    } catch {
        return $null
    }
}

function GetClusterNodeDetails {

 param (
        [string]$nodeName
    )

      # Retrieve OS edition
    $osEdition = (Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $nodeName).Caption

    # Retrieve CPU count
    $cpuCount = (Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName $nodeName).NumberOfLogicalProcessors

    # Retrieve RAM size
    $ramSize = (Get-CimInstance -ClassName Win32_PhysicalMemory -ComputerName $nodeName | Measure-Object -Property Capacity -Sum).Sum / 1GB
       

   $nodeDetails = @{
        "odEdition"              = $osEdition
        "numberOfVirtualCPUs"  = $cpuCount
        "RAMSize"           = $ramSize
    }
    return $nodeDetails
}



if($SqlUsername){
    $encryptedSqlPassword = Read-Host -Prompt "Enter Password" -AsSecureString
    $SqlPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($encryptedSqlPassword)
)
}


$nodeNames = @()
$hostName = hostname
$belongsToCluster = $false
try{
    $clusterNodes = Get-ClusterNode -ErrorAction SilentlyContinue
    if ($clusterNodes){
        $nodeNames = $clusterNodes | Select-Object -ExpandProperty Name
        $belongsToCluster = $true
      
    }
 }catch{
    $belongsToCluster = $false
 }


 
$hostDetails = @{
    "osEdition" = $osEdition
    "numberOfVirtualCPUs" = $cpuCount
    "RAMSize" = $ramSize
    
}

 $windowsConfig = @{
    "belongsToCluster" = $belongsToCluster
    "NodeDetails" = @()
}

$windowsConfig["NodeDetails"] += @{
    $hostname = $hostDetails
}

if($belongsToCluster){

    $windowsConfig.Add("ClusterNodeNames",$nodeNames)
    $windowsClusterName = Get-Cluster | Select-Object Name
    $windowsConfig.Add("windowsClusterName",$windowsClusterName)
    $remoteClusterNodes = $nodeNames | Where-Object { $_ -ne $hostname }
    foreach ($node in $remoteClusterNodes) {
        $clusterResult = GetClusterNodeDetails -nodeName $node
        $windowsConfig["NodeDetails"] += @{
            $node = $clusterResult
        }
    }


}

$sqlServiceList = Get-WmiObject win32_service | Where-Object { $_.DisplayName -like 'sql server (*' }
$finalInstancesList = @()

ForEach ($sqlService in $sqlServiceList) {
    $isDefaultInstance = -Not $sqlService.Name.Contains('$')
    $instanceName = $sqlService.Name -Replace "MSSQL\$", ""
    $fciName = $fciName = Get-FCIName -sqlServerNameToFind $instanceName -ErrorAction SilentlyContinue
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
    if ($InstanceNames.Count -gt 0) {
        if ($InstanceNames -contains $instanceName) {
            $finalInstancesList += $serverInstance
        }
        } else {
            $finalInstancesList += $serverInstance
        }
}

$queries = @{
   

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
    STR(CAST(SUM(num_of_writes) AS FLOAT) / @TimeInSeconds, 10, 2) AS WRITE_IOPS,
    STR(CAST(SUM(num_of_reads) AS FLOAT) / @TimeInSeconds, 10, 2) AS READ_IOPS,
    STR(CAST(SUM(num_of_bytes_written) AS FLOAT) / @TimeInSeconds, 20, 2) AS WRITE_BYTES_PER_SEC,
    STR(CAST(SUM(num_of_bytes_read) AS FLOAT) / @TimeInSeconds, 20, 2) AS READ_BYTES_PER_SEC
FROM 
    sys.dm_io_virtual_file_stats(null, null) FOR JSON PATH;

"@

licenceUsgaeDetails = @"
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

storageDetailsByDB = @"
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
    d.name AS DatabaseName,
    ds.data_size_mb + ds.log_size_mb AS AllocatedSizeMB, 
    ds.data_size_mb AS DataSizeMB,
    ds.log_size_mb AS LogSizeMB,
    (CAST(FILEPROPERTY(mf.file_id, 'SpaceUsed') AS INT) * 8 / 1024) AS UsedDataSizeMB,
    LEFT(ds.physical_name, CHARINDEX(':', ds.physical_name)) AS DriveLetter,
    vs.total_bytes / 1048576 AS DriveTotalSizeMB,
    vs.available_bytes / 1048576 AS DriveAvailableSizeMB 
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

$results = @()


ForEach ($instance in $finalInstancesList) {
    $instanceResults = @{}
     if ($instance -match '\\') {
        $instanceName = $instance.Split('\')[-1]
    }else{
        $instanceName = "MSSQLSERVER"
    }
    
    #check Sql auth 
   if($SqlUsername){
       
        $sqlAuthTest = Invoke-SQLQuery -Query "select @@version" -InstanceName $instance -SqlUsername $SqlUsername -SqlPassword $SqlPassword

        if($sqlAuthTest)
        {
            Write-Output "sql auth verified "
            $verifiedSqlUsername = $SqlUsername
            $verifiedSqlPassword = $SqlPassword
        }
        else{   
            Write-Output "Given sql username and password is not valid for instance $instanceName. Trying windows auth"
        }
        }
    
    ForEach ($queryKey in $queries.Keys) {
        $query = $queries[$queryKey]
        $output = Invoke-SQLQuery -Query $query -InstanceName $instance -SqlUsername $verifiedSqlUsername -SqlPassword $verifiedSqlPassword
        if ($output) {
            try {
                $tempOutput = $output[0] | ConvertFrom-Json
                $jsonOutput = $tempOutput | ConvertTo-Json -Depth 4
                $instanceResults[$queryKey] = $jsonOutput   
            }
            catch{
                $instanceResults[$queryKey] = $output   
            }     
        } else {
        Write-Output "Error running query '$queryKey' on instance $instance"
            $instanceResults[$queryKey] = "Error running query '$queryKey' on instance $instance"
        }
            
    
    }
    switch ($true) {
    {  $instanceResults['isClustered'] -eq 1 } {
        $instanceResults['deploymentType'] = 'fci'
        $clusterNodeQuery = "SET NOCOUNT ON; 
        SELECT 
        NodeName, 
        CASE 
            WHEN is_current_owner = 1 THEN 'Primary'
            ELSE 'Standby'
        END AS NodeRole
        FROM sys.dm_os_cluster_nodes FOR JSON PATH; "
        $instanceResults["ownerNodes"] = Invoke-SQLQuery -Query $clusterNodeQuery -InstanceName $instance -SqlUsername $SqlUsername -SqlPassword $SqlPassword
        break
    }
    { $instanceResults['isHadrEnabled'] -eq 1 } {
        $instanceResults['deploymentType'] = 'AOAG'
        break
    }
    default {
        $instanceResults['deploymentType'] = 'standalone'
        $ownerNodeQuery = "SET NOCOUNT ON; SELECT SERVERPROPERTY('ComputerNamePhysicalNetBIOS') FOR JSON PATH; "
        $instanceResults["ownerNode"] = Invoke-SQLQuery -Query $ownerNodeQuery -InstanceName $instance -SqlUsername $SqlUsername -SqlPassword $SqlPassword
    }
}

        $instanceResults.Remove('isClustered')
        $instanceResults.Remove('isHadrEnabled')
     
   
  $results += @{ $instanceName = $instanceResults }

}

$finalOutput = @{}

$finalOutput['windowsConfig'] = $windowsConfig

$finalOutput['sqlServerInfo'] = $results

$jsonResults = $finalOutput | ConvertTo-Json -Depth 8

$outputFilePath = Join-Path -Path $PSScriptRoot -ChildPath ("TCOResponse-" + (Get-Date -Format "yyyyMMddHHmmss") + ".json")
 
$jsonResults | Out-File -FilePath $outputFilePath 

Write-Output "TCO data collection completed. Output file path: $outputFilePath" 