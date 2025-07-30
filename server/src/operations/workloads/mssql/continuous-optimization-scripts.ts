import { BulkOptimizeSnapshotPolicyParamsType } from '../../../routes/types/continuous-optimization.types';
import { OntapRequestParams, OptimizeStorageParams, WorkloadInstance } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
import {
    COMPUTE_OPTIMIZE_LOG_PATH,
    DISCOVER_OPERATION_LOG_PATH,
    RESILIENCY_OPTIMIZE_LOG_PATH,
    RSS_OPTIMIZE_LOG_PATH,
    SIZING_OPERATIONS_LOG_PATH,
    STORAGE_ASSESSMENT_LOG_PATH
} from './const';
import {
    INSTANCE_DATA_DRIVES_QUERY,
    INSTANCE_LOG_DB_DRIVE_SIZES,
    INSTANCE_LOG_DRIVES_QUERY,
    INSTANCE_USER_DB_DRIVE_SIZES,
    SERVER_VERSION,
    TEMPDB_DRIVE_SIZE
} from './queries';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate, GET_FCI_NAME } from './ssm-script-utils';

/**
 * Parameters for making a REST request to ONTAP.
 * @property queryFilter - A filter expression to specify conditions for filtering fields in the request.
 * @property queryFields - The field to include in the output. Pass one field at a time
 */
interface OntapRestRequestParams {
    queryFilter?: string;
    queryFields?: string;
}

const JSON_CHECK = `
        function Test-ValidJson {
            param (
            [Parameter(Mandatory = $true)]
            [object]$JsonString
        )

        try {
            # Ensure the input is a string
            $JsonString = [string]$JsonString

            # Attempt to convert the string to a JSON object
            $null = $JsonString | ConvertFrom-Json
            return $true
        }
        catch {
            return $false
        }
        }
    `;

// This function is used to get the MSSQL instance volume and lun details for data,log and tempdb drives
const FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS = (instanceRecord: WorkloadInstance) => `
    # Get MSSQL Instance Volume LUN Drive Details
    ${slqcmdExecutionTemplate}

    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    ${ontapRestRequest}

    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    # No need to build $instanceServiceName here, DATABASE_VOLUME_LUN_DETAILS handles it internally
    ${DATABASE_VOLUME_LUN_DETAILS(instanceRecord)}

    $response = $responseObject | ConvertTo-Json -Compress

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
    `;

const GET_ONTAP_LUN_DETAILS = (params: OntapRequestParams) => `
#Get ONTAP LUN details Script
Start-Transcript -Path ${SIZING_OPERATIONS_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue';
$FSxID = '${params.fsxId}'
$FSxRegion = '${params.region}'
$apiEndpoint = '${params.apiEndpoint}'
Write-Information "Getting LUN details for FSxID: $FSxID, FSxRegion: $FSxRegion"
${ontapRestRequest}
$ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $apiQueryFilter -method "GET"
$ontapResponse | ConvertTo-Json
Stop-Transcript | Out-Null
`;

const DATABASE_VOLUME_LUN_DETAILS = (instanceRecord: WorkloadInstance) => `
    $WarningPreference = 'SilentlyContinue';
    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $PSToolkitRequiredVersion = '9.15.1.2407'
    $responseObject = @{}
    $responseObject['data'] = @()
    $responseObject['log'] = @()
    $responseObject['tempDb'] = @()
    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            DECLARE @JSON nvarchar(max)
            SET @JSON = (SELECT DISTINCT db.name, vs.volume_id as volumeid, mf.physical_name as filename, mf.type, mf.file_id as fileid, mf.size * 8 / 1024.0 as sizeInMb, LEFT(mf.physical_name, 2) AS driveLetter,
            vs.total_bytes / 1048576 AS driveTotalSizeMB FROM sys.master_files AS mf
            join sys.databases db
            on db.database_id = mf.database_id
            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
            where db.database_id > 4 or db.name = 'msdb'
            FOR JSON PATH)
            SELECT @JSON
            ;
"@

        $sqlqueryForTempdb = @"
                SET NOCOUNT ON;
                SELECT DISTINCT mf.name, vs.volume_id as volumeid, mf.physical_name as filename, mf.type, mf.file_id as fileid, mf.size * 8 / 1024.0 as sizeInMb, LEFT(mf.physical_name, 2) AS driveLetter,
                vs.total_bytes / 1048576 AS driveTotalSizeMB FROM tempdb.sys.database_files AS mf
                CROSS APPLY sys.dm_os_volume_stats(2, mf.[file_id]) AS vs
                where mf.name = 'tempdev'
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
            $responseObject['tempDb'] = @()
            $partitionmap = @{}
            $winvolumes = $sqlresponse | ConvertFrom-Json
            foreach ($winvolume in $winvolumes) {
                # check in winvolume volume id is null or empty string
                if (-Not ([string]::IsNullOrEmpty($winvolume.volumeid))) {
                    if( -not $partitionmap.Contains( $winvolume.volumeid ) ) {
                        $vol = get-volume -Path $winvolume.volumeid | Get-Partition | get-disk | Select serialnumber, bustype, number
                        $partition = get-volume -Path $winvolume.volumeid | Get-Partition | Select accesspaths
                        $partitionmap[$winvolume.volumeid] = @{"volume"= $vol
                                                      "partition" = $partition
                                         }
                    } else {
                        $vol = $partitionmap[$winvolume.volumeid]["volume"]
                        $partition = $partitionmap[$winvolume.volumeid]["partition"]
                
                }
                
                    if ($vol.bustype -eq 'iscsi') {
                        $object = @{
                        "name" = $winvolume.name
                        "lunSerialNumber" = $vol.serialnumber
                        "sizeInMb" = $winvolume.sizeInMb
                        "diskNumber" = $vol.number
                        "accessPaths" = $partition.accesspaths
                        "driveLetter" = $winvolume.driveLetter
                    }
                    $type = 'data'
                    if ($winvolume.name -Contains "tempdev") {
                        $type = 'tempDb'
                    }
                    elseif ($winvolume.type -eq 1) {
                        $type = 'log'
                    }
                    $responseObject[$type] += $object
                    }
                    }
                }
            return $responseObject
        }
    
        Function Get-LunFromSerialNumber($responseObject) {
            $responseJson = $responseObject | ConvertTo-Json -Depth 5
            Write-Information "$logPrefix Get ONTAP lun name from serial numbers for: $responseJson"
   
            $QueryFilter = ''
            $serialNumbers = @()
            $serialNumbers += $responseObject.data | ForEach-Object { $_.lunSerialNumber }
            $serialNumbers += $responseObject.log | ForEach-Object { $_.lunSerialNumber }
            $serialNumbers += $responseObject.tempDb | ForEach-Object { $_.lunSerialNumber }
            $serialNumbers = $serialNumbers | Select-Object -Unique

            foreach ($serialNumber in $serialNumbers) {
                $QueryFilter += $serialNumber + '|'
            }
            $QueryFilter = $QueryFilter.TrimEnd('|')
            $Params = @{
                "ApiEndPoint" = "/storage/luns"
            }
    
            if ($QueryFilter -ne '') {
                $QueryFilter = [System.Web.HttpUtility]::UrlEncode($QueryFilter)
                $Params += @{"ApiQueryFilter" = "serial_number=$QueryFilter"}
            }
    
            $params += @{"ApiQueryFields" = "fields=svm.name,location.volume.*"}
    
            $Response = Invoke-ONTAPRequest @Params
    
            $LunRecords = $Response.records
    
            if ($LunRecords.count -gt 0) {
                $LunRecords | ForEach-Object {
                    $lunrecord = $_
                    foreach ($dataVol in $responseObject.data) {
                        if ($dataVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $dataVol.Add("lunPath", $lunrecord.name)
                            $dataVol.Add("lunUuid", $lunrecord.uuid)
                            $dataVol.Add("ontapVolumeName", $lunrecord.location.volume.name)
                            $dataVol.Add("ontapVolumeUuid", $lunrecord.location.volume.uuid)
                            $dataVol.Add("svmName", $lunrecord.svm.name)
                        }
                    }
                    foreach ($logVol in $responseObject.log) {
                        if ($logVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $logVol.Add("lunPath", $lunrecord.name)
                            $logVol.Add("lunUuid", $lunrecord.uuid)
                            $logVol.Add("ontapVolumeName", $lunrecord.location.volume.name)
                            $logVol.Add("ontapVolumeUuid", $lunrecord.location.volume.uuid)
                            $logVol.Add("svmName", $lunrecord.svm.name)
                        }
                    }
                    foreach ($tempdbVol in $responseObject.tempDb) {
                        if ($tempdbVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $tempdbVol.Add("lunPath", $lunrecord.name)
                            $tempdbVol.Add("lunUuid", $lunrecord.uuid)
                            $tempdbVol.Add("ontapVolumeName", $lunrecord.location.volume.name)
                            $tempdbVol.Add("ontapVolumeUuid", $lunrecord.location.volume.uuid)
                            $tempdbVol.Add("svmName", $lunrecord.svm.name)
                        }
                    }
                }
            } else {
                 throw "Unable to fetch lun details for the serial numbers."
            }
            return $responseObject
        }
    
        $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceRecord.name)}
        }

        $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$sqlquery" -InstanceName "$instanceServiceName" 
        $queryResponseForTempDb =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$sqlqueryForTempdb" -InstanceName "$instanceServiceName"

         if(([string]::IsNullOrEmpty($queryResponse) -or $queryResponse -eq "NULL") -and ([string]::IsNullOrEmpty($queryResponseForTempDb) -or $queryResponseForTempDb -eq "NULL")) { 
            throw "Unable to fetch details of user databases and tempdb"
        }
        elseif([string]::IsNullOrEmpty($queryResponse) -or $queryResponse -eq "NULL") {
            $combinedResponse = ($queryResponseForTempDb | ConvertFrom-Json) | ConvertTo-Json
        }
        elseif ([string]::IsNullOrEmpty($queryResponseForTempDb) -or $queryResponseForTempDb -eq "NULL") {
            $combinedResponse = ($queryResponse | ConvertFrom-Json) | ConvertTo-Json
        }
        else {
            $combinedResponse = (($queryResponse  | ConvertFrom-Json) + ($queryResponseForTempDb | ConvertFrom-Json)) | ConvertTo-Json
        }
        
        $responseObject = Get-SerialNumberOfWinVolumes $combinedResponse
        $responseObject = Get-LunFromSerialNumber $responseObject
       
    } catch {
        if ($responseObject -eq $null) {
            $responseObject = @{}
        }
        $responseObject['error'] = $_.Exception.Message
    } 
`;

