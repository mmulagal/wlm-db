import { WorkloadInstance } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
import {
    DEFAULT_DATA_DRIVE_SIZE,
    DEFAULT_LOG_DRIVE_SIZE,
    INSTANCE_DATA_DRIVES_QUERY,
    INSTANCE_LOG_DRIVES_QUERY,
    INSTANCE_TEMPDB_DRIVES_QUERY,
    TEMPDB_DRIVE_SIZE
} from './queries';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

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
    
    $instanceDataDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_DATA_DRIVES_QUERY}" -InstanceName "$instanceServiceName"
    $defaultDataDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${DEFAULT_DATA_DRIVE_SIZE}" -InstanceName "$instanceServiceName"
   
    $instanceLogDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_LOG_DRIVES_QUERY}" -InstanceName "$instanceServiceName"
    $defaultLogDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${DEFAULT_LOG_DRIVE_SIZE}" -InstanceName "$instanceServiceName"
    $defaultLogDriveSizePercent = ($defaultLogDriveSize/$defaultDataDriveSize) * 100
    $defaultLogDriveSizeDetails = @{'size' = "$defaultLogDriveSize"; 'percent' = "$defaultLogDriveSizePercent"}

    $instanceTempdbDrivedetails =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${INSTANCE_TEMPDB_DRIVES_QUERY}" -InstanceName "$instanceServiceName"
    $tempDBDriveSize = Call-SqlCmd -SqlCredential $sqlCredential -Query "${TEMPDB_DRIVE_SIZE}" -InstanceName "$instanceServiceName"
    $tempDBDriveSizePercent = ($tempDBDriveSize/$defaultDataDriveSize) * 100
    $tempDBDriveSizeDetails = @{'size' = "$tempDBDriveSize"; 'percent' = "$tempDBDriveSizePercent"}

    if(($instanceDataDrivedetails -ne $instanceLogDrivedetails) -and ($instanceDataDrivedetails -ne $instanceTempdbDrivedetails)) {
    $defaultDataDrive = 'separate-drive'
    }

    if(($instanceDataDrivedetails -ne $instanceLogDrivedetails) -and ($instanceLogDrivedetails -ne $instanceTempdbDrivedetails)) {
    $defaultLogDrive = 'separate-drive'
    }

    if(($instanceDataDrivedetails -ne $instanceTempdbDrivedetails) -and ($instanceLogDrivedetails -ne $instanceTempdbDrivedetails)) {
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
    $ApiQueryFields = "fields=autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"
    
    ${ontapRestRequest}
    
    # Volume details
    $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
    $Volumes = $Response.records

    $VolumeList = @()
    # loop through each volume and get data
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
    }
    $DriftAssessmentData['volumes'] = @($($VolumeList))

    # Volume footprint details
    $APIEndpoint = '/private/cli/volume/show-footprint'
    $APIQueryFilter = "volume=${instanceRecord.mappedVolumeNames?.join('|')}"
    $ApiQueryFields = "fields=volume-blocks-footprint-bin0-percent"
    
    $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFields $ApiQueryFields
    $Volumes = $Response.records

    $isPerformanceTier100Percent = $true
    # loop through each volume and get data
    foreach ($perVolumeData in $Volumes) {
       if($perVolumeData.volume_blocks_footprint_bin0_percent -ne 100) {
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
    
    # gather OS configuration data 
    $MpioResponse = Get-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9 | Select ProductId,VendorId 
    $MpioStatus = $false
    if(($MpioResponse.VendorId -eq "MSFT2005") -and ($MpioResponse.ProductId -eq "iSCSIBusType_0x9")) {
        $MpioStatus = $true
    }
    $LoadBalancingPolicy = Get-MSDSMGlobalDefaultLoadBalancePolicy

    ${TEST_ISCSI_SESSIONS}
    $SessionCount = Test-IscsiSessions
    $ntfsAllocationUnit = Get-Volume | Where { $_.DriveLetter -in @('S','L','T') }  | select-Object DriveLetter, AllocationUnitSize  
    $DriftAssessmentData['os'] = @{
                                    'mpio-enabled' = $MpioStatus;
                                    'mpio-load-balance-policy' = "$LoadBalancingPolicy";
                                    'mpio-iscsi-count' = "$SessionCount";
                                    'ntfs-allocation-unit' = $($ntfsAllocationUnit)
    }

    # gather storage layout data
    ${INSTANCE_DRIVE_DETAILS_TEMPLATE(instanceRecord.name, instanceRecord.sqlAuthEnabled)}
    
    $DriftAssessmentData['layout'] = @{
                                        'default-data-files-location' = $defaultDataDrive;
                                        'default-log-files-location' = $defaultLogDrive;
                                        'tempdb-files-location' = $tempdbDrive
    }
    
    $DriftAssessmentData['sizing'] = @{
                                        'performance-tier' = $isPerformanceTier100Percent
                                        'log-drive-size' = $defaultLogDriveSizePercent;
                                        'tempdb-drive-size' = $tempDBDriveSizePercent;
    }
   
   
    $response = $DriftAssessmentData | ConvertTo-Json -Depth 5

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
`;

export { STORAGE_CONFIGURATION_ASSESSMENT };
