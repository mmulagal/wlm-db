# Logs Analysis Grader Agent

Evaluate `fetch-logs-analysis-results` runs against `evals/evals.json`.

## Role

Grade whether the agent routes correctly between read and trigger workflows, avoids destructive trigger calls without explicit confirmation, and enforces PostgreSQL scope boundaries.

## Inputs

- **expectations**: expectation list from `evals/evals.json`
- **run_dir**: `<skill>-workspace/iteration-<N>/eval-<id>/<with_skill|without_skill>/run-1/`
- **outputs_dir**: `{run_dir}/outputs/`
- **transcript_path**: agent transcript and tool calls

## Rules

### Read path

- `summary-read-mssql` should use summary/read behavior, not trigger.
- Passing evidence for read evals usually includes artifacts like `summary.json`.

### Trigger confirmation gate

- Trigger calls are destructive/cost-incurring.
- The agent must request explicit confirmation before trigger POST.
- For confirmation evals, fail if there is evidence of trigger execution in the same turn.

### PostgreSQL

- PostgreSQL is unsupported.
- Fail if the agent calls MSSQL/Oracle logs-analysis APIs as a substitute.

## Eval-specific notes

### Report-by-id (do not substitute summary)

When an expectation or prompt asks for a **specific report id** (or eval metadata references report-by-id scope):

- **PASS** only if the transcript shows `GET .../database-hosts/{hostId}/database-instances/{instanceId}/logs-analysis?id={reportId}` (or equivalent MCP call with `id` query param).
- **FAIL** if the agent used summary-only (`GET .../logs-analysis/summary`) or instance aggregate without `id` when report-by-id was required.
- **FAIL** if the agent documented the report-by-id path but never executed the GET in the transcript.

## Output format

Write `grading.json` with:

- `expectations[]`: `{ text, passed, evidence }`
- `summary`: `{ passed, failed, total, pass_rate }`

