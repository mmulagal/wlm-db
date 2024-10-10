param (
    [string[]]$InstanceNames = @(),
    [string]$SqlUsername,
    [SecureString]$SqlPassword
)

function Invoke-SQLQuery {
    param (
        [string]$Query,
        [string]$InstanceName,
        [string]$SqlUsername,
        [SecureString]$SqlPassword
    )

    $sqlcmd = "sqlcmd -S $InstanceName -Q `"$Query`" -W -h-1"

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

$osEdition = (Get-WmiObject -Class Win32_OperatingSystem).Caption
$cpuCount = (Get-WmiObject -Class Win32_Processor).Count
$ramSize = (Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB
$nodeNames = @()
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

 
$windowsConfig = @{
    "OS Edition" = $osEdition
    "Number of CPUs" = $cpuCount
    "RAM Size (GB)" = $ramSize
    "Belongs to Cluster" = $belongsToCluster 
    "Node Names" = $nodeNames
}

if($belongsToCluster){
    $windowsConfig.Add("Cluster Node Names",$clusterNodes)
}

$sqlServiceList = Get-WmiObject win32_service | Where-Object { $_.DisplayName -like 'sql server (*' }
$finalInstancesList = @()

ForEach ($sqlService in $sqlServiceList) {
    $isDefaultInstance = -Not $sqlService.Name.Contains('$')
    $instanceName = $sqlService.Name -Replace "MSSQL\$", ""
    $instanceState = $sqlService.State 
    $serverInstance = If ($isDefaultInstance) { "$Env:ComputerName" } Else { "$Env:ComputerName\$instanceName" }
    if ($instanceState -eq "Running") { 
        if ($InstanceNames.Count -gt 0) {
            if ($InstanceNames -contains $instanceName) {
                $finalInstancesList += $serverInstance
            }
        } else {
            $finalInstancesList += $serverInstance
        }
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
SELECT @@VERSION AS SQLServerVersion;
"@

noOfDatabases = @"
SET NOCOUNT ON; SELECT count(name) FROM sys.databases;
"@

cpuUtilization = @"
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; WITH CPUUsage AS (
    SELECT
        DATEADD(ms, -1 * (rb.timestamp - si.ms_ticks), GETDATE()) AS EventTime,
        CAST(x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS INT) AS SystemIdle,
        CAST(x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SQLProcessUtilization)[1]', 'int') AS INT) AS SQLProcessUtilization
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

Iops = @"
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

StorageDetailsByDB = @"
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

$results = @{}

ForEach ($instance in $finalInstancesList) {
    $instanceResults = @{}
    ForEach ($queryKey in $queries.Keys) {
        $query = $queries[$queryKey]
        $output = Invoke-SQLQuery -Query $query -InstanceName $instance -SqlUsername $SqlUsername -SqlPassword $SqlPassword
        if ($output) {
            $instanceResults[$queryKey] = $output
        } else {
            $instanceResults[$queryKey] = "Error running query '$queryKey' on instance $instance"
        }
    }
    if ($instance -match '\\') {
        $instanceName = $instance.Split('\')[-1]
    }else{
        $instanceName = "MSSQLSERVER"
    }
    $results[$instanceName] = $instanceResults
}
$finalOutput = @{}

$finalOutput['WindowsConfig'] = $windowsConfig

$finalOutput['sqlServerInfo'] = $results

$jsonResults = $finalOutput | ConvertTo-Json

$outputFilePath = Join-Path -Path $PSScriptRoot -ChildPath "TCOResponse.json"
 
$jsonResults | Out-File -FilePath $outputFilePath 

Write-Output "TCO data collection completed. Output file path: $outputFilePath" 