const INSTANCE_NETAPP_DRIVES = `
    Function Get-MappedDrives {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$drives
        )

        $disks = Get-WmiObject -Query "SELECT DeviceID, Model FROM Win32_DiskDrive"
        $results = New-Object System.Collections.ArrayList

        foreach ($disk in $disks) {
            $partitions = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
            foreach ($partition in $partitions) {
                $logicalDisks = Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($partition.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
                    foreach ($logicalDisk in $logicalDisks) {
                        if(($drives -contains $logicalDisk.DeviceID) -and ($disk.Model -like '*NETAPP*')) {
                            $results += $logicalDisk.DeviceID
                        }
                    }
                }
            }
        return $results
    }
`;

const INSTANCE_DRIVE_DETAILS_TEMPLATE = (instance: string, sqlAuthEnabled: boolean) =>
    `
    $sqlInstance = "${instance}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }

    
    if($sqlAuthEnabled) {
        ${readSsmParameter(instance)}
    }
    
    ${INSTANCE_NETAPP_DRIVES}
    
    $driveDetailsErrors = @{}
    # Get all data drives and check if they are NetApp drives
    $instanceAllDataDrives = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_DATA_DRIVES_QUERY}" -InstanceName "$instanceServiceName"  
    if(-Not ([string]::IsNullOrEmpty($instanceAllDataDrives)) -and (Test-ValidJson -JsonString $instanceAllDataDrives) ) {
        $instanceAllDataDrives = $instanceAllDataDrives | ConvertFrom-Json
    }
    else {
        Write-Information "Error occurred while fetching data drives. Error: $instanceAllDataDrives"
        $driveDetailsErrors["instanceDataDrivesError"] = $instanceAllDataDrives  -join ' ,'
        $instanceAllDataDrives = @()
    }

    $instanceDrivesList = @()
    $instanceAllDataDrives | ForEach-Object -Process {$instanceDrivesList += $_.drives}
    $netappDataDrives = Get-MappedDrives  $instanceDrivesList
    Write-Information "NetApp data drives: $netappDataDrives"
    
    # Get all log drives and check if they are NetApp drives
    $instanceAllLogDrives = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_LOG_DRIVES_QUERY}" -InstanceName "$instanceServiceName"  
    if(-Not ([string]::IsNullOrEmpty($instanceAllLogDrives)) -and (Test-ValidJson -JsonString $instanceAllLogDrives) ) {
        $instanceAllLogDrives = $instanceAllLogDrives | ConvertFrom-Json
    }
    else {
        Write-Information "Error occurred while fetching log drives. Error: $instanceAllLogDrives"
        $driveDetailsErrors["instanceLogDrivesError"] = $instanceAllLogDrives  -join ' ,'
        $instanceAllLogDrives = @()
    }
    $instanceDrivesList = @()
    $instanceAllLogDrives | ForEach-Object -Process {$instanceDrivesList += $_.drives}
    $netappLogDrives = Get-MappedDrives  $instanceDrivesList
    Write-Information "NetApp log drives: $netappLogDrives"

    
    $instanceAllDataDrivesSizes = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_USER_DB_DRIVE_SIZES}" -InstanceName "$instanceServiceName" 
    if(-Not ([string]::IsNullOrEmpty($instanceAllDataDrivesSizes)) -and (Test-ValidJson -JsonString $instanceAllDataDrivesSizes) ) {
        $instanceAllDataDrivesSizes = $instanceAllDataDrivesSizes | ConvertFrom-Json
    }
    else {
        Write-Information "Error occurred while fetching data drive size. Error: $instanceAllDataDrivesSizes"
        $driveDetailsErrors["instanceDataDriveSizeError"] = $instanceAllDataDrivesSizes  -join ' ,'
        $instanceAllDataDrivesSizes = @()
    }

    $instanceAllLogDrivesSizes = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_LOG_DB_DRIVE_SIZES}" -InstanceName "$instanceServiceName" 
    if(-Not ([string]::IsNullOrEmpty($instanceAllLogDrivesSizes)) -and (Test-ValidJson -JsonString $instanceAllLogDrivesSizes) ) {
        $instanceAllLogDrivesSizes = $instanceAllLogDrivesSizes | ConvertFrom-Json
    }
    else {
        Write-Information "Error occurred while fetching log drive size. Error: $instanceAllLogDrivesSizes"
        $driveDetailsErrors["instanceLogDriveSizeError"] = $instanceAllLogDrivesSizes  -join ' ,'
        $instanceAllLogDrivesSizes = @()
    }
    
    $allDriveDetails = @()
    foreach ($dataDrive in $instanceAllDataDrivesSizes) {
        if($netappDataDrives -contains $dataDrive.dataDriveLetter) {
            $logDrives = $instanceAllLogDrivesSizes | Where-Object { $_.databaseName -eq $dataDrive.databaseName }
            if ($logDrives) {
                if(-Not ($logDrives -is [array])) {
                    $logDrives = @($logDrives)
                }
                foreach ($logDrive in $logDrives) {
                    if ($netappLogDrives -notcontains $logDrive.logDriveLetter) {
                        continue
                        }
                    $driveObject = New-Object PSObject
                    #Copy each property from the source object to the new object
                    foreach ($property in $dataDrive.PSObject.Properties) {
                        $driveObject | Add-Member -MemberType NoteProperty -Name $property.Name -Value $property.Value
                    }
                    $driveObject | Add-Member -MemberType NoteProperty -Name "logDriveLetter" -Value $logDrive.logDriveLetter 
                    $driveObject | Add-Member -MemberType NoteProperty -Name "logDriveTotalSizeMB" -Value $logDrive.logDriveTotalSizeMB
                    $allDriveDetails += $driveObject
                }
                }
            } 
        }
    
    $defaultDataDriveDetails = $instanceAllDataDrivesSizes | Where-Object { $_.databaseName -eq 'msdb' }
    $defaultLogDriveDetails = $instanceAllLogDrivesSizes | Where-Object { $_.databaseName -eq 'msdb' }
    
    $defaultTempDBDriveDetails = Call-SqlCmd -SqlCredential $sqlCredential -Query "${TEMPDB_DRIVE_SIZE}" -InstanceName "$instanceServiceName"  
    if(-Not ([string]::IsNullOrEmpty($defaultTempDBDriveDetails)) -and (Test-ValidJson -JsonString $defaultTempDBDriveDetails) ) {
        $defaultTempDBDriveDetails = $defaultTempDBDriveDetails | ConvertFrom-Json
    }
    else {
        Write-Information "Error occurred while fetching tempdb drive size. Error: $defaultTempDBDriveDetails"
        $driveDetailsErrors["instanceTempDBDriveError"] = $defaultTempDBDriveDetails -join ' ,'
        $defaultTempDBDriveDetails = @()
    }

    foreach ($drive in $defaultTempDBDriveDetails) {
        $drive | Add-Member -MemberType NoteProperty -Name "dataDriveLetter" -Value $defaultDataDriveDetails.dataDriveLetter 
        $drive | Add-Member -MemberType NoteProperty -Name "dataDriveTotalSizeMB" -Value $defaultDataDriveDetails.dataDriveTotalSizeMB
    }

    $defaultDataDrive = 'shared-drive'
    if($netappDataDrives -notcontains $defaultDataDriveDetails.dataDriveLetter) 
    {
        $driveDetailsErrors["instanceDataDrivesError"] = "Data drive is not a NetApp drive."
        Write-Information "Data drive $defaultDataDriveDetails.dataDriveLetter is not a NetApp drive."
    }
    else {
    if(($defaultDataDriveDetails.dataDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter) -and ($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails )) {
    $defaultDataDrive = 'separate-drive'
    }
    } 
    
   if($netappDataDrives -notcontains $defaultLogDriveDetails.logDriveLetter) 
    {
        $driveDetailsErrors["instanceLogDrivesError"] = "Log drive is not a NetApp drive."
        Write-Information "Log drive $defaultLogDriveDetails.logDriveLetter is not a NetApp drive."
    }
    else {
    $defaultLogDrive = 'shared-drive'
    if(($defaultDataDriveDetails.dataDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter) -and ($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultLogDriveDetails.logDriveLetter )) {
    $defaultLogDrive = 'separate-drive'
    }
   }
    
    $tempdbDrive = 'shared-drive'
    if($netappDataDrives -notcontains $defaultTempDBDriveDetails.tempdbDriveLetter) 
    {
        $driveDetailsErrors["instanceTempDBDriveError"] = "TempDB drive is not a NetApp drive."
        Write-Information "TempDB drive $defaultTempDBDriveDetails.tempdbDriveLetter is not a NetApp drive."
    }
    else {
    if(($defaultTempDBDriveDetails.tempdbDriveLetter -notcontains $defaultDataDriveDetails.dataDriveLetter) -and ($defaultTempDBDriveDetails -notcontains $defaultLogDriveDetails.logDriveLetter)) {
    $tempdbDrive = 'separate-drive'
    }
    }

`;

