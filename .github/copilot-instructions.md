# GitHub Copilot Instructions

**⚠️ CRITICAL: READ AGENTS.md FIRST**

Before working on any code changes in this repository, you **MUST** read and follow all instructions in the [`AGENTS.md`](../AGENTS.md) file located at the root of this repository.

Also respect package-specific rules in `.github/instructions/*` (these take precedence for server/ui/logs-analyzer).

## Quick Reference

The `AGENTS.md` file contains:

- **Pre-Push Validation Requirements** — Critical testing and linting steps before pushing server code
- **Git Workflow & Branch Naming Convention** — Strict naming patterns for branches, commits, and PRs
- **Repository Structure** — Guidance for `server/`, `ui/`, and `logs-analyzer/`
- **Development Patterns** — Coding standards and best practices per component
- **Validation & Execution** — PowerShell AST and T‑SQL syntax validators

## Key Requirements Summary

**Important:** The `<issue-number>` is the **numeric ID of the GitHub issue** you are working on (e.g., `1234` from issue `#1234`). The issue number MUST be extracted from the original GitHub issue/task that describes the problem you're trying to fix or feature to implement.

### Branch Naming
- **Pattern:** `copilot/GH-<issue-number>-<description>`
- **Example:** `copilot/GH-1234-fix-performance`
- **Note:** If a branch was already created with a non-conventional name, that's acceptable. However, ensure all commit messages follow the required pattern.

### Commit Messages
- **Pattern:** `GH-<issue-number>: <description>` (note the space after colon)
- **Example:** `GH-1234: fix performance issue`
- **Note:** Your first commit can be "Initial plan" — this is acceptable. However, ALL subsequent commits MUST follow the `GH-<issue-number>: <description>` pattern.

### Pull Request Titles
- **Pattern:** `GH-<issue-number>: <description>` (same as commit messages)
- **Example:** `GH-1234: fix performance issue`

### Pre-Push Validation (Server Changes)
When making changes to the `server/` directory, you **MUST** run:

```bash
cd server
npm run build            # Must pass: No TypeScript errors
npm run lint             # Must pass: ESLint clean
npm run test:nowatch     # Must pass: All tests passing
npm run apidoc           # Must pass: API doc lint (Spectral)
```

Optional (when simulator workflows are involved):

```bash
npm run simulator        # start simulator in a separate terminal
```

## Additional Standards (Server)
- TypeScript strict mode. No `any`.
- One responsibility per file. Organize by `routes/`, `operations/`, `utils/`, `lib/`.
- Route schemas live in `src/routes/schemas/*` and must include `tags`, `summary`, `description`.
- API responses use camelCase. List endpoints return `{ items, nextToken? }`.
- Prefer named exports and consistent export style per file.
- Use centralized logger; never `console.*` in server code.

## Validators (AI‑WAD)
- PowerShell AST: run `pwsh` with `resources/ps/Validate-PsAst.ps1` and parse JSON diagnostics.
- MSSQL T‑SQL syntax: ephemeral Docker with dynamic port; use `--platform linux/amd64` on arm64 (Apple Silicon).

## Full Instructions

For complete and detailed instructions, refer to [`AGENTS.md`](../AGENTS.md) and the package-specific rules under `.github/instructions/*`.
