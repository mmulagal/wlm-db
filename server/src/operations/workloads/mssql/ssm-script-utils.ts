const GET_ACTIVE_NODE_DRIVE_INFO = (
    deploymentType: string
) => ` $disks = Get-WmiObject -Query "SELECT DeviceID, Model FROM Win32_DiskDrive"
$deploymentType  = '${deploymentType}'
$results = foreach ($disk in $disks) {
    $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"

    foreach ($partition in $partitions) {
        $logicalDisks = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"

        foreach ($logicalDisk in $logicalDisks) {
            $logicalDiskObject = [PSCustomObject]@{
                Manufacturer = $disk.Model
                LogicalDisk = $logicalDisk.DeviceID
                FileSystem = $logicalDisk.FreeSpace
            }

            if ($deploymentType -eq 'FCI') {
                $clusterResource = Get-WmiObject -Namespace "root\\MSCluster" -Class "MSCluster_Resource" | Where-Object { $_.Name -eq $logicalDisk.VolumeName }
                $logicalDiskObject | Add-Member -MemberType NoteProperty -Name "Owner" -Value $clusterResource.OwnerGroup
            }

            $logicalDiskObject
        }
    }
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

const GET_DEFAULT_DRIVES = (instanceName: string) => `
#Get default data drive of SQL server
$defaultDataDrive =  sqlcmd -S "${instanceName}" -Q @"
    SET NOCOUNT ON;
    DECLARE @DataPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultData', @DataPath OUTPUT;
    SELECT LEFT(@DataPath,1) AS CurrentDataDrive FOR JSON PATH;
"@ -y 0

#Get default log drive of SQL server
$defaultLogDrive = sqlcmd -S "${instanceName}"  -Q @"
    SET NOCOUNT ON;
    DECLARE @LogPath NVARCHAR(500);
    EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', N'DefaultLog', @LogPath OUTPUT;
    SELECT LEFT(@LogPath,1) AS CurrentLogDrive FOR JSON PATH;
"@ -y 0

Write-Output $defaultDataDrive $defaultLogDrive | ConvertTo-Json
`;

const RESOURCE_UTILIZATION = (
    instanceName: string
) => `$cpu =  sqlcmd -S "${instanceName}" -Q "SET NOCOUNT ON; set quoted_identifier ON;DECLARE @ts BIGINT;
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

$disk =  sqlcmd -S "${instanceName}" -Q "SET NOCOUNT ON; WITH presel AS (SELECT database_id, FILE_ID,LEFT(mf1.physical_name,3) AS Volume, ROW_NUMBER() OVER (PARTITION BY LEFT(mf1.physical_name,3) ORDER BY mf1.database_id) AS RowNum
FROM sys.master_files mf1)
,roundtwo AS (SELECT DISTINCT pr.database_id, pr.FILE_ID
FROM presel pr
WHERE pr.RowNum = 1)
SELECT SUM(ovs.total_bytes) AS total, SUM(ovs.available_bytes) AS remaining
FROM roundtwo mf
CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.FILE_ID) ovs FOR JSON PATH" -y 0 

$dbSize = sqlcmd -S "${instanceName}" -Q "SET NOCOUNT ON; SELECT CAST(SUM(CAST(size AS bigint)) * 8 * 1024 AS bigint) AS TotalSize FROM sys.master_files FOR JSON PATH" -y 0

$memory = sqlcmd -S "${instanceName}" -Q "SET NOCOUNT ON; SELECT
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

const GET_DEFAULT_COLLATION = (instanceName: string) => `
#Get default collation of SQL server
$defaultSqlCollation = sqlcmd -S "${instanceName}" -Q @"
    SET NOCOUNT ON;
    SELECT CONVERT(nvarchar(128), SERVERPROPERTY('collation'));
"@ -y 0

#Get default version of SQL server
$sqlVersion = sqlcmd -S "${instanceName}" -Q @"
    SET NOCOUNT ON;
    SELECT @@VERSION;
"@ -y 0

Write-Output $defaultSqlCollation $sqlVersion | ConvertTo-Json
`;

