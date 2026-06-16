export ENVIRONMENT=Production   # or Staging, Demo, StagingDemo
export ACCOUNT_ID=account-...
export TOKEN=...
export REGION=us-east-1
export CREDENTIALS_ID=...       # automatic cloud only
export INSTANCE=i-...           # automatic EBS/FSxW

case "$ENVIRONMENT" in
  Production|Demo) WF_BASE=https://api.workloads.netapp.com ;;
  Staging|StagingDemo) WF_BASE=https://staging.api.workloads.netapp.com ;;
esac
export WF_API="$WF_BASE/accounts/$ACCOUNT_ID/wlmdb/v1"

## Example 1 — Discover EC2 instance ids

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$WF_API/mssql/credentials/$CREDENTIALS_ID/regions/$REGION/discover?pageSize=50" \
  | jq '.items[] | { ec2InstanceId, deploymentModel, sqlServerEdition: .sqlServerInstances[0].sqlServerEdition }'
```

## Example 2 — Automatic EBS (bulk — one or more hosts)

```bash
BODY=$(jq -n \
  --arg id "$INSTANCE" \
  '{
    snapshotFrequency: "Daily",
    clonedCopiesCount: 3,
    monthlyChangeRatePercentage: 10,
    cloneRefreshFrequency: "Daily",
    hosts: [{ ec2InstanceId: $id, monthlySqlByolCost: null }]
  }')
EBS_PATH="$WF_API/mssql/credentials/$CREDENTIALS_ID/regions/$REGION/storage-savings/ebs"

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$EBS_PATH" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended, savings: (.totalSummary.existing - .totalSummary.recommended) }'

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$EBS_PATH/calculations" \
  | jq '{ ebsCalculation, ebsSnapshotCalculation, single }'
```

Add more entries to `hosts[]` (max 5) for multi-host TCO.


## Example 2b — Automatic FSxW (single instance)

Single-instance path only — no bulk API, no `hosts[]`, no `cloneRefreshFrequency`. Rejects AOAG deployments.

```bash
BODY=$(jq -n '{
  snapshotFrequency: "Daily",
  clonedCopiesCount: 3,
  monthlyChangeRatePercentage: 10
}')
FSXW_PATH="$WF_API/mssql/credentials/$CREDENTIALS_ID/regions/$REGION/instances/$INSTANCE/storage-savings/fsxw"

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$FSXW_PATH" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended, savings: (.totalSummary.existing - .totalSummary.recommended) }'

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$FSXW_PATH/calculations" \
  | jq '{ fsxwCalculation, fsxwSnapshotCalculation, single }'
```

## Example 3 — Manual EBS what-if (2 TB gp3, m5.2xlarge)

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "sqlServerDeploymentType": "Standalone",
    "sqlServerEdition": "Standard Edition",
    "snapshotFrequency": "Daily",
    "clonedCopiesCount": 0,
    "monthlyChangeRatePercentage": 10,
    "ec2Instances": [{
      "ec2InstanceDescription": "Primary",
      "ec2InstanceType": "m5.2xlarge",
      "isPrimary": true,
      "volumes": [{
        "volumeType": "gp3",
        "volumeNumber": 1,
        "storageAmount": 2199023255552,
        "volumeIops": 3000,
        "throughput": 125
      }]
    }]
  }' \
  "$WF_API/mssql/regions/$REGION/manual-storage-savings/ebs" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended, compute: .compute }'
```

## Example 3b — Manual EBS what-if (gp2 — no IOPS/throughput)

gp2 volumes: send only `volumeType`, `volumeNumber`, `storageAmount`. Omit `volumeIops` and `throughput`.

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "sqlServerDeploymentType": "Standalone",
    "sqlServerEdition": "Standard Edition",
    "snapshotFrequency": "Daily",
    "clonedCopiesCount": 0,
    "monthlyChangeRatePercentage": 10,
    "ec2Instances": [{
      "ec2InstanceDescription": "Primary",
      "ec2InstanceType": "m5.2xlarge",
      "isPrimary": true,
      "volumes": [{
        "volumeType": "gp2",
        "volumeNumber": 1,
        "storageAmount": 2199023255552
      }]
    }]
  }' \
  "$WF_API/mssql/regions/$REGION/manual-storage-savings/ebs" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended }'
```

## Example 4 — Manual FSxW what-if

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "sqlServerDeploymentType": "Standalone",
    "sqlServerEdition": "Enterprise Edition",
    "snapshotFrequency": "Weekly",
    "clonedCopiesCount": 1,
    "monthlyChangeRatePercentage": 15,
    "ec2Instances": [{
      "ec2InstanceDescription": "FSxW host",
      "ec2InstanceType": "m5.xlarge",
      "isPrimary": true,
      "fsxw": {
        "deploymentType": "Single",
        "storageVolumeType": "SSD",
        "storageAmount": 1099511627776,
        "volumeIops": 3000,
        "throughput": 128
      }
    }]
  }' \
  "$WF_API/mssql/regions/$REGION/manual-storage-savings/fsxw" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended, fsxw: .fsxw, fsx: .fsx }'
```

