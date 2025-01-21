import { OntapRequestParams, OptimizeStorageParams, WorkloadInstance } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
import { COMPUTE_OPTIMIZE_LOG_PATH, DISCOVER_OPERATION_LOG_PATH, SIZING_OPERATIONS_LOG_PATH } from './const';
import {
    DEFAULT_DATA_DRIVE_SIZE,
    INSTANCE_DATA_DRIVES_QUERY,
    INSTANCE_DEFAULT_DATA_DRIVES_QUERY,
    INSTANCE_DEFAULT_LOG_DRIVES_QUERY,
    INSTANCE_LOG_DB_DRIVE_SIZES,
    INSTANCE_LOG_DRIVES_QUERY,
    INSTANCE_TEMPDB_DRIVES_QUERY,
    INSTANCE_USER_DB_DRIVE_SIZES,
    TEMPDB_DRIVE_SIZE
} from './queries';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

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
            where db.database_id > 4
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
            $winvolumes = $sqlresponse | ConvertFrom-Json
            foreach ($winvolume in $winvolumes) {
                # check in winvolume volume id is null or empty string
                if (-Not ([string]::IsNullOrEmpty($winvolume.volumeid))) {
                    
                    $vol = get-volume -Path $winvolume.volumeid | Get-Partition | get-disk | Select serialnumber, bustype, number
                    $partition = get-volume -Path $winvolume.volumeid | Get-Partition | Select accesspaths
                    if ($vol.bustype -eq 'iscsi') {
                        $object = @{
                        "name" = $winvolume.name
                        "fileName" = $winvolume.filename
                        "lunSerialNumber" = $vol.serialnumber
                        "sizeInMb" = $winvolume.sizeInMb
                        "diskNumber" = $vol.number
                        "accessPaths" = $partition.accesspaths
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
            Write-Information "$logPrefix Get ONTAP lun name from serial numbers for: $responseObject"
    
            $QueryFilter = ''
            foreach ($vol in $responseObject.data) {
                $QueryFilter += $vol.lunSerialNumber + '|'
            }
            foreach ($vol in $responseObject.log) {
                $QueryFilter += $vol.lunSerialNumber + '|'
            }
            foreach ($vol in $responseObject.tempDb) {
                $QueryFilter += $vol.lunSerialNumber + '|'
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
    
        $sqlCredential = @{'useSqlAuth' = $False}
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
    $sqlCredential = @{'useSqlAuth' = $False}

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }

    
    if($sqlAuthEnabled) {
        ${readSsmParameter(instance)}
    }
    
    ${INSTANCE_NETAPP_DRIVES}
    
    $instanceDefaultDataDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_DEFAULT_DATA_DRIVES_QUERY}" -InstanceName "$instanceServiceName" 

    $instanceAllDataDrives = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_DATA_DRIVES_QUERY}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    $instanceDrivesList = @()
    $instanceAllDataDrives | ForEach-Object -Process {$instanceDrivesList += $_.drives}
    $netappDataDrives = Get-MappedDrives  $instanceDrivesList

    $instanceDefaultLogDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_DEFAULT_LOG_DRIVES_QUERY}" -InstanceName "$instanceServiceName"

    $instanceAllLogDrives = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_LOG_DRIVES_QUERY}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    $instanceDrivesList = @()
    $instanceAllLogDrives | ForEach-Object -Process {$instanceDrivesList += $_.drives}
    $netappLogDrives = Get-MappedDrives  $instanceDrivesList

    $instanceAllDataDrivesSizes = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_USER_DB_DRIVE_SIZES}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    $instanceAllLogDrivesSizes = Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_LOG_DB_DRIVE_SIZES}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    
    foreach ($dataDrive in $instanceAllDataDrivesSizes) {
        if($netappDataDrives -contains $dataDrive.dataDriveLetter) {
            $logDrive = $instanceAllLogDrivesSizes | Where-Object { $_.databaseName -eq $dataDrive.databaseName }
            if (($logDrive) -and ($netappLogDrives -contains $logDrive.logDriveLetter)) {
                $dataDrive | Add-Member -MemberType NoteProperty -Name "logDriveLetter" -Value $logDrive.logDriveLetter 
                $dataDrive | Add-Member -MemberType NoteProperty -Name "logDrivePath" -Value $logDrive.logDrivePath
                $dataDrive | Add-Member -MemberType NoteProperty -Name "logDriveTotalSizeMB" -Value $logDrive.logDriveTotalSizeMB
                }
            } 
        }
    
    $instanceTempdbDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_TEMPDB_DRIVES_QUERY}" -InstanceName "$instanceServiceName"
    $defaultDataDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${DEFAULT_DATA_DRIVE_SIZE}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    $defaultTempDBDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${TEMPDB_DRIVE_SIZE}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    foreach ($drive in $defaultTempDBDriveSize) {
        $drive | Add-Member -MemberType NoteProperty -Name "defaultDataDriveLetter" -Value $defaultDataDriveSize.dataDriveLetter 
        $drive | Add-Member -MemberType NoteProperty -Name "dataDriveTotalSizeMB" -Value $defaultDataDriveSize.dataDriveTotalSizeMB
    }

    $defaultDataDrive = 'shared-drive'
    if(($instanceDefaultDataDrivedetails -notcontains $instanceDefaultLogDrivedetails) -and ($instanceTempdbDrivedetails -notcontains $instanceDefaultDataDrivedetails )) {
    $defaultDataDrive = 'separate-drive'
    }
    
    $defaultLogDrive = 'shared-drive'
    if(($instanceDefaultDataDrivedetails -notcontains $instanceDefaultLogDrivedetails) -and ($instanceTempdbDrivedetails -notcontains $instanceDefaultLogDrivedetails )) {
    $defaultLogDrive = 'separate-drive'
    }
    
    $tempdbDrive = 'shared-drive'
    if(($instanceTempdbDrivedetails -notcontains $instanceDefaultDataDrivedetails) -and ($instanceTempdbDrivedetails -notcontains $instanceDefaultLogDrivedetails)) {
    $tempdbDrive = 'separate-drive'
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

    ${slqcmdExecutionTemplate}

    

    $DriftAssessmentData = @{}
    $DriftAssessmentData['errors'] = @{}
    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $MappedVolumeNames = '${JSON.stringify(instanceRecord.mappedVolumeNames)}' | ConvertFrom-Json
    $MappedVolumeUuids = '${JSON.stringify(instanceRecord.mappedVolumesUuids)}' | ConvertFrom-Json
    $MappedLunNames = '${JSON.stringify(instanceRecord.mappedLunNames)}' | ConvertFrom-Json
  
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }

    ${ontapRestRequest}

    $DriftAssessmentData['filesystemId'] = $FSxID


    $APIEndpoint = '/storage/volumes'
    $APIQueryFilter = "uuid=${instanceRecord.mappedVolumesUuids?.join('|')}"
    $ApiQueryFields = "fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"
    
    
    # Volume details
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
                'thin-provision' = $perVolumeData.guarantee.honored
                'space-guarantee' = $perVolumeData.guarantee.type
                'autosize-mode' = $perVolumeData.autosize.mode
                'fractional-reserve' = $perVolumeData.space.fractional_reserve
                'snapshot-copy-reserve' = $perVolumeData.space.snapshot.reserve_percent
                'snapshot-autodelete' = $perVolumeData.space.snapshot.autodelete.enabled
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
    } catch {$DriftAssessmentData['errors']['volumes'] = $_.Exception.Message}
    
    # Volume footprint details
    $SvmNamesWithDelimiter = $SvmNames -join '|'
    $APIEndpoint = '/private/cli/volume/show-footprint'
    $APIQueryFilter = "vserver=$SvmNamesWithDelimiter,volume=${instanceRecord.mappedVolumeNames?.join('|')}"
    $ApiQueryFields = "fields=volume-blocks-footprint-bin0-percent"

    try{
        if([string]::IsNullOrEmpty($MappedVolumeNames)) {
            throw "Unable to fetch ONTAP volumes details as the mapped volume names are either null or empty."
        }
        $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFields $ApiQueryFields
        $Volumes = $Response.records

        $isPerformanceTier100Percent = $true
        # loop through each volume and get data
        $PerformanceTierPercent = $Volumes | Where-Object {$MappedVolumeNames -contains $_.volume} | Select-Object -ExpandProperty volume_blocks_footprint_bin0_percent
        foreach ($perVolumeData in $Volumes) {
        if(($MappedVolumeNames -contains $perVolumeData.volume) -and $perVolumeData.volume_blocks_footprint_bin0_percent -ne 100) {
                $isPerformanceTier100Percent = $false
                break
        }
        }
    } catch {$DriftAssessmentData['errors']['sizing'] = $_.Exception.Message}
    
   
    # Lun details
    $APIEndpoint = '/storage/luns'
    $APIQueryFilter = "name=${instanceRecord.mappedLunNames?.join('|')}"
    $ApiQueryFields = "fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"
    
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
    } catch {$DriftAssessmentData['errors']['luns'] = $_.Exception.Message}
    

    # gather storage layout data
    try{
        ${INSTANCE_DRIVE_DETAILS_TEMPLATE(instanceRecord.name, instanceRecord.sqlAuthEnabled)}

        ${DATABASE_VOLUME_LUN_DETAILS(instanceRecord)}
        
        foreach ($drive in $instanceAllDataDrivesSizes) {
            $logVolumeLunDetails = $responseObject.log | Where-Object { $_.name -eq $drive.databaseName }
            if ($logVolumeLunDetails) {
                $drive | Add-Member -MemberType NoteProperty -Name "ontapVolumeUuid" -Value $logVolumeLunDetails.ontapVolumeUuid 
                $drive | Add-Member -MemberType NoteProperty -Name "ontapVolumeName" -Value $logVolumeLunDetails.ontapVolumeName
                $drive | Add-Member -MemberType NoteProperty -Name "lunUuid" -Value $logVolumeLunDetails.lunUuid
                $drive | Add-Member -MemberType NoteProperty -Name "svmName" -Value $logVolumeLunDetails.svmName
                $drive | Add-Member -MemberType NoteProperty -Name "diskNumber" -Value $logVolumeLunDetails.diskNumber
                $drive | Add-Member -MemberType NoteProperty -Name "diskSerialNumber" -Value $logVolumeLunDetails.lunSerialNumber
                if($logVolumeLunDetails.accessPaths -and $logVolumeLunDetails.accessPaths.Count -gt 0) {
                    $drive | Add-Member -MemberType NoteProperty -Name "logAccessPath" -Value $logVolumeLunDetails.accessPaths[0]
                    }
                }
            $dataVolumeLunDetails = $responseObject.data | Where-Object { $_.name -eq $drive.databaseName }
            if($dataVolumeLunDetails -and $dataVolumeLunDetails.accessPaths -and $dataVolumeLunDetails.accessPaths.Count -gt 0) {
                $drive | Add-Member -MemberType NoteProperty -Name "dataAccessPath" -Value $dataVolumeLunDetails.accessPaths[0]         
                }   
            }
        
        foreach ($drive in $defaultTempDBDriveSize) {
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
        
        $DriftAssessmentData['layout'] = @{
                                        'default-data-files-location' = $defaultDataDrive;
                                        'default-log-files-location' = $defaultLogDrive;
                                        'tempdb-files-location' = $tempdbDrive;
                                        'user-database-layout' = $($responseObject);}
        
        $DriftAssessmentData['sizing'] = @{
                                        'performance-tier' = @($PerformanceTierPercent);
                                        'data-log-drive-details' = @($($instanceAllDataDrivesSizes));
                                        'data-tempdb-drive-details' = $($defaultTempDBDriveSize);
                                        }
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
        
        # Fetch load balancing policy for all NetApp disks
        $AllNetappDisks = Get-Disk | Where-Object { $_.FriendlyName -eq 'NETAPP LUN C-MODE'} | Select-Object -Property Number 
        $MpioLBDetails = mpclaim -s -d
        $LoadBalancingPolicy = 'RR'
        foreach ($disk in $AllNetappDisks){
            $matchString = "Disk\\s+" + $disk.Number + "\\s+RR"
            if(-Not ($MpioLBDetails -Match $matchString) ) {
                $LoadBalancingPolicy = 'Other'
                break
            }
        }
        $DriftAssessmentData['os']['mpio-load-balance-policy'] = "$LoadBalancingPolicy"
        } catch {$DriftAssessmentData['errors']['mpio-policy'] = $_.Exception.Message}

    ${TEST_ISCSI_SESSIONS}
    
    try{
        $SessionCount = Test-IscsiSessions
        $DriftAssessmentData['os']['mpio-iscsi-count'] = "$SessionCount"
        } catch {$DriftAssessmentData['errors']['iscsi-sessions'] = $_.Exception.Message}
    
    try{
        $filteredDataDrives = $instanceAllDataDrivesSizes | ForEach-Object -MemberName dataDriveLetter
        $filteredLogDrives = $instanceAllLogDrivesSizes | ForEach-Object -MemberName logDriveLetter
        $AllDrives = $($filteredDataDrives; $filteredLogDrives)
        $AllDrives = $AllDrives | select -Unique
        $ntfsAllocationUnit = Get-CimInstance -ClassName Win32_Volume | Where {$allDrives -contains $_.Name.Substring(0,2)}  | Select-Object Name, BlockSize 
        $ntfsUnitSize = 65536
        $ntfsAllocationUnit | ForEach-Object -Process {if($_.BlockSize -ne 65536) {$ntfsUnitSize = $_.BlockSize}}
        $DriftAssessmentData['os']['ntfs-allocation-details'] = $($ntfsAllocationUnit)
        $DriftAssessmentData['os']['ntfs-allocation-unit-size'] = $($ntfsUnitSize)
    } catch {$DriftAssessmentData['errors']['ntfs-allocation'] = $_.Exception.Message}

    $response = $DriftAssessmentData | ConvertTo-Json -Depth 5

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
    Write-Information "Optimizing storage for FSx ID: $FSxID FSX region: $FSxRegion"
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
    
    try {
        # Rescan and extend the LUN
        $null = (echo "RESCAN" | diskpart)
        $disk = Get-Disk | Where-Object { $_.SerialNumber -ceq "$DiskSerialNumber" }
            
        if ($null -eq $disk) {
            throw "No disk found with SerialNumber $DiskSerialNumber"
        }
        
        $diskNumber = $disk.Number
        $partition = Get-Partition -DiskNumber $diskNumber | Where-Object Type -eq 'Basic'
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
                    Write-Error "Error occurred while moving cluster group $clusterGroupName: $_.Exception.Message"
                }
                Write-Information "Status of moving cluster group $clusterGroupName: $($groupResult.status)"
                # Add group result to result array
                $result += $groupResult
            }
        }
    } catch {
        # Handle any errors that occur
        Write-Error "Error occurred while moving cluster groups: $_.Exception.Message"
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
    @{currentNode= $currentNode;clusterNodes = $clusterNodes;ownerNode = $ownerNode;} | ConvertTo-Json
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
        vpuCount = $vcpus
        tcpOffloadState = $tcpOffloadState -as [string]
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

const GET_VCPU_AND_MAXDOP_DETAILS = (instanceName: string, sqlAuthEnabled: boolean) => `
    # Get vCPU and MAXDOP Details
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlInstanceName = "${instanceName}"

 
    $ServerInstanceName = "$env:COMPUTERNAME"
    If ($sqlInstanceName -ne "MSSQLSERVER") {
        $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
         
    }

    ${slqcmdExecutionTemplate}
    $sqlCredential = @{'useSqlAuth' = $False}
    if($sqlAuthEnabled) {
        ${readSsmParameter(instanceName)}
    }

    $vcpus = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
    $maxDopResult =  Call-SqlCmd -SqlCredential $sqlCredential -Query "sp_configure 'max degree of parallelism'" -InstanceName "$ServerInstanceName" 

    # Parse the result to extract the run_value
    $maxDop = $maxDopResult | Select-String -Pattern 'max degree of parallelism' | ForEach-Object {
        $_ -match '(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)' | Out-Null
        $matches[4]
    }

    # Combine the results
    $result = [PSCustomObject]@{
        vcpuCount = $vcpus
        maxDOP = $maxDop
    }

    $jsonResult = $result | ConvertTo-Json -Compress
    Write-Output $jsonResult
`;

export {
    STORAGE_CONFIGURATION_ASSESSMENT,
    GET_ONTAP_LUN_DETAILS,
    OPTIMIZE_STORAGE_PARAMS_SCRIPT,
    CHECK_NODE_STATUS,
    RESCAN_EXTEND_LUN,
    MOVE_ALL_CLUSTER_GROUPS,
    GET_CLUSTER_NODE_NAMES,
    GET_RSS_CONFIG_DETAILS,
    GET_VCPU_AND_MAXDOP_DETAILS
};
