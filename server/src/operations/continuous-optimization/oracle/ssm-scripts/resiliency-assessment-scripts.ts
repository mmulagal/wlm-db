import { WorkloadInstance } from '../../../../utils/common-types';
import { checkCommandStatus, logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const CRR_LOG_FILE = `${LINUX_LOG_DIRECTORY}/crr-assessment.log`;
const CRR_LOG_FILE_NAME = 'crr-assessment.log';

interface DirectOntapCrrData {
    clusterPeerDetailsJson: string;
    vserverPeerDetailsJson: string;
    snapMirrorDestinationDetailsJson: string;
}

const crrPythonTemplate = (
    instanceName: string,
    svmNames: string[],
    volumeNames: string[],
    ontapCrrData: DirectOntapCrrData
) => `
instance_name = '${instanceName}'
svm_names = json.loads('${JSON.stringify(svmNames)}')
volume_names = json.loads('${JSON.stringify(volumeNames)}')

log("Starting CRR assessment")
log(f"Instance: {instance_name}")
log(f"SVM names: {svm_names}, Volume names: {volume_names}")

cluster_peers_records = json.loads('${ontapCrrData.clusterPeerDetailsJson}')
vserver_peers_records = json.loads('${ontapCrrData.vserverPeerDetailsJson}')
snapmirror_dests_records = json.loads('${ontapCrrData.snapMirrorDestinationDetailsJson}')

available_clusters = [
    rec.get('peerClusterName', '')
    for rec in cluster_peers_records
    if rec.get('availability') == 'available'
]
log(f"Available remote clusters: {available_clusters}")

unique_svm_names = list(set(svm_names))
vserver_peers_by_svm = {}
snapmirror_dests_by_svm = {}
for svm_name in unique_svm_names:
    vserver_peers_by_svm[svm_name] = [p for p in vserver_peers_records if p.get('svmname') == svm_name]
    snapmirror_dests_by_svm[svm_name] = [d for d in snapmirror_dests_records if d.get('sourceVserverName') == svm_name]

# Evaluate CRR status per volume
results = []

for vol_name in volume_names:
    obj = {
        'volumeName': vol_name,
        'isSnapMirrored': False,
        'sourceSvmName': unique_svm_names[0] if unique_svm_names else ''
    }

    for svm_name in unique_svm_names:
        vserver_peers = vserver_peers_by_svm.get(svm_name, [])
        snap_dests = snapmirror_dests_by_svm.get(svm_name, [])

        eligible_peers = [
            vp for vp in vserver_peers
            if vp.get('peerClusterName', '') in available_clusters
            and vp.get('svmname', '') == svm_name
            and vp.get('state') == 'peered'
            and 'snapmirror' in (vp.get('applications') or [])
        ]

        if not eligible_peers:
            continue

        svm_snap_mapping = []
        for vp in eligible_peers:
            local_svm_name = vp.get('svmname', '')
            peer_cluster_name = vp.get('peerClusterName', '')
            peer_cluster_id = 'fs-' + peer_cluster_name.split('FsxId')[-1] if 'FsxId' in peer_cluster_name else ''
            existing = [m for m in svm_snap_mapping if m['sourceSvmName'] == local_svm_name]
            if not existing:
                svm_snap_mapping.append({
                    'sourceSvmName': local_svm_name,
                    'peerSvmNames': [vp.get('peerSvmName', '')],
                    'peerClusterNames': [peer_cluster_name],
                    'peerClusterIds': [peer_cluster_id]
                })
            else:
                existing[0]['peerSvmNames'].append(vp.get('peerSvmName', ''))
                existing[0]['peerClusterNames'].append(peer_cluster_name)
                existing[0]['peerClusterIds'].append(peer_cluster_id)

        all_destination_paths = []
        all_peer_svm_names = []
        all_peer_cluster_names = []
        all_peer_cluster_ids = []
        found_snapmirror = False

        for mapping in svm_snap_mapping:
            local_svm_name = mapping['sourceSvmName']
            source_path = f'{local_svm_name}:{vol_name}'
            matched_dests = [sd for sd in snap_dests if sd.get('sourcePath') == source_path]
            if not matched_dests:
                continue
            found_snapmirror = True
            for dest in matched_dests:
                dp = dest.get('destinationPath', '')
                if dp:
                    all_destination_paths.append(dp)
                dest_svm = dest.get('destinationVserverName', '')
                if dest_svm in mapping['peerSvmNames']:
                    idx = mapping['peerSvmNames'].index(dest_svm)
                    all_peer_svm_names.append(dest_svm)
                    all_peer_cluster_names.append(mapping['peerClusterNames'][idx])
                    all_peer_cluster_ids.append(mapping['peerClusterIds'][idx])

        if found_snapmirror:
            obj['isSnapMirrored'] = True
            obj['sourceSvmName'] = svm_name
            obj['peerSVMName'] = list(set(all_peer_svm_names))
            obj['destinationPath'] = list(set(all_destination_paths))
            obj['peerClusterName'] = list(set(all_peer_cluster_names))
            obj['peerClusterFsxId'] = list(set(all_peer_cluster_ids))
            break

    results.append(obj)

output = {'crrDetails': results, 'errors': ''}
log(f"CRR assessment complete: {json.dumps(output)}")
print(json.dumps(output))
`;

const ORACLE_CRR_ASSESSMENT_SCRIPT = (instanceRecord: WorkloadInstance, ontapCrrData: DirectOntapCrrData) => {
    const svmNames = (
        Array.isArray(instanceRecord.svmOntapName) ? instanceRecord.svmOntapName : [instanceRecord.svmOntapName]
    ).filter((n): n is string => !!n);
    const redoVolumeNames = new Set(instanceRecord.redoVolumeNames || []);
    const volumeNames = (instanceRecord.mappedVolumeNames || []).filter(name => !redoVolumeNames.has(name));

    return `#!/bin/bash
set -euo pipefail

${logFileCheck()}
exec 3>&1
exec >> ${CRR_LOG_FILE} 2>&1
echo "=== CRR Assessment started at $(date -u) ==="

${checkCommandStatus}

crrResults=$(${pythonScriptInit(
        crrPythonTemplate(instanceRecord.name, svmNames, volumeNames, ontapCrrData),
        CRR_LOG_FILE_NAME
    )})

echo "$crrResults" >&3
`;
};

export { ORACLE_CRR_ASSESSMENT_SCRIPT, type DirectOntapCrrData };
