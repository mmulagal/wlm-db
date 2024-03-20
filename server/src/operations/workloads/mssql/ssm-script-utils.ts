const GET_DRIVE_INFO = (deploymentType: string) => `#Get the list of all used drive letters
$disks = Get-Disk
$usedDriveDetails = @()
$deploymentType = '${deploymentType}'
foreach ($disk in $disks) {
    $volume = Get-Partition | Where-Object { $_.DiskNumber -eq $disk.Number } | Get-Volume
    if ($deploymentType -eq 'FCI') {
        $labels = Get-ClusterResource | Where-Object { $_.ResourceType -eq "Physical Disk" } | Where-Object { $_.Name -eq $volume.FileSystemLabel }
    }

    $output = [PSCustomObject]@{
        driveLetter = $volume.DriveLetter
        availableSize = $volume.SizeRemaining
        manufacturer = $disk.Manufacturer
    }

    if ($deploymentType -eq 'FCI') {
        $output | Add-Member -NotePropertyName "owner" -NotePropertyValue $labels.OwnerGroup.Name
    }

    $usedDriveDetails += $output
}

$usedDrivesInfoJson = $usedDriveDetails | ConvertTo-Json
Write-Host $usedDrivesInfoJson

`;

const GET_DEFAULT_DRIVES = `
#Get default data drive of SQL server
$defaultDataDrive = sqlcmd -Q @"
    SET NOCOUNT ON;
    DECLARE @DataPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultData', @DataPath OUTPUT;
    SELECT LEFT(@DataPath,1) AS CurrentDataDrive FOR JSON PATH;
"@ -y 0

#Get default log drive of SQL server
$defaultLogDrive = sqlcmd -Q @"
    SET NOCOUNT ON;
    DECLARE @LogPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;
    SELECT LEFT(@LogPath,1) AS CurrentLogDrive FOR JSON PATH;
"@ -y 0

Write-Output $defaultDataDrive $defaultLogDrive | ConvertTo-Json
`;

const RESOURCE_UTILIZATION = `$cpu =  sqlcmd -Q "SET NOCOUNT ON; set quoted_identifier ON;DECLARE @ts BIGINT;
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
ORDER BY record_id DESC FOR JSON PATH" -y 0

$disk = sqlcmd -Q "SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum
FROM sys.master_files mf1)
,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID
FROM presel pr
WHERE pr.RowNum = 1)
SELECT SUM(ovs.total_bytes) AS total, SUM(ovs.available_bytes) AS remaining
FROM roundtwo mf
CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH" -y 0 

$dbSize = sqlcmd -Q "SET NOCOUNT ON; SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH" -y 0

$memory = sqlcmd -Q "SET NOCOUNT ON; SELECT
    (processmem.physical_memory_in_use_kb * 1024) AS used,
    (sysmem.total_physical_memory_kb * 1024) AS total,
    ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,
    ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed
    FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem FOR JSON PATH" -y 0

$jsonObject = [PSCustomObject]@{
cpu = $cpu
disk = $disk
dbSize = $dbSize
memory = $memory
}

# Convert the object to JSON
$jsonString = $jsonObject | ConvertTo-Json

# Output the JSON string
$jsonString
`;

export { GET_DRIVE_INFO, GET_DEFAULT_DRIVES, RESOURCE_UTILIZATION };
