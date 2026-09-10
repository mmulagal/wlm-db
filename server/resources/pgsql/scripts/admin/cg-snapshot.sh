#!/usr/bin/env bash

# Remote: find-or-create the data+WAL consistency group, then take a crash-consistent
# group snapshot. Envelope kind: snapshot.
# Args: SVM_NAME, DATA_VOLUME, LOG_VOLUME, FILESYSTEM_ID, REGION, CG_NAME (max 30 chars),
#       SNAPSHOT_NAME, RETENTION_LABEL. Optional: FSX_USERNAME, FSX_PASSWORD.
# Mutating. Only after the create-group (when needed) and create-snapshot confirmations.
# Never send consistency_type=application — these skills do not quiesce PostgreSQL.
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

cgname="${CG_NAME:?}"
if (( ${#cgname} > 30 )); then
    echo "{\"status\":\"error\",\"error\":\"CG_NAME '$cgname' is ${#cgname} chars; ONTAP allows 30\"}"
    exit 0
fi

existing_cg=$(ontap_request GET "application/consistency-groups?svm.name=$svmname&volumes.name=$datavol,$walvol&fields=name,volumes")
# The query matches any group containing *either* volume, so pick by exact membership — the
# prose rule below is only enforced if the script checks it.
cg_uuid=$(echo "$existing_cg" | jq -r --arg d "$datavol" --arg l "$walvol" \
    '[ .records[]? | select(([.volumes[]?.name] | sort) == ([$d, $l] | sort)) ] | .[0].uuid // empty')

# A volume can belong to only one consistency group, so a partial match is a dead end:
# creating a new group would fail, and adopting that one would snapshot unrelated volumes.
if [[ -z "$cg_uuid" ]]; then
    partial=$(echo "$existing_cg" | jq -r '[.records[]?.name] | join(",")')
    if [[ -n "$partial" ]]; then
        echo "{\"status\":\"error\",\"error\":\"consistency group(s) [$partial] already contain one of these volumes with a different member set — refusing to adopt or duplicate\"}"
        exit 0
    fi
fi

if [[ -z "$cg_uuid" ]]; then
    # Mutating: only run after the "create consistency group" confirmation (see
    # confirmation-and-results.md). Adopts the two *existing* volumes — does not create new ones.
    create_body=$(jq -n --arg svm "$svmname" --arg name "$cgname" --arg d "$datavol" --arg l "$walvol" \
        '{svm:{name:$svm},name:$name,volumes:[{name:$d,provisioning_options:{action:"add"}},{name:$l,provisioning_options:{action:"add"}}]}')
    create_resp=$(ontap_request POST "application/consistency-groups?return_records=true" "$create_body")
    cg_uuid=$(echo "$create_resp" | jq -r '.records[0].uuid // empty')
    if [[ -z "$cg_uuid" ]]; then
        echo "{\"status\":\"error\",\"error\":\"failed to create consistency group: $(echo "$create_resp" | jq -c .)\"}"
        exit 0
    fi
fi

snapshotname="${SNAPSHOT_NAME:?}"
retentionlabel="${RETENTION_LABEL:?}"

# Mutating: only after the "create snapshot" confirmation.
snap_body=$(jq -n --arg name "$snapshotname" --arg comment "$retentionlabel" \
    '{name:$name,consistency_type:"crash",comment:$comment}')
snap_resp=$(ontap_request POST "application/consistency-groups/$cg_uuid/snapshots?return_records=true" "$snap_body")
group_snapshot_uuid=$(echo "$snap_resp" | jq -r '.records[0].uuid // empty')
if [[ -z "$group_snapshot_uuid" ]]; then
    echo "{\"status\":\"error\",\"error\":\"failed to create group snapshot: $(echo "$snap_resp" | jq -c .)\"}"
    exit 0
fi

# Fetch per-volume snapshot names captured atomically by the group snapshot.
# `fields=snapshot_volumes` is mandatory: the default projection returns only name/uuid/
# comment/consistency_type, so the members come back null and the jq below dies on it.
snap_detail=$(ontap_request GET "application/consistency-groups/$cg_uuid/snapshots/$group_snapshot_uuid?fields=snapshot_volumes")
member_snapshots=$(echo "$snap_detail" | jq -c '[.snapshot_volumes[]? | {volumeUuid: .volume.uuid, volumeName: .volume.name, snapshotName: .snapshot.name}]')
if [[ "$(echo "$member_snapshots" | jq 'length')" != "2" ]]; then
    echo "{\"status\":\"error\",\"error\":\"group snapshot $group_snapshot_uuid reported $(echo "$member_snapshots" | jq 'length') member volumes, expected data + WAL\",\"groupSnapshotUuid\":\"$group_snapshot_uuid\"}"
    exit 0
fi

echo "{\"status\":\"ok\",\"consistencyGroupUuid\":\"$cg_uuid\",\"groupSnapshotUuid\":\"$group_snapshot_uuid\",\"memberSnapshots\":$member_snapshots,\"retentionLabel\":\"$retentionlabel\"}"
