# Sandbox Lifecycle — WLMDB API Reference

**Prerequisite:** Run [inventory.md](inventory.md). Check `ssmStatus === Connected`. If `NotConnected` or `N/A`, use [clone-without-ssm.md](clone-without-ssm.md) lifecycle ONTAP section instead.

Environment: [../SKILL.md](../SKILL.md#environment-and-auth).

Shared path params: `{databaseHostId}`, `{databaseInstanceId}`, `{sandboxName}`.

Base path:
```
/mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}/sandboxes/{sandboxName}
```

**Validation:** Refresh and re-baseline fail if sandbox is already split (no `parentVolume` on mapped volumes).

---

## Delete sandbox

1. Pre-read: list sandboxes — confirm exists
2. Confirm (destructive gate — **permanent data loss**)
3. `DELETE .../sandboxes/{sandboxName}` → `202` + `jobId`
4. Poll job

```bash
curl -sSk -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}"
```

---

## Refresh sandbox

Re-sync sandbox from source with new ONTAP snapshot.

1. Pre-read: list sandbox — confirm not already split
2. Confirm (destructive gate — overwrites sandbox data)
3. `PATCH` body `{ "action": "REFRESH" }` → `202` + `jobId`
4. Poll job

```bash
curl -sSk -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}" \
  -d '{ "action": "REFRESH" }'
```

Valid `action` values: `REFRESH`, `RE-BASELINE`.

---

## Re-baseline sandbox

Point sandbox at a specific snapshot.

1. Pre-read snapshots:

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}/snapshots?historical=true"
```

2. Confirm target snapshot name with user
3. `PATCH` → `202` + `jobId`
4. Poll job

```bash
curl -sSk -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}" \
  -d '{ "action": "RE-BASELINE", "snapshot": "netapp_wf_clone_1717000000" }'
```

---

## Split sandbox

Promote FlexClone to full volume. **Irreversible** — blocks future refresh/re-baseline.

1. Pre-read split-estimate — present storage impact:

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}/split-estimate"
```

2. Confirm (destructive gate — irreversible)
3. `POST .../split` → `200` + `jobId`
4. Poll job

```bash
curl -sSk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}/split"
```

---

## Diagnostics (no confirmation gate)

**Connection string:**
```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}/connection-string"
```

**Check integrity** (async job, may impact DB performance):
```bash
curl -sSk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE/sandboxes/${SANDBOX_NAME}/check-integrity"
```

Poll `GET .../jobs/{jobId}` after integrity check.

---

## Poll job (all lifecycle ops)

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/jobs/${JOB_ID}"
```

Terminal `status`: `COMPLETED`, `FAILED`.
