---
applyTo: 'server/test/**/*.ts'
---

# Server Unit Testing

Vitest test suite for the server. Tests run with `NODE_ENV=simulator` (via `npm test`), which activates Prismock and all mock scopes.

## File Naming and Location

Mirror the source path under `test/`:

```
src/operations/foo/bar.ts        → test/operations/foo/bar.test.ts
src/lib/aws/ec2.ts               → test/lib/aws/ec2.test.ts
src/operations/workloads/oracle/ → test/operations/workloads/oracle/
```

`describe` titles use the module or feature area. `it` strings start with `should`.

## Test Setup (`test/setup.ts`)

Runs automatically before every test via `vitest.config.ts` `setupFiles`. It:

1. Imports the common scope files needed across the test suite as side effects (registering those mocks).
2. Calls `initializeDatabase()` to activate Prismock.

Not every file under `test/simulator/scopes/` is imported automatically. If you add a new scope that should be registered globally for tests, add its import to `test/setup.ts`.

Do **not** replicate this in individual test files — global setup is already in place.

## Mock Infrastructure: Scopes

Scopes are **side-effect-only** import files in `test/simulator/scopes/`. They register mocks when imported. Three families:

### AWS (`test/simulator/scopes/aws/*-scope.ts`)

Uses `aws-sdk-client-mock`. Static responses:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import describeInstancesResponse from '../../responses/aws/describe-instances.json';

const ec2Mock = mockClient(EC2Client);
ec2Mock.on(DescribeInstancesCommand).resolves(describeInstancesResponse);
```

Dynamic responses (input-dependent):

```typescript
ec2Mock.on(DescribeInstanceTypesCommand).callsFake(async command => {
    if (command.InstanceTypes?.includes('m5.large')) return m5LargeResponse;
    return emptyResponse;
});
```

Paginated APIs use the paginator mock pattern; see `ec2-scope.ts` for reference.

**Adding a new AWS service:** create `test/simulator/scopes/aws/my-service-scope.ts` and add its import to `test/setup.ts`.

### Cloud Manager / HTTP (`test/simulator/scopes/cloud-manager/*-scope.ts`)

Uses `nock`. Persist intercepts so they survive multiple calls:

```typescript
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../src/utils/consts';

nock(WORKLOAD_FACTORY_ENDPOINT)
    .persist(true)
    .get(/\/v1\/my-endpoint\/.*/)
    .reply(200, myFixtureResponse);
```

**Adding a new Cloud Manager endpoint:** add a `nock` intercept to the relevant scope file (`marketing-scope.ts`, `wlmdb-scope.ts`, etc.) rather than creating a new scope.

### Cross-cutting (`jwt-scope.ts`, `opentelemetry-scope.ts`)

Uses `sinon.stub`:

```typescript
import sinon from 'sinon';
import * as jwtModule from '../../../src/lib/cloud-manager/auth';
sinon.stub(jwtModule, 'verifyToken').returns(mockTokenPayload);
```

## Database (Prismock)

`__mocks__/@prisma/client.ts` replaces `PrismaClient` with `PrismockClient` when `NODE_ENV=simulator`. No per-test setup is needed unless the suite exercises Prisma directly:

```typescript
import { initializeDatabase } from '../../../src/utils/prisma-utils';

