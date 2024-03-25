const GET_ACTIVE_NODE_DRIVE_INFO = (
    deploymentType: string
) => `$disks = Get-wmiObject -Query "SELECT DeviceID, Model FROM Win32_DiskDrive"
$results = @()
$deploymentType = '${deploymentType}'
foreach ($disk in $disks) {
    $object = New-Object PSObject -Property @{
        "Manufacturer" = $disk.Model
    }
    $partitions = get-wmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
    foreach ($partition in $partitions) {
        $logicalDisks = get-wmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
        foreach ($logicalDisk in $logicalDisks) {
            $object | Add-Member -MemberType NoteProperty -Name "LogicalDisk" -Value $logicalDisk.DeviceID
            $object | Add-Member -MemberType NoteProperty -Name "FileSystem" -Value $logicalDisk.FreeSpace
            if($deploymentType -eq 'FCI'){
                $clusterResource = Get-WmiObject -Namespace "root\\MSCluster" -Class "MSCluster_Resource" | Where-Object {$_.Name -eq $logicalDisk.VolumeName}
                $object | Add-Member -MemberType NoteProperty -Name "Owner" -Value $clusterResource.OwnerGroup
            }
        }
    }
    $results += $object
}
 
$results | convertTo-json
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

const GET_DEFAULT_COLLATION = `
#Get default collation of SQL server
$defaultSqlCollation = sqlcmd -Q @"
    SET NOCOUNT ON;
    SELECT CONVERT(nvarchar(128), SERVERPROPERTY('collation'));
"@ -y 0

#Get default version of SQL server
$sqlVersion = sqlcmd -Q @"
    SET NOCOUNT ON;
    SELECT @@VERSION;
"@ -y 0

Write-Output $defaultSqlCollation $sqlVersion | ConvertTo-Json
`;

const validateSQLInstanceConnectivity = (ec2instanceId: string, sqlinstancename: string) => `
    #Requires -Module AWS.Tools.FSX,AWS.Tools.SimpleSystemsManagement

    $ec2instanceId = '${ec2instanceId}'
    $sqlinstancename = '${sqlinstancename}'

    $sqlcmd = @"
        SET NOCOUNT ON;
        SELECT 
            SERVERPROPERTY('edition') AS sqlEdition,
            (SELECT COUNT(*) FROM sys.databases) AS noOfDatabases
        FOR JSON PATH
"@

    if ($responeObject -eq $null) {
        $responeObject = @{}
    }

    $SQLCredStore = "/netapp/wlmdb/$ec2instanceId"

    try {
        $credobject =  (Get-SSMParameter -Name $SQLCredStore -WithDecryption $true).Value | Out-String | ConvertFrom-Json 
        $sqlList = $credobject.sql
        $sqlCredentials = $sqlList | Where-Object { $_.sqlinstancename.ToLower() -eq $sqlinstancename.ToLower() }
        if ($sqlCredentials -eq $null) {
            $errorMessage = "No SQL instance found with the name $sqlinstancename"
            throw $errorMessage
        }
        $username = $sqlCredentials.username
        $password = $sqlCredentials.password

        if ($username -eq $null -or $password -eq $null) {
            $errorMessage = "SQL credentials not found for the instance $sqlinstancename"
            throw $errorMessage
        }
        $sqlresult = Sqlcmd -U $username -P $password -Q $sqlcmd -y 0
        $sqlresult | ConvertFrom-Json | ForEach-Object {
            $responeObject.add('sqlEdition', $_.sqlEdition)
            $responeObject.add('noOfDatabases', $_.noOfDatabases)
        }
        $responeObject.add('sqlInstanceConnectivity', $True)
    } catch {
        $responeObject.add('sqlerror', $_.Exception.Message)
        $responeObject.add('sqlInstanceConnectivity', $False)
    }
`;

const validateOntapConnectivity = (fsxid: string, fsxregion: string) => `
    #Requires -Module AWS.Tools.FSX,AWS.Tools.SimpleSystemsManagement

    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'

    if ($responeObject -eq $null) {
        $responeObject = @{}
    }

    try {
        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"

        $isprivatesubnet = $False
        $connection =  Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet
        if($connection -eq $False) {
            $isprivatesubnet = $True
            $regionCertificateificate = ''
        } else {
            $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
            Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile C:\\cfn\\FSxCertificate.pem
            $Certificate = Import-Certificate -FilePath C:\\cfn\\FSxCertificate.pem -CertStoreLocation Cert:\\LocalMachine\\Root
            $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        }

        $Params = @{
            "URI"         = 'https://management.' + $FSxID + '.fsx.' + $FSxRegion + '.amazonaws.com/api/cluster?fields=version'
            "Method"      = "GET"
            "Headers"     = @{"Authorization" = 'Basic ' + $FSxCredentialsInBase64 }
            "ContentType" = "application/json"
        }

        if ($isprivatesubnet -eq $False) {
            $ontapresult = Invoke-RestMethod @Params -Certificate $regionCertificateificate
        } else {
            $ontapresult = Invoke-RestMethod @Params -skipCertificateCheck
        }

        $responeObject.add('ontapconnectivity', $True)
    } catch {
        $responeObject.add('ontaperror', $_.Exception.Message)
        $responeObject.add('ontapconnectivity', $False)
    }
`;

export {
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_STANDBY_NODE_DRIVE_LIST,
    GET_DEFAULT_DRIVES,
    GET_DEFAULT_COLLATION,
    RESOURCE_UTILIZATION,
    validateSQLInstanceConnectivity,
    validateOntapConnectivity
};
