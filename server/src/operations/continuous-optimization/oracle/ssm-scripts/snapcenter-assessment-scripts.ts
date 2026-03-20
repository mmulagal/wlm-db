import { WorkloadInstance } from '../../../../utils/common-types';
import {
    checkCommandStatus,
    logFileCheck,
    pythonScriptInit,
    getFsxCredentials,
    ontapRestApiScript,
    getOracleHomePath,
    parseSpfileProperties
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const SNAPCENTER_LOG_FILE = `${LINUX_LOG_DIRECTORY}/snapcenter-assessment.log`;
const SNAPCENTER_LOG_FILE_NAME = 'snapcenter-assessment.log';

const snapcenterPythonTemplate = (
    fsxId: string,
    region: string,
    instanceName: string,
    volumeNames: string[],
    volumeUuids: string[]
) => `
${getFsxCredentials}
${ontapRestApiScript}

filesystemid = '${fsxId}'
region = '${region}'
instance_name = '${instanceName}'
volume_names = json.loads('${JSON.stringify(volumeNames)}')
volume_uuids = json.loads('${JSON.stringify(volumeUuids)}')

log("Starting SnapCenter snapshot assessment")
log(f"FSx ID: {filesystemid}, Region: {region}, Instance: {instance_name}")
log(f"Volume names: {volume_names}, Volume UUIDs: {volume_uuids}")

uuid_filter = '|'.join(volume_uuids)
volume_info_url = f'storage/volumes?uuid={uuid_filter}&fields=svm'
log(f"Fetching volume SVM info: {volume_info_url}")
volume_info_data, vol_err = ontapRestApiRequest(filesystemid, region, 'GET', volume_info_url)
if vol_err:
    log(f"Warning: Failed to fetch volume SVM info: {vol_err}")
    volume_info_data = {'records': []}

svm_lookup = {}
for rec in volume_info_data.get('records', []):
    uid = rec.get('uuid', '')
    svm_lookup[uid] = {
        'svmId': rec.get('svm', {}).get('uuid', ''),
        'svmName': rec.get('svm', {}).get('name', '')
    }

volumes = []
for i, vol_uuid in enumerate(volume_uuids):
    vol_name = volume_names[i] if i < len(volume_names) else ''
    log(f"Checking SnapCenter snapshots for volume: {vol_name} ({vol_uuid})")

    svm_info = svm_lookup.get(vol_uuid, {})
    svm_id = svm_info.get('svmId', '')
    svm_name = svm_info.get('svmName', '')

    has_snapcenter = False
    snap_url = f'storage/volumes/{vol_uuid}/snapshots?comment=creator%3Dsnapcenter&max_records=1&fields=comment'
    snap_data, snap_err = ontapRestApiRequest(filesystemid, region, 'GET', snap_url)
    if snap_err:
        log(f"Warning: Failed to fetch snapshots for volume {vol_name}: {snap_err}")
    elif snap_data:
        record_count = snap_data.get('num_records', 0)
        if record_count > 0:
            has_snapcenter = True
            log(f"Found SnapCenter snapshot for volume {vol_name}")
        else:
            log(f"No SnapCenter snapshot found for volume {vol_name}")
    else:
        log(f"Empty response from snapshot API for volume {vol_name}")

    volumes.append({
        'svmId': svm_id,
        'svmName': svm_name,
        'volumeId': vol_uuid,
        'volumeName': vol_name,
        'hasSnapcenterSnapshot': has_snapcenter,
        'foundInSnapcenterLogs': False
    })

log("Checking standalone SnapCenter plugin service")
plugin_running = False
try:
    spl_check = subprocess.run(['systemctl', 'is-active', 'spl'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    snapcenter_check = subprocess.run(['systemctl', 'is-active', 'snapcenter_spl'],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    plugin_running = spl_check.returncode == 0 or snapcenter_check.returncode == 0
    log(f"SnapCenter plugin service: spl={'active' if spl_check.returncode == 0 else 'inactive'}, snapcenter_spl={'active' if snapcenter_check.returncode == 0 else 'inactive'}")
except Exception as e:
    log(f"Error checking SnapCenter plugin services: {e}")

sid_found_in_logs = False
sc_log_path = '/var/opt/snapcenter/spl/logs'

if plugin_running and os.path.isdir(sc_log_path):
    try:
        import time as _time
        cutoff = _time.time() - 48 * 3600
        recent_logs = []
        for f in os.listdir(sc_log_path):
            fpath = os.path.join(sc_log_path, f)
            if f.endswith('.log') and os.path.isfile(fpath):
                try:
                    if os.path.getmtime(fpath) >= cutoff:
                        recent_logs.append(fpath)
                except OSError:
                    pass

        if recent_logs:
            log(f"Found {len(recent_logs)} SnapCenter log files modified in last 48h")
            sid_grep = subprocess.run(['grep', '-l', instance_name] + recent_logs,
                                      capture_output=True, text=True, timeout=30)
            sid_found_in_logs = sid_grep.returncode == 0
            log(f"SID '{instance_name}' {'found' if sid_found_in_logs else 'not found'} in recent logs")

            if sid_found_in_logs:
                for vol in volumes:
                    vname = vol['volumeName']
                    vol_grep = subprocess.run(['grep', '-l', vname] + recent_logs,
                                              capture_output=True, text=True, timeout=30)
                    vol['foundInSnapcenterLogs'] = vol_grep.returncode == 0
                    log(f"Volume '{vname}' {'found' if vol['foundInSnapcenterLogs'] else 'not found'} in recent logs")
        else:
            log("No SnapCenter log files modified in last 48h")
    except Exception as e:
        log(f"Error during SnapCenter log check: {e}")
else:
    log(f"Skipping log check: plugin_running={plugin_running}, log_path_exists={os.path.isdir(sc_log_path)}")

output = {
    'isDataguardPrimary': False,
    'volumes': volumes,
    'standaloneCheck': {
        'pluginServiceRunning': plugin_running,
        'sidFoundInLogs': sid_found_in_logs
    },
    'errorMessage': ''
}
log(f"SnapCenter assessment complete: {json.dumps(output)}")
print(json.dumps(output))
`;

const dataguardPrimaryCheck = (instanceName: string) => `
# DataGuard primary check
is_dataguard_primary="false"

check_dataguard() {
    local ORACLE_SID="$1"
    sudo -i -u oracle bash -s -- "$ORACLE_SID" <<'DGEOF'
        export ORACLE_SID="$1"
        oracle_home=$(${getOracleHomePath('$ORACLE_SID')})
        if [ -z "$oracle_home" ] || [ ! -d "$oracle_home" ]; then
            exit 1
        fi
        export ORACLE_HOME="$oracle_home"
        spFilePath="$ORACLE_HOME/dbs/spfile$ORACLE_SID.ora"
        if [ ! -f "$spFilePath" ]; then
            spFilePath="$ORACLE_BASE/dbs/spfile$ORACLE_SID.ora"
        fi
        if [ ! -f "$spFilePath" ]; then
            exit 1
        fi
        falClient="${parseSpfileProperties('fal_client', '$spFilePath')}"
        falServer="${parseSpfileProperties('fal_server', '$spFilePath')}"
        logArchiveConfig="$(strings "$spFilePath" | grep -i "\\.log_archive_config" | sed "s/^[^=]*=//;s/'//g" | head -n1)"
        if [[ ( -n "$falClient" && -n "$falServer" && "$falServer" != "$falClient" ) || ( -z "$falClient" && -n "$falServer" ) || ( -n "$falClient" && -z "$falServer" ) || ( -n "$logArchiveConfig" && "$logArchiveConfig" == *"DG_CONFIG"* ) ]]; then
            exit 0
        fi
        exit 1
DGEOF
    return $?
}

echo "Checking DataGuard status for ${instanceName}" >> ${SNAPCENTER_LOG_FILE}
if check_dataguard "${instanceName}" 2>/dev/null; then
    echo "DataGuard is configured for ${instanceName}" >> ${SNAPCENTER_LOG_FILE}
    proc_pattern="ora_(mrp|pr)[0-9]+_${instanceName}"
    if pgrep -f "$proc_pattern" >/dev/null 2>&1; then
        echo "MRP/PR processes found - this is a standby instance" >> ${SNAPCENTER_LOG_FILE}
    else
        echo "No MRP/PR processes - this is a DataGuard primary, skipping assessment" >> ${SNAPCENTER_LOG_FILE}
        is_dataguard_primary="true"
    fi
else
    echo "DataGuard is not configured for ${instanceName}" >> ${SNAPCENTER_LOG_FILE}
fi

if [ "$is_dataguard_primary" == "true" ]; then
    echo '{"isDataguardPrimary":true,"volumes":[],"standaloneCheck":{"pluginServiceRunning":false,"sidFoundInLogs":false},"errorMessage":""}' >&3
    exit 0
fi
`;

const SNAPCENTER_ASSESSMENT_SCRIPT = (instanceRecord: WorkloadInstance) => {
    const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
    const volumeNames = instanceRecord.mappedVolumeNames || [];
    const volumeUuids = instanceRecord.mappedVolumesUuids || [];

    return `#!/bin/bash
set -euo pipefail

${logFileCheck()}
exec 3>&1
exec >> ${SNAPCENTER_LOG_FILE} 2>&1
echo "=== SnapCenter Assessment started at $(date -u) ==="

${checkCommandStatus}

${dataguardPrimaryCheck(instanceRecord.name)}

scResult=$(${pythonScriptInit(
        snapcenterPythonTemplate(fsxId, instanceRecord.region, instanceRecord.name, volumeNames, volumeUuids),
        SNAPCENTER_LOG_FILE_NAME
    )})

echo "$scResult" >&3
`;
};

export { SNAPCENTER_ASSESSMENT_SCRIPT };
