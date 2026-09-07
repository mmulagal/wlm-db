#!/usr/bin/env python3
# Resolve Oracle-SID mount points (NFS, iSCSI, or ASM) to their backing ONTAP
# volume/LUN identity on FSx for ONTAP. Protocol-generic: the same driver
# inspects /proc/mounts, ASM disk groups, and multipath/udev iSCSI info, then
# calls the ONTAP REST API to map each of INCLUDED_FILE_TYPES back to a
# volume name + SVM.
#
# Run as root via SSM (needs `sudo -u oracle` access for oratab/ASM tooling
# and outbound HTTPS to the FSx management IP). Non-mutating; read-only.
#
# Required env: ORACLE_SID, REGION
# Optional env: FILESYSTEM_ID (fs-...; triggers need_input if absent),
#               FSX_USERNAME, FSX_PASSWORD (falls back to the
#               /netapp/wlmdb/<filesystemId> SSM parameter if unset)
#
# Output (stdout, single line of JSON):
#   {"status":"ok","protocol":"NFS"|"iSCSI"|"ASM","isASMManaged":bool,
#    "svmName":...,"filesystemId":...,
#    "volumesByFileType":{"DATA_FILES":[...],...}}
#   {"status":"need_input","need":"filesystemId"|"fsxCredentials",...}
#
# See ../../references/mapped-ontap-volumes.md for the full contract
# (when to ask the operator, included/excluded file types, confirmation gates).

from __future__ import print_function, unicode_literals

import os
import re
import sys
import json
import base64
import socket
import subprocess
import logging
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
LOG_FILE = os.path.join(os.getcwd(), "oracle_mapped_volumes.log")

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
# Oracle Helpers
# Config builder, sqlplus runner, cached CDB/ASM/PDB queries.
# ========================================

FILE_TYPES = ["REDO_LOGS", "ARCHIVE_LOGS", "CONTROL_FILES", "TEMP_FILES",
              "DATA_FILES", "FRA"]


def parse_oratab():
    """Parse /etc/oratab and return list of (sid, oracle_home) tuples.

    Returns an empty list if the file does not exist or cannot be read.
    Skips blank lines, comments (#), and ASM instances (+).
    """
    oratab_path = "/etc/oratab"
    entries = []
    if not os.path.exists(oratab_path):
        return entries
    try:
        with open(oratab_path, 'r') as f:
            for line in f:
                line = line.strip()
                if (not line or line.startswith('#') or
                        line.startswith('+')):
                    continue
                parts = line.split(':')
                if len(parts) >= 2 and parts[0]:
                    entries.append((parts[0], parts[1]))
    except (IOError, OSError):
        pass
    return entries


def get_oracle_home(oracle_sid):
    """Look up ORACLE_HOME from /etc/oratab for the given SID."""
    for sid, home in parse_oratab():
        if sid == oracle_sid:
            return home
    return None


def encode_sql(sql):
    """Base64-encode SQL for piping to sqlplus.

    Returns an ASCII string suitable for echo ... | base64 -d.
    """
    if PYTHON3:
        return base64.b64encode(sql.encode('utf-8')).decode('ascii')
    else:
        return base64.b64encode(sql)