const TEST_ISCSI_SESSIONS = `

function Test-IscsiSessions {
    # Retrieve all active iSCSI sessions
    $iscsiSessions = Get-IscsiSession
    if (-not $iscsiSessions) {
        return 0
    }
    
    $highestSessionCount = 0

    # Initialize a hashtable to track details for each target
    $detailsByTargetAndInitiator = @{}
    
    # Collect info for each initiator found
    foreach ($session in $iscsiSessions) {
        $targetAddress = $session.TargetNodeAddress
        $initiatorAddress = $session.InitiatorNodeAddress
        $identifier = $session.TargetSideIdentifier
        $key = "$initiatorAddress -> $targetAddress"

        # Initialize tracking structures for each unique initiator-target pair
        if (-not $detailsByTargetAndInitiator.ContainsKey($key)) {
            $detailsByTargetAndInitiator[$key] = @{
                TotalSessions = 0
                ActiveSessions = 0
                NonActiveSessions = 0
                TargetPortalAddressCounts = @{}
                HighestSessionCountOnANode = 0;
            }
        }

        # Update session counts
        $detailsByTargetAndInitiator[$key].TotalSessions += 1
        if ($session.IsConnected -and $session.IsPersistent) {
            $detailsByTargetAndInitiator[$key].ActiveSessions += 1
            $targetPortalAddress = (Get-IscsiTargetPortal -iSCSISession $session -ErrorAction SilentlyContinue).TargetPortalAddress
            if([string]::IsNullOrEmpty($targetPortalAddress)) {
                continue
            }
            $targetPortalAddressCounts = $detailsByTargetAndInitiator[$key].TargetPortalAddressCounts
            if ($targetPortalAddressCounts.ContainsKey($targetPortalAddress)) {
                $targetPortalAddressCounts[$targetPortalAddress]++
            } else {
                $targetPortalAddressCounts[$targetPortalAddress] = 1
            }
        } else {
            $detailsByTargetAndInitiator[$key].NonActiveSessions += 1
        }
    }

    # Display the results for each initiator-target pair
    foreach ($key in $detailsByTargetAndInitiator.Keys) {
        $details = $detailsByTargetAndInitiator[$key]
        $nodeCount = $details.TargetPortalAddressCounts.Count
        $pair = $key -split ' -> '
        $initiatorAddress = $pair[0]
        $targetAddress = $pair[1]
        $activeSessions = $details.ActiveSessions
        $totalSessions = $details.TotalSessions
        $highestSessionCountOnANode = $details.TargetPortalAddressCounts.Values | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum
        if ($activeSessions -ne 0) {
            if ($highestSessionCountOnANode -gt $highestSessionCount) {
                $highestSessionCount = $highestSessionCountOnANode
            }
        }
        
    }
    return $highestSessionCount

}

`;