const validateSQLInstanceConnectivity = (ec2instanceId: string, sqlinstancename: string) => `
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    try {
        $ec2instanceId = '${ec2instanceId}'
        $sqlinstancename = '${sqlinstancename}'

        # Check if sqlcmd is installed or not
        $sqlcmdInstalled = (Get-Command -Type Application sqlcmd 2> $null) -ne $null

        if (-not $sqlcmdInstalled) {
            $responseObject.add('sqlerror', 'sqlcmd utility is not available. Install it by referring to https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility. If the command is already installed, ensure the "Path" environment variable contains the path of the command and retry the operation')
            $responseObject.add('sqlInstanceConnectivity', $False)
        } else {
            $sqlcmd = @"
            SET NOCOUNT ON;
                SELECT 
                    SERVERPROPERTY('edition') AS sqlEdition,
                    (SELECT COUNT(*) FROM sys.databases) AS noOfDatabases
                FOR JSON PATH
"@

            $SQLCredStore = "/netapp/wlmdb/$ec2instanceId"
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
                $responseObject.add('sqlEdition', $_.sqlEdition)
                $responseObject.add('noOfDatabases', $_.noOfDatabases)
            }
            $responseObject.add('sqlInstanceConnectivity', $True)
        }
    } catch {
        $responseObject.add('sqlerror', $_.Exception.Message)
        $responseObject.add('sqlInstanceConnectivity', $False)
    }
`;

const validateOntapConnectivity = (fsxid: string, fsxregion: string) => `
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    try {
        $FSxID = '${fsxid}'
        $FSxRegion = '${fsxregion}'

        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"

        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
        $tempfileObject = New-TemporaryFile
        $tempfile = $tempfileObject.FullName
        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $tempfile
        $Certificate = Import-Certificate -FilePath $tempfile -CertStoreLocation Cert:\\LocalMachine\\Root
        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        Remove-Item -Path $tempfile -Force -ErrorAction SilentlyContinue

        $Params = @{
            "URI"         = 'https://management.' + $FSxID + '.fsx.' + $FSxRegion + '.amazonaws.com/api/cluster?fields=version'
            "Method"      = "GET"
            "Headers"     = @{"Authorization" = 'Basic ' + $FSxCredentialsInBase64 }
            "ContentType" = "application/json"
        }

        $ontapresult = Invoke-RestMethod @Params -Certificate $regionCertificateificate

        $responseObject.add('ontapconnectivity', $True)
    } catch {
        $responseObject.add('ontaperror', $_.Exception.Message)
        $responseObject.add('ontapconnectivity', $False)
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

const getMappedOntapVolumesScript = (fsxid: string, fsxregion: string, instanceName: string) => `
    $WarningPreference = 'SilentlyContinue';
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    try {
        #Requires -Module AWS.Tools.SimpleSystemsManagement

        $FSxID = '${fsxid}'
        $FSxRegion = '${fsxregion}'

        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"

        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
        $tempfileObject = New-TemporaryFile
        $tempfile = $tempfileObject.FullName
        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $tempfile
        $Certificate = Import-Certificate -FilePath $tempfile -CertStoreLocation Cert:\\LocalMachine\\Root
        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        Remove-Item -Path $tempfile -Force -ErrorAction SilentlyContinue

        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
            WHERE vs.volume_mount_point != 'C:\\'
            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) = 'MDF'
            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) != 'TEMPDB'
            FOR JSON PATH;
