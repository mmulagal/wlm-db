#!/usr/bin/env bash
# Send (or dry-run) a named allowlisted Oracle admin script through the hidden wlmdb
# POST .../oracle/.../run-script endpoint, which loads the script on the server and runs it
# via SSM on the target host. This wrapper never uploads shell.
#
# Every mutating scriptId requires BOTH the caller-supplied --apply flag AND CONFIRM=true
# in the environment — this mirrors the confirmation gate in
# ../references/confirmation-and-results.md and the CONFIRM_UPLOAD=true convention used by
# wlm-db-tco/scripts/run_onprem_upload.sh. Without --apply this script never calls curl; it
# only validates and prints the request it *would* send.
#
# Usage:
#   run_ssm_operation.sh --payload <file.json> [--apply] [--output DIR]
#
# Required env on --apply: TOKEN, ACCOUNT_ID, CREDENTIALS_ID, ENVIRONMENT
#
# Payload JSON:
#   {
#     "region": "us-east-1",
#     "instanceId": "i-0123456789abcdef0",          # unregistered host (or clone target)
#     "databaseHostId": "host-id",                   # registered host (instead of instanceId)
#     "databaseInstanceId": "instance-id",           # optional; only with databaseHostId
#     "comment": "oracle topology discovery",
#     "scriptId": "topology-check",                  # see ALLOWED_SCRIPT_IDS below
#     "args": { "ORACLE_SID": "orcl" }
#   }
set -euo pipefail

PAYLOAD=""
APPLY=false
OUTPUT_DIR=""
ALLOWED_SCRIPT_IDS='["topology-check","mapped-ontap-volumes","pdb-exists-check","create-pdb","clone-target-preflight","oracle-version-check","consistency-group-snapshot","flexclone-create","clone-attach-nfs","clone-bootstrap-pfile","clone-start-resetlogs"]'
MUTATING_SCRIPT_IDS='["create-pdb","consistency-group-snapshot","flexclone-create","clone-attach-nfs","clone-bootstrap-pfile","clone-start-resetlogs"]'

while [[ $# -gt 0 ]]; do
    case "$1" in
        --payload) PAYLOAD="$2"; shift 2 ;;
        --apply) APPLY=true; shift ;;
        --output) OUTPUT_DIR="$2"; shift 2 ;;
        --profile) shift 2 ;; # leftover; transport is wlmdb REST, not aws cli
        *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$PAYLOAD" || ! -f "$PAYLOAD" ]]; then
    echo "ERROR: --payload must point to an existing JSON file." >&2
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is required." >&2
    exit 1
fi

if jq -e 'has("command") or has("commandFile") or has("scriptBase64")' "$PAYLOAD" >/dev/null; then
    echo "ERROR: payload must send scriptId + args; command, commandFile, and scriptBase64 are rejected." >&2
    exit 1
fi

REGION=$(jq -r '.region // empty' "$PAYLOAD")
INSTANCE_ID=$(jq -r '.instanceId // empty' "$PAYLOAD")
DATABASE_HOST_ID=$(jq -r '.databaseHostId // empty' "$PAYLOAD")
DATABASE_INSTANCE_ID=$(jq -r '.databaseInstanceId // empty' "$PAYLOAD")
COMMENT=$(jq -r '.comment // empty' "$PAYLOAD")
SCRIPT_ID=$(jq -r '.scriptId // empty' "$PAYLOAD")
if [[ -z "$SCRIPT_ID" ]]; then
    echo "ERROR: payload missing required field: scriptId" >&2
    exit 1
fi
if ! jq -ne --arg id "$SCRIPT_ID" --argjson allowed "$ALLOWED_SCRIPT_IDS" '($allowed | index($id)) != null' >/dev/null; then
    echo "ERROR: unknown scriptId '$SCRIPT_ID' (allowed: $(jq -r 'join(", ")' <<<"$ALLOWED_SCRIPT_IDS"))." >&2
    exit 1
