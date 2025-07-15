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
        ConvertTo-Json
`;
const GET_LUN_IGROUP_INITIATOR_NAMES = (params: OntapRequestParams, lunUuid: string) => `
# Get LUN map and extract igroupUuid, igroupName, and initiator names for mapped LUN UUID
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue'
$FSxID = '${params.fsxId}'
$FSxRegion = '${params.region}'
$apiEndpoint = '${params.apiEndpoint}'
$apiQueryFilter = 'fields=igroup'
${ontapRestRequest}

function Convert-StringToHashtable {
        param([string]$str)
        $hash = @{}
        if ($str -match '^@{(.+)}$') {
                $body = $matches[1]
                $pairs = $body -split ';(?=(?:[^"]*"[^"]*")*[^"]*$)'
                foreach ($pair in $pairs) {
                        if ($pair -match '^(.*?)=(.*)$') {
                                $key = $matches[1].Trim()
                                $value = $matches[2].Trim()
                                $hash[$key] = $value
                        }
                }
        }
        return $hash
}

$results = @()
$lunMapsResp = Invoke-ONTAPRequest -ApiEndpoint "$apiEndpoint/protocols/san/lun-maps/${lunUuid}" -ApiQueryFilter $apiQueryFilter -method "GET"
if ($lunMapsResp.records) {
        foreach ($lunMap in $lunMapsResp.records) {
                $igroupObj = $null
                if ($lunMap.PSObject.Properties['igroup']) {
                        $igroupObj = $lunMap.igroup
                }
                if ($igroupObj) {
                        if ($igroupObj -is [string]) { $igroupObj = Convert-StringToHashtable $igroupObj }
                        $result = [PSCustomObject]@{
                                LUN_UUID = '${lunUuid}'
                                IGROUP_UUID = $igroupObj.uuid
                                IGROUP_NAME = $igroupObj.name
                                InitiatorNames = $igroupObj.initiators
                        }
                        $results += $result
                }
        }
}
$results | ConvertTo-Json
Stop-Transcript | Out-Null
`;

export {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_IGROUP_UUID,
    GET_LUN_MAPS,
    GET_HOST_IQN,
    GET_LUN_IGROUP_INITIATOR_NAMES
};
