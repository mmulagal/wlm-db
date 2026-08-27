# Clone / Operations Without SSM — Manual ONTAP Runbook

**When to use:** `ssmStatus` is `NotConnected` or `N/A`, user explicitly requests no SSM, or host is unmanaged with `ssmState: notconnected`.

**Do not** POST WLMDB create-db, sandboxes, or lifecycle APIs in this mode. **Do not** run ONTAP CLI, proxy, or Windows/SQL yourself. Fill in names from inventory when known, then **show the user** numbered **ONTAP CLI** plus Standalone vs FCI host/SQL steps.

**Prerequisite:** Run [inventory.md](inventory.md) for FSx ID, SVM, volume names when possible.

Connect to the FSx ONTAP CLI (SSH as `fsxadmin` to the management LIF). Do **not** give Workload Factory proxy REST curls for these storage steps.

```text
ssh fsxadmin@management.${FSX_ID}.fsx.${REGION}.amazonaws.com
```

Snapshot naming: `netapp_wf_clone_{epoch}` (epoch = Unix seconds).

CLI syntax follows [ONTAP SAN provisioning](https://docs.netapp.com/us-en/ontap/san-admin/provision-storage.html) and the [ONTAP command reference](https://docs.netapp.com/us-en/ontap-cli/).

---

## Clone (storage) — numbered steps

Mirror server `createVolumeClone()` on the cluster CLI.

### 1. List source volumes

```text
volume show -vserver ${SVM_NAME} -fields volume,size,uuid
```

Note data and log volume names.

### 2. Snapshot each unique volume

Mutating — include this in the instructions; do not execute it.

```text
volume snapshot create -vserver ${SVM_NAME} -volume ${PARENT_VOL} -snapshot netapp_wf_clone_${EPOCH}
```

Repeat for each data/log volume. Confirm with `volume snapshot show -vserver ${SVM_NAME} -volume ${PARENT_VOL}`.

### 3. Create FlexClone volumes

```text
volume clone create -vserver ${SVM_NAME} -flexclone ${PARENT_VOL}_clone_${EPOCH} -type RW -parent-vserver ${SVM_NAME} -parent-volume ${PARENT_VOL} -parent-snapshot netapp_wf_clone_${EPOCH}
```

Repeat for data and log volumes.

### 4. List cloned LUNs

```text
lun show -vserver ${SVM_NAME} -volume ${CLONE_VOL} -fields path,serial,ostype,size
```

Note `path` and `serial` for host matching (`NETAPP LUN C-MODE` + serial).

### 5. Tag clone volumes

ONTAP CLI has no AWS tag PATCH. Set a comment that matches WLMDB-style `cloned_by` / `source`.

- `${ACCOUNT}` — `ACCOUNT_ID` without the `account-` prefix (`account-PzlmCZPM` → `PzlmCZPM`)
- `${CRED}` — `CREDENTIALS_ID` with `-` replaced by `_`
- `source` — host and instance with `-` replaced by `_` (e.g. `sqlnode-81477` → `sqlnode_81477`)

```text
volume modify -vserver ${SVM_NAME} -volume ${CLONE_VOL} -comment "cloned_by=netapp_wf_${ACCOUNT}_${CRED},source=sqlnode_81477"
```

### 6. Collect host IQN and confirm igroup

No SSM to auto-fetch. Operator runs this on Windows, then checks the igroup on ONTAP.

**Standalone** — on the SQL host:

```powershell
(Get-InitiatorPort).NodeAddress
```

**FCI** — on **every** cluster node (clone cannot fail over unless both IQNs are in the igroup):

```powershell
(Get-InitiatorPort).NodeAddress
```

```text
igroup show -vserver ${SVM_NAME} -igroup ${IGROUP_NAME}
```

If an IQN is missing:

```text
igroup add -vserver ${SVM_NAME} -igroup ${IGROUP_NAME} -initiator ${IQN}
```

### 7. Set LUN signature (before map)

No ONTAP CLI equivalent. On a Windows host with NetApp PowerShell Toolkit, connected to the FSx management LIF, run for **each** cloned LUN path from step 4:

```powershell
# Requires -Module netapp.ontap
Connect-NcController -Name <fsx-mgmt-lif> -Credential $FSxCredentials
Set-NcLunSignature -Path $lunPath -Vserver $SVM_NAME -Confirm:$false
```

Do this **before** lun maps. Mapping first leaves Windows seeing a duplicate disk signature.

### 8. Map LUNs to igroup

```text
lun mapping create -vserver ${SVM_NAME} -path ${LUN_PATH} -igroup ${IGROUP_NAME}
```

One command per cloned LUN. Verify:

```text
lun mapping show -vserver ${SVM_NAME} -path ${LUN_PATH}
```

---

## Create database (storage only)

When the user asks to create a database without SSM:

### 1. Create data volume

```text
volume create -vserver ${SVM_NAME} -volume ${DATA_VOL} -aggregate ${AGGREGATE} -size 100g -state online
```

### 2. Create log volume

Repeat with the log volume name and size (for example `-size 50g`).

### 3. Create LUNs

Use `windows_2008` for GPT Windows/SQL LUNs (same ostype WLMDB uses on FSx). Size must fit in the volume.

```text
lun create -vserver ${SVM_NAME} -volume ${DATA_VOL} -lun ${LUN_NAME} -size 100g -ostype windows_2008 -space-reserve disabled
```

Repeat for the log LUN.

### 4. Map LUNs to igroup

Same as clone step 8 (IQN/igroup + `Set-NcLunSignature` still apply).

---

## Lifecycle without SSM (ONTAP only)

| Operation | ONTAP CLI |
|---|---|
| **Refresh / re-baseline storage** | New snapshot + FlexClone (clone steps 2–8); operator swaps SQL files on host |
| **Delete clone volumes** | `lun mapping delete -vserver ${SVM_NAME} -path ${LUN_PATH} -igroup ${IGROUP_NAME}` then `volume delete -vserver ${SVM_NAME} -volume ${CLONE_VOL}` |
| **Split** | `volume clone split start -vserver ${SVM_NAME} -flexclone ${CLONE_VOL}` — irreversible |

---

## Manual host / SQL steps (after ONTAP numbered list)

ONTAP cannot perform these. List **Standalone vs FCI** explicitly — **do not claim SQL sandbox is complete** after ONTAP steps alone.

Clone name: max 27 chars, `^[a-zA-Z_][a-zA-Z0-9_]*$`. Folder/volume labels use the clone name truncated to 25 characters. Data/log mounts are **folder mount points on existing NetApp iSCSI drives** (`D`–`Z`), not a new drive letter.

| Step | Standalone | FCI |
|---|---|---|
| IQN / igroup | This host only | **Both** nodes |
| `Set-NcLunSignature` | Yes, before map | Yes, before map |
| Disk online / folder mount | On the SQL host | On the **active** node |
| Cluster disk + SQL dependency | Skip | **Required** |
| SQL create / rename / online | Same | Same; use FCI instance or listener |
| Failover | N/A | Clone LUNs in the SQL role and mapped to both nodes |

### Shared Windows disk / mount (Standalone and FCI)

Run on the SQL host; **FCI: active node**. Match cloned LUNs by serial (`NETAPP LUN C-MODE` + `serial` from step 4).

1. Rescan:

```powershell
echo RESCAN | diskpart
```

2. For each cloned disk: clear read-only, online, GPT if RAW:

```powershell
Set-Disk -Number $n -IsReadOnly $false
Set-Disk -Number $n -IsOffline $false
# if PartitionStyle is RAW:
Initialize-Disk -Number $n -PartitionStyle GPT
```

3. Create mount folders (product uses folder mounts, not a new letter):

- Data: `{dataDrive}:\{CloneDbName}-Data-1` (more volumes → `-2`, …)
- Log: `{logDrive}:\{CloneDbName}-Log-1`

4. `New-Item` those directories. Set the volume label to the same name.
5. `Set-Partition -NoDefaultDriveLetter $true`.
6. `Add-PartitionAccessPath` to the folder. Remove any extra `X:\` letter so only the folder path remains.
7. Remove stale junctions under the folder.

### FCI only (after disks are online, `clussvc` running)

On the **active** node. Do **not** run this on Standalone.

1. `Add-ClusterDisk` for each new clone disk if it is not already a cluster resource.
2. Move the disk into the SQL role:

   - Default instance: resource `SQL Server`
   - Named instance: `SQL Server (InstanceName)`

```powershell
Move-ClusterResource -Name $clusterDiskName -Group $sqlGroup
Add-ClusterResourceDependency -Resource $sqlResourceName -Provider $clusterDiskName
```

3. Rename the cluster resource to the volume label (`CloneDbName-Data-1`, etc.).
4. Confirm clone disks are clustered and in the SQL role. FCI cannot use a non-clustered drive.

### Create the clone database (same SQL for both)

Files on the clone LUNs still have the **source** names (`MyDb.mdf` / `MyDb_log.ldf`). Sandbox rename suffix is `-sandbox`.

1. Confirm the clone name does **not** already exist.
2. `CREATE DATABASE` pointing at the **renamed** paths (creates empty files at those names):

```sql
CREATE DATABASE CloneDbName ON
  (NAME = 'MyDb-sandbox.mdf', FILENAME = 'F:\CloneDbName-Data-1\...\MyDb-sandbox.mdf')
LOG ON
  (NAME = 'MyDb_log-sandbox.ldf', FILENAME = 'G:\CloneDbName-Log-1\...\MyDb_log-sandbox.ldf');
```

3. `ALTER DATABASE CloneDbName SET OFFLINE;`
4. Delete the empty `*-sandbox.mdf` / `*-sandbox.ldf` files just created.
5. Rename the cloned source files to those `*-sandbox` names.
6. Grant **FullControl** on the files to the SQL Server service account.
7. `ALTER DATABASE CloneDbName SET ONLINE;`

Optional, to match WLMDB sandbox metadata:

```sql
EXEC sp_addextendedproperty @name = N'tag', @value = N'Development';
EXEC sp_addextendedproperty @name = N'cloned_by', @value = N'netapp_wf';
EXEC sp_addextendedproperty @name = N'source', @value = N'hostname|MSSQLSERVER|SourceDb';
```

Connection: Standalone `host\instance`; FCI **listener / network name**; database = clone name.

### Create-database host follow-up (storage-only create)

After create-database ONTAP steps: IQN/igroup + signature + map (clone steps 6–8), then Windows online/format on the new LUNs, then `CREATE DATABASE` with data/log paths on the new drives. FCI: add disks to the SQL role before `CREATE DATABASE`.

---

## Important

- Storage steps are **ONTAP CLI** (`volume` / `lun` / `igroup`), not Workload Factory `/proxy/v1` REST
- SSH to FSx management (`fsxadmin@management.{fsxId}.fsx.{region}.amazonaws.com`) — **not** CVO `$WORKING_ENV_ID` / `$AGENT_ID`
- Show these CLI and host/SQL steps to the user. Do not run them in this mode
- When SSM becomes available, prefer WLMDB APIs in [create-database.md](create-database.md) and [clone-with-ssm.md](clone-with-ssm.md)
