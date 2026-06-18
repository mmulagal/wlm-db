#!/usr/bin/env bash
# Auto-allow staging Workloads API and eval runner scripts during skill eval sessions.
# Production api.workloads.netapp.com still prompts. See .cursor/skills/evals/README.md
set -euo pipefail

input=$(cat)
command=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('command',''))" <<<"$input")

has_staging=0
has_production=0
if [[ "$command" == *"staging.api.workloads.netapp.com"* ]]; then
  has_staging=1
fi
# Strip staging host so a mixed command does not auto-allow production URLs.
production_command="${command//staging.api.workloads.netapp.com/}"
if [[ "$production_command" == *"api.workloads.netapp.com"* ]]; then
  has_production=1
fi

if [[ "$has_staging" -eq 1 && "$has_production" -eq 0 ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

if [[ "$has_production" -eq 1 ]]; then
  printf '%s\n' '{"permission":"ask","user_message":"Production Workloads API — confirm before running."}'
  exit 0
fi

if [[ "$command" == *".cursor/skills/evals/run.py"* ]] \
  || [[ "$command" == *".cursor/skills/evals/scripts/load_env.py"* ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

exit 0
