import {
    checkCommandStatus,
    pythonScriptInit,
    getFsxCredentials,
    ontapRestApiScript,
    logFileCheck
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const CLONE_CLEANUP_LOG_FILE = `${LINUX_LOG_DIRECTORY}/clone-cleanup.log`;
const CLONE_CLEANUP_LOG_FILE_NAME = 'clone-cleanup.log';

interface OracleCloneCleanupParams {
    fsxId: string;
    region: string;
    volumeUuids: string[];
    protocol: string;
    cloneDatabaseName: string;
}

const cloneCleanupPythonTemplate = (params: OracleCloneCleanupParams) => `
${getFsxCredentials}
${ontapRestApiScript}

filesystemid = ${JSON.stringify(params.fsxId)}
region = ${JSON.stringify(params.region)}
volume_uuids = ${JSON.stringify(params.volumeUuids)}
protocol = ${JSON.stringify(params.protocol)}
clone_database_name = ${JSON.stringify(params.cloneDatabaseName)}

log("Starting Oracle clone cleanup")
log(f"FSx ID: {filesystemid}, Region: {region}, Protocol: {protocol}")
log(f"Volume UUIDs: {volume_uuids}")
log(f"Clone database name (SID): {clone_database_name}")

deleted_volumes = []

# Step 1: Query junction paths for each clone volume from ONTAP REST API
log("Step 1: Fetching junction paths for clone volumes from ONTAP")
clone_junction_paths = []
for vol_uuid in volume_uuids:
    try:
        endpoint = f"storage/volumes/{vol_uuid}?fields=nas.path,name"
        vol_response, vol_error = ontapRestApiRequest(filesystemid, region, 'GET', endpoint)
        if vol_error:
            log(f"Warning: Failed to fetch volume details for {vol_uuid}: {vol_error}")
            continue
        nas_path = vol_response.get('nas', {}).get('path', '') if vol_response else ''
        vol_name = vol_response.get('name', '') if vol_response else ''
        if nas_path:
            clone_junction_paths.append(nas_path)
            log(f"Volume {vol_uuid} ({vol_name}): junction path = {nas_path}")
        else:
            log(f"Warning: No junction path found for volume {vol_uuid} ({vol_name})")
    except Exception as e:
        log(f"Warning: Exception fetching junction path for volume {vol_uuid}: {e}")

log(f"Resolved clone junction paths: {clone_junction_paths}")

# Step 2: Shutdown Oracle clone DB using clone SID
log("Step 2: Shutting down Oracle clone database")
try:
    oratab_home = None
    if os.path.isfile('/etc/oratab'):
        with open('/etc/oratab', 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#') or line.startswith('+') or not line:
                    continue
                parts = line.split(':')
                if len(parts) >= 2 and parts[0] == clone_database_name:
                    oratab_home = parts[1]
                    break

    if oratab_home and os.path.isdir(oratab_home):
        if not re.match(r'^[a-zA-Z0-9_]+$', clone_database_name):
            raise Exception(f"Invalid clone database name: {clone_database_name}")
        shutdown_sql = "SHUTDOWN ABORT;"
        shutdown_cmd = f'export ORACLE_SID={clone_database_name}; export ORACLE_HOME={oratab_home}; export PATH={oratab_home}/bin:$PATH; echo "{shutdown_sql}" | sqlplus -S / as sysdba'
        result = subprocess.run(
            ['sudo', '-i', '-u', 'oracle', 'bash', '-c', shutdown_cmd],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            log(f"Warning: Oracle shutdown returned non-zero exit code: {result.returncode}. stderr: {result.stderr}")
        else:
            log("Oracle clone database shutdown completed")
    else:
        log(f"Warning: Could not resolve ORACLE_HOME for SID {clone_database_name} from /etc/oratab, skipping shutdown")
except Exception as e:
    log(f"Warning: Failed to shutdown Oracle clone database: {e}")

def resolve_nfs_mount_point(junction_path):
    """Resolve ONTAP junction path to local Linux mount point via /proc/mounts."""
    if not junction_path or not os.path.isfile('/proc/mounts'):
        return None
    try:
        with open('/proc/mounts', 'r') as mounts_file:
            for mount_line in mounts_file:
                mount_parts = mount_line.strip().split()
                if len(mount_parts) < 3:
                    continue
                source = mount_parts[0]
                mount_point = mount_parts[1]
                fs_type = mount_parts[2]
                if fs_type not in ('nfs', 'nfs4'):
                    continue
                source_path = source.split(':', 1)[1] if ':' in source else source
                if source_path == junction_path or source_path.endswith(junction_path):
                    return mount_point
    except Exception as e:
        log(f"Warning: Failed to inspect /proc/mounts for junction path {junction_path}: {e}")
    return None

# Step 3: NFS unmount clone volumes (only if protocol != 'iSCSI')
unmounted_mount_points = []
if protocol != 'iSCSI':
    log("Step 3: Unmounting clone NFS mount points")
    for jp in clone_junction_paths:
        try:
            mount_point = resolve_nfs_mount_point(jp)
            if not mount_point:
                log(f"Warning: No local NFS mount point found for ONTAP junction path {jp}, skipping unmount")
            else:
                umount_result = subprocess.run(
                    ['umount', '-f', mount_point],
                    capture_output=True, text=True, timeout=60
                )
                if umount_result.returncode != 0:
                    log(f"Warning: Failed to unmount {mount_point} for junction path {jp}: {umount_result.stderr}")
                else:
                    unmounted_mount_points.append(mount_point)
                    log(f"Unmounted clone volume mount point {mount_point} for junction path {jp}")
        except Exception as e:
            log(f"Warning: Exception unmounting junction path {jp}: {e}")
else:
    log("Step 3: Skipping NFS unmount (protocol is iSCSI)")

# Step 4: ONTAP-side unmount clone volumes (only if protocol != 'iSCSI')
if protocol != 'iSCSI':
    log("Step 4: Clearing ONTAP NAS paths for clone volumes")
    for vol_uuid in volume_uuids:
        try:
            endpoint = f"storage/volumes/{vol_uuid}"
            body = {"nas": {"path": ""}}
            response, error = ontapRestApiRequest(filesystemid, region, 'PATCH', endpoint, body)
            if error:
                log(f"Warning: Failed to clear NAS path for volume {vol_uuid}: {error}")
            else:
                log(f"Cleared NAS path for clone volume {vol_uuid}")
        except Exception as e:
            log(f"Warning: Exception clearing NAS path for volume {vol_uuid}: {e}")
else:
    log("Step 4: Skipping ONTAP NAS path clearing (protocol is iSCSI)")

# Step 5: ONTAP volume DELETE
log("Step 5: Deleting ONTAP clone volumes")
for vol_uuid in volume_uuids:
    endpoint = f"storage/volumes/{vol_uuid}"
    response, error = ontapRestApiRequest(filesystemid, region, 'DELETE', endpoint)
    if error:
        raise Exception(f"Failed to delete clone volume {vol_uuid}: {error}")

    if not response or 'job' not in response:
        raise Exception(f"ONTAP DELETE for volume {vol_uuid} returned no job — cannot confirm deletion")

    job_uuid = response['job'].get('uuid')
    if not job_uuid:
        raise Exception(f"ONTAP DELETE for volume {vol_uuid} returned job without UUID — cannot confirm deletion")

    log(f"Polling job {job_uuid} for clone volume {vol_uuid} deletion")
    max_poll_attempts = 90
    poll_attempt = 0
    while poll_attempt < max_poll_attempts:
        poll_attempt += 1
        time.sleep(10)
        job_endpoint = f"cluster/jobs/{job_uuid}"
        job_response, job_error = ontapRestApiRequest(filesystemid, region, 'GET', job_endpoint)
        if job_error:
            raise Exception(f"Failed to poll job status for clone volume {vol_uuid}: {job_error}")

        job_state = job_response.get('state', '')
        log(f"Job {job_uuid} state: {job_state} (attempt {poll_attempt}/{max_poll_attempts})")

        if job_state == 'success':
            log(f"Clone volume {vol_uuid} deleted successfully")
            break
        elif job_state == 'failure':
            job_message = job_response.get('message', 'Unknown error')
            raise Exception(f"Clone volume {vol_uuid} deletion failed: {job_message}")
    else:
        raise Exception(f"Timed out waiting for clone volume {vol_uuid} deletion job {job_uuid} after {max_poll_attempts} attempts (15 min)")

    deleted_volumes.append(vol_uuid)
    log(f"Clone volume {vol_uuid} deletion confirmed")

# Step 6: Cleanup confirmed unmounted clone mount directories
log("Step 6: Cleaning up unmounted clone mount directories")
cleaned_paths = []
for mp in unmounted_mount_points:
    if not mp or mp == '/' or not os.path.isabs(mp):
        log(f"Warning: Skipping unsafe path for removal: {mp}")
    else:
        try:
            subprocess.run(['rm', '-rf', mp], capture_output=True, text=True, timeout=60)
            cleaned_paths.append(mp)
            log(f"Removed clone mount directory {mp}")
        except Exception as e:
            log(f"Warning: Failed to remove directory {mp}: {e}")

# Step 7: Print final result
result = json.dumps({"status": "success", "deletedVolumes": deleted_volumes, "cleanedPaths": cleaned_paths})
log(f"Clone cleanup completed: {result}")
print(result)
`;

function buildCloneCleanupScript(params: OracleCloneCleanupParams) {
    return `#!/bin/bash
set -euo pipefail

${logFileCheck()}
exec 3>&1
exec >> ${CLONE_CLEANUP_LOG_FILE} 2>&1
echo "=== Clone Cleanup started at $(date -u) ==="

${checkCommandStatus}

filesystemid="${params.fsxId}"
region="${params.region}"

cloneCleanupResults=$(${pythonScriptInit(cloneCleanupPythonTemplate(params), CLONE_CLEANUP_LOG_FILE_NAME)})

echo "$cloneCleanupResults" >&3
`;
}

export { buildCloneCleanupScript, OracleCloneCleanupParams };
