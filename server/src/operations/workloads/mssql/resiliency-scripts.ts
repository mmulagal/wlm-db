import { WorkloadInstance } from '../../../utils/common-types';
import { compressResponse, ontapRestRequest } from './common-templates';
import { CRR_ASSESSMENT_LOG_PATH } from './const';
import { JSON_CHECK } from './continuous-optimization-scripts';

const CLUSTER_PEER_DETAILS_SCRIPT = `
   
    Function Get-OntapClusterPeerDetails {
        Write-Information "Get Cluster Peer Details"
        $Params = @{
                        "ApiEndPoint" = "/private/cli/cluster/peer"
                        "ApiQueryFilter" = "fields=cluster,availability,rcluster,peer-addrs"
                    }
        $Response = Invoke-ONTAPRequest @Params
        $ClusterPeerDetails = @()
        foreach ($record in $Response.records) {
            $ClusterPeerDetails += @{
                "cluster" = $record.cluster
                "availability" = $record.availability
                "rcluster" = $record.rcluster
                "peerAddrs" = $record."peer_addrs"
            }
        }
        return $ClusterPeerDetails
    }
    
`;

const VSERVER_PEER_DETAILS_SCRIPT = `
    Function Get-VServerPeerDetails($MappedSVMId) {
        Write-Information "Get SVM Peer Details"
        $Params = @{
                        "ApiEndPoint" = "/svm/peers?svm.uuid=$MappedSVMId&fields=name,state,applications,peer.cluster.name,peer.svm.uuid,peer.svm.name,svm.name,svm.uuid"
                    }
        $Response = Invoke-ONTAPRequest @Params
        $VserverPeerDetails = @()
        foreach ($record in $Response.records) {
            $VserverPeerDetails += @{
                "name" = $record.name
                "state" = $record.state
                "applications" = $record.applications
                "peerClusterName" = $record.peer.cluster.name
                "peerSvmUuid" = $record.peer.svm.uuid
                "peerSvmName" = $record.peer.svm.name
                "svmname" = $record.svm.name
                "svmuuid" = $record.svm.uuid
            }
        }
        return $VserverPeerDetails
    }
`;

