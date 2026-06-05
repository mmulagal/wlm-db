# MSSQL Registered Drift Assessment — Reference

## Endpoints

Base prefix for all paths: `{base}/accounts/{accountId}/wlmdb/v1`

### Read

| Method | Path | Returns |
|--------|------|---------|
| GET | `/mssql/credentials/{credId}/regions/{region}/assessment` | Account / region-scoped paginated drift across all managed MSSQL hosts. Query: `fields`, `nextToken`, `pageSize`. |
| GET | `/mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/assessment` | Host-level drift for every instance on the host. Query: `fields`, `nextToken`. |
| GET | `/mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment` | Instance-level drift (full per-dimension result). Query: `fields`. |

### Patch scan (read, on-demand)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment/patch-scan?field=` | Required `field`; allowed values: `mssql-patch`, `host-os-patch`. |

### Trigger (mutating)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment` | optional `{}` | `202 { "jobId": "..." }` |

A successful trigger runs SSM on the EC2 host, regenerates findings for every dimension, and overwrites the stored instance assessment. Always confirm with the user before issuing this POST.

### Dismiss (mutating, account-scope)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/mssql/assessment/dismiss` | `{ "configurationsToDismiss": [{ "databaseHostId": "...", "databaseInstanceId": "...", "configurationName": "<dimension>", "dismissed": true }] }` | Updated dismissal state. |

Set `dismissed: false` to un-dismiss.

---

## Assessment dimensions (`fields` query values)

Comma-separate multiple values, or omit `fields` to get all sections.

| Value | What it covers |
|-------|----------------|
| `storage` | FSx for ONTAP volume / LUN placement, drive sizing, headroom |
| `compute` | EC2 rightsizing for the SQL host |
| `license` | SQL Server edition vs feature usage |
| `host-os-patch` | Windows OS patch level |
| `mssql-patch` | SQL Server cumulative update / patch level |
| `rss-config` | Receive-Side Scaling NIC settings |
| `maxdop` | `max degree of parallelism` setting |
| `mapped-ontap-volumes` | Mapping between SQL drives and ONTAP volumes |
| `clone` | Stale / orphaned FSx clone inventory |
| `snapshot-policy` | Local snapshot policy attached to the volume |
| `aws-backup` | AWS Backup / FSx backup configuration |
| `crr` | Cross-region replication state |
| `high-availability` | FCI / AOAG cluster, quorum, heartbeat |
| `mtu-alignment` | Network MTU alignment between host and FSx |

---

## Response shapes

### Per-instance (`assessments`)

```
{
  "storage":            <FindingOrError>,
  "compute":            <FindingOrError>,
  "snapshotPolicy":     <Finding>,
  "crr":                <Finding>,
  "awsBackup":          <Finding>,
  "highAvailability":   [<FindingOrError>, ...],
  "license":            <FindingOrError>,
  "hostOsPatch":        <FindingOrError>,
  "rssConfig":          <FindingOrError>,
  "maxDOP":             <FindingOrError>,
  "mssqlPatch":         <FindingOrError>,
  "mtuAlignment":       <FindingOrError>,
  "clone":              <FindingOrError>,
  "lastAssessmentTimestamp": 1717000000000,
  "dismissedConfigurations": { "<dimension>": true, ... },
  "fileSystemId":         "fs-...",
  "storageEndpoint":      "...",
  "ec2InstanceId":        "i-...",
  "databaseInstanceName": "MSSQLSERVER",
  "deploymentType":       "FCI | AOAG | Standalone",
  "baseDeploymentType":   "FCI | AOAG | Standalone",
  "replicaRole":          "PRIMARY | SECONDARY",
  "databaseHostName":     "..."
}
```

### Generic finding shape

```
{
  "name":                    "string",
  "status":                  "optimized | not-optimized | under-provisioned | over-provisioned | analyzing",
  "severity":                "critical | severe | important | info",
  "recommended":             "string",
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

### Per-host wrapper

```
{
  "databaseHostId":   "...",
  "databaseHostName": "...",
  "instancesAssessment": [
    { "databaseInstanceId": "...", "databaseInstanceName": "MSSQLSERVER", "assessments": <PerInstance>, "error": "string?" }
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

### Patch-scan response

```
{
  "status": "optimized | not-optimized | analyzing",
  "ec2InstancesToPatch": [{ "ec2InstanceId": "i-...", "missingPatches": ["KB...", ...] }]
}
```

---

## Read workflow

1. **Account scan** — start here to rank all drifted hosts:
   ```
   GET .../mssql/credentials/{credId}/regions/{region}/assessment?pageSize=50
   ```
2. **Host drill-down** — when user names a specific host:
   ```
   GET .../database-hosts/{hostId}/assessment
   ```
3. **Instance drill-down** — for full per-dimension detail:
   ```
   GET .../database-hosts/{hostId}/database-instances/{instanceId}/assessment?fields=storage,high-availability
   ```
4. **Patch question** — use patch-scan with `field=mssql-patch` or `field=host-os-patch`.
5. **Pagination** — pass `nextToken` back until absent.

## Trigger workflow

1. Confirm with user — state host, instance, and that stored assessment will be replaced.
2. POST trigger, capture `jobId`.
3. Poll `GET {base}/accounts/{accountId}/wlmdb/v1/jobs/{jobId}` until `COMPLETED` or `FAILED`.
4. Re-fetch instance assessment and present new findings.

---

## Examples

All examples assume: `$TOKEN` `$ACCOUNT` `$CRED` `$REGION` `$HOST` `$INSTANCE` `$BASE`

### Account-wide drift summary, top 10 by not-optimized count

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
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
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment?fields=storage,compute,high-availability" \
  | jq '{
      lastAssessed: (.lastAssessmentTimestamp / 1000 | strftime("%Y-%m-%d %H:%M")),
      deployment:  .deploymentType,
      storage:     (.storage         | { status, severity, current, recommended, recommendation }),
      compute:     (.compute         | { status, severity, current, recommended, recommendation }),
      highAvail:   (.highAvailability | map({ name, status, severity, recommendation }))
    }'
```

### Trigger + poll + re-fetch (confirm first)

```bash
JOB=$(curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" -d '{}' \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment" \
  | jq -r .jobId)

while true; do
  STATUS=$(curl -sH "Authorization: Bearer $TOKEN" \
    "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/$JOB" | jq -r .status)
  [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]] && break
  sleep 30
done
```

### On-demand patch scan

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment/patch-scan?field=mssql-patch" \
  | jq '{ status, missing: (.ec2InstancesToPatch | map({ ec2InstanceId, missingPatches })) }'
```

Use `field=host-os-patch` for the Windows OS variant.

### Dismiss a finding (confirm first)

```bash
curl -sH "Authorization: Bearer $TOKEN" -X POST \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg h "$HOST" --arg i "$INSTANCE" '{
        configurationsToDismiss: [
          { databaseHostId: $h, databaseInstanceId: $i, configurationName: "mtu-alignment", dismissed: true }
        ] }')" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/assessment/dismiss"
```

### Paginate account-scope endpoint

```bash
NEXT=""
while : ; do
  URL="$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/assessment?pageSize=100"
  [[ -n "$NEXT" ]] && URL="$URL&nextToken=$NEXT"
  PAGE=$(curl -sH "Authorization: Bearer $TOKEN" "$URL")
  echo "$PAGE" | jq '.assessmentsPerAccount[] | { host: .databaseHostName, instances: (.instancesAssessment | length) }'
  NEXT=$(echo "$PAGE" | jq -r '.nextToken // empty')
  [[ -z "$NEXT" ]] && break
done
```
