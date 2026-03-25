import { WorkloadInstance } from '../../../../utils/common-types';
import { debugLog } from '../../../workloads/oracle/oracle-discover-scripts';
import {
    getOracleDefaultOrUserAuthCommand,
    checkCommandStatus,
    ontapRestApi,
    logFileCheck,
    pythonScriptInit,
    resolveOracleHomeInParent
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

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

const VOLUME_LUN_CONFIGURATION = (instanceRecord: WorkloadInstance) =>
    `
# Get Storage Configuration Assessment

${debugLog(`${LINUX_LOG_DIRECTORY}/storageassessment.log`)}

${checkCommandStatus}

# Ensure log directory exists
mkdir -p ${LINUX_LOG_DIRECTORY}

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

volumeEndpoint="storage/volumes?uuid=$(IFS='|'; echo "\${mappedOntapVolumeUuids[*]}")&fields=svm,nas.path,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,space.snapshot.autodelete.delete_order,snapshot_policy,tiering,guarantee,efficiency"
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
    junctionPath: .nas.path,
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
else
    log "No LUN UUIDs mapped or protocol is not iSCSI, skipping LUN configuration"
    luns=$(jq -n '{error: "LUNs not applicable", data: []}')
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

get_ec2_instance_info() {
    # Get instance metadata with timeout
    local token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || echo "")
    
    local headers=""
    [[ -n "$token" ]] && headers="-H X-aws-ec2-metadata-token:$token"
    
    # Get metadata with fallbacks
    local private_ip=$(curl -s --connect-timeout 2 $headers \
        http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null || \
        ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \\K\\S+' || echo "")
    
    local public_ip=$(curl -s --connect-timeout 2 $headers \
        http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    
    local hostname=$(curl -s --connect-timeout 2 $headers \
        http://169.254.169.254/latest/meta-data/hostname 2>/dev/null || \
        hostname 2>/dev/null || echo "")
    
    # Extract domain from hostname or resolv.conf
    local domain=""
    if [[ "$hostname" == *.* ]]; then
        domain=$(echo "$hostname" | cut -d'.' -f2-)
    else
        domain=$(grep -E '^(domain|search)' /etc/resolv.conf 2>/dev/null | head -1 | awk '{print $2}' || echo "")
    fi
    
    local ec2_info=$(jq -n \
        --arg private_ip "$private_ip" \
        --arg public_ip "$public_ip" \
        --arg hostname "$hostname" \
        --arg domain "$domain" \
        '{
            privateIp: $private_ip,
            publicIp: $public_ip,
            hostname: $hostname,
            domain: $domain
        }')
    
    log "EC2 Instance Info: $ec2_info"
    echo "$ec2_info"
}

check_client_match() {
    local client_match="$1"
    local private_ip="$2"
    local public_ip="$3"
    local domain="$4"
    
    # Check if client_match contains any of our identifiers
    if [[ -n "$private_ip" && "$client_match" == *"$private_ip"* ]]; then
        return 0
    fi
    
    if [[ -n "$public_ip" && "$client_match" == *"$public_ip"* ]]; then
        return 0
    fi
    
    if [[ -n "$domain" && "$client_match" == *"$domain"* ]]; then
        return 0
    fi
    
    # Check for wildcard or subnet matches that could include our IPs
    if [[ "$client_match" == "*" || "$client_match" == "0.0.0.0/0" ]]; then
        return 0
    fi
    
    return 1
}

get_nfs_volume_info() {
    local volume_name="$1"
    [[ -z "$volume_name" ]] && { echo "{}"; return; }
    
    # Get EC2 instance information for access validation
    local instance_info=$(get_ec2_instance_info)
    local private_ip=$(echo "$instance_info" | jq -r '.privateIp // empty')
    local public_ip=$(echo "$instance_info" | jq -r '.publicIp // empty')
    local domain=$(echo "$instance_info" | jq -r '.domain // empty')
    
    # Get basic volume info
    local volume_endpoint="storage/volumes?name=$volume_name&fields=uuid,svm.name,svm.uuid,nas.export_policy.name"
    local volume_response=$(ontap_request 'GET' "$volume_endpoint" 2>/dev/null)
    
    if ! echo "$volume_response" | jq -e '.records[0]' > /dev/null 2>&1; then
        echo "{}"
        return
    fi
    
    local volume_record=$(echo "$volume_response" | jq '.records[0]')
    local volume_uuid=$(echo "$volume_record" | jq -r '.uuid // empty')
    local svm_name=$(echo "$volume_record" | jq -r '.svm.name // empty')
    local svm_uuid=$(echo "$volume_record" | jq -r '.svm.uuid // empty')
    local export_policy_name=$(echo "$volume_record" | jq -r '.nas.export_policy.name // empty')
    
    # Return basic info if any field is missing
    if [[ -z "$svm_name" || -z "$export_policy_name" || "$svm_name" == "empty" || "$export_policy_name" == "empty" ]]; then
        echo "{}"
        return
    fi
    
    # Get export policy rules
    local export_policy_endpoint="protocols/nfs/export-policies?svm.name=$svm_name&name=$export_policy_name&fields=rules.superuser,rules.allow_suid,rules.clients.match"
    local export_policy_response=$(ontap_request 'GET' "$export_policy_endpoint" 2>/dev/null)
    
    local export_rules='[]'
    local has_access="false"
    
    if echo "$export_policy_response" | jq -e '.records[0].rules' > /dev/null 2>&1; then
        export_rules=$(echo "$export_policy_response" | jq '.records[0].rules | map({
            clients: [.clients[].match],
            superuser: .superuser,
            allow_suid: .allow_suid
        })')
        
        # Check access validation by iterating through rules
        while IFS= read -r rule; do
            if [[ -n "$rule" && "$rule" != "null" ]]; then
                local clients=$(echo "$rule" | jq -r '.clients[]?.match // empty' 2>/dev/null)
                
                while IFS= read -r client_match; do
                    if [[ -n "$client_match" && "$client_match" != "empty" ]]; then
                        if check_client_match "$client_match" "$private_ip" "$public_ip" "$domain"; then
                            has_access="true"
                            log "Access granted for volume $volume_name via client match: $client_match"
                            break 2  # Break out of both loops
                        fi
                    fi
                done <<< "$clients"
            fi
        done <<< "$(echo "$export_rules" | jq -c '.[]')"
    fi
    
    # Return NFS volume info with access validation
    local nfs_json=$(jq -n \
        --arg volume_id "$volume_uuid" \
        --arg svm_name "$svm_name" \
        --arg svm_uuid "$svm_uuid" \
        --arg export_policy_name "$export_policy_name" \
        --argjson rules "$export_rules" \
        --argjson instance_info "$instance_info" \
        '{
            volumeId: $volume_id,
            svmName: $svm_name,
            svmUuid: $svm_uuid,
            exportPolicyName: $export_policy_name,
            rules: $rules,
            instanceInfo: $instance_info
        }')
    
    log "NFS volume info for $volume_name: Access=$has_access"
    echo "$nfs_json"
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
    local nfs_info="{}"
    
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
        local nfs_path=$(mount | awk -v mp="$mount_point" '$3 == mp && ($5 ~ /nfs/ || $6 ~ /nfs/) {print $1}' | head -1)
        nfs_info=$(get_nfs_volume_info "$volume_name" 2>/dev/null || echo "{}")
        [[ -z "$nfs_info" || "$nfs_info" == "null" ]] && nfs_info="{}"

        # Extract volumeId from nfs_info JSON
        local nfs_volume_id=$(echo "$nfs_info" | jq -r '.volumeId // empty')
        
        result=$(jq -n \\
            --arg volumeId "$nfs_volume_id" \\
            --arg volumeName "$volume_name" \\
            --arg oracleHome "$oracle_home" \\
            --argjson isNfsMount true \\
            --argjson hasBinaries $([ "$has_binaries" == "true" ] && echo true || echo false) \\
            --arg mountPath "$mount_point" \\
            --argjson nfsInfo "$nfs_info" \\
            --arg oracleSid "$target_oracle_sid" \\
            '[{
                "volumeId": $volumeId,
                "volumeName": $volumeName,
                "oracleHome": $oracleHome,
                "isNfsMount": $isNfsMount,
                "hasBinaries": $hasBinaries,
                "mountPath": $mountPath,
                "nfsInfo": $nfsInfo,
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

    except FileNotFoundError:
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
