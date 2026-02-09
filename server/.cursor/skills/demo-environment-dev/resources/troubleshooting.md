# Troubleshooting Guide

## Mock Not Being Triggered

1. **Check parameter matching** - Exact object match required
   ```typescript
   // Wrong: Partial match won't work
   .on(Command, { oneParam: 'value' })  // Missing other params
   
   // Right: Match all required params or use predicate
   .on(Command, params => params.oneParam === 'value')
   ```

2. **Check mock order** - Specific mocks BEFORE general fallbacks
   ```typescript
   // Wrong order:
   ssmMock.on(Command).resolves(fallback)
   ssmMock.on(Command, specific).resolves(specific)  // Never reached!
   
   // Correct order:
   ssmMock.on(Command, specific).resolves(specific)
   ssmMock.on(Command).resolves(fallback)  // Catches rest
   ```

3. **For SSM** - Verify BOTH SendCommand AND GetCommandInvocation are mocked
4. **Check CommandId** - Must be `a11b873a-3bea-174a-a29e-15532e59a1b4-{name}`

---

## Response Format Errors

1. **AWS SDK responses** - Must match expected structure exactly
2. **SSM outputs** - Data goes in `StandardOutputContent` field as string
3. **JSON parsing** - Ensure valid JSON in response files

---

## Demo Data Not Appearing

1. Check `NODE_ENV=simulator` is set
2. Verify demo seeding files are updated
3. Check if API calls correct demo data function
4. Verify count matches items array length

---

## nock Not Intercepting

1. Check endpoint URL matches exactly
2. Verify `.persist(true)` is set
3. Check regex patterns are correct
4. Ensure scope is imported in `index.ts`

---

## Token Expiration (401 Unauthorized)

If API returns 401 during verification:
1. Token has expired - request a new token from the user
2. Use this message:
   ```
   The auth token has expired (401 Unauthorized).
   
   Please provide a fresh token from:
   Workload Factory UI → Network tab → Copy Authorization header
   ```
3. Retry the API call with the new token

---

## Simulator Startup Issues

### Port 8085 Already in Use

**Unix/macOS:**
```bash
lsof -i :8085
kill -9 {PID}
```

**Windows:**
```cmd
netstat -ano | findstr :8085
taskkill /PID {PID} /F
```

### npm install Failures (OneDrive)

If on OneDrive-synced directory:
```bash
# Pause OneDrive sync, then:
xattr -cr node_modules
rm -rf node_modules
npm install
```

### Missing Module Errors

```bash
cd wlm-db/server
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## File Organization Rules

**CRITICAL: Do NOT reorganize existing files without explicit approval.**

| New Mock Type | Location | Action |
|---------------|----------|--------|
| AWS service (existing) | `test/simulator/scopes/aws/[service]-scope.ts` | Add to existing file |
| AWS service (new) | `test/simulator/scopes/aws/[service]-scope.ts` | Create new file, import in index.ts |
| SSM commands | `test/simulator/scopes/aws/ssm-scope.ts` | **Always add to existing file** |
| Cloud Manager API | `test/simulator/scopes/cloud-manager/[service]-scope.ts` | Add to existing or create new |
| Response data | `test/simulator/responses/[category]/[file].json` | Create in appropriate folder |
| Demo inventory | `src/utils/demo-utils/demoInventoryData.ts` | Modify existing function |

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `ENOTEMPTY: directory not empty` | OneDrive sync conflict | Pause OneDrive, `rm -rf node_modules`, reinstall |
| `Cannot find module 'xyz'` | Missing dependency | `npm install` |
| `Nock: No match for request` | Missing mock | Add mock to appropriate scope file |
| `Command not found` | SSM mock missing | Add both SendCommand and GetCommandInvocation mocks |
| `401 Unauthorized` | Token expired | Get fresh token from UI |
| `EADDRINUSE: port 8085` | Simulator already running | Kill existing process |
