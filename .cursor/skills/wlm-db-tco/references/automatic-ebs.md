# Automatic EBS (discovered EC2 + EBS volumes)

Paths omit `{base}/accounts/{accountId}/wlmdb/v1`. **MSSQL and Oracle** share bulk paths and snapshot fields; substitute `/oracle/` for `/mssql/` on discover and storage-savings paths (Oracle has no FSxW). Oracle `hosts[]` entries are `{ "ec2InstanceId": "..." }` only — no `monthlySqlByolCost`. Prefer **bulk** `hosts[]` even for one host (matches Workload Factory UI). Two POSTs per refresh: summary then `/calculations` with the **same body**.

## Discovery

| Engine | Method | Path | Returns |
|--------|--------|------|---------|
| MSSQL | GET | `/mssql/credentials/{credId}/regions/{region}/discover?pageSize=50` | Paginated EC2 + SQL Server instances |
| Oracle | GET | `/oracle/credentials/{credId}/regions/{region}/discover?pageSize=50` | Paginated EC2 + Oracle databases |
| MSSQL | GET | `/mssql/credentials/{credId}/regions/{region}/instances?instances={ec2Id}` | Instance detail (optional `fields`) |
| Oracle | GET | `/oracle/credentials/{credId}/regions/{region}/instances?instances={ec2Id}` | Instance detail (optional `fields`) |

Use `$CREDENTIALS_ID` in `{credId}`. Put `ec2InstanceId` from discover into bulk `hosts[]`. EC2 ids must match `^i-[0-9a-f]{8,17}$` (prefer full 17-hex AWS ids; short simulator ids like `i-12456768` may fail API validation). When discover returns mixed FSXN and EBS hosts, pick an **EBS-backed** instance for the EBS storage-savings path.

## Endpoints

| Engine | Method | Path | Returns |
|--------|--------|------|---------|
| MSSQL | POST | `/mssql/credentials/{credId}/regions/{region}/storage-savings/ebs` | Bulk summary |
| MSSQL | POST | `.../storage-savings/ebs/calculations` | Bulk line items |
| Oracle | POST | `/oracle/credentials/{credId}/regions/{region}/storage-savings/ebs` | Bulk summary (no FSxW) |
| Oracle | POST | `.../storage-savings/ebs/calculations` | Bulk line items |

**Prefer bulk** paths above. An **instance-scoped** alternative also exists for MSSQL (`POST .../instances/{instanceId}/storage-savings/ebs` + `/calculations`); the skill defaults to bulk `hosts[]` unless the user explicitly needs per-instance URLs.

## Body

Shared snapshot fields + `cloneRefreshFrequency` + `hosts[]` (1–5 items):

```json
{
  "snapshotFrequency": "Daily",
  "clonedCopiesCount": 3,
  "monthlyChangeRatePercentage": 10,
  "cloneRefreshFrequency": "Daily",
  "hosts": [{ "ec2InstanceId": "i-0123456789abcdef0", "monthlySqlByolCost": null }]
}
```

`monthlySqlByolCost` may be `null` when not set (UI sends `null`). **Oracle** bulk body — same snapshot fields, simpler `hosts[]`:

```json
{
  "snapshotFrequency": "Daily",
  "clonedCopiesCount": 3,
  "monthlyChangeRatePercentage": 10,
  "cloneRefreshFrequency": "Daily",
  "hosts": [{ "ec2InstanceId": "i-0123456789abcdef0" }]
}
```

## Workflow

1. If instance id unknown: `GET .../discover` → pick `ec2InstanceId` from `items[]`.
2. Optional: `GET .../instances?instances={ec2Id}` to confirm EBS backend.
3. Build `hosts[]` with 1–5 ids.
4. `POST .../storage-savings/ebs` → summary.
5. `POST .../storage-savings/ebs/calculations` → line items.

If `fsxOptimized` / `fsxOptimizedSingle` appear in the response, present optimized vs standard totals.

See [examples.md](examples.md) for curl commands.
