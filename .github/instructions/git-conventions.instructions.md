---
description: Git workflow - branch naming, commit messages, pull requests, pre-push validation
applyTo: '**/*'
---

# Git Workflow & Conventions

## Pre-Push Validation (Server Only)

**CRITICAL:** Complete ALL steps before pushing server code.

```bash
cd server
npm run build && npm run lint   # No TypeScript/ESLint errors
npm run test:nowatch            # All tests passing
npm run apidoc                  # No OpenAPI violations
```

## Branch Naming

**Default Branch:** `master`

-   **Pattern:** `copilot/GH-<issue-number>-<description>`
-   **Regex:** `^copilot/GH-[0-9]+-[a-zA-Z0-9-_]+$`
-   If no issue number is available, ask the user to create an issue first.

## Commit Messages

-   **Pattern:** `GH-<issue-number>: <description>` (space after colon)
-   **Regex:** `^GH-[0-9]+:\s.*$`

## Pull Requests

When you open a PR for a GitHub issue, the **PR title must reference that issue** using the same rules as [commit messages](#commit-messages).

-   **Pattern:** `GH-<issue-number>: <description>` (space after colon)
-   **Regex:** `^GH-[0-9]+:\s.*$`

Do not use a title with no `GH-<issue-number>:` prefix; non-compliant titles are rejected by repository rules. See **Examples** below for valid and invalid titles (same format as commits).

## Examples

```bash
# Valid
copilot/GH-1101-support-demo-deploymentPlans
GH-2296: delete obsolete files
GH-1101: fix float to double conversion

# Invalid (REJECTED)
GH-1234-fix-performance          # missing copilot/ prefix
Fix float conversion              # missing GH- prefix
GH-1234:fix issue                 # missing space after colon
```

Repository rules enforce these conventions at commit/PR level. Non-compliant branches, commits, and PRs will be **REJECTED**.
