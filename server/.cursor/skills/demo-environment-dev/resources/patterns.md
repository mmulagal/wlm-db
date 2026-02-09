# Mock Implementation Patterns

## Pattern 1: AWS SDK Mocking

**Location**: `test/simulator/scopes/aws/[service]-scope.ts`

**Library**: `aws-sdk-client-mock`

**When to use**: For any AWS SDK v3 client calls

```typescript
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck  ← Add this if type issues arise
import { mockClient } from 'aws-sdk-client-mock';
import { 
    ServiceClient, 
    CommandName,
    AnotherCommand 
} from '@aws-sdk/client-[service]';
import responseData from '../../responses/aws/[response-file].json';

const serviceMock = mockClient(ServiceClient);

// Pattern A: Simple response (most common)
serviceMock.on(CommandName).resolves(responseData);

// Pattern B: Conditional response based on input params
serviceMock
    .on(CommandName, { SpecificParam: 'value' })
    .resolves(specificResponse);

// Pattern C: Dynamic response using callsFake
serviceMock.on(CommandName).callsFake(async (command) => {
    const inputParam = command.SomeParam;
    // Build dynamic response
    return { 
        Result: inputParam,
        Items: [/* ... */]
    };
});

// Pattern D: Chained conditionals (order matters - specific first!)
serviceMock
    .on(CommandName)
    .resolves(defaultResponse)  // Fallback
    .on(CommandName, { Filter: 'specific' })
    .resolves(specificResponse);  // This won't work! Specific must come first
```

**Important**: More specific mocks must be defined BEFORE general fallbacks.

---

## Pattern 1B: Dynamic ID Generation (Prefer Over Static JSON)

**IMPORTANT**: When creating mock responses, prefer generating dynamic IDs at runtime instead of hardcoding static values in JSON files. This prevents ID collisions and makes mocks more realistic.

**SECURITY NOTE**: Do NOT use `faker` for ID generation due to security concerns. Use Node.js built-in `crypto` module instead.

**Approved libraries** (already in project):

```typescript
import { randomUUID } from 'crypto';       // ✅ SECURE - Node.js built-in UUIDs
import crypto from 'crypto';               // ✅ SECURE - For hashing and random bytes
import randomize from 'randomatic';        // ✅ OK - Pattern-based random strings (test only)
import { cloneDeep, sample } from 'lodash-es';  // Object manipulation
```

**Common patterns using SECURE alternatives:**

```typescript
import { randomUUID, randomBytes } from 'crypto';
import randomize from 'randomatic';

// UUIDs (for GUIDs, server GUIDs, job IDs, etc.) - PREFERRED
const uuid = randomUUID();  // e.g., "550e8400-e29b-41d4-a716-446655440000"

// EC2 Instance IDs (i-xxxxxxxxxxxxxxxxx)
const ec2InstanceId = `i-${randomBytes(9).toString('hex').slice(0, 17)}`;

// Volume IDs (vol-xxxxxxxxxxxxxxxxx)  
const volumeId = `vol-${randomBytes(9).toString('hex').slice(0, 17)}`;

// FSx File System IDs (fs-xxxxxxxxxxxxxxxxx)
const fsxId = `fs-${randomBytes(9).toString('hex').slice(0, 17)}`;

// Numeric strings (for ports, counts, etc.)
const numericId = randomize('0', 5);  // e.g., "48291"

// Alphanumeric (for keys, fingerprints)
const keyPairId = randomBytes(10).toString('hex');  // 20 hex chars

// Random hex string of specific length
const hexString = (length: number) => randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

// IP addresses (simple pattern for mocks)
const generateIp = () => `10.${randomize('0', 1, { max: 255 })}.${randomize('0', 1, { max: 255 })}.${randomize('0', 1, { max: 255 })}`;

// ARNs
const arn = `arn:aws:ec2:us-east-1:${randomize('0', 12)}:instance/${ec2InstanceId}`;

// Timestamps
const timestamp = new Date().toISOString();
```

**Helper functions (add to your scope file if needed):**

