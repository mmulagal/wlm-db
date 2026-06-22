---
applyTo: "**/server/src/**/*.ts"
---

# Project Architecture

## File Organization

| Purpose | File |
| --- | --- |
| Shared/reusable operations | `operations/onprem-tco-operations.ts` |
| Workload-specific operations | `operations/workloads/<type>/<type>-onprem-tco-operations.ts` |
| Route schemas | `routes/schemas/<feature>-schema.ts` |
| TypeBox types | `routes/types/<feature>.types.ts` |
| Generic types | `utils/<feature>/<feature>-generic.types.ts` |

## Export Convention

- Bottom-of-file `export { ... }` block — never inline `export` on declarations.
- Route files use `export default function`.

```typescript
// Good — bottom-of-file export
function generatePayload(accountId: string) { ... }
function deleteReport(accountId: string, resourceId: string) { ... }
export { generatePayload, deleteReport };

// Bad — inline exports scattered throughout
export function generatePayload(...) { ... }
```

## Validation Functions

Return `boolean`. Check falsy first, then destructure and check sub-properties. Never throw from validators.

## Type Definitions

- Local types: in-file between imports and functions.
- Shared types: `routes/types/*.types.ts`.

## Module-Level Declaration Order

Within a module, declarations appear in this order so a reader can scan top-to-bottom and find everything a function needs already in scope:

1. **Imports** (grouped per `code-style.instructions.md` — third-party / AWS SDK / internal utils / sibling operations).
2. **Module-scope constants and lookup tables** that don't depend on the file's own functions (e.g. `const logger = getLogger();`, golden-config slices, regex literals, derived enum lists).
3. **Local types and interfaces** consumed by the functions below — including discriminated-union helpers, args/result shapes, and table-row types.
4. **Functions** — helpers first, then the top-level operations that compose them.
5. **Bottom-of-file `export { ... }` block** (per the "Export Convention" section above).

Co-locate a type with its consumers if it is used by exactly one function (e.g. an `Args` object type for a single helper). Lift a type to the module-level types section (step 3) the moment a second function references it.

```typescript
// Good — imports, then constants, then types, then functions, then exports.
import { isEmpty } from 'lodash-es';

import getLogger from '../../utils/logger';

const logger = getLogger();
const VOLUME_PARAMETERS = ['compression', 'deduplication'] as const;

interface VolumeContext {
    volumes: Array<Record<string, unknown>>;
    archiveIds: string[];
}

function buildContext(...): VolumeContext { ... }
function getVolumeDrift(...) {
    const context = buildContext(...);
    // ...
}

export { getVolumeDrift, buildContext };

// Bad — type declared between two functions; reader has to scroll past unrelated code.
function buildContext(...) { ... }

interface VolumeContext { ... }   // belongs at the top

function getVolumeDrift(...) { ... }
```

---

# Route Handlers

## Zero business logic

Routes contain no conditionals, loops, or data transformation: schema -> castRequest -> destructure -> call operation -> reply.send.

```typescript
// Good — thin route handler
server.post(path, { schema: MySchema }, async (request: FastifyRequest, reply) => {
    const { params: { accountId }, body: { fileName } } = castRequest(request);
    const response = await myOperation(accountId, fileName);
    return reply.send(response);
});

// Bad — business logic in route
server.post(path, { schema }, async (request, reply) => {
    const { params: { accountId }, body } = castRequest(request);
    const resources = await getResources(accountId);
    const filtered = resources.filter(r => r.status === 'active');
    return reply.send({ items: filtered });
});
```

## Job tracking

Long-running operations: `try/catch/finally` with `jobStatus`/`jobError`, update job in `finally`.
