# Demo Environment Constants

## Simulator Configuration

| Constant              | Value                                                    | Description                        |
| --------------------- | -------------------------------------------------------- | ---------------------------------- |
| Simulator Port        | `8085`                                                   | Local server port                  |
| Demo Account ID       | `account-3JuDht6X`                                       | Always use this for demo API calls |
| Demo AWS Account ID   | Defined in `src/utils/consts.ts` → `DEMO_AWS_ACCOUNT_ID` | AWS account for demo resources     |
| SSM Command ID Prefix | `a11b873a-3bea-174a-a29e-15532e59a1b4`                   | Base CommandId for SSM mocks       |

---

## Registered Hosts

| Host Name                                         | Deployment Type | Protocol | Database Type | File Location            |
| ------------------------------------------------- | --------------- | -------- | ------------- | ------------------------ |
| `SQL-Managed-Host-Prod`                           | Standalone      | iSCSI    | MSSQL         | `demoDefaultUtils.ts:51` |
| `SQL-Managed-Host-DEV`                            | FCI             | iSCSI    | MSSQL         | `demoDefaultUtils.ts:63` |
| `SQL-Managed-Host-UAT`                            | AOAG            | iSCSI    | MSSQL         | `demoDefaultUtils.ts:97` |
| `PGSQL-Managed-Host-STG`                          | Standalone      | NFS      | PostgreSQL    | `demoDefaultUtils.ts:73` |
| `PGSQLServer-Dev-02`                              | HA              | NFS      | PostgreSQL    | `demoDefaultUtils.ts:81` |
| `ip-171-30-40-16.ap-southeast-1.compute.internal` | Standalone      | NFS      | Oracle        | `demoDefaultUtils.ts:89` |

---

## Instance Names by Host

### SQL-Managed-Host-Prod (Standalone)

| Instance Name           | SQL Instance Name Pattern                      |
| ----------------------- | ---------------------------------------------- |
| PROD-MarketingCampaigns | `SQL-Managed-Host-ProdPROD-MarketingCampaigns` |
| PROD-SupplierManagement | `SQL-Managed-Host-ProdPROD-SupplierManagement` |
| PROD-ProductCatalog     | `SQL-Managed-Host-ProdPROD-ProductCatalog`     |

### SQL-Managed-Host-DEV (FCI)

| Instance Name         | SQL Instance Name Pattern                   |
| --------------------- | ------------------------------------------- |
| DEV-SalesAnalytics    | `SQL-Managed-Host-DEVDEV-SalesAnalytics`    |
| DEV-ProjectManagement | `SQL-Managed-Host-DEVDEV-ProjectManagement` |

### SQL-Managed-Host-UAT (AOAG)

| Instance Name | SQL Instance Name Pattern         |
| ------------- | --------------------------------- |
| MSSQLSERVER   | `SQL-Managed-Host-UATMSSQLSERVER` |

---

## SSM Response Instance Names

In `test/simulator/responses/aws/ssm-getCommand-invocation.json`:

| Instance                        | SSM Format                               |
| ------------------------------- | ---------------------------------------- |
| Default Instance                | `MSSQLSERVER`                            |
| SQL-Managed-Host-Prod instances | `MSSQL$SQL-Managed-Host-ProdPROD-{name}` |
| SQL-Managed-Host-DEV instances  | `MSSQL$SQL-Managed-Host-DEVDEV-{name}`   |
| SQL-Managed-Host-UAT instances  | `MSSQL$SQL-Managed-Host-UATMSSQLSERVER`  |

---

## Storage Protocols

| Protocol | Constant                  | Used By                |
| -------- | ------------------------- | ---------------------- |
| iSCSI    | `STORAGE_PROTOCOLS.ISCSI` | MSSQL (Prod, DEV, UAT) |
| NFS      | `STORAGE_PROTOCOLS.NFS`   | PostgreSQL, Oracle     |

---

## Database Types

| Type          | Constant                      |
| ------------- | ----------------------------- |
| MS SQL Server | `DatabaseTypes.MS_SQL_SERVER` |
| PostgreSQL    | `DatabaseTypes.PG_SQL`        |
| Oracle        | `DatabaseTypes.ORACLE`        |

---

## Deployment Types

| Type         | Description                    | Required Fields                                           |
| ------------ | ------------------------------ | --------------------------------------------------------- |
| `Standalone` | Single node                    | Basic instance fields                                     |
| `FCI`        | Failover Cluster Instance      | `sqlServerNodes`, `windowsClusterNodes`                   |
| `AOAG`       | Always On Availability Group   | `sqlServerNodes`, `aoagDetails`, `aoagClusterNodeDetails` |
| `HA`         | High Availability (PostgreSQL) | Cluster configuration                                     |

---

## MANAGE_READINESS Constant

Used in all instance definitions:

```typescript
const MANAGE_READINESS = {
    missingSqlCmd: false,
    assessment: {
        missingSqlPermissions: [],
        missingModules: []
    },
    remediation: {
        missingSqlPermissions: [],
        missingModules: []
    },
    dbcreation: {
        missingSqlPermissions: [],
        missingModules: []
    },
    sandbox: {
        missingSqlPermissions: [],
        missingModules: []
    }
};
```

---

## File Locations Quick Reference

| Data Type           | File Path                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| Host seeding        | `src/utils/demo-utils/demoDefaultUtils.ts` → `generateDemoResources()` |
| Discovery inventory | `src/utils/demo-utils/demoInventoryData.ts` → `inventoryDemoData()`    |
| Instance responses  | `src/utils/demo-utils/instancesResponse.ts` → `instanceDemoData()`     |
| Assessment data     | `src/utils/demo-utils/hostAssementsData.ts`                            |
| SSM responses       | `test/simulator/responses/aws/ssm-getCommand-invocation.json`          |
| SSM mocks           | `test/simulator/scopes/aws/ssm-scope.ts`                               |
| EC2 mocks           | `test/simulator/scopes/aws/ec2-scope.ts`                               |
| FSx mocks           | `test/simulator/scopes/aws/fsx-scope.ts`                               |

---

## API Endpoints for Testing

| Endpoint                                   | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `POST .../resources/create-demo-resources` | Seed database with demo data             |
| `GET .../discover`                         | Discovery (uses inventory data, not DB)  |
| `GET .../database-hosts`                   | List managed hosts (requires DB seeding) |
| `GET .../assessments`                      | Get assessments (requires DB seeding)    |