const STORAGE_CONFIGURATION_ASSESSMENT = (instanceRecord: WorkloadInstance) =>
    `#Get Storage Configuration Assessment

    ${JSON_CHECK}

    ${slqcmdExecutionTemplate}

    # Define the path of the directory you want to create
    $LogFilesPath = "C:\\cfn\\log"
    # Check if the directory exists
    if (-not (Test-Path -Path $LogFilesPath -PathType Container)) {
        New-Item -Path $LogFilesPath -ItemType Directory
    } 
    
    Start-Transcript -Path ${STORAGE_ASSESSMENT_LOG_PATH} -Append | Out-Null

    $DriftAssessmentData = @{}
    $DriftAssessmentData['errors'] = @{}
    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $OntapSvmUuid = "${instanceRecord.svmOntapUuid}"
    $MappedVolumeNames = '${JSON.stringify(instanceRecord.mappedVolumeNames)}' | ConvertFrom-Json
    $MappedVolumeUuids = '${JSON.stringify(instanceRecord.mappedVolumesUuids)}' | ConvertFrom-Json
    $MappedLunNames = '${JSON.stringify(instanceRecord.mappedLunNames)}' | ConvertFrom-Json
  
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    Write-Information "Getting storage configuration assessment for FSxID: $FSxID, FSxRegion: $FSxRegion, SqlInstance: $sqlInstance"

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }
    Write-Information "SQL Service Instance Name: $instanceServiceName"

    ${ontapRestRequest}

    $DriftAssessmentData['filesystemId'] = $FSxID
    $APIEndpoint = '/storage/volumes'
    $APIQueryFilter = "uuid=${instanceRecord.mappedVolumesUuids?.join('|')}"
    $ApiQueryFields = "fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"
    
    # Volume details
    Write-Information "Getting ONTAP volume details for UUIDs: $MappedVolumeUuids"
    try{
        if([string]::IsNullOrEmpty($MappedVolumeUuids)) {
            throw "Unable to fetch ONTAP volumes details as the mapped volume UUIDs are either null or empty."
        }
        $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
        $Volumes = $Response.records

        $VolumeList = @()
        # loop through each volume and get data
        $SvmNames = @()
        foreach ($perVolumeData in $Volumes) {
            # Using PSCustomObject
            $perVolRow = [PSCustomObject]@{
                name = $perVolumeData.name
                'uuid' = $perVolumeData.uuid
                'thin-provision' = $perVolumeData.guarantee.honored
                'space-guarantee' = $perVolumeData.guarantee.type
                'autosize-mode' = $perVolumeData.autosize.mode
                'fractional-reserve' = $perVolumeData.space.fractional_reserve
                'snapshot-copy-reserve' = $perVolumeData.space.snapshot.reserve_percent
                'snapshot-autodelete' = $perVolumeData.space.snapshot.autodelete.enabled
                'snapshot-policy' = $perVolumeData.snapshot_policy.name
                'tiering-policy' = $perVolumeData.tiering.policy
                'tiering-min-cooling-days' = $perVolumeData.tiering.min_cooling_days
            }
            if($perVolumeData.autosize.mode -ne 'off') {
                $perVolRow | Add-Member -Name 'autosize' -Type NoteProperty -Value "on"
            }
            else {
                $perVolRow | Add-Member -Name 'autosize' -Type NoteProperty -Value "off"
            }
            $VolumeList += $($perVolRow)
            $SvmNames += $perVolumeData.svm.name
        }
        $DriftAssessmentData['volumes'] = @($($VolumeList))
    } catch {
     Write-Information "Error occurred while fetching ONTAP volume details. Error: $_.Exception.Message"
     $DriftAssessmentData['errors']['volumes'] = $_.Exception.Message
     }
    
    # Volume footprint details
    $SvmNamesWithDelimiter = $SvmNames -join '|'
    $APIEndpoint = '/private/cli/volume/show-footprint'
    $APIQueryFilter = "vserver=$SvmNamesWithDelimiter,volume=${instanceRecord.mappedVolumeNames?.join('|')}"
    $ApiQueryFields = "fields=volume-blocks-footprint-bin0-percent"
    
    Write-Information "Getting ONTAP volume footprint details for volumes: ${instanceRecord.mappedVolumeNames?.join(
        '|'
    )}"
    try{
        if([string]::IsNullOrEmpty($MappedVolumeNames)) {
            throw "Unable to fetch ONTAP volumes details as the mapped volume names are either null or empty."
        }
        $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFields $ApiQueryFields
        $Volumes = $Response.records

        # loop through each volume and get data
        # $PerformanceTierPercent = $Volumes | Where-Object {$MappedVolumeNames -contains $_.volume} | Select-Object -ExpandProperty volume_blocks_footprint_bin0_percent | Select-Object -Unique
        $PerformanceTierDetails = @()
        foreach ($perVolumeData in $Volumes) {
        if(($MappedVolumeNames -contains $perVolumeData.volume)) {
                $object = @{
                    "volumeName" = $perVolumeData.volume;
                    "performanceTierPercent" = $perVolumeData.volume_blocks_footprint_bin0_percent}
                $PerformanceTierDetails += $object
               
        }
        }
    } catch {
      Write-Information "Error occurred while fetching ONTAP volume footprint details. Error: $_.Exception.Message"
     $DriftAssessmentData['errors']['sizing'] = $_.Exception.Message
     }
    
   
    # Lun details
    $APIEndpoint = '/storage/luns'
    $APIQueryFilter = "name=${instanceRecord.mappedLunNames?.join('|')}"

    if ($OntapSvmUuid -ne '') {
        $APIQueryFilter += "&svm.uuid=$OntapSvmUuid"
    }

    $ApiQueryFields = "fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"
    Write-Information "Getting ONTAP LUN details for LUNs: ${instanceRecord.mappedLunNames?.join('|')}"
    try{
        if([string]::IsNullOrEmpty($MappedLunNames)) {
            throw "Unable to fetch ONTAP lun details as the mapped lun names are either null or empty."
        }
        $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
        $Luns = $Response.records
    
        $LunsList = @()

        # loop through luns and get per lun data
        foreach ($perLunData in $Luns) {
            # Using PSCustomObject
            $perLunRow = [PSCustomObject]@{
                name = $($perLunData.name)
                'os-type' = $($perLunData.os_type)
                'space-reservation-enabled' = $($perLunData.space.guarantee.requested)
                'space-allocation-allocated' = $($perLunData.space.scsi_thin_provisioning_support_enabled)
            }
            $LunsList += $($perLunRow)
        }
        $DriftAssessmentData['luns'] = @($($LunsList))
    } catch {
     Write-Information "Error occurred while fetching ONTAP LUN details. Error: $_.Exception.Message"
     $DriftAssessmentData['errors']['luns'] = $_.Exception.Message
     }
    

    # gather storage layout data
    Write-Information "Gathering storage layout data"
    $consolidatedDriveDetails = @()
    try{
        ${INSTANCE_DRIVE_DETAILS_TEMPLATE(instanceRecord.name, instanceRecord.sqlAuthEnabled)}

        ${DATABASE_VOLUME_LUN_DETAILS(instanceRecord)}
        
        $consolidatedDriveDetails = @()
        foreach ($drive in $allDriveDetails) {
            $logVolumeLunDetails = $responseObject.log | Where-Object { $_.name -eq $drive.databaseName }
            $dataVolumeLunDetails = $responseObject.data | Where-Object { $_.name -eq $drive.databaseName }  
            # Case when database has multiple drives
            if(-Not ($dataVolumeLunDetails -is [array])) { $dataVolumeLunDetails = @($dataVolumeLunDetails)}
            if ($logVolumeLunDetails) {
                if(-Not ($logVolumeLunDetails -is [array])) { $logVolumeLunDetails = @($logVolumeLunDetails)}
                foreach($logVolumeLunDetail in $logVolumeLunDetails) {
                    
                    $driveObject = New-Object PSObject
                    # Copy each property from the source object to the new object
                    foreach ($property in $drive.PSObject.Properties) {
                        $driveObject | Add-Member -MemberType NoteProperty -Name $property.Name -Value $property.Value
                        }
                    # When database has data files in multiple different drives, pick dataaccess path for the data drive currently being considered
                    $dataAccessPaths = $dataVolumeLunDetails | ForEach-Object { if($_.accessPaths -and $_.accessPaths.Count -gt 0 -and $_.accessPaths[0].startswith($drive.dataDriveLetter)) {$_.accessPaths[0]} }
                    # When database has multiple data files in the same drive, filter out the duplicate data access paths
                    $dataAccessPaths = $dataAccessPaths | Select -unique
                    $driveObject | Add-Member -MemberType NoteProperty -Name "ontapVolumeUuid" -Value $logVolumeLunDetail.ontapVolumeUuid 
                    $driveObject | Add-Member -MemberType NoteProperty -Name "ontapVolumeName" -Value $logVolumeLunDetail.ontapVolumeName
                    $driveObject | Add-Member -MemberType NoteProperty -Name "lunUuid" -Value $logVolumeLunDetail.lunUuid
                    $driveObject | Add-Member -MemberType NoteProperty -Name "svmName" -Value $logVolumeLunDetail.svmName
                    $driveObject | Add-Member -MemberType NoteProperty -Name "diskNumber" -Value $logVolumeLunDetail.diskNumber
                    $driveObject | Add-Member -MemberType NoteProperty -Name "diskSerialNumber" -Value $logVolumeLunDetail.lunSerialNumber
                    $driveObject | Add-Member -MemberType NoteProperty -Name "dataAccessPath" -Value $dataAccessPaths   
                    if($logVolumeLunDetail.accessPaths -and $logVolumeLunDetail.accessPaths.Count -gt 0) {
                        $driveObject | Add-Member -MemberType NoteProperty -Name "logAccessPath" -Value $logVolumeLunDetail.accessPaths[0]
                        }
                    $consolidatedDriveDetails += $driveObject
                    }
                }
            else {
                $consolidatedDriveDetails += $drive
                }
            }
            
            
        
        foreach ($drive in $defaultTempDBDriveDetails) {
            $tempdbVolumeLunDetails = $responseObject.tempDb
            if ($tempdbVolumeLunDetails) {
                $drive | Add-Member -MemberType NoteProperty -Name "ontapVolumeUuid" -Value $tempdbVolumeLunDetails.ontapVolumeUuid 
                $drive | Add-Member -MemberType NoteProperty -Name "ontapVolumeName" -Value $tempdbVolumeLunDetails.ontapVolumeName
                $drive | Add-Member -MemberType NoteProperty -Name "lunUuid" -Value $tempdbVolumeLunDetails.lunUuid
                $drive | Add-Member -MemberType NoteProperty -Name "svmName" -Value $tempdbVolumeLunDetails.svmName
                $drive | Add-Member -MemberType NoteProperty -Name "diskNumber" -Value $tempdbVolumeLunDetails.diskNumber
                $drive | Add-Member -MemberType NoteProperty -Name "diskSerialNumber" -Value $tempdbVolumeLunDetails.lunSerialNumber
                }
                
            }
        
        
        $DriftAssessmentData['layout'] = @{}
        if(-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"] ))) {
            $DriftAssessmentData['errors']['tempdb-files-location'] = $driveDetailsErrors["instanceTempDBDriveError"]
        }
        else {
            $DriftAssessmentData['layout']['tempdb-files-location'] = $tempdbDrive
        }
        
        if(-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceDataDrivesError"] ))) {
            $DriftAssessmentData['errors']['default-data-files-location'] = $driveDetailsErrors["instanceDataDrivesError"]
        }
        else {
            $DriftAssessmentData['layout']['default-data-files-location'] =  $defaultDataDrive;
        }

        if(-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceLogDrivesError"] ))) {
            $DriftAssessmentData['errors']['default-log-files-location'] = $driveDetailsErrors["instanceLogDrivesError"]
        }
        else {
            $DriftAssessmentData['layout']['default-log-files-location'] =  $defaultLogDrive;
        }

        $SimplifiedDataDriveDetails = @()
        foreach($drive in $responseObject.data) {
            $Detail = $SimplifiedDataDriveDetails | Where-Object { $_.diskNumber -eq $drive.diskNumber }
             $object = @{
                    "name" = $drive.name
                    "sizeInMb" = $drive.sizeInMb
                }
            if($null -eq $Detail) {
                $drive.PSObject.Properties.Remove('name')
                $drive.PSObject.Properties.Remove('sizeInMb')
                $drive.databaseDetails = @($object)
                $SimplifiedDataDriveDetails += $drive
            }  else {
                $Detail.databaseDetails += $object
            }
        }

        $SimplifiedLogDriveDetails = @()
        foreach($drive in $responseObject.log) {
            $Detail = $SimplifiedLogDriveDetails | Where-Object { $_.diskNumber -eq $drive.diskNumber }
            $object = @{
                    "name" = $drive.name
                    "sizeInMb" = $drive.sizeInMb
                }
            if($null -eq $Detail) {
                $drive.PSObject.Properties.Remove('name')
                $drive.PSObject.Properties.Remove('sizeInMb')
                $drive.databaseDetails = @($object)
                $SimplifiedLogDriveDetails += $drive
            }  else {
               
                $Detail.databaseDetails += $object
            }
        }

        $userDatabaseLayout = @{
            "data" = $SimplifiedDataDriveDetails
            "log" = $SimplifiedLogDriveDetails
            "tempDb" = $responseObject.tempDb
        }
        $DriftAssessmentData['layout']['user-database-layout'] = $($userDatabaseLayout)

        $DriftAssessmentData['sizing'] = @{}
        if(-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"] ))) {
            $DriftAssessmentData['errors']['data-tempdb-drive-details'] = $driveDetailsErrors["instanceTempDBDriveError"]
        }
        else {
            $DriftAssessmentData['sizing']['data-tempdb-drive-details'] = $($defaultTempDBDriveDetails);
        }

        $DriftAssessmentData['sizing']['performance-tier'] =  @($PerformanceTierDetails);

        $SimplifiedDriveDetails = @()
        foreach($drive in $consolidatedDriveDetails) {
            $Detail = $SimplifiedDriveDetails | Where-Object { $_.logAccessPath -eq $drive.logAccessPath -and $_.dataAccessPath -eq $drive.dataAccessPath }
            if($null -eq $Detail) {
                $SimplifiedDriveDetails += $drive
            }  else {
                $Detail.databaseName =  $Detail.databaseName + ',' + $drive.databaseName
            }
        }

        $DriftAssessmentData['sizing']['data-log-drive-details'] = @($($SimplifiedDriveDetails));
        
    } catch { 
        $DriftAssessmentData['errors']['layout'] = $_.Exception.Message
        $DriftAssessmentData['errors']['sizing'] = $_.Exception.Message
    }
    
    # gather OS configuration data 
     $DriftAssessmentData['os'] = @{}
    try{
        $MpioResponse = Get-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9 -ErrorAction SilentlyContinue | Select ProductId,VendorId 
        
        $MpioStatus = $false
        if(-not ([string]::IsNullOrEmpty($MpioResponse))) {
             if(($MpioResponse.VendorId -eq "MSFT2005") -and ($MpioResponse.ProductId -eq "iSCSIBusType_0x9")) {
                $MpioStatus = $true
            } 
        }
       
        $DriftAssessmentData['os']['mpio-enabled'] = $MpioStatus
        try { 
             # Get the formatted output as a string
            $output = Get-MPIOSetting | Format-List * | Out-String

            # Use a regex pattern to extract the DiskTimeoutValue
            $MatchString =  'DiskTimeoutValue\\s+:\\s+(\\d+)' 
            if ($output -match $MatchString) {
                $MpioTimeout = $Matches[1] 
            } else {
                $MpioTimeout = $null
            }
        }        
        catch {
            Write-Warning "Failed to retrieve DiskTimeoutValue: $_"
            $MpioTimeout = $null
        }
        $DriftAssessmentData['os']['mpio-timeout'] = $MpioTimeout
        
        # Fetch load balancing policy for all NetApp disks
        $AllNetappDisks = Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE'} | Select-Object -Property Number
        $InstanceDiskNumbers =   $($responseObject.data; $responseObject.log; $responseObject.tempDb) | ForEach-Object -MemberName diskNumber
        $InstanceDiskNumbers = $InstanceDiskNumbers | select -Unique
        $MpioLBDetails = mpclaim -s -d
        $LoadBalancingPolicy = 'RR'
        $ValidPolicies = @('RR', 'RRWS')
        $LoadBalancingPolicyDetails = @()
        foreach ($disk in $AllNetappDisks){
            if($InstanceDiskNumbers -notcontains $disk.Number) {
                continue
            }
            $AccessPaths = @($($responseObject.data; $responseObject.log; $responseObject.tempDb) | Where-Object { $_.diskNumber -eq $disk.Number } | ForEach-Object { $_.accessPaths })
            if (-Not ($AccessPaths -is [array])) {
                $AccessPaths = @($AccessPaths)
            }
            $MatchString = ".*Disk\\s+" + $disk.Number + "\\s+(\\S+)"
            $MatchGroup = [regex]::match($MpioLBDetails,$MatchString).Groups[1]
            if($MatchGroup.Success -eq 'True') {
                $object = [PSCustomObject]@{
                    "disk" = "Disk " + $disk.Number
                    "accessPath" = $AccessPaths[0]
                    "policy" = $MatchGroup.Value
                }
               if ($ValidPolicies -notcontains $MatchGroup.Value) {
               $LoadBalancingPolicy = 'Other'
            }
            $LoadBalancingPolicyDetails += $($object)
            }
        }
        $DriftAssessmentData['os']['mpio-load-balance-policy'] = "$LoadBalancingPolicy"
        $DriftAssessmentData['os']['mpio-load-balance-policy-details'] = $LoadBalancingPolicyDetails
        } catch {$DriftAssessmentData['errors']['mpio-policy'] = $_.Exception.Message}

    ${TEST_ISCSI_SESSIONS}
    
    try{
        $SessionCount = Test-IscsiSessions
        $DriftAssessmentData['os']['mpio-iscsi-count'] = "$SessionCount"
        } catch {$DriftAssessmentData['errors']['iscsi-sessions'] = $_.Exception.Message}
    
    try{
        $filteredDataDrives = $instanceAllDataDrivesSizes | ForEach-Object -MemberName dataDriveLetter
        $filteredLogDrives =  $instanceAllLogDrivesSizes | ForEach-Object -MemberName logDriveLetter
        $filteredTempDbDrives =  $defaultTempDBDriveDetails | ForEach-Object -MemberName tempdbDriveLetter
        $AllDrives = $($filteredDataDrives; $filteredLogDrives;  $filteredTempDbDrives)
        $AllDrives = $AllDrives | select -Unique
        $ntfsAllocationUnit = Get-CimInstance -ClassName Win32_Volume | Where {$AllDrives -contains $_.DriveLetter}  | Select-Object DriveLetter, BlockSize 
        $ntfsUnitSize = 65536
        $ntfsAllocationUnit | ForEach-Object -Process {if($_.BlockSize -ne 65536) {$ntfsUnitSize = $_.BlockSize}}
        $DriftAssessmentData['os']['ntfs-allocation-details'] = $($ntfsAllocationUnit)
        $DriftAssessmentData['os']['ntfs-allocation-unit-size'] = $($ntfsUnitSize)
    } catch {$DriftAssessmentData['errors']['ntfs-allocation'] = $_.Exception.Message}

    $response = $DriftAssessmentData | ConvertTo-Json -Depth 8 -Compress

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
`;

