# Automatic FSxW (discovered FSx for Windows)

No bulk endpoint exists for FSxW. Single-instance path only. Two POSTs: summary then `/calculations` with the **same body** (shared snapshot fields only — no `hosts[]`, no `cloneRefreshFrequency`).

## Discovery

Same discover/detail paths as automatic EBS — see [automatic-ebs.md](automatic-ebs.md#discovery). Path param `{instanceId}` is the discovered `ec2InstanceId`. Use instance detail to confirm FSxW backend before calling FSxW endpoints.

## Endpoints

| Method | Path | Returns |
|--------|------|---------|
| POST | `/mssql/credentials/{credId}/regions/{region}/instances/{instanceId}/storage-savings/fsxw` | Summary |
| POST | `.../storage-savings/fsxw/calculations` | Line items |

## Constraint

Automatic **FSxW rejects AOAG** deployments (API error).

## Workflow

1. Discover or confirm `instanceId` and FSxW backend.
2. `POST .../instances/{instanceId}/storage-savings/fsxw` with snapshot fields.
3. `POST .../instances/{instanceId}/storage-savings/fsxw/calculations` with the same body.

See [examples.md](examples.md) for curl commands. FSxW uses the same auth setup as automatic EBS.