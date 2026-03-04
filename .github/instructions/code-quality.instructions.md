---
applyTo: "**/server/src/**/*.ts,**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/logs-analyzer/src/**/*.ts"
---

# Code Quality

## Type Safety

- Never use explicit `any`. Use `unknown`, generics, or specific types.
- Never use `as never` or `as any` — use `as unknown as TargetType` if unavoidable.
- Use `Record<string, unknown>` not `Record<string, any>`.

### TypeBox Schemas

- Extract shared bases and compose via `Type.Intersect` when schemas share fields.
- Use factory functions for repeated wrapper structures.
- Export `Static<typeof Schema>` — don't manually duplicate shapes as interfaces.

```typescript
// Good — shared base + composition
const Base = Type.Object({ vcpus: Type.Number(), memory: Type.Number(), regionCode: Type.String() });
const SqlRequest = Type.Intersect([Type.Object({ sqlInstanceId: Type.String() }), Base]);
type SqlRequestType = Static<typeof SqlRequest>;

// Bad — duplicated fields across schemas + manual interface
```

---

## No Duplication

### Types and Interfaces

- Search for existing interfaces before defining new ones.
- Use shared base with `Partial<>`, `Required<>`, or `extends` when types differ minimally.

```typescript
// Good — progressive extension
interface ResourcePrepData { resourceId: string; resourceName: string; entries: Entry[]; }
interface ResourceWithPricing extends ResourcePrepData { pricing?: PricingDetails; }

// Bad — duplicated fields across separate interfaces
```

### Functions

- Shared logic across workloads belongs in shared operations files.
- Parameterize functions that differ only in a small argument — don't duplicate.

### Schemas

- Use factory functions for identical wrapper structures (e.g., paginated responses).

---

## No Dead Code

A function is dead ONLY if it has zero callers in ALL production code. Functions called internally but exported for tests are NOT dead.

- Remove functions with zero production callers.
- Remove unused imports, variables, interfaces, and type aliases immediately.
- When removing a function, also remove its export, test import, and test suite.

| Scenario | Classification |
| --- | --- |
| Zero callers anywhere in production | **Critical** — remove |
| Called internally, export only for tests | **Info** — valid pattern |
| Interface never used anywhere | **Critical** — remove |

---

## Constants and Enums

- File-level constants: `UPPER_SNAKE_CASE`. No magic numbers or strings in business logic.
- Shared constants in `utils/consts.ts`. Feature-specific constants in feature-specific const files.
- Import and use Prisma enums directly (`DATABASE_TYPE`, `JOBSTATUS`). Never re-declare.
- Always use `lodash-es` (ESM), never `lodash` (CommonJS). Standard: `compact`, `isEmpty`, `uniqBy`, `groupBy`.

```typescript
// Good
const MIN_VCPUS = 4;
import { DATABASE_TYPE, JOBSTATUS } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';

// Bad — magic number, re-declared enum, CommonJS lodash
const vcpus = Math.max(cpuCount, 4);
const COMPLETED = 'completed';
import { isEmpty } from 'lodash';
```