describe('My DB Suite', () => {
    beforeAll(async () => {
        await initializeDatabase();
    });
    // ...
});
```

**Known Prismock limitations** — document with a comment when you hit one:

```typescript
// Prismock does not support $queryRaw — skipping raw SQL assertions
// Prismock does not auto-set @updatedAt — assert createdAt instead
// Prismock does not support aggregate or cursor-based pagination
```

## Fixture Data

-   **Static AWS/CM JSON responses** → `test/simulator/responses/<service>/<action>.json`
-   **Shared test constants** (account IDs, region, VPC, networking config) → `test/utils/consts.ts`
-   **SSM payload builders** → `test/utils/ssm-utils.ts`
-   **Async job polling helper** → `test/utils/utils.ts` (`waitForJobCompletion`)

Never inline large JSON objects inside test files — add them to `responses/` and import.

## Test Patterns

### Simple operation test (no DB, global scopes sufficient)

```typescript
import { describe, it, expect } from 'vitest';
import { myOperation } from '../../../src/operations/my-module';
import { ACCOUNT_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('My Module', () => {
    describe('myOperation', () => {
        it('should return expected result for valid input', async () => {
            const result = await myOperation(DEFAULT_AWS_REGION, ACCOUNT_ID);
            expect(result).toBeDefined();
            expect(result.field).toEqual(expectedValue);
        });

        it('should reject when downstream service errors', async () => {
            await expect(myOperation('bad-region', ACCOUNT_ID)).rejects.toThrow();
        });
    });
});
```

### DB-backed test

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { initializeDatabase } from '../../../src/utils/prisma-utils';
import { createRecord } from '../../../src/operations/my-db-module';

describe('My DB Module', () => {
    beforeAll(async () => {
        await initializeDatabase();
    });

    it('should persist a record and return its id', async () => {
        const result = await createRecord({ name: 'test' });
        expect(result.id).toBeDefined();
    });
});
```

### Per-test nock (cleanup required)

```typescript
import { afterEach } from 'vitest';
import nock from 'nock';

afterEach(() => {
    nock.cleanAll();
});

it('should call external endpoint', async () => {
    nock('https://example.com').get('/api/data').reply(200, { items: [] });
    const result = await fetchData();
    expect(result.items).toHaveLength(0);
});
```

### One-off AWS override (`vi.spyOn` — avoid scopes for single-test variations)

```typescript
import { vi } from 'vitest';
import * as ec2Lib from '../../../src/lib/aws/ec2';

it('should handle empty instance list', async () => {
    vi.spyOn(ec2Lib, 'describeInstances').mockResolvedValueOnce([]);
    const result = await myOperation('us-east-1');
    expect(result).toEqual([]);
});
```

### Importing only specific scopes (when global setup is not enough)

If a test needs a scope that is **not** in `setup.ts`, or needs to override just part of the AWS surface, import the scope file directly at the top of the test file:

```typescript
import '../../../simulator/scopes/aws/pricing-scope';
import { myOperation } from '../../../../src/operations/my-module';
```

## Assertion Conventions

| Scenario                          | Assertion                                           |
| --------------------------------- | --------------------------------------------------- |
| Full object match against fixture | `expect(result).toEqual(fixture)`                   |
| Property exists                   | `expect(result.field).toBeDefined()`                |
| Resolved promise value            | `await expect(fn()).resolves.toBe(x)`               |
| Rejected promise                  | `await expect(fn()).rejects.toThrow('msg')`         |
| Numeric bound                     | `expect(a).toBeLessThanOrEqual(b)`                  |
| UUID shape                        | `expect(result.id).toMatch(/^[0-9a-f-]{36}$/)`      |
| Type-guarded field                | Use `if ('field' in result)` before asserting on it |

## Checklist for New Functionality

-   [ ] Test file path mirrors source path (`test/` prefix, same folder structure)
-   [ ] Scopes in `setup.ts` cover the AWS/CM surface — if not, add a new scope file and import it in `setup.ts`
-   [ ] Large fixture JSON goes in `test/simulator/responses/`, not inline
-   [ ] Shared IDs and config come from `test/utils/consts.ts`
-   [ ] `beforeAll(initializeDatabase)` present if the suite touches Prisma
-   [ ] Happy path + at least one error/edge-case `it` per exported function
-   [ ] Per-test `nock` interceptors cleaned up in `afterEach(() => { nock.cleanAll(); })`
-   [ ] No `vi.mock` for entire modules unless the module has no scope equivalent
