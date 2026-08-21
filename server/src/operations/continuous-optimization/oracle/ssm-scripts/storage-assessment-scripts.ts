import { WorkloadInstance } from '../../../../utils/common-types';
import { debugLog } from '../../../workloads/oracle/oracle-discover-scripts';
import {
    getOracleDefaultOrUserAuthCommand,
    checkCommandStatus,
    logFileCheck,
    pythonScriptInit,
    resolveOracleHomeInParent
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';
import { DirectOntapStorageAssessmentData } from '../storage-ontap-merge';

function toBase64(value: string): string {
    return Buffer.from(value).toString('base64');
}

const CHECK_ORACLE_FRA_RMAN_STATUS = () => `
    check_oracle_fra_rman_status() {
        local ec2InstanceId="$1"
        local oracleSid="$2"
        ${resolveOracleHomeInParent('$oracleSid', 'local fra_oracle_home')}
        local fra_rman_result
        fra_rman_result=$(sudo -i -u oracle bash <<EOF
        set -e
        export ORACLE_SID="$oracleSid"
        export ORACLE_HOME="$fra_oracle_home"
        export PATH="$fra_oracle_home/bin:\\$PATH"
        $sqlplus_command <<'EOSQL'
        SET HEADING OFF
        SET LINESIZE 500
        SET FEEDBACK OFF
        SET TERMOUT OFF
        SET PAGESIZE 0
        SET TRIMSPOOL ON
        WHENEVER SQLERROR EXIT SQL.SQLCODE
        SELECT CASE 
            WHEN value IS NOT NULL THEN 'yes'
            ELSE 'no'
        END
        FROM v\\$parameter WHERE name = 'db_recovery_file_dest';
        SELECT CASE
            WHEN COUNT(*) > 0 THEN 'yes'
            ELSE 'no'
        END
        FROM v\\$rman_configuration 
        WHERE value LIKE '%BACKUP TYPE TO COMPRESSED%';
        EXIT;
EOSQL
EOF
)

        echo "$fra_rman_result"

}
`;

const CHECK_ORACLE_DNFS_SERVERS = () => `
    check_oracle_dnfs_servers() {
        local ec2InstanceId="$1"
        local oracleSid="$2"
        ${resolveOracleHomeInParent('$oracleSid', 'local dnfs_oracle_home')}

        local dnfs_servers_result
        dnfs_servers_result=$(sudo -i -u oracle bash <<EOF
        set -e
        export ORACLE_SID="$oracleSid"
        export ORACLE_HOME="$dnfs_oracle_home"
        export PATH="$dnfs_oracle_home/bin:\\$PATH"
        $sqlplus_command <<'EOSQL'
        SET HEADING OFF
        SET LINESIZE 500
        SET FEEDBACK OFF
        SET TERMOUT OFF
        SET PAGESIZE 0
        SET TRIMSPOOL ON
        WHENEVER SQLERROR EXIT SQL.SQLCODE
        SELECT json_object(
            'svrname' VALUE svrname,
            'dirname' VALUE dirname,
            'nfsversion' VALUE Nfsversion
        ) as dnfs_server_info
        FROM v\\$dnfs_servers;
        EXIT;
EOSQL
EOF
)

# Parse DNFS result into JSON array - handle both empty and non-empty results
if [ -n "$dnfs_servers_result" ] && [ "$dnfs_servers_result" != "" ]; then
    # Check if result contains valid JSON objects
    dnfsServersData=$(echo "$dnfs_servers_result" | grep -v '^$' | while read -r line; do
        if [ -n "$line" ] && echo "$line" | jq -e . >/dev/null 2>&1; then
            echo "$line"
        fi
    done | jq -s .)
else
    dnfsServersData='[]'
fi

dnfsServers=$(jq -n \
    --arg error "" \
    --argjson dnfsServersData "$dnfsServersData" \
    '{
        error: $error,
        data: $dnfsServersData
    }')

echo "$dnfsServers"

}
`;

const VOLUME_LUN_CONFIGURATION = (
    instanceRecord: WorkloadInstance,
    ontapAssessmentData: DirectOntapStorageAssessmentData
) =>
    `
# Get Storage Configuration Assessment

${debugLog(`${LINUX_LOG_DIRECTORY}/storageassessment.log`)}

${checkCommandStatus}

# Ensure log directory exists
mkdir -p ${LINUX_LOG_DIRECTORY}

instanceName="${instanceRecord.name}"
filesystemid="${instanceRecord.fsxFileSystem}"
storageProtocol="${instanceRecord.storageProtocol}"
ec2InstanceId="${instanceRecord.activeNodeInstanceid}"
error=""

log "Starting storage assessment for instance: $instanceName"
log "Filesystem ID: $filesystemid, Protocol: $storageProtocol"

volumes=$(echo "${toBase64(ontapAssessmentData.volumesJson)}" | base64 -d)
log "Volumes data: $volumes"

if [ "$storageProtocol" = "iSCSI" ]; then
    luns=$(echo "${toBase64(ontapAssessmentData.lunsJson)}" | base64 -d)
    log "LUNs data: $luns"
else
    log "Protocol is not iSCSI, skipping LUN configuration"
    luns=$(jq -n '{error: "LUNs not applicable", data: []}')
fi

if [ "$storageProtocol" = "NFS" ]; then
    nfsProtocol=$(echo "${toBase64(ontapAssessmentData.nfsProtocolJson)}" | base64 -d)
    svmNfsRootonlyData=$(echo "${toBase64(ontapAssessmentData.nfsRootonlyJson)}" | base64 -d)
    log "NFS protocol data: $nfsProtocol"
else
    log "Storage protocol is not NFS, skipping NFS protocol configuration"
    nfsProtocol=$(jq -n '{error: "NFS protocol not applicable", data: {}}')
    svmNfsRootonlyData='[]'
fi

log "Starting Oracle binary volumes discovery"
${ORACLE_BINARY_VOLUMES_METADATA(instanceRecord.name)}
binaryVolumesData=$(find_oracle_binary_volumes)
log "Binary volumes discovery completed"



binaryVolumes=$(jq -n \
    --arg error "$error" \
    --argjson binaryVolumesData "$binaryVolumesData" \
    '{
        error: $error,
        data: $binaryVolumesData
    }')

log "Starting Oracle FRA and RMAN status check"
${getOracleDefaultOrUserAuthCommand(instanceRecord.activeNodeInstanceid, instanceRecord.id)}

${CHECK_ORACLE_FRA_RMAN_STATUS()}
fra_rman_result=$(check_oracle_fra_rman_status "${instanceRecord.activeNodeInstanceid}" "${instanceRecord.id}")
log "FRA/RMAN check result: $fra_rman_result"

# Parse the pipe-delimited result
fra_enabled=$(echo "$fra_rman_result" | sed -n '1p' | tr -d '[:space:]')
rman_compression_enabled=$(echo "$fra_rman_result" | sed -n '2p' | tr -d '[:space:]')

log "FRA enabled: $fra_enabled, RMAN compression: $rman_compression_enabled"

log "Starting Oracle DNFS servers check"
${CHECK_ORACLE_DNFS_SERVERS()}
dnfs_result=$(check_oracle_dnfs_servers "${instanceRecord.activeNodeInstanceid}" "${instanceRecord.id}")
log "DNFS servers check result: $dnfs_result"


# Create result with valid JSON
if [ "$storageProtocol" = "iSCSI"  ]; then
    log "Creating final result with LUNs included"
    result=$(jq -n \
        --arg fra "$fra_enabled" \\
        --arg rman "$rman_compression_enabled" \\
        --argjson volumes "$volumes" \
        --argjson luns "$luns" \
        --argjson binaryVolumes "$binaryVolumes" \
        '{
            fraEnabled: $fra,
            rmanCompressionEnabled: $rman,
            volumes: $volumes,
            luns: $luns,
            binaryVolumes: $binaryVolumes
        }')
else
    log "Creating final result without LUNs"
    result=$(jq -n \
        --arg fra "$fra_enabled" \\
        --arg rman "$rman_compression_enabled" \\
        --argjson volumes "$volumes" \
        --argjson binaryVolumes "$binaryVolumes" \
        --argjson nfsProtocol "$nfsProtocol" \
        --argjson dnfsServers "$dnfs_result" \
        --argjson svmNfsRootonlyData "$svmNfsRootonlyData" \
        '{
            fraEnabled: $fra,
            rmanCompressionEnabled: $rman,
            volumes: $volumes,
            binaryVolumes: $binaryVolumes,
            nfsRootonly: $svmNfsRootonlyData,
            nfsv4DomainData: $nfsProtocol,
            dnfsServers: $dnfsServers
        }')
fi

log "Storage assessment completed successfully for instance: $instanceName: FRA enabled: $fra_enabled, RMAN compression: $rman_compression_enabled, Volumes count: $(echo "$volumes" | jq '.data | length'), LUNs count: $(echo "$luns" | jq '.data | length // 0'), Binary volumes count: $(echo "$binaryVolumes" | jq '.data | length')"
# Output compact JSON
echo "$result" | jq -c . 
`;

const ORACLE_BINARY_VOLUMES_METADATA = (oracleSid: string) => `
# Oracle Binary Volumes Metadata for Oracle SID: ${oracleSid}
check_nfs_mount() {
    local path="$1"
    local fs_type=$(stat -f -c %T "$path" 2>/dev/null || true)
    [[ "$fs_type" == "nfs" ]] || [[ "$fs_type" == "nfs4" ]]
}

find_ebs_volume_info() {
    local device="$1"
    local all_volumes="$2"
    
    local ebs_volume=$(echo "$all_volumes" | jq --arg dev "$device" '.[] | select(.Device == $dev)' 2>/dev/null)
    
    if [[ -n "$ebs_volume" && "$ebs_volume" != "null" ]]; then
        local volume_id=$(echo "$ebs_volume" | jq -r '.VolumeId')
        local ebs_name=$(echo "$ebs_volume" | jq -r '.Name // empty')
        echo "$volume_id|$ebs_name"
    else
        local volume_id=$(blkid "$device" 2>/dev/null | grep -o 'PARTUUID="[^"]*"' | cut -d'"' -f2 || basename "$device")
        echo "$volume_id|"
    fi
}

find_oracle_binary_volumes() {
    local target_oracle_sid="${oracleSid}"
    log "Starting Oracle binary volumes discovery for SID: $target_oracle_sid"
    
    # Get EBS volumes for this instance
    local instance_id=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "")
    local all_volumes='[]'
    
    if [[ -n "$instance_id" ]] && command -v aws >/dev/null 2>&1; then
        all_volumes=$(aws ec2 describe-volumes \\
            --filters "Name=attachment.instance-id,Values=$instance_id" \\
            --query 'Volumes[].{VolumeId:VolumeId,Device:Attachments[0].Device,Name:Tags[?Key==\`Name\`].Value|[0]}' \\
            --output json 2>/dev/null || echo '[]')
    fi

    # Check if oratab exists
    if [[ ! -f "/etc/oratab" ]]; then
        log "Oracle oratab file not found at /etc/oratab"
        echo '[]'
        return
    fi

    log "Reading Oracle home from /etc/oratab for SID: $target_oracle_sid"
    
    # Get the first (and assumed only) Oracle home for the target SID
    local oracle_home=$(grep -v '^#' /etc/oratab 2>/dev/null | \\
        awk -F: -v sid="$target_oracle_sid" '$1 == sid && $2 != "N" && $2 != "" {print $2; exit}')
    
    if [[ -z "$oracle_home" ]]; then
        log "No Oracle home found for SID: $target_oracle_sid"
        echo '[]'
        return
    fi

    log "Found Oracle home: $oracle_home for SID: $target_oracle_sid"

    # Get filesystem info
    local df_output=$(df "$oracle_home" 2>/dev/null | tail -1)
    if [[ -z "$df_output" ]]; then
        log "Failed to get filesystem info for $oracle_home"
        echo '[]'
        return
    fi
    
    local device=$(echo "$df_output" | awk '{print $1}')
    local mount_point=$(echo "$df_output" | awk '{print $6}')
    local volume_name="root"
    local is_nfs="false"
    local has_binaries="false"
    
    log "Processing Oracle home: $oracle_home for SID: $target_oracle_sid, device: $device, mount: $mount_point"

    # Check NFS mount
    if check_nfs_mount "$mount_point"; then
        is_nfs="true"
        log "Detected NFS mount for $oracle_home"
    fi

    # Check Oracle binaries
    if [[ -f "$oracle_home/bin/oracle" || -f "$oracle_home/bin/sqlplus" || -f "$oracle_home/bin/lsnrctl" ]]; then
        has_binaries="true"
        log "Found Oracle binaries in $oracle_home"
    fi

    # Set volume name
    if [[ "$mount_point" != "/" ]]; then
        volume_name=$(basename "$mount_point")
    fi

    local result
    if [[ "$is_nfs" == "true" ]]; then
        # ONTAP identity (volume uuid/svm/export-policy) for this NFS-mounted volume name is resolved
        # server-side after this SSM command returns (see resolveBinaryVolumesNfsInfo) - volumeId and
        # nfsInfo are left blank/null here.
        result=$(jq -n \\
            --arg volumeId "" \\
            --arg volumeName "$volume_name" \\
            --arg oracleHome "$oracle_home" \\
            --argjson isNfsMount true \\
            --argjson hasBinaries $([ "$has_binaries" == "true" ] && echo true || echo false) \\
            --arg mountPath "$mount_point" \\
            --arg oracleSid "$target_oracle_sid" \\
            '[{
                "volumeId": $volumeId,
                "volumeName": $volumeName,
                "oracleHome": $oracleHome,
                "isNfsMount": $isNfsMount,
                "hasBinaries": $hasBinaries,
                "mountPath": $mountPath,
                "nfsInfo": null,
                "oracleSid": $oracleSid
            }]')
    else
        local volume_info=$(find_ebs_volume_info "$device" "$all_volumes")
        local volume_id=$(echo "$volume_info" | cut -d'|' -f1)
        local ebs_name=$(echo "$volume_info" | cut -d'|' -f2)
        
        if [[ -n "$ebs_name" && "$ebs_name" != "null" ]]; then
            volume_name="$ebs_name"
        fi
        
        result=$(jq -n \\
            --arg volumeId "$volume_id" \\
            --arg volumeName "$volume_name" \\
            --arg oracleHome "$oracle_home" \\
            --argjson isNfsMount false \\
            --argjson hasBinaries $([ "$has_binaries" == "true" ] && echo true || echo false) \\
            --arg oracleSid "$target_oracle_sid" \\
            '[{
                "volumeId": $volumeId,
                "volumeName": $volumeName,
                "oracleHome": $oracleHome,
                "isNfsMount": $isNfsMount,
                "hasBinaries": $hasBinaries,
                "mountPath": null,
                "nfsInfo": null,
                "oracleSid": $oracleSid
            }]')
    fi

    # Validate JSON
    if ! echo "$result" | jq -e . >/dev/null 2>&1; then
        log "Invalid JSON generated for Oracle home, returning empty array"
        echo '[]'
        return
    fi

    log "Successfully processed Oracle home for SID: $target_oracle_sid"
    echo "$result"
}
`;

const CHECK_SWAP_SPACE = `
def check_swap_space():
    err = None
    swapSizeInKb = 0
    ramSizeInKb = 0
    hugepagesSizeInKb = 0
    
    try:
        with open('/proc/meminfo', 'r') as f:
            for line in f:
                parts = line.strip().split()[:2]
                label = parts[0] if len(parts) >= 1 else ''
                value = parts[1] if len(parts) >= 2 else '0'
                if line.startswith('MemTotal:'):
                    ramSizeInKb = value
                elif line.startswith('SwapTotal:'):
                    swapSizeInKb = value
                elif line.startswith('Hugetlb:'):
                    hugepagesSizeInKb = value

    except (IOError, OSError):
        err = "File /proc/meminfo not found"
    except Exception as e:
        err = str(e)
    finally:
        if err:
            return {"error": err}
        return {
            "ramSizeInKb": ramSizeInKb,
            "swapSizeInKb": swapSizeInKb,
            "hugepagesSizeInKb": hugepagesSizeInKb
        }
`;

const storageSizingAssessmentTemplate = `
${CHECK_SWAP_SPACE}

results = {"sizing": {}}
results['sizing']["swapSpace"] = check_swap_space()

print(json.dumps(results))
`;

const ORACLE_STORAGE_SIZING_ASSESSMENT = `#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(storageSizingAssessmentTemplate, 'wlmdb-storage-sizing-assessment.log')}
`;

export { VOLUME_LUN_CONFIGURATION, ORACLE_STORAGE_SIZING_ASSESSMENT, CHECK_SWAP_SPACE };
