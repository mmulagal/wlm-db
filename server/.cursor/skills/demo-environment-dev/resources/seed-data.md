# Demo Data Seeding

**Location**: `src/utils/demo-utils/`

**When to update**: When API depends on pre-existing inventory/discovery data

## Files & Purposes

| File | Purpose | When to Modify |
|------|---------|----------------|
| `demoInventoryData.ts` | MSSQL, Oracle instance inventory | Adding new DB instances to discovery |
| `demoMockdata.ts` | General mock data utilities | Adding new mock data generators |
| `demoDefaultUtils.ts` | Default values and constants | Changing default demo values |
| `hostAssementsData.ts` | Host assessment results | Adding assessment mock data |
| `instancesResponse.ts` | Instance response templates | Modifying instance structures |
| `onPremRecords/*.json` | On-prem SQL Server data | Adding on-prem demo scenarios |

---

## Invented labels (production-like naming)

Simulator inventory is fake but **should read like production** in the UI:

- Do **not** use the word `demo` in surfaced strings (`ec2InstanceName`, `ec2HostName`, VPC **name**, etc.).
- Copy patterns from existing rows in `demoInventoryData.ts` (e.g. `oracle-node-*`, `DATAGUARD-PRIMARY-*`, shared VPC ids/names). Prefer neutral DNS-style hostnames (`ip-10-0-*…compute.internal`).
- Internal code names (`const`, helpers) may stay technical; prefer `seed` / `fixture` over `demo` when naming new symbols.

See also `.github/instructions/server-patterns.instructions.md` → **Demo inventory fixtures**.

---

## Adding New Inventory Item

```typescript
// In demoInventoryData.ts
function inventoryDemoData(fsxId: string, ebsVolId: string): DiscoverMsSqlResponseBodyType {
    return {
        count: N,  // Update count!
        items: [
            // Existing items...
            
            // Add your new instance
            {
                ec2InstanceId: 'i-newinstance123',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'new-sql-server',
                ssmState: 'connected',
                vpc: {
                    id: 'vpc-xxx',
                    name: 'wlmdb-vpc',
                    cidrBlock: '10.0.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerInstance: 'MSSQLSERVER',
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        // ... full instance details
                        manageReadiness: MANAGE_READINESS,  // Use constant
                    }
                ]
            }
        ]
    };
}
```

---

## Adding New Registered Host (Complete Workflow)

When adding a new managed/registered host for demo mode, **ALL** the following files must be updated:

| File | Purpose | Required Changes |
|------|---------|------------------|
| `src/utils/demo-utils/demoDefaultUtils.ts` | Host seeding in `generateDemoResources()` | Add new host entry with resourceId, hostName, protocol, sqlInstances, databaseType, deploymentType |
| `test/simulator/responses/aws/ssm-getCommand-invocation.json` | SSM command responses | Add instance to `StandardOutputContent` (line ~875) AND `getInstanceResponse` array (line ~3403) |
| `src/utils/demo-utils/instancesResponse.ts` | Instance response templates | Add full instance definition with storage, deploymentTypes, manageReadiness, and AOAG details if applicable |
| `src/utils/demo-utils/hostAssementsData.ts` | Host assessment data | Add to `sqlServerInstances` array in both `mockResourceAssessmentData` and `mockResourceAssessmentDataAllOptimized` |

### Example: Adding AOAG Host

**Step 1: demoDefaultUtils.ts - `generateDemoResources()`**

```typescript
{
    resourceId: randomUUID(),
    hostName: 'SQL-Managed-Host-UAT',
    protocol: STORAGE_PROTOCOLS.ISCSI,
    sqlInstances: [{ sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-UATMSSQLSERVER' }],
    databaseType: DatabaseTypes.MS_SQL_SERVER,
    deploymentType: 'AOAG'
}
```

**Step 2: ssm-getCommand-invocation.json - `StandardOutputContent` (escaped JSON string)**

```json
{"instanceName":"MSSQL$SQL-Managed-Host-UATMSSQLSERVER","instanceState":"Running"}
```

**Step 3: ssm-getCommand-invocation.json - `getInstanceResponse` array**

```json
{
    "instanceName": "MSSQL$SQL-Managed-Host-UATMSSQLSERVER",
    "instanceState": "Running"
}
```

