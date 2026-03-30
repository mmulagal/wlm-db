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

For issues labeled **`error-agent`**, apply this compact checklist first (for GitHub cloud agent reliability), then follow `.github/instructions/error-agent.instructions.md` for full details:

This checklist is the mandatory minimum. `.github/instructions/error-agent.instructions.md` is the authoritative detailed procedure; if wording differs, follow that file.

-   Start at the crash site: use stack trace file/function first; if no stack trace, search exact error text/variable.
-   Do root-cause analysis by tracing data flow backward from THROW site to data producer (DB write/API mapper/cache/source).
-   Fix at the source (producer) first; add only a minimal guard at the crash site as belt-and-suspenders.
-   Keep scope minimal and on-path only; avoid refactors, alternative architectures, and unrelated logging/message changes.
-   Use one coherent fix strategy (no competing alternative fixes in the same PR).
-   Add/update a unit test for the failing type/shape/missing-data case.
-   Exclude unintended/incidental file changes from the PR (for example `package-lock.json` drift from exploratory installs) unless directly required by the fix.
-   If no safe in-repo fix exists, do not open a PR; comment on the issue with investigation, finding, and next steps.
-   If opening a PR with a real fix, include: Root Cause, Fix Approach, Changes, and Alternatives Considered.
-   Before the final `report_progress` call, replace `prDescription` with the required 4-section PR description; do **not** leave a progress checklist as the PR body.
-   For additional reviewer clarity, you may post the same 4-section description as an issue comment, but keep the PR body as the authoritative final content.
