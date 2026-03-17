/* eslint-disable no-useless-escape */

/**
 * Storage configuration collection functions for Oracle assessment (Python 2.7+).
 *
 * Exports pythonStorageConfigFunctions containing:
 * - get_volume_configuration: ONTAP volume config (autosize, tiering, efficiency, snapshots)
 * - get_lun_configuration: LUN configuration for iSCSI
 * - get_nfs_configuration: NFS protocol settings (v4 domain, rootonly)
 *
 * All functions take an ontap_config dict from make_ontap_config().
 */

const pythonStorageConfigFunctions = `
# ========================================
# Storage Configuration Functions
# ========================================

def get_volume_configuration(ontap_config, volume_uuids, volume_names):
    """Collect ONTAP volume config (autosize, tiering, efficiency, snapshots)."""
    result = {"error": None, "data": []}

    if not volume_uuids:
        result["error"] = "No volume UUIDs provided"
        return result

    uuid_filter = "|".join(volume_uuids)
    fields = ("svm,nas.path,autosize,space.fractional_reserve,"
              "space.snapshot.reserve_percent,"
              "space.snapshot.autodelete.enabled,"
              "space.snapshot.autodelete.delete_order,"
              "snapshot_policy,tiering,guarantee,efficiency")
    endpoint = "storage/volumes?uuid={}&fields={}".format(uuid_filter, fields)

    log_info("Fetching volume configuration for {} volumes...".format(
        len(volume_uuids)))

    try:
        response = ontap_request(ontap_config, 'GET', endpoint)
    except Exception as e:
        result["error"] = str(e)
        return result

    records = response.get("records", [])
    if not records:
        result["error"] = "No volume records found"
        return result

    # Get space-mgmt-try-first from private CLI
    space_mgmt_lookup = {}
    if volume_names:
        try:
            name_filter = "|".join(volume_names)
            private_endpoint = ("private/cli/volume?volume={}"
                "&fields=space-mgmt-try-first").format(name_filter)
            private_response = ontap_request(ontap_config, 'GET',
                                             private_endpoint)
            if private_response.get("records"):
                for rec in private_response["records"]:
                    vol_name = rec.get("volume", "")
                    space_mgmt_lookup[vol_name] = rec.get(
                        "space_mgmt_try_first")
        except Exception as e:
            log_info("Warning: Could not fetch space-mgmt-try-first: "
                     "{}".format(e))

    # Transform records
    for vol in records:
        autosize = vol.get("autosize", {})
        space = vol.get("space", {})
        snapshot = space.get("snapshot", {})
        autodelete = snapshot.get("autodelete", {})
        tiering = vol.get("tiering", {})
        guarantee = vol.get("guarantee", {})
        efficiency = vol.get("efficiency", {})

        result["data"].append({
            "name": vol.get("name"),
            "uuid": vol.get("uuid"),
            "thinProvision": guarantee.get("honored"),
            "spaceGuarantee": guarantee.get("type"),
            "autosizeMode": autosize.get("mode"),
            "autosize": "on" if autosize.get("mode") != "off" else "off",
            "fractionalReserve": space.get("fractional_reserve"),
            "snapshotCopyReserve": snapshot.get("reserve_percent"),
            "snapshotAutodelete": autodelete.get("enabled"),
            "snapshotPolicy": vol.get("snapshot_policy", {}).get("name"),
            "tieringPolicy": tiering.get("policy"),
            "tieringMinCoolingDays": tiering.get("min_cooling_days"),
            "svmName": vol.get("svm", {}).get("name"),
            "compression": efficiency.get("compression"),
            "compressionType": efficiency.get("compression_type"),
            "compaction": efficiency.get("compaction"),
            "deduplication": efficiency.get("dedupe"),
            "efficiencyType": efficiency.get("storage_efficiency_mode"),
            "snapshotDeleteOrder": autodelete.get("delete_order"),
            "spaceMgmtTryFirst": space_mgmt_lookup.get(vol.get("name")),
            "junctionPath": vol.get("nas", {}).get("path"),
        })

    log_info("Successfully collected configuration for {} volumes".format(
        len(result["data"])))
    return result


def get_lun_configuration(ontap_config, lun_uuids):
    """Collect LUN configuration for iSCSI volumes."""
    result = {"error": None, "data": []}

    if not lun_uuids:
        result["error"] = "LUNs not applicable"
        return result

    uuid_filter = "|".join(lun_uuids)
    fields = ("space.guarantee.requested,"
              "space.scsi_thin_provisioning_support_enabled,os_type")
    endpoint = "storage/luns?uuid={}&fields={}".format(uuid_filter, fields)

    log_info("Fetching LUN configuration for {} LUNs...".format(
        len(lun_uuids)))

    try:
        response = ontap_request(ontap_config, 'GET', endpoint)
    except Exception as e:
        result["error"] = str(e)
        return result

    records = response.get("records", [])
    if not records:
        result["error"] = "No LUN records found"
        return result

    for lun in records:
        space = lun.get("space", {})
        guarantee = space.get("guarantee", {})
        result["data"].append({
            "name": lun.get("name"),
            "uuid": lun.get("uuid"),
            "osType": lun.get("os_type"),
            "spaceReservationEnabled": guarantee.get("requested"),
            "spaceAllocationAllocated": space.get(
                "scsi_thin_provisioning_support_enabled")
        })

    log_info("Successfully collected configuration for {} LUNs".format(
        len(result["data"])))
    return result


def get_nfs_configuration(ontap_config, svm_uuids, svm_names):
    """Collect NFS protocol settings (v4 domain, rootonly)."""
    result = {
        "nfsProtocol": {"error": None, "data": {}},
        "nfsRootonly": []
    }

    if not svm_uuids:
        result["nfsProtocol"]["error"] = "NFS protocol not applicable"
        return result

    # NFS service configuration
    try:
        uuid_filter = "|".join(svm_uuids)
        fields = ("protocol.v4_id_domain,protocol.v40_enabled,"
                  "protocol.v41_enabled")
        endpoint = ("protocols/nfs/services?svm.uuid={}"
                    "&fields={}").format(uuid_filter, fields)

        log_info("Fetching NFS protocol configuration...")
        response = ontap_request(ontap_config, 'GET', endpoint)

        records = response.get("records", [])
        if records:
            protocol = records[0].get("protocol", {})
            result["nfsProtocol"]["data"] = {
                "v4IdDomain": protocol.get("v4_id_domain"),
                "v40Enabled": protocol.get("v40_enabled"),
                "v41Enabled": protocol.get("v41_enabled")
            }
    except Exception as e:
        result["nfsProtocol"]["error"] = str(e)

    # NFS rootonly configuration
    if svm_names:
        try:
            name_filter = "|".join(svm_names)
            endpoint = ("private/cli/vserver/nfs?vserver={}"
                        "&fields=nfs_rootonly").format(name_filter)

            log_info("Fetching NFS rootonly configuration...")
            rootonly_response = ontap_request(ontap_config, 'GET', endpoint)

            if rootonly_response.get("records"):
                for rec in rootonly_response["records"]:
                    result["nfsRootonly"].append({
                        "svmName": rec.get("vserver"),
                        "nfsRootonly": rec.get("nfs_rootonly")
                    })
        except Exception as e:
            log_info("Warning: Could not fetch NFS rootonly: {}".format(e))

    return result
`;

export { pythonStorageConfigFunctions };