"@

        $sqlresponse =  sqlcmd -S "${instanceName}" -Q $sqlquery -y 0;

        if (!($sqlresponse.count -gt 0)) {
            write-error "Couldn't get database windows volumes"
            return
        }

        Function Get-SerialNumberOfWinVolumes {
            param(
                [Parameter(Mandatory = $true)]
                [string[]]$sqlresponse
            )

            $winvolumes = $sqlresponse | convertFrom-Json

            $filterString = ''
            foreach ($winvolume in $winvolumes) {
                $volname = $winvolume.volumename
                if ($volname -ne '') {
                    $filterString += "VolumeName = '$volname' or "
                }
            }

            $filterString = $filterString.TrimEnd(' or ')

            $volumes = Get-CimInstance -Query "SELECT DeviceID, VolumeName FROM Win32_LogicalDisk where $filterString"
            $Lunserialnumbers = @()
            foreach ($volume in $volumes) {
                $partitions = Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($volume.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
                foreach ($partition in $partitions) {
                    $diskdrives = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
                    foreach ($diskdrive in $diskdrives) {
                        $Lunserialnumbers += $diskdrives.SerialNumber
                    }
                }
            }

            $Lunserialnumbers
        }

        Function Invoke-ONTAPGetRequest {
            param(
                [Parameter(Mandatory = $false)]
                [string]$ApiEndpoint,

                [Parameter(Mandatory = $false)]
                [string]$ApiQueryFilter
            )

            $Params = @{
                "URI"     = 'https://' + $FSxHostName + '/api' + $ApiEndpoint + '?' + $ApiQueryFilter
                "Method"  = "GET"
                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}
                "ContentType" = "application/json"
            }

            return Invoke-RestMethod @Params -Certificate $regionCertificateificate
        }

        Function Get-LunFromSerialNumber($SerialNumbers) {
            Write-Debug "Get ONTAP lun name from serial numbers for: $SerialNumbers"

            $QueryFilter = ''
            foreach ($SerialNumber in $SerialNumbers) {
                if ($SerialNumber -ne '') {
                    $QueryFilter += $SerialNumber + '|'
                }
            }
            $QueryFilter = $QueryFilter.TrimEnd('|')

            $Params = @{
                "ApiEndPoint" = "/storage/luns"
            }

            if ($QueryFilter -ne '') {
                $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
            }

            $Response = Invoke-ONTAPGetRequest @Params

            $LunRecords = $Response.records

            [string[]]$LunNames = @()
            foreach ($record in $LunRecords) {
                $LunNames += $record.name
            }

            Write-Debug "Lun names: $LunNames"
            return $LunNames
        }

        Function Get-VolumeIdFromName($Names) {
            Write-Debug "Get Volume Id from name: $Names"

            $QueryFilter = ''
            foreach ($Name in $Names) {
                if ($Name -ne '') {
                    $QueryFilter += $Name + '|'
                }
            }
            $QueryFilter = $QueryFilter.TrimEnd('|')

            $Params = @{
                "ApiEndPoint" = "/storage/volumes"
            }

            if ($QueryFilter -ne '') {
                $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}
            }

            return Invoke-ONTAPGetRequest @Params
        }

        Function GetSMBVolumes { 
            param(
                [Parameter(Mandatory = $true)]
                [string[]]$sqlresponse
            )
            
        $SmbShares = $sqlresponse | convertFrom-Json
          
        $Params = @{
                "ApiEndPoint" = "/protocols/cifs/shares"
            }
            
         $QueryFilter = ''
         foreach ($SmbShare in $SmbShares) {
                $volname = $SmbShare.volumename
                if ($volname -ne '') {
                    $QueryFilter += $volname + '|'
                }
            }
        $QueryFilter = $QueryFilter.TrimEnd('|')
        if ($QueryFilter -ne '') {
            $Params += @{"ApiQueryFilter" = "name=$QueryFilter" + "&fields=volume"}
        }
          
        $cifsShares = Invoke-ONTAPGetRequest @Params
        $cifsRecords = $cifsShares.records

        $volumeIds = @()
        foreach ($record in $cifsRecords) {
            $object = New-Object PSObject -Property @{ "uuid" = $record.volume.uuid }
            $volumeIds += $object
            }
        
        if ($volumeIds.count -eq 1) {
            return @(,$volumeIds)
        }
        
        return $volumeIds
            
        }

        $SerialNumbers = Get-SerialNumberOfWinVolumes $sqlresponse

        #if (!($SerialNumbers.count -gt 0)) {
        #    write-error "Couldn't get windows volume serial numbers"
        #    return
        #}

        $VolumeNames = Get-LunFromSerialNumber $SerialNumbers

        if (!($VolumeNames.count -gt 0)) {
            write-error "Couldn't get associated Ontap LUN volume names"
            return
        }

        $volumes = Get-VolumeIdFromName $VolumeNames

        $cifsVolumes = GetSMBVolumes $sqlResponse

        if($cifsVolumes){

            if ($null -ne $volumes.records) {
                $volumes["records"]+=$cifsVolumes
            }
            else {
                $volumes = @{"records" = $cifsVolumes} 
                
            }
        } 
    
        return ($volumes | ConvertTo-Json)
    } catch {
        Write-Error $_.Exception.Message
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

        $SsmParameter = (Get-SSMParameter -Name "/netapp/wlmdb/$FSxID" -WithDecryption $True).Value | Out-String | ConvertFrom-Json
        $FSxUserName = $SsmParameter.fsx.username
        $FSxPassword = $SsmParameter.fsx.password
        $FSxCredentialsInBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($FSxUserName + ':' + $FSxPassword))
        $FSxHostName = "management.$FSxID.fsx.$FSxRegion.amazonaws.com"
        
        $FSxCertificateificateUri = 'https://fsx-aws-Certificates.s3.amazonaws.com/bundle-' + $FSxRegion + '.pem'
        $tempfileObject = New-TemporaryFile
        $tempfile = $tempfileObject.FullName
        Invoke-WebRequest -Uri $FSxCertificateificateUri -OutFile $tempfile
        $Certificate = Import-Certificate -FilePath $tempfile -CertStoreLocation Cert:\\LocalMachine\\Root
        $regionCertificateificate = Get-ChildItem -Path Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like $Certificate.Subject }
        Remove-Item -Path $tempfile -Force -ErrorAction SilentlyContinue
     
        Function Invoke-ONTAPGetRequest {
            param(
                [Parameter(Mandatory = $false)]
                [string]$ApiEndpoint,
     
                [Parameter(Mandatory = $false)]
                [string]$ApiQueryFilter,
     
                [Parameter(Mandatory = $false)]
                [string]$ApiQueryFields
            )
     
            $Ampersand = ''
            if ($ApiQueryFields -ne '' -and $ApiQueryFilter -ne '') {
                $Ampersand = '&';
            }
            $Params = @{
                "URI"     = 'https://' + $FSxHostName + '/api' + $ApiEndpoint + '?' + $ApiQueryFilter + $Ampersand + $ApiQueryFields
                "Method"  = "GET"
                "Headers" =@{"Authorization" = "Basic $FSxCredentialsInBase64"}
                "ContentType" = "application/json"
            }
     
            return Invoke-RestMethod @Params -Certificate $regionCertificateificate
        }
     
        $responseObject = Invoke-ONTAPGetRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
    } catch {
        $responseObject = @{
            error = $_.Exception.Message
        }
    }
    $responseObject | ConvertTo-Json -Depth 5
    