const OPTIMIZE_STORAGE_PARAMS_SCRIPT = (params: OptimizeStorageParams) => `
    #Storage Optimization Script
    Start-Transcript -Path ${SIZING_OPERATIONS_LOG_PATH} -Append | Out-Null

    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${params.fsxId}'
    $FSxRegion = '${params.region}'
    $apiEndpoint = '${params.apiEndpoint}'
    $apiQueryFilter = '${params.apiQueryFilter}'
    $apiBody = '${params.apiBody}'
    Write-Information "Fixing storage for FSx ID: $FSxID FSX region: $FSxRegion"
    ${ontapRestRequest}

    $newBody = $apiBody | ConvertFrom-Json

    $body =   $newBody | ConvertTo-Json

    $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $apiQueryFilter -body $body -method "PATCH"

    $ontapResponse | ConvertTo-Json
    
    Stop-Transcript | Out-Null
`;

const RESCAN_EXTEND_LUN = (diskSerialNumber: string) => `
#Rescan and extend the LUN
Function Rescan-ExtendLUN {
    param (
        [Parameter(Mandatory = $true)]
        [string]$DiskSerialNumber
    )
    
    $PartitionTypes = @('Basic', 'IFS')
    try {
        # Rescan and extend the LUN
        $null = (echo "RESCAN" | diskpart)
        $disk = Get-Disk | Where-Object { $_.SerialNumber -ceq "$DiskSerialNumber" }
            
        if ($null -eq $disk) {
            throw "No disk found with SerialNumber $DiskSerialNumber"
        }
        
        $diskNumber = $disk.Number
        $partition = Get-Partition -DiskNumber $diskNumber | Where-Object { $PartitionTypes  -contains $_.Type }
        if($null -eq $partition) {
            throw "No partition of type BASIC/IFS found on disk $diskNumber"
        }
        $size = ($partition | Get-PartitionSupportedSize).SizeMax
        $partitionNumber = $partition.PartitionNumber
        Resize-Partition -DiskNumber $diskNumber -PartitionNumber $partitionNumber -Size $size
        $result = @{ status = 'success' }
    } catch {
        # Handle any errors that occur
        $result = @{ status = 'failed'; error = $_.Exception.Message }
    } finally {
        # Convert the result to JSON
        $result | ConvertTo-Json -Compress
    }
}
$jsonResult = Rescan-ExtendLUN -DiskSerialNumber '${diskSerialNumber}'
Write-Output $jsonResult
`;

