import { MSSQL_HEARTBEAT_SETTINGS } from '../../continuous-optimization/mssql/golden-config';
import { HIGH_AVAILABILITY_LOG_PATH } from './const';
import { readSsmParameter, slqcmdExecutionTemplate } from './ssm-script-utils';

interface LunIgroupMapping {
    lunUuid: string;
    lunName: string;
    igroupUuid: string;
    igroupName: string;
    initiatorNames: string[];
}

const DRIVE_LETTER = `
# Get available drive letters
$used = (Get-PSDrive -PSProvider 'FileSystem').Name
$all = 65..90 | ForEach-Object { [char]$_ }
$available = $all | Where-Object { $_ -notin $used }
$available | ConvertTo-Json
`;

const HEARTBEAT_SETTINGS = `
$cluster = Get-Cluster
$settings = @{
        "CrossSiteDelay" = $cluster.CrossSiteDelay
        "SameSubnetDelay" = $cluster.SameSubnetDelay
        "CrossSubnetDelay" = $cluster.CrossSubnetDelay
        "CrossSiteThreshold" = $cluster.CrossSiteThreshold
        "SameSubnetThreshold" = $cluster.SameSubnetThreshold
        "CrossSubnetThreshold" = $cluster.CrossSubnetThreshold
}
$settings | ConvertTo-Json | Write-Output
`;

const CLUSTER_QUORUM_TYPE = `
# Get quorum information
$quorumInfo = Get-ClusterQuorum
$quorumResourceName = [string]$quorumInfo.QuorumResource
$quorumType = $quorumInfo.QuorumType
$windowsClusterName = (Get-Cluster -ErrorAction SilentlyContinue).Name

$quorumResource = Get-ClusterResource |
    Where-Object { $_.Name -eq $quorumResourceName }
$isPhysicalDisk = $quorumResource.ResourceType -eq "Physical Disk"
$isFileShareWitness = $quorumResource.ResourceType -eq "File Share Witness"
$isMajority = $quorumType -eq "Majority"
$isPhysicalDiskAndMajority = $isPhysicalDisk -and $isMajority
$isSupportedWitnessAndMajority = ($isPhysicalDisk -or $isFileShareWitness) -and $isMajority

# Prepare result object
$result = [PSCustomObject]@{
                QuorumResourceName = $quorumResourceName
                QuorumType = $quorumType
                IsPhysicalDisk = $isPhysicalDisk
                IsFileShareWitness = $isFileShareWitness
                IsMajority = $isMajority
                IsPhysicalDiskAndMajority = $isPhysicalDiskAndMajority
                IsSupportedWitnessAndMajority = $isSupportedWitnessAndMajority
                WindowsClusterName = $windowsClusterName
}
$result | ConvertTo-Json -Compress
`;

const SQL_SERVER_SERVICES = (instanceName: string) => `
# Get SQL Server services
$instanceName = '${instanceName}'
$serviceName = if ($instanceName -and $instanceName.ToUpper() -ne "MSSQLSERVER") { "MSSQL\`$$instanceName" } else { "MSSQLSERVER" }

Get-Service -Name $serviceName -ErrorAction SilentlyContinue |
        Select-Object Name,
                                  @{Name="Status";Expression={ $_.Status.ToString() }},
                                  DisplayName,
                                  @{Name="StartType";Expression={ $_.StartType.ToString() }} |
        ConvertTo-Json | Write-Output
`;

const GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN = (lunMappings: LunIgroupMapping[]) => `
# Get LUN, igroup, initiator names and host IQN Script
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue'
Remove-TypeData -ErrorAction SilentlyContinue System.Array
# Pre-fetched server-side via proxy-forwarder (identical for every node, so wrap in @() to
# guard against ConvertFrom-Json collapsing a single-element JSON array to a scalar object).
$lunMappings = @('${JSON.stringify(lunMappings)}' | ConvertFrom-Json)

$hostIqns = (Get-InitiatorPort | Select-Object -ExpandProperty NodeAddress) -join ', '
$response = [PSCustomObject]@{
        hostIqns = $hostIqns
        lunMappings = $lunMappings
}

$response | ConvertTo-Json -Depth 5 -Compress
Stop-Transcript | Out-Null
`;

