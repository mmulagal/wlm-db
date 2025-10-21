import { WorkloadInstance } from '../../../utils/common-types';
import { debugLog } from './oracle-discover-scripts';
import { checkCommandStatus, getOracleDefaultOrUserAuthCommand, ontapRestApi } from './oracle-ssm-script-utils';

const CHECK_ORACLE_FRA_RMAN_STATUS = (ec2InstanceId: string, dbSid: string) => `
    check_oracle_fra_rman_status() {
        local ec2InstanceId="$1"
        local oracleSid="$2"

        ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
        local fra_rman_result
        fra_rman_result=$(sudo -i -u oracle bash <<EOF
        set -e
        export ORACLE_SID="$oracleSid"
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

const CHECK_ORACLE_DNFS_SERVERS = (ec2InstanceId: string, dbSid: string) => `
    check_oracle_dnfs_servers() {
        local ec2InstanceId="$1"
        local oracleSid="$2"

        ${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
        local dnfs_servers_result
        dnfs_servers_result=$(sudo -i -u oracle bash <<EOF
        set -e
        export ORACLE_SID="$oracleSid"
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

const VOLUME_LUN_CONFIGURATION = (instanceRecord: WorkloadInstance) =>
    `
# Get Storage Configuration Assessment

${debugLog('/var/log/netapp/storageassessment.log')}

${checkCommandStatus}

# Ensure log directory exists
mkdir -p /var/log/netapp

instanceName="${instanceRecord.name}"
filesystemid="${instanceRecord.fsxFileSystem}"
region="${instanceRecord.region}"
storageProtocol="${instanceRecord.storageProtocol}"
ec2InstanceId="${instanceRecord.activeNodeInstanceid}"

log "Starting storage assessment for instance: $instanceName"
log "Filesystem ID: $filesystemid, Region: $region, Protocol: $storageProtocol"

IFS=',' read -r -a mappedOntapVolumeNames <<< "${instanceRecord.mappedVolumeNames}"
IFS=',' read -r -a mappedOntapVolumeUuids <<< "${instanceRecord.mappedVolumesUuids}"
IFS=',' read -r -a ontapSvmUuids <<< "${instanceRecord.svmOntapUuid}"
IFS=',' read -r -a ontapSvmNames <<< "${instanceRecord.svmOntapName}"

log "Mapped volume names: $mappedOntapVolumeNames"
log "Mapped volume UUIDs: $mappedOntapVolumeUuids"
log "ONTAP SVM UUIDs: $ontapSvmUuids"

if [ "$storageProtocol" != "iSCSI" ]; then
    mappedOntapLunNames=()
    mappedOntapLunUuids=()
    log "Protocol is not iSCSI, skipping LUN configuration"
else
    IFS=',' read -r -a mappedOntapLunNames <<< "${instanceRecord.mappedLunNames}"
    IFS=',' read -r -a mappedOntapLunUuids <<< "${instanceRecord.mappedLunUuids}"
    log "iSCSI protocol detected. LUN names: $mappedOntapLunNames"
    log "LUN UUIDs: $mappedOntapLunUuids"
fi

${ontapRestApi}

if [ -z "\${mappedOntapVolumeUuids[*]}" ]; then
    error="Unable to fetch ONTAP volumes details as the mapped volume UUIDs are either null or empty."
    log "ERROR: No mapped volume UUIDs found"
    
    # Create error result and exit
    result=$(jq -n \
        --arg error "$error" \
        --arg filesystemId "$filesystemid" \
        '{
            volumes: {
                error: $error,
                filesystemId: $filesystemId,
                data: []
            }
        }')
    echo "$result" | jq -c .
    exit 1
fi

volumeEndpoint="storage/volumes?uuid=$(IFS='|'; echo "\${mappedOntapVolumeUuids[*]}")&fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,space.snapshot.autodelete.delete_order,snapshot_policy,tiering,guarantee,efficiency"
log "Calling ONTAP API endpoint: $volumeEndpoint"

response=$(ontap_request 'GET' $volumeEndpoint)
log "Volume API response status: $?"

volumePrivateCliEndpoint="private/cli/volume?volume=$(IFS='|'; echo "\${mappedOntapVolumeNames[*]}")&fields=space-mgmt-try-first"
log "Calling ONTAP private CLI endpoint: $volumePrivateCliEndpoint"

privateVolumeResponse=$(ontap_request 'GET' $volumePrivateCliEndpoint)
log "Private volume API response status: $?"

# Check if response is valid
if [ -z "$response" ] || ! echo "$response" | jq -e '.records' > /dev/null 2>&1; then
    error="Failed to fetch volume details or invalid response"
    log "ERROR: Invalid or empty response from volume API"

    # Create error result and exit
    result=$(jq -n \
        --arg error "$error" \
        --arg filesystemId "$filesystemid" \
        '{
            volumes: {
                error: $error,
                filesystemId: $filesystemId,
                data: []
            }
        }')
    echo "$result" | jq -c .
    exit 1
fi

# Check if volumes were found
volumes=$(echo "$response" | jq -c '.records[]')
if [ -z "$volumes" ]; then
    error="No volume records found in response"
    log "ERROR: No volume records found in API response"

     # Create error result and exit
    result=$(jq -n \
        --arg error "$error" \
        --arg filesystemId "$filesystemid" \
        '{
            volumes: {
                error: $error,
                filesystemId: $filesystemId,
                data: []
            }
        }')
    echo "$result" | jq -c .
    exit 1
fi

log "Successfully retrieved volume data, processing $(echo "$response" | jq '.records | length') volumes"

# Create proper JSON array of volume objects
volumesData=$(echo "$response" | jq '[.records[] | {
    name: .name,
    uuid: .uuid,
    thinProvision: .guarantee.honored,
    spaceGuarantee: .guarantee.type,
    autosizeMode: .autosize.mode,
    autosize: (if .autosize.mode != "off" then "on" else "off" end),
    fractionalReserve: .space.fractional_reserve,
    snapshotCopyReserve: .space.snapshot.reserve_percent,
    snapshotAutodelete: .space.snapshot.autodelete.enabled,
    snapshotPolicy: .snapshot_policy.name,
    tieringPolicy: .tiering.policy,
    tieringMinCoolingDays: .tiering.min_cooling_days,
    svmName: .svm.name,
    compression: .efficiency.compression,
    compressionType: .efficiency.compression_type,
    compaction: .efficiency.compaction,
    deduplication: .efficiency.dedupe,
    efficiencyType: .efficiency.storage_efficiency_mode,
    snapshotDeleteOrder: .space.snapshot.autodelete.delete_order
}]')

# Add spaceMgmtTryFirst field to volumesData with error handling
if echo "$privateVolumeResponse" | jq -e '.records' > /dev/null 2>&1; then
    log "Processing private CLI response for spaceMgmtTryFirst field"
    spaceMgmtLookup=$(echo "$privateVolumeResponse" | jq 'reduce .records[] as $item ({}; .[$item.volume] = $item.space_mgmt_try_first)')
    
    volumesData=$(echo "$volumesData" | jq --argjson lookup "$spaceMgmtLookup" '
        map(. + {
            spaceMgmtTryFirst: ($lookup[.name] // null)
        })
    ')
else
    log "WARNING: No valid private CLI response, setting spaceMgmtTryFirst to null"
    volumesData=$(echo "$volumesData" | jq 'map(. + {spaceMgmtTryFirst: null})')
fi

volumes=$(jq -n \
    --arg error "$error" \
    --arg filesystemId "$filesystemid" \
    --argjson volumesData "$volumesData" \
    '{
        error: $error,
        filesystemId: $filesystemId,
        data: $volumesData
    }')

if [ -n "\${mappedOntapLunUuids+x}" ] && [ \${#mappedOntapLunUuids[@]} -gt 0 ]; then
    log "Processing LUNs for iSCSI protocol"
    lunEndpoint="storage/luns?uuid=$(IFS='|'; echo "\${mappedOntapLunUuids[*]}")&fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"
    log "Calling LUN API endpoint: $lunEndpoint"
    
    response=$(ontap_request 'GET' $lunEndpoint)
    log "LUN API response status: $?"
    
    lunsError=''
    # Check if luns were found
    luns=$(echo "$response" | jq -c '.records[]')
    if [ -z "$luns" ]; then
        lunsError="No lun records found in response"
        log "ERROR: No LUN records found in API response"
    else
        log "Successfully retrieved $(echo "$response" | jq '.records | length') LUN records"
    fi

    # Create proper JSON array of lun objects
    lunsData=$(echo "$response" | jq '[.records[] | {
        name: .name,
        uuid: .uuid,
        osType: .os_type,
        spaceReservationEnabled: .space.guarantee.requested,
        spaceAllocationAllocated: .space.scsi_thin_provisioning_support_enabled
    }]')

    luns=$(jq -n \
        --arg error "$lunsError" \
        --argjson lunsData "$lunsData" \
        '{
            error: $error,
            data: $lunsData
        }')
fi

# Fetch NFS protocol information
log "Fetching NFS protocol configuration"
# Fetch NFS protocol information only if protocol is NFS
if [ "$storageProtocol" = "NFS" ]; then
    log "Fetching NFS protocol configuration for NFS storage"
    nfsEndpoint="protocols/nfs/services?svm.uuid=$(IFS='|'; echo "\${ontapSvmUuids[*]}")&fields=protocol.v4_id_domain,protocol.v40_enabled,protocol.v41_enabled"
    log "Calling NFS protocol API endpoint: $nfsEndpoint"

    nfsResponse=$(ontap_request 'GET' $nfsEndpoint)
    log "NFS protocol API response status: $?"

    nfsError=''
    # Check if NFS service data was found
    nfsService=$(echo "$nfsResponse" | jq -c '.records[]')
    if [ -z "$nfsService" ]; then
        nfsError="No NFS service records found in response"
        log "ERROR: No NFS service records found in API response"
    else
        log "Successfully retrieved NFS service configuration"
    fi

    # Create NFS protocol data object
    nfsData=$(echo "$nfsResponse" | jq '[.records[] | {
        v4IdDomain: .protocol.v4_id_domain,
        v40Enabled: .protocol.v40_enabled,
        v41Enabled: .protocol.v41_enabled
    }] | .[0] // {}')

    nfsProtocol=$(jq -n \
        --arg error "$nfsError" \
        --argjson nfsData "$nfsData" \
        '{
            error: $error,
            data: $nfsData
        }')

    # Fetch NFS rootonly configuration
    log "Fetching NFS rootonly configuration"
    nfsRootonlyEndpoint="private/cli/vserver/nfs?vserver=$(IFS='|'; echo "\${ontapSvmNames[*]}")&fields=nfs_rootonly"
    log "Calling NFS rootonly API endpoint: $nfsRootonlyEndpoint"

    nfsRootonlyResponse=$(ontap_request 'GET' $nfsRootonlyEndpoint)
    log "NFS rootonly API response status: $?"

    # Check if NFS rootonly data was found and add error handling
    if echo "$nfsRootonlyResponse" | jq -e '.records' > /dev/null 2>&1; then
        log "Successfully retrieved NFS rootonly configuration"
        svmNfsRootonlyData=$(echo "$nfsRootonlyResponse" | jq '[.records[] | {
            svmName: .vserver,
            nfsRootonly: .nfs_rootonly
        }]')
    else
        log "WARNING: No valid NFS rootonly response or no records found"
        svmNfsRootonlyData='[]'
    fi
else
    log "Storage protocol is not NFS, skipping NFS protocol configuration"
    nfsProtocol=$(jq -n '{error: "NFS protocol not applicable", data: {}}')
fi

log "Starting Oracle binary volumes discovery"
${ORACLE_BINARY_VOLUMES_METADATA}
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
${CHECK_ORACLE_FRA_RMAN_STATUS(instanceRecord.activeNodeInstanceid, instanceRecord.id)}
fra_rman_result=$(check_oracle_fra_rman_status "${instanceRecord.activeNodeInstanceid}" "${instanceRecord.id}")
log "FRA/RMAN check result: $fra_rman_result"

# Parse the pipe-delimited result
fra_enabled=$(echo "$fra_rman_result" | sed -n '1p' | tr -d '[:space:]')
rman_compression_enabled=$(echo "$fra_rman_result" | sed -n '2p' | tr -d '[:space:]')

log "FRA enabled: $fra_enabled, RMAN compression: $rman_compression_enabled"

log "Starting Oracle DNFS servers check"
${CHECK_ORACLE_DNFS_SERVERS(instanceRecord.activeNodeInstanceid, instanceRecord.id)}
dnfs_result=$(check_oracle_dnfs_servers "${instanceRecord.activeNodeInstanceid}" "${instanceRecord.id}")
log "DNFS servers check result: $dnfs_result"


# Create result with valid JSON
if [ -n "\${mappedOntapLunUuids+x}" ] && [ \${#mappedOntapLunUuids[@]} -gt 0 ]; then
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

const ORACLE_BINARY_VOLUMES_METADATA = `
# Oracle Binary Volumes Metadata;
find_oracle_binary_volumes() {
    # Get all EBS volumes for this instance once
    local instance_id=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || true)
    local all_volumes=""
    
    if [[ -n "$instance_id" ]] && command -v aws >/dev/null 2>&1; then
        all_volumes=$(aws ec2 describe-volumes \
            --filters "Name=attachment.instance-id,Values=$instance_id" \
            --query 'Volumes[].{VolumeId:VolumeId,Device:Attachments[0].Device,Name:Tags[?Key=='Name'].Value|[0]}' \
            --output json 2>/dev/null || echo '[]')
    else
        all_volumes='[]'
    fi
    
    {
        # Find Oracle binaries in common paths
        for path in /u01/app/oracle /opt/oracle /usr/lib/oracle /oracle /home/oracle; do
            [[ -d "$path" ]] && find "$path" -name "oracle" -o -name "sqlplus" -o -name "lsnrctl" 2>/dev/null | while read binary; do
                local device=$(df "$binary" | tail -1 | awk '{print $1}')
                local mount_point=$(df "$binary" | tail -1 | awk '{print $6}')
                local volume_name="root"
                [[ "$mount_point" != "/" ]] && volume_name=$(basename "$mount_point")
                
                # Look up EBS volume from cached data
                local ebs_volume=$(echo "$all_volumes" | jq --arg dev "$device" '.[] | select(.Device == $dev)')
                
                if [[ -n "$ebs_volume" && "$ebs_volume" != "null" ]]; then
                    local volume_id=$(echo "$ebs_volume" | jq -r '.VolumeId')
                    local ebs_name=$(echo "$ebs_volume" | jq -r '.Name // empty')
                    [[ -n "$ebs_name" && "$ebs_name" != "null" ]] && volume_name="$ebs_name"
                    echo "$volume_id|$volume_name"
                else
                    # Fallback to PARTUUID
                    local volume_id=$(blkid "$device" 2>/dev/null | grep -o 'PARTUUID="[^"]*"' | cut -d'"' -f2 || basename "$device")
                    echo "$volume_id|$volume_name"
                fi
            done
        done
        
        # Check PATH binaries
        for binary in oracle sqlplus lsnrctl; do
            local path_binary=$(which "$binary" 2>/dev/null || true)
            if [[ -n "$path_binary" ]]; then
                local device=$(df "$path_binary" | tail -1 | awk '{print $1}')
                local mount_point=$(df "$path_binary" | tail -1 | awk '{print $6}')
                local volume_name="root"
                [[ "$mount_point" != "/" ]] && volume_name=$(basename "$mount_point")
                
                # Look up EBS volume from cached data
                local ebs_volume=$(echo "$all_volumes" | jq --arg dev "$device" '.[] | select(.Device == $dev)')
                
                if [[ -n "$ebs_volume" && "$ebs_volume" != "null" ]]; then
                    local volume_id=$(echo "$ebs_volume" | jq -r '.VolumeId')
                    local ebs_name=$(echo "$ebs_volume" | jq -r '.Name // empty')
                    [[ -n "$ebs_name" && "$ebs_name" != "null" ]] && volume_name="$ebs_name"
                    echo "$volume_id|$volume_name"
                else
                    # Fallback to PARTUUID
                    local volume_id=$(blkid "$device" 2>/dev/null | grep -o 'PARTUUID="[^"]*"' | cut -d'"' -f2 || basename "$device")
                    echo "$volume_id|$volume_name"
                fi
            fi
        done
    } | sort -u | jq -R 'split("|") | {"volumeId": .[0], "volumeName": .[1]}' | jq -s .
}
`;

export { VOLUME_LUN_CONFIGURATION };
