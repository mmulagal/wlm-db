---
applyTo: "**/server/**"
---
# WLMDB Server Coding Instructions for GitHub Copilot

These instructions define coding standards, security practices, and conventions for the WLMDB (Well-Architected Database) server codebase.

---

## 1. TypeScript & Type Safety

- Use TypeScript strict mode with explicit types for all variables, parameters, and return values
- Define interfaces in dedicated files (`interfaces.ts`, `types.ts`) for all data structures
- Use enums for fixed value sets: `DatabaseType`, `JobType`, `JobStatus`, `DeploymentModel`
- Never use `any` type - use `unknown` with type guards when type is uncertain
- Use union types for constrained string values: `'oracle' | 'mssql' | 'postgresql'`
- Export types/interfaces alongside implementations when tightly coupled

---

## 2. File Organization & Naming

- Use kebab-case for all file names: Example - `database-operations.ts`, `job-routes.ts`
- Organize by feature/domain in folders: `operations/`, `routes/`, `utils/`, `lib/`
- Naming conventions:
  - `*-operations.ts` - Business logic and data operations
  - `*-routes.ts` - Express HTTP route handlers
  - `*-utils.ts` - Utility functions
- Keep route handlers thin - delegate all logic to operations
- One primary responsibility per file
- Place shared utilities in `utils/` folder
- Place database client and external service clients in `lib/`

---

## 3. Logging Standards

- Import centralized logger: `import getLogger from '../../utils/logger'`
- Initialize once per file at module level: `const logger = getLogger()`
- Use appropriate log levels:
  - `ERROR` - Failures requiring attention
  - `WARN` - Issues that don't stop execution
  - `INFO` - Operation milestones (start, complete)
  - `DEBUG` - Detailed diagnostic info
- Always include context object with relevant metadata
- Log at operation boundaries: start, success, failure
- **NEVER log sensitive data**: passwords, tokens, credentials, connection strings, PII

---

## 4. Error Handling

- Wrap all async operations in try/catch blocks
- Log errors with context before re-throwing
- Return structured error responses from API endpoints
- Never expose internal error details to clients in production
- Use error codes for programmatic handling
- Create custom error classes for domain-specific errors


---

## 5. Async/Await Patterns

- Always use async/await over raw Promises and callbacks
- Use `Promise.all()` for parallel independent operations
- Use `Promise.allSettled()` when all results needed regardless of individual failures
- Control concurrency with `throat` to limit parallel executions and avoid overwhelming external services
- Never mix callbacks with async/await
- Always handle promise rejections

---

## 6. Prisma Database Patterns

- Import Prisma client from centralized `lib/prisma.ts`
- Select only needed fields using `select` to reduce data transfer
- Use Prisma's type-safe query builders
- Handle unique constraint violations with specific error responses
- Use `include` sparingly - prefer explicit field selection

---

## 7. API Response Conventions

### Naming Convention
- Use **camelCase** for all response object properties
- Never use snake_case or PascalCase in API responses
- Be consistent across all endpoints


### Paginated Responses
- Return `items` array containing the result set
- Return `nextToken` for cursor-based pagination (null/undefined if no more pages)
- Accept `pageSize` and `nextToken` as query parameters
- Use consistent structure across all list endpoints

```typescript
// Response structure for paginated endpoints
interface PaginatedResponse<T> {
    items: T[];
    nextToken?: string | null;
}

router.get('/database-hosts', async (request, reply) => {
    const { pageSize = 50, nextToken } = request.query;
    
    const { hosts, newNextToken } = await getDatabaseHosts({
        pageSize,
        nextToken
    });
    
    return reply.send({
        items: hosts.map(host => ({
            databaseHostId: host.id,
            instanceName: host.name,
            status: host.status,
            databaseType: host.databaseType,
            createdAt: host.createdAt
        })),
        nextToken: newNextToken || null
    });
});

// Query parameter schema (Fastify/TypeBox)
const NextTokenQueryString = Type.Object({
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 }))
});
```