const REMEDIATE_HEARTBEAT_SETTINGS = `
# Set recommended heartbeat settings
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
Write-Output "Starting heartbeat settings remediation" | Out-Null
$status = "success"
$errorMessage = ""
$expectedSettings = @{
    SameSubnetDelay = ${MSSQL_HEARTBEAT_SETTINGS.SameSubnetDelay}
    SameSubnetThreshold = ${MSSQL_HEARTBEAT_SETTINGS.SameSubnetThreshold}
    CrossSubnetDelay = ${MSSQL_HEARTBEAT_SETTINGS.CrossSubnetDelay}
    CrossSubnetThreshold = ${MSSQL_HEARTBEAT_SETTINGS.CrossSubnetThreshold}
    CrossSiteDelay = ${MSSQL_HEARTBEAT_SETTINGS.CrossSiteDelay}
    CrossSiteThreshold = ${MSSQL_HEARTBEAT_SETTINGS.CrossSiteThreshold}
}

Write-Output "Expected heartbeat settings: $($expectedSettings | ConvertTo-Json -Compress)" | Out-Null

try {
        Write-Output "Getting current cluster configuration" | Out-Null
        $cluster = Get-Cluster
        
        Write-Output "Current cluster heartbeat settings before remediation:" | Out-Null
        Write-Output "  SameSubnetDelay: $($cluster.SameSubnetDelay)" | Out-Null
        Write-Output "  SameSubnetThreshold: $($cluster.SameSubnetThreshold)" | Out-Null
        Write-Output "  CrossSubnetDelay: $($cluster.CrossSubnetDelay)" | Out-Null
        Write-Output "  CrossSubnetThreshold: $($cluster.CrossSubnetThreshold)" | Out-Null
        Write-Output "  CrossSiteDelay: $($cluster.CrossSiteDelay)" | Out-Null
        Write-Output "  CrossSiteThreshold: $($cluster.CrossSiteThreshold)" | Out-Null

        # Apply heartbeat settings
        Write-Output "Applying new heartbeat settings..." | Out-Null
        $cluster.SameSubnetDelay = $expectedSettings.SameSubnetDelay
        $cluster.SameSubnetThreshold = $expectedSettings.SameSubnetThreshold
        $cluster.CrossSubnetDelay = $expectedSettings.CrossSubnetDelay
        $cluster.CrossSubnetThreshold = $expectedSettings.CrossSubnetThreshold
        $cluster.CrossSiteDelay = $expectedSettings.CrossSiteDelay
        $cluster.CrossSiteThreshold = $expectedSettings.CrossSiteThreshold

        Write-Output "Settings applied successfully. Verifying..." | Out-Null

        # Verify the settings were applied correctly
        $updatedCluster = Get-Cluster
        $verificationFailed = @()

        foreach ($setting in $expectedSettings.GetEnumerator()) {
                $actualValue = $updatedCluster.($setting.Key)
                Write-Output "Verifying $($setting.Key): Expected $($setting.Value), Actual $actualValue" | Out-Null
                if ($actualValue -ne $setting.Value) {
                        $verificationFailed += "$($setting.Key): Expected $($setting.Value), but got $actualValue"
                        Write-Output "MISMATCH: $($setting.Key) verification failed" | Out-Null
                }
        }

        if ($verificationFailed.Count -gt 0) {
                $status = "partial"
                $errorMessage = "Some settings were not applied correctly: " + ($verificationFailed -join "; ")
                Write-Output "Partial success: $errorMessage" | Out-Null
        } else {
                Write-Output "All heartbeat settings verified successfully" | Out-Null
        }

} catch {
        $status = "failed"
        $errorMessage = $_.Exception.Message
        Write-Output "ERROR: Failed to remediate heartbeat settings: $errorMessage" | Out-Null
}

$result = @{
        "status" = $status
        "errorMessage" = $errorMessage
}

$result | ConvertTo-Json -Compress
Stop-Transcript | Out-Null
`;