**Step 4: instancesResponse.ts - Full instance with AOAG details**

```typescript
{
    sqlServerEdition: 'Enterprise Edition (64-bit)',
    sqlServerEngineEdition: 3,
    sqlServerInstance: 'MSSQLSERVER',
    sqlServerDeploymentType: 'AOAG',
    sqlServerNodes: ['SQL-Managed-Host-UAT-AG1', 'SQL-Managed-Host-UAT-AG2'],
    nodeIps: ['10.0.6.210', '10.0.28.210'],
    aoagDetails: {
        serverInfo: { serverName: 'SQL-Managed-Host-UAT', isHadrEnabled: 1 },
        baseDeploymentType: 'Standalone',
        availabilityGroups: [
            {
                agName: 'UAT-AOAG',
                primaryReplica: 'SQL-Managed-Host-UAT-AG1',
                replicas: [
                    { replica: 'SQL-Managed-Host-UAT-AG1', role: 'PRIMARY', ... },
                    { replica: 'SQL-Managed-Host-UAT-AG2', role: 'SECONDARY', ... }
                ]
            }
        ]
    },
    aoagClusterNodeDetails: [
        { node: 'SQL-Managed-Host-UAT-AG1', ip: '10.0.6.210', ec2InstanceId: 'i-0uat1...', ec2InstanceName: 'SQL-Managed-Host-UAT-AG1' },
        { node: 'SQL-Managed-Host-UAT-AG2', ip: '10.0.28.210', ec2InstanceId: 'i-0uat2...', ec2InstanceName: 'SQL-Managed-Host-UAT-AG2' }
    ]
}
```

**Step 5: hostAssementsData.ts - Both assessment objects**

```typescript
{
    sqlServerInstance: 'MSSQLSERVER',
    sqlServerState: 'Running',
    sqlServerVersion: '16.0.4095.4',
    sqlServerProductYear: 2022,
    sqlServerEdition: 'Enterprise Edition (64-bit)',
    sqlServerEngineEdition: 3,
    sqlServerName: 'SQL-Managed-Host-UAT'
}
```

---

## Deployment Type Patterns

| Deployment Type | Key Differences |
|-----------------|-----------------|
| `Standalone` | Single node, no cluster details |
| `FCI` | Multiple nodes in `sqlServerNodes`, `windowsClusterNodes` array |
| `AOAG` | Multiple nodes, requires `aoagDetails` and `aoagClusterNodeDetails` objects |

---

## Naming Convention Patterns

### Instance Name Format

The instance name in `generateDemoResources()` follows pattern: `{hostName}{instanceName}`

| Host Name | Instance Name | Combined (sqlInstanceName) |
|-----------|---------------|---------------------------|
| SQL-Managed-Host-Prod | PROD-MarketingCampaigns | SQL-Managed-Host-ProdPROD-MarketingCampaigns |
| SQL-Managed-Host-DEV | DEV-SalesAnalytics | SQL-Managed-Host-DEVDEV-SalesAnalytics |
| SQL-Managed-Host-UAT | MSSQLSERVER | SQL-Managed-Host-UATMSSQLSERVER |

### SSM Response Instance Name Format

In `ssm-getCommand-invocation.json`, named instances use `MSSQL$` prefix:

| Type | Format | Example |
|------|--------|---------|
| Default Instance | `MSSQLSERVER` | `MSSQLSERVER` |
| Named Instance | `MSSQL${hostName}{instanceName}` | `MSSQL$SQL-Managed-Host-ProdPROD-MarketingCampaigns` |

---

## Seed Data Analysis Before Adding

Before adding new data, analyze existing patterns:

1. **Read the existing demo data file** to understand naming patterns
2. **Look for similar instance types** (e.g., other AOAG, FCI, Standalone instances)
3. **Note conventions for**: `ec2InstanceName`, `sqlServerName`, `serverGuid`, IPs, etc.
4. **Identify any prefix/suffix patterns** (e.g., `PRD-SQL-*`, `app-server-*`)

**If no similar pattern exists:**
```
I don't see existing examples of {type} in the demo data.

Should I:
1. Use your example data exactly as provided?
2. Create new naming conventions for this type?

Please confirm which approach you prefer.
```
