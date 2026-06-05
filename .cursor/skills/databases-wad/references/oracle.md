# Oracle Registered Drift Assessment — Reference

## Endpoints

Base prefix for all paths: `{base}/accounts/{accountId}/wlmdb/v1`

### Read

| Method | Path | Returns |
|--------|------|---------|
| GET | `/oracle/credentials/{credId}/regions/{region}/assessment` | Account / region-scoped paginated drift across all managed Oracle hosts. Query: `nextToken`, `pageSize`. |
| GET | `/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/assessment` | Host-level drift for every Oracle instance on the host. |
| GET | `/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment` | Instance-level drift (full per-dimension result). Query: `fields`. |

### Patch scan (read, on-demand)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment/patch-scan?field=` | Required `field`; allowed values: `host-os-patch`, `oracle-security-patch`. |

### Trigger (mutating)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment` | none; optional `?fields=` query restricts dimensions | `202 { "jobId": "..." }` |

A successful trigger runs SSM on the active-node EC2 host, regenerates findings for every requested dimension, and overwrites the stored instance assessment. Always confirm with the user before issuing this POST.

### Dismiss (mutating, account-scope)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/oracle/assessment/dismiss` | `{ "configurationsToDismiss": [{ "databaseHostId": "...", "databaseInstanceId": "...", "configurationName": "<dimension>", "dismissed": true }] }` | Updated dismissal state. |

Set `dismissed: false` to un-dismiss.

---

## Assessment dimensions (`fields` query values)

Comma-separate multiple values, or omit `fields` to get all sections.

| Value | What it covers |
|-------|----------------|
| `storage` | FSx for ONTAP volume / LUN configuration, layout (datafiles, controlfiles, redo logs, archive logs, temp, FRA, oracle binary, ASM disk-group/LUN layout) and sizing (headroom, swap-space) |
| `compute` | EC2 host-OS knobs: `transparentHugepages`, `tcpAdvancedOptions`, `filesystemsIoOptions`, `multiblockReadcount` — iSCSI deployments only; silently skipped for NFS |
| `host-os-patch` | Linux / Windows OS patch level for the active node |
| `oracle-security-patch` | Oracle CPU / Release Update (RU) patch level on the database |
| `aws-backup` | AWS Backup / FSx backup configuration |
| `crr` | Cross-region replication state for data / control / archive-log volumes |
| `snapcenter-snapshot` | SnapCenter snapshot policy across data / control / archive-log volumes |
| `clone` | Stale / orphaned FSx clone inventory for the database |
| `mapped-ontap-volumes` | (read-only) Mapping between Oracle file types and ONTAP volumes |

Notes:
- `compute` is silently dropped when the storage protocol is not iSCSI.
- Dismissed configurations are removed from the effective `fields` set before each run / fetch.

---

## Response shapes

### Per-instance (`assessments`)

```
{
  "storage":              <StorageDriftOrError>,
  "transparentHugepages": <FindingOrError>,
  "tcpAdvancedOptions":   <FindingOrError>,
  "filesystemsIoOptions": <FindingOrError>,
  "multiblockReadcount":  <FindingOrError>,
  "hostOsPatch":          <HostOsPatchDriftOrError>,
  "oracleSecurityPatch":  <OracleSecurityPatchDriftOrError>,
  "awsBackup":            <FindingOrError>,
  "crr":                  <FindingOrError>,
  "snapcenterSnapshot":   <FindingOrError>,
  "clone":                <CloneDriftOrError>,
  "dismissedConfigurations": { "<dimension>": true, ... },
  "lastAssessmentTimestamp": 1717000000000,
  "fileSystemId":            "fs-...",
  "ec2InstanceId":           "i-...",
  "ec2InstanceName":         "...",
  "databaseInstanceName":    "ORCL",
  "deploymentType":          "Standalone | RAC | DataGuard",
  "storageProtocol":         "iSCSI | NFS",
  "isASMManaged":            true,
  "databaseHostName":        "..."
}
```

### Generic finding shape (most dimensions)

```
{
  "name":                    "string",
  "status":                  "optimized | not-optimized | under-provisioned | over-provisioned | analyzing",
  "severity":                "string",
  "recommended":             "string",
  "recommendedSizeInGib":    0,
  "recommendation":          "string",
  "current":                 "string?",
  "objectsInViolation":      ["string | OntapVolume", ...],
  "violationDetails":        [ { ... }, ... ],
  "totalObjectsAssessed":    0,
  "totalObjectsInViolation": 0,
  "missingPermissions":      ["string", ...],
  "tags":                    ["AWS Well-Architected pillar", ...],
  "resourceType":            "string?"
}
```

`ErrorResponse`: `{ "error": "string", "code": "string?" }` — surface the message when present instead of a finding.

### Storage section (compound)

```
{
  "configuration": {
    "volumes": [<Finding>, ...],
    "luns":    [<Finding>, ...],   // iSCSI / ASM only
    "os":      [<Finding>, ...]
  },
  "layout": [<Finding>, ...],      // placement checks (archive/datafile/controlfile/redo/temp/oracle-binary, ASM DG/LUN)
  "sizing": [<Finding>, ...]       // headroom, swap-space
}
```

### Host-OS patch drift (extra fields)

```
<Finding> & {
  "ec2InstancesToPatch": [
    {
      "baselineId": "...", "criticalNonCompliantCount": 0, "otherNonCompliantCount": 0,
      "ec2InstanceId": "i-...", "ec2InstanceName": "...",
      "operationStartTime": 0, "operationEndTime": 0, "securityNonCompliantCount": 0
    }
  ]
}
```

### Oracle security patch drift (extra field)

```
<Finding> & { "missingPatchesCount": 0 }
```

### Clone drift (extra fields)

