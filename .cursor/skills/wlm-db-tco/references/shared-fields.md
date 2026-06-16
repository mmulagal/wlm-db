# Shared fields and response mapping

## Snapshot fields (cloud automatic/manual bodies and on-prem `snapshotInfo`)

| Field | Type | Notes |
|-------|------|-------|
| `snapshotFrequency` | string | `NoSnapShotStorage`, `Hourly`, `Daily`, `Weekly`, `Monthly`, `2xDaily`, `3xDaily`, `4xDaily`, `6xDaily` |
| `clonedCopiesCount` | number | ≥ 0 |
| `monthlyChangeRatePercentage` | number | 0–100 |
| `monthlySqlByolCost` | number (optional) | MSSQL automatic EBS bulk `hosts[]` only (`null` when unset); not on Oracle `hosts[]` |
| `cloneRefreshFrequency` | string (optional) | **Automatic EBS only:** `Daily`, `Weekly`, `Monthly` — FSx clone refresh cadence; UI defaults to `Daily`. Omit for FSxW and manual modes. |

## Required inputs by mode

| Mode | Path params | Body / query | Discovery |
|------|-------------|--------------|-----------|
| **Automatic EBS** | `CREDENTIALS_ID`, `region` | Snapshot fields + `cloneRefreshFrequency` + `hosts[]` (1–5 `ec2InstanceId`) | `GET .../discover` if ids unknown |
| **Automatic FSxW** | `CREDENTIALS_ID`, `region`, `instanceId` | Shared snapshot fields (no `hosts[]`) | `GET .../discover` if id unknown — path `{instanceId}` = discovered `ec2InstanceId` |
| **Manual EBS / FSxW (MSSQL)** | `region` only | `sqlServerDeploymentType`, `sqlServerEdition`, `ec2Instances[]`, snapshot fields | None |
| **Manual EBS (Oracle)** | `region` only | `oracleDeploymentType`, optional `oracleEdition`, `ec2Instances[]`, snapshot fields | None |
| **On-prem MSSQL** | — | `regionCode`, `resources[]` (1–5), `snapshotInfo` | `GET .../onprem-tco/resources` after upload |
| **On-prem Oracle** | — | `regionCode`, `resources[]` (1–5, optional `monthlyByolCost`), `snapshotInfo` | List resources after upload |
| **On-prem upload** | — | `fileName`, `fileContent` (base64 compressed JSON) | Customer runs collector from `GET .../collector` |

**Universal:** `ENVIRONMENT`, `ACCOUNT_ID`, bearer `$TOKEN`. Automatic cloud also needs `CREDENTIALS_ID`. Easiest smoke test: **manual EBS** — only `$REGION` plus a hypothetical body.

**Terminology:** Cloud paths use `{region}`; on-prem bodies use `regionCode`. Cloud automatic EBS uses `hosts[]` with `ec2InstanceId`; on-prem uses `resources[]` with `resourceId`. Oracle on-prem BYOL is `monthlyByolCost` per resource; MSSQL cloud BYOL is `monthlySqlByolCost` in `hosts[]`.

## API response fields

Summary responses (`storage-savings` and manual equivalents):

| Section | Key fields |
|---------|------------|
| `totalSummary` | `existing`, `recommended`, optional `optimized` (monthly USD) |
| `compute.existing` / `compute.recommended` | `instanceType`, `computeMonthlyPrice`, `finding` (`OPTIMIZED`, `NOT_OPTIMIZED`, `INSUFFICIENT_DATA`) |
| `license.existing` / `license.recommended` | `sqlServerEdition`, `licenseMonthlyPrice`, `finding` |
| `ebs` / `fsxw` / `fsx` | `capacity`, `iops`, `throughput`, `snapshots`, `total` (monthly storage cost) |

Calculations responses (`.../calculations`) use different keys than summary: `ebsCalculation`, `ebsCloneCalculation`, `ebsSnapshotCalculation`, `fsxwCalculation` (+ snapshot/clone variants), and `single` / `multi` / `fsxOptimizedSingle` (each with `fsxOntapCalculation`, etc.). Line items cover EBS volume types, FSxW SAZ/MAZ, FSx ONTAP SSD/capacity/throughput, snapshot and clone costs.

On-prem explore-savings wraps both in one payload:

```json
{ "storageSavings": { ... }, "calculations": { ... } }
```

Bulk on-prem/oracle:

```json
{ "regionCode": "...", "storageSavings": { ... }, "calculations": { ... } }
```
