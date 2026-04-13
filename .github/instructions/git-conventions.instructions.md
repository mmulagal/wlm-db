---
description: Git workflow - branch naming, commit messages, pull requests, issue comments (no-fix), pre-push validation
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

**Branch and title must agree:** Use the same `<issue-number>` in the branch ([branch naming](#branch-naming)), commits, and PR title.

### Linking the PR to the issue (body or title)

On its own line in the PR description, include **`Fixes #<issue-number>`** or **`Closes #<issue-number>`**, where `<issue-number>` is the numeric issue number from the GitHub issue URL (e.g. `…/issues/1234` → `#1234`). The same keywords in the PR title are acceptable if your tooling sets the title instead of the body.
For issues labeled **`error-agent`**, this link (or an equivalent Development link on the PR) is how **Copilot queue** automation knows which issue the PR resolves; without it, the next error-agent issue may not be assigned. Title/branch **`GH-<issue-number>:`** / **`copilot/GH-<issue-number>-…`** must use that **same** `<issue-number>`.

### Error-agent PR description (body)

When the PR contains a real code fix for an **`error-agent`** issue, the PR body must be the following four sections—not a progress checklist. If you use `report_progress`, the final **`prDescription`** must be this content.

1. **Root Cause** — what code path produces the wrong data and why
2. **Fix Approach** — where you are fixing and why this location (not only “added a null check”)
3. **Changes** — each file touched, one line each
4. **Alternative Approaches Considered** — what else you considered and why you chose this approach

You may also post the same four-section body as an **issue comment** on the **`error-agent`** issue for reviewer context. The PR description remains authoritative.

### When not to open a PR

If there is no substantive in-repo code fix, **do not** open a PR. Comment on the issue instead, using **Issue Comment Format (no-fix)** below.

#### Issue Comment Format (no-fix)

When the issue does not warrant a code change (e.g. external cause, insufficient data, duplicate, or no safe in-repo fix), comment on the issue with:

1. **Investigation** — code paths or areas checked
2. **Finding** — where the issue originates and why no substantive in-repo code fix applies
3. **Suggested next steps** — follow-up for triage or environment (e.g. infra, credentials, more logs)

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