const REMEDIATE_CLUSTER_QUORUM_SETTINGS = `
Write-Output "" | Out-Null
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
Write-Output "Transcript started at path: ${HIGH_AVAILABILITY_LOG_PATH}" | Out-Null
Write-Output "" | Out-Null

Write-Output "Starting heartbeat settings remediation" | Out-Null

$allClusterResources = Get-ClusterResource
Write-Output "Retrieved all cluster resources: $($allClusterResources.Count)" | Out-Null

# Get all cluster resources of type 'Physical Disk'
$physicalDisks = $allClusterResources | Where-Object { $_.ResourceType -eq "Physical Disk" }
Write-Output "Physical disk resources found: $($physicalDisks.Count)" | Out-Null

# Filter for available disks: in 'Available Storage' and 'Online'
$availableDisks = $physicalDisks | Where-Object { $_.OwnerGroup -eq "Available Storage" -and $_.State -eq "Online" }
Write-Output "Available disks in 'Available Storage' and 'Online': $($availableDisks.Count)" | Out-Null

$status = "failed"
$errMsg = ""

Write-Output "Getting current quorum info..." | Out-Null
$quorumInfo = Get-ClusterQuorum
$quorumResourceName = [string]$quorumInfo.QuorumResource
$quorumType = $quorumInfo.QuorumType
Write-Output "Quorum resource name: $quorumResourceName" | Out-Null
Write-Output "Quorum type: $quorumType" | Out-Null

# Check if the quorum resource matches any physical disk resource
$quorumResource = $physicalDisks | Where-Object { $_.Name -eq $quorumResourceName }
Write-Output "Quorum resource object: $($quorumResource.Name)" | Out-Null

# IsPhysicalDiskAndMajority means NodeAndDiskMajority
$isPhysicalDiskAndMajority = ($null -ne $quorumResource) -and ($quorumType -eq "Majority")
Write-Output "IsPhysicalDiskAndMajority: $isPhysicalDiskAndMajority" | Out-Null

if ($isPhysicalDiskAndMajority) {
    Write-Output "Quorum is already set to NodeAndDiskMajority." | Out-Null
    $status = "success"
} elseif ($availableDisks.Count -eq 0) {
    $errMsg = "No suitable online disk found in Available Storage to set as quorum."
    Write-Output $errMsg | Out-Null
} else {
    $preferredDisk = $availableDisks | Where-Object { $_.Name -match "Quorum" } | Select-Object -First 1
    if ($null -eq $preferredDisk) {
        $quorumDisk = $availableDisks | Select-Object -First 1
        Write-Output "No disk with 'Quorum' in name found. Using first available disk: $($quorumDisk.Name)" | Out-Null
    } else {
        $quorumDisk = $preferredDisk
        Write-Output "Preferred disk with 'Quorum' in name found: $($quorumDisk.Name)" | Out-Null
    }
    try {
        Write-Output "Attempting to set quorum disk to: $($quorumDisk.Name)" | Out-Null
        Set-ClusterQuorum -DiskWitness $quorumDisk.Name -ErrorAction Stop | Out-Null
        $status = "success"
        Write-Output "Quorum disk set successfully to: $($quorumDisk.Name)" | Out-Null
    } catch {
        $errMsg = $_.Exception.Message
        Write-Output "Failed to set quorum disk: $errMsg" | Out-Null
    }
}

if ($status -eq "success") {
    $errMsg = ""
}

$result = [PSCustomObject]@{
    status = $status
    error  = $errMsg
}

Write-Output "Remediation result: $($result | ConvertTo-Json -Compress)" | Out-Null
$result | ConvertTo-Json -Compress

Write-Output "Stopping transcript." | Out-Null
Stop-Transcript | Out-Null
Write-Output "" | Out-Null
`;

const REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE = `
# Set this to 'Manual'
# Pass the instance name and filter by that
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
Write-Output "Starting SQL Server service startup type remediation" | Out-Null

$desiredStartupType = 'Manual'
Write-Output "Target startup type: $desiredStartupType" | Out-Null

$errMsg = ''
$status = 'success'

try {
        Write-Output "Searching for SQL Server services..." | Out-Null
        $services = Get-Service | Where-Object { $_.Name -like 'MSSQL*' }
        Write-Output "Found $($services.Count) SQL Server services" | Out-Null
        
        if ($services.Count -gt 0) {
                foreach ($service in $services) {
                        Write-Output "Processing service: $($service.Name) (Current StartType: $($service.StartType))" | Out-Null
                        
                        if ($service.StartType -eq $desiredStartupType) {
                                Write-Output "Service $($service.Name) already has correct startup type: $desiredStartupType" | Out-Null
                                continue
                        }
                        
                        try {
                                Write-Output "Setting startup type for $($service.Name) to $desiredStartupType" | Out-Null
                                Set-Service -Name $service.Name -StartupType $desiredStartupType
                                
                                # Verify the change
                                $updatedService = Get-Service -Name $service.Name
                                if ($updatedService.StartType -eq $desiredStartupType) {
                                        Write-Output "Successfully updated $($service.Name) startup type to $desiredStartupType" | Out-Null
                                } else {
                                        Write-Output "WARNING: Startup type verification failed for $($service.Name)" | Out-Null
                                        $errMsg += "Verification failed for $($service.Name). "
                                        $status = 'partial'
                                }
                        } catch {
                                $serviceError = "Failed to set $($service.Name): $($_.Exception.Message)"
                                $errMsg += $serviceError + " "
                                $status = 'partial'
                                Write-Output "ERROR: $serviceError" | Out-Null
                        }
                }
        } else {
                $errMsg += "No SQL Server services found."
                $status = 'failed'
                Write-Output "ERROR: No SQL Server services found" | Out-Null
        }
} catch {
        $errMsg += "General failure: $($_.Exception.Message)"
        $status = 'failed'
        Write-Output "ERROR: General failure in SQL Server service remediation: $($_.Exception.Message)" | Out-Null
}

Write-Output "SQL Server service startup type remediation completed with status: $status" | Out-Null
if ($errMsg) {
        Write-Output "Errors encountered: $errMsg" | Out-Null
}

$result = [PSCustomObject]@{
        status = $status
        error  = $errMsg
}
$result | ConvertTo-Json -Compress
Stop-Transcript | Out-Null
`;

const AOAG_INSTANCE_ROLE = (instanceName: string, sqlAuthEnabled: boolean) => `
$sqlAuthEnabled = [System.Convert]::ToBoolean('${sqlAuthEnabled}')
$sqlInstanceName = "${instanceName}"

${slqcmdExecutionTemplate}
$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}
if($sqlAuthEnabled) {
    ${readSsmParameter(instanceName)}
}

$ServerInstanceName = "$env:COMPUTERNAME"
$regBasePath = "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server"
$instanceRegKey = (Get-ItemProperty -Path "$regBasePath\\Instance Names\\SQL" -ErrorAction SilentlyContinue).$sqlInstanceName
if ($instanceRegKey) {
    $clusterPath = "$regBasePath\\$instanceRegKey\\Cluster"
    if (Test-Path $clusterPath) {
        $fciVirtualName = (Get-ItemProperty -Path $clusterPath -Name "ClusterName" -ErrorAction SilentlyContinue).ClusterName
        if ($fciVirtualName) {
            $ServerInstanceName = $fciVirtualName
        }
    }
}
If ($sqlInstanceName -ne "MSSQLSERVER") {
    $ServerInstanceName = "$ServerInstanceName\\$sqlInstanceName"
}

$query = @"
SET NOCOUNT ON;
SELECT
    CAST(SERVERPROPERTY('IsClustered') AS INT) AS isClustered,
    (SELECT ag.name AS agName, ars.role_desc AS replicaRole
     FROM sys.dm_hadr_availability_replica_states ars
     JOIN sys.availability_groups ag ON ag.group_id = ars.group_id
     WHERE ars.is_local = 1
     FOR JSON PATH) AS replicaRoles,
    (SELECT d.name AS databaseName, ag.name AS agName, ars.role_desc AS replicaRole
     FROM sys.databases d
     JOIN sys.dm_hadr_database_replica_states drs ON d.database_id = drs.database_id
     JOIN sys.availability_groups ag ON drs.group_id = ag.group_id
     JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = drs.replica_id AND ars.group_id = drs.group_id
     WHERE drs.is_local = 1
     FOR JSON PATH) AS databaseRoles
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
"@

try {
    $result = Call-SqlCmd -SqlCredential $sqlCredential -Query $query -InstanceName "$ServerInstanceName" -SuppressStderr $True
    if (-not [string]::IsNullOrEmpty($result)) {
        $result
    } else {
        @{ error = 'Empty response from AOAG role query' } | ConvertTo-Json -Compress
    }
} catch {
    @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`;

export {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN,
    REMEDIATE_HEARTBEAT_SETTINGS,
    REMEDIATE_CLUSTER_QUORUM_SETTINGS,
    REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE,
    AOAG_INSTANCE_ROLE,
    type LunIgroupMapping
};
