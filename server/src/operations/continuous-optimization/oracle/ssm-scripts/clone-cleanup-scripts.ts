import { checkCommandStatus, pythonScriptInit, logFileCheck } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const CLONE_CLEANUP_LOG_FILE = `${LINUX_LOG_DIRECTORY}/clone-cleanup.log`;
const CLONE_CLEANUP_LOG_FILE_NAME = 'clone-cleanup.log';

interface OracleCloneCleanupParams {
    junctionPaths: string[];
    protocol: string;
    cloneDatabaseName: string;
}

const cloneCleanupPythonTemplate = (params: OracleCloneCleanupParams) => `
clone_junction_paths = ${JSON.stringify(params.junctionPaths)}
protocol = ${JSON.stringify(params.protocol)}
clone_database_name = ${JSON.stringify(params.cloneDatabaseName)}

log("Starting Oracle clone cleanup")
log(f"Protocol: {protocol}")
log(f"Clone junction paths: {clone_junction_paths}")
log(f"Clone database name (SID): {clone_database_name}")

# Step 1: Shutdown Oracle clone DB using clone SID
log("Step 1: Shutting down Oracle clone database")
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

# Step 2: NFS unmount clone volumes (only if protocol != 'iSCSI')
unmounted_mount_points = []
if protocol != 'iSCSI':
    log("Step 2: Unmounting clone NFS mount points")
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
    log("Step 2: Skipping NFS unmount (protocol is iSCSI)")

# Step 3: Cleanup unmounted clone mount directories
log("Step 3: Cleaning up unmounted clone mount directories")
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

# Step 4: Print final result
result = json.dumps({"status": "success", "unmountedPaths": unmounted_mount_points, "cleanedPaths": cleaned_paths})
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

cloneCleanupResults=$(${pythonScriptInit(cloneCleanupPythonTemplate(params), CLONE_CLEANUP_LOG_FILE_NAME)})

echo "$cloneCleanupResults" >&3
`;
}

export { buildCloneCleanupScript, OracleCloneCleanupParams };
