import { WorkloadInstance } from '../../../utils/common-types';
import { compressResponse } from './common-templates';
import { CRR_ASSESSMENT_LOG_PATH } from './const';
import { JSON_CHECK } from './assessment-scripts';

interface DirectOntapCrrData {
    clusterPeerDetailsJson: string;
    vserverPeerDetailsJson: string;
    snapMirrorDestinationDetailsJson: string;
}

const CROSS_REGION_REPLICATION_SCRIPT = (instanceRecord: WorkloadInstance, ontapCrrData: DirectOntapCrrData) => `
    #Get CRR details

    ${JSON_CHECK}

    ${compressResponse}

    $CRRDetails = @{}
    $CRRDetails['errors'] = ''
    $CRRDetails['crrDetails'] = @()
    
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

    #Cluster peer, svm peer and snapmirror relationship details, fetched server-side via proxy-forwarder
    $ClusterPeerDetails = '${ontapCrrData.clusterPeerDetailsJson}' | ConvertFrom-Json
    $VServerPeerDetails = '${ontapCrrData.vserverPeerDetailsJson}' | ConvertFrom-Json
    $SnapMirrorDestinationDetails = '${ontapCrrData.snapMirrorDestinationDetailsJson}' | ConvertFrom-Json

    $AvailableRemoteClusters =  @()
    foreach($cluster in $ClusterPeerDetails) {
        if($cluster.availability -eq "available") {
            $AvailableRemoteClusters += $cluster.peerClusterName
        }
    }

    #Lets check if CRR is enabled
    foreach($volume in $MappedVolumeNames) {
        $object = @{
            "volumeName" = $volume
            "sourceSvmUuid" = $MappedSVMId
        }
       
        $VserverPeerDetail = $VServerPeerDetails | Where-Object { $AvailableRemoteClusters -contains $_.peerClusterName -and $_.svmuuid -eq $MappedSVMId -and $_.state -eq "peered" -and $_.applications -contains "snapmirror" }
        if([string]::IsNullOrEmpty($VserverPeerDetail)) {
            $object["isSnapMirrored"] = $false
            $object["isCRREnabled"] = $false
        } else {
                $SVMSnapMirrorMapping = @()
                foreach($VPDetail in $VserverPeerDetail) {
                    $SVMName = $VPDetail.svmname
                    $SVMSnapMirrorMappingDetails = $SVMSnapMirrorMapping | Where-Object { $_.sourceSvmName -eq $SVMName}
                    $PeerClusterId = 'fs-' + ($VPDetail.peerClusterName -split "FsxId" )[-1]
                    if([string]::IsNullOrEmpty($SVMSnapMirrorMappingDetails)) {
                        $SvmObject = @{
                            'sourceSvmName' = $SVMName
                            'peerSvmNames' = @($VPDetail.peerSvmName)
                            'peerClusterNames' = @($VPDetail.peerClusterName)
                            'peerClusterIds' = @($PeerClusterId)
                        }
                        $SVMSnapMirrorMapping += $SvmObject
                    } else {
                        $SVMSnapMirrorMappingDetails.peerSvmNames += $VPDetail.peerSvmName
                        $SVMSnapMirrorMappingDetails.peerClusterNames += $VPDetail.peerClusterName
                        $SVMSnapMirrorMappingDetails.peerClusterIds += $PeerClusterId
                    }
                }

                [string[]]$DestinationPaths = @()
                foreach($Mapping in $SVMSnapMirrorMapping) {
                    $SVMName = $Mapping.sourceSvmName
                    $SVMVolumeName = $SVMName + ':' + $volume
                    $SnapMDestinationDetail = $SnapMirrorDestinationDetails | Where-Object { $_.sourcePath -eq $SVMVolumeName }
                    if([string]::IsNullOrEmpty($SnapMDestinationDetail)) {
                        $object["isSnapMirrored"] = $false
                        $object["isCRREnabled"] = $false
                    } else {
                            foreach($SMDestinationDetail in $SnapMDestinationDetail) {
                                $DestinationPaths += $SMDestinationDetail.destinationPath
                            }
                            $SVMSnapMirrorMappingDetails = $SVMSnapMirrorMapping | Where-Object { $_.sourceSvmName -eq $SVMName }
                            
                            $object["isSnapMirrored"] = $true
                            $object["peerSVMName"] = @($SVMSnapMirrorMappingDetails.peerSvmNames | Select-Object -Unique)
                            $object["destinationPath"] = @($DestinationPaths | Select-Object -Unique)
                            $object["peerClusterName"] = @($SVMSnapMirrorMappingDetails.peerClusterNames | Select-Object -Unique)
                            $object["peerClusterFsxId"] = @($SVMSnapMirrorMappingDetails.peerClusterIds | Select-Object -Unique)
                                
                        }
                    }
                }
        $CRRDetails['crrDetails'] += $object
    }
    $CRRDetailsJson = $CRRDetails | ConvertTo-Json -Depth 5
    Write-Information "CRR Assessment completed: $CRRDetailsJson"

    if([string]::IsNullOrEmpty($CRRDetailsJson)) {
        throw "Failed to compress the response because the response is either null or empty. $CRRDetailsJson"
    }
    
    return (Deflate-String $CRRDetailsJson)

`;
export { CROSS_REGION_REPLICATION_SCRIPT, type DirectOntapCrrData };
