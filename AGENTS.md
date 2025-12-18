# WLM-DB AI Coding Agent Instructions

Also respect package-specific rules in `.github/instructions/*` (server/ui/logs-analyzer), and keep `.github/copilot-instructions.md` aligned with this document.

## Pre-Push Validation (Server Only)

**⚠️ CRITICAL:** Complete ALL steps before pushing server code.

```bash
cd server

# Step 1: Build + ESLint validation
npm run build
npm run lint
# ✅ Must pass: No TypeScript/ESLint errors

# Step 2: Tests
npm run test:nowatch
# ✅ Must pass: All tests passing

# Step 3: API doc lint (Spectral)
npm run apidoc
# ✅ Must pass: No OpenAPI violations

# Optional: Integration/simulator flows
npm run simulator  # run in a separate terminal if workflow requires it
```

## Git Workflow & Branch Naming Convention

### Naming Convention Enforcement

This repository enforces strict naming conventions for branches, commits, and pull requests to ensure traceability and consistency.

**Default Branch:** `master`. Ensure instruction files (e.g., `.github/copilot-instructions.md`) remain up-to-date on the default branch so agents can read them.

**⚠️ CRITICAL FOR COPILOT CODING AGENT:**
- **ALWAYS** create branches with the pattern: `copilot/GH-<issue-number>-<description>`
- **ALWAYS** create commits with the pattern: `GH-<issue-number>: <description>` (note the space after colon)
- **ALWAYS** create PR titles with the pattern: `GH-<issue-number>: <description>` (same as commit messages)
- The `<issue-number>` is the **numeric ID of the GitHub issue** you are working on (e.g., `1234` from issue `#1234`)
- The issue number MUST be extracted from the original GitHub issue/task that describes the problem you're trying to fix or feature to implement
- If no issue number is available, DO NOT proceed - ask the user to create an issue first
- Repository rules will REJECT any branch/commit/PR that doesn't match these patterns

### Validation Patterns

**Branch Names:**
- **Pattern:** `copilot/GH-<issue-number>-<description>`
- **Regex:** `^copilot/GH-[0-9]+-[a-zA-Z0-9-_]+$`
- **Note:** If a branch was already created with a non-conventional name, that's acceptable. However, ensure all commit messages follow the required pattern.
- **Examples:**
  - ✅ `copilot/GH-1234-fix-performance`
  - ✅ `copilot/GH-456-add-new-feature`
  - ❌ `GH-1234-fix` (missing `copilot/` prefix)
  - ❌ `copilot/1234-fix` (missing `GH-` prefix)

**Commit Messages:**
- **Pattern:** `GH-<issue-number>: <description>` (note the space after colon)
- **Regex:** `^GH-[0-9]+:\s.*$`
- **Note:** ALL commits MUST follow the `GH-<issue-number>: <description>` pattern. Commits without the `GH-<issue-number>` prefix will be rejected.
- **Examples:**
  - ✅ `GH-2296: delete obsolete files`
  - ✅ `GH-1234: fix performance issue`
  - ✅ `GH-456: add new feature for migration`
  - ❌ `Fix performance issue` (missing `GH-` prefix)
  - ❌ `GH-1234:fix` (missing space after colon)

**Pull Request Titles:**
- **Pattern:** `GH-<issue-number>: <description>` (same format as commit messages)
- **Regex:** `^GH-[0-9]+:\s.*$`
- **Examples:**
  - ✅ `GH-2296: delete obsolete files`
  - ✅ `GH-1101: fix float to double conversion`
  - ✅ `GH-2262: refactor copilot instructions`
  - ❌ `Delete obsolete files` (missing `GH-` prefix)
  - ❌ `GH-1234:Fix issue` (missing space after colon)

### Examples

```bash
# ✅ Valid branch names
copilot/GH-1101-support-demo-deploymentPlans
copilot/GH-2262-Fix-codeowners
copilot/GH-456-add-new-feature

# ❌ Invalid branch names (will be REJECTED)
GH-1234-fix-performance (missing copilot/ prefix)
feature/new-feature
bugfix-something
my-branch
1101-fix-issue
copilot/1234-fix-issue (missing GH- prefix)

# ✅ Valid commit messages
GH-2296: delete obsolete files
GH-1101: fix float to double conversion
GH-2262: refactor copilot instructions
GH-456: add new feature for performance optimization

# ❌ Invalid commit messages (will be REJECTED)
Fix float conversion (missing GH- prefix)
GH-1234:fix issue (missing space after colon)
Add new feature (missing GH- prefix and issue number)

# ✅ Valid PR titles
GH-2296: delete obsolete files
GH-1101: fix float to double conversion
GH-456: implement storage migration feature

# ❌ Invalid PR titles (will be REJECTED)
Delete obsolete files (missing GH- prefix)
GH-1234:Fix (missing space after colon)
```

