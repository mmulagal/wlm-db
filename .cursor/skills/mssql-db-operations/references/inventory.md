# MSSQL Inventory — API Reference

Environment resolution (`BASE_URL`, `ACCOUNT_ID`, `TOKEN`, `CREDENTIALS_ID`, headers, demo / simulator) is owned by [../SKILL.md](../SKILL.md#environment-and-auth).

**If host/instance IDs are unknown, run this reference first** before create-database, clone-with-ssm, sandbox-lifecycle, or SSM checks.

Examples assume: `$BASE`, `$TOKEN`, `$ACCOUNT`, `$CRED`, `$REGION`, `$HOST`, `$INSTANCE` exported; prefix `${BASE}/accounts/${ACCOUNT}/wlmdb/v1`.

**Demo / simulator:** In `Demo` / `StagingDemo`, every curl needs `-H "x-simulator: true"`.

---

## List managed MSSQL hosts

```
GET /mssql/credentials/{credId}/regions/{region}/database-hosts
    ?fields=&nextToken=
```

Optional `fields` (comma-separated): `instanceDetails`, `serverDetails`, `nodeTopology`, `databases`, `aoag`, `dbCount`. Use `instanceDetails` when resolving `databaseInstanceId`.

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts" \
  | jq '{ count, hosts: [.items[]? | { id, name, databaseHostStatus, ssmStatus, instances: (.databaseInstancesSummary // [] | map({ id: .databaseInstanceId, name: .databaseInstanceName })) }] }'
```

### Response fields to extract

| Field                                | Use                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `id`                                 | `databaseHostId` for all later calls                                      |
| `name`                               | Match user-provided hostname                                              |
| `databaseHostStatus`                 | `Online` / `Offline` / `Unknown`                                          |
| `ssmStatus`                          | `Connected` / `NotConnected` / `N/A` — gates WLMDB create/clone/lifecycle |
| `databaseInstancesSummary[]`         | `databaseInstanceId`, instance name, deployment type                      |
| `clusterNodeDetails[].ec2InstanceId` | FCI/AOAG node EC2 IDs                                                     |
| `fsxnResourceInfo`                   | FSx file system ID for ONTAP proxy calls                                  |

Paginate with `nextToken` until absent.

---

## Single host drill-down

```
GET /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}
    ?fields=
```

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST"
```

```
GET /mssql/credentials/{credId}/regions/{region}/database-hosts/{hostId}/database-instances/{instanceId}
```

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/database-hosts/$HOST/database-instances/$INSTANCE"
```

---

## Discover unmanaged hosts

Use only when the host is **not** in the managed list or the user asks about discovery.

```
GET /mssql/credentials/{credId}/regions/{region}/discover
    ?pageSize=&nextToken=
```

```bash
curl -sSk -H "Authorization: Bearer $TOKEN" \
  "$BASE/accounts/$ACCOUNT/wlmdb/v1/mssql/credentials/$CRED/regions/$REGION/discover?pageSize=200"
```

| Field                                        | Use                                       |
| -------------------------------------------- | ----------------------------------------- |
| `ec2InstanceId`                              | EC2 identifier                            |
| `ssmState`                                   | `connected` / `notconnected`              |
| `hostManageReadiness.extensiveRunPermission` | Whether credentials can run SSM documents |

Unmanaged hosts cannot use WLMDB create-db / sandbox APIs until registered.

---

## Instance detail for one host

```
GET .../database-hosts/{hostId}/database-instances/{instanceId}/databases
GET .../database-hosts/{hostId}/database-instances/{instanceId}/sandboxes
```

Use sandboxes list to resolve `sandboxName` before lifecycle operations.
