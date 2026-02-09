# WLMDB Architecture Overview

## Server Structure

```
src/
├── routes/           # Fastify route definitions (API endpoints)
├── operations/       # Business logic, orchestration
│   ├── aws/          # AWS service operations
│   ├── workloads/    # MSSQL, PostgreSQL, Oracle operations
│   │   ├── mssql/    # MSSQL-specific scripts & queries
│   │   ├── pgsql/    # PostgreSQL operations
│   │   └── oracle/   # Oracle operations
│   └── cloud-manager/# NetApp Cloud Manager integrations
├── lib/              # Reusable libraries & utilities
└── utils/            # Helpers, constants, demo-utils
```

## Request Flow (What to Trace)

```
Route Handler (src/routes/*.ts)
    ↓
Operation Function (src/operations/**/*.ts)
    ↓
┌─────────────────────────────────────────────────┐
│ External Dependencies (what needs mocking)      │
├─────────────────────────────────────────────────┤
│ • AWS SDK calls (EC2, FSx, SSM, S3, etc.)       │
│ • SSM commands (scripts run on EC2 instances)   │
│ • Cloud Manager API calls (HTTP)                │
│ • Database queries (Prisma → prismock)          │
└─────────────────────────────────────────────────┘
```

## Key Constants File

**Location**: `src/utils/consts.ts`

Contains endpoint URLs, header names, and constants used throughout:
- `CLOUD_MANAGER_ENDPOINT`
- `WORKLOAD_FACTORY_ENDPOINT`
- `WF_CONSOLE_ENDPOINT`
- Script constants imported in SSM scope

---

# Simulator Architecture

## Entry Point

**File**: `test/simulator/index.ts`

```typescript
async function initiateSimulator() {
    nock.disableNetConnect();  // Block all external HTTP
    nock.enableNetConnect(host => /* allowed hosts */);
    
    // Load all scope files (mocks)
    await import('./scopes/jwt-scope');
    await import('./scopes/aws/ec2-scope');
    await import('./scopes/aws/ssm-scope');
    // ... more scopes
    
    // Finally, load the actual server
    await import('../../src/index');
}
```

## What Happens When `npm run simulator` Runs

1. `NODE_ENV=simulator` is set
2. `nock.disableNetConnect()` blocks all outbound HTTP
3. AWS SDK mocks intercept via `aws-sdk-client-mock`
4. HTTP mocks intercept via `nock`
5. JWT verification stubbed via `sinon` (always succeeds)
6. Prisma replaced with in-memory `prismock`
7. SNS/SQS infrastructure setup is skipped
8. Server starts on port 8085

## Scope Files Structure

```
test/simulator/
├── index.ts                    # Orchestrator - imports all scopes
├── scopes/
│   ├── aws/                    # AWS service mocks (21 files)
│   │   ├── ec2-scope.ts
│   │   ├── fsx-scope.ts
│   │   ├── ssm-scope.ts        # ← MOST COMPLEX - handles all SSM commands
│   │   ├── s3-scope.ts
│   │   └── ...
│   ├── cloud-manager/          # NetApp API mocks (12 files)
│   │   ├── cloud-manager-tenancy-scope.ts
│   │   ├── workload-factory-auth-scope.ts
│   │   └── ...
│   ├── jwt-scope.ts            # JWT verification bypass
│   └── batch-scope.ts
└── responses/                  # JSON response fixtures
    ├── aws/                    # 60+ AWS responses
    ├── cloud-manager/          # Cloud Manager responses
    └── ...
```
