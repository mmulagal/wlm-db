# WLM-DB AI Coding Agent Instructions

Coding rules live in `.github/instructions/`. For Cursor, the `alwaysApply` rule in `.cursor/rules/` reads the applicable instruction files before coding, based on each file's `applyTo` metadata and the current edit scope. **Preserve existing control flow** on code-change tasks: see `.github/instructions/agent-change-scope.instructions.md` (applies to all paths via `applyTo: "**/*"`). The **`error-agent`** queue runbook is **not** in that folder: it is `.github/copilot/error-agent.instructions.md`, referenced from `.github/copilot-instructions.md` for GitHub Copilot / cloud agents (local Cursor pre-read skips `.github/copilot/` unless you are working on Copilot-only / error-agent queue work). For git workflow conventions, see `.github/instructions/git-conventions.instructions.md`.

---

## Server (`server/`)

Node.js 24 + TypeScript + Fastify API server. Handles backend operations, database, AWS integrations, and business logic.

### Commands

```bash
cd server
npm run dev        # Dev server with hot reload
npm run simulator  # Simulator for offline development
```

**⚠️ Before pushing code, see pre-push validation in `.github/instructions/git-conventions.instructions.md`.**

### Development Patterns

See `.github/instructions/*`. The instruction files contain their own `applyTo` metadata that controls which files they apply to.

**Quick Reference:**

-   Operations Layer: `*-operations.ts` files contain business logic, not controllers
-   API Routes: Use TypeBox schemas for validation
-   Testing: Vitest unit tests (`*.test.ts`)
-   Simulator: Mock AWS with `aws-sdk-client-mock` + `nock`, database with `prismock`

**Key Files:**

-   `schema.prisma` - DB schema location
-   `config/` - Environment configs
-   `.eslintrc.json` - ESLint config

---

## UI (`ui/`)

React 19 + TypeScript + Vite 7 frontend for WLMDB, embedded in NetApp BlueXP. Uses Redux Toolkit (RTK Query) and NetApp Design System.

### Commands

```bash
cd ui
npm start                 # Dev server on http://localhost:4300
npm run local             # Local env (.env.local)
npm run simulator         # Simulator mode (.env.simulator)
npm run proxy-staging     # Proxy to staging API
npm run proxy-production  # Proxy to production API
npm run build:local       # Local build
npm run build:staging     # Staging build + ejs configs
npm run build:preprod     # Preprod build + ejs configs
npm run build:production  # Production build + ejs configs
npm run lint              # ESLint check
npm run lint:fix          # ESLint auto-fix
npm test                  # Component tests (vitest run)
npm run test-dev          # Component tests (watch)
npm run format            # Prettier write
npm run format:check      # Prettier check
```

Notes:

-   Default `HOST=localhost` and `PORT=4300`; set `VITE_APP_API_URL` for proxies.
-   Builds inject `workload-config.json` and `workload-policies.json` via `ejs` into `build/`.
-   A mock server exists under `ui/mock-server/` for simulator workflows.

### Development Patterns

See `.github/instructions/*`. The instruction files contain their own `applyTo` metadata that controls which files they apply to.

**Quick Reference:**

-   Components: Feature-first organization under `src/workloadFactory/` (Dashboard, InventoryV2, JobMonitoring, CreateNewDB) and `src/components/` (CreateMsSql, Discover, Postgress). Reusable building blocks in `src/common/` and `src/ui-components/`.

**Key Files:**

-   `vite.config.ts` — Build config
-   `workload-config.json`, `workload-policies.json` — Environment settings templated into builds
-   `src/store/storeHooks.ts` — Typed Redux hooks
-   `src/utils/consts.ts` — App constants

---

## Logs Analyzer (`logs-analyzer/`)

TypeScript CLI that analyzes database logs (MSSQL, PostgreSQL, Oracle) and produces AI-driven remediation via AWS Bedrock. Ships as standalone binaries using `@yao-pkg/pkg`.

### Commands

```bash
cd logs-analyzer
npm run build         # Compile TypeScript to dist/
npm test              # Unit tests (vitest)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check
npm run bundle        # Bundle CLI to dist/agent.js via esbuild
npm run pkg:win       # Build Windows binary
npm run pkg:mac       # Build macOS binary
npm run pkg:linux     # Build Linux binary
npm run pkg:all       # Build all platform binaries
```

Notes:

-   Binaries are emitted under `logs-analyzer/dist/` with platform-specific names.
-   Ensure AWS credentials/env are configured for Bedrock when running analysis.
-   Outputs are written to `logs-analyzer/output/` with timestamped filenames.

### Development Patterns

See `.github/instructions/*`. The instruction files contain their own `applyTo` metadata that controls which files they apply to.

**Quick Reference:**

-   Structure:
    -   `src/agent.ts` — CLI entry
    -   `src/operations/` — DB-specific parsing (mssql/oracle/pgsql)
    -   `src/aws/` — Bedrock and CloudWatch clients
    -   `src/utils/` — consts, tools, logging, helpers

**Key Files:**

-   `src/agent.ts` — CLI entry
-   `src/utils/interfaces.ts` — Shared interfaces
-   `src/utils/const.ts` — Constants and prompts
-   `src/utils/tools.ts` — Bedrock tool definitions
-   `src/utils/logging.ts` — Logger setup
-   `test/` — Unit tests and sample log fixtures
