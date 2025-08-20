import { WorkloadInstance } from '../../../utils/common-types';
import { checkCommandStatus, ontapRestApi } from './oracle-ssm-script-utils';

const VOLUME_LUN_CONFIGURATION = (instanceRecord: WorkloadInstance) =>
    `
# Get Storage Configuration Assessment

${checkCommandStatus}

instanceName="${instanceRecord.name}"
filesystemid="${instanceRecord.fsxFileSystem}"
region="${instanceRecord.region}"
ontapSvmUuid="${instanceRecord.svmOntapUuid}"
storageProtocol="${instanceRecord.storageProtocol}"
IFS=',' read -r -a mappedOntapVolumeNames <<< "${instanceRecord.mappedVolumeNames}"
IFS=',' read -r -a mappedOntapVolumeUuids <<< "${instanceRecord.mappedVolumesUuids}"

if [ "$storageProtocol" != "iSCSI" ]; then
    mappedOntapLunNames=()
    mappedOntapLunUuids=()
else
    IFS=',' read -r -a mappedOntapLunNames <<< "${instanceRecord.mappedLunNames}"
    IFS=',' read -r -a mappedOntapLunUuids <<< "${instanceRecord.mappedLunUuids}"
fi

${ontapRestApi}

if [ -z "\${mappedOntapVolumeUuids[*]}" ]; then
    error="Unable to fetch ONTAP volumes details as the mapped volume UUIDs are either null or empty."
    
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

volumeEndpoint="storage/volumes?uuid=$(IFS='|'; echo "\${mappedOntapVolumeUuids[*]}")&fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee,efficiency"
response=$(ontap_request 'GET' $volumeEndpoint)

# Check if response is valid
if [ -z "$response" ] || ! echo "$response" | jq -e '.records' > /dev/null 2>&1; then
    error="Failed to fetch volume details or invalid response"

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
    efficiencyType: .efficiency.storage_efficiency_mode
}]')

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
    lunEndpoint="storage/luns?uuid=$(IFS='|'; echo "\${mappedOntapLunUuids[*]}")&fields=space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type"
    response=$(ontap_request 'GET' $lunEndpoint)
    lunsError=''
    # Check if luns were found
    luns=$(echo "$response" | jq -c '.records[]')
    if [ -z "$luns" ]; then
    lunsError="No lun records found in response"
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

${ORACLE_BINARY_VOLUMES_METADATA}
binaryVolumesData=$(find_oracle_binary_volumes)
binaryVolumes=$(jq -n \
    --arg error "$error" \
    --argjson binaryVolumesData "$binaryVolumesData" \
    '{
        error: $error,
        data: $binaryVolumesData
    }')

# Create result with valid JSON
if [ -n "\${mappedOntapLunUuids+x}" ] && [ \${#mappedOntapLunUuids[@]} -gt 0 ]; then
 result=$(jq -n \
        --argjson volumes "$volumes" \
        --argjson luns "$luns" \
        --argjson binaryVolumes "$binaryVolumes" \
        '{
            volumes: $volumes,
            luns: $luns,
            binaryVolumes: $binaryVolumes
        }')

else
    result=$(jq -n \
        --argjson volumes "$volumes" \
        --argjson binaryVolumes "$binaryVolumes" \
        '{
            volumes: $volumes,
            binaryVolumes: $binaryVolumes
        }')
fi
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