const CHECK_NODE_STATUS = (nodeName: string) => `
    Start-Transcript -Path ${DISCOVER_OPERATION_LOG_PATH} -Append | Out-Null
    #Check Node Status
    Function Check-NodeStatus {
        param (
            [Parameter(Mandatory = $true)]
            [string]$NodeName
        )
        
        try {
            # Get the specific cluster node
            $node = Get-ClusterNode -Name $NodeName
            
            Write-Information "Testing connection to node $NodeName"
            # Check if the node is "Up" and Test-Connection succeeds
            if ($node.State -eq "Up" -and (Test-Connection -ComputerName $NodeName -Count 1 -Quiet)) {
                $result = @{ status = 'success' }
            } else {
                $result = @{ status = 'failed' }
                Write-Information "Failed to connect to node $NodeName"
            }
        } catch {
            # Handle any errors that occur
            Write-Error "Error occurred while checking node status: $_.Exception.Message"
            $result = @{ status = 'failed'; error = $_.Exception.Message }
        } finally {
            Stop-Transcript | Out-Null
            # Convert the result to JSON
            $result | ConvertTo-Json -Compress
        }
    }
    $jsonResult = Check-NodeStatus -NodeName "${nodeName}"
    Write-Output $jsonResult
`;

const MOVE_ALL_CLUSTER_GROUPS = (nodeName: string) => `
#Move Cluster Groups
Start-Transcript -Path ${COMPUTE_OPTIMIZE_LOG_PATH} -Append | Out-Null
Function Move-AllClusterGroups {
    param (
        [Parameter(Mandatory = $true)]
        [string]$TargetNodeName
    )
    
    $result = @()
    
    try {
        # Get all cluster groups
        $clusterGroups = Get-ClusterGroup
        
        # Iterate over each cluster group
        Write-Information "Moving cluster groups to node $TargetNodeName"
        $clusterGroups | ForEach-Object {
            if ($_.Name -match "SQL Server") {
                $clusterGroupName = $_.Name
                $groupResult = @{
                    groupName = $clusterGroupName
                    status = 'success'
                    error = $null
                }
                try {
                    # Move the cluster group to the target node
                    Move-ClusterGroup -Name $clusterGroupName -Node $TargetNodeName > $null
                    $groupResult.status = 'success'
                } catch {
                    # Update status and error in case of failure
                    $groupResult.status = 'failed'
                    $groupResult.error = $_.Exception.Message
                    $errorMsg = "Error occurred while moving cluster group: $clusterGroupName : $_.Exception.Message"
                    Write-Information "$errorMsg"
                    Write-Error "$errorMsg"
                }
                Write-Information "Status of moving cluster group: $clusterGroupName : $groupResult.status"
                # Add group result to result array
                $result += $groupResult
            }
        }
    } catch {
        # Handle any errors that occur
        $errorMsg = "Error occurred while moving cluster groups: $_.Exception.Message"
        Write-Error "$errorMsg"
        Write-Information "$errorMsg"
        $result = @(@{ status = 'failed'; error = $_.Exception.Message })
    } finally {
        Stop-Transcript | Out-Null
        # Convert the result to JSON and output
        $jsonResult = $result | ConvertTo-Json -Compress
        Write-Output $jsonResult
    }
}
$jsonResult = Move-AllClusterGroups -TargetNodeName "${nodeName}"
Write-Output $jsonResult
`;

const GET_CLUSTER_NODE_NAMES = () => `
    #Get cluster node names 
    Start-Transcript -Path ${DISCOVER_OPERATION_LOG_PATH} -Append | Out-Null
    $currentNode = hostname
    $clusterNodes = Get-ClusterNode -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name;
    $ownerNode = (Get-ClusterGroup -Name 'SQL Server*').OwnerNode | Select-Object -ExpandProperty Name;
    @{currentNode= $currentNode;clusterNodes = $clusterNodes;ownerNodes = $ownerNode;} | ConvertTo-Json
    Write-Information "Cluster nodes: $clusterNodes with owner node: $ownerNode"
    Stop-Transcript | Out-Null

`;