## Example 4b — Manual Oracle EBS what-if (4 TB gp3, m5.4xlarge)

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "oracleDeploymentType": "Standalone",
    "oracleEdition": "Enterprise Edition",
    "snapshotFrequency": "Weekly",
    "clonedCopiesCount": 0,
    "monthlyChangeRatePercentage": 5,
    "ec2Instances": [{
      "ec2InstanceType": "m5.4xlarge",
      "isPrimary": true,
      "volumes": [{
        "volumeType": "gp3",
        "volumeNumber": 1,
        "storageAmount": 4398046511104,
        "volumeIops": 3000,
        "throughput": 125
      }]
    }]
  }' \
  "$WF_API/oracle/regions/eu-west-1/manual-storage-savings/ebs" \
  | jq '{ existing: .totalSummary.existing, recommended: .totalSummary.recommended, compute: .compute }'
```

## Example 5 — List on-prem MSSQL resources

```bash
curl -sH "Authorization: Bearer $TOKEN" \
  "$WF_API/mssql/onprem-tco/resources?pageSize=20" \
  | jq '.items[] | { resourceId, resourceName, deploymentModel, creationTime }'
```

## Example 6 — On-prem MSSQL explore-savings (bulk)

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "regionCode": "us-east-1",
    "resources": [{ "resourceId": "RESOURCE_ID_HERE" }],
    "snapshotInfo": {
      "snapshotFrequency": "Daily",
      "clonedCopiesCount": 1,
      "monthlyChangeRatePercentage": 20
    }
  }' \
  "$WF_API/mssql/onprem-tco/explore-savings" \
  | jq '{
      savings: (.storageSavings.totalSummary.existing - .storageSavings.totalSummary.recommended),
      recommendedInstance: .storageSavings.compute.recommended.instanceType
    }'
```

## Example 6b — On-prem MSSQL single-resource explore-savings

```bash
RESOURCE_ID=$(curl -sH "Authorization: Bearer $TOKEN" \
  "$WF_API/mssql/onprem-tco/resources?pageSize=5" \
  | jq -r '.items[0].resourceId')

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "regionCode": "us-east-1",
    "snapshotInfo": {
      "snapshotFrequency": "Daily",
      "clonedCopiesCount": 1,
      "monthlyChangeRatePercentage": 20
    }
  }' \
  "$WF_API/mssql/onprem-tco/resources/$RESOURCE_ID/explore-savings" \
  | jq '.storageSavings.totalSummary'
```

## Example 6c — Automatic Oracle EBS (discovered host)

```bash
INSTANCE=$(curl -sH "Authorization: Bearer $TOKEN" \
  "$WF_API/oracle/credentials/$CREDENTIALS_ID/regions/$REGION/discover?pageSize=20" \
  | jq -r '.items[0].ec2InstanceId')

BODY=$(jq -n --arg id "$INSTANCE" '{
  snapshotFrequency: "Daily",
  clonedCopiesCount: 2,
  monthlyChangeRatePercentage: 10,
  cloneRefreshFrequency: "Daily",
  hosts: [{ ec2InstanceId: $id }]
}')
ORACLE_EBS="$WF_API/oracle/credentials/$CREDENTIALS_ID/regions/$REGION/storage-savings/ebs"

curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$ORACLE_EBS" \
  | jq '.totalSummary'
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" "$ORACLE_EBS/calculations" \
  | jq '{ ebsCalculation, single }'
```

## Example 7 — On-prem Oracle explore-savings (bulk with BYOL)

```bash
curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "regionCode": "us-west-2",
    "resources": [{
      "resourceId": "ORACLE_RESOURCE_ID",
      "monthlyByolCost": 5000
    }],
    "snapshotInfo": {
      "snapshotFrequency": "Daily",
      "clonedCopiesCount": 0,
      "monthlyChangeRatePercentage": 10
    }
  }' \
  "$WF_API/oracle/onprem-tco/explore-savings" \
  | jq '.storageSavings.totalSummary'
```

## Example 8 — On-prem upload and poll

Requires explicit user confirmation (writes assessment data). `fileContent` must be **base64(gzip(base64(raw-json-bytes)))** — see `scripts/run_onprem_upload.sh` for encoding. Prefer that script when the user has confirmed upload.

```bash
JOB=$(curl -sH "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"  \
  -d "{\"fileName\":\"collector.json\",\"fileContent\":\"$B64_CONTENT\"}" \
  "$WF_API/mssql/onprem-tco/upload" \
  | jq -r .jobId)

while true; do
  STATUS=$(curl -sH "Authorization: Bearer $TOKEN" \
    "$WF_API/jobs/$JOB" | jq -r .status)
  echo "$(date +%H:%M:%S) status=$STATUS"
  [[ "$STATUS" == "COMPLETED" || "$STATUS" == "FAILED" ]] && break
  sleep 15
done
```

Replace `mssql` with `oracle` in upload URL for Oracle collector results.
