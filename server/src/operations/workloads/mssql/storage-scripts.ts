import { WorkloadInstance, OntapRequestParams } from '../../../utils/common-types';
import { DATABASE_VOLUME_LUN_RAW_DETAILS, INSTANCE_DRIVE_DETAILS_TEMPLATE } from './assessment-scripts';
import { ontapRestRequest } from './common-templates';
import { SIZING_OPERATIONS_LOG_PATH, STORAGE_ASSESSMENT_LOG_PATH } from './const';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

interface DirectOntapAssessmentData {
    volumesJson: string;
    performanceTierJson: string;
    lunsJson: string;
    errors: {
        volumes?: string;
        sizing?: string;
        luns?: string;
        spaceMgmtTryFirst?: string;
    };
}

// PowerShell single-quoted strings only treat '' as an escape for a literal quote.
function escapeForPowerShellSingleQuotedString(value: string): string {
    return value.replace(/'/g, match => match + match);
}

const VOLUMES_JSON_PLACEHOLDER = '__WLMDB_VOLUMES_JSON_PLACEHOLDER__';
const PERFORMANCE_TIER_JSON_PLACEHOLDER = '__WLMDB_PERFORMANCE_TIER_JSON_PLACEHOLDER__';
const LUNS_JSON_PLACEHOLDER = '__WLMDB_LUNS_JSON_PLACEHOLDER__';

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

const STORAGE_CONFIGURATION_ASSESSMENT = (
    instanceRecord: WorkloadInstance,
    ontapAssessmentData: DirectOntapAssessmentData
) =>
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

    $sqlAuthEnabled = [System.Convert]::ToBoolean('${instanceRecord.sqlAuthEnabled}')
    $sqlCredential = @{'useSqlAuth' = $False}

    Write-Information "Getting storage configuration assessment for FSxID: $FSxID, FSxRegion: $FSxRegion, SqlInstance: $sqlInstance"

    # Build sql instance service name
    $instanceServiceName = "$env:COMPUTERNAME"
    if ($sqlInstance -ne 'MSSQLSERVER') {
        $instanceServiceName = "$env:COMPUTERNAME\\$sqlInstance"
    }
    Write-Information "SQL Service Instance Name: $instanceServiceName"

    $DriftAssessmentData['filesystemId'] = $FSxID

    # Volume, volume-footprint and lun-by-name details are fetched server-side ahead of time. Placeholder
    # tokens are spliced in below (and swapped for the real JSON after ConvertTo-Json further down) instead
    # of parsing the JSON here, since round-tripping it through ConvertFrom-Json/ConvertTo-Json on the host
    # has been observed to re-wrap the array in a Count/value envelope. No ONTAP REST calls are made
    # from the script.
    $VolumesFetchError = '${escapeForPowerShellSingleQuotedString(ontapAssessmentData.errors.volumes ?? '')}'
    if (-not [string]::IsNullOrEmpty($VolumesFetchError)) {
        $DriftAssessmentData['errors']['volumes'] = $VolumesFetchError
    } else {
        $DriftAssessmentData['volumes'] = @('${VOLUMES_JSON_PLACEHOLDER}')
    }

    $FootprintFetchError = '${escapeForPowerShellSingleQuotedString(ontapAssessmentData.errors.sizing ?? '')}'
    if (-not [string]::IsNullOrEmpty($FootprintFetchError)) {
        $DriftAssessmentData['errors']['sizing'] = $FootprintFetchError
        $PerformanceTierDetails = @()
    } else {
        $PerformanceTierDetails = @('${PERFORMANCE_TIER_JSON_PLACEHOLDER}')
    }

    $LunsFetchError = '${escapeForPowerShellSingleQuotedString(ontapAssessmentData.errors.luns ?? '')}'
    if (-not [string]::IsNullOrEmpty($LunsFetchError)) {
        $DriftAssessmentData['errors']['luns'] = $LunsFetchError
    } else {
        $DriftAssessmentData['luns'] = @('${LUNS_JSON_PLACEHOLDER}')
    }

    # space-mgmt-try-first is fetched server-side via the private CLI endpoint and merged into
    # each volume's row (see fetchDirectOntapAssessmentData) - only the fetch error is surfaced here.
    $SpaceMgmtTryFirstFetchError = '${escapeForPowerShellSingleQuotedString(
        ontapAssessmentData.errors.spaceMgmtTryFirst ?? ''
    )}'
    if (-not [string]::IsNullOrEmpty($SpaceMgmtTryFirstFetchError)) {
        $DriftAssessmentData['errors']['spaceMgmtTryFirst'] = $SpaceMgmtTryFirstFetchError
    }

    # gather storage layout data
    Write-Information "Gathering storage layout data"
    $DriftAssessmentData['layout'] = @{}
    $DriftAssessmentData['sizing'] = @{}
    try{
        ${INSTANCE_DRIVE_DETAILS_TEMPLATE(instanceRecord.name, instanceRecord.sqlAuthEnabled)}

        ${DATABASE_VOLUME_LUN_RAW_DETAILS(instanceRecord)}

        # Disk serial numbers are only known now (discovered locally via WMI above); the lun-by-serial
        # ONTAP lookup and layout/sizing consolidation that depends on it happen server-side afterwards.
        $DriftAssessmentData['rawDriveDetails'] = $responseObject

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

        if(-not ([string]::IsNullOrEmpty($driveDetailsErrors["instanceTempDBDriveError"] ))) {
            $DriftAssessmentData['errors']['data-tempdb-drive-details'] = $driveDetailsErrors["instanceTempDBDriveError"]
        }
        else {
            $DriftAssessmentData['sizing']['data-tempdb-drive-details'] = $($defaultTempDBDriveDetails);
        }

        $DriftAssessmentData['sizing']['performance-tier'] =  @($PerformanceTierDetails);
        $DriftAssessmentData['sizing']['data-log-drive-details'] = @($($allDriveDetails));

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
        $filteredDataDrives = $instanceAllDataDrivesSizes | Where-Object { $netappDataDrives -contains $_.dataDriveLetter } | ForEach-Object -MemberName dataDriveLetter
        $filteredLogDrives =  $instanceAllLogDrivesSizes | Where-Object { $netappLogDrives -contains $_.logDriveLetter } | ForEach-Object -MemberName logDriveLetter
        $filteredTempDbDrives =  $defaultTempDBDriveDetails | Where-Object { $netappDataDrives -contains $_.tempdbDriveLetter } | ForEach-Object -MemberName tempdbDriveLetter
        $AllDrives = $($filteredDataDrives; $filteredLogDrives;  $filteredTempDbDrives)
        $AllDrives = $AllDrives | select -Unique
        $ntfsAllocationUnit = Get-CimInstance -ClassName Win32_Volume | Where {$AllDrives -contains $_.DriveLetter}  | Select-Object DriveLetter, BlockSize 
        $ntfsUnitSize = 65536
        $ntfsAllocationUnit | ForEach-Object -Process {if($_.BlockSize -ne 65536) {$ntfsUnitSize = $_.BlockSize}}
        $DriftAssessmentData['os']['ntfs-allocation-details'] = $($ntfsAllocationUnit)
        $DriftAssessmentData['os']['ntfs-allocation-unit-size'] = $($ntfsUnitSize)
    } catch {$DriftAssessmentData['errors']['ntfs-allocation'] = $_.Exception.Message}

    $response = $DriftAssessmentData | ConvertTo-Json -Depth 8 -Compress
    $response = $response.Replace('["${VOLUMES_JSON_PLACEHOLDER}"]', '${escapeForPowerShellSingleQuotedString(
        ontapAssessmentData.volumesJson
    )}')
    $response = $response.Replace('["${PERFORMANCE_TIER_JSON_PLACEHOLDER}"]', '${escapeForPowerShellSingleQuotedString(
        ontapAssessmentData.performanceTierJson
    )}')
    $response = $response.Replace('["${LUNS_JSON_PLACEHOLDER}"]', '${escapeForPowerShellSingleQuotedString(
        ontapAssessmentData.lunsJson
    )}')

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    ${compressResponse}
    return (Deflate-String $response)
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

export {
    FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS,
    GET_ONTAP_LUN_DETAILS,
    DATABASE_VOLUME_LUN_DETAILS,
    TEST_ISCSI_SESSIONS,
    STORAGE_CONFIGURATION_ASSESSMENT,
    RESCAN_EXTEND_LUN,
    DirectOntapAssessmentData
};
