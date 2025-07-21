import { ontapRestRequest, ontapRestRequestBootstrap } from './common-templates';
import { HIGH_AVAILABILITY_LOG_PATH } from './const';

const DRIVE_LETTER = `
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

# Get all cluster resources of type 'Physical Disk'
$physicalDisks = Get-ClusterResource | Where-Object { $_.ResourceType -eq "Physical Disk" }

# Check if the quorum resource matches any physical disk resource
$quorumResource = $physicalDisks | Where-Object { $_.Name -eq $quorumResourceName }

# Prepare result object
$result = [PSCustomObject]@{
                QuorumResourceName = $quorumResourceName
                QuorumType = $quorumType
                IsPhysicalDisk = !!$quorumResource
                IsMajority = $quorumType -eq "Majority"
                IsPhysicalDiskAndMajority = !!$quorumResource -and ($quorumType -eq "Majority")
}
$result | ConvertTo-Json -Compress
`;

const SQL_SERVER_SERVICES = (instanceName: string) => `
$serviceName = if ([string]::IsNullOrEmpty("${instanceName}") -or "${instanceName}".ToUpper() -eq "MSSQLSERVER") {
        "MSSQLSERVER"
} else {
        "MSSQL$${instanceName}"
}
Get-Service -Name $serviceName -ErrorAction SilentlyContinue |
        Select-Object Name,
                                  @{Name="Status";Expression={ $_.Status.ToString() }},
                                  DisplayName,
                                  @{Name="StartType";Expression={ $_.StartType.ToString() }} |
        ConvertTo-Json | Write-Output
`;

const GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN = (fsxId: string, fsxRegion: string, lunUuids: string[]) => `
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue'
$FSxID = '${fsxId}'
$FSxRegion = '${fsxRegion}'
${ontapRestRequest}

$hostIqns = (Get-InitiatorPort | Select-Object -ExpandProperty NodeAddress) -join ', '
$response = [PSCustomObject]@{
        hostIqns = $hostIqns
        lunMappings = @()
}

$lunMapsResp = Invoke-ONTAPRequest -ApiEndpoint "/protocols/san/lun-maps" -ApiQueryFilter 'fields=igroup' -method "GET"
$filterLuns = @(${lunUuids.map(uuid => `'${uuid}'`).join(',')})

if ($lunMapsResp.records) {
        $response.lunMappings = $lunMapsResp.records | Where-Object { $filterLuns -contains $_.lun.uuid } | ForEach-Object {
                $igroup = $_.igroup
                if (-not [string]::IsNullOrEmpty($igroup)) {
                        [PSCustomObject]@{
                                lunUuid = $_.lun.uuid
                                igroupUuid = $igroup.uuid
                                igroupName = $igroup.name
                                initiatorNames = $igroup.initiators -split '[,\\s]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
                        }
                }
        }
}

$response | ConvertTo-Json -Depth 5 -Compress
Stop-Transcript | Out-Null
`;

const ADD_INITIATOR_TO_IGROUP = (fsxId: string, region: string, initiator: string, igroupName: string) => `
# Add initiator to igroup Script
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null

$WarningPreference = 'SilentlyContinue';
${ontapRestRequestBootstrap}

$FSxID = '${fsxId}'
$FSxRegion = '${region}'
$IgroupName = '${igroupName}'
$Initiator = '${initiator}'
$MgmtDNS = '198.19.255.96'
$sqlvmname = ' wlmdb_sqlsvm_1737955806953'

$response = @{
                result = 'success'
                error = ''}
try {
    $FSxNDetails = Get-FSxNDetails -fsxId $FSxID
    $FSxCredentials = $FSxNDetails.FSxCredentials
    $FSxHostName = $FSxNDetails.FSxHostName
                    
    Connect-NcController -Name $FSxHostName -Credential $FSxCredentials -Vserver $sqlvmname
    Add-NcIgroupInitiator -Name $IgroupName -Initiator $Initiator
} catch {
        $response.result = 'failed'
        $response.error = $($_.Exception.Message)
        Write-Error "Failed to add initiator to igroup: $($_.Exception.Message)"
}
        return $response
`;

const SET_HEARTBEAT_SETTINGS = `

# Set the desired heartbeat settings
(Get-Cluster).SameSubnetDelay = 1000
(Get-Cluster).SameSubnetThreshold = 10
(Get-Cluster).CrossSubnetDelay = 1000
(Get-Cluster).CrossSubnetThreshold = 20
(Get-Cluster).CrossSiteDelay = 1000
(Get-Cluster).CrossSiteThreshold = 20
`;

export {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN,
    ADD_INITIATOR_TO_IGROUP,
    SET_HEARTBEAT_SETTINGS
};
