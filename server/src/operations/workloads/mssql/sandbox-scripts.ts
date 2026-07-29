// instances input instances = ['"computername\\instanceName"', '"DEFAULT_MSSQL_INSTANCE_NAME"']; "DEFAULT_MSSQL_INSTANCE_NAME" represents the default instance

import { DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME } from '../../../utils/consts';
import { ontapRestRequestBootstrap } from './common-templates';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

// ('source', 'initialCreationDate', 'tag') are the extended properties saved during creation of sandbox
const GET_SANDBOX_DETAILS = (
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean = false
) => `

$instanceName = "${instanceName}"
$executableInstanceName = "${executableInstanceName}"
$results = @()
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

try {
    $query = @"
    SET NOCOUNT ON;
    DROP TABLE IF EXISTS #properties;
    
    CREATE TABLE #properties (
        database_name nvarchar(255),
        name nvarchar(255),
        value sql_variant
    );
    
    INSERT INTO #properties
    EXEC sp_MSforeachdb '
        USE [?];
        SELECT database_name = DB_NAME(), l.name, l.value
        FROM sys.databases d
        OUTER APPLY fn_listextendedproperty(default, default, default, default, default, default, default) l
        WHERE d.name = DB_NAME()
        AND database_id > 4
        AND l.name IS NOT NULL
        AND l.value IS NOT NULL ';
    
        SELECT database_name, JSON_QUERY(properties) AS sandbox_properties
        FROM (
            SELECT database_name, JSON_QUERY((SELECT name, value FROM #properties AS p2 WHERE p2.database_name = p1.database_name AND p2.name IN ('source', 'createdAt', 'tag', 'updatedAt', 'cloned_by', 'accountId') FOR JSON PATH)) AS properties
            FROM #properties AS p1
        ) AS grouped_properties
        GROUP BY database_name, properties
        FOR JSON PATH;
"@


    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    ${slqcmdExecutionTemplate}

    $output = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName $executableInstanceName

    if ($output) {
        $results += [PSCustomObject]@{
            Instance = $instanceName
            Output = $output
        }
    }
    else {
        $results += [PSCustomObject]@{
            Instance = $instanceName
            Output = "No sandboxes created for the instance"
        }
    }
}
catch {
    [PSCustomObject]@{
        Instance = $instanceName
        Error = "Error executing query on $instance $($_.Exception.Message)"
    } | ConvertTo-Json
}

$response = $results | ConvertTo-Json -Depth 5

if([string]::IsNullOrEmpty($response)) {
    Write-Information "Failed to compress the response because the response is either null or empty. $response"
    return $response
}
${compressResponse}
return (Deflate-String $response)
`;

const checkDatabaseExists = (dbCloneName: string, instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME) => `
    $WarningPreference = 'SilentlyContinue';

    $dbCloneName = '${dbCloneName}'

    if ($responseObject -eq $null) {
        $responseObject = @{}
    }

    $sqlcmd = "SET NOCOUNT ON; SELECT name FROM sys.databases where name = '$dbCloneName' FOR JSON PATH;"
    $sqlresponse =  sqlcmd  -S "${instanceName}" -Q $sqlcmd -y 0;

    [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }

    if ($ExistingDatabases.count -ne 0) {
        Write-Error "Database with name $dbCloneName already exists"
        $responseObject.add('dbCloneNameExists', $True)
    }

    $responseObject.add('dbCloneNameExists', $False)
`;

const getVolumeIdFromPath = `
        Function Get-VolumeIdFromPath {
            param(
                [Parameter(Mandatory = $true)]
                [string]$absolutePath
            )

            $fullPath = [string](Resolve-Path $absolutePath)
            $bestMatch = ''
            $bestMatchObj = $null
            gwmi Win32_MountPoint | % {
                $_.Directory -match '="(.*)"' | Out-Null
                $mountDir = $matches[1].Replace('\\\\', '\\')
                If (!$mountDir.EndsWith('\\')) { $mountDir = $mountDir + '\\' }
                If ($fullPath.StartsWith($mountDir, 'InvariantCultureIgnoreCase') -and $bestMatch.Length -lt $mountDir.Length) { 
                    $bestMatch = $mountDir
                    $bestMatchObj = $_
                }
            }
            $bestMatchObj.Volume -match '{(.+?)}' | Out-Null
            return $matches[1]
        }
`;

