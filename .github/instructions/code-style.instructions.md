---
applyTo: "**/server/src/**/*.ts,**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/logs-analyzer/src/**/*.ts"
---

# Code Style

## Import Order

4 groups separated by blank lines: third-party, AWS SDK, internal utils, sibling operations.

```typescript
// Good
import createError from 'http-errors';
import { DATABASE_TYPE } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';

import { ArchitectureType } from '@aws-sdk/client-ec2';

import { HttpErrorCodes } from '../../../utils/consts';
import getLogger from '../../../utils/logger';

import { registerJob } from '../../database/job-operations';

// Bad — all imports jumbled with no grouping
import createError from 'http-errors';
import { HttpErrorCodes } from '../../../utils/consts';
import { DATABASE_TYPE } from '@prisma/client';
import { registerJob } from '../../database/job-operations';
```

## Logger

- Initialize at module scope after imports: `const logger = getLogger();`
- `logger.info`: present participle ("Saving report...", "Deriving instance type...")
- `logger.error`: past tense ("Failed to fetch...", "Error deleting report")
- Always pass structured context with `accountId` first: `logger.info('Saving report', { accountId, resourceId })`

## Destructuring

Destructure at point of use. Rename `snake_case` DB fields to `camelCase`:

```typescript
// Good
const { resource_id: resourceId, host_config: hostConfig } = onPremDatabaseResource;

// Bad — repeated property access
const resourceId = onPremDatabaseResource.resource_id;
const hostConfig = onPremDatabaseResource.host_config;
```

## Naming

- camelCase for variables/functions, PascalCase for types/interfaces/classes.
- Boolean variables: prefix with `is`, `has`, `should`, `can`.
- Functions: verb-first — `fetchPricing`, `buildMachineDetail`, `assembleResponse`.
- For business/domain operation functions, prefer `accountId` as the first parameter. For low-level AWS/infra helpers (e.g. EC2/SSM operations), follow the established pattern in that module (often `credentialsId`, `region`, then `accountId`).

## No `continue` keyword

Never use `continue` in loops. Use `.filter()` / `.map()` or invert the condition.

```typescript
// Good
const active = resources.filter(r => r.status === 'active');
for (const resource of active) { processResource(resource); }

// Bad
for (const r of resources) { if (r.status !== 'active') { continue; } processResource(r); }
```

## Thin Wrappers

Don't introduce thin wrappers that merely delegate with hardcoded arguments. Call the underlying function directly unless the wrapper prevents duplication across 3+ callers or adds validation/error-handling.

---

# Error Handling

## Precise error logs with stack traces

- Pass the error object directly — never stringify: `logger.error('Failed to fetch pricing', { accountId, error })`
- Error messages must name the exact operation that failed and include all relevant identifiers.
- Never swallow errors silently.

## Guard clauses

Use `isEmpty()` from lodash, assign message to `const errorMessage`, log before throw:

```typescript
// Good
if (isEmpty(resources)) {
    const errorMessage = `No resources found for account ${accountId}`;
    logger.error(errorMessage, { accountId });
    throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
}

// Bad — no isEmpty, no logging, bare Error
if (resources.length === 0) { throw new Error('Not found'); }
```

## No pointless catch blocks

```typescript
// Bad — does nothing
catch (error) { throw error; }

// Good — adds context
catch (error) {
    logger.error('Savings computation failed', { accountId, error });
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Savings computation failed');
}
```

## HTTP errors

Always use `createError(HttpErrorCodes.X, message)` from `http-errors`. Never `throw new Error()`.

---

# Async Patterns

## Always async/await — never `.then()` chains

## No await inside loops

Use `Promise.all` with `.map()` for parallel processing:

```typescript
// Good
const results = await Promise.all(resources.map(r => fetchDetails(accountId, r.id)));

// Bad — sequential awaits in loop
for (const r of resources) { const d = await fetchDetails(accountId, r.id); results.push(d); }
```

## Parallel execution

Use `Promise.all` for independent async calls with destructured results:

```typescript
const [current, recommended] = await Promise.all([
    deriveHostConfigInstanceType(regionCode, hostInfo),
    deriveInstanceType(regionCode, instanceInfo, hostInfo)
]);
```

## Fire-and-forget

Non-blocking DB writes use `.catch()`: `bulkUpdate(accountId, data).catch(error => { logger.error('Failed to store data', { accountId, error }); });`

## Job tracking

Long-running ops: `try/catch/finally` with `jobStatus`/`jobError` variables. `finally` always calls `updateJob(...)`.
