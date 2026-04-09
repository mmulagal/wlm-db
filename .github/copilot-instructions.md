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

**MANDATORY — before doing any work on an issue labeled `error-agent`:**

1. Read `.github/instructions/error-agent.instructions.md` in full.
2. Do **not** begin investigation, coding, or PR creation until that file has been read.
3. For error-agent RCA and fix workflow, treat that file as the authoritative procedure for RCA flow, fix strategy, quality gates, PR/issue write-up format, and scope constraints. Apply it in addition to all repo-wide instructions (for example, `git-conventions.instructions.md`), not instead of them.
