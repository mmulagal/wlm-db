import { OptimizeStorageParams, WorkloadInstance } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
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

const USER_DATABASE_LAYOUT = (instanceRecord: WorkloadInstance) => `
    $WarningPreference = 'SilentlyContinue';
    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $PSToolkitRequiredVersion = '9.15.1.2407'

    $responseObject = @{}
    $responseObject['data'] = @()
    $responseObject['log'] = @()

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }
    
    try {
        $sqlquery = @"
            SET NOCOUNT ON;
            SELECT DISTINCT db.name, vs.volume_id as volumeid, mf.physical_name as filename, mf.type, mf.file_id as fileid, mf.size * 8 / 1024.0 as sizeInMb FROM sys.master_files AS mf
            join sys.databases db
            on db.database_id = mf.database_id
            CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.[file_id]) AS vs
            where db.database_id > 4
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

            $winvolumes = $sqlresponse | ConvertFrom-Json 
            foreach ($winvolume in $winvolumes) {

                # check in winvolume volume id is null or empty string

                if (-Not ([string]::IsNullOrEmpty($winvolume.volumeid))) {
                    
                    $vol = get-volume -Path $winvolume.volumeid | Get-Partition | get-disk | Select serialnumber, bustype

                    if ($vol.bustype -ne 'iscsi') {
                        throw "Protocol Error: The database should be using iscsi protocol"
                    }

                    $object = @{
                        "name" = $winvolume.name
                        "fileName" = $winvolume.filename
                        "lunSerialNumber" = $vol.serialnumber
                        "fileId" = $winvolume.fileid
                        "fileType" = $winvolume.type
                        "sizeInMb" = $winvolume.sizeInMb
                    }
                    $type = 'data'
                    if ($winvolume.type -ne 0) {
                        $type = 'log'
                    }
                    $responseObject[$type] += $object
                    }
                }

            return $responseObject
        }
    
        ${ontapRestRequest}

        Function Get-LunFromSerialNumber($responseObject) {
            Write-Information "$logPrefix Get ONTAP lun name from serial numbers for: $responseObject"
    
            $QueryFilter = ''
            foreach ($vol in $responseObject.data) {
                $QueryFilter += $vol.lunSerialNumber + '|'
            }

            foreach ($vol in $responseObject.log) {
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
                            $dataVol.Add("volumeName", $lunrecord.location.volume.name)
                            $dataVol.Add("volumeUuid", $lunrecord.location.volume.uuid)
                            $dataVol.Add("svm", $lunrecord.svm.name)
                        }
                    }

                    foreach ($logVol in $responseObject.log) {
                        if ($logVol.lunSerialNumber -ceq $lunrecord.serial_number) {
                            $logVol.Add("lunPath", $lunrecord.name)
                            $logVol.Add("volumeName", $lunrecord.location.volume.name)
                            $logVol.Add("volumeUuid", $lunrecord.location.volume.uuid)
                            $logVol.Add("svm", $lunrecord.svm.name)
                        }
                    }
                }
            } else {
                
            }
            return $responseObject
        }
    
        Function Get-VolumeIdFromName($responseObject) {
            
            $QueryFilter = ''

            ($responseObject.data + $responseObject.log) | ForEach-Object {
                $QueryFilter += $_.volumeName + '|'
            }

            $QueryFilter = $QueryFilter.TrimEnd('|')
    
            $Params = @{
                "ApiEndPoint" = "/storage/volumes"
            }
    
            if ($QueryFilter -ne '') {
                $QueryFilter = [System.Web.HttpUtility]::UrlEncode($QueryFilter)
                $Params += @{"ApiQueryFilter" = "name=$QueryFilter"}
            }
    
            $params += @{"ApiQueryFields" = "fields=clone.*"}
    
            $Response = Invoke-ONTAPRequest @Params
    
            $volumeRecords = $Response.records
    
            if ($volumeRecords.count -gt 0) {
                $volumeRecords | ForEach-Object {
                    $volrecord = $_
                    if ($volrecord.clone.is_flexclone -eq $true) {
                        ($responseObject.data + $responseObject.log) | ForEach-Object {
                            if ($_.volumeName -eq $volrecord.name) {
                                $_.Add('parentSvm', $volrecord.clone.parent_svm.name)
                                $_.Add('parentVolume', $volrecord.clone.parent_volume.name)
                                $_.Add('parentVolumeUuid', $volrecord.clone.parent_volume.uuid)
                                $_.Add('parentSnapshot', $volrecord.clone.parent_snapshot.name)
                                $_.Add('splitEstimate', $volrecord.clone.split_estimate)
                            }
                        }
                    }
                }
            }
            return $responseObject
        }

        $sqlCredential = @{'useSqlAuth' = $False}
        if($sqlAuthEnabled) {
            ${readSsmParameter(instanceRecord.name)}
        }

        ${slqcmdExecutionTemplate}

        $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "$sqlquery" -InstanceName "$instanceServiceName" 
        if([string]::IsNullOrEmpty($queryResponse)) {
            throw "No user databases found."
        }
        $responseObject = Get-SerialNumberOfWinVolumes $queryResponse
        $responseObject = Get-LunFromSerialNumber $responseObject
        $responseObject = Get-VolumeIdFromName $responseObject
       
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

    ${slqcmdExecutionTemplate}
    
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
                $dataDrive | Add-Member -MemberType NoteProperty -Name "logDriveTotalSizeMB" -Value $logDrive.logDriveTotalSizeMB
                }
            } 
        }
    
    $instanceTempdbDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_TEMPDB_DRIVES_QUERY}" -InstanceName "$instanceServiceName"
    $defaultDataDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${DEFAULT_DATA_DRIVE_SIZE}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    $defaultTempDBDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${TEMPDB_DRIVE_SIZE}" -InstanceName "$instanceServiceName"  | ConvertFrom-Json
    foreach ($drive in $defaultTempDBDriveSize) {
        $drive | Add-Member -MemberType NoteProperty -Name "defaultDataDriveLetter" -Value $defaultDataDriveSize.dataDriveLetter 
        $drive | Add-Member -MemberType NoteProperty -Name "defaultDataDriveSize" -Value $defaultDataDriveSize.dataDriveTotalSizeMB
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
        if ($session.IsConnected) {
            $detailsByTargetAndInitiator[$key].ActiveSessions += 1
            $targetPortalAddress = (Get-IscsiTargetPortal -iSCSISession $session).TargetPortalAddress
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
    `
    $DriftAssessmentData = @{}
    $sqlInstance = "${instanceRecord.name}"
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $MappedVolumeNames = '${JSON.stringify(instanceRecord.mappedVolumeNames)}' | ConvertFrom-Json
  
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }

    $DriftAssessmentData['filesystemId'] = $FSxID

    $APIEndpoint = '/storage/volumes'
    $APIQueryFilter = "uuid=${instanceRecord.mappedVolumesUuids?.join('|')}"
    $ApiQueryFields = "fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"
    
    ${ontapRestRequest}
    
    # Volume details
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

    # Volume footprint details
    $SvmNamesWithDelimiter = $SvmNames -join '|'
    $APIEndpoint = '/private/cli/volume/show-footprint'
    $APIQueryFilter = "vserver=$SvmNamesWithDelimiter,volume=${instanceRecord.mappedVolumeNames?.join('|')}"
    $ApiQueryFields = "fields=volume-blocks-footprint-bin0-percent"
    
    $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFields $ApiQueryFields
    $Volumes = $Response.records

    $isPerformanceTier100Percent = $true
    # loop through each volume and get data
    foreach ($perVolumeData in $Volumes) {
       if(($MappedVolumeNames -contains $perVolumeData.volume) -and $perVolumeData.volume_blocks_footprint_bin0_percent -ne 100) {
            $isPerformanceTier100Percent = $false
            break
       }
    }
    $DriftAssessmentData['volumes'] = @($($VolumeList))

    # Lun details
    $APIEndpoint = '/storage/luns'
    $APIQueryFilter = "name=${instanceRecord.mappedLunNames?.join('|')}"
    $ApiQueryFields = "fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"
    
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

    # gather storage layout data
    ${INSTANCE_DRIVE_DETAILS_TEMPLATE(instanceRecord.name, instanceRecord.sqlAuthEnabled)}
    
    # gather user database layout data
    ${USER_DATABASE_LAYOUT(instanceRecord)}

    # gather OS configuration data 
    $MpioResponse = Get-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9 | Select ProductId,VendorId 
    $MpioStatus = $false
    if(($MpioResponse.VendorId -eq "MSFT2005") -and ($MpioResponse.ProductId -eq "iSCSIBusType_0x9")) {
        $MpioStatus = $true
    }
    $LoadBalancingPolicy = Get-MSDSMGlobalDefaultLoadBalancePolicy

    ${TEST_ISCSI_SESSIONS}

    $SessionCount = Test-IscsiSessions
    $AllDrives = $($filteredDataDrives; $filteredLogDrives)
    $AllDrives = $AllDrives | select -Unique
    $ntfsAllocationUnit = Get-CimInstance -ClassName Win32_Volume | Where {$allDrives -contains $_.Name.Substring(0,2)}  | Select-Object Name, BlockSize 
    $ntfsUnitSize = 65536
    $ntfsAllocationUnit | ForEach-Object -Process {if($_.BlockSize -ne 65536) {$ntfsUnitSize = $_.BlockSize}}
    $DriftAssessmentData['os'] = @{
                                    'mpio-enabled' = $MpioStatus;
                                    'mpio-load-balance-policy' = "$LoadBalancingPolicy";
                                    'mpio-iscsi-count' = "$SessionCount";
                                    'ntfs-allocation-details' = $($ntfsAllocationUnit);
                                    'ntfs-allocation-unit-size' = $($ntfsUnitSize);
    }
    
    $DriftAssessmentData['layout'] = @{
                                        'default-data-files-location' = $defaultDataDrive;
                                        'default-log-files-location' = $defaultLogDrive;
                                        'tempdb-files-location' = $tempdbDrive;
                                        'user-database-layout' = $($responseObject);
    }
    
    $DriftAssessmentData['sizing'] = @{
                                        'performance-tier' = $isPerformanceTier100Percent;
                                        'data-log-drive-details' = @($($instanceAllDataDrivesSizes));
                                        'data-tempdb-drive-details' = $($defaultTempDBDriveSize);
    }
   
    $response = $DriftAssessmentData | ConvertTo-Json -Depth 5

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
`;

const OPTIMIZE_STORAGE_PARAMS_SCRIPT = (params: OptimizeStorageParams) => `
    #Storage Optimization Script
    $WarningPreference = 'SilentlyContinue';
    $FSxID = '${params.fsxId}'
    $FSxRegion = '${params.region}'
    $apiEndpoint = '${params.apiEndpoint}'
    $apiQueryFilter = '${params.apiQueryFilter}'
    $apiBody = '${params.apiBody}'

    ${ontapRestRequest}

    $newBody = $apiBody | ConvertFrom-Json

    $body =   $newBody | ConvertTo-Json

    $ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $apiQueryFilter -body $body -method "PATCH"

    $ontapResponse | ConvertTo-Json
    
`;

export { STORAGE_CONFIGURATION_ASSESSMENT, OPTIMIZE_STORAGE_PARAMS_SCRIPT, USER_DATABASE_LAYOUT };
