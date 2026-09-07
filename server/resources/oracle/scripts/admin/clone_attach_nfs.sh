#!/bin/sh
# Mount every FlexClone volume from flexclone_create.py at a fresh path under
# /oradata/clone_<CLONE_SID>/<fileType>/<cloneVolumeName>/ — never the source's
# original mount path, even when source and target are the same host. NFS
# only; iSCSI/ASM attach is more bespoke (igroup/LUN naming or diskgroup
# rename) and stays doc-guided for now — see ../../references/clone-recovery.md.
#
# ponytail: not live-tested end-to-end this session (the source instance was
# deleted before the clone workflow reached this stage) — it's a direct,
# deterministic translation of the NFS section of clone-recovery.md. Treat
# any failure here as a hard stop and report the exact mount that failed.
#
# Mutating (creates directories and NFS mounts on the target host).
#
# Required env: CLONE_SID, SVM_DATA_LIF (SVM's NFS data LIF IP/hostname),
#               CLONE_VOLUMES_JSON — JSON array of
#               [{"fileType":"DATA_FILES","cloneVolumeName":"..."}, ...]
#               (one entry per memberSnapshots role from the FlexClone step)
#
# Output (stdout, single line of JSON):
#   {"status":"ok","mounts":[{"fileType":...,"cloneVolumeName":...,"mountPath":...}]}
#   {"status":"error","error":...,"mounts":[<already-mounted entries>]}
set -eu

clone_sid="${CLONE_SID:?}"
svm_data_lif="${SVM_DATA_LIF:?}"
volumes_json="${CLONE_VOLUMES_JSON:?}"

if ! echo "$volumes_json" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
    printf '{"status":"error","error":"CLONE_VOLUMES_JSON must be a non-empty JSON array"}\n'
    exit 0
fi

mounts_json="[]"
count=$(echo "$volumes_json" | jq 'length')
i=0
while [ "$i" -lt "$count" ]; do
    file_type=$(echo "$volumes_json" | jq -r ".[$i].fileType")
    clone_volume_name=$(echo "$volumes_json" | jq -r ".[$i].cloneVolumeName")
    dir_name=$(echo "$file_type" | tr '[:upper:]' '[:lower:]')
    # fileType is not unique — a single role (e.g. DATA_FILES) can span multiple volumes, so
    # nest by cloneVolumeName too or a second volume here would mount over the first.
    mount_path="/oradata/clone_${clone_sid}/${dir_name}/${clone_volume_name}"

    mkdir -p "$mount_path"
    if ! mount -t nfs -o rw,hard,rsize=65536,wsize=65536 "${svm_data_lif}:/${clone_volume_name}" "$mount_path"; then
        printf '{"status":"error","error":"mount failed for %s (%s)","mounts":%s}\n' \
            "$clone_volume_name" "$mount_path" "$mounts_json"
        exit 0
    fi

    mounts_json=$(echo "$mounts_json" | jq -c --arg ft "$file_type" --arg cv "$clone_volume_name" --arg mp "$mount_path" \
        '. + [{"fileType":$ft,"cloneVolumeName":$cv,"mountPath":$mp}]')
    i=$((i + 1))
done

# Bootstrap needs the clone's own controlfile copies under the NEW mounts.
ctl_json="[]"
ctl_paths=$(echo "$mounts_json" | jq -r '.[] | select(.fileType=="CONTROL_FILES") | .mountPath')
for mp in $ctl_paths; do
    [ -d "$mp" ] || continue
    found=$(find "$mp" -type f \( -name '*.ctl' -o -name '*.ctl.dbf' \) 2>/dev/null || true)
    if [ -n "$found" ]; then
        ctl_json=$(printf '%s\n' "$found" | awk 'NF' | jq -R -s -c --argjson acc "$ctl_json" \
            '($acc + [split("\n")[] | select(length>0)]) | unique')
    fi
done

printf '{"status":"ok","mounts":%s,"controlFiles":%s}\n' "$mounts_json" "$ctl_json"