```
<Finding> & {
  "cloneDetails":      [<OracleCloneDetail>, ...],
  "oldCloneDetails":   [<OracleCloneDetail>, ...],
  "cloneDriftMessage": "string?"
}
```

### Per-host wrapper

```
{
  "databaseHostId":   "...",
  "databaseHostName": "...",
  "instancesAssessment": [
    { "databaseInstanceId": "...", "databaseInstanceName": "ORCL", "assessments": <PerInstance>, "error": "string?" }
  ]
}
```

### Per-account wrapper

```
{
  "count": 42,
  "assessmentsPerAccount": [ <PerHost>, ... ],
  "nextToken": "opaque-cursor?"
}
```

### Patch-scan responses

Host OS patch (`field=host-os-patch`):
```
{
  "status": "optimized | not-optimized | analyzing",
  "ec2InstancesToPatch": [
    { "ec2InstanceId": "i-...",
      "missingPatchDetails": [{ "classification": "...", "cveIds": "...", "state": "...", "title": "...", "severity": "..." }] }
  ]
}
```

Oracle security patch (`field=oracle-security-patch`):
```
{
  "status": "optimized | not-optimized | analyzing",
  "ec2InstancesToPatch": [
    { "ec2InstanceId": "i-...", "database": "ORCL",
      "missingPatchDetails": [{ "cveId": "...", "component": "...", "description": "...", "releaseDate": "...", "releaseName": "..." }] }
  ]
}
```

---

## Read workflow

1. **Account scan** — start here to rank all drifted Oracle hosts:
   ```
   GET .../v1/oracle/credentials/{credId}/regions/{region}/assessment?pageSize=50
   ```
2. **Host drill-down** — when user names a specific host:
   ```
   GET .../v1/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/assessment
   ```
3. **Instance drill-down** — for full per-dimension detail:
   ```
   GET .../v1/oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment?fields=storage,oracle-security-patch
   ```
4. **Patch question** — use patch-scan with `field=host-os-patch` or `field=oracle-security-patch`.
5. **Pagination** — pass `nextToken` back until absent.

## Trigger workflow

1. Confirm with user — state host, instance, and that stored assessment will be replaced.
2. POST trigger (optionally append `?fields=...`), capture `jobId`.
3. Poll `GET {base}/accounts/{accountId}/wlmdb/v1/jobs/{jobId}` until `COMPLETED` or `FAILED`.
4. Re-fetch instance assessment and present new findings.

---

## Examples

All examples assume: `$TOKEN` `$ACCOUNT` `$CRED` `$REGION` `$HOST` `$INSTANCE` `$BASE`

### Account-wide Oracle drift summary, top 10 by not-optimized count

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
  | jq '.assessmentsPerAccount[]
        | .databaseHostId as $h | .instancesAssessment[]
        | { hostId: $h, instanceId: .databaseInstanceId, instanceName: .databaseInstanceName,
            notOptimized: ([ .assessments | to_entries[]
              | select(.value | type == "object")
              | select(.value.status? == "not-optimized" or .value.status? == "under-provisioned" or .value.status? == "over-provisioned")
            ] | length) }' | jq -s 'sort_by(-.notOptimized) | .[0:10]'
```

### Single instance drift, specific dimensions

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment?fields=storage,oracle-security-patch,host-os-patch" \
  | jq '{
      lastAssessed:  (.lastAssessmentTimestamp / 1000 | strftime("%Y-%m-%d %H:%M")),
      protocol:      .storageProtocol,
      asmManaged:    .isASMManaged,
      storageSizing: (.storage.sizing | map({ name, status, severity, current, recommended, recommendation })),
      storageLayout: (.storage.layout | map({ name, status, severity, recommendation })),
      hostOsPatch:   (.hostOsPatch         | { status, severity, recommendation, ec2InstancesToPatch }),
      securityPatch: (.oracleSecurityPatch | { status, severity, missingPatchesCount, recommendation })
    }'
```

### Trigger + poll + re-fetch (confirm first)

```bash
JOB=$(curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment" \
  | jq -r .jobId)

while true; do
  STATUS=$(curl -sH "Authorization: Bearer $TOKEN" \
    "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/$JOB" | jq -r .status)
  [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]] && break
  sleep 30
done
```

Append `?fields=storage,oracle-security-patch` to the POST URL to restrict scope.

### On-demand Oracle security patch scan

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment/patch-scan?field=oracle-security-patch" \
  | jq '{ status,
          missing: (.ec2InstancesToPatch
                     | map({ ec2InstanceId, database,
                             missing: (.missingPatchDetails | map({ cveId, component, releaseName, releaseDate })) })) }'
```

Use `field=host-os-patch` for the OS variant.

### Dismiss a finding (confirm first)

```bash
curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg h "$HOST" --arg i "$INSTANCE" '{
        configurationsToDismiss: [
          { databaseHostId: $h, databaseInstanceId: $i, configurationName: "oracle-security-patch", dismissed: true }
        ] }')" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/assessment/dismiss"
```

### Paginate account-scope endpoint

```bash
NEXT=""
while : ; do
  URL="$BASE/accounts/$ACCOUNT/wlmdb/v1/v1/oracle/credentials/$CRED/regions/$REGION/assessment?pageSize=100"
  [[ -n "$NEXT" ]] && URL="$URL&nextToken=$NEXT"
  PAGE=$(curl -sH "Authorization: Bearer $TOKEN" "$URL")
  echo "$PAGE" | jq '.assessmentsPerAccount[] | { host: .databaseHostName, instances: (.instancesAssessment | length) }'
  NEXT=$(echo "$PAGE" | jq -r '.nextToken // empty')
  [[ -z "$NEXT" ]] && break
done
```
