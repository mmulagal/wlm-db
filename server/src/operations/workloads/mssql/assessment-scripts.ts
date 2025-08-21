import { ontapRestRequest } from './common-templates';
import { DISCOVER_OPERATION_LOG_PATH, RESILIENCY_OPTIMIZE_LOG_PATH } from './const';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';
import {
    INSTANCE_DATA_DRIVES_QUERY,
    INSTANCE_LOG_DB_DRIVE_SIZES,
    INSTANCE_LOG_DRIVES_QUERY,
    INSTANCE_USER_DB_DRIVE_SIZES,
    SERVER_VERSION,
    TEMPDB_DRIVE_SIZE
} from './queries';

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

const GET_RUNNING_SQL_SERVERS = () => `
    # Get running SQL Server instances
    $sqlServices = Get-Service | Where-Object { $_.DisplayName -like "*SQL Server (*)" -and $_.Status -eq 'Running' } | Select-Object -ExpandProperty DisplayName
    $jsonArray = @($sqlServices) | ConvertTo-Json
    Write-Output $jsonArray
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
    JSON_CHECK,
    INSTANCE_NETAPP_DRIVES,
    INSTANCE_DRIVE_DETAILS_TEMPLATE,
    CHECK_NODE_STATUS,
    GET_CLUSTER_NODE_NAMES,
    GET_RSS_CONFIG_DETAILS,
    GET_RUNNING_SQL_SERVERS,
    GET_VCPU_AND_MAXDOP_DETAILS,
    GET_INSTALLED_SQL_PATCHES,
    GET_INSTALLED_MSSQL_VERSION,
    GET_CLUSTER_SNAPSHOT_POLICIES,
    GET_SNAPSHOT_DETAILS,
    GET_SANDBOX_DETAILS
};
