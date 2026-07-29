import { BulkOptimizeSnapshotPolicyParamsType } from '../../../routes/types/mssql-continuous-optimisation.types';
import { ontapRestRequest } from './common-templates';
import { COMPUTE_OPTIMIZE_LOG_PATH, RSS_OPTIMIZE_LOG_PATH, RESILIENCY_OPTIMIZE_LOG_PATH } from './const';
import { compressResponse, readSsmParameter, slqcmdExecutionTemplate, GET_FCI_NAME } from './ssm-script-utils';

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

/**
 * @returns the UUID of the ONTAP job created for setting the snapshot policy;
 * Expected response structure:
 * { "errors": { }, "response": [ { "uuid": "18873848-d09c-11ef-a0ec-61a27a6bebc8" }]}
 */
const SET_VOLUME_SNAPSHOT_POLICY = (params: BulkOptimizeSnapshotPolicyParamsType) => `
    # Set snapshot policy for volumes
    Start-Transcript -Path ${RESILIENCY_OPTIMIZE_LOG_PATH} -Append | Out-Null
    # Add JSON_CHECK function for validation
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

export {
    MOVE_ALL_CLUSTER_GROUPS,
    OPTIMIZE_NETWORK_ADAPTERS,
    CHECK_RUNNING_STATUS_WITH_RESTART,
    SET_VOLUME_SNAPSHOT_POLICY,
    SET_MAXDOP
};
