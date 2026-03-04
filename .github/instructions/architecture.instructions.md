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