### Single Resource Responses
- Return the resource object directly (not wrapped in `items`)
- Include all relevant fields in camelCase

### Action/Mutation Responses
- Return `jobId` for async operations
- Return the created/updated resource for sync operations
- Use appropriate HTTP status codes (201 for created, 200 for updated)

---

## 8. AWS SDK Patterns

- Use AWS SDK v3 with modular imports (not v2)
- Create clients as singletons - initialize once, reuse
- Handle AWS-specific errors by checking `error.name` or `error.$metadata`
- Set appropriate timeouts for long-running operations
- Use pagination helpers for list operations
- Use appropriate retry strategies and exponential backoff
- Cache responses where feasible to reduce API calls

---

## 9. Security Best Practices

### Credentials & Secrets
- **NEVER** hardcode credentials, API keys, or secrets in code
- Use environment variables for all sensitive configuration
- Use AWS Secrets Manager or Parameter Store for production secrets
- Validate required environment variables at application startup
- Use `.env` files only for local development (never commit)

### Input Validation
- Validate **ALL** user input before processing
- Use allowlists over denylists
- Sanitize inputs for SQL (Prisma handles parameterization)
- Validate file uploads: type, size, content
- Validate enum values against allowed sets


### Data Protection
- Never log sensitive data (passwords, tokens, PII, connection strings)
- Encrypt sensitive data at rest
- Use TLS for all network communication
- Mask sensitive fields in API responses
- Implement proper session management

### SQL/Command Injection Prevention
- Use Prisma's parameterized queries (automatic)
- Never concatenate user input into SQL strings
- Validate and sanitize inputs for SSM commands
- Use prepared statements for raw SQL when necessary

---

## 10. Configuration Management

- Use `config` package with environment-specific JSON files
- Store in `config/` folder: `default.json`, `production.json`, `demo.json`
- Access via `import config from 'config'`
- Override with environment variables where needed
- Never store secrets in config files


---

## 11. Testing Conventions

- Use Vitest for unit and integration tests
- Place tests in `test/` folder mirroring `src/` structure
- Use descriptive test names explaining behavior
- Mock external services (AWS, database) in unit tests
- Use Prismock for database mocking
- Reset mocks in `beforeEach`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismock } from '../__mocks__/@prisma/client';

describe('database-operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismock.reset();
    });

    describe('getInstances', () => {
        it('should return all instances for valid resource ID', async () => {
            // Arrange
            prismock.databaseInstance.create({ data: mockInstance });
            
            // Act
            const instances = await getInstances('valid-uuid');
            
            // Assert
            expect(instances).toHaveLength(1);
            expect(instances[0]).toHaveProperty('id');
        });

        it('should return empty array when no instances exist', async () => {
            const instances = await getInstances('nonexistent-uuid');
            expect(instances).toEqual([]);
        });
    });
});
```

---

## 12. Documentation Standards

- Use JSDoc comments for all public functions
- Document parameters, return types, and thrown errors
- Add inline comments for non-obvious logic
- Keep README.md updated with setup and usage

---

## 13. ES Module Compatibility

- Use ES module imports/exports throughout
- Avoid CommonJS `require` and `module.exports`
- Use `import` for all dependencies

---

## 14. Environment-Specific Behavior

- Use `NODE_ENV` to control environment-specific logic
- Common values: `development`, `production`, `test`, `simulator`
- Disable verbose logging in production
- Enable additional validation in development

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
    logger.debug('Detailed debug info', { fullObject });
}
```

---

## 15. Utility Libraries - Use Built-in Functions

Prefer using established utility libraries over vanilla JavaScript implementations for common operations. These libraries are well-tested, optimized, and handle edge cases properly. Examples include: lodash-es, moment, numeral, flatted etc.


## 16. Shell & PowerShell Script Standards

