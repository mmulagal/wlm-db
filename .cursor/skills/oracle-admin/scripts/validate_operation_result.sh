#!/usr/bin/env bash
# Validate an oracle-admin result envelope against its schema.
# Usage: validate_operation_result.sh <json-file> <kind>
# Kinds: topology | volumes | snapshot | database | clone
set -euo pipefail

FILE="${1:?usage: validate_operation_result.sh <json-file> <kind>}"
KIND="${2:?kind must be topology, snapshot, database, clone, or volumes}"

if ! command -v jq >/dev/null 2>&1; then
    echo "FAIL: jq required" >&2
    exit 1
fi
if [[ ! -f "$FILE" ]]; then
    echo "FAIL: file not found: $FILE" >&2
    exit 1
fi

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; exit 0; }

# An envelope with a populated `error` is always a failure, regardless of `kind`.
jq -e '(.error // null) != null' "$FILE" >/dev/null 2>&1 \
    && fail "envelope reports an error: $(jq -r '.error' "$FILE")"

case "$KIND" in
    topology)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok: $(jq -r '.status // "missing"' "$FILE")"
        jq -e '.deploymentType | IN("standalone","dataguard-primary")' "$FILE" >/dev/null \
            || fail "deploymentType must be standalone or dataguard-primary, got: $(jq -r '.deploymentType // "missing"' "$FILE")"
        jq -e '.oracleHome | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing oracleHome"
        jq -e '.isCDB | type == "boolean"' "$FILE" >/dev/null || fail "missing boolean isCDB"
        jq -e '.openMode | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing openMode"
        jq -e '.protocol | IN("NFS","iSCSI","ASM")' "$FILE" >/dev/null || fail "protocol must be NFS, iSCSI, or ASM"
        pass "topology envelope is a supported layout ($(jq -r '.deploymentType' "$FILE"))"
        ;;
    volumes)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.svmName | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing svmName"
        jq -e '.filesystemId | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing filesystemId"
        jq -e '.protocol | IN("NFS","iSCSI","ASM")' "$FILE" >/dev/null || fail "protocol must be NFS, iSCSI, or ASM"
        for ft in DATA_FILES CONTROL_FILES REDO_LOGS ARCHIVE_LOGS; do
            jq -e --arg ft "$ft" '.volumesByFileType[$ft] | type == "array" and length > 0' "$FILE" >/dev/null \
                || fail "missing volumesByFileType.$ft"
        done
        pass "volumes envelope has resolved DATA_FILES/CONTROL_FILES/REDO_LOGS/ARCHIVE_LOGS ONTAP volumes"
        ;;
    snapshot)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.consistencyGroupUuid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing consistencyGroupUuid"
        jq -e '.groupSnapshotUuid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing groupSnapshotUuid"
        jq -e '.memberSnapshots | type == "array" and length >= 4' "$FILE" >/dev/null \
            || fail "memberSnapshots must have at least 4 entries (data, control, redo, archive)"
        jq -e '.memberSnapshots | all(.[]; (.volumeUuid | length > 0) and (.snapshotName | length > 0) and (.fileType | length > 0))' "$FILE" >/dev/null \
            || fail "memberSnapshots entries missing volumeUuid, snapshotName, or fileType"
        jq -e '.retentionLabel | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing retentionLabel"
        pass "snapshot envelope has a crash-consistent group snapshot covering every required file type"
        ;;
    database)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.pdbName | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing pdbName"
        jq -e '.adminUser | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing adminUser"
        jq -e '.verified == true' "$FILE" >/dev/null || fail "PDB creation was not verified against V\$PDBS"
        pass "database envelope reports a verified PDB creation"
        ;;
    clone)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.clonedVolumes | type == "array" and length >= 4' "$FILE" >/dev/null \
            || fail "clonedVolumes must have at least 4 entries (data, control, redo, archive)"
        jq -e '.cloneSid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing cloneSid"
        jq -e '.listenerPort | type == "number"' "$FILE" >/dev/null || fail "missing numeric listenerPort"
        jq -e '.openMode == "READ WRITE"' "$FILE" >/dev/null || fail "openMode is not READ WRITE"
        jq -e '.verified == true' "$FILE" >/dev/null || fail "clone was not verified (V\$DATABASE.OPEN_MODE + catalog query)"
        pass "clone envelope reports a verified running clone"
        ;;
    *)
        fail "unknown kind: $KIND"
        ;;
esac
