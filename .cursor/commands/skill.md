# Skill workflow (create or evaluate)

Run the full skill-creator workflow for wlmdb skills. **Do not stop partway.** Do not use `/skill-test`.

## Eval session setup

Tell the user once if not already in eval mode:

1. **Cursor Settings → Agents → Run mode:** **Auto-review** (or **Run everything** for this chat only).
2. Staging `curl` and `run.py` are auto-allowed via `.cursor/hooks/allow-staging-eval.sh` when present.
3. Production `api.workloads.netapp.com` still prompts. Do not auto-run destructive `POST/PATCH/DELETE` operations without explicit user confirmation.

## Read first

- @.cursor/skills/skill-creator/SKILL.md
- @.cursor/skills/evals/README.md
- @.cursor/skills/skill-creator/references/schemas.md
- Each skill's `agents/grader.md` for eval-specific gates before running

## 1. Resolve skill name

From the user's message, open files, or ask. Path: `.cursor/skills/<name>/`

Optional user flags:

- **new skill** / describe a workflow → force CREATE even if a folder exists
- **all skills** → loop every skill with `evals/evals.json`
- **iteration N** → use that number instead of auto-increment
- **old baseline** → snapshot skill to workspace `old_skill/` instead of `without_skill`

## 2. Detect state and announce

| State | Signals | Branch |
|-------|---------|--------|
| CREATE | No `SKILL.md`, or user said "new skill" | Draft skill + evals → iteration 1 |
| EVAL (first) | `SKILL.md` exists, no `<name>-workspace/iteration-*` | Run evals → iteration 1 |
| EVAL (again) | Prior `iteration-*` exists | Run evals → iteration N+1 |
| RESUME | Workspace exists but missing grading or benchmark | Grade and/or `run.py finish` |

**Announce the branch** before acting (e.g. "`fetch-logs-analysis-results` has iteration-3 → **EVAL iteration 4**").

## 3. CREATE branch

1. Interview if needed: purpose, triggers, output format, 2–3 realistic test prompts.
2. Write under `.cursor/skills/<name>/`:
   - `SKILL.md` — frontmatter must include `name`, `description`, and:
     ```yaml
     metadata:
       author: wlm-db
       version: 1.0.0
     ```
   - `evals/evals.json` (id, name, prompt, expectations)
   - `agents/grader.md`
   - optional `evals/trigger-eval.json`
3. Then run the EVAL branch for **iteration 1** (do not stop after writing files).

## 4. EVAL branch (do not stop partway)

1. `python3 .cursor/skills/evals/run.py validate`
2. Ensure `local.env.json` exists (copy from `local.env.example.json` if missing; never commit).
3. For each eval in `evals/evals.json`, spawn **with_skill AND without_skill in the same turn** — never with-skill first, baselines later.
4. **With-skill:** read `.cursor/skills/<name>/SKILL.md`; save to  
   `.cursor/skills/<name>-workspace/iteration-<N>/eval-<id>/with_skill/run-1/outputs/`  
   plus `transcript.md`, `assistant_response.md`, API JSON as needed.
5. **Without-skill:** same prompt, no skill; save to `without_skill/run-1/outputs/`.
6. Default baseline: `without_skill`. Use `old_skill` only if user asked for old-version comparison.
7. Write `eval_metadata.json` per eval dir (copy expectations from `evals.json`).
8. API evals: `eval "$(python3 .cursor/skills/evals/scripts/load_env.py <name> --export)"`; staging + `x-simulator: true` when `ENVIRONMENT` is `StagingDemo`.
9. Capture `timing.json` in each run directory when subagent timing is available.
10. Grade every run via `<name>/agents/grader.md` (read **Eval-specific notes** there) → `grading.json` with `expectations[].text`, `passed`, `evidence`.
11. `python3 .cursor/skills/evals/run.py finish --iteration <N>`
12. Analyst pass: non-discriminating expectations, flaky evals, time/token tradeoffs (see `.cursor/skills/skill-creator/agents/analyzer.md`).
13. Give path to `<name>-workspace/iteration-<N>/review.html` and summarize pass rates.

## 5. After CREATE or first EVAL

Stop for human review of `review.html` before rewriting the skill unless the user asked to iterate until green.

## Do not

- Hand-author `benchmark.json` or review HTML — use `run.py finish`.
- Add per-skill `run_iteration.sh` or API-replay harnesses.