`;
// prettier-ignore
const INSTANCE_DETAILS = 'Get-WmiObject win32_service | Where-Object {$_.DisplayName -like "sql server (*)"} | Select-Object @{Name=\'instanceName\'; Expression={$_.Name}}, @{Name=\'instanceState\'; Expression={$_.State}} | ConvertTo-Json';

const copyPowerShellModule = (s3SignedURL: string, modules: string) => `
    $s3SignedUrl = '${s3SignedURL}'
    $moduleNames = ${modules}

    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    # Get the first PSModulePath that contains "WindowsPowerShell" from this path C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules
    $destinationPath = $env:PSModulePath.split(';')[0]

    # Check if any module is not installed
    function Check-ModuleInstalled {
        param(
            [Parameter(Mandatory=$true)]
            [string[]]$moduleNames
        )

        foreach ($module in $moduleNames) {
            if (-not (Get-Module -ListAvailable -Name $module)) {
                return $false
            }
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
            $Null = Expand-Archive -Path "$Env:Temp\\aws_ssm.zip" -DestinationPath $destinationPath -Force

            # Ensure the modules are available for use
            $allInstalled = Check-ModuleInstalled -moduleNames $moduleNames

            if (-not $allInstalled) {
                $responseObject.add('installStatus', "Few modules are not installed")
            } else {
                $responseObject.add('installStatus', "All modules are installed")
            }
        } catch {
            $responseObject.add('installFailure', $_.Exception.Message)
        }
    } else {
        $responseObject.add('installStatus', "All modules are already installed")
    }
`;

export {
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_STANDBY_NODE_DRIVE_LIST,
    GET_DEFAULT_DRIVES,
    GET_DEFAULT_COLLATION,
    RESOURCE_UTILIZATION,
    validateSQLInstanceConnectivity,
    validateOntapConnectivity,
    installPowerShellModule,
    getMappedOntapVolumesScript,
    restGetUtilForOntap,
    INSTANCE_DETAILS,
    copyPowerShellModule
};