const GET_RSS_CONFIG_DETAILS = () => `
    #Get RSS Configuration Details

    $rssAdapters = Get-NetAdapterRss
    $result = @()

    foreach ($rssAdapter in $rssAdapters) {
        $result += [PSCustomObject]@{
            adapterName = $rssAdapter.Name
            rssEnabled = $rssAdapter.Enabled
            rssProfile = $rssAdapter.Profile -as [string]
            baseProcessorNumber = $rssAdapter.BaseProcessorNumber
            numberOfReceiveQueues = $rssAdapter.NumberOfReceiveQueues
        }
    }

    $vcpus = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
    $tcpOffloadState = (Get-NetOffloadGlobalSetting).Chimney

    # Combine the results
    $result = [PSCustomObject]@{
        adapters = $result
        vcpuCount = $vcpus
        tcpOffloadState = $tcpOffloadState -as [string]
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const OPTIMIZE_NETWORK_ADAPTERS = (networkAdapters: string[]) => `
    # Optimize Network Adapters
    Start-Transcript -Path ${RSS_OPTIMIZE_LOG_PATH} -Append | Out-Null

    $response = @{}
    $response['errors'] = @{}
    $response['response'] = @{}

    $networkAdapters = @(${networkAdapters.map(name => `'${name}'`).join(', ')})
    $optimalRssProfile = 'NUMAStatic'

    try {
        # Disable global TCP Offload
        Set-NetOffloadGlobalSetting -Chimney Disabled

        # Optimize RSS settings for each network adapter
        if($networkAdapters.Count -eq 0) {
            Write-Information "No network adapters passed to optimize, checking for network adapters"
            $networkAdapters = Get-NetAdapterRss | Select-Object -ExpandProperty Name
        }

        foreach($adapterName in $networkAdapters) {
            try {
                $currentRssSettings = Get-NetAdapterRss -Name $adapterName
                $parameters = @{}
                $vcpus = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
                
                $optimalRssReceiveQueues = $vcpus
                $optimalBaseProcessorNumber = $currentRssSettings.BaseProcessorNumber
                if($vcpus -ge 4) {
                    $optimalBaseProcessorNumber = 2
                } else {
                    Write-Information "Number of vCPUs is less than 4. Not optimizing base processor number for adapter: $adapterName"
                }
                if($vcpus -gt 8) {
                    $optimalRssReceiveQueues = 8
                }
                if ($currentRssSettings.Enabled -eq $false) {
                    Write-Information "Enabling RSS on adapter: $adapterName"
                    Enable-NetAdapterRss -Name $adapterName -NoRestart
                }
                if ($currentRssSettings.NumberOfReceiveQueues -ne $optimalRssReceiveQueues) {
                    $parameters['NumberOfReceiveQueues'] = $optimalRssReceiveQueues
                }
                if ($currentRssSettings.BaseProcessorNumber -lt $optimalBaseProcessorNumber) {
                    $parameters['BaseProcessorNumber'] = $optimalBaseProcessorNumber
                }
                if ($currentRssSettings.Profile -ne $optimalRssProfile) {
                    $parameters['Profile'] = $optimalRssProfile
                }
                
                if ($parameters.Count -gt 0) {
                    Write-Information "Setting RSS best practices values on adapter: $adapterName, $parameters"
                    $parameters['Name'] = $adapterName
                    Set-NetAdapterRss @parameters -NoRestart
                }
                # wait for insyance to respond back to the SSM invocation before reboot
            } catch {
                $errMsg = "Error occurred while fixing network adapter: $adapterName $_.Exception.Message"
                Write-Information $errMsg
                $response['errors'][$adapterName] = $errMsg
            }          
        }
        Start-Process -FilePath "shutdown.exe" -ArgumentList @("/r", "/t 10") -Wait -NoNewWindow
    } catch {
        $errMsg = "Error occurred while fixing network adapters: $_.Exception.Message"
        Write-Information $errMsg
        $response['errors']['networkAdapters'] = $errMsg
    }
         
    if($response.errors.Count -eq 0) {
        $response['response'] = "SUCCESS"
    } else {
        $response['response'] = "FAILED"
    }
    
    $response = $response | ConvertTo-Json
    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    Stop-Transcript | Out-Null
    return ($response)
    
`;

const GET_RUNNING_SQL_SERVERS = () => `
    # Get running SQL Server instances
    $sqlServices = Get-Service | Where-Object { $_.DisplayName -like "*SQL Server (*)" -and $_.Status -eq 'Running' } | Select-Object -ExpandProperty DisplayName
    $jsonArray = @($sqlServices) | ConvertTo-Json
    Write-Output $jsonArray
