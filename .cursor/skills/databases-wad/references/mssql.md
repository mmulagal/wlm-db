# MSSQL Registered Drift Assessment — API Reference

Environment resolution (`$BASE`, `$ACCOUNT`, `$TOKEN`, `$CRED`, headers, demo / simulator behavior) is owned by [../SKILL.md](../SKILL.md#environment-and-auth). This file documents endpoints, dimensions, and response shapes only.

Examples below assume: `$BASE`, `$TOKEN`, `$ACCOUNT`, `$CRED`, `$REGION`, `$HOST`, `$INSTANCE` are exported, and that `${BASE}/accounts/${ACCOUNT}/wlmdb/v1` is the wlmdb path prefix.

**Demo / simulator:** In `Demo` / `StagingDemo`, every curl below also needs `-H "x-simulator: true"`.

---

## Dimensions

`fields` query values for read and trigger calls. Comma-separate multiple values, or omit `fields` to get all sections.

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

## 1. Read account-scope assessment

```
GET /mssql/credentials/{credId}/regions/{region}/assessment
    ?fields=&nextToken=&pageSize=
```

### Query parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fields` | string | no | Comma-separated dimensions (see Dimensions). Omit for all. |
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
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/assessment?pageSize=200" \
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
GET /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/assessment
    ?fields=&nextToken=
```

### Response — per-host wrapper

```
{
  "databaseHostId":   "...",
  "databaseHostName": "...",
  "instancesAssessment": [
    { "databaseInstanceId": "...", "databaseInstanceName": "MSSQLSERVER", "assessments": <PerInstance>, "error": "string?" }
  ]
}
```

---

## 3. Read instance-scope assessment

```
GET /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment
    ?fields=
```

### Response — per-instance `assessments`

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

### Example — single instance, specific dimensions

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

---

## 4. Trigger re-assessment

```
POST /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment
```

### Request body

Optional `{}`. The trigger runs SSM on the EC2 host, regenerates findings for every dimension, and overwrites the stored instance assessment. **Always confirm with the user before issuing this POST.**

### Response

`202 { "jobId": "..." }` — poll via section 7 until terminal, then re-fetch (section 3).

### Example — trigger + poll

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

---

## 5. Trigger patch scan (read, on-demand)

```
GET /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/assessment/patch-scan
    ?field={mssql-patch | host-os-patch}
```

### Query parameters

| Field | Type | Required | Allowed values |
|-------|------|----------|----------------|
| `field` | string | yes | `mssql-patch`, `host-os-patch` |

### Response

```
{
  "status": "optimized | not-optimized | analyzing",
  "ec2InstancesToPatch": [{ "ec2InstanceId": "i-...", "missingPatches": ["KB...", ...] }]
}
```

### Example

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/assessment/patch-scan?field=mssql-patch" \
  | jq '{ status, missing: (.ec2InstancesToPatch | map({ ec2InstanceId, missingPatches })) }'
```

Use `field=host-os-patch` for the Windows OS variant.

---

## 6. Dismiss finding (account-scope, mutating)

```
POST /mssql/assessment/dismiss
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
          { databaseHostId: $h, databaseInstanceId: $i, configurationName: "mtu-alignment", dismissed: true }
        ] }')" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/assessment/dismiss"
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
  URL="$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/assessment?pageSize=100"
  [[ -n "$NEXT" ]] && URL="$URL&nextToken=$NEXT"
  PAGE=$(curl -sH "Authorization: Bearer $TOKEN" "$URL")
  echo "$PAGE" | jq '.assessmentsPerAccount[] | { host: .databaseHostName, instances: (.instancesAssessment | length) }'
  NEXT=$(echo "$PAGE" | jq -r '.nextToken // empty')
  [[ -z "$NEXT" ]] && break
done
```
