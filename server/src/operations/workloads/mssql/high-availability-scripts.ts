import { OntapRequestParams } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
import { HIGH_AVAILABILITY_LOG_PATH } from './const';

const getOntapScript = (params: OntapRequestParams, info: string) => `
# ${info}
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue'
$FSxID = '${params.fsxId}'
$FSxRegion = '${params.region}'
$apiEndpoint = '${params.apiEndpoint}'
Write-Information "Getting igroup details for FSxID: $FSxID, FSxRegion: $FSxRegion"
${ontapRestRequest}
$ontapResponse = Invoke-ONTAPRequest -ApiEndpoint $ApiEndpoint -ApiQueryFilter $apiQueryFilter -method "GET"
$ontapResponse | ConvertTo-Json
Stop-Transcript | Out-Null
`;

const GET_IGROUP_UUID = (params: OntapRequestParams) => getOntapScript(params, 'Get ONTAP IGROUP UUID');

const GET_LUN_MAPS = (params: OntapRequestParams) => getOntapScript(params, 'Get ONTAP LUN MAPS');

const GET_HOST_IQN = `
# Get local IQN
(Get-InitiatorPort | Select-Object -ExpandProperty NodeAddress) -join ', '
`;

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
return $settings | ConvertTo-Json
`;

const GET_CLUSTER_QUORUM = `
# Get current cluster quorum type
(Get-ClusterQuorum).QuorumResource
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
        IsPhysicalDisk = $false
        IsMajority = $false
        IsPhysicalDiskAndMajority = $false
}

if ($quorumResource) { $result.IsPhysicalDisk = $true }
if ($quorumType -eq "Majority") { $result.IsMajority = $true }
if ($result.IsPhysicalDisk -and $result.IsMajority) { $result.IsPhysicalDiskAndMajority = $true }
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
        ConvertTo-Json
`;

export {
    CLUSTER_QUORUM_TYPE,
    GET_CLUSTER_QUORUM,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_IGROUP_UUID,
    GET_LUN_MAPS,
    GET_HOST_IQN
};
