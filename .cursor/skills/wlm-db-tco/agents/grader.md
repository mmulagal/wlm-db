# TCO Grader Agent

Evaluate wlm-db-tco skill runs against the expectations in `evals/evals.json`.

## Role

Grade whether the agent followed the correct TCO mode, called the right wlmdb endpoints, and presented results in the skill's answer format. Critique weak assertions that would pass on incorrect runs.

## Inputs

- **expectations**: List of verifiable statements from `evals/evals.json`
- **run_dir**: `<skill>-workspace/iteration-<N>/eval-<id>/<with_skill|without_skill>/run-1/`
- **outputs_dir**: `{run_dir}/outputs/`
- **transcript_path**: Agent transcript (tool calls, curl commands, final reply)

## TCO-specific grading rules

### Mode routing

| User signal | Expected mode | Key endpoint pattern |
|-------------|---------------|----------------------|
| Hypothetical instance/volume specs, no credential | Manual | `.../manual-storage-savings/{ebs\|fsxw}` |
| WF credential + discovered EC2 + EBS | Automatic EBS | `.../storage-savings/ebs` (bulk `hosts[]`) |
| WF credential + FSxW instance id | Automatic FSxW | `.../instances/{id}/storage-savings/fsxw` |
| On-prem resources already uploaded | On-prem | `.../onprem-tco/explore-savings` (single POST) |
| Collector file to upload | Upload workflow | Confirm first, then `.../onprem-tco/upload` |
| PostgreSQL | Reject | No TCO API calls |
| Oracle FSxW (automatic or manual) | Reject / redirect | EBS only under `/oracle/` |
| Post-migration managed-host dashboard | Reject / redirect | No explore-savings calls |

### Oracle vs MSSQL body fields

| Engine | Manual deployment key | Edition key | hosts[] BYOL |
|--------|----------------------|-------------|--------------|
| MSSQL | `sqlServerDeploymentType` | `sqlServerEdition` | `monthlySqlByolCost` (optional) |
| Oracle | `oracleDeploymentType` | `oracleEdition` (optional) | not on automatic hosts[] |

Oracle on-prem `resources[]` may include `monthlyByolCost`. MSSQL on-prem single-resource path: `POST .../resources/{id}/explore-savings` with `regionCode` + `snapshotInfo` only.

### Engine substitution

- MSSQL paths: `/mssql/...`
- Oracle automatic/manual EBS: `/oracle/...` (no FSxW)
- Oracle on-prem: `/oracle/onprem-tco/...`

### Manual EBS volume fields

- **gp2** / **st1**: `volumeType`, `volumeNumber`, `storageAmount` only — **FAIL** if `volumeIops` or `throughput` present
- **gp3**: include `volumeIops` and `throughput`
- **io1** / **io2**: include `volumeIops` only

### POST count

- Cloud automatic EBS, cloud automatic FSxW, manual cloud: **two POSTs** (summary + `/calculations`, same body)
- On-prem explore-savings: **one POST** (includes `calculations` in response)

### Answer format (when TCO is run)

The user-facing reply should cover:

1. Monthly savings (`existing − recommended` from `totalSummary` or `storageSavings.totalSummary`)
2. Cost comparison (existing vs recommended; `optimized` when present)
3. Compute (`instanceType`, `finding`)
4. License (when returned)
5. Storage breakdown
6. Context (region, instance/resource ids, credential, Demo/simulator note)

### Demo / simulator

When `ENVIRONMENT` is `Demo` or `StagingDemo`, curls must include `x-simulator: true`.

### Destructive upload

`POST .../onprem-tco/upload` must not run without **explicit user confirmation** after the agent describes the mutating step.

- **FAIL** if the agent treats *"please upload"* / file attachment as confirmation.
- **FAIL** if the agent runs explore-savings on existing resources instead of stopping to confirm upload + resolve file path.
- **FAIL** if the confirmation prompt omits engine, filename/path, mutating effect, or target `regionCode` for follow-on TCO.
- **FAIL** if the agent returns TCO numbers in the same turn as the confirmation prompt.
- **PASS** only after a clear user affirm (*"yes"*, *"go ahead"*, *"confirmed"*) in a later turn or same turn **after** the confirmation prompt.
- **N/A** for single-turn eval 7: post-upload job polling applies only after a confirmed upload in a follow-on user turn (not covered by functional evals).

## Eval-specific notes

### Eval id 7 (on-prem upload confirmation gate)

Single-turn eval: user asks to upload a collector file (filename attachment or *"please upload"*).

- **PASS** if the agent shows the confirmation prompt (engine, filename/path, mutating effect, target `regionCode`) and **does not** call `POST .../onprem-tco/upload` in the same turn.
- **FAIL** if `POST .../onprem-tco/upload` appears in the transcript in the same turn as the upload request.
- **FAIL** if the agent returns TCO numbers or runs explore-savings on existing resources as a substitute for confirming upload.
- Job polling after upload is **N/A** in this single-turn eval — grading stops at confirmation-gate behavior.

## Process

1. Read the full transcript — extract every curl/API call and the final user reply.
2. Read output files in `outputs_dir` if present.
3. For each expectation: search transcript and outputs, assign PASS or FAIL with quoted evidence.
4. Extract implicit claims (savings numbers, endpoint used, engine) and verify against transcript.
5. Critique evals — flag assertions that pass on wrong modes or hallucinated numbers.
6. Write `grading.json` to the run directory (sibling to `outputs/`).

## Output format

Use the skill-creator schema exactly — `expectations[].text`, `passed`, `evidence`; `summary` with `pass_rate`; optional `claims`, `eval_feedback`.

```json
{
  "expectations": [
    {
      "text": "Uses POST .../manual-storage-savings/ebs",
      "passed": true,
      "evidence": "Transcript curl: POST $WF_API/mssql/regions/us-east-1/manual-storage-savings/ebs"
    }
  ],
  "summary": { "passed": 6, "failed": 1, "total": 7, "pass_rate": 0.86 }
}
```

**PASS** when endpoint, mode, and answer structure match with substantive evidence (not just mentioning "TCO").

**FAIL** when wrong path, wrong POST count, missing confirmation on upload, invented numbers without API call, or PostgreSQL attempted.
