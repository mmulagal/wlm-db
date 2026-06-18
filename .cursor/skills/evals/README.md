# Skill evals (central)

Scripts live here; agents run evals via Cursor **`/skill`** (`.cursor/commands/skill.md`).

## Prerequisites

**skill-creator** (local install, not committed — see `.cursor/skills/.gitignore`). From the repo root:

```bash
npx skills add anthropics/skills --skill skill-creator -a cursor
```

Installs `.cursor/skills/skill-creator/` (`SKILL.md`, `references/schemas.md`, benchmark scripts, grader/analyzer agents). Required for `/skill`, `run.py finish`, and schema references below.

**Eval credentials** (API evals only): copy `evals/local.env.example.json` → `evals/local.env.json` (never commit).

| File | Audience | Purpose |
|------|----------|---------|
| **run.py** | Human / CI | `validate`, `finish`, `all` |
| **scripts/load_env.py** | Agent | Staging credentials from `local.env.json` |

## Per skill (required)

| File | Purpose |
|------|---------|
| `SKILL.md` | Loaded by with-skill executor |
| `agents/grader.md` | Grade runs → `grading.json` |
| `evals/evals.json` | Prompts + expectations |
| `evals/trigger-eval.json` | Trigger tuning (optional for functional eval) |

Optional: block in `local.env.json`; `references/` and runtime `scripts/` are for skill use, not the eval framework.

**Workspace:** run artifacts go in `.cursor/skills/<skill>-workspace/iteration-<N>/eval-<id>/` (gitignored). Eval dirs must be flat and named `eval-<id>` (e.g. `eval-1/`) — `aggregate_benchmark.py` only picks up that prefix. Put the human-readable name in `eval_metadata.json` (`eval_name` from `evals.json`).

Do not add per-skill eval runner scripts — agents execute prompts; `run.py` only validates JSON and finishes benchmarks.

## Commands

```bash
python3 .cursor/skills/evals/run.py validate
python3 .cursor/skills/evals/run.py finish --iteration 3
python3 .cursor/skills/evals/run.py all --iteration 3
```

To **run** evals: use Cursor **`/skill`**.  
To **finish** after grading: `run.py finish`.

### Agent approval (avoid subagent stalls)

1. **Cursor Settings → Agents → Run Mode:** use **Auto-review** (or **Run Everything** for a dedicated eval session only).
2. **Repo allowlists:** `.cursor/permissions.json` — staging curl, eval `run.py`, workspace writes.
3. **Hooks:** `.cursor/hooks.json` — auto-allow eval `Task` subagents and eval shell patterns; production `api.workloads.netapp.com` still prompts.

Schema: `.cursor/skills/skill-creator/references/schemas.md`

## Optional (skill-creator advanced)

Installed under `.cursor/skills/skill-creator/` (see **Prerequisites**):

| Tool | Purpose |
|------|---------|
| `assets/eval_review.html` | Human review UI for `trigger-eval.json` (open locally, export JSON) |
| `scripts/package_skill.py` | Package a skill folder to `.skill` zip (`pip install pyyaml` for validate) |
| `agents/analyzer.md`, `comparator.md` | Post-benchmark analyst / blind compare (agent reads these) |

Tune skill descriptions by running trigger queries in Cursor/OpenCode and checking whether the agent reads `SKILL.md`.