`;

const CHECK_RUNNING_STATUS_WITH_RESTART = (serverNames: string[]) => `
    # Check running status and restart if not running
    Start-Transcript -Path ${COMPUTE_OPTIMIZE_LOG_PATH} -Append | Out-Null
    $serverNames = @(${serverNames.map(name => `'${name}'`).join(', ')})
    $sqlServices = Get-Service | Where-Object { $_.DisplayName -in $serverNames }
    $results = @()
    if ([string]::IsNullOrEmpty($sqlServices)) {
        Write-Output '[]'
        return
    }
    foreach ($sqlService in $sqlServices) {
        $serviceResult = @{}
        if ($sqlService.Status -eq 'Running') {
            $serviceResult = @{ name = $sqlService.Name; status = 'Running' }
        } else {
            try { $sqlService.WaitForStatus('Running', '00:00:20') | Out-Null } catch {}
            $sqlService = Get-Service | Where-Object { $_.Name -eq $sqlService.Name }
            if ($sqlService.Status -ne 'Running') {
                Start-Service -Name $sqlService.Name | Out-Null
                try { $sqlService.WaitForStatus('Running', '00:00:20') | Out-Null } catch {}
            }
            $serviceResult = @{ name = $sqlService.Name; status = $sqlService.Status.ToString() }
        }
        $resObj = New-Object PSObject -Property $serviceResult
        $results += $resObj
    }
    $jsonResult = $results | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const GET_VCPU_AND_MAXDOP_DETAILS = (instanceName: string, sqlAuthEnabled: boolean) => `
    #Get vCPU and MAXDOP Details
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlInstanceName = "${instanceName}"

    ${slqcmdExecutionTemplate}
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }
    
    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($sqlInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
         
    }

    $vcpus = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
    $maxDopResult = Call-SqlCmd -SqlCredential $sqlCredential -Query "sp_configure 'max degree of parallelism'" -InstanceName "$ServerInstanceName"

    # Initialize maxDop to 0
    $maxDop = "0"

    # Check if maxDopResult is not empty and parse the result to extract the run_value
    if ($maxDopResult) {
        $maxDop = $maxDopResult | Select-String -Pattern 'max degree of parallelism' | ForEach-Object {
            if ($_ -match '(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)') {
                $matches[4]
            }
        } | Select-Object -First 1
    }

    # Check if maxDop is empty or null, set to 0 if it is
    if (-not $maxDop) {
        $maxDop = "0"
    }

    $result = [PSCustomObject]@{
        vcpuCount = $vcpus
        maxDOP = $maxDop
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const GET_INSTALLED_SQL_PATCHES = () => `
    # Get the list of installed patches
    $installedPatches = Get-ChildItem -Path HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall |
        Get-ItemProperty |
        Where-Object {($_.DisplayName -like "Hotfix*SQL*") -or ($_.DisplayName -like "Service Pack*SQL*") -or ($_.DisplayName -like "GDR*SQL*")} |
        Select-Object -Property DisplayName, DisplayVersion, InstallDate

    # Prepare the result
    $result = [PSCustomObject]@{
        installedPatches = $installedPatches
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const GET_INSTALLED_MSSQL_VERSION = (instanceName: string, sqlAuthEnabled: boolean) => `
    # Get the installed SQL Server version
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlInstanceName = "${instanceName}"

     ${slqcmdExecutionTemplate}
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($sqlInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
    }

    $sqlVersionResult = Call-SqlCmd -SqlCredential $sqlCredential -Query "${SERVER_VERSION}" -InstanceName "$ServerInstanceName"
    return $sqlVersionResult
`;

const GET_CLUSTER_SNAPSHOT_POLICIES = (fsxId: string, region: string) => `
    # Get list of snapshot policies on cluster level
    Start-Transcript -Path ${RESILIENCY_OPTIMIZE_LOG_PATH} -Append | Out-Null
    ${JSON_CHECK};
    $response = @{}
    $response['errors'] = @{}
    $response['response'] = @{}
    $response['response']['snapshotPolicies'] = @{}
    $response['errors']['snapshotPolicies'] = @{}
    $response['response']['snapshotSchedules'] = @{}
    $response['errors']['snapshotSchedules'] = @{}
    $FSxID = '${fsxId}'
    $FSxRegion = '${region}'
    
    $snapshotPoliciesUri = '/storage/snapshot-policies'
    $snapshotPoliciesQueryFilter = "enabled=true"
    $snapshotPoliciesQueryFields = 'fields=svm,scope,copies'
    $snapshotPoliciesQueryFilter = 'enabled=true'
    
    $snapshotScheduleUri = '/cluster/schedules'
    $snapshotScheduleQueryFields = 'fields=uuid,interval,cron'
    ${ontapRestRequest}
    try {
        Write-Information "Fetching ONTAP snapshot policies for FSx ID: $FSxID FSX region: $FSxRegion"
        $response['response']['snapshotPolicies'] = Invoke-ONTAPRequest -ApiEndpoint $snapshotPoliciesUri -ApiQueryFields $snapshotPoliciesQueryFields -ApiQueryFilter $snapshotPoliciesQueryFilter
    } catch {
        Write-Information "Error occurred while fetching ONTAP snapshot policies. Error: $_.Exception.Message"
        $response['errors']['snapshotPolicies'] = $_.Exception.Message
    }
    
    try{
        Write-Information "Fetching ONTAP snapshot schedules for FSx ID: $FSxID FSX region: $FSxRegion"
        $response['response']['snapshotSchedules'] = Invoke-ONTAPRequest -ApiEndpoint $snapshotScheduleUri -ApiQueryFields $snapshotScheduleQueryFields
    } catch {
        Write-Information "Error occurred while fetching ONTAP snapshot schedules. Error: $_.Exception.Message"
        $response['errors']['snapshotSchedules'] = $_.Exception.Message
    }
    $response = $response | ConvertTo-Json -Depth 7
    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    ${compressResponse}
    Stop-Transcript | Out-Null
    return (Deflate-String $response)
`;

const GET_SNAPSHOT_DETAILS = (
    volumeUuids: string[],
    fsxId: string,
    region: string,
    fields: OntapRestRequestParams = {
        queryFilter: 'order_by=create_time desc&max_records=1',
        queryFields: 'create_time'
    }
) => `
    # Get list of creation dates for latest snapshot copies of each volume

    Start-Transcript -Path ${RESILIENCY_OPTIMIZE_LOG_PATH} -Append | Out-Null
    ${JSON_CHECK};
    $response = @{}
    $response['errors'] = @{}
    $response['response'] = @{}
    $volumes = @(${volumeUuids.map(uuid => `'${uuid}'`).join(', ')})
    $FSxID = '${fsxId}'
    $FSxRegion = '${region}'
    $apiEndpoint = '/storage/volumes/'
    $apiQueryFilter = "${fields.queryFilter}"
    $apiQueryFields = "fields=${fields.queryFields}"
    ${ontapRestRequest}
    try {
        Write-Information "Getting snapshot copy details for volumes: $volumes"
        foreach($volume in $volumes) {
            try {
                Write-Information "Getting snapshot copy details for volume: $volume"
                $rawRes = Invoke-ONTAPRequest -ApiEndpoint ($apiEndpoint + $volume + '/snapshots') -ApiQueryFilter $apiQueryFilter -ApiQueryFields $apiQueryFields
                $fieldsList = "${fields.queryFields}".Split(',') | ForEach-Object { $_.Trim() }
                $resultObj = @{}
                foreach ($field in $fieldsList) {
                    $resultObj[$field] = $rawRes.records | ForEach-Object { $_.$field }
                }
                $response.response[$volume] = $resultObj
            } catch {
                $response.errors[$volume] = $_.Exception.Message
                Write-Information "Error occurred while fetching snapshot copy details for volume: $volume. Error: $_.Exception.Message"
            }
        }
        $response = $response | ConvertTo-Json
        if([string]::IsNullOrEmpty($response)) {
            throw "Failed to compress the response because the response is either null or empty. $response"
        }
        ${compressResponse}
        Stop-Transcript | Out-Null
        return (Deflate-String $response)
    } catch {
        Write-Information "Error occurred while fetching snapshot copy details: $_.Exception.Message"
        Stop-Transcript | Out-Null
        return $_.Exception.Message
    }
`;

/**
 * @returns the UUID of the ONTAP job created for setting the snapshot policy;
 * Expected response structure:
 * { "errors": { }, "response": [ { "uuid": "18873848-d09c-11ef-a0ec-61a27a6bebc8" }]}
 */
const SET_VOLUME_SNAPSHOT_POLICY = (params: BulkOptimizeSnapshotPolicyParamsType) => `
    # Set snapshot policy for volumes
    Start-Transcript -Path ${RESILIENCY_OPTIMIZE_LOG_PATH} -Append | Out-Null
    ${JSON_CHECK};
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${params.fsxId}'
    $FSxRegion = '${params.region}'
    $volUuids = '${params.volUuids}' | ConvertFrom-Json
    $apiEndpoint = '/storage/volumes/'
    $apiBody = '${params.apiBody}'
    $res = @{}
    $res['response'] = @{}
    $res['errors'] = @{}
    $volRes = @()
    $errors = @()
    ${ontapRestRequest}

    foreach($volUuid in $volUuids) {
        try {
            Write-Information "fixing Snaphot policy for FSx ID: $FSxID FSX region: $FSxRegion Volume UUID: $volUuid"
            $body = $apiBody | ConvertFrom-Json | ConvertTo-Json
            $apiEndpointWithPathParams = $apiEndpoint + $volUuid
            $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $apiEndpointWithPathParams -ApiQueryFilter $apiQueryFilter -body $body -method "PATCH"
            $volRes += [PSCustomObject]@{
                uuid = $ontapResponse.job.uuid
            }
        } catch {
            $errors += $_.Exception.Message
            Write-Information "Error occurred while fixing Snaphot policy for FSx ID: $FSxID FSX region: $FSxRegion Volume UUID: $volUuid. Error: $_.Exception.Message"
        }
    }
    $res['response'] = @($volRes)
    $res['errors'] = @($errors)

    $res = $res | ConvertTo-Json

    if([string]::IsNullOrEmpty($res)) {
        throw "Failed to compress the response because the response is either null or empty. $res"
    }
    ${compressResponse}
    Stop-Transcript | Out-Null
    return (Deflate-String $res)

`;

const SET_MAXDOP = (instanceName: string, sqlAuthEnabled: boolean, maxDopValue: number, isClustered: boolean) => `
    #Set MAXDOP
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlInstanceName = "${instanceName}"
    $maxDopValue = ${maxDopValue}
    $isClustered = [System.Convert]::ToBoolean('${isClustered}')

    ${slqcmdExecutionTemplate}
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($sqlInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
         
    }
        
    ${GET_FCI_NAME}

    # Set the MAXDOP value with RECONFIGURE WITH OVERRIDE
    $setMaxDopQuery = "EXEC sp_configure 'show advanced options', 1; RECONFIGURE WITH OVERRIDE; EXEC sp_configure 'max degree of parallelism', $maxDopValue; RECONFIGURE WITH OVERRIDE;"
    
    $result = [PSCustomObject]@{
        status = "failed"
        message = ""
    }

    try {
        $response = Call-SqlCmd -SqlCredential $sqlCredential -Query $setMaxDopQuery -InstanceName "$ServerInstanceName"
        $result.status = "success"
        $result.message = "MAXDOP set to $maxDopValue for instance $ServerInstanceName, $response"
    } catch {
        $result.message = "Error while configuring MAXDOP for instance $_"
        if ($isClustered) {
            try {
                $ClusterName = Get-FCIName -sqlServerNameToFind $sqlInstanceName
                if ($ClusterName -ne '') {
                    $connectionString = "Server=$ClusterName;Integrated Security=True;TrustServerCertificate=True;"
                    Invoke-Sqlcmd -AbortOnError -ErrorAction Stop -Query $setMaxDopQuery -ConnectionString $connectionString
                    $result.status = "success"
                    $result.message = "MAXDOP configured using cluster name $ClusterName."
                } else {
                    $result.message = "Cluster name not found for instance $sqlInstanceName."
                }
            } catch {
                $result.message = "Error while configuring MAXDOP using cluster name: $_"
            }
        }
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const GET_SANDBOX_DETAILS = (instanceName: string, sqlAuthEnabled: boolean, query: string) => `
    #Get sandbox Details
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlInstanceName = "${instanceName}"
    $query = "${query}"

    ${slqcmdExecutionTemplate}
    $sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }
    
    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($sqlInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
    }
    
    $cloneResponse = Call-SqlCmd -SqlCredential $sqlCredential -Query $query -InstanceName "$ServerInstanceName"
    
    # Check if $cloneResponse is Null, empty, or whitespace
    if ([string]::IsNullOrEmpty($cloneResponse) -or $cloneResponse -ieq "Null") {
        Write-Information "No sandboxes found for the given query."
        $result = [PSCustomObject]@{
            cloneResponse = @() # Return an empty array to indicate no sandboxes
        }
    } else {
        $result = [PSCustomObject]@{
            cloneResponse = $cloneResponse
        }
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

export {
    OntapRestRequestParams,
    STORAGE_CONFIGURATION_ASSESSMENT,
    GET_ONTAP_LUN_DETAILS,
    OPTIMIZE_STORAGE_PARAMS_SCRIPT,
    CHECK_NODE_STATUS,
    RESCAN_EXTEND_LUN,
    MOVE_ALL_CLUSTER_GROUPS,
    GET_CLUSTER_NODE_NAMES,
    GET_RSS_CONFIG_DETAILS,
    OPTIMIZE_NETWORK_ADAPTERS,
    GET_RUNNING_SQL_SERVERS,
    CHECK_RUNNING_STATUS_WITH_RESTART,
    GET_VCPU_AND_MAXDOP_DETAILS,
    GET_INSTALLED_SQL_PATCHES,
    GET_INSTALLED_MSSQL_VERSION,
    GET_CLUSTER_SNAPSHOT_POLICIES,
    SET_VOLUME_SNAPSHOT_POLICY,
    SET_MAXDOP,
    JSON_CHECK,
    GET_SNAPSHOT_DETAILS,
    GET_SANDBOX_DETAILS,
    FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS
};
