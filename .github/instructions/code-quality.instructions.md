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

## Performance and simplicity (agent guidance)

**Goal:** Ship correct, readable code. Speed up only what measurement shows is slow.

### Default behavior (apply unless the task explicitly requires optimization with evidence)

- **Do not** add “speed hacks,” clever micro-optimizations, or exotic algorithms because you *think* a path will be hot. Hot spots are often surprising (Pike’s rule 1).
- **Do not** tune for speed until there is **measurement** (profiler, timings, traces, or reproducible benchmarks) showing one part dominates cost. If it doesn’t dominate, leave it simple (Pike’s rule 2; aligns with Hoare: *premature optimization is the root of all evil*).
- **Prefer** simple algorithms and simple data structures when `n` is usually small; complex algorithms have large constant factors and are often wrong or hard to maintain (Pike’s rules 3–4; Thompson: *when in doubt, use brute force*; KISS).
- **Prioritize** picking the right **data structures** and organizing data well; straightforward logic usually follows (Pike’s rule 5; Brooks: *The Mythical Man-Month* — often summarized as *write stupid code that uses smart objects*).

### Concurrent async / I/O (default)

- **Prefer concurrent calls** when operations are independent (no ordering requirement, no input from one call needed for another, no shared mutable state that forbids overlap). Run them in parallel (e.g. `Promise.all`, `Promise.allSettled`, or structured concurrency patterns) instead of awaiting sequentially.
- **Serialize only when required** — when call B genuinely depends on A’s result, when the API or data model enforces ordering, when a single resource must not be used concurrently, or when correctness would break if operations interleave.

```typescript
// Good — independent I/O in parallel
const [user, settings] = await Promise.all([fetchUser(id), fetchSettings(id)]);

// Bad — unnecessary waterfall when calls don’t depend on each other
const user = await fetchUser(id);
const settings = await fetchSettings(id); // could run with fetchUser
```

### When the user asks for performance work

1. **Confirm or add measurement** — identify the actual bottleneck (call path, query, loop, I/O); if unknown, propose profiling or timing steps first, not code changes.
2. **Optimize the proven hotspot** — smallest change that fixes measured cost; keep the rest simple.
3. **Escalate complexity only when justified** — fancier algorithms or structures only if measurement shows large `n` or repeated cost *and* simplicity is insufficient.

### Quick reference (Pike’s rules, verbatim)

1. You can’t tell where a program will spend its time; don’t speed-hack until you’ve proven where the bottleneck is.
2. Measure; don’t tune until you’ve measured, and only if one part overwhelms the rest.
3. Fancy algorithms are slow when `n` is small; `n` is usually small — don’t get fancy until you know `n` is often big (still use rule 2 first).
4. Fancy algorithms are buggier and harder to implement — prefer simple algorithms and data structures.
5. Data dominates — right structures and organization make algorithms obvious; structures, not algorithms, are central.

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
