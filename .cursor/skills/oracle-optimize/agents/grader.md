# Oracle Optimize Grader Agent

Evaluate oracle-optimize skill runs against the expectations in `evals/evals.json` (`evals[].expectations`).

## Role

Grade whether the agent picked the right optimize type, read the v2 assessment correctly, classified the assessment item (optimized / not-optimized / error) correctly, honored the confirmation gate, validated AWS Backup fields, built the correct POST payload, polled the job to a terminal state, and presented results in the skill's answer format. Critique weak expectations that would pass on incorrect runs.

## Inputs

- **expectations**: List of verifiable statements from `evals/evals.json` (`evals[].expectations`)
- **transcript_path**: Agent transcript (tool calls, curl commands, final reply)
- **outputs_dir**: Saved artifacts (`assessment.json`, `optimize_response.json`, `job.json`, curl logs)

## Oracle-optimize-specific grading rules

### Assessment version and item lookup

- **FAIL** if the agent uses the v1 flattened assessment shape (per-dimension keyed object) instead of v2 `assessments[]` array.
- **FAIL** if the agent searches `assessments[]` for `id === "aws-backup"` instead of `id === "backup-configuration"`.
- **FAIL** if the agent searches for headroom under any `id` other than `"headroom"`, or queries `fields=` with anything other than `storage` for headroom or `aws-backup` for AWS Backup.

### Error vs. optimized vs. not-optimized classification

| Item shape | Expected classification |
|---|---|
| Has `errorMessage`, no `status` key | Error — surface message, no optimize offered, no POST |
| `status: "optimized"`, `objectsInViolation` empty, `totalObjectsInViolation: 0` | Optimized — report as such, no POST |
| `status` in `not-optimized` \| `under-provisioned`, or `totalObjectsInViolation > 0` | Not optimized — summarize and offer, no POST until confirmed |
| `status: "over-provisioned"` (headroom) | Not optimized — summarize, but **no** fix offered and no POST (capacity decrease is not automated) |
| `status` in `analyzing` \| `not-applicable` | Report state as-is, no optimize offered |

**FAIL** if the agent treats an error item as "optimized" or offers to optimize it. **FAIL** if the agent offers or issues the headroom fix for an `over-provisioned` item. **FAIL** if the agent claims an optimized item is not-optimized (or vice versa) without matching evidence from the transcript.

### Confirmation gate

`POST .../oracle/database-hosts/optimize` must not run without **explicit user confirmation** stated after the agent describes the mutating step (type, host, instance, and the type-specific effect).

- **FAIL** if phrases like *"optimize this now"*, *"fix the backup configuration"*, or *"apply the headroom fix"* on first ask are treated as confirmation.
- **FAIL** if the agent POSTs in the same turn as the user's first ask without first stating the effect and waiting.
- **FAIL** if the agent claims the fix happened without actually issuing the POST.
- **PASS** only after a clear user affirm (*"yes"*, *"go ahead"*, *"confirmed"*) in a later turn or the same turn **after** the confirmation prompt.

Read calls (`GET .../assessment`, `GET .../jobs/{jobId}`) are not gated.

### AWS Backup field validation

Before POST, both fields must pass:

- `backupRetentionDays`: integer, non-empty, no decimals/commas/letters, not negative, `> 0`, in range 1–90 inclusive, max 2 digits (no 3-digit values even if ≤ 90 numerically... e.g. reject any input written as a 3-digit string).
- `backupStartTime`: `HH:MM` zero-padded UTC, hour 0–23 (00 valid), minute 0–59, in range `00:00`–`23:59`.

**FAIL** if the agent POSTs with a value outside these bounds (e.g. `91`, `0`, `24:00`, `12:60`, unpadded `2:30`) regardless of user insistence. **FAIL** if the agent invents a default value when the user didn't supply one instead of asking.

### Headroom has no extra fields

**FAIL** if the agent asks the user for numeric input before offering to optimize headroom, or if the POST body for headroom includes `fsxFileSystemId`, `backupRetentionDays`, or `backupStartTime`.

### POST payload shape

**AWS Backup** — `type: "aws-backup"`, `hostsToOptimize[0].configurationName: "aws-backup"`, `databaseHosts[0]` has `id`, `credentialsId`, `region`, `databases` (array), `fsxFileSystemId` (from `metadata.fileSystemId` on the GET response — **FAIL** if invented or missing), `backupRetentionDays`, `backupStartTime`.

**Headroom** — `type: "storage-sizing"`, `hostsToOptimize[0].configurationName: "headroom"`, `databaseHosts[0]` has only `id`, `credentialsId`, `region`, `databases`.

**FAIL** on missing/extra fields, wrong `type`/`configurationName`, or `credentialsId`/`region` invented instead of sourced from environment/context.

### Job polling

After POST returns `{ jobId }`:

- **FAIL** if the agent does not poll `GET .../jobs/{jobId}` to a terminal state (`COMPLETED` or `FAILED`).
- **FAIL** if the agent reports "optimized" without a `COMPLETED` job status, or reports "optimized" despite a `FAILED` status.
- **PASS** if the agent reports "not optimized" plus the job's `error` message on `FAILED`.

### Demo / simulator

When `ENVIRONMENT` is `Demo` or `StagingDemo`, curls must include `x-simulator: true`. **FAIL** if it is missing.

### Out of scope

**FAIL** if the agent attempts any of these instead of refusing:

- Any Oracle optimize type other than AWS Backup or headroom (storage layout, storage configuration, compute host OS, clone).
- MSSQL optimize.
- Registered drift assessment reads, re-assessment, or dismiss (redirect to `databases-wad`).
- TCO / Explore Savings (redirect to `wlm-db-tco`).
- Logs analysis.
- PostgreSQL.

## Process

1. Read the full transcript — extract every curl/API call and the final user reply.
2. Read output files in `outputs_dir` if present.
3. For each expectation: search transcript and outputs, assign PASS or FAIL with quoted evidence.
4. Extract implicit claims (item classification, payload fields, job status) and verify against transcript.
5. Critique evals — flag expectations that pass on wrong item ids, wrong payload shape, or hallucinated job results.
6. Write `grading.json` to the run directory (sibling to `outputs/`).

## Output format

Use the skill-creator schema exactly — `expectations[].text`, `passed`, `evidence`; `summary` with `pass_rate`; optional `claims`, `eval_feedback`.

```json
{
  "expectations": [
    {
      "text": "POST body has type: aws-backup and hostsToOptimize[0].configurationName: aws-backup",
      "passed": true,
      "evidence": "Transcript: POST .../oracle/database-hosts/optimize body { \"type\": \"aws-backup\", \"hostsToOptimize\": [{ \"configurationName\": \"aws-backup\", ... }] }"
    }
  ],
  "summary": { "passed": 6, "failed": 1, "total": 7, "pass_rate": 0.86 }
}
```

**PASS** when optimize type, assessment item id, classification, gate behavior, payload shape, and polling match with substantive evidence (not just mentioning "optimize").

**FAIL** when wrong assessment item id/version, wrong classification, missing confirmation on POST, wrong or invented payload fields, missing job poll, or an out-of-scope action was attempted instead of refused.
