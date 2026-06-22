---
applyTo: '**/server/src/**/*.ts,**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/logs-analyzer/src/**/*.ts'
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

-   Initialize at module scope after imports: `const logger = getLogger();`
-   `logger.info`: present participle ("Saving report...", "Deriving instance type...")
-   `logger.error`: past tense ("Failed to fetch...", "Error deleting report")
-   Always pass structured context with `accountId` first: `logger.info('Saving report', { accountId, resourceId })`

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

-   camelCase for variables/functions, PascalCase for types/interfaces/classes.
-   Boolean variables: prefix with `is`, `has`, `should`, `can`.
-   Functions: verb-first — `fetchPricing`, `buildMachineDetail`, `assembleResponse`.
-   For business/domain operation functions, prefer `accountId` as the first parameter. For low-level AWS/infra helpers (e.g. EC2/SSM operations), follow the established pattern in that module (often `credentialsId`, `region`, then `accountId`).

## No `continue` keyword

Never use `continue` in loops. Use `.filter()` / `.map()` or invert the condition.

```typescript
// Good
const active = resources.filter(r => r.status === 'active');
for (const resource of active) {
    processResource(resource);
}

// Bad
for (const r of resources) {
    if (r.status !== 'active') {
        continue;
    }
    processResource(r);
}
```

## Thin Wrappers

Don't introduce thin wrappers that merely delegate with hardcoded arguments. Call the underlying function directly unless the wrapper prevents duplication across 3+ callers or adds validation/error-handling.

## No inline helpers for non-trivial logic

Don't define nested arrow or `function` expressions inside another function when they

- contain loops, `filter`/`map` chains, or parsing of structured strings (paths, URIs, JSON), or
- mutate captured outer state across more than one branch, or
- exceed ~5 lines of body.

Lift such helpers to module scope (file-level `function` declaration or `const fn = ...` near other helpers) so they get an independent name, are testable in isolation, and are visible without scrolling into the caller. Tiny single-expression callbacks (`arr.map(x => x.id)`, `arr.filter(r => r.status === 'active')`) stay inline — this rule is about helpers, not callbacks.

```typescript
// Bad — nested helper parses a path, mutates an outer map, and runs a filter+forEach
function buildIndex(items: Item[], lookup: Map<string, Parent>) {
    const out = new Map<string, Pair>();
    const collect = (item: Item) => {
        const segments = item.path.split('/');
        const parentName = segments[2];
        const parent = lookup.get(parentName);
        if (parent) {
            out.set(item.id, { item, parent });
        }
    };
    items.filter(i => i.path).forEach(collect);
    return out;
}

// Good — helper lifted to module scope, caller body reads top-to-bottom
function pairWithParent(item: Item, lookup: Map<string, Parent>): Pair | undefined {
    const parentName = item.path.split('/')[2];
    const parent = lookup.get(parentName);
    return parent ? { item, parent } : undefined;
}

function buildIndex(items: Item[], lookup: Map<string, Parent>) {
    const out = new Map<string, Pair>();
    items.forEach(item => {
        const pair = pairWithParent(item, lookup);
        if (pair) out.set(item.id, pair);
    });
    return out;
}
```

---

# Error Handling

## Precise error logs with stack traces

-   Pass the full `error` object directly — never `error.message`, `String(error)`, or `` `${error}` `` (all lose the stack).
-   Error messages must name the exact operation that failed and include all relevant identifiers.
-   Never swallow errors silently.
-   **Include stack** (pass `error` object): unexpected runtime errors, external service failures (AWS/DB/HTTP), data-integrity issues, re-thrown errors with added context.
-   **Stack not needed** (message-only is fine): expected business rejections ("not found", "duplicate"), user-input validation failures.

```typescript
// Good — full error object preserves stack
try {
    await fetchInstancePricing(accountId, regionCode);
} catch (error) {
    logger.error('Failed to fetch instance pricing', { accountId, regionCode, error });
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch instance pricing');
}

// Bad — loses stack
logger.error(`Failed: ${error}`, { accountId }); // stringified
logger.error('Failed', { accountId, error: (error as Error).message }); // message only
```

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
if (resources.length === 0) {
    throw new Error('Not found');
}
```

## No pointless catch blocks

```typescript
// Bad — does nothing
try {
    await computeSavings(accountId);
} catch (error) {
    throw error;
}

// Good — adds context
try {
    await computeSavings(accountId);
} catch (error) {
    logger.error('Savings computation failed', { accountId, error });
    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Savings computation failed');
}
```

## HTTP errors

Always use `createError(HttpErrorCodes.X, message)` from `http-errors`. Never `throw new Error()`.

## Comments

- Keep any single comment block (line or JSDoc) to **3-5 lines maximum**. Longer commentary belongs in a design doc or PR description, not the source.
- Describe the **current implementation** — what the code does, the contract it upholds, the invariant it relies on. Do **not** describe the diff (no "previously", "now does", "replaces the old pass", "moved out of X"); the code at HEAD must read the same to someone joining today as to the author.
- Skip narration comments that restate the code (`// Loop over targets`, `// Set the result`). Add a comment only when it captures non-obvious intent, a constraint, or a subtle decision the code itself cannot convey.
- A JSDoc on a function should state purpose + return contract in 2-4 lines. Co-locate it directly above the function it documents — never separate them with another declaration.

```typescript
// Good — short, describes current behavior + invariant
// Skip non-combined names: descriptor would be undefined and crash on .components.
if (!isCombinedOptimizeConfig(target.configurationName)) return;

// Bad — describes the diff / change history
// We used to expand combined targets in the caller, but now we do it here in a single pass
// because the previous approach fetched assessment data twice and that was slow. Eventually
// the legacy pre-expansion call site at line 312 will be removed once Oracle is migrated.
if (!isCombinedOptimizeConfig(target.configurationName)) return;
```

---

# Async Patterns

## Always async/await — never `.then()` chains

## No await inside loops

Use `Promise.all` with `.map()` for parallel processing:

```typescript
// Good
const results = await Promise.all(resources.map(r => fetchDetails(accountId, r.id)));

// Bad — sequential awaits in loop
for (const r of resources) {
    const d = await fetchDetails(accountId, r.id);
    results.push(d);
}
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
