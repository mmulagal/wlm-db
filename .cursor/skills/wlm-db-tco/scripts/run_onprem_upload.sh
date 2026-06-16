#!/usr/bin/env bash
# Run confirmed on-prem collector upload + job polling for MSSQL/Oracle.
# This script is intentionally explicit because upload is mutating.
#
# Usage:
#   TOKEN=... ACCOUNT_ID=... ENGINE=mssql FILE_PATH=... CONFIRM_UPLOAD=true \
#   ./scripts/run_onprem_upload.sh
#
# Required env:
#   ENGINE=mssql|oracle
#   FILE_PATH=/absolute/or/relative/path/to/collector-output.json
#   CONFIRM_UPLOAD=true
#
# Optional env:
#   ENVIRONMENT=Production|Staging|Demo|StagingDemo (default Demo)
#   POLL_SECONDS=15
#   JOB_TIMEOUT_SECONDS=900
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/.."
ENVIRONMENT="${ENVIRONMENT:-Demo}"
ACCOUNT_ID="${ACCOUNT_ID:-account-j3aZttuL}"
ENGINE="${ENGINE:-}"
FILE_PATH="${FILE_PATH:-}"
CONFIRM_UPLOAD="${CONFIRM_UPLOAD:-false}"
POLL_SECONDS="${POLL_SECONDS:-15}"
JOB_TIMEOUT_SECONDS="${JOB_TIMEOUT_SECONDS:-900}"

if [[ -z "${TOKEN:-}" ]]; then
  echo "ERROR: TOKEN is required." >&2
  exit 1
fi
TOKEN="$(printf '%s' "$TOKEN" | tr -d '\n\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^[Bb]earer[[:space:]]*//')"
if [[ "$CONFIRM_UPLOAD" != "true" ]]; then
  echo "ERROR: CONFIRM_UPLOAD=true is required for mutating upload." >&2
  exit 1
fi
if [[ "$ENGINE" != "mssql" && "$ENGINE" != "oracle" ]]; then
  echo "ERROR: ENGINE must be mssql or oracle." >&2
  exit 1
fi
if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  echo "ERROR: FILE_PATH must point to an existing collector file." >&2
  exit 1
fi

ENV_LOWER="$(printf '%s' "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]')"
case "$ENV_LOWER" in
  production|demo) WF_BASE="https://api.workloads.netapp.com" ;;
  staging|stagingdemo) WF_BASE="https://staging.api.workloads.netapp.com" ;;
  *) echo "Unknown ENVIRONMENT: $ENVIRONMENT" >&2; exit 1 ;;
esac

WF_API="$WF_BASE/accounts/$ACCOUNT_ID/wlmdb/v1"
USE_SIM=false
[[ "$ENV_LOWER" == "demo" || "$ENV_LOWER" == "stagingdemo" ]] && USE_SIM=true

wf_curl() {
  local args=(-sS -H "Authorization: Bearer $TOKEN")
  $USE_SIM && args+=(-H "x-simulator: true")
  if [[ "${1:-}" == "POST" ]]; then
    shift
    args+=(-H "Content-Type: application/json" -d "$1")
    shift
  fi
  curl "${args[@]}" "$@"
}

OUT_DIR="$SKILL_DIR/workspace/manual-upload-$ENGINE-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

FILE_NAME="$(basename "$FILE_PATH")"
FILE_CONTENT="$(python3 - "$FILE_PATH" <<'PY'
import base64
import gzip
import sys
from pathlib import Path

path = Path(sys.argv[1])
raw = path.read_bytes()
if path.suffix == ".gz" or path.name.endswith(".json.gz"):
    raw = gzip.decompress(raw)
inner_b64 = base64.b64encode(raw).decode("ascii")
compressed = gzip.compress(inner_b64.encode("utf-8"))
print(base64.b64encode(compressed).decode("ascii"))
PY
)"

UPLOAD_BODY="$(jq -n --arg fileName "$FILE_NAME" --arg fileContent "$FILE_CONTENT" \
  '{fileName:$fileName,fileContent:$fileContent}')"
UPLOAD_PATH="$WF_API/$ENGINE/onprem-tco/upload"

echo "==> Uploading collector ($ENGINE): $FILE_NAME"
wf_curl POST "$UPLOAD_BODY" "$UPLOAD_PATH" | tee "$OUT_DIR/upload_response.json" | jq .

JOB_ID="$(jq -r '.jobId // empty' "$OUT_DIR/upload_response.json")"
if [[ -z "$JOB_ID" ]]; then
  echo "ERROR: upload response missing jobId." >&2
  exit 1
fi

echo "==> Polling job: $JOB_ID"
START_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
while true; do
  wf_curl "$WF_API/jobs/$JOB_ID" | tee "$OUT_DIR/job_status.json" | jq .
  STATUS="$(jq -r '.status // empty' "$OUT_DIR/job_status.json")"
  if [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]]; then
    break
  fi
  NOW_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"
  ELAPSED="$(( (NOW_MS - START_MS) / 1000 ))"
  if [[ "$ELAPSED" -ge "$JOB_TIMEOUT_SECONDS" ]]; then
    echo "ERROR: job polling timed out after ${JOB_TIMEOUT_SECONDS}s." >&2
    exit 1
  fi
  sleep "$POLL_SECONDS"
done

echo "==> Listing uploaded resources"
wf_curl "$WF_API/$ENGINE/onprem-tco/resources?pageSize=20" | tee "$OUT_DIR/resources.json" | jq .
echo "Saved outputs under $OUT_DIR"