Scripts are embedded in TypeScript as template literals and executed remotely via AWS SSM. Follow these patterns strictly.

### General Principles
- All scripts must output **valid JSON** for programmatic parsing
- Include **error handling** with meaningful error messages in JSON output
- Use **timeouts** for all subprocess calls to prevent hanging
- **NEVER** echo credentials or sensitive data
- Use **logging functions** for debugging (output goes to log files, not stdout)
- Test scripts locally before embedding in TypeScript

### PowerShell (MSSQL - Windows)

- Use `Call-SqlCmd` function (WLMDB custom) instead of raw `Invoke-Sqlcmd`
- Output JSON using `ConvertTo-Json -Compress`
- Use `Get-WmiObject` for system information (vCPUs, memory, disk)
- Handle SQL authentication modes: Domain auth (CredSSP), SQL auth, Windows auth
- Validate JSON before parsing with `Test-ValidJson` function

```powershell
$sqlInstanceName = "MSSQLSERVER"
$sqlCredential = @{'useSqlAuth' = $False; 'useDomainAuth' = $False}

$ServerInstanceName = "$env:COMPUTERNAME"
If ($sqlInstanceName -ne "MSSQLSERVER") {
    $ServerInstanceName = "$env:COMPUTERNAME\\$sqlInstanceName"
}

# Get system info
$vcpus = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors

# Execute SQL query
$result = Call-SqlCmd -SqlCredential $sqlCredential -Query "sp_configure 'max degree of parallelism'" -InstanceName "$ServerInstanceName"

# Validate and parse JSON response
if (-Not ([string]::IsNullOrEmpty($result)) -and (Test-ValidJson -JsonString $result)) {
    $parsed = $result | ConvertFrom-Json
} else {
    $responseObject = @{ error = "Query failed: $result" }
}

# Output as JSON
$responseObject = @{
    vcpus = $vcpus
    maxdop = $maxDop
    compliant = ($maxDop -le 8)
}
$responseObject | ConvertTo-Json -Compress
```

```powershell
# Bad - Uses raw Invoke-Sqlcmd instead of Call-SqlCmd wrapper
$result = Invoke-Sqlcmd -Query "SELECT @@VERSION"

Write-Host "The result is: $result"
```

### Bash/Linux (Oracle, PostgreSQL)

- Start with `#!/bin/bash` shebang
- Use Python scripts wrapped in heredocs for complex logic
- Output JSON using `json.dumps()`
- Use `subprocess.run()` with `timeout` parameter
- Log to files using centralized logging functions, not stdout

```bash
# Bash wrapper for Python script (Oracle pattern)
#!/bin/bash

# Log file check (creates log directory)
LOG_DIR="/var/log/wlmdb"
mkdir -p "$LOG_DIR"

# Switch to oracle user and run Python
sudo -i -u oracle bash <<'ORACLE_SHELL'
python3 << 'EOF'
import subprocess
import json
import sys

def log(message):
    # Log to file, not stdout (stdout is for JSON output only)
    with open('/var/log/wlmdb/optimization.log', 'a') as f:
        f.write(f"{message}\n")

try:
    log("Starting optimization check")
    
    # Run command with timeout
    result = subprocess.run(
        ['sysctl', '-n', 'net.ipv4.tcp_timestamps'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=10
    )
    
    if result.returncode != 0:
        output = {"error": f"Command failed: {result.stderr.strip()}"}
    else:
        output = {
            "tcp_timestamps": result.stdout.strip(),
            "compliant": result.stdout.strip() == "1"
        }
    
    log(f"Check complete: {output}")
    print(json.dumps(output))
    
except subprocess.TimeoutExpired:
    print(json.dumps({"error": "Command timed out"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
EOF
ORACLE_SHELL
```