const getDbMappedOntapVolumes = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean = false
) => `
    #Get DB mapped ontap volumes script
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'
    $executableInstanceName = "${executableInstanceName}"
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $PSToolkitRequiredVersion = '9.15.1.2407'
    Start-Transcript -Path "C:\\cfn\\log\\map_ontap_volumes_for_$dbname.log.txt" -Append | Out-Null

    $responseObject = @{}
    $responseObject['data'] = @()
    $responseObject['log'] = @()
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT vs.volume_id as volumeid, mf.physical_name as filename, mf.type, mf.file_id as fileid FROM sys.master_files AS mf
            join sys.databases db
            on db.database_id = mf.database_id
            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
            where db.name = '$dbname'
            FOR JSON PATH;
"@

        Function Get-SerialNumberOfWinVolumes {
            param(
                [Parameter(Mandatory = $true)]
                [string[]]$sqlresponse
            )

            $responseObject = [ordered]@{}
            $responseObject['data'] = @()
            $responseObject['log'] = @()

            $allDisks = Get-Disk | Select SerialNumber, Number, BusType
            $winvolumes = $sqlresponse | foreach { $_ | ConvertFrom-Json }
            foreach ($winvolume in $winvolumes) {

                if ([string]::IsNullOrEmpty($winvolume.volumeid)) {
                    throw "Could not get volume id for database $dbname, please make sure the database is using iscsi protocol"
                }
                $partitions = @(Get-Volume -Path $winvolume.volumeid | Get-Partition | Where-Object DiskNumber -in $allDisks.Number)
                if ($partitions.Count -eq 0) {
                    throw "Could not find any disk partition for volume id $($winvolume.volumeid)"
                }
                $partition = $partitions[0]
                $disk = $allDisks | Where-Object Number -eq $partition.DiskNumber
                if ($null -eq $disk) {
                    throw "Could not find disk for DiskNumber $($partition.DiskNumber) of volume id $($winvolume.volumeid)"
                }

                if ($disk.BusType -ne 'iSCSI') {
                    throw "Protocol Error: The database should be using iscsi protocol"
                }

                $object = @{
                    "fileName" = $winvolume.filename
                    "lunSerialNumber" = $disk.SerialNumber
                    "fileId" = $winvolume.fileid
                    "fileType" = $winvolume.type
                }
                $type = 'data'
                if ($winvolume.type -ne 0) {
                    $type = 'log'
                }
                $responseObject[$type] += $object
            }

            return $responseObject
        }

        $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        ${slqcmdExecutionTemplate}

        $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$sqlquery" -InstanceName "${executableInstanceName}"

        Write-Information "$logPrefix SQL response: $queryResponse"
        if ([string]::IsNullOrEmpty($queryResponse)) {
            if ($queryResponse -eq $null) {
                $queryResponse = @{}
            }
            $queryResponse['error'] = "SqlServerError: Could not get volumes of database $dbname"
            return $queryResponse | ConvertTo-Json -Depth 5
        }
    
        $responseObject = Get-SerialNumberOfWinVolumes $queryResponse
        Write-Information "$logPrefix Serial numbers: $($responseObject | ConvertTo-Json)"
        if ($responseObject.data.Count -eq 0 -or $responseObject.log.Count -eq 0) {
            $responseObject['error'] = "Could not get windows volume serial numbers"
            return $responseObject | ConvertTo-Json -Depth 5
        }
    } catch {
        write-Error "$logPrefix $($_.Exception.Message)"
        if ($responseObject -eq $null) {
            $responseObject = @{}
        }
        $responseObject['error'] = $_.Exception.Message
    } finally {
        $responseObject | ConvertTo-Json -Depth 5
        Stop-Transcript | Out-Null
    }
`;

const setLunSignature = (
    fsxid: string,
    fsxregion: string,
    targetSvm: string,
    lunPaths: string,
    sandboxName: string,
    logPrefix?: string
) => `
    #Requires -Module AWS.Tools.FSX,netapp.ontap
    $FSxID = '${fsxid}'
    $FSxRegion = '${fsxregion}'
    $targetSvm = '${targetSvm}'
    $lunPaths = '${lunPaths}' | ConvertFrom-Json
    $sandboxName = '${sandboxName}'
    $logPrefix = '${logPrefix}'

    Start-Transcript -Path "C:\\cfn\\log\\set_lun_signature_for_$sandboxName.log.txt" -Append | Out-Null

    $WarningPreference = "SilentlyContinue"
    $responseObject = @{}

    try {
        ${ontapRestRequestBootstrap}
        $FSxNDetails = Get-FSxNDetails
        $FSxCredentials = $FSxNDetails.FSxCredentials
        $FSxHostName = $FSxNDetails.FSxHostName

        $null = Connect-NcController -Credential $FSxCredentials -Name $FSxHostName

        $message
        $lunPaths | ForEach-Object {
            $lunPath = $_
            $null = Set-NcLunSignature -Path $lunPath -Vserver $targetSvm -Confirm:$False
            if (-not $?) {
                $message += "Could not change LUN signature for $lunPath."
            }
        }

        if ($message -ne $null) {
            $responseObject['error'] = $message
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json -Depth 5
`;

