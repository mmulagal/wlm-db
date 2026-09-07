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

## Learned User Preferences

-   Invoke the `oracle-admin` skill through the wlmdb REST API (`POST .../oracle/.../run-script`), not raw AWS SSM from the operator machine.
-   Support both registered hosts (`databaseHostId` / optional `databaseInstanceId`) and unregistered hosts (raw `ec2InstanceId`).
-   Confirm the mapped ONTAP volume list with the user before sending a mutating run-script command.
-   When mapped-volume discovery cannot derive an FSx id or ONTAP credentials (IP NFS mount, or missing `/netapp/wlmdb/<filesystemId>` on the host), ask the operator in advance—after volume confirmation and before the mutating run-script POST. Never guess or print those credentials.
-   Oracle snapshots and clones are crash-consistent only (ONTAP consistency-group snapshots); RMAN `BEGIN BACKUP`/application-consistent quiescing is out of scope.

## Learned Workspace Facts

-   The `oracle-admin` skill supports NFS, iSCSI, and ASM-managed storage, and both CDB and non-CDB topologies. It refuses RAC and any Data Guard **standby** (`databaseRole != PRIMARY`), but a Data Guard **primary** is a supported snapshot/clone source — `topology_check.sh` reports it as `deploymentType: "dataguard-primary"` with `status: "ok"`. PDB creation still requires `deploymentType: "standalone"`, so it refuses a Data Guard primary (`CREATE PLUGGABLE DATABASE` propagates to the standby). `deploymentType: "unknown"` means the Data Guard probe was inconclusive — ask the operator, never treat it as standalone.
-   "Create database" means creating a Pluggable Database from `PDB$SEED` inside an already-running CDB — there is no PDB-equivalent primitive for a non-CDB instance, and full DBCA-based instance provisioning is out of scope.
-   The crash-consistent group for snapshot/clone covers `DATA_FILES`, `CONTROL_FILES`, `REDO_LOGS`, and `ARCHIVE_LOGS`; `TEMP_FILES` and `FRA` are excluded by default (tempfiles carry no recoverable state; FRA exclusion drops flashback-log continuity — see `ontap-consistency-groups.md` for the upgrade path).
-   Oracle clone recovery has no `pg_resetwal` equivalent: it is always `STARTUP MOUNT` → `ALTER DATABASE OPEN RESETLOGS`, followed by a mandatory `V$DATABASE.OPEN_MODE`/catalog verification. It runs in two phases (`clone_start_resetlogs.sh PHASE=mount`, then `PHASE=open`) so the RMAN controlfile fix-up can run in between — RMAN needs the database mounted to catalog or switch anything. `clone_bootstrap_pfile.sh` must run first: a brand-new `cloneSid` has no pfile/spfile and no oratab entry, so `STARTUP MOUNT` otherwise fails at `ORA-01078`/`LRM-00109`. That generated pfile is also what keeps a Data Guard primary's clone out of the production Data Guard configuration.
-   ONTAP credentials and ONTAP API calls stay on the target EC2 host inside the SSM script.
-   Mutating skill operations are gated by `--apply` plus `CONFIRM=true`.