### Why This Matters

1. **Traceability:** Every branch, commit, and PR is linked to a GitHub issue
2. **Consistency:** All work follows the same naming pattern
3. **Automation:** Repository rules enforce these conventions at commit/PR level
4. **Documentation:** Clear history showing what issue each change addresses

**Important:** GitHub Copilot coding agent MUST use these exact patterns. The repository has commit-level validation that will REJECT non-compliant branches, commits, and PRs.



## Server (`server/`)

Node.js 24 + TypeScript + Fastify API server. Handles backend operations, database, AWS integrations, and business logic.

### Commands
```bash
cd server
npm run dev        # Dev server with hot reload
npm run simulator  # Simulator for offline development
```

**⚠️ Before pushing code, see [Pre-Push Validation](#pre-push-validation-server-only) section at the top.**

### Development Patterns

**Operations Layer** (`src/operations/`)
- `*-operations.ts` files contain business logic, not controllers

**API Routes** (`src/routes/`)
- Use TypeBox schemas for validation
- Import operations, define schemas, register endpoints

**Testing**
- Unit tests: Vitest for business logic
- Test files: `*.test.ts`

**Simulator** (`test/simulator/`)
- Mock AWS services with `aws-sdk-client-mock` + `nock`
- Mock database with `prismock`
- Use top-level await (Node.js 24+) - no function wrappers

**Key Files:**
- `schema.prisma` - DB schema location
- `config/` - Environment configs
- `.eslintrc.json` - ESLint config

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
- Default `HOST=localhost` and `PORT=4300`; set `VITE_APP_API_URL` for proxies.
- Builds inject `workload-config.json` and `workload-policies.json` via `ejs` into `build/`.
- A mock server exists under `ui/mock-server/` for simulator workflows.

### Development Patterns

- **State Management:** Redux Toolkit slices with typed hooks from `src/store/storeHooks.ts` (use `useAppSelector`/`useAppDispatch`). Core slices include `authSlice` and `notificationSlice`; feature slices live under `src/store/workloadFactory/`.
- **API Integration:** RTK Query defined in `src/utils/apiService.ts`; use `createApi` and typed endpoints; follow `use<Get|Update><Resource>Query/Mutation` naming.
- **Components:** Feature-first organization under `src/workloadFactory/` (Dashboard, InventoryV2, JobMonitoring, CreateNewDB) and `src/components/` (CreateMsSql, Discover, Postgress). Reusable building blocks in `src/common/` and `src/ui-components/`.
- **Styling:** SCSS Modules (`*.module.scss`) with `classnames` for conditional styles.
- **Design System:** Use `@netapp/design-system` and WLMDB components from `@tlveng/wlm-ds`; wrap app in design system providers.
- **Routing & BlueXP:** React Router v7 with `useNavigate`; integrate via BlueXP iframe messaging for navigation and readiness events.

**Key Files:**
- `vite.config.ts` — Build config
- `workload-config.json`, `workload-policies.json` — Environment settings templated into builds
- `src/store/storeHooks.ts` — Typed Redux hooks
- `src/utils/consts.ts` — App constants

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
- Binaries are emitted under `logs-analyzer/dist/` with platform-specific names.
- Ensure AWS credentials/env are configured for Bedrock when running analysis.
- Outputs are written to `logs-analyzer/output/` with timestamped filenames.

### Development Patterns

- **CLI Parsing:** Use `commander` in `src/agent.ts` for flags and required options.
- **Logging:** Use `log4js` via `src/utils/logging.ts`; avoid logging secrets.
- **Type Safety:** Strict TypeScript; central interfaces in `src/utils/interfaces.ts`.
- **Structure:**
  - `src/agent.ts` — CLI entry
  - `src/operations/` — DB-specific parsing (mssql/oracle/pgsql)
  - `src/aws/` — Bedrock and CloudWatch clients
  - `src/utils/` — consts, tools, logging, helpers
- **AI Integration:** Use `@aws-sdk/client-bedrock-runtime` with structured prompts/tools.
- **Concurrency:** Use `p-limit` when processing many files.
- **Testing:** Vitest under `logs-analyzer/test/` mirroring `src/` layout; mock external services.

**Key Files:**
- `src/agent.ts` — CLI entry
- `src/utils/interfaces.ts` — Shared interfaces
- `src/utils/const.ts` — Constants and prompts
- `src/utils/tools.ts` — Bedrock tool definitions
- `src/utils/logging.ts` — Logger setup
- `test/` — Unit tests and sample log fixtures
