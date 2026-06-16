#!/usr/bin/env bash
# Validate Explore Savings API response shape.
# Usage: validate_response.sh <json-file> <mode>
# Modes: cloud-summary | cloud-calculations | onprem-explore

set -euo pipefail

FILE="${1:?usage: validate_response.sh <json-file> <mode>}"
MODE="${2:?mode must be cloud-summary, cloud-calculations, or onprem-explore}"

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

case "$MODE" in
  cloud-summary)
    jq -e 'has("message") and (has("totalSummary") | not)' "$FILE" >/dev/null \
      && fail "API error: $(jq -r .message "$FILE")"
    jq -e '.totalSummary.existing | type == "number"' "$FILE" >/dev/null \
      || fail "missing totalSummary.existing"
    jq -e '.totalSummary.recommended | type == "number"' "$FILE" >/dev/null \
      || fail "missing totalSummary.recommended"
    pass "cloud summary has totalSummary.existing and totalSummary.recommended"
    ;;
  cloud-calculations)
    # Summary uses ebs/fsxw/fsx; /calculations uses *Calculation keys (see storage-savings.types.ts).
    jq -e 'any(
      [
        .ebsCalculation, .ebsCloneCalculation, .ebsSnapshotCalculation,
        .fsxwCalculation, .fsxwSnapshotCalculation, .fsxwCloneCalculation,
        .single, .multi, .fsxOptimizedSingle,
        .ebs, .fsxw, .fsx
      ][];
      . != null
    )' "$FILE" >/dev/null \
      || fail "missing calculation breakdown (ebsCalculation, fsxwCalculation, single/multi, or ebs/fsx/fsxw)"
    pass "cloud calculations has storage breakdown"
    ;;
  onprem-explore)
    jq -e '.storageSavings.totalSummary.existing | type == "number"' "$FILE" >/dev/null \
      || fail "missing storageSavings.totalSummary.existing"
    jq -e '.storageSavings.totalSummary.recommended | type == "number"' "$FILE" >/dev/null \
      || fail "missing storageSavings.totalSummary.recommended"
    jq -e '.calculations | type == "object"' "$FILE" >/dev/null \
      || fail "missing calculations object"
    pass "on-prem explore-savings has storageSavings.totalSummary and calculations"
    ;;
  *)
    fail "unknown mode: $MODE"
    ;;
esac
