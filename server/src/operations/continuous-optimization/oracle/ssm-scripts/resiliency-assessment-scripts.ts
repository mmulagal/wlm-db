import { WorkloadInstance } from '../../../../utils/common-types';
import {
    checkCommandStatus,
    logFileCheck,
    pythonScriptInit,
    getFsxCredentials,
    ontapRestApiScript
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const CRR_LOG_FILE = `${LINUX_LOG_DIRECTORY}/crr-assessment.log`;
const CRR_LOG_FILE_NAME = 'crr-assessment.log';

const crrPythonTemplate = (fsxId: string, region: string, svmNames: string[], volumeNames: string[]) => `
${getFsxCredentials}
${ontapRestApiScript}

filesystemid = '${fsxId}'
region = '${region}'
svm_names = json.loads('${JSON.stringify(svmNames)}')
volume_names = json.loads('${JSON.stringify(volumeNames)}')

log("Starting CRR assessment")
log(f"FSx ID: {filesystemid}, Region: {region}")
log(f"SVM names: {svm_names}, Volume names: {volume_names}")

# 1. Get cluster peer details
cluster_peers_data, error = ontapRestApiRequest(filesystemid, region, 'GET', 'cluster/peers?fields=name,status.state,remote.ip_addresses')
if error:
    log(f"Failed to fetch cluster peer details: {error}")
    print(json.dumps({'crrDetails': [], 'errors': str(error)}))
    sys.exit(0)

available_clusters = [
    rec.get('name', '')
    for rec in cluster_peers_data.get('records', [])
    if rec.get('status', {}).get('state') == 'available'
]
log(f"Available remote clusters: {available_clusters}")

# 2. For each SVM, get vserver peer details and snapmirror destinations
unique_svm_names = list(set(svm_names))
vserver_peers_by_svm = {}
snapmirror_dests_by_svm = {}

for svm_name in unique_svm_names:
    try:
        resp, err = ontapRestApiRequest(filesystemid, region, 'GET',
            f'svm/peers?svm.name={svm_name}&fields=name,state,applications,peer.cluster.name,peer.svm.uuid,peer.svm.name,svm.name,svm.uuid')
        if err or not resp:
            log(f"Error fetching vserver peers for {svm_name}: {err}")
            vserver_peers_by_svm[svm_name] = []
            snapmirror_dests_by_svm[svm_name] = []
            continue
        vserver_peers_by_svm[svm_name] = resp.get('records', [])
    except Exception as e:
        log(f"Exception fetching vserver peers for {svm_name}: {e}")
        vserver_peers_by_svm[svm_name] = []
        snapmirror_dests_by_svm[svm_name] = []
        continue

    try:
        resp, err = ontapRestApiRequest(filesystemid, region, 'GET',
            f'snapmirror/relationships/?list_destinations_only=true&source.svm.name={svm_name}&fields=policy.name,policy.type,state,source.path,source.svm.name,source.svm.uuid,destination.path,destination.svm.name,destination.svm.uuid')
        snapmirror_dests_by_svm[svm_name] = resp.get('records', []) if resp else []
        if err:
            log(f"Error fetching snapmirror dests for {svm_name}: {err}")
    except Exception as e:
        log(f"Exception fetching snapmirror dests for {svm_name}: {e}")
        snapmirror_dests_by_svm[svm_name] = []

# 3. Evaluate CRR status per volume
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
            if vp.get('peer', {}).get('cluster', {}).get('name', '') in available_clusters
            and vp.get('svm', {}).get('name', '') == svm_name
            and vp.get('state') == 'peered'
            and 'snapmirror' in vp.get('applications', [])
        ]

        if not eligible_peers:
            continue

        svm_snap_mapping = []
        for vp in eligible_peers:
            local_svm_name = vp.get('svm', {}).get('name', '')
            peer_cluster_name = vp.get('peer', {}).get('cluster', {}).get('name', '')
            peer_cluster_id = 'fs-' + peer_cluster_name.split('FsxId')[-1] if 'FsxId' in peer_cluster_name else ''
            existing = [m for m in svm_snap_mapping if m['sourceSvmName'] == local_svm_name]
            if not existing:
                svm_snap_mapping.append({
                    'sourceSvmName': local_svm_name,
                    'peerSvmNames': [vp.get('peer', {}).get('svm', {}).get('name', '')],
                    'peerClusterNames': [peer_cluster_name],
                    'peerClusterIds': [peer_cluster_id]
                })
            else:
                existing[0]['peerSvmNames'].append(vp.get('peer', {}).get('svm', {}).get('name', ''))
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
            matched_dests = [sd for sd in snap_dests if sd.get('source', {}).get('path') == source_path]
            if not matched_dests:
                continue
            found_snapmirror = True
            for dest in matched_dests:
                dp = dest.get('destination', {}).get('path', '')
                if dp:
                    all_destination_paths.append(dp)
                dest_svm = dest.get('destination', {}).get('svm', {}).get('name', '')
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

const ORACLE_CRR_ASSESSMENT_SCRIPT = (instanceRecord: WorkloadInstance) => {
    const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
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

filesystemid="${fsxId}"
region="${instanceRecord.region}"

crrResults=$(${pythonScriptInit(
        crrPythonTemplate(fsxId, instanceRecord.region, svmNames, volumeNames),
        CRR_LOG_FILE_NAME
    )})

echo "$crrResults" >&3
`;
};

export { ORACLE_CRR_ASSESSMENT_SCRIPT };