```typescript
import { randomUUID, randomBytes } from 'crypto';

// Generate AWS-style resource IDs
const generateAwsId = (prefix: string, length: number = 17) => 
    `${prefix}-${randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)}`;

// Usage:
const instanceId = generateAwsId('i');      // i-a1b2c3d4e5f6g7h8i
const volumeId = generateAwsId('vol');      // vol-a1b2c3d4e5f6g7h8i
const fsxId = generateAwsId('fs');          // fs-a1b2c3d4e5f6g7h8i
const snapshotId = generateAwsId('snap');   // snap-a1b2c3d4e5f6g7h8i
```

**When to use dynamic vs static:**

| Use Dynamic IDs | Use Static JSON |
|-----------------|-----------------|
| Instance IDs, Volume IDs | Fixed configuration values |
| Timestamps, dates | Enum values (states, types) |
| IP addresses | Schema/structure examples |
| UUIDs, GUIDs | Reference data (regions, AZs) |
| Names with random suffixes | Error responses |

**Libraries to AVOID for security reasons:**

| Library | Issue | Use Instead |
|---------|-------|-------------|
| `faker` | Security vulnerabilities | `crypto.randomUUID()`, `crypto.randomBytes()` |
| `uuid` (npm package) | External dependency | `crypto.randomUUID()` (built-in since Node 14.17) |
| `Math.random()` | Not cryptographically secure | `crypto.randomBytes()` |

---

## Pattern 2: SSM Command Mocking (Most Complex)

**Location**: `test/simulator/scopes/aws/ssm-scope.ts`

**Critical Understanding**: SSM command execution is a TWO-STEP process:
1. `SendCommandCommand` - Initiates command, returns CommandId
2. `GetCommandInvocationCommand` - Polls for result using CommandId

**Both must be mocked for the command to work!**

### Step 1: Identify the Command Matching Strategy

SSM commands can be matched by:

```typescript
// Strategy A: Exact parameter match (when script is a constant)
const myCommandParams = {
    commands: [SCRIPT_CONSTANT_FROM_SRC]  // Import from src/operations/...
};
ssmMock.on(SendCommandCommand, { Parameters: myCommandParams })

// Strategy B: Regex pattern (when script has a unique comment)
const myCommandRegex = /#My Script Unique Comment/;
ssmMock.on(SendCommandCommand, params => 
    myCommandRegex.test(params.Parameters.commands?.[0])
)

// Strategy C: Comment field match (cleanest for new commands)
ssmMock.on(SendCommandCommand, params => 
    params.Comment === 'My command description'
)
```

### Step 2: Add SendCommandCommand Mock

```typescript
import { getSampleCommandResponse } from '../../../utils/ssm-utils';

// The commandName becomes part of the CommandId
ssmMock
    .on(SendCommandCommand, { Parameters: myCommandParams })
    .resolves(getSampleCommandResponse('myCommandName'));
```

### Step 3: Add GetCommandInvocationCommand Mock

```typescript
import { getSampleCommandResponseWithOutput } from '../../../utils/ssm-utils';

// CommandId MUST match: 'a11b873a-3bea-174a-a29e-15532e59a1b4-{commandName}'
ssmMock
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-myCommandName'
    })
    .resolves(getSampleCommandResponseWithOutput(
        'myCommandName', 
        JSON.stringify({ status: 'success', data: yourData })
    ));
```

### Complete SSM Mock Example

```typescript
// 1. Import the script constant (if available)
import { MY_SCRIPT } from '../../../../src/operations/workloads/mssql/my-scripts';

// 2. Define params or regex
const myScriptParams = { commands: [MY_SCRIPT] };
// OR
const myScriptRegex = /#My Script Header Comment/;

// 3. Add to ssmMock chain (in SendCommandCommand section)
ssmMock
    .on(SendCommandCommand, { Parameters: myScriptParams })
    .resolves(getSampleCommandResponse('myScriptCommand'))
    // OR with regex:
    .on(SendCommandCommand, params => myScriptRegex.test(params.Parameters.commands?.[0]))
    .resolves(getSampleCommandResponse('myScriptCommand'))
    // OR with Comment:
    .on(SendCommandCommand, params => params.Comment === 'Execute my script')
    .resolves(getSampleCommandResponse('myScriptCommand'));

// 4. Add to GetCommandInvocationCommand section
ssmMock
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-myScriptCommand'
    })
    .resolves(getSampleCommandResponseWithOutput(
        'myScriptCommand',
        '{"result":"success","data":{"key":"value"}}'
    ));
```

