/* eslint-disable no-useless-escape */

/**
 * ONTAP utility functions for Python scripts (Python 2.7+, functional style).
 *
 * Exports pythonOntapUtilities containing:
 * - make_ontap_config / ontap_request: ONTAP REST API helpers
 * - get_mapped_volumes: Maps Oracle mount points to ONTAP volumes
 * - Supports NFS, iSCSI, and ASM protocols
 *
 * All functions take an ontap_config dict created by make_ontap_config().
 * Used by: oracle-onetimewad.ts
 */

const pythonOntapUtilities = `
# ========================================
# ONTAP REST API Helpers
# ========================================

def can_ping(host, timeout=2):
    """Check if a host is reachable via ICMP ping."""
    try:
        result = subprocess.run(
            ['ping', '-c', '1', '-W', str(timeout), host],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout + 1
        )
        return result.returncode == 0
    except Exception:
        return False


def get_management_ip_from_aws(filesystem_id, region):
    """Resolve FSx filesystem ID to management IP via AWS CLI."""
    try:
        result = subprocess.run(
            ['aws', 'fsx', 'describe-file-systems',
             '--file-system-id', filesystem_id,
             '--region', region,
             '--query',
             'FileSystems[0].OntapConfiguration.Endpoints.'
             'Management.IpAddresses[0]',
             '--output', 'text'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        if result.returncode == 0 and result.stdout:
            output = result.stdout.strip()
            if isinstance(output, binary_type):
                output = output.decode('utf-8')
            if output:
                return output
    except Exception:
        pass
    return ""


def download_certificate(url, cert_path):
    """Download SSL certificate bundle for ONTAP FQDN connections."""
    req = urllib_request.Request(url)

    # Attempt 1: verified download using system CA store
    try:
        if ssl and hasattr(ssl, 'create_default_context'):
            context = ssl.create_default_context()
            response = urllib_request.urlopen(req, context=context, timeout=10)
        else:
            response = urllib_request.urlopen(req, timeout=10)
        with open(cert_path, 'wb') as f:
            f.write(response.read())
        return True
    except Exception as e:
        log_warning("Verified certificate download failed: {}. "
                    "Retrying without verification.".format(e))

    # Attempt 2: unverified fallback (system CA store may be outdated)
    try:
        if ssl:
            if PYTHON3:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
            elif hasattr(ssl, '_create_unverified_context'):
                context = ssl._create_unverified_context()
            else:
                context = None
            if context:
                response = urllib_request.urlopen(req, context=context, timeout=10)
            else:
                response = urllib_request.urlopen(req, timeout=10)
        else:
            response = urllib_request.urlopen(req, timeout=10)
        with open(cert_path, 'wb') as f:
            f.write(response.read())
        log_warning("Certificate bundle downloaded without SSL verification.")
        return True
    except Exception as e:
        log("Failed to download certificate: {}".format(e))
    return False


def resolve_fsx_id_from_cluster(ontap_config):
    """Resolve FSx filesystem ID from ONTAP cluster name (FsxId<hex> -> fs-<hex>).
    Called when storage endpoint is a management IP or FQDN (not an FSx ID).
    Returns resolved fs-<id> string, or None if not an FSx-managed cluster."""
    try:
        cluster_response = ontap_request(ontap_config, "GET", "cluster?fields=name")
        if cluster_response and cluster_response.get("name"):
            cluster_name = cluster_response["name"]
            log("ONTAP cluster name: {}".format(cluster_name))
            # FSx cluster name format: FsxId0d5efc3057c4f12cb -> fs-0d5efc3057c4f12cb
            match = re.match(r'^FsxId([a-fA-F0-9]+)$', cluster_name)
            if match:
                fsx_id = "fs-" + match.group(1)
                log("Resolved FSx file system ID from cluster name: {}".format(fsx_id))
                return fsx_id
            else:
                log_warning("Cluster name '{}' does not match expected FsxId format".format(cluster_name))
        else:
            log_warning("Could not retrieve cluster name from ONTAP API")
    except Exception as e:
        log_warning("Could not resolve FSx ID from cluster: {}".format(e))
    return None


def make_ontap_config(filesystem_id, region, username, password):
    """Build ONTAP config dict and resolve management endpoint."""
    config = {
        "filesystem_id": filesystem_id,
        "region": region,
        "username": username,
        "password": password,
        "management_ip": None,
        "cert_path": None,
        "use_insecure": False,
        "_svm_cache": {}
    }

    endpoint = filesystem_id
    is_ip = bool(re.match(r'^\\d+\\.\\d+\\.\\d+\\.\\d+$', endpoint))
    is_fsx_id = endpoint.startswith('fs-')

    if is_ip:
        log("Storage endpoint is an IP address: {}".format(endpoint))
        config["management_ip"] = endpoint
        config["use_insecure"] = True
    elif is_fsx_id:
        fqdn = "management.{}.fsx.{}.amazonaws.com".format(
            endpoint, region)
        log("Storage endpoint is FSx ID: {} -> trying FQDN: {}".format(
            endpoint, fqdn))
        try:
            socket.gethostbyname(fqdn)
            config["management_ip"] = fqdn
            log("DNS resolution succeeded for {}".format(fqdn))
        except socket.gaierror:
            log("DNS resolution failed for {}, trying AWS CLI fallback...".format(fqdn))
            mgmt_ip = get_management_ip_from_aws(filesystem_id, region)
            config["management_ip"] = mgmt_ip or fqdn
            config["use_insecure"] = True
            if not mgmt_ip:
                log_warning("Could not resolve FSx ID {}. AWS CLI fallback also failed.".format(endpoint))
    else:
        log("Storage endpoint is FQDN/hostname: {}".format(endpoint))
        config["management_ip"] = endpoint
        config["use_insecure"] = True

    log("ONTAP management endpoint resolved to: {}".format(config["management_ip"]))

    # Setup certificate for public networks (only when using FQDN, not IP)
    if not config["use_insecure"] and can_ping("1.1.1.1"):
        cert_url = ("https://fsx-aws-certificates.s3.amazonaws.com/"
                   "bundle-{}.pem").format(region)
        config["cert_path"] = "/tmp/fsx_bundle.pem"
        if not os.path.exists(config["cert_path"]):
            if not download_certificate(cert_url, config["cert_path"]):
                config["use_insecure"] = True
    else:
        config["use_insecure"] = True

    if config["use_insecure"]:
        log_warning(
            "SSL certificate verification is disabled for ONTAP API "
            "connections. This is expected for IP-based or private "
            "network endpoints."
        )

    return config


def ontap_request(config, method, endpoint, body=None):
    """Execute an ONTAP REST API request using the config dict."""
    auth_string = "{}:{}".format(config["username"], config["password"])
    if PYTHON3:
        auth_bytes = base64.b64encode(auth_string.encode()).decode()
    else:
        auth_bytes = base64.b64encode(auth_string)

    url = "https://{}/api/{}".format(config["management_ip"], endpoint)
    headers = {
        "Authorization": "Basic {}".format(auth_bytes),
        "Content-Type": "application/json"
    }

    log("ONTAP API request: {} {}".format(method, endpoint))

    if body:
        data = json.dumps(body).encode() if PYTHON3 else json.dumps(body)
    else:
        data = None

    if PYTHON3:
        req = urllib_request.Request(url, data=data, headers=headers,
                                     method=method)
        if config["use_insecure"] and ssl:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        elif ssl:
            context = ssl.create_default_context()
            if config["cert_path"] and os.path.exists(config["cert_path"]):
                context.load_verify_locations(config["cert_path"])
        else:
            context = None

        try:
            if context:
                response = urllib_request.urlopen(req, context=context,
                                                  timeout=30)
            else:
                response = urllib_request.urlopen(req, timeout=30)
            response_data = response.read()
            if isinstance(response_data, binary_type):
                response_data = response_data.decode('utf-8')
            return json.loads(response_data)
        except urllib_error.HTTPError as e:
            log("HTTP Error: {} {}".format(e.code, e.reason))
            raise
        except Exception as e:
            log("Request failed: {}".format(e))
            raise
    else:
        # Python 2.7
        req = urllib_request.Request(url, data=data, headers=headers)
        req.get_method = lambda: method.upper()
        try:
            # Build SSL context for Python 2.7+ (which added ssl.create_default_context)
            context = None
            if ssl:
                if config["use_insecure"] and hasattr(ssl, '_create_unverified_context'):
                    context = ssl._create_unverified_context()
                elif config["cert_path"] and os.path.exists(config["cert_path"]) and hasattr(ssl, 'create_default_context'):
                    context = ssl.create_default_context()
                    context.load_verify_locations(config["cert_path"])
            if context:
                response = urllib_request.urlopen(req, context=context, timeout=30)
            else:
                response = urllib_request.urlopen(req, timeout=30)
            return json.loads(response.read())
        except urllib_error.HTTPError as e:
            log("HTTP Error: {} {}".format(e.code, e.reason))
            raise
        except Exception as e:
            log("Request failed: {}".format(e))
            raise


# ========================================
# Mapped ONTAP Volumes Functions
# Maps Oracle mount points to ONTAP volumes via NFS junction paths
# or iSCSI LUN serials.
# ========================================

def find_svm_by_ip(ontap_config, ip_address):
    """Look up SVM name/uuid for the given IP. Uses ontap_config._svm_cache."""
    cache = ontap_config["_svm_cache"]
    if ip_address in cache:
        cached = cache[ip_address]
        log("  SVM cache hit for {}: {}".format(ip_address, cached))
        return cached

    # If cache is empty, this is the first call - build the complete map
    if not cache:
        log("  Building complete IP-to-SVM mapping cache (first call)")
        response = ontap_request(ontap_config, 'GET',
                                 'svm/svms?fields=ip_interfaces')

        svms = response.get('records', [])
        if not svms:
            log_warning("  ONTAP returned 0 SVMs - check FSx credentials and connectivity")
            return (None, None)

        # Log all available SVMs and their IPs for diagnostics
        all_ips = []
        for svm in svms:
            svm_name = svm.get('name', 'unknown')
            svm_uuid = svm.get('uuid')
            for interface in svm.get('ip_interfaces', []):
                ip_info = interface.get('ip', {})
                iface_ip = ip_info.get('address', '')
                iface_name = interface.get('name', '')
                if iface_ip:  # Only cache non-empty IPs
                    # Prefer nfs_smb_management_1 interface if it exists
                    is_preferred = (interface.get('name') == 'nfs_smb_management_1')
                    # If this IP is already cached, only overwrite if this is a preferred interface
                    if iface_ip not in cache or is_preferred:
                        cache[iface_ip] = (svm_name, svm_uuid)
                    all_ips.append("{}({}/{})".format(iface_ip, svm_name, iface_name))
        
        log("  Available SVM IPs: {}".format(", ".join(all_ips) if all_ips else "none"))
        log("  Cached {} IP-to-SVM mappings".format(len(cache)))
    
    # Now check the cache again for the requested IP
    if ip_address in cache:
        result = cache[ip_address]
        log("  SVM found in cache for {}: {}".format(ip_address, result))
        return result
    
    log_warning("  IP {} not found in any SVM interface. Mount IP may differ from ONTAP LIF IP.".format(ip_address))
    return (None, None)


def get_nfs_volume_mapping(ontap_config, mount_ip, junction_path,
                            is_asm_managed, disk_name, disk_group):
    """Map an NFS mount to its ONTAP volume via SVM lookup + junction path."""
    svm_name, svm_id = find_svm_by_ip(ontap_config, mount_ip)
    if not svm_name:
        log_warning("  SVM lookup FAILED for IP: {} - no SVM has this IP in its interfaces".format(mount_ip))
        return None

    log("  SVM found: name={}, uuid={}".format(svm_name, svm_id))

    endpoint = "storage/volumes?svm.name={}&nas.path={}".format(
        svm_name, junction_path)
    log("  ONTAP query: GET /api/{}".format(endpoint))
    response = ontap_request(ontap_config, 'GET', endpoint)

    records = response.get('records', [])
    if not records:
        log_warning("  No volume found for SVM={}, junction_path={}. "
            "Check if the volume junction path matches exactly.".format(
                svm_name, junction_path))
        return None

    volume = records[0]
    volume_entry = {
        "volumeName": volume.get('name'),
        "volumeId": volume.get('uuid'),
        "svmName": svm_name,
        "svmId": svm_id,
        "copiesCount": 0
    }

    if is_asm_managed:
        if disk_name:
            volume_entry["diskName"] = disk_name
        if disk_group:
            volume_entry["diskGroup"] = disk_group

    log("  Mapped volume: {} (uuid={})".format(
        volume_entry.get('volumeName'), volume_entry.get('volumeId')))
    return volume_entry


def get_iscsi_volume_mapping(ontap_config, serial_number, lun_records,
                              is_asm_managed, disk_name, disk_group):
    """Map an iSCSI serial number to its ONTAP LUN/volume."""
    encoded_serial = url_encode(serial_number)
    endpoint = ("storage/luns?serial_number={}&fields=uuid,name,"
               "svm.name,svm.uuid,location.volume.name,"
               "location.volume.uuid").format(encoded_serial)
    response = ontap_request(ontap_config, 'GET', endpoint)

    records = response.get('records', [])
    if not records:
        log("No LUN found for serial: {}".format(serial_number))
        return None

    lun = records[0]
    svm = lun.get('svm', {})
    location = lun.get('location', {})
    volume = location.get('volume', {})

    volume_entry = {
        "volumeName": volume.get('name'),
        "volumeId": volume.get('uuid'),
        "svmName": svm.get('name'),
        "svmId": svm.get('uuid'),
        "lunName": lun.get('name'),
        "lunId": lun.get('uuid'),
        "copiesCount": 0
    }

    lun_exists = any(lr.get('serial') == serial_number
                    for lr in lun_records)
    if not lun_exists:
        lun_records.append({
            "name": lun.get('name'),
            "serial": serial_number
        })

    if is_asm_managed:
        if disk_name:
            volume_entry["diskName"] = disk_name
        if disk_group:
            volume_entry["diskGroup"] = disk_group

    log("Found iSCSI volume mapping: {}".format(volume_entry))
    return volume_entry


def get_volume_mapping(ontap_config, mount, lun_records):
    """Route a single mount entry to NFS or iSCSI volume lookup."""
    mount_ip = mount.get("mountIP", "")
    mount_point = mount.get("mountPoint", "")
    protocol = mount.get("protocol", "NFS")
    is_asm_managed = mount.get("isAsmManaged", False)
    disk_name = mount.get("diskName")
    disk_group = mount.get("diskGroup")

    log("  Volume mapping: IP={}, JunctionPath={}, Protocol={}".format(
        mount_ip, mount_point, protocol))

    try:
        if protocol == "iSCSI":
            return get_iscsi_volume_mapping(
                ontap_config, mount_point, lun_records,
                is_asm_managed, disk_name, disk_group)
        else:
            return get_nfs_volume_mapping(
                ontap_config, mount_ip, mount_point,
                is_asm_managed, disk_name, disk_group)
    except Exception as e:
        log_warning("  ONTAP API error for {}:{} - {}".format(mount_ip, mount_point, e))
        return None


def extract_protocol(ontap_volumes):
    """Determine protocol from mapped volume entries."""
    for file_type, volumes in ontap_volumes.items():
        for vol in volumes:
            if vol.get('lunName'):
                return "iSCSI"
    return "NFS"


def process_mount_details(ontap_config, mount_details, lun_records):
    """Map each file type's mount points to ONTAP volumes."""
    ontap_volumes = {}
    for file_type in FILE_TYPES:
        mounts = mount_details.get(file_type, [])
        file_type_volumes = []
        for mount in mounts:
            entry = get_volume_mapping(ontap_config, mount, lun_records)
            if entry:
                entry["copiesCount"] = mount.get("copiesCount", 0)
                file_type_volumes.append(entry)
        ontap_volumes[file_type] = file_type_volumes
    return ontap_volumes


def get_mapped_volumes(ontap_config, oracle_sid, mount_point_data):
    """Map Oracle mount points to ONTAP volumes for the given SID."""
    log("Starting mapped ONTAP volumes collection")

    lun_records = []
    protocol = ""
    is_asm_managed = mount_point_data.get("isASMManaged", False)
    is_cdb = mount_point_data.get("isCDB", False)
    volume_mappings = []

    if not is_cdb:
        ontap_volumes = process_mount_details(
            ontap_config,
            mount_point_data.get("mountDetails", {}),
            lun_records)
        if not protocol and ontap_volumes:
            protocol = extract_protocol(ontap_volumes)
        volume_mappings.append({
            oracle_sid: {"isCDB": False, "ontapVolumes": ontap_volumes}
        })
    else:
        pdb_volumes = {}
        for pdb_name, pdb_mounts in mount_point_data.get("pdbMountDetails", {}).items():
            log("Processing PDB: {}".format(pdb_name))
            pdb_ontap_volumes = process_mount_details(
                ontap_config, pdb_mounts, lun_records)
            if not protocol and pdb_ontap_volumes:
                protocol = extract_protocol(pdb_ontap_volumes)
            pdb_volumes[pdb_name] = pdb_ontap_volumes
        volume_mappings.append({
            oracle_sid: {"isCDB": True, "ontapVolumes": pdb_volumes}
        })

    result = {
        "protocol": protocol,
        "lunRecords": lun_records,
        "isASMManaged": is_asm_managed,
        "volumeMappings": volume_mappings
    }

    log("Mapped volumes collection completed: protocol={}, "
        "volumeMappings={}, lunRecords={}".format(
            protocol, len(volume_mappings), len(lun_records)))

    return result
`;

export { pythonOntapUtilities };
