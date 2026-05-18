---
description: Error-agent issue handling - RCA flow, fix strategy, PR write-up format (GitHub Copilot queue / cloud agents)
---

# Error-Agent Issues

**Scope:** This file lives under `.github/copilot/`, not `.github/instructions/`. It is **not** part of the mandatory pre-read for local Cursor sessions (see `.cursor/rules/main.mdc`). Read it when working on **`error-agent`** issues per `.github/copilot-instructions.md`.

When working on issues labeled **`error-agent`**, follow these rules in addition to the rest of the project instructions.

## Issue Structure

Error-agent issues have a specific structure. Use these sections to guide your investigation:

-   **Error Summary** — what breaks and its user-facing impact
-   **Error Message** — raw error in a code block (search for this text in source)
-   **Stack Trace** — crash site with file:line references (start investigation here)
-   **Correlation IDs** — request/trace IDs for log correlation
-   **Context Summary** — surrounding logs showing the request flow leading to the error
-   **Occurrence Data** — frequency and time range (higher count = higher priority)
-   **Code Location Hints** — when no stack trace, search terms and rationale for finding relevant code
-   **Investigation hint** — when present, start investigation at the suggested location

## Root Cause Analysis

-   Always trace the data flow from where the error is THROWN back to where the bad data ORIGINATES
-   Distinguish between the SYMPTOM (crash site) and the ROOT CAUSE (where wrong data is produced/stored)
-   If a variable has the wrong type or shape, find WHERE it was assigned — was it a database write, an API response mapper, a cache store?
-   If you have a code fix: explain your full analysis in the **PR description** before the diff stands on its own. If you have **no** fix: do **not** open a PR — comment on the issue instead (**When not to open a PR** and **Issue Comment Format (no-fix)** in `git-conventions.instructions.md`).

## Fix Strategy

-   Fix at the SOURCE (the producer/writer of bad data) when possible, not just at the consumer/reader
-   If a type contract (interface, schema) exists between producer and consumer, enforce it
-   Prefer runtime validation (e.g., Array.isArray) at trust boundaries over deep-in-the-stack guards
-   If the root cause is outside the codebase (AWS SDK, OS syscall, infrastructure, transient environment), do not attempt an in-repo workaround. Comment on the issue with the analysis and classify it as external.

## Branch naming

The **`error-agent`** queue often runs with only this file in context. **Normative rules** (edge cases, repo policy): **`git-conventions.instructions.md`** → **Branch Naming**.

Condensed requirements:

-   **Pattern:** `copilot/GH-<issue-number>-<description>`
-   **Regex:** `^copilot/GH-[0-9]+-[a-zA-Z0-9-_]+$`
-   **Timing:** Create this branch **before** your first commit on the fix; do not stack commits on `master` (or another non-compliant branch) and fix naming only at PR time.
-   **Issue number:** Same authoritative `N` as **`Fixes #N`**, commits, and the PR title `GH-<issue-number>: …`—not a number from linked/parent issues or stray `#…` / `GH-…` in the issue body or comments.
-   **Do not** use `master`, a generic `copilot/<name>` without `GH-<issue-number>-`, or other names that omit the `GH-<issue-number>-` segment after `copilot/`.

## Process (follow this order)

1. If a stack trace is available, use it to locate the crash site (file and function). If not, search for the exact error message text (or the variable name in it) to locate the code path.
2. Identify where the failing variable is produced or returned (trace backward from the crash site).
3. Fix at the producer first (normalize type/shape so callers always get the expected form).
4. Add a minimal guard at the crash site as belt-and-suspenders.
5. Do not implement **competing** alternative fixes (e.g., several different producer-side changes or unrelated strategies in one PR). Pick **one** coherent fix strategy; steps 3-4 are still one strategy (producer correction plus the minimal guard from step 4).
6. Add **at most one** unit test targeting the exact failure case (wrong type, shape, or missing data) to prevent regression. Do not add tests for happy paths, related scenarios, or adjacent code. If a test covering the same input already exists, update it instead of creating a new one. Do not create a new test file — only add to an existing one.
7. Run pre-push validation per `git-conventions.instructions.md` before opening the PR.
8. When you open the PR, follow **`git-conventions.instructions.md`** → **Pull Requests** (title, branch, **Linking the PR to the issue**, and **Error-agent PR description**). Do that when the PR is first opened, not only in follow-up edits.

## Mandatory Quality Gates (before finalizing)

These checks are generic and apply to all `error-agent` issues.
You must complete all checks below before opening/updating a PR:

1. **Behavior-preservation check for optional inputs**
    - If a field was previously optional/implicit (e.g., undefined had a default behavior), verify your change does **not** silently drop that path.
    - If behavior changes, make it explicit via validation error or documented intentional change.
2. **Deduplication and key-collision check**
    - If you deduplicate requests, verify downstream aggregation keys remain unique.
    - Never allow multiple distinct inputs to collapse into the same map/reduce key unless explicitly intended.
3. **Enum/schema normalization check**
    - Verify request schema enum values match internal constants and comparison logic exactly.
    - Normalize at boundaries when external/input representation differs from internal representation.