const SNAPMIRROR_DESTINATION_DETAILS_SCRIPT = `
    Function Get-SnapMirrorDestinationDetails($MappedSVMId) {
        Write-Information "Get SnapMirror Destination Details"
        $Params = @{
                        "ApiEndPoint" = "/snapmirror/relationships/?list_destinations_only=true&svm.uuid=$MappedSVMId&fields=policy.name,policy.type,state,source.path,source.svm.name,source.svm.uuid,destination.path,destination.svm.name,destination.svm.uuid"
                    }
        $Response = Invoke-ONTAPRequest @Params
        $SnapMirrorDestinationDetails = @()
        foreach ($record in $Response.records) {
            $SnapMirrorDestinationDetails += @{
                "policyName" = $record.policy.name
                "policyType" = $record.policy.type
                "state" = $record.state
                "sourceVserverName" = $record.source.svm.name
                "sourceVserverUuid" = $record.source.svm.uuid
                "sourcePath" = $record.source.path
                "destinationVserverName" = $record.destination.svm.name
                "destinationVserverUuid" = $record.destination.svm.uuid
                "destinationPath" = $record.destination.path
            }
        }
        return $SnapMirrorDestinationDetails
    }
`;
const CROSS_REGION_REPLICATION_SCRIPT = (instanceRecord: WorkloadInstance) => `
    #Get CRR details

    ${JSON_CHECK}

    ${compressResponse}

    ${CLUSTER_PEER_DETAILS_SCRIPT}

    ${VSERVER_PEER_DETAILS_SCRIPT}

    ${SNAPMIRROR_DESTINATION_DETAILS_SCRIPT}

    $CRRDetails = @{}
    $CRRDetails['errors'] = ''
    $CRRDetails['crrDetails'] = @()
    
    $FSxID = "${instanceRecord.fsxFileSystem}"
    $FSxRegion = "${instanceRecord.region}"
    $InstanceName = "${instanceRecord.name}"
    $MappedSVMId = "${instanceRecord.svmOntapUuid}"
    $MappedVolumeNames = '${JSON.stringify(instanceRecord.mappedVolumeNames)}' | ConvertFrom-Json
    $MappedVolumeUuids = '${JSON.stringify(instanceRecord.mappedVolumesUuids)}' | ConvertFrom-Json

    # Define the path of the directory you want to create
    $LogFilesPath = "C:\\cfn\\log"
    # Check if the directory exists
    if (-not (Test-Path -Path $LogFilesPath -PathType Container)) {
        New-Item -Path $LogFilesPath -ItemType Directory
    } 

    Start-Transcript -Path ${CRR_ASSESSMENT_LOG_PATH} -Append | Out-Null

    Write-Information "Starting CRR Assessment for $instanceName, $mappedSVMId,  $mappedVolumeUuids"

    ${ontapRestRequest}

    #Fetch cluster peer details
    $ClusterPeerDetails = Get-OntapClusterPeerDetails

    #Fetch vserver peer details
    $VServerPeerDetails = Get-VServerPeerDetails $MappedSVMId

    #Fetch snapmirror destination details
    $SnapMirrorDestinationDetails = Get-SnapMirrorDestinationDetails $MappedSVMId

    #Lets check if CRR is enabled
    foreach($volume in $MappedVolumeNames) {
        $object = @{
            "volumeName" = $volume
            "sourceSvmUuid" = $MappedSVMId
        }
        if(($VServerPeerDetails.Count -eq 0 -OR $SnapMirrorDestinationDetails.Count -eq 0)) {
            $object["isSnapMirrored"] = $false
            $object["isCRREnabled"] = $false
            } else {
                $VserverPeerDetail = $VServerPeerDetails | Where-Object { $_.svmuuid -eq $MappedSVMId -and $_.state -eq "peered" -and $_.applications -contains "snapmirror" }
                if([string]::IsNullOrEmpty($VserverPeerDetail)) {
                    $object["isSnapMirrored"] = $false
                    $object["isCRREnabled"] = $false
                } else {
                    $SVMName = $VserverPeerDetail.svmname
                    $PeerFsxClusterName = $VserverPeerDetail.peerClusterName
                    $PeerClusterFsxId = 'fs-' + ($PeerFsxClusterName -split "FsxId" )[-1]
                    $SVMVolumeName = $SVMName + ':' + $volume
                    $SnapMDestinationDetail = $SnapMirrorDestinationDetails | Where-Object { $_.sourcePath -eq $SVMVolumeName }
                    if([string]::IsNullOrEmpty($SnapMDestinationDetail)) {
                        $object["isSnapMirrored"] = $false
                        $object["isCRREnabled"] = $false
                    } else {
                        $object["isSnapMirrored"] = $true
                        $object["peerSVMName"] = $SnapMDestinationDetail.destinationVserverName
                        $object["destinationPath"] = $SnapMDestinationDetail.destinationVserverUuid
                        $object["destinationVolumeName"] = $SnapMDestinationDetail.destinationPath
                        $object["peerClusterName"] = $PeerFsxClusterName
                        $object["peerClusterFsxId"] = $PeerClusterFsxId
                    }
                }
            }
        $CRRDetails['crrDetails'] += $object
    }
    
    Write-Information "CRR Assessment completed: $CRRDetails"
    
    $response = $CRRDetails | ConvertTo-Json -Depth 5

    if([string]::IsNullOrEmpty($response)) {
        throw "Failed to compress the response because the response is either null or empty. $response"
    }
    
    return (Deflate-String $response)

`;
export { CROSS_REGION_REPLICATION_SCRIPT };
