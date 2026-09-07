#!/usr/bin/env python3
# Create ONE FlexClone volume from a member snapshot captured by
# consistency_group_snapshot.py. Per ../../references/ontap-consistency-groups.md
# step 3, the agent runs this once per memberSnapshots entry (data, control,
# redo, archive) — never omit one, and never mix a data-file clone from one
# snapshot with a redo-log clone from another.
#
# Mutating (creates a new volume on FSx for ONTAP). The ONTAP request/config
# helpers below are shared verbatim with consistency_group_snapshot.py and
# mapped_ontap_volumes.py — fix bugs in all three if you fix one here.
#
# Required env: REGION, FILESYSTEM_ID, SVM_NAME, CLONE_NAME, PARENT_VOLUME,
#               PARENT_SNAPSHOT
# Optional env: FSX_USERNAME, FSX_PASSWORD (falls back to the
#               /netapp/wlmdb/<filesystemId> SSM parameter if unset)
#
# Output (stdout, single line of JSON):
#   {"status":"ok","cloneVolumeName":...,"cloneVolumeUuid":...,
#    "parentVolume":...,"parentSnapshot":...}
#   {"status":"need_input","need":"fsxCredentials",...}
#   {"status":"error","error":...}

from __future__ import print_function, unicode_literals

import os
import re
import sys
import json
import base64
import socket
import subprocess
import logging
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
LOG_FILE = os.path.join(os.getcwd(), "oracle_flexclone.log")

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


ONTAP_RETURN_TIMEOUT = 120
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
    Kept in sync with the copy in consistency_group_snapshot.py."""
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

REQUIRED_ENV = ["REGION", "FILESYSTEM_ID", "SVM_NAME", "CLONE_NAME", "PARENT_VOLUME", "PARENT_SNAPSHOT"]
missing_env = [name for name in REQUIRED_ENV if not os.environ.get(name)]
if missing_env:
    print(json.dumps({"status": "error", "error": "missing required env: {}".format(", ".join(missing_env))}))
    sys.exit(0)

region = os.environ["REGION"]
filesystem_id = os.environ["FILESYSTEM_ID"]
svm_name = os.environ["SVM_NAME"]
clone_name = os.environ["CLONE_NAME"]
parent_volume = os.environ["PARENT_VOLUME"]
parent_snapshot = os.environ["PARENT_SNAPSHOT"]

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

clone_body = {
    "name": clone_name,
    "svm": {"name": svm_name},
    # clone_attach_nfs.sh mounts "${SVM_DATA_LIF}:/${clone_volume_name}" — junction
    # path must match that literally, or ONTAP leaves the clone unjunctioned and
    # the NFS mount fails even though the clone itself was created successfully.
    "nas": {"path": "/{}".format(clone_name)},
    "clone": {
        "is_flexclone": True,
        "parent_volume": {"name": parent_volume},
        "parent_snapshot": {"name": parent_snapshot},
    },
}
try:
    clone_resp = ontap_request(ontap_config, "POST", "storage/volumes?return_records=true&return_timeout={}".format(ONTAP_RETURN_TIMEOUT), clone_body)
except urllib_error.HTTPError as e:
    try:
        err_body = e.read().decode("utf-8", errors="replace")
    except Exception:
        err_body = str(e)
    print(json.dumps({"status": "error", "error": "HTTP {} creating FlexClone volume: {}".format(e.code, err_body)}))
    sys.exit(0)
except Exception as e:
    print(json.dumps({"status": "error", "error": "failed to create FlexClone volume: {}".format(e)}))
    sys.exit(0)

clone_volume_uuid, clone_error = resolve_created_uuid(
    ontap_config, clone_resp,
    "storage/volumes?svm.name={}&name={}".format(url_encode(svm_name), url_encode(clone_name)),
    "FlexClone create")
if not clone_volume_uuid:
    print(json.dumps({"status": "error", "error": clone_error}))
    sys.exit(0)

print(json.dumps({
    "status": "ok",
    "cloneVolumeName": clone_name,
    "cloneVolumeUuid": clone_volume_uuid,
    "parentVolume": parent_volume,
    "parentSnapshot": parent_snapshot,
}))
