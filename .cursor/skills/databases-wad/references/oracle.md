# Oracle Registered Drift Assessment — API Reference

Environment resolution (`$BASE`, `$ACCOUNT`, `$TOKEN`, `$CRED`, headers, demo / simulator behavior) is owned by [../SKILL.md](../SKILL.md#environment-and-auth). This file documents endpoints, dimensions, and response shapes only.

Examples below assume: `$BASE`, `$TOKEN`, `$ACCOUNT`, `$CRED`, `$REGION`, `$HOST`, `$INSTANCE` are exported, and that `${BASE}/accounts/${ACCOUNT}/wlmdb/v1` is the wlmdb path prefix.

**Demo / simulator:** In `Demo` / `StagingDemo`, every curl below also needs `-H "x-simulator: true"`.

---

## Dimensions

`fields` query values for read and trigger calls. Comma-separate multiple values, or omit `fields` to get all sections.

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

## 1. Read account-scope assessment

```
GET /oracle/credentials/{credId}/regions/{region}/assessment
    ?nextToken=&pageSize=
```

### Query parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageSize` | integer | no | Page size (default server-side). |
| `nextToken` | string | no | Opaque pagination cursor. |

### Response — per-account wrapper

| Field | Type | Description |
|-------|------|-------------|
| `count` | number | Total host count for this page set. |
| `assessmentsPerAccount` | array | Per-host wrappers (see section 2). |
| `nextToken` | string? | Pagination cursor; absent at end. |

### Example — top 10 instances by not-optimized count

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
  | jq '.assessmentsPerAccount[]
        | .databaseHostId as $h | .instancesAssessment[]
        | { hostId: $h, instanceId: .databaseInstanceId, instanceName: .databaseInstanceName,
            notOptimized: ([ .assessments | to_entries[]
              | select(.value | type == "object")
              | select(.value.status? == "not-optimized" or .value.status? == "under-provisioned" or .value.status? == "over-provisioned")
            ] | length) }' | jq -s 'sort_by(-.notOptimized) | .[0:10]'
```

---

## 2. Read host-scope assessment

```
GET /oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/assessment
```

### Response — per-host wrapper

```
{
  "databaseHostId":   "...",
  "databaseHostName": "...",
  "instancesAssessment": [
    { "databaseInstanceId": "...", "databaseInstanceName": "ORCL", "assessments": <PerInstance>, "error": "string?" }
  ]
}
```

---

## 3. Read instance-scope assessment

```
GET /oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment
    ?fields=
```

### Response — per-instance `assessments`

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

### Example — single instance, specific dimensions

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment?fields=storage,oracle-security-patch,host-os-patch" \
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

---

## 4. Trigger re-assessment

```
POST /oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment
    ?fields=
```

### Request body

None; optional `?fields=` query restricts dimensions. The trigger runs SSM on the active-node EC2 host, regenerates findings for every requested dimension, and overwrites the stored instance assessment. **Always confirm with the user before issuing this POST.**

### Response

`202 { "jobId": "..." }` — poll via section 7 until terminal, then re-fetch (section 3).

### Example — trigger + poll

```bash
JOB=$(curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment" \
  | jq -r .jobId)

while true; do
  STATUS=$(curl -sH "Authorization: Bearer $TOKEN" \
    "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/$JOB" | jq -r .status)
  [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]] && break
  sleep 30
done
```

Append `?fields=storage,oracle-security-patch` to the POST URL to restrict scope.

---

## 5. Trigger patch scan (read, on-demand)

```
GET /oracle/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment/patch-scan
    ?field={host-os-patch | oracle-security-patch}
```

### Query parameters

| Field | Type | Required | Allowed values |
|-------|------|----------|----------------|
| `field` | string | yes | `host-os-patch`, `oracle-security-patch` |

### Responses

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

### Example — Oracle security patch scan

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment/patch-scan?field=oracle-security-patch" \
  | jq '{ status,
          missing: (.ec2InstancesToPatch
                     | map({ ec2InstanceId, database,
                             missing: (.missingPatchDetails | map({ cveId, component, releaseName, releaseDate })) })) }'
```

Use `field=host-os-patch` for the OS variant.

---

## 6. Dismiss finding (account-scope, mutating)

```
POST /oracle/assessment/dismiss
```

### Request body

```json
{
  "configurationsToDismiss": [
    {
      "databaseHostId": "...",
      "databaseInstanceId": "...",
      "configurationName": "<dimension>",
      "dismissed": true
    }
  ]
}
```

Set `dismissed: false` to un-dismiss. **Always confirm with the user before issuing this POST.**

### Example

```bash
curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg h "$HOST" --arg i "$INSTANCE" '{
        configurationsToDismiss: [
          { databaseHostId: $h, databaseInstanceId: $i, configurationName: "oracle-security-patch", dismissed: true }
        ] }')" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/assessment/dismiss"
```

---

## 7. Job polling

```
GET /jobs/{jobId}
```

Terminal `status` values: `COMPLETED`, `FAILED`. Used after any trigger (section 4) to wait for completion before re-fetching the instance assessment.

---

## 8. Pagination loop

```bash
NEXT=""
while : ; do
  URL="$BASE/accounts/$ACCOUNT/wlmdb/v1/oracle/credentials/$CRED/regions/$REGION/assessment?pageSize=100"
  [[ -n "$NEXT" ]] && URL="$URL&nextToken=$NEXT"
  PAGE=$(curl -sH "Authorization: Bearer $TOKEN" "$URL")
  echo "$PAGE" | jq '.assessmentsPerAccount[] | { host: .databaseHostName, instances: (.instancesAssessment | length) }'
  NEXT=$(echo "$PAGE" | jq -r '.nextToken // empty')
  [[ -z "$NEXT" ]] && break
done
```
