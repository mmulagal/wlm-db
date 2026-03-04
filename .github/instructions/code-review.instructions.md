---
applyTo: "**/server/src/**/*.ts,**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/logs-analyzer/src/**/*.ts"
---

# Code Review Checklist

When reviewing code, auditing quality, or preparing for PR, check all changed files for:

1. **Dead code**: Zero callers in all production code = dead. Exported for tests only = Info (valid).
2. **Duplicate types**: >70% identical fields across schemas/interfaces — suggest shared base.
3. **Type safety**: Flag `as any`, `as never`, explicit `any`, `|| {}` on typed objects.
4. **Destructuring**: 3+ repeated property accesses on same object. Rename `snake_case` to `camelCase`.
5. **Error handling**: Flag `` `...${error}` `` (loses stack). Flag missing `logger.error` before throw. Flag empty `catch { throw error }`.
6. **Error log precision**: Must name exact operation, pass `error` object (not stringified), include identifiers.
7. **Unused imports**: Check for imports no longer referenced.
8. **API consistency**: TypeBox schemas use shared bases where fields overlap.
9. **Test alignment**: Exported functions with no test coverage.
10. **Import order**: Third-party -> AWS SDK -> internal utils -> sibling operations.
11. **Logging**: Structured context with `accountId` first. Info = present participle, error = past tense.
12. **Async patterns**: Flag `.then()` chains. Verify `Promise.all` for parallel calls. No `await` in loops.
13. **Constants**: Flag magic numbers/strings — use `UPPER_SNAKE_CASE`.
14. **Route handlers**: Thin — schema + castRequest + destructure + operation + reply.send. No business logic.

Report findings as **Critical** (must fix), **Warning** (should fix), or **Info** (consider).
