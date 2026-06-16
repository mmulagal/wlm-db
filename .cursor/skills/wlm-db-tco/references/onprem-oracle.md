# On-prem Oracle

Same bulk explore-savings pattern as MSSQL. Oracle has **no** single-resource explore-savings endpoint. Single POST returns `storageSavings` + `calculations`.

## Endpoints

| Method | Path | Mutating | Returns |
|--------|------|----------|---------|
| GET | `/oracle/onprem-tco/collector` | No | `{ url }` |
| POST | `/oracle/onprem-tco/upload` | **Yes** | `{ jobId }` |
| GET | `/oracle/onprem-tco/resources` | No | `{ count, items[], nextToken? }` |
| GET | `/oracle/onprem-tco/resources/{resourceId}` | No | Resource + `oracleDatabases[]` |
| POST | `/oracle/onprem-tco/explore-savings` | No | Bulk only (1–5 resources) |
| DELETE | `/oracle/onprem-tco/resources/{resourceId}` | **Yes** | `{ count }` |

## Explore-savings body

`resources[]` entries may include optional `monthlyByolCost` per resource (Oracle BYOL monthly cost).

Optional `databaseData[]` overrides per resource:

```json
{ "databaseId": "...", "noOfVcpusInUse": 16, "memory": 68719476736, "networkPerformance": "Above 10 Gigabit" }
```

## Workflow (already uploaded)

1. `GET .../oracle/onprem-tco/resources` → pick `resourceId` values.
2. `POST .../oracle/onprem-tco/explore-savings` with `regionCode`, `resources[]`, and `snapshotInfo`.

See [examples.md](examples.md) example 7.

## Upload (destructive — see SKILL.md confirmation gate)

`POST .../oracle/onprem-tco/upload` requires **explicit user confirmation** after you describe the mutating step — *"please upload"* alone is not enough. Poll `GET .../jobs/{jobId}`, then list resources and run explore-savings.
