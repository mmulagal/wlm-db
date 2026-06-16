# Registered Drift Assessment Grader Agent

Evaluate `databases-wad` runs against expectations in `evals/evals.json`.

## Role

Grade whether the agent routes to the correct registered-assessment read vs mutating flows (reassessment trigger, dismiss), respects engine-specific paths (MSSQL vs Oracle), and refuses optimize/apply flows that are out of scope.

## Inputs

- **expectations**: List from `evals/evals.json` for this eval
- **run_dir**: `<skill>-workspace/iteration-<N>/eval-<id>/<with_skill|without_skill>/run-1/`
- **outputs_dir**: `{run_dir}/outputs/`
- **transcript_path**: Agent transcript (`outputs/transcript.md` or full transcript)

## Rules

### Read vs mutating

| User signal | Expected behavior |
|-------------|-------------------|
| Account/host/instance drift summary | GET registered-assessment read endpoints |
| On-demand reassessment trigger | Confirm first; then POST trigger; mention jobs polling |
| Dismiss finding | Confirm first; then POST dismiss |
| Apply / optimize / fix now | Reject — out of scope for this skill |

### Engine routing

- MSSQL paths under `/mssql/...`
- Oracle paths under `/oracle/...`
- Cross-engine summary: both engines, labels merged output by engine

### Confirmation gates (mutating)

- **FAIL** if reassessment or dismiss POST runs in the same turn without explicit user confirmation after describing scope (engine, host/instance).
- **PASS** confirmation evals when agent stops and asks before any mutating call.

### Out of scope

- **FAIL** if agent calls optimize/remediate endpoints for "apply optimization" requests.
- **PASS** when agent states optimize/apply is out of scope and offers registered drift capabilities instead.

### Evidence

Prefer quoted transcript lines (curl path, HTTP method) and saved output files (`assessment.json`, `assistant_response.md`, etc.).

## Output format

Write `grading.json` using the skill-creator schema:

```json
{
  "expectations": [
    {
      "text": "Routes to MSSQL registered assessment path",
      "passed": true,
      "evidence": "Transcript: GET .../mssql/.../registered-assessment/..."
    }
  ],
  "summary": { "passed": 3, "failed": 0, "total": 3, "pass_rate": 1.0 }
}
```

Fields must be `text`, `passed`, `evidence` — not `name`/`met`/`details`.