---

## Pattern 3: HTTP Mocking with nock

**Location**: `test/simulator/scopes/cloud-manager/[service]-scope.ts`

**When to use**: For Cloud Manager APIs, Workload Factory, or any HTTP endpoints

```typescript
import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';
import responseData from '../../responses/cloud-manager/[file].json';

// Basic pattern
nock(CLOUD_MANAGER_ENDPOINT)
    .persist(true)  // Keep mock active for multiple requests
    .get(/^\/api\/path\/(.+)$/)  // Regex for dynamic segments
    .reply(() => [200, responseData]);

// With query parameters
nock(CLOUD_MANAGER_ENDPOINT)
    .persist(true)
    .get('/tenancy/account')
    .query(true)  // Match any query string
    .reply(() => [200, accountsResponse]);

// POST with body matching
nock(CLOUD_MANAGER_ENDPOINT)
    .persist(true)
    .post('/auth/oauth/token')
    .reply(() => [200, { access_token: 'mock-token', expires_in: 86400 }]);

// Chained routes
nock(CLOUD_MANAGER_ENDPOINT)
    .persist(true)
    .get(/^\/resource\/(.+)$/)
    .reply(() => [200, getResponse])
    .post(/^\/resource$/)
    .reply(() => [201, createResponse])
    .delete(/^\/resource\/(.+)$/)
    .reply(() => [204, null]);
```

**Key points**:
- Always use `.persist(true)` for simulator mocks
- Use regex for dynamic path segments: `/^\/path\/(.+)$/`
- Use `.query(true)` to match any query parameters
- **Avoid `allowUnmocked`** - mock everything explicitly

---

## Pattern 4: Response File vs Inline Decision

| Response Size | Location | Format |
|---------------|----------|--------|
| Small (< 20 lines) | Inline in scope | `getSampleCommandResponseWithOutput()` or object literal |
| Medium (20-100 lines) | JSON file | Import from `responses/` folder |
| Large (> 100 lines) | JSON file | Import from `responses/` folder |
| Dynamic/computed | Inline | Use `callsFake()` to generate |

**Response file locations:**
```
test/simulator/responses/
├── aws/                    # AWS SDK responses
│   ├── describe-instance.json
│   ├── list-fsx-filesystems.json
│   └── ssm-*.json
├── cloud-manager/          # NetApp API responses
│   ├── tenancy-accounts.json
│   └── user-permissions.json
├── databases/              # Database query mocks
├── deployment/             # Deployment job responses
├── logs-analysis/          # Log analyzer responses
└── workload/               # Workload operation responses
```

---

## Helper Functions Reference

**Location**: `test/utils/ssm-utils.ts`

```typescript
// Generate SendCommandCommand response
// Returns: { $metadata: {...}, Command: { CommandId: 'a11b873a-...-{commandName}', ... }}
getSampleCommandResponse(commandName: string)

// Generate GetCommandInvocationCommand response with output
// Returns: { ..., StandardOutputContent: output, Status: 'Success', ... }
getSampleCommandResponseWithOutput(commandName: string, output: string)
```

**Usage pattern:**
```typescript
// SendCommand returns the command ID
.resolves(getSampleCommandResponse('myCommand'))

// GetCommandInvocation returns the actual output
.resolves(getSampleCommandResponseWithOutput('myCommand', JSON.stringify(data)))
```

---

## Quick Reference: Adding New SSM Command

```typescript
// In ssm-scope.ts

// 1. Import script constant (if available)
import { MY_SCRIPT } from '../../../../src/operations/workloads/[db]/my-scripts';

// 2. Define matching strategy
const myScriptParams = { commands: [MY_SCRIPT] };
// OR: const myScriptRegex = /#My Script Comment/;

// 3. Add SendCommandCommand (find the ssmMock.on(SendCommandCommand) chain)
    .on(SendCommandCommand, { Parameters: myScriptParams })
    .resolves(getSampleCommandResponse('myNewCommand'))

// 4. Add GetCommandInvocationCommand (find that chain section)
    .on(GetCommandInvocationCommand, {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-myNewCommand'
    })
    .resolves(getSampleCommandResponseWithOutput('myNewCommand', 
        '{"status":"success","data":{}}'
    ))
```
