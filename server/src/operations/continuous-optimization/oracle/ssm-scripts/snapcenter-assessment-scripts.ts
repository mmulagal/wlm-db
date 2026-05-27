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

/**
 * Shared Python core for the SnapCenter assessment. Defines `collect_snapcenter_assessment`
 * plus internal helpers — used by both the online flow's `snapcenterPythonTemplate` and the
 * one-time WAD's `snapcenterAssessmentWadFunction`. Each call site supplies:
 *   - `ontap_get(endpoint) -> dict` — wraps that context's ONTAP REST helper; must raise on error.
 *   - `log_warn(msg) -> None`       — wraps that context's logger.
 */
const snapcenterCorePython = `
def _sc_fetch_svm_lookup(ontap_get, volume_uuids, log_warn):
    svm_lookup = {}
    try:
        uuid_filter = '|'.join(volume_uuids)
        data = ontap_get("storage/volumes?uuid={}&fields=svm".format(uuid_filter))
        for rec in (data or {}).get("records", []):
            uid = rec.get("uuid", "")
            svm_lookup[uid] = {
                "svmId": rec.get("svm", {}).get("uuid", ""),
                "svmName": rec.get("svm", {}).get("name", "")
            }
    except Exception as e:
        log_warn("Failed to fetch volume SVM info for SnapCenter: {}".format(e))
    return svm_lookup


def _sc_volume_has_snapcenter_snapshot(ontap_get, vol_uuid, vol_name, log_warn):
    try:
        url = "storage/volumes/{}/snapshots?comment=creator%3Dsnapcenter&max_records=1&fields=comment".format(vol_uuid)
        data = ontap_get(url)
        return bool(data and data.get("num_records", 0) > 0)
    except Exception as e:
        log_warn("Failed to fetch SnapCenter snapshots for volume {}: {}".format(vol_name, e))
        return False


def _sc_check_plugin_running(log_warn):
    try:
        spl_check = subprocess.call(["systemctl", "is-active", "spl"],
                                    stdout=open(os.devnull, "wb"), stderr=open(os.devnull, "wb"))
        snapcenter_check = subprocess.call(["systemctl", "is-active", "snapcenter_spl"],
                                           stdout=open(os.devnull, "wb"), stderr=open(os.devnull, "wb"))
        return (spl_check == 0) or (snapcenter_check == 0)
    except Exception as e:
        log_warn("Error checking SnapCenter plugin services: {}".format(e))
        return False


def _sc_scan_logs(oracle_sid, snapcenter_volumes, log_warn):
    sid_found_in_logs = False
    sc_log_path = "/var/opt/snapcenter/spl/logs"
    if not os.path.isdir(sc_log_path):
        return sid_found_in_logs
    try:
        import time as _time
        cutoff = _time.time() - 48 * 3600
        recent_logs = []
        for f in os.listdir(sc_log_path):
            fpath = os.path.join(sc_log_path, f)
            if f.endswith(".log") and os.path.isfile(fpath):
                try:
                    if os.path.getmtime(fpath) >= cutoff:
                        recent_logs.append(fpath)
                except OSError:
                    pass
        if recent_logs:
            sid_grep = subprocess.call(["grep", "-l", oracle_sid] + recent_logs,
                                       stdout=open(os.devnull, "wb"), stderr=open(os.devnull, "wb"))
            sid_found_in_logs = sid_grep == 0
            if sid_found_in_logs:
                for vol in snapcenter_volumes:
                    log_key = vol.get("logKey", "")
                    search_key = log_key if log_key else vol["volumeName"]
                    vol_grep = subprocess.call(["grep", "-l", search_key] + recent_logs,
                                               stdout=open(os.devnull, "wb"), stderr=open(os.devnull, "wb"))
                    vol["foundInSnapcenterLogs"] = vol_grep == 0
    except Exception as e:
        log_warn("Error during SnapCenter log check: {}".format(e))
    return sid_found_in_logs


def collect_snapcenter_assessment(ontap_get, oracle_sid, volume_uuids, volume_names, volume_log_keys, log_warn):
    if not volume_uuids:
        return {}

    svm_lookup = _sc_fetch_svm_lookup(ontap_get, volume_uuids, log_warn)

    snapcenter_volumes = []
    for i, vol_uuid in enumerate(volume_uuids):
        vol_name = volume_names[i] if i < len(volume_names) else ""
        vol_log_key = volume_log_keys[i] if i < len(volume_log_keys) else ""
        svm_info = svm_lookup.get(vol_uuid, {})
        has_snapcenter = _sc_volume_has_snapcenter_snapshot(ontap_get, vol_uuid, vol_name, log_warn)
        snapcenter_volumes.append({
            "svmId": svm_info.get("svmId", ""),
            "svmName": svm_info.get("svmName", ""),
            "volumeId": vol_uuid,
            "volumeName": vol_name,
            "hasSnapcenterSnapshot": has_snapcenter,
            "foundInSnapcenterLogs": False,
            "logKey": vol_log_key
        })

    plugin_running = _sc_check_plugin_running(log_warn)
    sid_found_in_logs = _sc_scan_logs(oracle_sid, snapcenter_volumes, log_warn) if plugin_running else False

    for vol in snapcenter_volumes:
        vol.pop("logKey", None)

    return {
        "isDataguardPrimary": False,
        "volumes": snapcenter_volumes,
        "standaloneCheck": {
            "pluginServiceRunning": plugin_running,
            "sidFoundInLogs": sid_found_in_logs
        },
        "errorMessage": ""
    }
`;