fi
MUTATING=$(jq -nr --arg id "$SCRIPT_ID" --argjson mutatingIds "$MUTATING_SCRIPT_IDS" \
    'if (($mutatingIds | index($id)) != null) then "true" else "false" end')
# Server args are Record<string, string>; stringify arrays/objects (e.g. CLONE_VOLUMES_JSON).
# REGION is injected by the server from the URL path, not as a client arg.
ARGS_JSON=$(jq -c \
    '((.args // {}) | with_entries(.value |= if type == "string" then . else tojson end))' \
    "$PAYLOAD")
ARGS_JSON_REDACTED=$(jq -c 'with_entries(if (.key | test("PASSWORD|SECRET|USERNAME"; "i")) then .value = "[REDACTED]" else . end)' <<<"$ARGS_JSON")

for field_name in REGION:region COMMENT:comment; do
    var_name="${field_name%%:*}"
    json_name="${field_name#*:}"
    if [[ -z "${!var_name}" ]]; then
        echo "ERROR: payload missing required field: $json_name" >&2
        exit 1
    fi
done
if [[ -z "$INSTANCE_ID" && -z "$DATABASE_HOST_ID" ]]; then
    echo "ERROR: payload needs instanceId (unregistered) or databaseHostId (registered)." >&2
    exit 1
fi
if [[ -n "$DATABASE_INSTANCE_ID" && -z "$DATABASE_HOST_ID" ]]; then
    echo "ERROR: databaseInstanceId requires databaseHostId." >&2
    exit 1
fi
if [[ -n "$INSTANCE_ID" && ! "$INSTANCE_ID" =~ ^i-[0-9a-f]{8,17}$ ]]; then
    echo "ERROR: instanceId '$INSTANCE_ID' does not match ^i-[0-9a-f]{8,17}\$." >&2
    exit 1
fi
fsid=$(jq -r '.FILESYSTEM_ID // empty' <<<"$ARGS_JSON")
if [[ -n "$fsid" && ! "$fsid" =~ ^fs-[0-9a-f]{8,17}$ ]]; then
    echo "ERROR: FILESYSTEM_ID '$fsid' does not match ^fs-[0-9a-f]{8,17}\$." >&2
    exit 1
fi

ENVIRONMENT="${ENVIRONMENT:-}"
case "$ENVIRONMENT" in
    Production|Demo) BASE_URL=https://api.workloads.netapp.com ;;
    Staging|StagingDemo) BASE_URL=https://staging.api.workloads.netapp.com ;;
    "") BASE_URL=https://api.workloads.netapp.com ;;
    *) echo "ERROR: unknown ENVIRONMENT='$ENVIRONMENT' (Production|Staging|Demo|StagingDemo)." >&2; exit 1 ;;
esac
# Local/dev API plane override (e.g. WLMDB_BASE_URL=http://localhost:8085).
BASE_URL="${WLMDB_BASE_URL:-$BASE_URL}"
ACCOUNT_ID="${ACCOUNT_ID:-}"
CREDENTIALS_ID="${CREDENTIALS_ID:-}"
URL="${BASE_URL}/accounts/${ACCOUNT_ID:-ACCOUNT_ID}/wlmdb/v1/oracle/credentials/${CREDENTIALS_ID:-CREDENTIALS_ID}/regions/${REGION}/run-script"
TARGET="${INSTANCE_ID:-$DATABASE_HOST_ID}"

if [[ "$MUTATING" == "true" && "$APPLY" != "true" ]]; then
    echo "REFUSED: mutating operation requires explicit user confirmation and --apply." >&2
    echo "Would run on $TARGET ($REGION): $COMMENT" >&2
    exit 2
fi
if [[ "$MUTATING" == "true" && "${CONFIRM:-false}" != "true" ]]; then
    echo "REFUSED: mutating operation requires CONFIRM=true in the environment." >&2
    exit 2
fi