const createClonedDb = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    dataFileList: string[] = [],
    logFileList: string[] = [],
    logPrefix: string = '',
    fileSuffix = '',
    sqlAuthEnabled: boolean
) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\sqlserver_create_db_$dbname.log.txt" -Append | Out-Null

    ${slqcmdExecutionTemplate}

    try {
        $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        $selectquery = "SET NOCOUNT ON; SELECT name, state_desc FROM sys.databases where name = '$dbname' FOR JSON PATH;"
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$selectquery" -InstanceName "${executableInstanceName}"

        Write-Information "$logPrefix SQL response: $sqlresponse"
        [string[]]$ExistingDatabases = $sqlresponse | ConvertFrom-Json | % { $_.name }


        $selectresult = (Call-SqlCmd -SqlCredential $sqlCredential -Query "$selectquery" -InstanceName "${executableInstanceName}") |  ConvertFrom-Json

        if ($selectresult.count -gt 0) {
            Write-Error "$logPrefix Database $dbname already exists and is in $($selectresult[0].state_desc) state. Exiting..."
        }

        $createQuery = @"
            CREATE DATABASE $dbname ON
            ${dataFileList
                .map(file => {
                    const newFilePath = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                    const fileName = newFilePath.split('\\').pop();
                    return `(NAME = '${fileName}', FILENAME = '${newFilePath}')`;
                })
                .join(',\n')}
            LOG ON
            ${logFileList
                .map(file => {
                    const newFilePath = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                    const fileName = newFilePath.split('\\').pop();
                    return `(NAME = '${fileName}', FILENAME = '${newFilePath}')`;
                })
                .join(',\n')}
"@
        
        Call-SqlCmd -SqlCredential $sqlCredential -Query "$createQuery" -InstanceName "${executableInstanceName}"
        Call-SqlCmd -SqlCredential $sqlCredential -Query "ALTER DATABASE $dbname SET OFFLINE" -InstanceName "${executableInstanceName}"
        
        # Remove the actual files
        ${[...dataFileList, ...logFileList]
            .map(file => {
                // replace mdf, ndf, ldf with epoch.mdf etc
                const newFileName = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                return `Remove-Item -Path "${newFileName}" -Force`;
            })
            .join('\n')}

        # Rename the actual files to the new name

        $newFiles = @()
        ${[...dataFileList, ...logFileList]
            .map(file => {
                // replace mdf, ndf, ldf with epoch.mdf etc
                const newFileName = file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`);
                return `$newFiles += '${newFileName}'
                Rename-Item -Path "${file}" -NewName "${newFileName}"`;
            })
            .join('\n')}

        
        # Update ACL for the new files

        $sqlService = (Get-WmiObject win32_service | ?{$_.DisplayName -like 'sql server (${instanceName})'})

        if ($sqlService -ne $null) {
            $newFiles | ForEach-Object {
                $Acl = Get-Acl $_
                $Ar = New-Object System.Security.AccessControl.FileSystemAccessRule($sqlService.StartName, "FullControl", "Allow")
                $Acl.SetAccessRule($Ar)
                Set-Acl $_ $Acl
            }
        }
        
        Call-SqlCmd -SqlCredential $sqlCredential -Query "ALTER DATABASE $dbname SET ONLINE" -InstanceName "${executableInstanceName}"
    } catch {
        Write-Error "$logPrefix $($_.Exception.Message)"
    }
    Stop-Transcript | Out-Null
`;

const addExtendedProperties = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    propObj: { [x: string]: string | number | boolean },
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$extProps = '${JSON.stringify(propObj)}' | ConvertFrom-Json

Start-Transcript -Path "C:\\cfn\\log\\add_extended_properties_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

Write-Information "Sandbox:$($dbname): Adding extended properties $extProps"

$query = @"
USE $dbname;
SET NOCOUNT ON;

${Object.keys(propObj)
    .map(
        k =>
            `IF NOT EXISTS (SELECT name, value FROM fn_listextendedproperty(default, default, default, default, default, default, default) WHERE name = N'${k}') 
                EXEC sp_addextendedproperty @name = N'${k}', @value = ${
                typeof propObj[k] === 'string' ? `'${propObj[k]}'` : propObj[k]
            }
            ELSE
                EXEC sp_updateextendedproperty @name = N'${k}', @value = ${
                typeof propObj[k] === 'string' ? `'${propObj[k]}'` : propObj[k]
            };`
    )
    .join('\n')}

"@
$response = $null
Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1

Stop-Transcript | Out-Null
`;

const releaseSandboxClusterResources = (
    filePaths: string,
    dbName: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean,
    isFci: boolean = false
) => `
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $DBName = '${dbName}'
    $executableInstance = "${executableInstance}"
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $isFci = [System.Convert]::ToBoolean('${isFci}')

    Start-Transcript -Path "C:\\cfn\\log\\cleanup_ontap_resources_$DBName.log.txt" -Append | Out-Null
    
    ${slqcmdExecutionTemplate}

    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        ${getVolumeIdFromPath}
        if ($filePaths.count -ne 0) {
            $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$DBName' GROUP BY dbid FOR JSON PATH"
            
            $sqlres = $null
            $sqlres = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}"

            if (-not [string]::IsNullOrEmpty($sqlres)) {
                Write-Information "$logPrefix Database $dbname is in use"
                $responseObject['error'] = "SQLServerError: Database $dbname is in use"
                return $responseObject | ConvertTo-Json -Depth 5
            }

            $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
            $resourceType = ${instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'}
            $windowsVolumeIds = $filePaths | ForEach-Object {
                Get-VolumeIdFromPath -absolutePath $_
            } | Sort-Object -Unique

            Write-Information "$logPrefix Windows Volume Ids: $windowsVolumeIds"
            if ($clusterServiceStatus -eq 'Running' -and $isFci -and $windowsVolumeIds.count -ne 0) {
                $sqlgroup = Get-ClusterResource | Where-Object Name -eq $resourceType
                $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
                $resourcegroup = $sqlserver.GetRelated() | Where Type -eq 'Physical Disk'

                $clusterdisksToRemove = @()
                foreach ($resource in $resourcegroup) {
                    $disks = $resource.GetRelated("MSCluster_Disk")
                    foreach ($disk in $disks) {
                        $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
                        $clusterdisk = ($resource.name).replace('\\r\\n','')
                        $diskdrive = $diskpart.path
                        $disklabel = $diskpart.volumelabel
                        $diskvolume = $diskpart.VolumeGuid
                        write-debug "Cluster Disk $diskvolume"
                        if ($windowsVolumeIds -contains $diskpart.VolumeGuid) {
                            $clusterdisksToRemove += $clusterdisk
                        }
                    }
                }
                write-Information "$logPrefix Cluster Disks to remove $clusterdisksToRemove"
                if ($clusterdisksToRemove.count -ne 0) {
                    $clusterdisksToRemove | ForEach-Object {
                        $diskToRemove = $_
                        $diskToRemove = $diskToRemove.ToString()
                        write-Information "$logPrefix Removing disk $diskToRemove"
                        $null = (Remove-ClusterResourceDependency -Resource $resourceType -Provider $diskToRemove)
                        $null = (Remove-ClusterSharedVolume -Name $diskToRemove -ErrorAction SilentlyContinue)
                        $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
                    }
                }
            }
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const dropSandboxDatabaseFiles = (
    filePaths: string,
    dbName: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $DBName = '${dbName}'
    $executableInstance = "${executableInstance}"
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\cleanup_ontap_resources_$DBName.log.txt" -Append | Out-Null
    
    ${slqcmdExecutionTemplate}

    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $WarningPreference = 'SilentlyContinue';
    $responseObject = @{}

    try {
        if ($filePaths.count -ne 0) {
            try {
                $deleteQuery = "SET NOCOUNT ON; DROP DATABASE IF EXISTS $DBName;"
                $sqlresponse = $null
                $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$deleteQuery" -InstanceName "${executableInstance}"
                
                if (-not [string]::IsNullOrEmpty($sqlresponse)) {
                    throw "SQLServerError: Could not drop database $DBName. $sqlresponse"
                }
            } catch {
                Write-Information "$logPrefix $($_.Exception.Message)"
                throw $_.Exception.Message
            }

            $virtualDrives = $filePaths | ForEach-Object {
                $splits = $_.Split('\\')
                $splits[0] + '\\' + $splits[1]
            }
    
            $virtualDrives | ForEach-Object {
                $null = (Remove-Item -Path $_ -Force -Recurse -ErrorAction SilentlyContinue)
            }
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
    }

    $responseObject | ConvertTo-Json
`;

const mountPointQuery = (databaseName: string) =>
    `SET NOCOUNT ON;
    SELECT CASE WHEN mf.type != 0 THEN 'Log' ELSE 'Data' END AS filetype,
    vs.logical_volume_name AS volumename, mf.physical_name AS filepath
    FROM sys.master_files AS mf
    JOIN sys.databases AS db ON db.database_id = mf.database_id
    CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
    WHERE db.name = '${databaseName}'
    FOR JSON PATH;`;

/*
    Order of the events plays an important role in the detachDbAndRemoveAccessPath script.
    1. Check if the database is in use.
    2. Get the extended properties of the database.
    3. Get the volume id of the windows volumes from file path.
    4. Detach the database, so that db files are retained.
    5. Remove the access path of the partitions.
    6. Remove the cluster disks.
*/
const detachDbAndRemoveAccessPath = (
    dbName: string,
    serialNumbers: string,
    filePaths: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean,
    isFci: boolean = false
) => `
    $dbname = '${dbName}'
    $serialNumbers = '${serialNumbers}' | ConvertFrom-Json
    $filePaths = '${filePaths}' | ConvertFrom-Json
    $executableInstance = "${executableInstance}"
    $instanceName = '${instanceName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $isFci = [System.Convert]::ToBoolean('${isFci}')

    Start-Transcript -Path "C:\\cfn\\log\\detachdb_remove_accesspath_$dbname.log.txt" -Append | Out-Null
    
    ${slqcmdExecutionTemplate}

    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    if ($null -eq $responseObject) {
        $responseObject = @{}
    }

    try {
        $query = "set nocount on; SELECT DB_NAME(dbid) as DBName, COUNT(dbid) as NumberOfConnections FROM sys.sysprocesses WHERE DB_NAME(dbid) = '$dbname' GROUP BY dbid FOR JSON PATH"

        $sqlres = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}"
        if ($sqlres -ne $null) {
            Write-Information "$logPrefix Database $dbname is in use"
            $responseObject['error'] = "Database $dbname is in use"
            return $responseObject | ConvertTo-Json -Depth 5
        }

        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstance}" -ExtraArguments -m1
        $sqlresponse = $sqlresponse | ConvertFrom-JSON

        $sqlresponse | ForEach-Object {
            $responseObject | Add-Member -MemberType NoteProperty -Name $_.name -Value $_.value
        }

        ${getVolumeIdFromPath}

        $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status
        $resourceType = ${instanceName === DEFAULT_INSTANCE_NAME ? '"SQL Server"' : '"SQL Server ($instanceName)"'}
        $windowsVolumeIds = $filePaths | ForEach-Object {
            Get-VolumeIdFromPath -absolutePath $_
        } | Sort-Object -Unique
        write-Information "$logPrefix Windows Volume Ids: $windowsVolumeIds"

        try {
            $detach = "EXEC sp_detach_db '$dbname', 'true'"
            $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$detach" -InstanceName "${executableInstance}"

            Write-Information "$logPrefix Detach response: $sqlresponse"

            if ($sqlresponse -ne $null) {
                Write-Information "$logPrefix Failed to detach the database $sqlresponse"
                throw "SQLServerError: Could not detach the database $dbname"
            }
        } catch {
            Write-Information "$logPrefix $($_.Exception.Message)"
            throw $_.Exception.Message
        }

        write-Information "$logPrefix Serial Numbers: $serialNumbers"
        $disklist = Get-disk | Where-Object { $serialNumbers -contains $_.SerialNumber }
        write-Information "$logPrefix Disk List: $disklist"
        $mountPoints = $filePaths | ForEach-Object {
            $splits = $_.Split('\\')
            $splits[0] + '\\' + $splits[1] + '\\'
        }
        Write-Information "$logPrefix Mount Points: $($mountPoints | ConvertTo-Json)"

        $disklist | ForEach-Object {
            $disk = $_
            $partition = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }
            Write-Information "$logPrefix Partition: $($partition.PartitionNumber) $($partition.AccessPaths)"
            $partition.AccessPaths | ForEach-Object {
                $accesspath = $_
                if ($accesspath -and ($mountPoints -contains $accesspath) -and ($accesspath -notmatch 'Volume')) {
                    Remove-PartitionAccessPath -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $accesspath
                }
            }
        }

        if ($clusterServiceStatus -eq 'Running' -and $isFci -and $windowsVolumeIds.count -ne 0) {
            $sqlgroup = Get-ClusterResource | Where-Object Name -eq $resourceType
            $sqlserver = Get-WmiObject -namespace root\\MSCluster MSCluster_Resource -filter "Name='$sqlgroup'"
            $resourcegroup = $sqlserver.GetRelated() | Where Type -eq 'Physical Disk'

            $clusterdisksToRemove = @()
            foreach ($resource in $resourcegroup) {
                $disks = $resource.GetRelated("MSCluster_Disk")
                foreach ($disk in $disks) {
                    $diskpart = $disk.GetRelated("MSCluster_DiskPartition")
                    $clusterdisk = ($resource.name).replace('\\r\\n','')
                    $diskdrive = $diskpart.path
                    $disklabel = $diskpart.volumelabel
                    $diskvolume = $diskpart.VolumeGuid
                    write-debug "Cluster Disk $diskvolume"
                    if ($windowsVolumeIds -contains $diskpart.VolumeGuid) {
                        $clusterdisksToRemove += $clusterdisk
                    }
                }
            }
            write-Information "$logPrefix Cluster Disks to remove $clusterdisksToRemove"
            if ($clusterdisksToRemove.count -ne 0) {
                $clusterdisksToRemove | ForEach-Object {
                    $diskToRemove = $_
                    $diskToRemove = $diskToRemove.ToString()
                    write-Information "$logPrefix Removing disk $diskToRemove"
                    $null = (Remove-ClusterResourceDependency -Resource $resourceType -Provider $diskToRemove)
                    $null = (Remove-ClusterSharedVolume -Name $diskToRemove -ErrorAction SilentlyContinue)
                    $null = (Remove-ClusterResource -Name $diskToRemove -Force -ErrorAction SilentlyContinue)
                }
            }
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = $_.Exception.Message
        return $responseObject | ConvertTo-Json -Depth 5
    }

    return $responseObject | ConvertTo-Json -Depth 5
`;

const addAccessPathAndAttachDb = (
    dbName: string,
    fileArr: string,
    executableInstance: string = DEFAULT_MSSQL_INSTANCE_NAME,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
    $WarningPreference = 'SilentlyContinue';
    $dbname = '${dbName}'
    $logPrefix = '${logPrefix}'
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    Start-Transcript -Path "C:\\cfn\\log\\attachdb_$dbname.log.txt" -Append | Out-Null

    try {

        ${slqcmdExecutionTemplate}
        $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceName)}
        }

        $attachQuery = @"
            IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '$dbname')
            BEGIN
                CREATE DATABASE $dbname ON
                ${[...JSON.parse(fileArr)].map(file => (file ? `(FILENAME = '${file}')` : '')).join()}
                FOR ATTACH
            END;
"@

        $attachresponse = $null
        $attachresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$attachQuery" -InstanceName "${executableInstance}"
        if ($attachresponse -ne $null) {
            $errorMessage = "SQLServerError: Could not create and attach the database $dbname. $attachresponse"
            Write-Information "$logPrefix $errorMessag"
            throw $errorMessage
        }
    } catch {
        Write-Error "$logPrefix $($_.Exception.Message)"
    }

    Stop-Transcript | Out-Null
`;

const deleteExtendedPropertiesScript = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    props: Array<string>,
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$extProps = '${JSON.stringify(props)}' | ConvertFrom-Json
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

Start-Transcript -Path "C:\\cfn\\log\\delete_extended_properties_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

Write-Information "Sandbox:$($dbname): Deleting extended properties $extProps"

$query = @"
USE $dbname;
SET NOCOUNT ON;
${props
    .map(
        k => `
IF EXISTS (SELECT name, value FROM fn_listextendedproperty(default, default, default, default, default, default, default) WHERE name = N'${k}')
    EXEC sp_dropextendedproperty @name = N'${k}';
`
    )
    .join('\n')}
"@

$response = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1

Stop-Transcript | Out-Null
`;

const checkDatabaseIntegrityScript = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = '.',
    logPrefix: string = '',
    sqlAuthEnabled: boolean
) => `
$dbname = '${dbName}'
$instanceName = "${instanceName}"
$logPrefix = '${logPrefix}'
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

Start-Transcript -Path "C:\\cfn\\log\\check_integrity_for_$dbname.log.txt" -Append | Out-Null

${slqcmdExecutionTemplate}

$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

Write-Information "$logPrefix Checking database integrity"

$query = @"
USE $dbname;
SET NOCOUNT ON;
DBCC CHECKDB($dbname) WITH NO_INFOMSGS, ALL_ERRORMSGS;
"@

$response = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1
`;

const readExtendedPropertiesOfSandbox = (
    dbName: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean
) => `
    $dbname = '${dbName}'
    $instanceName = "${instanceName}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')

    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    ${slqcmdExecutionTemplate}

    $responseObject = @{}

    try {
        $query = @"
            SET NOCOUNT ON;
            USE $dbname;
            SELECT name, value
            FROM fn_listextendedproperty(default, default, default, default, default, default, default) FOR JSON PATH;
"@
        $sqlresponse = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "${executableInstanceName}" -ExtraArguments -m1
        $sqlresponse = $sqlresponse | ConvertFrom-JSON

        $sqlresponse | ForEach-Object {
            $responseObject[$_.name] = $_.value
        }
    } catch {
        Write-Information "$logPrefix $($_.Exception.Message)"
        $responseObject['error'] = "sqlerror: $($_.Exception.Message)"
    }

    $responseObject | ConvertTo-Json -Depth 5
`;

const getConnectionInfo = (instanceName: string, sqlAuthEnabled: boolean) => `

$ProgressPreference = "SilentlyContinue"
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}

${slqcmdExecutionTemplate}

if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}
$responseObject = @{}

try {
    $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
    $ip = (Invoke-WebRequest -Headers @{"X-aws-ec2-metadata-token" = $token} -URI http://169.254.169.254/latest/meta-data/local-ipv4 -UseBasicParsing).Content;
    $query = "SET NOCOUNT ON; SELECT DISTINCT local_tcp_port FROM sys.dm_exec_connections  WHERE local_tcp_port IS NOT NULL"
    $port = Call-SqlCmd -SqlCredential $sqlCredential -Query "$query" -InstanceName "$ip\\${instanceName}"
    $responseObject['server'] = "$($ip):$($port)${instanceName ? `\\${instanceName}` : ''}"
} catch {
    $responseObject['error'] = "Failed to get connection info: $_.Exception.Message"
}

$responseObject | ConvertTo-Json -Depth 5
`;

const invokeVirtualMountScript = (
    dbName: string,
    fileLunMap: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    isDefaultInstance: boolean,
    logPrefix: string = '',
    isFci: boolean = false
) => `

$ErrorActionPreference = "Stop"

$DBName = '${dbName}'
$FileLunArr = '${fileLunMap}' | ConvertFrom-Json
$InstanceName = '${instanceName}'
$IsDefaultInstance = [System.Convert]::ToBoolean('${isDefaultInstance}')
$LogPrefix = '${logPrefix}'
$IsFci = [System.Convert]::ToBoolean('${isFci}')

$null = (Start-Transcript -Path "C:\\cfn\\log\\invoke_virtualmount_$DBName.log.txt" -Append)

Write-Information "FileLunArr: $($FileLunArr | ConvertTo-Json -Depth 5)"

try {
    $responseObject = [ordered]@{}

    if ($FileLunArr.Count -eq 0) {
        Write-Information "$LogPrefix FileLunArr: $FileLunArr"
        throw "FileLunArr is empty"
    }

    $null = (echo "RESCAN" | diskpart )
    Start-Sleep 2

    if ($DBName.Length -gt 25) {
        $DBName = $DBName.Substring(0, 25)
    }

    $retry = 0
    $lunProcessed = @()
    do {
        $disklist = @()
        ($FileLunArr) | ForEach-Object {
            $serial = $_.lun

            if (!$lunProcessed.Contains($serial)) {
                $disklist += (Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE' -and $_.SerialNumber -ceq $serial })
            }
            $lunProcessed += $serial
        }

        if ($retry -gt 0) {
            Start-Sleep 20
        }
        $retry++
    } until (($retry -eq 4) -Or ($disklist.Count -ge $1))

    Write-Information "$LogPrefix Disk list count: $($disklist.Count)"

    #Adding Silently Continue for Set-Disk as warning caused output to have the string an API considered failure despite success
    #If warning is indeed serious the next step to initialize will fail and that will be caught
    $disklist | ForEach-Object {
        $disk = $_
        $disknumber = $disk.Number
        $null= (echo "select disk $disknumber" "attributes disk clear readonly" | diskpart)
        if ($disk.IsReadOnly -ne $False) {
            Set-Disk -Number $disk.Number -IsReadOnly $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
 
        if ($disk.IsOffline -ne $False) {
            Set-Disk -Number $disk.Number -IsOffline $False -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
 
        if ($disk.PartitionStyle -eq 'RAW') {
            Set-Disk -Number $disk.Number -PartitionStyle GPT -ErrorAction SilentlyContinue
            Start-Sleep 2
        }
    }
}
catch {
    Write-Information "$LogPrefix Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to modify disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
} 

try {
    if ((Get-Service -Name ShellHWDetection).Status -eq 'Running') {
        Stop-Service -Name ShellHWDetection
    }

    $lunProcessed = @()
    $FileLunArr | ForEach-Object {
        if (!$lunProcessed.Contains($_.lun)) {
            $null = (New-Item -ItemType Directory -Path $_.folderPath -Force)
        }
        $lunProcessed += $_.lun
    }
    $disksInfo = @()
    $disklist | ForEach-Object {
        $disk = $_
        $diskpartition = Get-Partition -DiskNumber $disk.Number | Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' }
        $null = $diskpartition | Set-Partition -NoDefaultDriveLetter $true -ErrorAction stop

        $fileLunData = ($FileLunArr | Where-Object { $_.lun -ceq $disk.SerialNumber })[0]

        Get-Partition -DiskNumber $disk.Number | Get-Volume | Set-Volume -NewFileSystemLabel $fileLunData.label
        
        $disksInfo += @{
            'Number' = $disk.Number
            'SerialNumber' = $disk.SerialNumber
            'partition' = $diskpartition
            'label' = $fileLunData.label
            'folderPath' = $fileLunData.folderPath
            'fileName' = $fileLunData.fileName
        }
    }

    Write-Information "$LogPrefix Disk Info count: $($disksInfo.Count)"
}
catch {
    Write-Information "$LogPrefix Error: $($_.Exception)"
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to initialize disks'
    return ($responseObject | ConvertTo-Json -Depth 5)
    exit 1
}
finally {
    if ((Get-Service -Name ShellHWDetection).Status -ne 'Running') {
        Start-Service -Name ShellHWDetection
    }
}

try {
    $clusterServiceStatus = (Get-Service -Name clussvc -ErrorAction SilentlyContinue).Status

    if ($clusterServiceStatus -eq 'Running' -and $IsFci) {
        # Add new disks to Cluster Storage
        #In some cases onlining disk and setting Filesystem label fails and volume returns empty in PS cmdlet. Fail check with diskpart

        foreach ($diskInfo in $disksInfo) {
            if ($diskInfo.IsOffline -ne $False) {
                $null= (echo "select disk $($diskInfo.Number)" "select partition 2" "select volume" "online vol" | diskpart)
                Start-Sleep 5
            }
        }

        $clusterdisks = @()
        $disksInfo | ForEach-Object {
            $disk = $_
            $clusterdisk = Get-ClusterResource -Name $disk.label -ErrorAction SilentlyContinue
            if (![string]::IsNullOrEmpty($clusterdisk)) {
                $clusterdisks += @{ 'SerialNumber' = $disk.SerialNumber; 'disk' = $clusterdisk }
            }
        }

        if ($clusterdisks.Count -eq 0) {
            $diskNumbers = @()
            $disksInfo | Foreach-object { $diskNumbers += $_.Number }
            $availabledisks = Get-Disk | Where-Object { $diskNumbers.Contains($_.Number) }

            $availabledisks | ForEach-Object {
                $availabledisk = $_
                $clusterdisk = ($availabledisk | Add-ClusterDisk -ErrorAction stop)
                $clusterdisks += @{ 'SerialNumber' = $availabledisk.SerialNumber; 'disk' = $clusterdisk }
            }
        }

        Write-Information "$LogPrefix Cluster disks count: $($clusterdisks.Count)"

        try {
            $SQLRoleGroup = (Get-ClusterGroup).Name -eq ("SQL Server ($InstanceName)")
            $SQLGroup = $SQLRoleGroup[0]
            
            foreach ($clDiskInfo in $clusterdisks) {
                $clusterdisk = $clDiskInfo.disk

                if ($clusterdisk.OwnerGroup -ne $SQLGroup) {
                    $null = (Move-ClusterResource -Name $($clusterdisk.Name) -Group $SQLGroup)
                }

                #     #Add dependency on new disks in SQL Server Resource
                if ($IsDefaultInstance -eq $True){
                    $ClusterResourceName = "SQL Server"
                }
                else {
                    $ClusterResourceName = "SQL Server ($InstanceName)"
                }

                $null = (Add-ClusterResourceDependency -Resource $ClusterResourceName -Provider $($clusterdisk.Name))

                #     #Rename new cluster disks to user friendly name

                $label = ($FileLunArr | Where-Object { $_.lun -ceq $clDiskInfo.SerialNumber } | Select-Object -ExpandProperty label)[0]
                (Get-ClusterResource -Name $($clusterdisk.Name)).name = $label
            }
        }
        catch {
            $responseObject['error'] = $_.Exception.Message
            $responseObject['message'] = "Failed to add disks to SQL Server Role dependency in cluster"
            return ($responseObject | ConvertTo-Json -Depth 5)
            exit 1
        }
    }
}
catch {
    $responseObject['error'] = $_.Exception.Message
    $responseObject['message'] = 'Failed to add disks to cluster storage'
    return ($responseObject | ConvertTo-Json -Depth 5)
    exit 1
}

try {
    Start-Sleep 5


    foreach ($diskInfo in $disksInfo) {
        if ($diskInfo.partition.AccessPaths -notcontains $diskInfo.folderPath + '\\') {
            $null = Add-PartitionAccessPath -DiskNumber $diskInfo.Number -PartitionNumber ($diskInfo.partition).PartitionNumber -AccessPath $diskInfo.folderPath -ErrorAction stop
            $null = (Get-Partition -DiskNumber $diskInfo.Number |  Where-Object { $_.Type -eq 'Basic' -or $_.Type -eq 'IFS' } | Set-Partition -NoDefaultDriveLetter $true)
        }
    }
} catch {
        $responseObject['error'] = $_.Exception.Message
        $responseObject['message'] = 'Failed to add access path to disks'
        return ($responseObject | ConvertTo-Json -Depth 5)
        exit 1
}

try {
    $disksInfo | ForEach-Object {
        $disk = $_
        $partition = $disk.partition
        $partition.AccessPaths | ForEach-Object {
            $accessPath = $_

            Write-Information "$LogPrefix AccessPath: $accessPath"

            $DriveLetter = $disk.folderPath.Substring(0, 2)

            if ($accessPath) {
                $matched = $accessPath -match '^[A-Z]:\\\\$'
                
                Write-Information "$LogPrefix Matched: $matched"
                
                if ($matched -eq $True -and $accessPath -notcontains $DriveLetter) {
                    $accessDrive = $matches[0]
                    $null = ($partition | Remove-PartitionAccessPath -AccessPath $accessDrive)
                }
            }
        }

        Get-ChildItem -Path $disk.folderPath -Recurse | where { $_.LinkType -eq 'Junction' } | Remove-Item -Force -Recurse
    }
} catch {
    Write-Information "$LogPrefix Failed to remove stale junction paths"
}

try {
    $responseObject['files'] = @()
    $FileLunArr | ForEach-Object {
        $fileLeaf = $_.fileName
        
        $newFilePath = (Get-ChildItem -Path $_.folderPath -Recurse -Filter $fileLeaf).FullName

        if (Test-Path $newFilePath) {
            $responseObject['files'] += $newFilePath
        } else {
            throw
        }
    }

    Write-Information "$LogPrefix NewFilePaths: $($responseObject['dataPath']) $($responseObject['logPath'])"
} catch {
    $responseObject['error'] = "Failed to validate newpaths $($responseObject['dataPath']) $($responseObject['logPath'])"
}

$responseObject | ConvertTo-Json -Depth 5
Stop-Transcript | Out-Null
`;

export {
    GET_SANDBOX_DETAILS,
    checkDatabaseExists,
    getDbMappedOntapVolumes,
    addExtendedProperties,
    setLunSignature,
    createClonedDb,
    releaseSandboxClusterResources,
    dropSandboxDatabaseFiles,
    mountPointQuery,
    detachDbAndRemoveAccessPath,
    addAccessPathAndAttachDb,
    deleteExtendedPropertiesScript,
    checkDatabaseIntegrityScript,
    readExtendedPropertiesOfSandbox,
    getConnectionInfo,
    invokeVirtualMountScript,
    getVolumeIdFromPath
};