```bash
# Bad - No error handling, no JSON output
#!/bin/bash
sysctl -n net.ipv4.tcp_timestamps
echo "Done!"

# Bad - Password in script
sqlplus admin/MySecretPass123@//host:1521/ORCL
```

### TypeScript Template Patterns

- Use template literals with proper escaping
- Define reusable script fragments as constants
- Parameterize scripts using template interpolation
- Keep scripts readable with consistent indentation

```typescript
// Good - Parameterized script template
const getMaxDopScript = (instanceName: string, useSqlAuth: boolean) => `
$sqlInstanceName = "${instanceName}"
$sqlAuthEnabled = [System.Convert]::ToBoolean('${useSqlAuth}')
$sqlCredential = @{'useSqlAuth' = $sqlAuthEnabled; 'useDomainAuth' = $False}

$result = Call-SqlCmd -SqlCredential $sqlCredential -Query "sp_configure 'max degree of parallelism'" -InstanceName "$env:COMPUTERNAME"
$result | ConvertTo-Json -Compress
`;

// Good - Reusable script fragments
const LOG_FILE_CHECK = `
LOG_DIR="/var/log/wlmdb"
mkdir -p "$LOG_DIR"
`;

const pythonScriptInit = (pythonCode: string, logFileName: string) => `
python3 << 'EOF'
import json
import subprocess

LOG_FILE = "/var/log/wlmdb/${logFileName}.log"

def log(msg):
    with open(LOG_FILE, 'a') as f:
        f.write(f"{msg}\\n")

${pythonCode}
EOF
`;
```

### Script Output Standards

All scripts must return JSON in one of these formats:

```typescript
// Success response
interface ScriptSuccessResponse {
    [key: string]: string | number | boolean | object;
    // Example: { maxdop: 4, vcpus: 8, compliant: true }
}

// Error response
interface ScriptErrorResponse {
    error: string;
    // Example: { error: "Query timed out after 30 seconds" }
}
```

### Security in Scripts
- **NEVER** hardcode credentials in scripts
- Use `$sqlCredential` parameter pattern for MSSQL
- Use AWS SSM Parameter Store for secrets
- Avoid logging credential values

---

## Quick Reference Checklist

Before generating or committing code, verify:

- [ ] All variables and parameters have explicit types
- [ ] No `any` types used
- [ ] Error handling with try/catch for async operations
- [ ] Logging at operation start, success, and failure
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] Input validation for all external inputs
- [ ] Environment variables for configuration/secrets
- [ ] Tests written for new functionality
- [ ] JSDoc comments for public functions
- [ ] Consistent file naming (kebab-case)
- [ ] Prisma queries select only needed fields
- [ ] AWS clients created as singletons
- [ ] Transactions used for multi-table operations
- [ ] Proper HTTP status codes in API responses

### For API Responses
- [ ] All response properties in camelCase
- [ ] Paginated endpoints return `items` array and `nextToken`
- [ ] Single resource endpoints return object directly (not wrapped)
- [ ] Async operations return `jobId`

### For Shell/PowerShell Scripts
- [ ] Scripts output valid JSON only
- [ ] Error handling with meaningful error messages in JSON
- [ ] Timeouts set for all subprocess calls
- [ ] No credentials hardcoded in scripts
- [ ] Logging goes to files, not stdout
- [ ] MSSQL: Uses `Call-SqlCmd` (not `Invoke-Sqlcmd`)
- [ ] Linux: Uses Python heredocs with proper escaping
- [ ] Oracle: Runs as oracle/grid user with `sudo -i -u`

### For Utility Functions
- [ ] Use `lodash-es` for complex array/object transformations (groupBy, keyBy, flatten, cloneDeep)
- [ ] Use `moment` for date formatting and manipulation
- [ ] Use `numeral` for number formatting (file sizes, currency, percentages)
- [ ] Use `flatted` for JSON with circular references
- [ ] Import specific functions from lodash-es, not entire library
- [ ] Avoid reimplementing functionality that exists in utility libraries