def run_sqlplus(config, sql):
    """Execute SQL via sqlplus using the provided oracle config dict."""
    oracle_sid = config.get("oracle_sid")
    oracle_home = config.get("oracle_home")
    use_os_auth = config.get("use_os_auth", True)
    use_sysdba = config.get("use_sysdba", True)
    oracle_username = config.get("oracle_username")
    oracle_password = config.get("oracle_password")

    if not oracle_home:
        log("SQLPlus: No ORACLE_HOME set")
        return ""

    try:
        if use_os_auth:
            # OS auth: run as oracle user via sudo, no password exposed
            sql_b64 = encode_sql(sql)
            bash_script = (
                'export ORACLE_SID={};'
                ' export ORACLE_HOME={};'
                ' export PATH=$ORACLE_HOME/bin:$PATH;'
                " echo '{}' | base64 -d |"
                " sqlplus -S '/ as sysdba'"
            ).format(oracle_sid, oracle_home, sql_b64)
            cmd = ['sudo', '-i', '-u', 'oracle', 'bash', '-c',
                   bash_script]
        else:
            # Password auth: CONNECT piped via stdin (not in cmdline)
            if use_sysdba:
                connect_cmd = "CONNECT {}/{} AS SYSDBA\n".format(
                    oracle_username, oracle_password)
            else:
                connect_cmd = "CONNECT {}/{}\n".format(
                    oracle_username, oracle_password)

            full_sql = connect_cmd + sql
            sql_b64 = encode_sql(full_sql)

            bash_script = (
                'export ORACLE_SID={};'
                ' export ORACLE_HOME={};'
                ' export PATH=$ORACLE_HOME/bin:$PATH;'
                " echo '{}' | base64 -d |"
                " sqlplus -S /nolog"
            ).format(oracle_sid, oracle_home, sql_b64)
            cmd = ['sudo', '-i', '-u', 'oracle', 'bash', '-c',
                   bash_script]

        log("SQLPlus cmd: ORACLE_SID={} ORACLE_HOME={} auth={}".format(
            oracle_sid, oracle_home, "OS" if use_os_auth else "password/nolog"))
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60
        )
        output = result.stdout
        if isinstance(output, binary_type):
            output = output.decode('utf-8', errors='replace')
        stderr = result.stderr
        if isinstance(stderr, binary_type):
            stderr = stderr.decode('utf-8', errors='replace')
        log("SQLPlus returncode: {}".format(result.returncode))
        log("SQLPlus stdout: {}".format(
            repr(output[:200]) if output else 'empty'))
        if stderr:
            log("SQLPlus stderr: {}".format(stderr[:200]))
        return output
    except Exception as e:
        log("SQLPlus error: {}".format(e))
        return ""


def make_oracle_config(oracle_sid, oracle_username=None,
                       oracle_password=None, use_sysdba=True):
    """Build Oracle config dict with connection params and empty cache."""
    return {
        "oracle_sid": oracle_sid,
        "oracle_home": get_oracle_home(oracle_sid),
        "oracle_username": oracle_username,
        "oracle_password": oracle_password,
        "use_sysdba": use_sysdba,
        "use_os_auth": oracle_username is None,
        "_cache": {}
    }


def fetch_db_type_info(config):
    """Fetch CDB and ASM status in a single sqlplus call. Populates config cache."""
    sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'CDB=' || CDB FROM V$DATABASE;
SELECT 'ASM=' || CASE WHEN COUNT(*) > 0 THEN 'TRUE' ELSE 'FALSE' END FROM dba_data_files WHERE file_name LIKE '+%';
EXIT;'''
    output = run_sqlplus(config, sql)
    cache = config["_cache"]
    for line in output.strip().split('\n'):
        line = line.strip()
        if line.startswith('CDB='):
            cache["is_cdb"] = line[4:].strip() == 'YES'
        elif line.startswith('ASM='):
            cache["is_asm"] = line[4:].strip() == 'TRUE'
    if "is_cdb" not in cache:
        cache["is_cdb"] = False
    if "is_asm" not in cache:
        cache["is_asm"] = False


def is_cdb_database(config):
    """Check if database is a CDB. Result is cached in config."""
    if "is_cdb" not in config["_cache"]:
        fetch_db_type_info(config)
    return config["_cache"]["is_cdb"]


def check_asm_managed(config):
    """Check if database uses ASM storage. Result is cached in config."""
    if "is_asm" not in config["_cache"]:
        fetch_db_type_info(config)
    return config["_cache"]["is_asm"]


def get_pdb_names(config):
    """Get open PDB names for CDB databases. Result is cached in config."""
    if "pdb_names" in config["_cache"]:
        return config["_cache"]["pdb_names"]
    sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SELECT NAME FROM V$PDBS WHERE OPEN_MODE IN ('READ WRITE', 'READ ONLY');
EXIT;'''
    output = run_sqlplus(config, sql)
    pdbs = [line.strip() for line in output.strip().split('\n')
            if (line.strip() and not line.startswith('SQL') and
                'ORA-' not in line and 'SP2-' not in line)]
    config["_cache"]["pdb_names"] = [
        p for p in pdbs
        if p and p != 'PDB$SEED' and re.match(r'^[A-Za-z0-9_]+$', p)]
    return config["_cache"]["pdb_names"]


# ========================================
# Oracle Instance & Mount Point Functions
# ========================================

