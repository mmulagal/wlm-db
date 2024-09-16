import { ontapRestRequest } from './common-templates';
import { PERFORMANCE_METRICS_WITH_LATENCY } from './queries';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

const PERFORMANCE_ASSESSMENT = (instance: string, sqlAuthEnabled: boolean) =>
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
    
    $queryResponse =  Call-SqlCmd -SqlCredential $sqlCredential -Query "${PERFORMANCE_METRICS_WITH_LATENCY}" -InstanceName "$instanceServiceName"

    ${compressResponse}
    return (Deflate-String $queryResponse)
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

const STORAGE_CONFIGURATION_ASSESSMENT = (
    instance: string,
    region: string,
    sqlAuthEnabled: boolean,
    filesystem: string,
    volumeUuids: string[],
    lunNames: string[]
) =>
    `
    $DriftAssessmentData = @{}
    $sqlInstance = "${instance}"
    $FSxID = "${filesystem}"
    $FSxRegion = "${region}"
  
    $sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }

    $APIEndpoint = '/storage/volumes'
    $APIQueryFilter = "uuid=${volumeUuids.join('|')}"
    $ApiQueryFields = "fields=autosize,space,snapshot_policy,tiering,guarantee"
    
    ${ontapRestRequest(true)}
    
    # Volume details
    $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
    $Volumes = $Response.records

    $VolumeList = @()
    # loop through each volume and get data
    foreach ($perVolumeData in $Volumes) {
        # Using PSCustomObject
        $perVolRow = [PSCustomObject]@{
            name = $perVolumeData.name
            thin_provision = $perVolumeData.guarantee.honored
            space_guarantee = $perVolumeData.guarantee.type
            autosize = ($($perVolumeData.autosize) | ConvertTo-Json)
            autosize_mode = $perVolumeData.autosize.mode
            fractional_reserve = $perVolumeData.space.fractional_reserve
            snapshot_policy = $perVolumeData.snapshot_policy.name
            snapshot_reserve_percent = $perVolumeData.space.snapshot.reserve_percent
            snapshot_autodelete = $perVolumeData.space.snapshot.autodelete.enabled
            tiering_policy = $perVolumeData.tiering.policy
            tiering_min_cooling_days = $perVolumeData.tiering.min_cooling_days
            #space_mgmt_try_first = ''
            #read_realloc = ''
        }
        $VolumeList += $($perVolRow)
    }
    
    # Lun details
    $APIEndpoint = '/storage/luns'
    $APIQueryFilter = "name=${lunNames.join('|')}"
    $ApiQueryFields = "fields=space,os_type"
    
    $Response = Invoke-ONTAPRequest -ApiEndpoint $APIEndpoint -ApiQueryFilter $APIQueryFilter -ApiQueryFields $ApiQueryFields
    $Luns = $Response.records
   
    $LunsList = @()

    # loop through luns and get per lun data
    foreach ($perLunData in $Luns) {
        # Using PSCustomObject
        $perLunRow = [PSCustomObject]@{
            name = $($perLunData.name)
            os_type = $($perLunData.os_type)
            space_reservation_enabled = $($perLunData.space.guarantee.requested)
            space_allocation_allocated = $($perLunData.space.scsi_thin_provisioning_support_enabled)
        }
        $LunsList += $($perLunRow)
    }

    $MpioResponse = Get-MSDSMSupportedHW -VendorId MSFT2005 -ProductId iSCSIBusType_0x9 | Select ProductId,VendorId 
    $MpioStatus = $False
    if(($MpioResponse.VendorId -eq "MSFT2005") -and ($MpioResponse.ProductId -eq "iSCSIBusType_0x9")) {
        $MpioStatus = $True
    }
    $LoadBalancingPolicy = Get-MSDSMGlobalDefaultLoadBalancePolicy

    ${TEST_ISCSI_SESSIONS}
    $SessionCount = Test-IscsiSessions

    $DriftAssessmentData['volumes'] = $($VolumeList)
    $DriftAssessmentData['luns'] = $($LunsList)
    $DriftAssessmentData['os'] = @{
                                    mpioStatus = "$MpioStatus";
                                    loadBalancingPolicy = "$LoadBalancingPolicy";
                                    sessions = "$SessionCount";
}

    $response = $DriftAssessmentData | ConvertTo-Json -Depth 5

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
`;

export { STORAGE_CONFIGURATION_ASSESSMENT, PERFORMANCE_ASSESSMENT };
