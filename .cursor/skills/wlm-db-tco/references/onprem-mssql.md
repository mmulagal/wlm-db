# On-prem MSSQL

Single POST explore-savings returns both `storageSavings` and `calculations` — no separate `/calculations` call. Default to bulk `POST .../onprem-tco/explore-savings` with `resources[]` (1–5 items). When the user names one resource or asks for a single host, use `POST .../resources/{resourceId}/explore-savings` (match `resourceName` from `GET .../resources` if needed).

## Endpoints

| Method | Path | Mutating | Returns |
|--------|------|----------|---------|
| GET | `/mssql/onprem-tco/collector` | No | `{ url }` — pre-signed download for collector script |
| POST | `/mssql/onprem-tco/upload` | **Yes** | `{ jobId }` — poll job, then list resources |
| GET | `/mssql/onprem-tco/resources` | No | `{ count, items[], nextToken? }` |
| GET | `/mssql/onprem-tco/resources/{resourceId}` | No | Resource detail + `sqlServerInstances[]` |
| POST | `/mssql/onprem-tco/resources/{resourceId}/explore-savings` | No | TCO for one resource |
| POST | `/mssql/onprem-tco/explore-savings` | No | TCO (1–5 resources) |
| DELETE | `/mssql/onprem-tco/resources/{resourceId}` | **Yes** | `{ count }` |

## Explore-savings body

### Bulk (`POST .../explore-savings`)

```json
{
  "regionCode": "us-east-1",
  "resources": [{ "resourceId": "...", "sqlInstanceData": [{ "sqlInstanceId": "...", "noOfVcpusInUse": 8, "memory": 34359738368, "networkPerformance": "Up to 10 Gigabit" }] }],
  "snapshotInfo": { "snapshotFrequency": "Daily", "clonedCopiesCount": 1, "monthlyChangeRatePercentage": 20 }
}
```

### Single resource (`POST .../resources/{resourceId}/explore-savings`)

`resourceId` is in the URL — body has `regionCode` and `snapshotInfo` only (optional `sqlInstanceData` overrides):

```json
{
  "regionCode": "us-east-1",
  "snapshotInfo": { "snapshotFrequency": "Daily", "clonedCopiesCount": 1, "monthlyChangeRatePercentage": 20 }
}
```

`sqlInstanceData` is optional on both paths — omit to use collector defaults. `networkPerformance`: `Up to 10 Gigabit` or `Above 10 Gigabit`.

## Upload body

```json
{ "fileName": "collector-output.json", "fileContent": "<base64-encoded compressed collector output>" }
```

Poll: `GET {base}/accounts/{accountId}/wlmdb/v1/jobs/{jobId}` until `COMPLETED` or `FAILED`.

## Workflow (already uploaded)

1. `GET .../onprem-tco/resources` → pick `resourceId` values.
2. Optional: `GET .../resources/{resourceId}` for instance overrides.
3. `POST .../mssql/onprem-tco/explore-savings` with `resources: [{ resourceId }]` (1–5 items), or `POST .../resources/{resourceId}/explore-savings` for a single resource.

See [examples.md](examples.md) examples 5–6b.

## Upload (destructive — see SKILL.md confirmation gate)

`POST .../mssql/onprem-tco/upload` requires **explicit user confirmation** after you describe the mutating step — *"please upload"* alone is not enough. Poll `GET .../jobs/{jobId}`, then list resources and run explore-savings. Example 8 in [examples.md](examples.md).
