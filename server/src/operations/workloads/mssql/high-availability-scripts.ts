import { OntapRequestParams } from '../../../utils/common-types';
import { ontapRestRequest } from './common-templates';
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

const GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN = (params: OntapRequestParams, lunUuids: string[]) => `
# Get host IQN and LUN igroup/initiator names for multiple LUNs
Start-Transcript -Path ${HIGH_AVAILABILITY_LOG_PATH} -Append | Out-Null
$WarningPreference = 'SilentlyContinue'
$FSxID = '${params.fsxId}'
$FSxRegion = '${params.region}'
$apiEndpoint = '${params.apiEndpoint}'
$apiQueryFilter = 'fields=igroup'
${ontapRestRequest}

# Fetch host IQN(s)
$HostIQNs = (Get-InitiatorPort | Select-Object -ExpandProperty NodeAddress) -join ', '

# Fetch all LUN mappings
$results = @()
$lunMapsResp = Invoke-ONTAPRequest -ApiEndpoint "$apiEndpoint/protocols/san/lun-maps" -ApiQueryFilter $apiQueryFilter -method "GET"

if ($lunMapsResp.records) {
        $filterLuns = @(${lunUuids.map(uuid => `'${uuid}'`).join(',')})
        foreach ($lunMap in $lunMapsResp.records) {
                $lunUuid = $lunMap.lun.uuid
                if ($filterLuns.Count -eq 0 -or $filterLuns -contains $lunUuid) {
                        $igroupObj = $lunMap.igroup
                        $igroupUuid = $null
                        $igroupName = $null
                        if ($igroupObj) {
                                if ($igroupObj.PSObject.Properties['uuid']) {
                                        $igroupUuid = $igroupObj.uuid
                                }
                                if ($igroupObj.PSObject.Properties['name']) {
                                        $igroupName = $igroupObj.name
                                }
                        }
                        $initiators = @()
                        if ($igroupObj -and $igroupObj.PSObject.Properties['initiators']) {
                                $initiatorsRaw = $igroupObj.initiators
                                foreach ($item in @($initiatorsRaw)) {
                                        # Split by comma and whitespace, trim, and filter empty
                                        $itemStr = "$item"
                                        $initiators += ($itemStr -split '[,\\s]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
                                }
                        }
                        $result = [PSCustomObject]@{
                                LUN_UUID = $lunUuid
                                IGROUP_UUID = $igroupUuid
                                IGROUP_NAME = $igroupName
                                InitiatorNames = $initiators
                        }
                        $results += $result
                }
        }
}

# Output both host IQN and LUN mapping results as a single object
$output = [PSCustomObject]@{
        HostIQN = $HostIQNs
        LUNMappings = $results
}
$output | ConvertTo-Json -Compress

Stop-Transcript | Out-Null
`;

export {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN
};
