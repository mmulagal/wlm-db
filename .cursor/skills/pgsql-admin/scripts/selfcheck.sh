#!/usr/bin/env bash
# Self-check for validate_operation_result.sh envelope rules.
# Run: scripts/selfcheck.sh   (exits non-zero on the first wrong verdict)
#
# Covers the co-located clone paradigm: a target that already runs PostgreSQL is accepted,
# while a taken unit name, a busy mount path, a busy port, or a clone that ran under the
# host's own postgresql.service is rejected.
set -euo pipefail

HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
VALIDATE="$HERE/validate_operation_result.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
failures=0

# expect <pass|fail> <kind> <json>
expect() {
    local want="$1" kind="$2" json="$3" got
    printf '%s' "$json" > "$TMP/envelope.json"
    if bash "$VALIDATE" "$TMP/envelope.json" "$kind" >/dev/null 2>&1; then got=pass; else got=fail; fi
    if [[ "$got" != "$want" ]]; then
        echo "FAIL[$kind] wanted $want got $got: $json" >&2
        failures=$((failures + 1))
    fi
}

target='{"status":"ok","mode":"target","pgVersionMajor":"16","serviceState":"running","pgdataConflict":false,"portInUse":false,"cloneName":"c1","unitConflict":false,"mountConflict":false,"deploymentType":"ha","nodeRole":"primary"}'
# A busy host is a legal destination: the clone brings its own unit and port.
expect pass target "$target"
expect pass target "$(jq -c '.nodeRole="standby"' <<<"$target")"
expect pass target "$(jq -c '.deploymentType="standalone" | .nodeRole="none" | .serviceState="not_running"' <<<"$target")"
expect fail target "$(jq -c '.unitConflict=true' <<<"$target")"
expect fail target "$(jq -c '.unitConflict=null' <<<"$target")"
expect fail target "$(jq -c '.mountConflict=true' <<<"$target")"
expect fail target "$(jq -c '.portInUse=true' <<<"$target")"
expect fail target "$(jq -c '.pgdataConflict=true' <<<"$target")"
expect fail target "$(jq -c '.pgVersionMajor=""' <<<"$target")"
expect fail target "$(jq -c '.status="unsupported"' <<<"$target")"

clone='{"status":"ok","clonedVolumes":[{"volumeUuid":"u1","volumeName":"d","mountPath":"/pgdata-clone-c1"},{"volumeUuid":"u2","volumeName":"w","mountPath":"/pglog-clone-c1"}],"pgdata":"/pgdata-clone-c1","port":5433,"serviceUnit":"postgresql-c1.service","serviceState":"running","verified":true}'
expect pass clone "$clone"
# Adopting the target's own service is the failure mode this paradigm exists to prevent.
expect fail clone "$(jq -c '.serviceUnit="postgresql.service"' <<<"$clone")"
expect fail clone "$(jq -c 'del(.serviceUnit)' <<<"$clone")"
expect fail clone "$(jq -c '.verified=false' <<<"$clone")"
expect fail clone "$(jq -c '.clonedVolumes=[.clonedVolumes[0]]' <<<"$clone")"

# A source envelope must still be standalone+none or ha+primary — never a standby.
topology='{"status":"ok","pgdata":"/d","walTarget":"/w/pg_wal","dataMount":{"nfs":true},"walMount":{"nfs":true},"deploymentType":"ha","nodeRole":"primary","pgVersionMajor":"16"}'
expect pass topology "$topology"
expect fail topology "$(jq -c '.nodeRole="standby"' <<<"$topology")"
expect fail topology "$(jq -c '.dataMount={"nfs":false}' <<<"$topology")"

if (( failures > 0 )); then
    echo "$failures check(s) failed" >&2
    exit 1
fi
echo "selfcheck: all envelope rules behaved as expected"

# A syntax error in an extracted remote script should fail here, not on an SSM call.
syntax_failures=0
for script in "$HERE"/*.sh; do
    if ! bash -n "$script"; then
        echo "FAIL[syntax] bash -n $script" >&2
        syntax_failures=$((syntax_failures + 1))
    fi
done
if (( syntax_failures > 0 )); then
    echo "$syntax_failures script(s) failed bash -n" >&2
    exit 1
fi
echo "selfcheck: bash -n passed for scripts/*.sh"

# Wrapper rejects ONTAP names with hyphens before any POST (ONTAP 917888).
hyphen_payload="$TMP/hyphen.json"
jq -n '{
  region:"us-east-1", instanceId:"i-0123456789abcdef0", comment:"t",
  scriptId:"cg-flexclone",
  args:{
    SVM_NAME:"svm", DATA_VOLUME:"d", LOG_VOLUME:"l",
    FILESYSTEM_ID:"fs-0123456789abcdef0",
    DATA_CLONE_VOLUME:"wlmdb_pgsqldata_bhaskar-clone",
    WAL_CLONE_VOLUME:"wlmdb_pgsqllog_bhaskar_clone",
    MEMBER_SNAPSHOTS:"[]"
  }
}' > "$hyphen_payload"
if bash "$HERE/run_ssm_operation.sh" --payload "$hyphen_payload" >/dev/null 2>"$TMP/hyphen.err"; then
    echo "FAIL[ontap-name] hyphenated DATA_CLONE_VOLUME was accepted" >&2
    exit 1
fi
if ! grep -q "DATA_CLONE_VOLUME" "$TMP/hyphen.err"; then
    echo "FAIL[ontap-name] expected DATA_CLONE_VOLUME in error: $(cat "$TMP/hyphen.err")" >&2
    exit 1
fi
echo "selfcheck: ONTAP name hyphen rejection behaved as expected"
