# Manual cloud (what-if — no credentialsId)

Hypothetical TCO with user-supplied instance types, EBS volumes, or FSxW config. Two POSTs: summary then `/calculations`. Oracle manual TCO is **EBS only** — substitute `/oracle/regions/{region}/manual-storage-savings/ebs` (no FSxW paths).

## Endpoints

| Engine | Method | Path | Returns |
|--------|--------|------|---------|
| MSSQL | POST | `/mssql/regions/{region}/manual-storage-savings/ebs` | Manual EBS summary |
| MSSQL | POST | `/mssql/regions/{region}/manual-storage-savings/fsxw` | Manual FSxW summary |
| MSSQL | POST | `.../manual-storage-savings/ebs/calculations` | Manual EBS breakdown |
| MSSQL | POST | `.../manual-storage-savings/fsxw/calculations` | Manual FSxW breakdown |
| Oracle | POST | `/oracle/regions/{region}/manual-storage-savings/ebs` | Manual EBS summary (no FSxW) |
| Oracle | POST | `.../manual-storage-savings/ebs/calculations` | Manual EBS breakdown |

## Manual body (in addition to shared snapshot fields)

### MSSQL

| Field | Notes |
|-------|-------|
| `sqlServerDeploymentType` | e.g. `Standalone`, `AOAG` (EBS manual), `FCI` (FSxW manual non-standalone) |
| `sqlServerEdition` | `Standard Edition`, `Enterprise Edition`, `Web Edition`, `Express Edition`, `Developer Edition` |
| `ec2Instances[]` | Each: `ec2InstanceDescription`, `ec2InstanceType`, `isPrimary`, plus either `volumes[]` or `fsxw` |

### Oracle (EBS manual only)

Do **not** reuse MSSQL field names — the API rejects `sqlServerDeploymentType`.

| Field | Notes |
|-------|-------|
| `oracleDeploymentType` | **Required.** `Standalone` (exactly 1 `ec2Instances[]` entry) or `Data Guard` (exactly 2) |
| `oracleEdition` | Optional: `Enterprise Edition`, `Standard Edition 2` |
| `ec2Instances[]` | Each: `ec2InstanceType`, `isPrimary`, `volumes[]` — no `ec2InstanceDescription` |

### EBS `volumes[]` per instance

| Field | Notes |
|-------|-------|
| `volumeType` | `gp2`, `gp3`, `io1`, `io2`, `st1` |
| `volumeNumber` | ≥ 1 |
| `storageAmount` | bytes (1 GB – 16 TB per volume) |
| `volumeIops` | io1/io2/gp3 only — see per-type table below |
| `throughput` | gp3 only (MB/s) |

**Per `volumeType` — omit fields the API rejects:**

| `volumeType` | Include | Do **not** send |
|--------------|---------|-----------------|
| `gp2` | `volumeType`, `volumeNumber`, `storageAmount` | `volumeIops`, `throughput` — gp2 is throughput/IOPS-fixed; sending them returns *"Throughput Optimized SSD (gp2) - Throughput/IOPs can't be provided"* |
| `gp3` | above + `volumeIops`, `throughput` | — |
| `io1`, `io2` | above + `volumeIops` | `throughput` |
| `st1` | `volumeType`, `volumeNumber`, `storageAmount` | `volumeIops`, `throughput` |

When the user supplies gp2 IOPS or throughput, drop those fields from the POST body (IOPS scale with size on gp2).

### FSxW `fsxw` per instance

| Field | Notes |
|-------|-------|
| `deploymentType` | `Single` or `Multi` |
| `storageVolumeType` | `SSD` or `HDD` |
| `storageAmount` | bytes (1 GB – 64 TB) |
| `volumeIops` | 96 – 400000 |
| `throughput` | 8 – 12288 MB/s |

## Workflow

1. Build `ec2Instances[]` with instance type and `volumes[]` (EBS) or `fsxw` (FSxW).
2. `POST .../manual-storage-savings/{ebs|fsxw}` then `.../calculations`.

See [examples.md](examples.md) examples 3–4.