4. **Silent-fallback check**
    - Ensure new guards/filters do not cause silent defaulting, skipped processing, or empty-result behavior for previously valid flows.
5. **Test determinism check**
    - Unit tests must not depend on live network/service calls or environment-specific credentials.
    - Use existing mocks/scopes/fixtures for regression tests.
6. **Incidental file change check**
    - Before creating or updating the PR, run `git diff --name-only HEAD` (or `git status`) and inspect every file listed.
    - `package-lock.json` and `yarn.lock` changes caused by exploratory `npm install` or `npm ci` runs are **never** part of the fix. Revert them with `git checkout -- <path/to/package-lock.json>` before opening the PR.
    - Do **not** include lockfiles in the PR even if they appear modified in `git status`. Revert all lockfile changes unless the fix explicitly adds or removes a package dependency.
    - After reverting, re-run `git diff --name-only HEAD` and confirm no unrelated files remain staged or modified.
7. **Review-thread closure check**
    - For every PR comment thread: either fix it in code or respond with a clear technical rationale.
    - Do not mark work complete while unresolved correctness comments remain.
8. **Branch name check**
    - Confirm the branch meets **Branch naming** (above) and **`git-conventions.instructions.md`** → **Branch Naming**; the issue number must match **`Fixes #…`** and the PR title. If not, rename or recreate the branch before opening or updating the PR.

## Scope and constraints (avoid)

-   Only change code on the data path from producer to crash site. Do not refactor unrelated logic.
-   Do not add new dependencies or change function signatures except as strictly needed for the fix.
-   Do not include incidental or unintended file changes in the PR. **Before opening the PR**, run `git diff --name-only HEAD`, review every file, and revert any that are not on the direct fix path (e.g., `git checkout -- server/package-lock.json` for lockfile drift caused by exploratory `npm install` runs). Confirm the staged set contains only the files you intentionally changed.
-   Do not explore alternative architectures or "improve" surrounding code — minimal diff only.
-   If the issue body includes an **Investigation hint** (e.g. Crash site: ... Trace where X is supplied), start there; do not search the entire codebase first.
-   If the issue has no stack trace, search for the exact error message text (or the variable name in it) first; do not try to match every context log line to code — that leads to scope creep and wrong paths.
-   Do not change logging or error messages unless the issue body specifically asks for it — minimal diff only.
-   Do not add tests that rely on external connectivity, environment-specific credentials, or live external service data.
-   Do not create new test files. Do not add more than one new test case per PR. The only permitted test work is a single regression test for the exact failure scenario added to an existing test file, or an edit to an existing test case. Any additional test cases are out of scope.

## Using Code Location Hints

When an issue has no stack trace but includes a **Code Location Hints** section:

1.  Use each `searchTerm` to search the codebase (e.g. `rg "searchTerm" server/src/`)
2.  Read the `rationale` to understand why that location is relevant
3.  Start with the first hint — they are ordered by relevance
4.  Do not search the entire codebase blindly; these hints narrow the search space

## PR Description Format

Only when you are opening a PR that includes an actual code fix, structure your PR description as:

Fixes #<issue-number>

1. **Root Cause** — what code path produces the wrong data and why
2. **Fix Approach** — where you are fixing and why this location (not just "added a null check")
3. **Changes** — list of files changed with a one-line explanation each
4. **Alternative Approaches Considered** — briefly note what else you considered and why you chose this approach

The `Fixes #<issue-number>` line must appear at the top of the description. Use the actual GitHub issue number (e.g., `Fixes #7990`). This creates an automatic link to the issue and closes it when the PR is merged.

**Authoritative `<issue-number>`:** It must be the number of the **`error-agent` issue you are resolving in this session**—the same `N` as in `https://github.com/<org>/<repo>/issues/<N>` for that issue. Do **not** use a different `N` from related issues (parent epic, duplicate-of, “see also #…”), from scanning the issue body or comments for arbitrary `#…` / `GH-…` strings, or from tooling output that lists other issues. Wrong `N` breaks queue automation and mis-links the PR.

**This is the required final content of the `prDescription` parameter in your last `report_progress` call. It must replace any progress checklist used earlier in the session.**

## PR Title Format

When opening a PR for an `error-agent` issue, use this exact title format:

-   `GH-<issue-number>: <description>`
-   Regex: `^GH-[0-9]+:\s.*$`

Never open/update an `error-agent` PR with a title that does not include the matching issue ID in this format. The `<issue-number>` here is the **same** authoritative number as in **`Fixes #<issue-number>`** above—not any other issue mentioned in the ticket.

## Issue Comment Format (no-fix)

When the issue does not warrant a code change (external cause, insufficient data, or no safe in-repo fix), comment on the issue with:

1. **Investigation** — code paths checked
2. **Finding** — where the error originates and why no in-repo fix applies
3. **Suggested next steps** — what a human should do

When there _is_ a code fix, you may also post the same 4-section PR description content as an issue comment for reviewer context. Keep the PR body authoritative and ensure the final `report_progress` `prDescription` still contains the required 4 sections.
