---
applyTo: "**/server/src/**/*.ts"
---

# Server-Specific Patterns

General TypeScript, logging, error handling, async patterns, and type safety are in core rules. This covers server-only patterns.

## Prisma Database

- Import Prisma client from `utils/prisma-utils.ts` (`import { prisma } from '../../utils/prisma-utils'`). Import Prisma types/enums directly from `@prisma/client`.
- Select only needed fields using `select` — avoid `include` unless necessary.
- Handle unique constraint violations with specific error responses.

## API Response Conventions

- **camelCase** for all response properties — never snake_case or PascalCase.
- Paginated: return `items` array + `nextToken` (null if no more pages). Accept `pageSize` + `nextToken` as query params.
- Single resource: return object directly (not wrapped in `items`).
- Async operations: return `jobId`.

```typescript
// Paginated response structure
interface PaginatedResponse<T> { items: T[]; nextToken?: string | null; }

// Query param schema
const NextTokenQueryString = Type.Object({
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 }))
});
```

## AWS SDK

- AWS SDK v3 with modular imports (not v2).
- Create clients as singletons — initialize once, reuse.
- Handle errors by checking `error.name` or `error.$metadata`.
- Use pagination helpers for list operations.

## Security

- **NEVER** hardcode credentials, API keys, or secrets.
- Validate ALL user input. Use allowlists over denylists.
- Never log sensitive data (passwords, tokens, PII, connection strings).
- Use Prisma's parameterized queries — never concatenate user input into SQL.

## Configuration

- Use `config` package with `config/` folder: `default.json`, `production.json`, `demo.json`.
- Access via `import config from 'config'`. Never store secrets in config files.

## Shell & PowerShell Scripts

Scripts are embedded as template literals and executed via AWS SSM.

### General

- All scripts output **valid JSON** only. Logging goes to files, not stdout.
- Include error handling with meaningful JSON error messages.
- Use timeouts for subprocess calls. NEVER echo credentials.

### PowerShell (MSSQL - Windows)

- Use `Call-SqlCmd` (not raw `Invoke-Sqlcmd`). Output with `ConvertTo-Json -Compress`.
- Handle SQL auth modes: Domain (CredSSP), SQL auth, Windows auth.

### Bash/Linux (Oracle, PostgreSQL)

- Use Python heredocs for complex logic. Output JSON via `json.dumps()`.
- Use `subprocess.run()` with `timeout`. Run as appropriate user (`sudo -i -u oracle`).

### TypeScript Templates

- Use template literals with proper escaping. Define reusable script fragments as constants.

### Script Output

```typescript
// All scripts return one of:
interface ScriptSuccess { [key: string]: string | number | boolean | object; }
interface ScriptError { error: string; }
```

## Quick Reference

- [ ] Prisma: `select` only needed fields
- [ ] AWS SDK v3 singletons
- [ ] API responses: camelCase, `items` + `nextToken` for lists
- [ ] Scripts: valid JSON output, `Call-SqlCmd` for MSSQL, Python heredocs for Linux
- [ ] No hardcoded credentials
