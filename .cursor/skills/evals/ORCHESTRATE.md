# Orchestrate skill evals (skill-creator)

Agent playbook for running functional evals across all skills in this repo. Follows [skill-creator — Running and evaluating test cases](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md#running-and-evaluating-test-cases).

**Do not stop partway through.** Do not use `/skill-test` or other testing skills.

Shell scripts here only **validate JSON** and **finish** (benchmark + review). Steps 1–3 and grading are **agent work** — this document is how to do them.

---

## Repo layout

```text
.cursor/skills/
├── <skill>/
│   ├── SKILL.md
│   ├── agents/grader.md
│   └── evals/evals.json
├── <skill>-workspace/              # sibling, gitignored
│   └── iteration-<N>/
│       └── eval-<id>/              # flat name required (eval-1, eval-2, …)
│           ├── eval_metadata.json
│           ├── with_skill/run-1/
│           │   ├── outputs/        # transcript.md, API JSON, assistant_response.md
│           │   ├── grading.json    # sibling of outputs/, not inside it
│           │   └── timing.json
│           └── without_skill/run-1/   # same layout
├── evals/
│   ├── ORCHESTRATE.md              # this file
│   ├── run.py                      # validate | finish | all
│   └── scripts/load_env.py
└── skill-creator/                  # aggregate_benchmark, generate_review, package_skill
    ├── agents/                     # analyzer.md, comparator.md
    ├── assets/eval_review.html
    └── scripts/
```

**Skills with functional evals today:** `wlm-db-tco`, `fetch-logs-analysis-results`, `databases-wad`.

Schema reference: `.cursor/skills/skill-creator/references/schemas.md`

---

## Before you start

1. Copy credentials (never commit `local.env.json`):

   ```bash
   cp .cursor/skills/evals/local.env.example.json .cursor/skills/evals/local.env.json
   ```

2. Validate eval JSON for all skills:

   ```bash
   python3 .cursor/skills/evals/run.py validate
   ```

3. Pick iteration number `<N>` (e.g. `4`). Create directories as you go — do not pre-create the full tree.

4. For API evals, subagents should load env:

   ```bash
   eval "$(python3 .cursor/skills/evals/scripts/load_env.py <skill-name> --export)"
   ```

---

## Step 1: Spawn all runs (with-skill AND baseline) in the same turn

For **each skill**, for **each eval** in `evals/evals.json`, spawn **two subagents in the same turn** — one with the skill, one without. Do not run with-skill first and baselines later.

### With-skill executor

```text
Execute this eval task:
- Skill path: .cursor/skills/<skill-name>/
- Task: <eval.prompt from evals.json>
- Input files: <eval.files joined, or "none">
- Save outputs to: .cursor/skills/<skill-name>-workspace/iteration-<N>/eval-<id>/with_skill/run-1/outputs/
- Save transcript (tool calls + final reply) to: .../with_skill/run-1/outputs/transcript.md
- Outputs to save: API JSON, assistant_response.md, or whatever the eval expects
```

For Workload Factory API evals: load credentials via `load_env.py` for that skill; use staging + `x-simulator: true` when `ENVIRONMENT` is `StagingDemo`.

**On-prem upload confirmation (`wlm-db-tco` eval 7):** confirmation gate only — must **not** POST upload in the same turn. On-prem explore-savings (evals 4, 11, 12, 13) use pre-uploaded staging data.

### Baseline (without-skill)

For **new skills** (all skills here): no skill loaded.

```text
Execute this eval task with NO skill:
- Task: <same eval.prompt>
- Input files: <same as above>
- Save outputs to: .cursor/skills/<skill-name>-workspace/iteration-<N>/eval-<id>/without_skill/run-1/outputs/
- Save transcript to: .../without_skill/run-1/outputs/transcript.md
```

When **improving an existing skill**, skill-creator allows baseline = previous skill snapshot → `old_skill/outputs/`. Default here is `without_skill`.

### eval_metadata.json

Write for each eval directory (create per iteration; do not copy from prior iterations):

```json
{
  "eval_id": 1,
  "eval_name": "<name from evals.json>",
  "prompt": "<eval.prompt>",
  "expectations": []
}
```

Copy `expectations` from `evals/evals.json` when the eval starts; update both files if you refine them during the run.

### Run all skills

Repeat Step 1 for every skill listed above. Launch all subagents together (or parallel batches by skill if context limits require it).

---

## Step 2: Expectations

Expectations live in `evals/evals.json`. While runs are in progress, review them with the user if needed. Keep `eval_metadata.json` in sync when you refine them.

Good expectations are objectively verifiable and read clearly in the benchmark viewer.

---

## Step 3: Capture timing

When each subagent completes, save timing immediately to `timing.json` in the run directory (sibling to `outputs/`):

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

This data comes from the task completion notification only — capture it as each run finishes.

---

## Step 4: Grade, aggregate, review

### 4a. Grade each run

For every `with_skill/run-1/` and `without_skill/run-1/`:

1. Read `<skill>/agents/grader.md`
2. Read expectations from `evals/evals.json` for that eval id
3. Read `outputs/` and `transcript.md`
4. Write `grading.json` in the run directory

Required fields: `expectations[].text`, `passed`, `evidence`; `summary` with `pass_rate`. See `schemas.md`.

For objectively checkable expectations, you may run a small script — output must still be `grading.json` in the skill-creator schema.

### 4b. Aggregate + review (scripted)

After **all** skills are graded:

```bash
# one skill
python3 .cursor/skills/evals/run.py finish --iteration <N> --skills wlm-db-tco

# all skills with a workspace at iteration-<N>
python3 .cursor/skills/evals/run.py finish --iteration <N>
```

This runs skill-creator's `aggregate_benchmark.py` and `generate_review.py --static .../review.html`.

For iteration 2+, `run.py finish` automatically passes `--previous-workspace` to the prior iteration when that directory exists.

### 4c. Analyst pass (optional)

Read each `benchmark.json`. Flag non-discriminating expectations, flaky evals, and time/token tradeoffs. See `.cursor/skills/skill-creator/agents/analyzer.md`.

### 4d. User review

Open `<skill>-workspace/iteration-<N>/review.html` in a browser. Collect `feedback.json` when the user finishes.

---

## Step 5: Iterate

Improve skills from feedback, rerun into `iteration-<N+1>/`, repeat from Step 1.

---

## Quick command reference

| When | Command |
|------|---------|
| Before runs | `python3 .cursor/skills/evals/run.py validate` |
| After grade | `python3 .cursor/skills/evals/run.py finish --iteration <N>` |
| Validate + finish | `python3 .cursor/skills/evals/run.py all --iteration <N>` |

---

## What not to do

- Do not add per-skill `run_iteration.sh` or API-replay harnesses — they bypass the skill and are not skill-creator.
- Do not hand-author `benchmark.json` or review HTML — use `run.py finish`.
- Do not spawn with-skill runs in one turn and baselines in a later turn.
