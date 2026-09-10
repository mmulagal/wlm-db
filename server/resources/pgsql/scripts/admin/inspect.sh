#!/usr/bin/env bash

# Read-only probe for Workload Factory standalone and pgpool HA.
# Envelope: nodeKind, role, version, mounts/volumes, optional need_input,
# alreadyExists/ownerExists when DATABASE_NAME is set, sidecar conflict fields
# when CLONE_* args are set. Never prints FSx passwords.
set -euo pipefail

region="${REGION:-}"
filesystemid="${FILESYSTEM_ID:-}"
database_name="${DATABASE_NAME:-}"
owner="${OWNER:-}"
clone_port="${CLONE_PORT:-}"
clone_pgdata="${CLONE_PGDATA:-}"
clone_logdir="${CLONE_LOGDIR:-}"
clone_name="${CLONE_NAME:-}"

status="ok"
reason=""
need=""
node_kind="unknown"
json_error=""

is_pgpool=false
if [[ -f /usr/local/etc/pgpool.conf ]] || systemctl cat pgpool >/dev/null 2>&1; then
    is_pgpool=true
    node_kind="pgpool"
fi

data_dir=$(sudo systemctl cat postgresql 2>/dev/null | grep Environment=PGDATA | awk -F= '/Environment=PGDATA=/ {print $3}' || true)
if [[ "$is_pgpool" != "true" && -n "$data_dir" ]]; then
    node_kind="postgres"
fi

service_state="not_running"
if [[ "$node_kind" == "postgres" ]]; then
    sudo pg_isready >/dev/null 2>&1 && service_state="running"
elif [[ "$node_kind" == "pgpool" ]]; then
    sudo systemctl is-active --quiet pgpool 2>/dev/null && service_state="running"
fi

pg_version_major=""
if [[ "$node_kind" == "postgres" ]]; then
    pg_version_major=$(sudo -u postgres psql -tAc "SHOW server_version_num;" 2>/dev/null | cut -c1-2 || true)
fi
if [[ -z "$pg_version_major" ]]; then
    version_text=$({ pg_config --version || postgres --version; } 2>/dev/null || true)
    pg_version_major=$(echo "$version_text" | grep -oE '[0-9]+' | head -1 || true)
fi

node_role="none"
deployment_type="standalone"
primary_host=""
in_recovery=""
standby_signal="false"
if [[ -n "${data_dir:-}" && -f "$data_dir/standby.signal" ]]; then
    standby_signal="true"
