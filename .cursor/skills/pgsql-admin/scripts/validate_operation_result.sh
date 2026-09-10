#!/usr/bin/env bash
# Validate a pgsql-admin result envelope against its schema.
# Usage: validate_operation_result.sh <json-file> <kind>
# Kinds: topology | target | volumes | snapshot | database | clone
set -euo pipefail

FILE="${1:?usage: validate_operation_result.sh <json-file> <kind>}"
KIND="${2:?kind must be topology, target, snapshot, database, clone, or volumes}"

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
# Use if/then: under set -e, `jq -e … && fail` returns 1 when there is no error field
# and aborts the script.
if jq -e '(.error // null) != null' "$FILE" >/dev/null 2>&1; then
    fail "envelope reports an error: $(jq -r '.error' "$FILE")"
fi

case "$KIND" in
    topology)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok: $(jq -r '.status // "missing"' "$FILE")"
        jq -e '
            (.deploymentType == "standalone" and .nodeRole == "none")
            or (.deploymentType == "ha" and .nodeRole == "primary")
        ' "$FILE" >/dev/null || fail "topology is not a usable source (need standalone+nodeRole=none or ha+nodeRole=primary)"
        jq -e '.pgdata | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing pgdata"
        jq -e '.walTarget | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing walTarget"
        jq -e '.dataMount.nfs == true' "$FILE" >/dev/null || fail "dataMount is not NFS"
        jq -e '.walMount.nfs == true' "$FILE" >/dev/null || fail "walMount is not NFS"
        jq -e '.pgVersionMajor | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing pgVersionMajor"
        pass "topology envelope is a supported NFS layout on the primary (or standalone)"
        ;;
    target)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok: $(jq -r '.reason // "missing"' "$FILE")"
        jq -e '.pgVersionMajor | type == "string" and length > 0' "$FILE" >/dev/null \
            || fail "target pgVersionMajor could not be determined — refuse rather than assume a match"
        jq -e '.pgdataConflict == false' "$FILE" >/dev/null || fail "target PostgreSQL is running on the clone PGDATA path"
        jq -e '.portInUse == false' "$FILE" >/dev/null || fail "clonePort is in use, or CLONE_PORT was not supplied"
        jq -e '.unitConflict == false' "$FILE" >/dev/null \
            || fail "postgresql-<cloneName>.service already exists on the target, or CLONE_NAME was not supplied"
        jq -e '.mountConflict == false' "$FILE" >/dev/null || fail "a clone mount path is already an active mount point"
        pass "target envelope is a usable clone destination"
        ;;
    volumes)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.svmName | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing svmName"
        jq -e '.svmUuid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing svmUuid"
        jq -e '.dataVolume | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing dataVolume"
        jq -e '.logVolume | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing logVolume"
        jq -e '.dataVolume != .logVolume' "$FILE" >/dev/null || fail "dataVolume and logVolume must differ"
        jq -e '.filesystemId | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing filesystemId"
        pass "volumes envelope has resolved data and WAL ONTAP volumes"
        ;;
    snapshot)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.consistencyGroupUuid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing consistencyGroupUuid"
        jq -e '.groupSnapshotUuid | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing groupSnapshotUuid"
        jq -e '.memberSnapshots | type == "array" and length == 2' "$FILE" >/dev/null || fail "memberSnapshots must have exactly 2 entries (data + WAL)"
        jq -e '.memberSnapshots | all(.[]; (.volumeUuid | length > 0) and (.snapshotName | length > 0))' "$FILE" >/dev/null \
            || fail "memberSnapshots entries missing volumeUuid or snapshotName"
        jq -e '.retentionLabel | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing retentionLabel"
        pass "snapshot envelope has a crash-consistent group snapshot with 2 member volumes"
        ;;
    database)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.databaseName | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing databaseName"
        jq -e '.verified == true' "$FILE" >/dev/null || fail "database creation was not verified against pg_database"
        pass "database envelope reports a verified creation"
        ;;
    clone)
        jq -e '.status == "ok"' "$FILE" >/dev/null || fail "status is not ok"
        jq -e '.clonedVolumes | type == "array" and length == 2' "$FILE" >/dev/null || fail "clonedVolumes must have exactly 2 entries (data + WAL)"
        jq -e '.pgdata | type == "string" and length > 0' "$FILE" >/dev/null || fail "missing pgdata"
        jq -e '.port | type == "number"' "$FILE" >/dev/null || fail "missing numeric port"
        jq -e '.serviceUnit | type == "string" and startswith("postgresql-")' "$FILE" >/dev/null \
            || fail "clone must run under its own postgresql-<cloneName>.service, not the target's postgresql.service"
        jq -e '.serviceState == "running"' "$FILE" >/dev/null || fail "serviceState is not running"
        jq -e '.verified == true' "$FILE" >/dev/null || fail "clone was not verified (pg_isready / pg_is_in_recovery / catalog query)"
        pass "clone envelope reports a verified running clone"
        ;;
    *)
        fail "unknown kind: $KIND"
        ;;
esac
