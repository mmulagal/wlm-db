# GitHub Copilot Instructions

## Project Overview

See `AGENTS.md` at the repository root for project structure, commands, and development patterns for each package (server, ui, logs-analyzer).

## Coding Rules

Path-specific coding rules auto-load from `.github/instructions/` via `applyTo` metadata. No manual reading required — VS Code Copilot loads the applicable instruction files automatically when you edit matching files.

**Copilot-only runbooks** (e.g. **`error-agent`** queue) live under `.github/copilot/`. They are intentionally **not** in `.github/instructions/` so local Cursor’s mandatory instruction pre-read (`.cursor/rules/main.mdc`) does not load them; cloud/GitHub Copilot agents are directed to read them explicitly below.

## Git Conventions

For branch naming, commit messages, pull request titles, and pre-push validation, follow `.github/instructions/git-conventions.instructions.md`.

**Pull requests:** When you open a PR for a GitHub issue, the **PR title must reference that issue** the same way as commit messages. Use the **Pull Requests** section in `.github/instructions/git-conventions.instructions.md` for pattern, regex, and examples (typically `GH-<issue-number>: <short description>` with a space after the colon). Do not use a title with no `GH-<n>:` prefix; non-compliant titles are rejected by repository rules.

**No code change — do not open a PR:** If you cannot produce a **real code fix** (or the issue does not call for a code change and you have nothing substantive to commit), **do not** create a pull request. Empty, documentation-only, or “WIP” PRs with no actual product change waste review time. Instead, **comment on the issue** with a clear write-up: what you investigated, paths you ruled out, why no safe fix is possible in-repo (or what data/access is missing), and concrete next steps for a human. If a PR was opened by mistake with no changes, close it and move that reasoning to the issue.

## Custom Agents

Specialized agents are available in `.github/agents/`:

-   **Oracle SSM Debug**: Use `.github/agents/oracle-ssm-debug.agent.md` to debug Oracle SSM script issues on EC2 instances

## Error-agent issues

**MANDATORY — before doing any work on an issue labeled `error-agent`:**

1. Use the **Read** tool to read `.github/copilot/error-agent.instructions.md` in full.
2. Do **not** begin investigation, coding, or PR creation until that file has been read.
3. That file is the **authoritative source** for RCA flow, fix strategy, quality gates, PR write-up format (for code fixes), and scope constraints. No-fix issue comments follow **`git-conventions.instructions.md`** → **Issue Comment Format (no-fix)**. Follow `.github/copilot/error-agent.instructions.md` exactly; do not substitute your own judgment for any step it defines.
