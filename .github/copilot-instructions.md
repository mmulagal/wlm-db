# GitHub Copilot Instructions

## Project Overview

See `AGENTS.md` at the repository root for project structure, commands, and development patterns for each package (server, ui, logs-analyzer).

## Coding Rules

Path-specific coding rules auto-load from `.github/instructions/` via `applyTo` metadata. No manual reading required — VS Code Copilot loads the applicable instruction files automatically when you edit matching files.

## Git Conventions

For branch naming, commit messages, pull request titles, and pre-push validation, follow `.github/instructions/git-conventions.instructions.md`.

**Pull requests:** When you open a PR for a GitHub issue, the **PR title must reference that issue** the same way as commit messages. Use the **Pull Requests** section in `.github/instructions/git-conventions.instructions.md` for pattern, regex, and examples (typically `GH-<issue-number>: <short description>` with a space after the colon). Do not use a title with no `GH-<n>:` prefix; non-compliant titles are rejected by repository rules.

**No code change — do not open a PR:** If you cannot produce a **real code fix** (or the issue does not call for a code change and you have nothing substantive to commit), **do not** create a pull request. Empty, documentation-only, or “WIP” PRs with no actual product change waste review time. Instead, **comment on the issue** with a clear write-up: what you investigated, paths you ruled out, why no safe fix is possible in-repo (or what data/access is missing), and concrete next steps for a human. If a PR was opened by mistake with no changes, close it and move that reasoning to the issue.

## Custom Agents

Specialized agents are available in `.github/agents/`:

-   **Oracle SSM Debug**: Use `.github/agents/oracle-ssm-debug.agent.md` to debug Oracle SSM script issues on EC2 instances

## Error-agent issues

When working on issues labeled **`error-agent`**, follow these rules in addition to the rest of this file.

### Root Cause Analysis

-   Always trace the data flow from where the error is THROWN back to where the bad data ORIGINATES
-   Distinguish between the SYMPTOM (crash site) and the ROOT CAUSE (where wrong data is produced/stored)
-   If a variable has the wrong type or shape, find WHERE it was assigned — was it a database write, an API response mapper, a cache store?
-   If you have a code fix: explain your full analysis in the **PR description** before the diff stands on its own. If you have **no** fix: do **not** open a PR — put the analysis in an **issue comment** (see **No code change** under Git Conventions).

### Fix Strategy

-   Fix at the SOURCE (the producer/writer of bad data) when possible, not just at the consumer/reader
-   If a type contract (interface, schema) exists between producer and consumer, enforce it
-   Prefer runtime validation (e.g., Array.isArray) at trust boundaries over deep-in-the-stack guards
-   If the root cause is outside the codebase (AWS SDK, OS syscall, infrastructure, transient environment), do not attempt an in-repo workaround. Comment on the issue with the analysis and classify it as external.

### Process (follow this order)

1. If a stack trace is available, use it to locate the crash site (file and function). If not, search for the exact error message text (or the variable name in it) to locate the code path.
2. Identify where the failing variable is produced or returned (trace backward from the crash site).
3. Fix at the producer first (normalize type/shape so callers always get the expected form).
4. Add a minimal guard at the crash site as belt-and-suspenders.
5. Do not implement **competing** alternative fixes (e.g., several different producer-side changes or unrelated strategies in one PR). Pick **one** coherent fix strategy; steps 3–4 are still one strategy (producer correction plus the minimal guard from step 4).
6. Add or update a unit test that covers the failure case (wrong type, shape, or missing data) to prevent regression.
7. Run pre-push validation per `git-conventions.instructions.md` before opening the PR.

### Scope and constraints (avoid)

-   Only change code on the data path from producer to crash site. Do not refactor unrelated logic.
-   Do not add new dependencies or change function signatures except as strictly needed for the fix.
-   Do not explore alternative architectures or “improve” surrounding code — minimal diff only.
-   If the issue body includes an **Investigation hint** (e.g. Crash site: … Trace where X is supplied), start there; do not search the entire codebase first.
-   If the issue has no stack trace, search for the exact error message text (or the variable name in it) first; do not try to match every context log line to code — that leads to scope creep and wrong paths.
-   Do not change logging or error messages unless the issue body specifically asks for it — minimal diff only.

### PR Description Format

Only when you are opening a PR that includes an actual code fix, structure your PR description as:

1. **Root Cause** — what code path produces the wrong data and why
2. **Fix Approach** — where you are fixing and why this location (not just "added a null check")
3. **Changes** — list of files changed with a one-line explanation each
4. **Alternative Approaches Considered** — briefly note what else you considered and why you chose this approach

### Issue Comment Format (no-fix)

When the issue does not warrant a code change (external cause, insufficient data, or no safe in-repo fix), comment on the issue with:

1. **Investigation** — code paths checked
2. **Finding** — where the error originates and why no in-repo fix applies
3. **Suggested next steps** — what a human should do
