# Phase 5: Automated Verification

**After implementing mocks, ALWAYS verify by calling the actual API.**

This phase is MANDATORY. Do not skip it or leave it as a manual step.

---

## Context from Previous Phases

During verification, use the information gathered in earlier phases:
- **API Route**: From Phase 1 route analysis (e.g., `GET /accounts/:accountId/wlmdb/v1/mssql/.../discover`)
- **HTTP Method**: From the route handler (GET, POST, PUT, DELETE, PATCH)
- **Path Parameters**: From route definition (accountId, credentialsId, region, jobId, etc.)
- **Request Body**: For POST/PUT/PATCH, the expected payload structure
- **Expected Changes**: The specific data you added or modified in Phases 3-4

---

## Step 1: Check if Port 8085 is in Use

Before starting the simulator, check if port 8085 is already in use:

**Unix/macOS:**
```bash
lsof -i :8085
```

**Windows:**
```cmd
netstat -ano | findstr :8085
```

**If port is in use:**
- Ask the user to close the existing process
- Provide the command to kill it: `kill -9 {PID}` (where PID is from lsof output)
- Wait for user confirmation before proceeding

**Example message to user:**
```
Port 8085 is already in use by process {PID}.

Please close this process before I can start the simulator:
  kill -9 {PID}

Let me know when it's done, and I'll start the simulator.
```

---

## Step 2: Check if Simulator is Already Running

If port 8085 is free OR if the process on 8085 is the simulator we need, check the terminals folder:

```
Look for:
- "npm run simulator" in last commands
- "Server listening at http://[::1]:8085" in terminal output
- Active process without exit code
```

If simulator is already running and healthy, skip to Step 4.

---

## Step 3: Start Simulator

```bash
cd wlm-db/server && npm run simulator
```

**Use `block_until_ms: 0`** - The simulator is a long-running process. Background it immediately.

**Wait for startup confirmation:**
- Look for: `"Server listening at http://[::1]:8085"` or `"Simulator started"`
- Poll terminal file with exponential backoff (2s, 4s, 8s) until ready

---

## Step 4: Request Auth Token from User

**Ask the user for the auth token:**

```
## Verification: API Test Required

The simulator should now be running. To verify the changes, I need to call the API.

**API to test:** {METHOD} {route path from Phase 1}

**Please provide:**

1. **Auth Token** - A valid JWT token for API authentication
   - Get from: Workload Factory UI → Network tab → Copy Authorization header

2. **Path Parameters:**
   - Account ID: `account-3JuDht6X` (always use this value)
   - Credentials ID: {user must provide}
   - Region: {any valid AWS region, e.g., us-east-1, us-west-2}
   {List any other parameters extracted from route}

{If POST/PUT/PATCH:}
3. **Request Body** - Confirm payload or provide sample

Once you provide the token and credentials ID, I'll call the API and verify the changes.
```

---

## Step 5: Seed Database with Demo Data (If Required)

**IMPORTANT:** Before testing APIs that read from the database (e.g., managed hosts, assessments, jobs), you MUST first call the create-demo-resources endpoint to seed the database.

**When to call this:**
- Testing any API that queries database records (not just discover)
- After fresh simulator start
- When testing with a new credentials ID or region

**Call the seed endpoint:**
```bash
curl -s -X POST "http://localhost:8085/accounts/account-3JuDht6X/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/resources/create-demo-resources" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

**Expected response:** HTTP 201 with confirmation of seeded resources.

**Note:** The discover API does NOT require this step as it returns data directly from demo inventory (not database). But most other APIs (managed hosts, assessments, remediation status, etc.) DO require database seeding first.

---

## Step 6: Call the API

Build the curl command based on HTTP method and route from Phase 1:

**GET Request:**
```bash
curl -s -X GET "http://localhost:8085{route_path}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

**POST Request:**
```bash
curl -s -X POST "http://localhost:8085{route_path}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{request_body_json}'
```

**PUT/PATCH Request:**
```bash
curl -s -X PUT "http://localhost:8085{route_path}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{request_body_json}'
```

**DELETE Request:**
```bash
curl -s -X DELETE "http://localhost:8085{route_path}" \
  -H "Authorization: Bearer {token}"
```

---

## Step 7: Validate Response

**Validation approach depends on what was changed:**

| Change Type | Validation Method |
|-------------|-------------------|
| New seed data added | Search response for the specific new item by unique identifier |
| Mock response updated | Verify response structure matches expected format |
| New SSM command mock | Check that command output appears in response |
| Count increased | Verify count field (if applicable) matches items array |
| Field modified | Extract and compare specific field values |

**Use jq for targeted validation:**
```bash
# Extract specific item by unique field
| jq '.items[] | select(.fieldName == "expectedValue")'

# Check response structure has required fields
| jq 'has("field1") and has("field2")'

# Count items (if applicable)
| jq '.items | length'

# Extract nested data
| jq '.data.nestedField.value'
```

---

## Step 8: Handle API Dependencies (Chained Calls)

**When the target API depends on output from other APIs:**

Some APIs require IDs or data from prerequisite API calls. Handle this by:

1. **Identify the dependency chain** from Phase 1 analysis
2. **Call prerequisite APIs first** to get required IDs
3. **Extract IDs from responses** using jq
4. **Use extracted IDs** in the target API call

**Example: API that requires a Job ID from a previous POST:**

```bash
# Step 1: Call the initiating API (e.g., start remediation)
RESPONSE=$(curl -s -X POST "http://localhost:8085/accounts/{accountId}/wlmdb/v1/mssql/remediation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instanceId": "i-xxx", "action": "install"}')

# Step 2: Extract the job ID from response
JOB_ID=$(echo $RESPONSE | jq -r '.jobId')

# Step 3: Call the dependent API (e.g., check job status)
curl -s "http://localhost:8085/accounts/{accountId}/wlmdb/v1/mssql/jobs/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Common dependency patterns:**

| Target API | Depends On | How to Get ID |
|------------|------------|---------------|
| GET job status | POST create job | Extract `jobId` from POST response |
| GET assessment details | POST run assessment | Extract `assessmentId` from POST response |
| DELETE resource | GET list resources | Extract resource ID from list |
| PUT update | GET current state | Use ID from list or path param |

**For demo environment:** If prerequisite APIs are also mocked, ensure their mock responses include the IDs needed for dependent API calls. Chain the calls in sequence.

---

## Step 9: Report Results

**If successful:**
```
## Verification: SUCCESS

API: {METHOD} {route_path}
Status: {HTTP status code}

Validated:
- {What was checked and confirmed}
- {Specific data found/verified}

The demo environment changes are working correctly.
```

**If failed:**
```
## Verification: FAILED

API: {METHOD} {route_path}
Status: {HTTP status code}

Issue:
- Expected: {what should have happened}
- Actual: {what actually happened}

Debugging:
1. {specific fix needed}
2. {files to check}
```

---

## Verification Checklist

Before marking verification complete:

- [ ] Simulator is running on port 8085
- [ ] API returns expected HTTP status (200, 201, 204 as appropriate)
- [ ] Response format matches expected structure
- [ ] New/modified data appears correctly in response
- [ ] If chained APIs: all dependencies resolved successfully
- [ ] No unexpected errors in simulator terminal output
