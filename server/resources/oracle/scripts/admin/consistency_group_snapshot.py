#!/usr/bin/env python3
# Find-or-create an ONTAP consistency group over the volumes backing an
# Oracle SID's DATA_FILES/CONTROL_FILES/REDO_LOGS/ARCHIVE_LOGS, then take a
# crash-consistent group snapshot. Run this AFTER mapped_ontap_volumes.py has
# resolved SVM_NAME/FILESYSTEM_ID/VOLUME_NAMES for the SID.
#
# Mutating (creates a consistency group and/or a snapshot on FSx for ONTAP).
#
# Required env: ORACLE_SID, REGION, FILESYSTEM_ID, SVM_NAME, RETENTION_LABEL,
#               VOLUME_NAMES (comma-separated volume names),
#               VOLUME_FILE_TYPES_JSON (JSON map: {"vol_name": "DATA_FILES", ...}),
#               CG_NAME (consistency group name to find-or-create)
# Optional env: FSX_USERNAME, FSX_PASSWORD (falls back to the
#               /netapp/wlmdb/<filesystemId> SSM parameter if unset)
#
# Output (stdout, single line of JSON):
#   {"status":"ok","consistencyGroupUuid":...,"consistencyGroupCreated":bool,
#    "groupSnapshotUuid":...,"memberSnapshots":[{"volumeUuid":...,"volumeName":...,
#    "snapshotName":...,"fileType":...}, ...],"retentionLabel":...}
#   {"status":"need_input","need":"fsxCredentials",...}
#   {"status":"error","error":...}
#
# See ../../references/ontap-consistency-groups.md and
# ../../references/confirmation-and-results.md for the confirmation gates
# this must pass before being sent with --apply.

from __future__ import print_function, unicode_literals

import os
import re
import sys
import json
import base64
import socket
import subprocess
import logging
import datetime
import time
from collections import namedtuple

# Python 2/3 compatible imports
try:
    # Python 3
    from urllib.parse import quote as url_encode
    import urllib.request as urllib_request
    import urllib.error as urllib_error
    import ssl
    PYTHON3 = True
except ImportError:
    # Python 2.7
    from urllib import quote as url_encode
    import urllib2 as urllib_request
    import urllib2 as urllib_error
    try:
        import ssl
    except ImportError:
        ssl = None
    PYTHON3 = False

# String/bytes compatibility
if PYTHON3:
    string_types = str
    text_type = str
    binary_type = bytes
else:
    string_types = basestring
    text_type = unicode
    binary_type = str

# Subprocess compatibility for Python 2.7
if not PYTHON3:
    # Create DEVNULL constant for Python 2.7
    try:
        subprocess.DEVNULL
    except AttributeError:
        subprocess.DEVNULL = open(os.devnull, 'w')


import shutil
aws_path = shutil.which("aws") or "/usr/local/bin/aws"


# ========================================
# Logging Setup
# ========================================
LOG_FILE = os.path.join(os.getcwd(), "oracle_snapshot.log")

def setup_logging():
    # Create root logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers
    logger.handlers = []
    
    # File handler - DEBUG and above (all levels)
    try:
        file_handler = logging.FileHandler(LOG_FILE)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '[%(levelname)s %(asctime)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    except (OSError, IOError):
        pass  # Continue without file logging if can't write
logger = logging.getLogger(__name__)

def log(message):
    # type: (str) -> None
    logger.debug(message)

def log_info(message):
    # type: (str) -> None
    logger.info(message)

def log_error(message):
    # type: (str) -> None
    logger.error(message)

def log_warning(message):
    # type: (str) -> None
    logger.warning(message)


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
    is_ip = bool(re.match(r'^\d+\.\d+\.\d+\.\d+$', endpoint))
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
        if region.startswith("us-gov-"):
            cert_url = ("https://fsx-aws-us-gov-certificates.s3.us-gov-west-1.amazonaws.com/"
                           "bundle-{}.pem").format(region)
        else:
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


# ONTAP caps return_timeout at 120s.
ONTAP_RETURN_TIMEOUT = 120
# Socket timeout must outlast return_timeout: a POST carrying return_timeout asks ONTAP to hold
# the connection open until the snapshot/clone finishes, so a client timeout at/below 120s
# aborts the read while the job is still running server-side — the job then completes and
# leaves a snapshot or clone behind that the script has already reported as failed. The margin
# covers TLS setup plus ONTAP's own response overhead past the return_timeout deadline.
# ponytail: one timeout for every call instead of a per-request argument. Ceiling: a genuinely
# unreachable management IP now takes HTTP_TIMEOUT rather than 30s to fail, including on the
# read-only GETs that never need the longer budget. Losing track of a created snapshot is the
# worse failure, and the SSM command timeout still bounds the run. Upgrade path: add a
# timeout=None parameter and pass the long budget only on the POSTs that set return_timeout.
HTTP_TIMEOUT = ONTAP_RETURN_TIMEOUT + 30


