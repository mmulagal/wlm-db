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

## Demo inventory fixtures (`demo-utils`)

When adding or editing seed data under `server/src/utils/demo-utils/` (inventory, discovery mocks, fake EC2/Oracle hosts):

- Do **not** put the substring `demo` (any case) in **user-visible strings** (`ec2InstanceName`, `ec2HostName`, VPC display **name**, labels shown in Discover/inventory tables). Discovery flows surface these fields.
- **Do** mirror naming already used in the same file or skill assets: for example instance names such as `oracle-node-5717`, `DATAGUARD-PRIMARY-oracle19c-*`, `DATAGUARD-STANDBY-*`; plausible VPC ids and names like other rows; private DNS forms like `ip-10-0-*.*.compute.internal`.
- For internal **identifiers** (`const`, helpers), neutral terms (`seed`, `fixture`, `tco`) are fine; avoid `demo` in new symbol names when it adds confusion.

For mock/seed workflows and file map, see `server/.cursor/skills/demo-environment-dev/` (especially `resources/seed-data.md`).

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

### Heredoc Rules for `sudo -i -u oracle bash` Blocks

**Prefer quoted heredocs** (`<<'EOF'`) for all `sudo -i -u oracle bash` blocks. Pass variables as positional arguments via `bash -s --`.

```bash
# GOOD — quoted heredoc, variables passed as arguments
sudo -i -u oracle bash -s -- "$ORACLE_SID" "$sqlplus_command" <<'EOF'
    export ORACLE_SID="$1"
    sqlplus_cmd="$2"
    # $ORACLE_SID and $sqlplus_cmd are evaluated inside the child shell
EOF

# BAD — unquoted heredoc, parent expands all $variables before child sees them
sudo -i -u oracle bash <<EOF
    export ORACLE_SID="$ORACLE_SID"
    $sqlplus_command  # expanded by parent, not child
EOF
```

**Why:** In unquoted heredocs (`<<EOF`), the parent shell expands ALL `$var` and `$(cmd)` references *before* the text reaches the child shell. This silently breaks intermediate variables — e.g., `oracle_home=$(lookup)` on line 1 does NOT set a parent variable that `$oracle_home` on line 2 can reference; both are expanded independently.

**Oracle home resolution utilities** (`oracle-ssm-script-utils.ts`):

| Function | Heredoc Type | Usage |
|---|---|---|
| `bashExportOracleHomeFromOratab(sid)` | Quoted (`<<'EOF'`) | Resolves ORACLE_HOME from `/etc/oratab` inside the child shell |
| `getOracleHomePath(sid)` | Quoted (`<<'EOF'`) | Returns the oracle home path for a SID from `/etc/oratab` |
| `resolveOracleHomeInParent(sidVar, varName)` | Unquoted (`<<EOF`) | Resolves oracle home in the **parent** scope before the heredoc. Use when converting to quoted heredocs is not feasible. |

If you must use an unquoted heredoc, resolve oracle home in the parent scope first using `resolveOracleHomeInParent`, then pass the resolved literal value into the heredoc. Never use `bashExportOracleHomeFromOratab` or `getOracleHomePath` inside unquoted heredocs — their intermediate `$variables` will expand to empty.

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
