#!/usr/bin/env bash

# Remote: FlexClone the data and WAL volumes from member snapshots of ONE group snapshot.
# Envelope: {status, dataCloneVolume, dataCloneUuid, walCloneVolume, walCloneUuid, parentSnapshot}.
# Args: SVM_NAME, DATA_VOLUME, LOG_VOLUME, FILESYSTEM_ID, REGION, DATA_CLONE_VOLUME,
#       WAL_CLONE_VOLUME, MEMBER_SNAPSHOTS (JSON array from cg-snapshot.sh). Optional:
#       FSX_USERNAME, FSX_PASSWORD.
# Mutating. Only after the create-FlexClone confirmation.
set -euo pipefail

# Refuse non-Workload Factory postgres layouts (pgpool node, missing WAL symlink).
if [[ -f /usr/local/etc/pgpool.conf ]] || systemctl cat pgpool >/dev/null 2>&1; then
    echo '{"status":"unsupported","reason":"host is a pgpool node, not a postgres data host"}'
    exit 0
fi
data_dir=$(sudo systemctl cat postgresql 2>/dev/null | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}' || true)
if [[ -z "$data_dir" ]]; then
    echo '{"status":"unsupported","reason":"PostgreSQL service or PGDATA not found"}'
    exit 0
fi
if [[ ! -L "$data_dir/pg_wal" ]]; then
    echo '{"status":"unsupported","reason":"pg_wal is not a symlink to a separate WAL volume"}'
    exit 0
fi

svmname="${SVM_NAME:?}"
datavol="${DATA_VOLUME:?}"
walvol="${LOG_VOLUME:?}"
filesystemid="${FILESYSTEM_ID:?}"
region="${REGION:?}"

ontap_request() {
    local method="$1" endpoint="$2" body="${3:-}"
    local auth cert_path
    auth=$(printf '%s:%s' "$fsxusername" "$fsxpassword" | base64)
    cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem
    local args=(--silent --show-error --header "Authorization: Basic $auth" --request "$method" \
        --cacert "$cert_path" --location "https://management.$filesystemid.fsx.$region.amazonaws.com/api/$endpoint")
    [[ -n "$body" ]] && args+=(--json "$body")
    curl "${args[@]}"
}

if [[ -n "${FSX_USERNAME:-}" && -n "${FSX_PASSWORD:-}" ]]; then
    fsxusername="$FSX_USERNAME"
    fsxpassword="$FSX_PASSWORD"
else
    creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)
    creds=$(echo "$creds" | sed "s/'/\"/g" | sed 's/\([^"{},: ]\+\):/"\1":/g')
    fsxusername=$(echo "$creds" | jq -r '.fsx.username')
    fsxpassword=$(echo "$creds" | jq -r '.fsx.password')
fi

# MEMBER_SNAPSHOTS is the JSON array from cg-snapshot.sh's envelope (memberSnapshots).
# This is a separate SSM call, so the array is not in shell scope from the previous step.
member_snapshots="${MEMBER_SNAPSHOTS:?}"

data_clone_volume="${DATA_CLONE_VOLUME:?}"
wal_clone_volume="${WAL_CLONE_VOLUME:?}"

# Mutating: only after the "create clone" confirmation.
# Returns the new volume's uuid on stdout, or an error envelope and exit — clone-recovery.sh
# needs both uuids for its envelope, so a create that "worked" but reported no uuid is a
# failure, not something to paper over with an empty string.
create_clone_volume() {
    local clone_name="$1" parent_volume="$2" parent_snapshot="$3"
    local body resp uuid
    # nas.path is required, not optional: a FlexClone is created *unjunctioned* by default
    # (nas.path null), and clone-recovery.sh mounts it as "<server>:/<volumeName>". Without a
    # junction path that mount fails even though the volume is online.
    body=$(jq -n --arg name "$clone_name" --arg svm "$svmname" --arg pv "$parent_volume" --arg ps "$parent_snapshot" \
        '{name:$name,svm:{name:$svm},nas:{path:("/" + $name)},clone:{is_flexclone:true,parent_volume:{name:$pv},parent_snapshot:{name:$ps}}}')
    resp=$(ontap_request POST "storage/volumes?return_records=true" "$body")
    uuid=$(echo "$resp" | jq -r '.records[0].uuid // .job.uuid // empty')
    if [[ -z "$uuid" ]]; then
        echo "{\"status\":\"error\",\"error\":\"failed to create FlexClone $clone_name: $(echo "$resp" | jq -c .)\"}"
        exit 0
    fi
    echo "$uuid"
}

# Look each parent snapshot up by volume inside the SAME $member_snapshots from step 2, so a
# data clone can never be paired with a WAL snapshot from a different group snapshot.
member_snapshot_for() {
    echo "$member_snapshots" | jq -er --arg v "$1" '.[] | select(.volumeName == $v) | .snapshotName'
}

data_clone_uuid=$(create_clone_volume "$data_clone_volume" "$datavol" "$(member_snapshot_for "$datavol")")
wal_clone_uuid=$(create_clone_volume "$wal_clone_volume" "$walvol" "$(member_snapshot_for "$walvol")")

# `storage/volumes` POST is asynchronous: the volume is not mountable until the job finishes,
# so resolve each clone by name and fail loudly rather than handing clone-recovery.sh a
# volume that is still being created.
# Requires nas.path too: an online-but-unjunctioned clone is not mountable, and discovering
# that only when `mount` fails on the target leaves half a clone behind.
resolve_clone_uuid() {
    local name="$1" i resp uuid state nas_path
    for i in $(seq 1 30); do
        resp=$(ontap_request GET "storage/volumes?name=$name&svm.name=$svmname&fields=uuid,state,nas.path")
        uuid=$(echo "$resp" | jq -r '.records[0].uuid // empty')
        state=$(echo "$resp" | jq -r '.records[0].state // empty')
        nas_path=$(echo "$resp" | jq -r '.records[0].nas.path // empty')
        if [[ "$state" == "online" && -n "$uuid" && -n "$nas_path" ]]; then
            echo "$uuid"
            return 0
        fi
        # Junction a clone that came up without one (created before nas.path was set at POST).
        if [[ "$state" == "online" && -n "$uuid" && -z "$nas_path" ]]; then
            ontap_request PATCH "storage/volumes/$uuid" "$(jq -n --arg p "/$name" '{nas:{path:$p}}')" >/dev/null
        fi
        sleep 5
    done
    echo ""
}
data_clone_uuid=$(resolve_clone_uuid "$data_clone_volume")
wal_clone_uuid=$(resolve_clone_uuid "$wal_clone_volume")
if [[ -z "$data_clone_uuid" || -z "$wal_clone_uuid" ]]; then
    echo "{\"status\":\"error\",\"error\":\"FlexClone volumes did not come online within 150s\",\"dataCloneVolume\":\"$data_clone_volume\",\"walCloneVolume\":\"$wal_clone_volume\"}"
    exit 0
fi

echo "{\"status\":\"ok\",\"dataCloneVolume\":\"$data_clone_volume\",\"dataCloneUuid\":\"$data_clone_uuid\",\"walCloneVolume\":\"$wal_clone_volume\",\"walCloneUuid\":\"$wal_clone_uuid\",\"parentSnapshot\":\"$(member_snapshot_for "$datavol")\"}"