BODY=$(jq -n \
    --arg ec2InstanceId "$INSTANCE_ID" \
    --arg databaseHostId "$DATABASE_HOST_ID" \
    --arg databaseInstanceId "$DATABASE_INSTANCE_ID" \
    --arg scriptId "$SCRIPT_ID" \
    --arg comment "$COMMENT" \
    --argjson args "$ARGS_JSON" \
    '{scriptId:$scriptId,args:$args,comment:$comment}
     + (if $ec2InstanceId != "" then {ec2InstanceId:$ec2InstanceId} else {} end)
     + (if $databaseHostId != "" then {databaseHostId:$databaseHostId} else {} end)
     + (if $databaseInstanceId != "" then {databaseInstanceId:$databaseInstanceId} else {} end)')

if [[ "$APPLY" != "true" ]]; then
    echo "DRY RUN: would POST run-script to $TARGET ($REGION):"
    jq -n --arg url "$URL" --arg instance "$INSTANCE_ID" --arg host "$DATABASE_HOST_ID" \
        --arg dbInstance "$DATABASE_INSTANCE_ID" --arg region "$REGION" --arg comment "$COMMENT" \
        --arg scriptId "$SCRIPT_ID" --argjson mutating "$MUTATING" --argjson args "$ARGS_JSON_REDACTED" \
        '{url:$url,region:$region,comment:$comment,scriptId:$scriptId,mutating:$mutating,args:$args}
         + (if $instance != "" then {ec2InstanceId:$instance} else {} end)
         + (if $host != "" then {databaseHostId:$host} else {} end)
         + (if $dbInstance != "" then {databaseInstanceId:$dbInstance} else {} end)'
    exit 0
fi

if [[ -z "${TOKEN:-}" || -z "$ACCOUNT_ID" || -z "$CREDENTIALS_ID" || -z "$ENVIRONMENT" ]]; then
    echo "ERROR: --apply requires TOKEN, ACCOUNT_ID, CREDENTIALS_ID, and ENVIRONMENT." >&2
    exit 1
fi

OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d)}"
mkdir -p "$OUTPUT_DIR"

CURL_ARGS=(-sSk -w "\n%{http_code}" -X POST "$URL" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")
if [[ "$ENVIRONMENT" == "Demo" || "$ENVIRONMENT" == "StagingDemo" ]]; then
    CURL_ARGS+=(-H "x-simulator: true")
fi

RESP=$(curl "${CURL_ARGS[@]}")
HTTP_CODE=$(printf '%s' "$RESP" | tail -n1)
RESP_BODY=$(printf '%s' "$RESP" | sed '$d')

redact() { sed -E 's/(password|Authorization|fsxpassword|FSX_PASSWORD|FSX_USERNAME|PDB_ADMIN_PASSWORD)[^,}"]*/\1":"[REDACTED]/gI'; }

RAW_FILE="$OUTPUT_DIR/raw.json"
RESULT_FILE="$OUTPUT_DIR/result.json"
printf '%s\n' "$RESP_BODY" | redact > "$RAW_FILE"

if [[ ! "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
    echo "ERROR: wlmdb run-script HTTP $HTTP_CODE" >&2
    jq -n --arg status "Failed" --arg http "$HTTP_CODE" --arg body "$(printf '%s' "$RESP_BODY" | redact)" \
        '{status:$status,httpCode:$http,output:$body}' > "$RESULT_FILE"
    echo "Saved $RESULT_FILE"
    exit 1
fi

OUTPUT=$(printf '%s' "$RESP_BODY" | jq -r '.output // empty' 2>/dev/null || true)
if [[ -z "$OUTPUT" ]]; then
    OUTPUT="$RESP_BODY"
fi
# Prefer the inner JSON envelope when output is itself JSON.
if printf '%s' "$OUTPUT" | jq -e . >/dev/null 2>&1; then
    printf '%s\n' "$OUTPUT" | redact > "$RESULT_FILE"
else
    jq -n --arg status "Success" --arg output "$(printf '%s' "$OUTPUT" | redact)" \
        '{status:$status,output:$output}' > "$RESULT_FILE"
fi

echo "Saved $RESULT_FILE"
exit 0