def ontap_request(config, method, endpoint, body=None):
    """Execute an ONTAP REST API request using the config dict.
    Reads are bounded by HTTP_TIMEOUT, which must stay > ONTAP_RETURN_TIMEOUT (see above)."""
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
                                                  timeout=HTTP_TIMEOUT)
            else:
                response = urllib_request.urlopen(req, timeout=HTTP_TIMEOUT)
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
                response = urllib_request.urlopen(req, context=context, timeout=HTTP_TIMEOUT)
            else:
                response = urllib_request.urlopen(req, timeout=HTTP_TIMEOUT)
            return json.loads(response.read())
        except urllib_error.HTTPError as e:
            log("HTTP Error: {} {}".format(e.code, e.reason))
            raise
        except Exception as e:
            log("Request failed: {}".format(e))
            raise


def wait_for_ontap_job(ontap_config, job_uuid, timeout=900, interval=10):
    """Poll cluster/jobs/<uuid> until it reaches a terminal state.
    Returns (ok, job_response_or_error_dict)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = ontap_request(ontap_config, "GET", "cluster/jobs/{}".format(job_uuid))
        except Exception as e:
            log("Job poll failed for {}: {}".format(job_uuid, e))
            return False, {"error": "job poll failed for {}: {}".format(job_uuid, e)}
        state = (resp or {}).get("state")
        log("Job {} state: {}".format(job_uuid, state))
        if state == "success":
            return True, resp
        if state == "failure":
            return False, resp
        time.sleep(interval)
    return False, {"error": "timed out waiting for job {}".format(job_uuid)}


def resolve_created_uuid(ontap_config, response, lookup_endpoint, description):
    """Return (uuid, error) for a mutating POST, covering both shapes ONTAP answers with:
    synchronous records[], or HTTP 202 + a job (return_timeout asks ONTAP to finish inline
    but it can still hand back a job). On the async path the job only reports completion,
    so the object is looked up by name via lookup_endpoint to get its uuid.
    Kept in sync with the copy in flexclone_create.py."""
    records = (response or {}).get("records") or []
    if records and records[0].get("uuid"):
        return records[0]["uuid"], None

    job_uuid = ((response or {}).get("job") or {}).get("uuid")
    if not job_uuid:
        return None, "{} returned neither records nor a job: {}".format(
            description, json.dumps(response))

    ok, job_info = wait_for_ontap_job(ontap_config, job_uuid)
    if not ok:
        return None, "{} job {} did not succeed: {}".format(
            description, job_uuid, json.dumps(job_info))

    try:
        lookup = ontap_request(ontap_config, "GET", lookup_endpoint)
    except Exception as e:
        return None, "{} job {} succeeded but the follow-up lookup failed: {}".format(
            description, job_uuid, e)

    lookup_records = (lookup or {}).get("records") or []
    if not lookup_records or not lookup_records[0].get("uuid"):
        return None, "{} job {} succeeded but lookup returned no record".format(
            description, job_uuid)
    return lookup_records[0]["uuid"], None


def pick_matching_cg_uuid(records, volume_names):
    """Return the uuid of the consistency-group record whose volumes[].name set is
    EXACTLY volume_names, or None if no record matches. Never reuse a CG that is
    missing a required volume or carries an unrelated extra one."""
    target_volume_set = set(volume_names)
    for record in records:
        record_volume_set = {v.get("name") for v in record.get("volumes", [])}
        if record_volume_set == target_volume_set:
            return record.get("uuid")
    return None


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
        "junctionPath": junction_path,
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
        "lunPath": lun.get('name'),
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


def getFsxCredentials(fileSystemId):
    name = f"/netapp/wlmdb/{fileSystemId}"
    try:
        raw = subprocess.check_output(
            [aws_path,"ssm","get-parameter","--name",name,"--with-decryption","--query","Parameter.Value","--output","text"],
            universal_newlines=True
        ).strip()
    except Exception as e:
        log(f"Failed to get FSx credentials: SSM param {name} not found or empty. Exception: {e}")
        return None, f"SSM param {name} not found or empty: {e}"

    txt = re.sub(r"'", '"', raw)
    txt = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', txt)
    try:
        creds = json.loads(txt)
    except Exception:
        log(f"Failed to parse FSx credentials JSON for {fileSystemId}")
        return None, f"Failed to parse FSx credentials for {fileSystemId}"

    return creds.get("fsx"), None

import warnings
warnings.filterwarnings("ignore")  # a stray DeprecationWarning on stdout/stderr can corrupt the JSON envelope

setup_logging()

REQUIRED_ENV = ["ORACLE_SID", "FILESYSTEM_ID", "REGION", "SVM_NAME", "RETENTION_LABEL",
                "VOLUME_NAMES", "VOLUME_FILE_TYPES_JSON", "CG_NAME"]
missing_env = [name for name in REQUIRED_ENV if not os.environ.get(name)]
if missing_env:
    print(json.dumps({"status": "error", "error": "missing required env: {}".format(", ".join(missing_env))}))
    sys.exit(0)

oracle_sid = os.environ["ORACLE_SID"]
filesystem_id = os.environ["FILESYSTEM_ID"]
region = os.environ["REGION"]
svm_name = os.environ["SVM_NAME"]
retention_label = os.environ["RETENTION_LABEL"]
volume_names = os.environ["VOLUME_NAMES"].split(",")
volume_file_types = json.loads(os.environ["VOLUME_FILE_TYPES_JSON"])
cg_name = os.environ["CG_NAME"]

fsx_username = os.environ.get("FSX_USERNAME")
fsx_password = os.environ.get("FSX_PASSWORD")
if not fsx_username or not fsx_password:
    fsx_creds, fsx_cred_error = getFsxCredentials(filesystem_id)
    if fsx_creds:
        fsx_username = fsx_creds.get("username")
        fsx_password = fsx_creds.get("password")
    if not fsx_username or not fsx_password:
        print(json.dumps({"status": "need_input", "need": "fsxCredentials", "hint": fsx_cred_error}))
        sys.exit(0)

ontap_config = make_ontap_config(filesystem_id, region, fsx_username, fsx_password)

existing_cg = ontap_request(ontap_config, "GET", "application/consistency-groups?svm.name={}&fields=volumes".format(svm_name))
cg_uuid = pick_matching_cg_uuid(existing_cg.get("records", []), volume_names)
cg_created = False

if not cg_uuid:
    volumes_payload = [{"name": v, "provisioning_options": {"action": "add"}} for v in volume_names]
    create_body = {"svm": {"name": svm_name}, "name": cg_name, "volumes": volumes_payload}
    create_resp = ontap_request(ontap_config, "POST", "application/consistency-groups?return_records=true&return_timeout={}".format(ONTAP_RETURN_TIMEOUT), create_body)
    cg_created = True
    cg_uuid, cg_error = resolve_created_uuid(
        ontap_config, create_resp,
        "application/consistency-groups?svm.name={}&name={}".format(url_encode(svm_name), url_encode(cg_name)),
        "consistency group create")
    if not cg_uuid:
        print(json.dumps({"status": "error", "error": cg_error}))
        sys.exit(0)

snapshot_name = "wlmdb_{}_{}_{}".format(oracle_sid, retention_label, datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
snap_body = {"name": snapshot_name, "consistency_type": "crash", "comment": retention_label}
try:
    snap_resp = ontap_request(ontap_config, "POST", "application/consistency-groups/{}/snapshots?return_records=true&return_timeout={}".format(cg_uuid, ONTAP_RETURN_TIMEOUT), snap_body)
except urllib_error.HTTPError as e:
    try:
        err_body = e.read().decode("utf-8", errors="replace")
    except Exception:
        err_body = str(e)
    print(json.dumps({"status": "error", "error": "HTTP {} creating group snapshot: {}".format(e.code, err_body), "consistencyGroupUuid": cg_uuid, "consistencyGroupCreated": cg_created}))
    sys.exit(0)
except Exception as e:
    print(json.dumps({"status": "error", "error": "failed to create group snapshot: {}".format(e), "consistencyGroupUuid": cg_uuid, "consistencyGroupCreated": cg_created}))
    sys.exit(0)

group_snapshot_uuid, snap_error = resolve_created_uuid(
    ontap_config, snap_resp,
    "application/consistency-groups/{}/snapshots?name={}".format(cg_uuid, url_encode(snapshot_name)),
    "group snapshot create")
if not group_snapshot_uuid:
    print(json.dumps({"status": "error", "error": snap_error, "consistencyGroupUuid": cg_uuid, "consistencyGroupCreated": cg_created}))
    sys.exit(0)

# fields=** is required — without it ONTAP omits the nested snapshot_volumes
# array and memberSnapshots below comes back empty even though the snapshot
# itself succeeded (see references/ontap-consistency-groups.md).
snap_detail = ontap_request(ontap_config, "GET", "application/consistency-groups/{}/snapshots/{}?fields=**".format(cg_uuid, group_snapshot_uuid))
member_snapshots = []
for sv in snap_detail.get("snapshot_volumes", []):
    vol = sv.get("volume", {})
    snap = sv.get("snapshot", {})
    vol_name = vol.get("name")
    # A single physical volume can back more than one file-type role (e.g. DATA_FILES
    # and CONTROL_FILES sharing a volume) — VOLUME_FILE_TYPES_JSON maps volume name to
    # either one role (string) or several (list); emit one memberSnapshots entry per role.
    file_types = volume_file_types.get(vol_name, "UNKNOWN")
    if isinstance(file_types, str):
        file_types = [file_types]
    for file_type in file_types:
        member_snapshots.append({
            "volumeUuid": vol.get("uuid"),
            "volumeName": vol_name,
            "snapshotName": snap.get("name"),
            "fileType": file_type
        })

print(json.dumps({
    "status": "ok",
    "consistencyGroupUuid": cg_uuid,
    "consistencyGroupCreated": cg_created,
    "groupSnapshotUuid": group_snapshot_uuid,
    "memberSnapshots": member_snapshots,
    "retentionLabel": retention_label
}))
