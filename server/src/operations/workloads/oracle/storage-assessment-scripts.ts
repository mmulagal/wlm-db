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
IFS=',' read -r -a mappedOntapVolumeNames <<< "${instanceRecord.mappedVolumeNames}"
IFS=',' read -r -a mappedOntapVolumeUuids <<< "${instanceRecord.mappedVolumesUuids}"

${ontapRestApi}

volumeEndpoint="storage/volumes?uuid=$(IFS='|'; echo "\${mappedOntapVolumeUuids[*]}")&fields=svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee"
if [ -z "\${mappedOntapVolumeUuids[*]}" ]; then
    echo "Unable to fetch ONTAP volumes details as the mapped volume UUIDs are either null or empty."
    
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

response=$(ontap_request 'GET' $volumeEndpoint)

# Check if response is valid
if [ -z "$response" ] || ! echo "$response" | jq -e '.records' > /dev/null 2>&1; then
    echo "{"error": "Failed to fetch volume details or invalid response"}"

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
    echo "{"error": "No volume records found in response"}"

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
    svmName: .svm.name
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

# Create result with valid JSON
result=$(jq -n \
    --argjson volumes "$volumes" \
    '{
        volumes: $volumes
    }')

# Output compact JSON
echo "$result" | jq -c .
`;

export { VOLUME_LUN_CONFIGURATION };