fi
if [[ "$node_kind" == "postgres" && "$service_state" == "running" ]]; then
    in_recovery=$(sudo -u postgres psql -tAc "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]' || true)
fi
if [[ "$node_kind" == "postgres" && ( "$in_recovery" == "t" || "$standby_signal" == "true" ) ]]; then
    node_role="standby"
    deployment_type="ha"
    if [[ "$service_state" == "running" ]]; then
        primary_conninfo=$(sudo -u postgres psql -tAc "SHOW primary_conninfo;" 2>/dev/null | xargs || true)
        primary_host=$(echo "$primary_conninfo" | grep -oE 'host=[^[:space:]]+' | cut -d= -f2- || true)
    fi
elif [[ "$node_kind" == "postgres" && "$service_state" == "running" ]]; then
    replica_count=$(sudo -u postgres psql -tAc "SELECT count(*) FROM pg_stat_replication;" 2>/dev/null | tr -d '[:space:]' || true)
    slot_count=$(sudo -u postgres psql -tAc "SELECT count(*) FROM pg_replication_slots;" 2>/dev/null | tr -d '[:space:]' || true)
    [[ "$replica_count" =~ ^[0-9]+$ ]] || replica_count=0
    [[ "$slot_count" =~ ^[0-9]+$ ]] || slot_count=0
    if (( replica_count > 0 || slot_count > 0 )); then
        node_role="primary"
        deployment_type="ha"
    fi
fi

get_mount() {
    local path="$1"
    local resp fstype src
    resp=$(sudo findmnt -n -o FSTYPE,SOURCE --target "$path" 2>/dev/null || true)
    fstype=$(echo "$resp" | awk '{print $1}')
    src=$(echo "$resp" | awk '{print $2}')
    if [[ -z "$resp" || "$fstype" != nfs* ]]; then
        echo '{"nfs":false}'
        return
    fi
    local export_path host mount_svm mount_fs
    export_path=$(echo "$src" | cut -d':' -f2-)
    host=$(echo "$src" | cut -d':' -f1)
    mount_svm=""
    mount_fs=""
    if [[ "$host" == *.fsx.*.amazonaws.com ]]; then
        mount_svm=$(echo "$host" | cut -d'.' -f1)
        mount_fs=$(echo "$host" | cut -d'.' -f2)
    fi
    printf '{"nfs":true,"exportPath":"%s","server":"%s","mountSvm":"%s","mountFilesystemId":"%s"}' \
        "$export_path" "$host" "$mount_svm" "$mount_fs"
}

wal_target=""
data_mount='{"nfs":false}'
wal_mount="null"
if [[ -n "$data_dir" ]]; then
    if [[ -L "$data_dir/pg_wal" ]]; then
        wal_target=$(readlink -f "$data_dir/pg_wal" || true)
    fi
    data_mount=$(get_mount "$data_dir")
    if [[ -n "$wal_target" ]]; then
        wal_mount=$(get_mount "$wal_target")
    fi
fi

if [[ "$node_kind" == "pgpool" ]]; then
    reason="pgpool node is not a createdb or clone source"
elif [[ "$node_kind" == "postgres" && -z "$wal_target" ]]; then
    status="unsupported"
    reason="pg_wal is not a symlink to a separate WAL volume"
elif [[ "$node_kind" == "postgres" ]]; then
    if [[ "$(echo "$data_mount" | jq -r .nfs)" != "true" || "$(echo "$wal_mount" | jq -r .nfs)" != "true" ]]; then
        status="unsupported"
        reason="PGDATA or WAL target is not NFS-mounted"
    fi
fi

svm_name=""
svm_uuid=""
data_volume=""
data_volume_uuid=""
log_volume=""
log_volume_uuid=""
creds_source=""

need_input() {
    need="$1"
    reason="$2"
    if [[ "$status" == "ok" ]]; then
        status="need_input"
    fi
}

discover_volumes() {
    [[ "$node_kind" == "postgres" && -n "$data_dir" && "$status" != "unsupported" ]] || return 0
    [[ -n "$region" ]] || { need_input "filesystemId" "REGION was not supplied for ONTAP lookup"; return 0; }

    local mount_path dns_name junction_path ip_address
    mount_path=$(sudo findmnt -n -o SOURCE --target "$data_dir" 2>/dev/null || true)
    [[ -n "$mount_path" ]] || { json_error="Failed to get mount path"; status="error"; return 0; }
    dns_name=$(echo "$mount_path" | cut -d':' -f1)
    junction_path=$(echo "$mount_path" | cut -d':' -f2)

    if [[ $dns_name =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        ip_address=$dns_name
    else
        ip_address=$(dig +short "$dns_name" | tail -n1)
        if [[ -z "$filesystemid" ]]; then
            filesystemid=$(echo "$dns_name" | tr '.' '\n' | grep -E '^fs-[0-9a-f]{8,17}$' | head -n1 || true)
        fi
    fi

    if [[ -z "$filesystemid" || ! "$filesystemid" =~ ^fs-[0-9a-f]{8,17}$ ]]; then
        need_input "filesystemId" "NFS mount did not include an FSx filesystem id (IP mount or unexpected DNS). Ask the operator for filesystemId."
        return 0
    fi

    local fsxusername fsxpassword creds
    if [[ -n "${FSX_USERNAME:-}" && -n "${FSX_PASSWORD:-}" ]]; then
        fsxusername="$FSX_USERNAME"
        fsxpassword="$FSX_PASSWORD"
        creds_source="operator"
    else
        creds=$(aws ssm get-parameter --name "/netapp/wlmdb/$filesystemid" --with-decryption --query "Parameter.Value" --output text 2>/dev/null || true)
        if [[ -z "$creds" ]]; then
            need_input "fsxCredentials" "SSM parameter /netapp/wlmdb/$filesystemid is missing on the host. Ask the operator for FSx username and password."
            return 0
        fi
        creds=$(echo "$creds" | sed "s/'/\"/g" | sed 's/\([^"{},: ]\+\):/"\1":/g')
        fsxusername=$(echo "$creds" | jq -r '.fsx.username')
        fsxpassword=$(echo "$creds" | jq -r '.fsx.password')
        creds_source="host-ssm"
    fi

    local cert_path cert_option
    cert_path=/home/ec2-user/cfn/fsx_certs/bundle-$region.pem
    if [[ -f "$cert_path" ]]; then
        cert_option="--cacert $cert_path"
    elif ping -c 1 -W 1 1.1.1.1 >/dev/null 2>&1; then
        local certs_url
        if [[ "$region" == us-gov-* ]]; then
            certs_url="https://fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com/bundle-$region.pem"
        else
            certs_url="https://fsx-aws-Certificates.s3.amazonaws.com/bundle-$region.pem"
        fi
        [[ -f /tmp/fsx_bundle.pem ]] || curl -sS -o /tmp/fsx_bundle.pem "$certs_url"
        cert_option="--cacert /tmp/fsx_bundle.pem"
    else
        cert_option="--insecure"
    fi

    ontap_request() {
        local management_ip method endpoint request_body response http_status return_result auth
        management_ip=management.$filesystemid.fsx.$region.amazonaws.com
        if ! ping -c 1 -W 2 "$management_ip" >/dev/null 2>&1; then
            management_ip=$(aws fsx describe-file-systems --file-system-id "$filesystemid" --region "$region" --query "FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]" --output text)
            cert_option="--insecure"
        fi
        auth=$(printf '%s:%s' "$fsxusername" "$fsxpassword" | base64)
        method="$1"
        endpoint="$2"
        request_body=""
        [[ -n "${3:-}" ]] && request_body="--json $3"
        response=$(curl --silent --show-error --header "Authorization: Basic $auth" --request "$method" $cert_option --location "https://$management_ip/api/$endpoint" $request_body --write-out "HTTPSTATUS:%{http_code}")
        http_status=$(echo "$response" | sed -n 's/.*HTTPSTATUS:\([0-9]*\)$/\1/p')
        return_result=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
        if [[ $http_status -ge 400 ]]; then
            echo "{\"error\": $(echo "$return_result" | jq -c .)}"
            return 1
        fi
        echo "$return_result"
    }

    local svm_result data_resp wal_dir wal_mount_path wal_junction wal_resp
    svm_result=$(ontap_request GET 'svm/svms?fields=ip_interfaces') || {
        json_error="Failed to get matching SVM with IP address"
        status="error"
        return 0
    }
    svm_result=$(echo "$svm_result" | jq --arg ip_address "$ip_address" '
        .records[] |
        select(.ip_interfaces[]? | select(.name == "nfs_smb_management_1" and .ip.address == $ip_address)) |
        {name: .name, uuid: .uuid}
    ')
    svm_name=$(echo "$svm_result" | jq -r '.name // empty')
    svm_uuid=$(echo "$svm_result" | jq -r '.uuid // empty')
    if [[ -z "$svm_name" ]]; then
        json_error="Failed to get matching SVM with IP address"
        status="error"
        return 0
    fi

    data_resp=$(ontap_request GET "storage/volumes?svm.name=$svm_name&nas.path=$junction_path") || {
        json_error="Failed to extract mounted data volume name"
        status="error"
        return 0
    }
    data_volume=$(echo "$data_resp" | jq -r '.records[0].name // empty')
    data_volume_uuid=$(echo "$data_resp" | jq -r '.records[0].uuid // empty')

    wal_dir=$(readlink -f "$data_dir/pg_wal" || true)
    wal_mount_path=$(sudo findmnt -n -o SOURCE --target "$wal_dir" 2>/dev/null || true)
    wal_junction=$(echo "$wal_mount_path" | cut -d':' -f2)
    wal_resp=$(ontap_request GET "storage/volumes?svm.name=$svm_name&nas.path=$wal_junction") || {
        json_error="Failed to extract mounted log volume name"
        status="error"
        return 0
    }
    log_volume=$(echo "$wal_resp" | jq -r '.records[0].name // empty')
    log_volume_uuid=$(echo "$wal_resp" | jq -r '.records[0].uuid // empty')

    if [[ -z "$data_volume" || "$data_volume" == "null" || -z "$log_volume" || "$log_volume" == "null" ]]; then
        json_error="ONTAP volume lookup returned empty data or log volume"
        status="error"
        return 0
    fi
    if [[ "$data_volume" == "$log_volume" ]]; then
        status="unsupported"
        reason="resolved data and WAL ONTAP volumes are missing or identical"
        return 0
    fi

    local data_svm wal_svm data_fs wal_fs
    data_svm=$(echo "$data_mount" | jq -r '.mountSvm // ""')
    wal_svm=$(echo "$wal_mount" | jq -r '.mountSvm // ""')
    data_fs=$(echo "$data_mount" | jq -r '.mountFilesystemId // ""')
    wal_fs=$(echo "$wal_mount" | jq -r '.mountFilesystemId // ""')
    if [[ -n "$data_svm" && -n "$wal_svm" && "$data_svm" != "$wal_svm" ]]; then
        status="unsupported"
        reason="PGDATA and WAL are on different SVMs — an ONTAP consistency group cannot span SVMs"
        return 0
    fi
    if [[ -n "$data_fs" && -n "$wal_fs" && "$data_fs" != "$wal_fs" ]]; then
        status="unsupported"
        reason="PGDATA and WAL are on different FSx file systems — a consistency group cannot span file systems"
        return 0
    fi
}

discover_volumes

already_exists=""
owner_exists=""
if [[ -n "$database_name" && "$node_kind" == "postgres" && "$service_state" == "running" ]]; then
    already_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$database_name'" | tr -d '[:space:]' || true)
    [[ "$already_exists" == "1" ]] && already_exists="true" || already_exists="false"
    owner_exists="true"
    if [[ -n "$owner" ]]; then
        owner_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$owner'" | tr -d '[:space:]' || true)
        [[ "$owner_exists" == "1" ]] && owner_exists="true" || owner_exists="false"
    fi
fi

clone_requested=false
if [[ -n "$clone_name" || -n "$clone_port" || -n "$clone_pgdata" || -n "$clone_logdir" ]]; then
    clone_requested=true
fi

pgdata_conflict=""
port_in_use=""
unit_conflict=""
mount_conflict=""
if [[ "$clone_requested" == "true" ]]; then
    if [[ "$node_kind" == "pgpool" && "$status" == "ok" ]]; then
        status="unsupported"
        reason="pgpool node is not a valid clone target"
    fi

    pgdata_conflict="false"
    if [[ "$service_state" == "running" && "$node_kind" == "postgres" ]]; then
        [[ -z "$clone_pgdata" || "$data_dir" == "$clone_pgdata" ]] && pgdata_conflict="true"
    fi

    port_in_use="false"
    if [[ -z "$clone_port" ]]; then
        port_in_use="null"
    else
        sudo ss -ltn "sport = :$clone_port" 2>/dev/null | grep -q LISTEN && port_in_use="true"
    fi

    unit_conflict="false"
    if [[ -z "$clone_name" ]]; then
        unit_conflict="null"
    else
        [[ -e "/etc/systemd/system/postgresql-$clone_name.service" ]] && unit_conflict="true"
        systemctl list-unit-files "postgresql-$clone_name.service" 2>/dev/null \
            | grep -q "^postgresql-$clone_name.service" && unit_conflict="true"
    fi

    mount_conflict="false"
    for p in "$clone_pgdata" "$clone_logdir"; do
        [[ -n "$p" ]] && findmnt -n "$p" >/dev/null 2>&1 && mount_conflict="true"
    done

    if [[ "$status" == "ok" || "$status" == "need_input" ]]; then
        if [[ -z "$pg_version_major" ]]; then
            status="unsupported"
            reason="cannot determine target pgVersionMajor — refuse rather than assume it matches the source"
        elif [[ "$pgdata_conflict" == "true" ]]; then
            status="unsupported"
            reason="target has a running PostgreSQL on the clone PGDATA path"
        elif [[ "$port_in_use" == "true" ]]; then
            status="unsupported"
            reason="requested clonePort is already listening on the target"
        elif [[ "$port_in_use" == "null" ]]; then
            status="unsupported"
            reason="CLONE_PORT was not supplied — the port check cannot be skipped"
        elif [[ "$unit_conflict" == "true" ]]; then
            status="unsupported"
            reason="a systemd unit postgresql-$clone_name.service already exists on the target"
        elif [[ "$unit_conflict" == "null" ]]; then
            status="unsupported"
            reason="CLONE_NAME was not supplied — the unit-name check cannot be skipped"
        elif [[ "$mount_conflict" == "true" ]]; then
            status="unsupported"
            reason="a clone mount path is already an active mount point"
        fi
    fi
fi

jq -n \
    --arg status "$status" \
    --arg mode inspect \
    --arg nodeKind "$node_kind" \
    --arg nodeRole "$node_role" \
    --arg deploymentType "$deployment_type" \
    --arg serviceState "$service_state" \
    --arg pgdata "$data_dir" \
    --arg walTarget "$wal_target" \
    --arg pgVersionMajor "$pg_version_major" \
    --arg primaryHost "$primary_host" \
    --argjson dataMount "$data_mount" \
    --argjson walMount "$wal_mount" \
    --arg svmName "$svm_name" \
    --arg svmUuid "$svm_uuid" \
    --arg dataVolume "$data_volume" \
    --arg dataVolumeUuid "$data_volume_uuid" \
    --arg logVolume "$log_volume" \
    --arg logVolumeUuid "$log_volume_uuid" \
    --arg filesystemId "$filesystemid" \
    --arg credsSource "$creds_source" \
    --arg need "$need" \
    --arg reason "$reason" \
    --arg error "$json_error" \
    --arg alreadyExists "$already_exists" \
    --arg ownerExists "$owner_exists" \
    --arg cloneRequested "$clone_requested" \
    --arg pgdataConflict "$pgdata_conflict" \
    --arg portInUse "$port_in_use" \
    --arg clonePort "$clone_port" \
    --arg cloneName "$clone_name" \
    --arg unitConflict "$unit_conflict" \
    --arg mountConflict "$mount_conflict" \
    '
    def null_if_empty: if . == "" then null else . end;
    def bool_or_null:
        if . == "true" then true
        elif . == "false" then false
        else null end;
    {
        status: $status,
        mode: $mode,
        nodeKind: $nodeKind,
        nodeRole: $nodeRole,
        deploymentType: $deploymentType,
        serviceState: $serviceState,
        pgdata: $pgdata,
        walTarget: $walTarget,
        pgVersionMajor: $pgVersionMajor,
        primaryHost: ($primaryHost | null_if_empty),
        dataMount: $dataMount,
        walMount: $walMount
    }
    + (if $svmName != "" then {
        svmName: $svmName,
        svmUuid: $svmUuid,
        dataVolume: $dataVolume,
        dataVolumeUuid: $dataVolumeUuid,
        logVolume: $logVolume,
        logVolumeUuid: $logVolumeUuid,
        filesystemId: $filesystemId,
        credsSource: $credsSource
    } else {} end)
    + (if $filesystemId != "" and $svmName == "" then {filesystemId: $filesystemId} else {} end)
    + (if $need != "" then {need: $need} else {} end)
    + (if $reason != "" then {reason: $reason} else {reason: null} end)
    + (if $error != "" then {error: $error} else {} end)
    + (if $alreadyExists != "" then {
        alreadyExists: ($alreadyExists | bool_or_null),
        ownerExists: ($ownerExists | bool_or_null)
    } else {} end)
    + (if $cloneRequested == "true" then {
        pgdataConflict: ($pgdataConflict | bool_or_null),
        portInUse: ($portInUse | bool_or_null),
        clonePort: $clonePort,
        cloneName: $cloneName,
        unitConflict: ($unitConflict | bool_or_null),
        mountConflict: ($mountConflict | bool_or_null)
    } else {} end)
    '
