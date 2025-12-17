# WLM-DB Coding Agents

This repository uses coding agents to automate routine development tasks across server, UI, and logs-analyzer packages. This document explains agent roles, workflows, and conventions to keep changes safe, reproducible, and easy to review.

## Agent Roles
- Server Agent: TypeScript/Node backend (Fastify), Prisma, AWS SDK, SSM script orchestration, validators (Python, PowerShell).
- UI Agent: Vite + TypeScript front-end, schema-driven API docs consumption.
- Logs Analyzer Agent: Standalone TypeScript utilities for log ingestion and analysis.

## Core Principles
- Safety first: no credentials or secrets in code or logs.
- Small, focused PRs with clear scope and tests.
- Follow repo standards (ESLint, Prettier, TypeScript strictness) and existing instruction files under `.github/instructions`.
- Prefer reuse: import existing helpers instead of re-implementing.

## Pre-Push Validation (Server)

Complete these before pushing server code:

```bash
cd server

# 1) Build + ESLint validation
npm run build
npm run lint

# 2) Unit/Integration tests (simulator optional)
npm run test:nowatch
# If a simulator workflow is involved, run it in a separate terminal
npm run simulator

# 3) API documentation lint
npm run apidoc
```

## Git Workflow & Branch/Commit/PR Naming

To maintain traceability with issues, use the following patterns:

- Branch: `copilot/GH-<issue-number>-<description>` (recommended)
- Commits: `GH-<issue-number>: <description>` (space after colon)
- PR titles: `GH-<issue-number>: <description>`

Examples:

```text
Branch    ✅ copilot/GH-6244-update-agent-docs
Commit    ✅ GH-6244: align agent docs with naming conventions
PR Title  ✅ GH-6244: align agent docs with naming conventions
```

If an existing branch doesn’t follow the pattern, ensure all commits and the PR title do.

## Common Workflows
1) Add/Modify API Endpoint (Server)
- Update/introduce schema in `server/src/routes/schemas/*` (include tags, summary, description).
- Implement handler under `server/src/routes/*` delegating to `operations/*` logic.
- Add/update operation in `server/src/operations/*` with logging, error handling, and tests.
- Run: `cd server && npm run lint && npm run test:nowatch`.

2) Script Validation (AI-WAD)
- Python validation requires Python 3 on host.
- PowerShell validation requires PowerShell Core (`pwsh`).
- Use `server/resources/ps/Validate-PsAst.ps1` to parse AST and return JSON diagnostics.
- T-SQL syntax validation uses ephemeral MSSQL Docker (dynamic host port; `--platform linux/amd64` on Apple Silicon).

3) Documentation & OpenAPI
- Route schemas are picked up by the OpenAPI generator.
- Run API docs: `cd server && npm run apidoc`.

## Quality Gates
- Lint: `cd server && npm run lint` (no console.* in server code; use logger).
- Format: `cd server && npm run format:check`.
- Tests: `cd server && npm run test:nowatch`.
- Build: `cd server && npm run build`.

## Why Naming Matters
- Traceability: links work items to issues.
- Consistency: easier reviews and automation.
- Automation: future repo rules may enforce these patterns.

## Branch & PR Conventions
- Branch: `feature/<short-desc>` or `fix/<short-desc>`.
- PR: clear title, short description, checklist of changes, and "How to test" steps.
- Keep changes minimal and focused; avoid unrelated refactors.

## Tips for Agents
- Never log sensitive data (passwords, tokens, PII).
- Prefer strict typing (`unknown` + type guards over `any`).
- Don’t introduce top-level side effects; export functions and call from entrypoints.
- All scripts must output valid JSON only for programmatic parsing.

See also:
- `.github/copilot-instructions.md` (agent execution standards)
- `.github/instructions/` (package-specific coding rules)
- `server/README.md` (server usage)