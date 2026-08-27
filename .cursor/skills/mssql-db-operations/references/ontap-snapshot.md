# ONTAP Snapshot — FSx Proxy Reference

**Prerequisite:** If `fsxId`, SVM, or volume name unknown, run [inventory.md](inventory.md) first.

Environment and proxy headers: [../SKILL.md](../SKILL.md#environment-and-auth).

Proxy base:
```
${BASE}/accounts/${ACCOUNT}/proxy/v1/targets/${FSX_ID}/https/{ontapPath}
Header: x-endpoint: management.${FSX_ID}.fsx.${REGION}.amazonaws.com
```

ONTAP paths must **not** start with `/`.

Snapshot naming convention: `netapp_wf_clone_{epoch}` (epoch = Unix seconds).

---

## Workflow

1. Resolve volume UUID
2. Confirm with user (destructive gate)
3. Create snapshot
4. Poll ONTAP job
5. Optional verify

---

## Step 1 — Resolve volume UUID

```
GET api/storage/volumes?name={volumeName}&svm.name={svmName}&fields=uuid,name
```

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  -H "x-endpoint: management.${FSX_ID}.fsx.${REGION}.amazonaws.com" \
  "$BASE/accounts/$ACCOUNT/proxy/v1/targets/$FSX_ID/https/api/storage/volumes?name=${VOL_NAME}&svm.name=${SVM_NAME}&fields=uuid,name"
```

---

## Step 2 — Create snapshot

**Confirmation gate applies.** Wait for explicit user confirmation.

```
POST api/storage/volumes/{volumeUuid}/snapshots
```

Body:
```json
{ "name": "netapp_wf_clone_1717000000" }
```

```bash
EPOCH=$(date +%s)
SNAP_NAME="netapp_wf_clone_${EPOCH}"

curl -sSk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-endpoint: management.${FSX_ID}.fsx.${REGION}.amazonaws.com" \
  "$BASE/accounts/$ACCOUNT/proxy/v1/targets/$FSX_ID/https/api/storage/volumes/${VOLUME_UUID}/snapshots" \
  -d "{\"name\": \"${SNAP_NAME}\"}"
```

Response `202` includes `job.uuid`.

---

## Step 3 — Poll ONTAP job

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  -H "x-endpoint: management.${FSX_ID}.fsx.${REGION}.amazonaws.com" \
  "$BASE/accounts/$ACCOUNT/proxy/v1/targets/$FSX_ID/https/api/cluster/jobs/${JOB_UUID}"
```

Poll until `state` is `success` or `failure`.

---

## Step 4 — Verify (optional)

```
GET api/storage/volumes/{volumeUuid}/snapshots?name={snapshotName}&fields=name,uuid,create_time
```