def is_instance_running(config):
    """Check if Oracle instance is running via PMON process or sqlplus."""
    oracle_sid = config["oracle_sid"]
    try:
        result = subprocess.run(
            ['pgrep', '-x', 'ora_pmon_{}'.format(oracle_sid)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        if result.returncode == 0:
            return True

        result = subprocess.run(
            ['pgrep', '-f', 'pmon_{}'.format(oracle_sid)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        if result.returncode == 0:
            return True
    except Exception as e:
        log("PMON check failed: {}".format(e))

    if config.get("oracle_home"):
        try:
            sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SELECT 1 FROM DUAL;
EXIT;'''
            output = run_sqlplus(config, sql)
            if '1' in output:
                return True
        except Exception:
            pass

    try:
        result = subprocess.run(
            ['ps', '-ef'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        stdout = result.stdout
        if isinstance(stdout, binary_type):
            stdout = stdout.decode('utf-8', errors='replace')
        if 'pmon_{}'.format(oracle_sid.lower()) in stdout.lower():
            return True
    except Exception:
        pass

    return False


def get_instance_details(config):
    """Collect instance metadata (version, name, CDB/ASM, PDB names) in one sqlplus call."""
    oracle_sid = config["oracle_sid"]
    oracle_home = config.get("oracle_home")

    details = {
        "databaseInstanceId": oracle_sid,
        "databaseInstanceName": oracle_sid,
        "oracleHome": oracle_home,
        "hostname": socket.gethostname()
    }

    if not oracle_home:
        details["error"] = "ORACLE_HOME not found"
        return details

    # Combined query: version, database name + CDB status, ASM status, RAC status
    sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'VERSION=' || VERSION FROM V$INSTANCE;
SELECT 'DBNAME=' || NAME || '|CDB=' || CDB FROM V$DATABASE;
SELECT 'ASM=' || CASE WHEN COUNT(*) > 0 THEN 'TRUE' ELSE 'FALSE' END FROM dba_data_files WHERE file_name LIKE '+%';
SELECT 'CLUSTER=' || UPPER(VALUE) FROM V$PARAMETER WHERE NAME = 'cluster_database';
EXIT;'''
    output = run_sqlplus(config, sql)
    log("SQLPlus combined query output: {}".format(repr(output)))
    if not output or not output.strip():
        details["error"] = ("SQLPlus returned empty output. "
            "Check Oracle credentials, ORACLE_HOME path ({}), "
            "and user permissions.").format(oracle_home)
        return details

    cache = config["_cache"]
    is_clustered = False
    for line in output.strip().split('\n'):
        line = line.strip()
        if not line or line.upper().startswith(('SQL', 'SELECT', 'SET ', 'EXIT')):
            continue
        if 'ORA-' in line or 'SP2-' in line:
            details["error"] = "Oracle error: {}".format(line)
            continue
        if line.startswith('VERSION='):
            version = line[len('VERSION='):]
            if re.match(r'^[0-9]+\.', version):
                details["databaseVersion"] = version
        elif line.startswith('DBNAME='):
            # Format: DBNAME=<name>|CDB=<YES|NO>
            parts = line[len('DBNAME='):].split('|')
            if parts:
                db_name = parts[0].strip()
                if re.match(r'^[A-Za-z0-9_]+$', db_name):
                    details["databaseName"] = db_name
            for part in parts[1:]:
                if part.startswith('CDB='):
                    is_cdb = part[4:].strip() == 'YES'
                    cache["is_cdb"] = is_cdb
                    details["isCDB"] = is_cdb
        elif line.startswith('ASM='):
            is_asm = line[4:].strip() == 'TRUE'
            cache["is_asm"] = is_asm
            details["isASMManaged"] = is_asm
        elif line.startswith('CLUSTER='):
            is_clustered = line[len('CLUSTER='):].strip() == 'TRUE'

    # Deployment type: Standalone or Clustered based on RAC (cluster_database parameter)
    details["deploymentType"] = "Clustered" if is_clustered else "Standalone"

    # Get PDB names if CDB (cached for reuse by collect_mount_details)
    if details.get("isCDB"):
        details["pdbNames"] = get_pdb_names(config)

    return details


def collect_mount_details(config):
    """Collect mount points for all Oracle file types. Uses cached CDB/ASM/PDB info."""
    log_info("Collecting mount details for SID: {} (ORACLE_HOME={})".format(
        config["oracle_sid"], config.get("oracle_home")))

    if not config.get("oracle_home"):
        return {"error": "ORACLE_HOME not found for SID: {}".format(
            config["oracle_sid"])}

    is_cdb = is_cdb_database(config)
    is_asm = check_asm_managed(config)
    log_info("Database type: {} | ASM managed: {}".format(
        "CDB" if is_cdb else "Non-CDB", is_asm))

    result = {"isCDB": is_cdb, "isASMManaged": is_asm}

    # Read /proc/mounts once and reuse across all file types and PDBs
    proc_mounts = load_proc_mounts()

    if is_cdb:
        pdb_names = get_pdb_names(config)
        result["pdbMountDetails"] = {}
        for pdb_name in pdb_names:
            if pdb_name == "PDB$SEED":
                continue
            pdb_mounts = get_mount_details(config, is_cdb, pdb_name, is_asm, proc_mounts)
            result["pdbMountDetails"][pdb_name] = pdb_mounts
    else:
        result["mountDetails"] = get_mount_details(config, is_cdb, None, is_asm, proc_mounts)

    return result


def get_mount_details(config, is_cdb, pdb_name, is_asm_managed, proc_mounts):
    """Collect mount info for each file type by querying file paths and resolving mounts."""
    mount_details = {}

    for file_type in FILE_TYPES:
        file_paths = get_file_paths(config, file_type, is_cdb, pdb_name)
        mount_map = {}
        mount_counts = {}

        for file_path in file_paths:
            if file_path.startswith('+') and is_asm_managed:
                asm_mounts = find_asm_mount_points(config, file_path)
                for mount_info in asm_mounts:
                    mount_key = (mount_info.get('mountIP', ''), mount_info.get('mountPoint', ''))
                    if mount_key not in mount_map:
                        mount_map[mount_key] = mount_info
                        mount_counts[mount_key] = 0
                    mount_counts[mount_key] += 1
            else:
                mount_info = find_mount_point(file_path, is_asm_managed, proc_mounts)
                if mount_info:
                    mount_key = (mount_info.get('mountIP', ''), mount_info.get('mountPoint', ''))
                    if mount_key not in mount_map:
                        mount_map[mount_key] = mount_info
                        mount_counts[mount_key] = 0
                    mount_counts[mount_key] += 1
                else:
                    log("  No mount found for path: {} (check /proc/mounts for NFS/iSCSI entry)".format(file_path))

        mounts = []
        for mount_key, mount_info in mount_map.items():
            mount_info['copiesCount'] = mount_counts[mount_key]
            mounts.append(mount_info)

        mount_details[file_type] = mounts
        if mounts:
            log("  {} mount(s) for {}: {}".format(
                len(mounts), file_type,
                ", ".join("{}:{}".format(m.get('mountIP',''), m.get('mountPoint','')) for m in mounts)))
        else:
            log("  {} -> {} paths found, 0 mounts resolved".format(file_type, len(file_paths)))

    return mount_details


def get_file_paths(config, file_type, is_cdb, pdb_name):
    """Query Oracle for file paths of the given type. Switches container for CDB PDBs."""
    sql_map = {
        "DATA_FILES": "SELECT DISTINCT FILE_NAME FROM DBA_DATA_FILES",
        "TEMP_FILES": "SELECT DISTINCT FILE_NAME FROM DBA_TEMP_FILES",
        "REDO_LOGS": "SELECT DISTINCT MEMBER FROM V$LOGFILE",
        "ARCHIVE_LOGS": (
            "SELECT DISTINCT CASE d.destination "
            "WHEN 'USE_DB_RECOVERY_FILE_DEST' "
            "THEN (SELECT value FROM V$PARAMETER "
            "WHERE name = 'db_recovery_file_dest') "
            "ELSE d.destination END "
            "FROM V$ARCHIVE_DEST_STATUS d "
            "WHERE d.destination IS NOT NULL "
            "AND LENGTH(TRIM(d.destination)) > 0 "
            "AND d.type = 'LOCAL'"
        ),
        "CONTROL_FILES": "SELECT DISTINCT NAME FROM V$CONTROLFILE",
        "FRA": "SELECT DISTINCT VALUE FROM V$PARAMETER WHERE NAME = 'db_recovery_file_dest'"
    }

    base_sql = sql_map.get(file_type, "")
    if not base_sql:
        return []

    sql_prefix = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
'''
    if is_cdb and pdb_name and file_type in ["DATA_FILES", "TEMP_FILES"]:
        sql = sql_prefix + "ALTER SESSION SET CONTAINER = {};\n{};\nEXIT;".format(pdb_name, base_sql)
    else:
        sql = sql_prefix + "{};\nEXIT;".format(base_sql)

    output = run_sqlplus(config, sql)
    paths = [line.strip() for line in output.strip().split('\n')
             if line.strip() and not line.startswith('SQL') and ('/' in line or line.startswith('+')) and 'ORA-' not in line]
    log("  {} -> {} path(s) found{}".format(
        file_type, len(paths),
        ": " + ", ".join(paths[:3]) + ("..." if len(paths) > 3 else "") if paths else " (sqlplus returned empty)" if not output.strip() else " (no matching paths in output)"))
    return paths


def load_proc_mounts():
    entries = []
    try:
        with open('/proc/mounts', 'r') as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 4:
                    entries.append((parts[1], parts[0], parts[2], parts[3]))
        entries.sort(key=lambda x: len(x[0]), reverse=True)
    except Exception as e:
        log("Error reading /proc/mounts: {}".format(e))
    return entries


def find_mount_point(file_path, is_asm_managed, proc_mounts):
    """Resolve a file path to its NFS/iSCSI/ASM mount point using pre-loaded mount entries."""
    if not file_path:
        return None

    # Handle ASM paths (start with +)
    if file_path.startswith('+'):
        disk_group = file_path.split('/')[0].lstrip('+')
        return {
            "mountIP": "",
            "mountPoint": disk_group,
            "protocol": "iSCSI",
            "isAsmManaged": True,
            "diskGroup": disk_group
        }

    # Find best matching mount point from pre-loaded entries (already sorted longest-first)
    for mount_point, device, fs_type, options in proc_mounts:
        if (file_path == mount_point or
                mount_point == '/' or
                file_path.startswith(mount_point + '/')):
            mount_info = parse_mount_info(
                mount_point, device, fs_type, options)
            if mount_info:
                return mount_info
            break

    return None


def parse_mount_info(mount_point, device, fs_type, options):
    """Parse mount entry into NFS or iSCSI mount info dict."""
    if fs_type in ('nfs', 'nfs4'):
        if ':' in device:
            ip, path = device.split(':', 1)
            return {
                "mountIP": ip,
                "mountPoint": path,
                "protocol": "NFS",
                "isAsmManaged": False
            }

    if device.startswith('/dev/dm-') or device.startswith('/dev/sd'):
        serial = get_iscsi_serial(device)
        if serial:
            return {
                "mountIP": "",
                "mountPoint": serial,
                "protocol": "iSCSI",
                "isAsmManaged": False
            }

    # Handle /dev/mapper/ devices (multipath, LVM)
    if device.startswith('/dev/mapper/'):
        serial = get_iscsi_serial(device)
        if not serial:
            # Try resolving symlink to real device
            try:
                real_device = os.path.realpath(device)
                if real_device != device:
                    serial = get_iscsi_serial(real_device)
            except Exception:
                pass
        if not serial:
            # Try udevadm to resolve multipath to iSCSI serial
            info = get_multipath_iscsi_info(device)
            if info:
                return {
                    "mountIP": info.get("mountIP", ""),
                    "mountPoint": info.get("serial", ""),
                    "protocol": "iSCSI",
                    "isAsmManaged": False
                }
        if serial:
            return {
                "mountIP": "",
                "mountPoint": serial,
                "protocol": "iSCSI",
                "isAsmManaged": False
            }

    return None


def get_iscsi_serial(device):
    """Get block device serial number for iSCSI volume mapping."""
    try:
        result = subprocess.run(
            ['lsblk', '-o', 'SERIAL', '-n', device],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10
        )
        if result.returncode == 0 and result.stdout:
            output = result.stdout.strip()
            if isinstance(output, binary_type):
                output = output.decode('utf-8')
            if output:
                return output
    except Exception:
        pass
    return None


# ========================================
# ASM Disk-to-iSCSI Serial Resolution
# Resolves ASM disk groups to actual iSCSI LUN serials
# via V$ASM_DISK + udevadm, matching the discover script approach.
# ========================================

def parse_udevadm_iscsi_info(udev_output):
    """Extract iSCSI mount IP and serial from udevadm info output.

    Parses the output of 'udevadm info --query=all' looking for
    disk/by-path IP entries and ID_SCSI_SERIAL values.
    Returns dict with mountIP, serial, protocol or None.
    """
    mount_ip = ""
    serial = ""
    for line in udev_output.split('\n'):
        if 'disk/by-path' in line and 'ip-' in line:
            ip_match = re.search(r'ip-([0-9.]+):', line)
            if ip_match:
                mount_ip = ip_match.group(1)
        if 'ID_SCSI_SERIAL=' in line:
            serial = line.split('=', 1)[1].strip()
    if serial:
        return {"mountIP": mount_ip, "serial": serial, "protocol": "iSCSI"}
    return None


def detect_asm_tool():
    """Detect whether ASMLib or AFD is in use for ASM disk management."""
    try:
        result = subprocess.run(
            ['lsmod'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10
        )
        if result.returncode == 0 and result.stdout:
            output = result.stdout
            if isinstance(output, binary_type):
                output = output.decode('utf-8', errors='replace')
            if 'oracleafd' in output:
                return "afd"
            if 'oracleasm' in output:
                return "asmlib"
    except Exception:
        pass
    return "asmlib"


def get_asm_disk_names(config, disk_group):
    """Query V$ASM_DISK for disk names in the given disk group."""
    sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SELECT d.name
FROM v$asm_disk d
JOIN v$asm_diskgroup g ON d.group_number = g.group_number
WHERE g.name = '{}';
EXIT;'''.format(disk_group)
    output = run_sqlplus(config, sql)
    disk_names = []
    for line in output.strip().split('\n'):
        line = line.strip()
        if line and not line.startswith('SQL') and 'ORA-' not in line and 'SP2-' not in line:
            disk_names.append(line)
    log("  ASM disk group '{}': {} disk(s) found".format(disk_group, len(disk_names)))
    return disk_names


def get_asm_disk_iscsi_info(disk_name, tool_in_use):
    """Resolve an ASM disk name to its iSCSI serial via udevadm info.
    Returns dict with mountIP, serial, protocol or None."""
    try:
        if tool_in_use == "asmlib":
            dev_path = "/dev/oracleasm/disks/{}".format(disk_name)
        else:
            # AFD: read device path from the AFD disk file
            try:
                afd_proc = subprocess.run(
                    ['sudo', 'cat', '/dev/oracleafd/disks/{}'.format(disk_name)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=10
                )
                if afd_proc.returncode != 0 or not afd_proc.stdout:
                    log("  AFD disk path not found for {}".format(disk_name))
                    return None
                dev_path = afd_proc.stdout.strip()
                if isinstance(dev_path, binary_type):
                    dev_path = dev_path.decode('utf-8')
            except Exception as e:
                log("  AFD disk resolve error for {}: {}".format(disk_name, e))
                return None

        # Get udevadm info for the device
        result = subprocess.run(
            ['sudo', 'udevadm', 'info', '--query=all',
             '--name={}'.format(dev_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10
        )
        if result.returncode != 0:
            log("  udevadm failed for {}: rc={}".format(dev_path, result.returncode))
            return None

        udev_output = result.stdout
        if isinstance(udev_output, binary_type):
            udev_output = udev_output.decode('utf-8', errors='replace')

        # Check if multipath device
        if 'DM_UUID=mpath-' in udev_output:
            device_name = ""
            for line in udev_output.split('\n'):
                if 'DEVNAME=' in line:
                    device_name = line.split('=', 1)[1].strip()
                    break
            if device_name:
                return get_multipath_iscsi_info(device_name)
            return None

        # Non-multipath: extract serial and IP from udevadm output
        info = parse_udevadm_iscsi_info(udev_output)
        if info:
            return info

        log("  No iSCSI serial found for ASM disk {}".format(disk_name))
        return None

    except Exception as e:
        log("  Error resolving ASM disk {}: {}".format(disk_name, e))
        return None


def get_multipath_iscsi_info(device):
    """Resolve a multipath device to its iSCSI serial by finding underlying sd devices."""
    try:
        dev_name = os.path.basename(device)
        # Get multipath topology
        mp_proc = subprocess.run(
            ['sudo', 'multipath', '-ll', dev_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10
        )
        if mp_proc.returncode != 0 or not mp_proc.stdout:
            mp_proc = subprocess.run(
                ['sudo', 'multipath', '-ll', device],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=10
            )

        mp_output = ""
        if mp_proc.returncode == 0 and mp_proc.stdout:
            mp_output = mp_proc.stdout
            if isinstance(mp_output, binary_type):
                mp_output = mp_output.decode('utf-8', errors='replace')

        # Find underlying sd devices from multipath output
        sd_devices = re.findall(r'\b(sd[a-z]+)\b', mp_output)
        sd_devices = list(set(sd_devices))

        for sd_dev in sd_devices:
            sd_path = '/dev/' + sd_dev
            try:
                udev_proc = subprocess.run(
                    ['sudo', 'udevadm', 'info', '--query=all',
                     '--name={}'.format(sd_path)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=10
                )
                if udev_proc.returncode != 0:
                    continue
                udev_output = udev_proc.stdout
                if isinstance(udev_output, binary_type):
                    udev_output = udev_output.decode('utf-8', errors='replace')

                info = parse_udevadm_iscsi_info(udev_output)
                if info:
                    return info
            except Exception:
                continue

        # Fallback: try udevadm directly on the multipath device for serial
        try:
            udev_proc = subprocess.run(
                ['sudo', 'udevadm', 'info', '--query=all',
                 '--name={}'.format(device)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=10
            )
            if udev_proc.returncode == 0 and udev_proc.stdout:
                udev_output = udev_proc.stdout
                if isinstance(udev_output, binary_type):
                    udev_output = udev_output.decode('utf-8', errors='replace')
                info = parse_udevadm_iscsi_info(udev_output)
                if info:
                    return info
        except Exception:
            pass

        log("  No iSCSI info found from multipath device {}".format(device))
        return None

    except Exception as e:
        log("  Error resolving multipath device {}: {}".format(device, e))
        return None


def find_asm_mount_points(config, file_path):
    """Resolve ASM file path to mount points by querying V$ASM_DISK and udevadm.
    Returns a list of mount info dicts with real iSCSI serials."""
    disk_group = file_path.split('/')[0].lstrip('+')
    mounts = []

    try:
        disk_names = get_asm_disk_names(config, disk_group)
        if not disk_names:
            log("  No disks found for ASM disk group '{}', returning fallback".format(disk_group))
            return [{
                "mountIP": "",
                "mountPoint": disk_group,
                "protocol": "iSCSI",
                "isAsmManaged": True,
                "diskGroup": disk_group
            }]

        tool_in_use = detect_asm_tool()
        log("  ASM tool detected: {}".format(tool_in_use))

        for disk_name in disk_names:
            info = get_asm_disk_iscsi_info(disk_name, tool_in_use)
            if info:
                mounts.append({
                    "mountIP": info.get("mountIP", ""),
                    "mountPoint": info.get("serial", ""),
                    "protocol": info.get("protocol", "iSCSI"),
                    "isAsmManaged": True,
                    "diskName": disk_name,
                    "diskGroup": disk_group
                })

    except Exception as e:
        log("  Error resolving ASM mount points: {}".format(e))

    if not mounts:
        log("  ASM resolution failed for disk group '{}', returning fallback".format(disk_group))
        return [{
            "mountIP": "",
            "mountPoint": disk_group,
            "protocol": "iSCSI",
            "isAsmManaged": True,
            "diskGroup": disk_group
        }]

    log("  Resolved {} mount(s) for ASM disk group '{}'".format(len(mounts), disk_group))
    return mounts


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


def extract_protocol(ontap_volumes, is_asm_managed=False):
    if is_asm_managed:
        return "ASM"
    for file_type, volumes in ontap_volumes.items():
        for vol in volumes:
            if vol.get('diskGroup') or vol.get('diskName'):
                return "ASM"
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
            protocol = extract_protocol(ontap_volumes, is_asm_managed)
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
                protocol = extract_protocol(pdb_ontap_volumes, is_asm_managed)
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


# ========================================
# Driver: resolve mapped ONTAP volumes for ORACLE_SID
# ========================================
setup_logging()

missing_env = [name for name in ("ORACLE_SID", "REGION") if not os.environ.get(name)]
if missing_env:
    print(json.dumps({"status": "error", "error": "missing required env: {}".format(", ".join(missing_env))}))
    sys.exit(0)

oracle_sid = os.environ["ORACLE_SID"]
filesystem_id = os.environ.get("FILESYSTEM_ID", "")
fsx_username = os.environ.get("FSX_USERNAME")
fsx_password = os.environ.get("FSX_PASSWORD")
region = os.environ["REGION"]

INCLUDED_FILE_TYPES = ["DATA_FILES", "CONTROL_FILES", "REDO_LOGS", "ARCHIVE_LOGS"]

oracle_cfg = make_oracle_config(oracle_sid)
if not oracle_cfg.get("oracle_home"):
    print(json.dumps({"error": "SID {} not found in /etc/oratab".format(oracle_sid)}))
    sys.exit(0)

mount_point_data = collect_mount_details(oracle_cfg)
if mount_point_data.get("error"):
    print(json.dumps({"error": mount_point_data["error"]}))
    sys.exit(0)

def dedup_volume_entries(entries):
    seen = set()
    unique = []
    for entry in entries:
        key = json.dumps(entry, sort_keys=True, default=str)
        if key not in seen:
            seen.add(key)
            unique.append(entry)
    return unique


def collect_mount_ips(data):
    ips = set()
    for details in ([data.get("mountDetails", {})] if not data.get("isCDB")
                     else list(data.get("pdbMountDetails", {}).values())):
        for ft in INCLUDED_FILE_TYPES:
            for mount in details.get(ft, []):
                ip = mount.get("mountIP")
                if ip:
                    ips.add(ip)
    return sorted(ips)

if not filesystem_id:
    print(json.dumps({
        "status": "need_input",
        "need": "filesystemId",
        "hint": "storage mount IP(s) observed on host, to help identify the FSx filesystem",
        "mountIPs": collect_mount_ips(mount_point_data)
    }))
    sys.exit(0)

# Prefer credentials already cached on the host (/netapp/wlmdb/<filesystemId> SSM
# parameter, same convention as the registered continuous-drift flows) before
# asking the operator for FSx creds.
fsx_cred_error = None
if not fsx_username or not fsx_password:
    fsx_creds, fsx_cred_error = getFsxCredentials(filesystem_id)
    if fsx_creds:
        fsx_username = fsx_creds.get("username")
        fsx_password = fsx_creds.get("password")

if not fsx_username or not fsx_password:
    print(json.dumps({
        "status": "need_input",
        "need": "fsxCredentials",
        "hint": fsx_cred_error or "no FSX_USERNAME/FSX_PASSWORD supplied and none cached on host"
    }))
    sys.exit(0)

ontap_config = make_ontap_config(filesystem_id, region, fsx_username, fsx_password)
mapped = get_mapped_volumes(ontap_config, oracle_sid, mount_point_data)

sid_entry = mapped["volumeMappings"][0].get(oracle_sid, {})
if sid_entry.get("isCDB"):
    volumes_by_file_type = {ft: [] for ft in INCLUDED_FILE_TYPES}
    for pdb_volumes in sid_entry.get("ontapVolumes", {}).values():
        for ft in INCLUDED_FILE_TYPES:
            volumes_by_file_type[ft].extend(pdb_volumes.get(ft, []))
    volumes_by_file_type = {
        ft: dedup_volume_entries(vols) for ft, vols in volumes_by_file_type.items()
    }
else:
    volumes_by_file_type = {
        ft: sid_entry.get("ontapVolumes", {}).get(ft, [])
        for ft in INCLUDED_FILE_TYPES
    }

all_vols = [v for vols in volumes_by_file_type.values() for v in vols]
svm_name = next((v.get("svmName") for v in all_vols if v.get("svmName")), None)
svm_uuid = next((v.get("svmId") for v in all_vols if v.get("svmId")), None)

print(json.dumps({
    "status": "ok",
    "protocol": mapped["protocol"] or "NFS",
    # Clone recovery needs this even when protocol is ASM — it drives the renamedg step that
    # keeps a clone's diskgroup from colliding with the source's (+DATA).
    "isASMManaged": mapped["isASMManaged"],
    "svmName": svm_name,
    "svmUuid": svm_uuid,
    "filesystemId": filesystem_id,
    "volumesByFileType": volumes_by_file_type
}))