const snapcenterPythonTemplate = (
    fsxId: string,
    region: string,
    instanceName: string,
    volumeNames: string[],
    volumeUuids: string[],
    volumeLogKeys: string[]
) => `
${getFsxCredentials}
${ontapRestApiScript}

filesystemid = '${fsxId}'
region = '${region}'
instance_name = '${instanceName}'
volume_names = json.loads('${JSON.stringify(volumeNames)}')
volume_uuids = json.loads('${JSON.stringify(volumeUuids)}')
volume_log_keys = json.loads('${JSON.stringify(volumeLogKeys)}')

log("Starting SnapCenter snapshot assessment")
log("FSx ID: {}, Region: {}, Instance: {}".format(filesystemid, region, instance_name))
log("Volume names: {}, Volume UUIDs: {}".format(volume_names, volume_uuids))
log("Volume log keys: {}".format(volume_log_keys))

# Adapter: ontapRestApiRequest returns (data, error); collect_snapcenter_assessment expects raise-on-error.
def _ontap_get(endpoint):
    data, err = ontapRestApiRequest(filesystemid, region, 'GET', endpoint)
    if err:
        raise Exception(err)
    return data

def _log_warn(msg):
    log("Warning: " + msg)

${snapcenterCorePython}

output = collect_snapcenter_assessment(_ontap_get, instance_name, volume_uuids, volume_names, volume_log_keys, _log_warn)
log("SnapCenter assessment complete: {}".format(json.dumps(output)))
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
    const volumeLogKeys =
        instanceRecord.storageProtocol === 'iSCSI'
            ? instanceRecord.mappedVolumeLunPaths || []
            : instanceRecord.mappedVolumeJunctionPaths || [];

    return `#!/bin/bash
set -euo pipefail

${logFileCheck()}
exec 3>&1
exec >> ${SNAPCENTER_LOG_FILE} 2>&1
echo "=== SnapCenter Assessment started at $(date -u) ==="

${checkCommandStatus}

${dataguardPrimaryCheck(instanceRecord.name)}

scResult=$(${pythonScriptInit(
        snapcenterPythonTemplate(
            fsxId,
            instanceRecord.region,
            instanceRecord.name,
            volumeNames,
            volumeUuids,
            volumeLogKeys
        ),
        SNAPCENTER_LOG_FILE_NAME
    )})

echo "$scResult" >&3
`;
};

/**
 * Module-level Python function for the SnapCenter assessment, adapted for the Oracle
 * one-time WAD context.
 *
 * Return value matches `SnapcenterAssessmentData`. Surrounding code is expected to attach
 */
const snapcenterAssessmentWadFunction = `
${snapcenterCorePython}

def collect_snapcenter_assessment_wad(ontap_config, oracle_sid, is_dataguard_primary, volume_uuids, volume_names, volume_log_keys):
    try:
        if is_dataguard_primary:
            log_info("Skipping SnapCenter assessment - DataGuard primary node")
            return {
                "isDataguardPrimary": True,
                "volumes": [],
                "standaloneCheck": {"pluginServiceRunning": False, "sidFoundInLogs": False},
                "errorMessage": ""
            }

        if not volume_uuids:
            log_info("Skipping SnapCenter assessment - no mapped volume UUIDs available")
            return {}

        log_info("Collecting SnapCenter snapshot assessment data...")

        # Adapter: ontap_request already raises on error, so wrap it unchanged.
        def _ontap_get(endpoint):
            return ontap_request(ontap_config, "GET", endpoint)

        result = collect_snapcenter_assessment(_ontap_get, oracle_sid, volume_uuids, volume_names, volume_log_keys, log_warning)
        standalone = result.get("standaloneCheck", {})
        log_info("SnapCenter assessment: {} volumes, plugin_running={}, sid_found_in_logs={}".format(
            len(result.get("volumes", [])),
            standalone.get("pluginServiceRunning", False),
            standalone.get("sidFoundInLogs", False)))
        return result
    except Exception as snapcenter_err:
        log_warning("Failed to collect SnapCenter assessment data: {}".format(snapcenter_err))
        return {}
`;

export { SNAPCENTER_ASSESSMENT_SCRIPT, snapcenterAssessmentWadFunction };
