import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME, SQL_CASE_INSENSITIVE } from '../../../utils/consts';

/* eslint-disable no-useless-escape */

import { GOOGLE_DNS, SCRIPT_VERSON_FILE } from './const';
import {
    compressResponse,
    invokeOntapRequestTemplate,
    ontapRestRequest,
    ontapRestRequestBootstrap,
    enableCredSSP,
    invokeCommandWithCredSSP
} from './common-templates';
import { REQUIRED_PS_MODULES_FOR_MANAGEMENT } from './discover-consts';

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
    checkManageReadiness: boolean = false
) => ` 
    $env:Path += ';C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\'   
    $ProgressPreference = 'SilentlyContinue'
    $checkManageReadiness = [System.Convert]::ToBoolean('${checkManageReadiness}')
    $windowsUser = [System.Convert]::ToBoolean('${windowsUser}')

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
                            $sqlCredentials = $domainList | Where-Object { $_.sqlinstancename.ToLower() -eq $sqlinstancename.ToLower() }
                            if ($sqlCredentials -eq $null) {
                                $sqlCredentials = $domainList | Where-Object { $_.sqlinstancename.ToUpper() -eq 'MSSQLSERVER' }
                            }
                        `
                            : `
                            $sqlList = $credobject.sql
                            $sqlCredentials = $sqlList | Where-Object { $_.sqlinstancename.ToLower() -eq $sqlinstancename.ToLower() }
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

const validateOntapConnectivity = (fsxids: string[], fsxregion: string) => `
    $ProgressPreference = 'SilentlyContinue'
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    $connection = Test-Connection -ComputerName fsx-aws-certificates.s3.amazonaws.com -Quiet -Count 1
    if ($connection -ne $True) {
        # Set the registry key to disable certificate revocation check in case of private subnet
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\WinTrust\\Trust Providers\\Software Publishing\\" -Name State -Value 146944 -Force | Out-Null
    }
    $ssmmodulePath =  (Get-Module -Name 'AWS.Tools.SimpleSystemsManagement' -ListAvailable).Path
    if($ssmmodulePath -is [System.Array]) {
        $ssmmodulePath = $ssmmodulePath[0]
    }

    Import-Module -Name $ssmmodulePath

    $fsxids = '${JSON.stringify(fsxids)}' | ConvertFrom-Json
    $responseObject['fsxResults'] = @()

    $fsxids | ForEach-Object {
        $fsxid = $_
        try {
            $FSxRegion = '${fsxregion}'

            # Ensure ontapRestRequest is defined or replace it with the correct implementation
            ${ontapRestRequest}
            $ontapresult = Invoke-ONTAPRequest -ApiEndPoint '/cluster?fields=version'

            $responseObject['fsxResults'] += @{
                'fsxId' = $fsxid
                'ontapconnectivity' = $True

            }
        } catch {
            $responseObject['fsxResults'] += @{
                'fsxId' = $fsxid
                'ontaperror' = $_.Exception.Message
                'ontapconnectivity' = $False
            }
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

const getMappedOntapVolumesScript = (
    fsxid: string,
    fsxregion: string,
    isSystemDatabase: string = '$false',
    instances: string[] = [],
    sqlAuthEnabled: boolean = false,
    fields: string = '',
    includeLogVolumes: boolean = false,
    svmOntapUuid: string = '',
    instanceLevelFsxnIds: Record<string, object> = {}
) => `
    #Get Mapped Ontap Volumes
    $WarningPreference = 'SilentlyContinue';
    $ProgressPreference = 'SilentlyContinue'
    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    # Define the path of the directory you want to create
    $LogFilesPath = "C:\\cfn\\log"

    # Check if the directory exists
    if (-not (Test-Path -Path $LogFilesPath -PathType Container)) {
        New-Item -Path $LogFilesPath -ItemType Directory
    } 

    $includeLogVolumes = [System.Convert]::ToBoolean('${includeLogVolumes}')
    try {
        #Requires -Module AWS.Tools.SimpleSystemsManagement

        $FSxID = '${fsxid}'
        $FSxRegion = '${fsxregion}'
        $instances = '${JSON.stringify(instances)}' | ConvertFrom-Json
        $additionalFields = '${fields}'
        $svmOntapUuid = '${svmOntapUuid}'
        $instanceLevelFsxnIds = '${JSON.stringify(instanceLevelFsxnIds)}' | ConvertFrom-Json
        ${getSqlCredentials(sqlAuthEnabled)}
        $sqlInstances = $instances | ForEach-Object {
            $serverInstanceName = $_
            $executableInstance = "$env:COMPUTERNAME"
            if ($serverInstanceName -ne 'MSSQLSERVER') {
                $executableInstance = "$env:COMPUTERNAME\\$serverInstanceName"
            }
            ${validateSQLInstanceCredentials}
            return @{
                sqlCredential = $sqlCredential
                executableInstance = $executableInstance
                serverInstanceName = $serverInstanceName
            }
        }

        ${invokeOntapRequestTemplate}

        $visitedFileSystems = @{}
        $instanceRespones = @{}
        ${enableCredSSP}
        ${invokeCommandWithCredSSP}
        if ($isAtleastOneCredentialIsOfDomain) {
            Enable-CredSSP
        }
        $sqlInstances | ForEach-Object {
            try {
                $sqlCredential = $_.sqlCredential
                $executableInstance = $_.executableInstance
                $serverInstanceName = $_.serverInstanceName

                ${ontapRestRequestBootstrap}

                $instanceLevelFsxnId = $($instanceLevelFsxnIds.$serverInstanceName.fsxId)
                Write-Debug "Instance Level FSxN Id: $instanceLevelFsxnId"
                if ([string]::IsNullOrEmpty($instanceLevelFsxnId)) {
                    $instanceLevelFsxnId = $FSxID
                }
                if ($instanceLevelFsxnId -ne $null -and -not $visitedFileSystems.ContainsKey($instanceLevelFsxnId)) {
                    $FSxNDetails = Get-FSxNDetails -fsxId $instanceLevelFsxnId
                    $visitedFileSystems += @{$instanceLevelFsxnId = @{
                        FSxCredentialsInBase64 = $FSxNDetails.FSxCredentialsInBase64
                        FSxHostName = $FSxNDetails.FSxHostName
                    }}
                }

                if (${isSystemDatabase}) {
                    $sqlquery = @"
                        SET NOCOUNT ON;
                        DECLARE @JSONData nvarchar(max)
                        SET @JSONData = (SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                        INNER JOIN sys.databases d ON mf.database_id = d.database_id
                        CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) ${SQL_CASE_INSENSITIVE} = 'MDF'
                        AND d.name ${SQL_CASE_INSENSITIVE} IN ('master', 'model', 'msdb', 'tempdb')
                        FOR JSON PATH)
                        SELECT @JSONData;
"@
                    $sqlqueryfordatabaseandvolumelist = @"
                        SET NOCOUNT ON;
                        DECLARE @JSONData nvarchar(max)
                        SET @JSONData = (SELECT DISTINCT 
                            DB_NAME(mf.database_id) AS DatabaseName,
                            vs.logical_volume_name as VolumeName,
                            vs.volume_id as VolumeId
                        FROM 
                            sys.master_files AS mf
                        INNER JOIN 
                            sys.databases d ON mf.database_id = d.database_id
                        CROSS APPLY 
                            sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE 
                            vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) ${SQL_CASE_INSENSITIVE} = 'MDF'
                            AND d.name ${SQL_CASE_INSENSITIVE} IN ('master', 'model', 'msdb', 'tempdb')
                        FOR JSON PATH)
                        SELECT @JSONData;
"@
                } else {
                    $sqlquery = @"
                        SET NOCOUNT ON;
                        DECLARE @JSONData nvarchar(max)
                        SET @JSONData = (SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                        CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) ${SQL_CASE_INSENSITIVE} = 'MDF'
                        AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) ${SQL_CASE_INSENSITIVE} != 'TEMPDB'
                        FOR JSON PATH)
                        SELECT @JSONData;
"@

                    if($includeLogVolumes) {
                        $sqlquery = @"
                            SET NOCOUNT ON;
                            DECLARE @JSONData nvarchar(max)
                            SET @JSONData = (SELECT DISTINCT vs.logical_volume_name as volumename FROM sys.master_files AS mf
                            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                            WHERE vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 5, 6)) ${SQL_CASE_INSENSITIVE} != 'TEMPDB'
                            FOR JSON PATH)
                            SELECT @JSONData;
"@
                    }
                    # Get the windows volumes of the databases with the mdf file volume name
                    $sqlqueryfordatabaseandvolumelist = @"
                        SET NOCOUNT ON;
                        DECLARE @JSONData nvarchar(max)
                        SET @JSONData = (SELECT DISTINCT 
                            DB_NAME(mf.database_id) AS DatabaseName,
                            vs.logical_volume_name as VolumeName,
                            vs.volume_id as VolumeId
                        FROM 
                            sys.master_files AS mf
                        CROSS APPLY 
                            sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE 
                            vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                            AND REVERSE(SUBSTRING(REVERSE(mf.physical_name), 1, 3)) ${SQL_CASE_INSENSITIVE} = 'MDF'
                        FOR JSON PATH)
                        SELECT @JSONData;
"@

                if($includeLogVolumes) {
                        $sqlqueryfordatabaseandvolumelist = @"
                        SET NOCOUNT ON;
                        DECLARE @JSONData nvarchar(max)
                        SET @JSONData = (SELECT DISTINCT 
                            DB_NAME(mf.database_id) AS DatabaseName,
                            vs.logical_volume_name as VolumeName,
                            vs.volume_id as VolumeId
                        FROM 
                            sys.master_files AS mf
                        CROSS APPLY 
                            sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
                        WHERE 
                            vs.volume_mount_point ${SQL_CASE_INSENSITIVE} != 'C:\\'
                        FOR JSON PATH)
                        SELECT @JSONData;
"@
                    }
                }
                $MappedVolumesErrorFile = "C:\\cfn\\log\\mapped_volumes_err_$serverInstanceName_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().toString()).log"
                if ($sqlCredential.useDomainAuth -eq $True) {
                    $sqlresponse = Invoke-CommandWithCredSSP -sqlquery $sqlquery -instanceName $executableInstance;
                } elseif ($sqlCredential.useSqlAuth -eq $True) {
                    $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $executableInstance -Q $sqlquery -y 0;
                } else {
                    $sqlresponse =  sqlcmd -S $executableInstance -Q $sqlquery -y 0;
                }

                if (!($sqlresponse.count -gt 0)) {
                    throw "Couldn't get database windows volumes"
                    return
                }

                if ($sqlCredential.useDomainAuth -eq $True) {
                    $sqlqueryresponse = Invoke-CommandWithCredSSP -sqlquery $sqlqueryfordatabaseandvolumelist -instanceName $executableInstance -extraArguments -r1;
                } elseif ($sqlCredential.useSqlAuth -eq $True) {
                    $sqlqueryresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S $executableInstance -Q $sqlqueryfordatabaseandvolumelist -y 0 -r1 2>&1
                } else {
                    $sqlqueryresponse =  sqlcmd -S $executableInstance -Q $sqlqueryfordatabaseandvolumelist -y 0 -r1 2>&1
                }
                
                if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
                    $sqlqueryresponse | Out-File -FilePath $MappedVolumesErrorFile
                    throw $sqlqueryresponse
                }
            
                Function Get-VolumeIdsList($sqlqueryresponse) {        
                    $sqlJsonResponse = $sqlqueryresponse | convertFrom-Json
                
                    # Create an array to store the database-volume ids
                    $volumeIds = @()
                
                    foreach ($record in $sqlJsonResponse) {    
                        if ($null -ne $record.volumeId) {
                            # remove the empty spaces and new lines from the volume id
                            $cleanVolumeId = $record.volumeId.Replace(" ", "").Replace("\`r","").Replace("\`n","")
                            # Add the ids to the array only if they're not already there
                            if ($volumeIds -notcontains $cleanVolumeId) {
                                $volumeIds += $cleanVolumeId
                            }
                        }
                    }
                    # Output the array
                    $volumeIds
                }

                Function Get-SerialNumberOfWinVolumes($winvolumes) {
                
                    try {
                        $Lunserialnumbers = @()
                        $VolumeSerialMapping = @{}
                        $BusTypes = @()

                        Write-Debug "win volumes: $($winvolumes | ConvertTo-Json)"
                
                        $allDisks = Get-Disk | Select SerialNumber, Number, BusType
                
                        foreach ($volumeid in $winvolumes) {
                            if ($null -eq $volumeid) {
                                Write-Debug "Skipping volume with null volumeid"
                                continue
                            }
                
                            $vol = Get-Volume -Path $volumeid | Get-Partition | Where-Object DiskNumber -in $allDisks.Number
                            $serialNumber = $allDisks | Where-Object Number -eq $vol.DiskNumber | Select -ExpandProperty SerialNumber
                            $BusType = $allDisks | Where-Object Number -eq $vol.DiskNumber | Select -ExpandProperty BusType

                            $VolumeSerialMapping[$volumeid] = $serialNumber
                            $Lunserialnumbers += $serialNumber
                            $BusTypes += $BusType
                        }

                        $Lunserialnumbers = $Lunserialnumbers | where { -not $_.StartsWith('vol') } | select -Unique
                        if ($Lunserialnumbers.count -eq 0 -and $BusTypes.Count -gt 0 -and  $BusTypes -notcontains 'iSCSI') {
                            throw "We support only iSCSI volumes"
                        }

                        return @{
                            Lunserialnumbers = $Lunserialnumbers | select -Unique
                            VolumeSerialMapping = $VolumeSerialMapping
                        }
                    }
                    catch {
                        throw "An error occurred while getting the serial numbers of Windows volumes: $_"
                    }
                }

                Function Get-LunFromSerialNumber($SerialNumbers, $VolumeSerialMapping) {
                    Write-Debug "Get ONTAP lun name from serial numbers for: $VolumeSerialMapping"

                    $QueryFilter = ''
                    foreach ($SerialNumber in $SerialNumbers) {
                        if ($SerialNumber -ne '') {
                            $QueryFilter += [System.Web.HttpUtility]::UrlEncode($SerialNumber) + '|'
                        }
                    }
                    
                    $QueryFilter = $QueryFilter.TrimEnd('|')

                    if ($svmOntapUuid -ne '') {
                        $QueryFilter += "&svm.uuid=$svmOntapUuid"
                    }

                    $Params = @{
                        "ApiEndPoint" = "/storage/luns"
                    }

                    [string[]]$LunNames = @()
                    $VolumeLunMapping = @{}
                    if ($QueryFilter -ne '') {
                        $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
                        $Params += @{
                            "FSxCredentialsInBase64" = $($visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64);
                            "FSxHostName" = $($visitedFilesystems.$instanceLevelFsxnId.FSxHostName);
                        }
                        $Response = Invoke-ONTAPRequest @Params

                        $LunRecords = $Response.records

                        Write-Debug "Lun Records Mapping: $($LunRecords | ConvertTo-Json)"

                        foreach ($record in $LunRecords) {
                            $LunNames += $record.name
                            foreach ($volumeId in $VolumeSerialMapping.Keys) {
                                if ($VolumeSerialMapping[$volumeId] -eq $record.serial_number) {
                                    $lunName = $record.name -replace '^\\/vol\\/(.*?)\\/.*$', '$1'
                                    $VolumeLunMapping[$volumeId] = $lunName
                                }
                            }
                        }
                    }
                    Write-Debug "Lun volume Mapping: $($VolumeLunMapping | ConvertTo-Json)"
                    Write-Debug "Lun names: $LunNames"
                    return @{
                        LunNames = $LunNames
                        VolumeLunMapping = $VolumeLunMapping
                    }
                }

                Function Get-VolumeIdFromName($Names, $volumeLunMapping) {
                    Write-Debug "Get Volume Id from name: $Names"

                    $QueryFilter = ''
                    foreach ($Name in $Names) {
                        if ($Name -ne '') {
                            $QueryFilter += [System.Web.HttpUtility]::UrlEncode($Name) + '|'
                        }
                    }
                    $QueryFilter = $QueryFilter.TrimEnd('|')
                    
                    if (-not [string]::IsNullOrEmpty($($instanceLevelFsxnIds.$serverInstanceName.svmUuid))) {
                        $QueryFilter += "&svm.uuid=$($instanceLevelFsxnIds.$serverInstanceName.svmUuid)"
                    } elseif ($svmOntapUuid -ne '') {
                        $QueryFilter += "&svm.uuid=$svmOntapUuid"
                    }

                    $Params = @{
                        "ApiEndPoint" = "/storage/volumes"
                    }

                    if ($QueryFilter -ne '') {
                        $Params += @{"ApiQueryFilter" = "name=$QueryFilter" + "&fields=snapshot_count,$additionalFields"}
                        $Params += @{
                            "FSxCredentialsInBase64" = $($visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64);
                            "FSxHostName" = $($visitedFilesystems.$instanceLevelFsxnId.FSxHostName);
                        }

                        $Response = Invoke-ONTAPRequest @Params

                        $VolumeNameMapping = @{}
                        foreach ($record in $Response.records) {
                            foreach ($volumeId in $VolumeLunMapping.Keys) {
                                if ($VolumeLunMapping[$volumeId] -eq $record.name) {
                                    $VolumeNameMapping[$volumeId] = @{
                                        "uuid" = $record.uuid
                                        "name" = $record.name
                                    }
                                }
                            }
                        }
                    }
                    Write-Debug "final Mapping: $($VolumeLunMapping | ConvertTo-Json)"

                    return @{
                        Response = $Response
                        volumeNameMapping = $VolumeNameMapping
                    }
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
                                $QueryFilter += [System.Web.HttpUtility]::UrlEncode($volname) + '|'
                            }
                        }
                    $QueryFilter = $QueryFilter.TrimEnd('|')
                    $volumeIds = @()
                    if ($QueryFilter -ne '') {
                        $Params += @{"ApiQueryFilter" = "name=$QueryFilter" + "&fields=volume"}
                        $Params += @{
                            "FSxCredentialsInBase64" = $($visitedFilesystems.$instanceLevelFsxnId.FSxCredentialsInBase64);
                            "FSxHostName" = $($visitedFilesystems.$instanceLevelFsxnId.FSxHostName);
                        }
                    
                        $cifsShares = Invoke-ONTAPRequest @Params
                        $cifsRecords = $cifsShares.records

                        foreach ($record in $cifsRecords) {
                            $object = New-Object PSObject -Property @{ "uuid" = $record.volume.uuid }
                            $volumeIds += $object
                        }
                    }
                    if ($volumeIds.count -eq 1) {
                        return @(,$volumeIds)
                    }
                    
                    return $volumeIds
                }

                Function updateVolumeMappings($sqlqueryresponse, $volumeNameMapping) {
                    try {
                        $sqlJsonResponse = $sqlqueryresponse | convertFrom-Json
                        $newArray = @()
                        
                        foreach ($dbMapping in $sqlJsonResponse) {
                            # Create a new object to store the cleaned keys and values
                            $cleanDbMapping = New-Object PSObject
                
                            foreach ($property in $dbMapping.PSObject.Properties) {
                                # Remove new lines from the key
                                $cleanKey = $property.Name.Replace("\`r", "").Replace("\`n", "")
                                # Remove new lines from the value
                                $cleanValue = $property.Value -replace "\`r", "" -replace "\`n", ""
                                $cleanDbMapping | Add-Member -NotePropertyName $cleanKey -NotePropertyValue $cleanValue
                            }
                
                            $volumeId = $cleanDbMapping.VolumeId
                            $volumeId = $volumeId.Replace(" ", "")

                            if ($null -ne $volumeId -and $null -ne $volumeNameMapping -and $volumeNameMapping.ContainsKey($volumeId)) {
                                $value = $volumeNameMapping[$volumeId]
                                $newObject = @{
                                    "databaseName" = $cleanDbMapping.DatabaseName
                                    "ontapVolumeuuid" = $value["uuid"]
                                }
                
                                $newArray += $newObject
                            }
                        }
                        return $newArray;
                    } catch {
                        Write-Debug "Volume Ids: $($sqlqueryresponse | convertFrom-Json)"
                        throw $_.Exception.Message
                    }
                }

                Function Process-Records($inputObject) {
                    $output = @()
                
                    if ($null -ne $inputObject.records) {
                        foreach ($record in $inputObject.records) {
                            $newRecord = New-Object PSObject
                            $record.PSObject.Properties | Where-Object { $_.Name -ne '_links' } | ForEach-Object {
                                $newRecord | Add-Member -NotePropertyName $_.Name -NotePropertyValue $_.Value
                            }
                            $output += $newRecord
                        }
                    }

                    return @{ "records" = $output }
                }

                Write-Debug "query List: $sqlqueryresponse"

                $volumeIds = Get-VolumeIdsList $sqlqueryresponse

                Write-Debug "volume List: $volumeIds"

                $result = Get-SerialNumberOfWinVolumes $volumeIds
                $SerialNumbers = $result.Lunserialnumbers
                
                # if (!($SerialNumbers.count -gt 0)) {
                #    throw "Couldn't get windows volume serial numbers"
                #    return
                # }

                Write-Debug "Serial Numbers: $SerialNumbers"
                Write-Debug "Volume Serial Mapping: $($result.VolumeSerialMapping | ConvertTo-Json)"
                
                $lunResult = Get-LunFromSerialNumber $SerialNumbers $result.VolumeSerialMapping
                $VolumeNames = $lunResult.LunNames
                $volumeLunMapping = $lunResult.VolumeLunMapping

                Write-Debug "Volume Names: $VolumeNames"
                Write-Debug "Volume Lun Mapping: $($volumeLunMapping | ConvertTo-Json)"
                
                if (!($VolumeNames.count -gt 0)) {
                    throw "Couldn't get associated Ontap LUN volume names"
                    return
                }

                $volumeResult = Get-VolumeIdFromName $VolumeNames $volumeLunMapping

                $volumes = $volumeResult.Response
                $volumeNameMapping = $volumeResult.volumeNameMapping
                Write-Debug "Volume Ids: $($volumes | ConvertTo-Json)"
                Write-Debug "Volume Name mapping: $($volumeNameMapping | ConvertTo-Json)"

                $cifsVolumes = GetSMBVolumes $sqlResponse

                Write-Debug "CIFS Volumes:  $($cifsVolumes | ConvertTo-Json)"

                if($cifsVolumes){
                    if ($null -ne $volumes.records) {
                        $volumes["records"]+=$cifsVolumes
                    }
                    else {
                        $volumes = @{"records" = $cifsVolumes} 
                        
                    }
                } 

                $processedRecords = Process-Records $volumes
                
                Write-Debug "Processed volumes:  $($processedRecords | ConvertTo-Json)"
                $volumeDBMap = updateVolumeMappings $sqlqueryresponse $volumeNameMapping
                
                Write-Debug "final volume details: $($volumeDBMap | ConvertTo-Json)"

                $responseObject = @{}
                $responseObject.add('volumes', $processedRecords)
                $responseObject.add('volumeDBMap', $volumeDBMap)
                $responseObject.add('lunNames', $lunResult.LunNames)
                $instanceRespones[$serverInstanceName] = $responseObject
            } catch {
                Write-Information "An error occurred while processing the records: $_.Exception.Message"
                $instanceRespones[$serverInstanceName] = "error: $_"
            }
        }
        # disableCredSSP is removed as most of machines will be part of domain and we are enabling CredSSP at domain level.
        $response = $instanceRespones | ConvertTo-Json -Depth 10

        if([string]::IsNullOrEmpty($response)) {
            throw "Failed to compress the response because the response is either null or empty. $response"
        }
        ${compressResponse}
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
const INSTANCE_DETAILS = 'Get-WmiObject win32_service | Where-Object {$_.DisplayName -like "sql server (*)"} | Select-Object @{Name=\'instanceName\'; Expression={$_.Name}}, @{Name=\'instanceState\'; Expression={$_.State}} | ConvertTo-Json';

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

// All the queries using the following template must respond in json format (use FOR JSON PATH), else the conversion will fail.
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
    $queryResponse = $queryResponse | ConvertFrom-Json
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
        [boolean]$IsMultiQuery = $False

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
            $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0;
        }
        else {
            $sqlresponse =  sqlcmd -U $sqlCredential.username -P $sqlCredential.password -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments;
        }
    }

    if ($($LASTEXITCODE -and $LASTEXITCODE -ne 0) -Or $($sqlCredential.useSqlAuth -eq $False -And $sqlCredential.useDomainAuth -eq $False)) {
        if ([string]::IsNullOrEmpty($ExtraArguments)) {
            $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0;
        }
        else {
            $sqlresponse =  sqlcmd  -S "$InstanceName" -Q "$Query" -y 0 $ExtraArguments;
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
                $responseObject[$serverInstanceName] = $sqlResponse | ConvertFrom-Json
            } catch {
                $responseObject[$serverInstanceName] = "error: $_.Exception.Message"
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

const trendGraphCreateScript = (databaseHostId: string, ec2InstanceId: string) => `
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
                $instanceName = $sqlService.Name -Replace "MSSQL\$", ""
                $finalInstancesList += $instanceName
            }
            return $finalInstancesList
        }

        $cpuUtilquery = @"
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

        foreach ($instanceName in $instancesList) {
            $metrics = @()
            $sqlCredential = $credsFromParameterStore.sql.Where({ $_.sqlInstanceName -eq $instanceName })[0]

            $sqlCmdParams = @()
            if (-Not [string]::IsNullOrEmpty($sqlCredential) -and -Not [string]::IsNullOrEmpty($sqlCredential.username) -and -Not [string]::IsNullOrEmpty($sqlCredential.password)) {
                $sqlCmdParams += @("-U", $sqlCredential.username, "-P", $sqlCredential.password)
            }
            if ($instanceName -ne "MSSQLSERVER") {
                $sqlCmdParams += @("-S", "$env:computerName\\$instanceName")
            }

            try {
                $cpuResponse = sqlcmd @sqlCmdParams -Q $cpuUtilquery -y 0
                $cpuJsonResponse = $cpuResponse -join "\`n" | ConvertFrom-Json
            }
            catch {
                $cpuError = $_.Exception.Message
            }

            try {
                $perfResponse = sqlcmd @sqlCmdParams -Q $performanceQuery -y 0
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
    copyPowerShellModule,
    sqlQueryExecution,
    readSsmParameter,
    slqcmdExecutionTemplate,
    CHECK_SCRIPT_AVAILABILITY_AND_VERSION,
    sqlQueryExecutionWithAuth,
    compressResponse,
    GET_FCI_NAME,
    trendGraphCreateScript
};
