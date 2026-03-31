/* eslint-disable no-useless-escape */

/**
 * Oracle database collector functions (Python 2.7+, functional style).
 */
const pythonOracleHelpers = `
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
                connect_cmd = "CONNECT {}/{} AS SYSDBA\\n".format(
                    oracle_username, oracle_password)
            else:
                connect_cmd = "CONNECT {}/{}\\n".format(
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
    for line in output.strip().split('\\n'):
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
    pdbs = [line.strip() for line in output.strip().split('\\n')
            if (line.strip() and not line.startswith('SQL') and
                'ORA-' not in line and 'SP2-' not in line)]
    config["_cache"]["pdb_names"] = [
        p for p in pdbs
        if p and p != 'PDB$SEED' and re.match(r'^[A-Za-z0-9_]+$', p)]
    return config["_cache"]["pdb_names"]
`;

/**
 * Instance details + mount point collection functions.
 */
const pythonOracleInstanceFunctions = `
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
    for line in output.strip().split('\\n'):
        line = line.strip()
        if not line or line.upper().startswith(('SQL', 'SELECT', 'SET ', 'EXIT')):
            continue
        if 'ORA-' in line or 'SP2-' in line:
            details["error"] = "Oracle error: {}".format(line)
            continue
        if line.startswith('VERSION='):
            version = line[len('VERSION='):]
            if re.match(r'^[0-9]+\\.', version):
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
        sql = sql_prefix + "ALTER SESSION SET CONTAINER = {};\\n{};\\nEXIT;".format(pdb_name, base_sql)
    else:
        sql = sql_prefix + "{};\\nEXIT;".format(base_sql)

    output = run_sqlplus(config, sql)
    paths = [line.strip() for line in output.strip().split('\\n')
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
    for line in udev_output.split('\\n'):
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
    for line in output.strip().split('\\n'):
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
            for line in udev_output.split('\\n'):
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
        sd_devices = re.findall(r'\\b(sd[a-z]+)\\b', mp_output)
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
`;

/**
 * Assessment functions: FRA/RMAN, dNFS, Oracle parameters.
 */
const pythonOracleAssessmentFunctions = `
# ========================================
# Oracle Assessment Functions
# FRA/RMAN, dNFS, Oracle parameters.
# ========================================

def check_fra_rman_status(config):
    """Check FRA destination and RMAN compression in a single sqlplus call."""
    result = {
        "fraEnabled": None,
        "rmanCompressionEnabled": None,
        "fraDestination": None,
        "error": None
    }

    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'FRA=' || value FROM v$parameter WHERE name = 'db_recovery_file_dest';
SELECT 'RMAN=' || CASE WHEN COUNT(*) > 0 THEN 'yes' ELSE 'no' END FROM v$rman_configuration WHERE value LIKE '%BACKUP TYPE TO COMPRESSED%';
EXIT;'''
        output = run_sqlplus(config, sql)
        for line in output.strip().split('\\n'):
            line = line.strip()
            if not line or line.startswith('SQL') or 'ORA-' in line:
                continue
            if line.startswith('FRA='):
                fra_dest = line[4:].strip()
                if fra_dest:
                    result["fraEnabled"] = True
                    result["fraDestination"] = fra_dest
                else:
                    result["fraEnabled"] = False
            elif line.startswith('RMAN='):
                rman_val = line[5:].strip().lower()
                result["rmanCompressionEnabled"] = rman_val == 'yes'
        if result["fraEnabled"] is None:
            result["fraEnabled"] = False

    except Exception as e:
        result["error"] = str(e)

    return result


def check_dnfs_servers(config):
    """Check dNFS server configuration."""
    result = {
        "error": None,
        "data": []
    }

    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT svrname || '|' || dirname || '|' || Nfsversion FROM v$dnfs_servers;
EXIT;'''
        output = run_sqlplus(config, sql)

        servers = []
        for line in output.strip().split('\\n'):
            line = line.strip()
            if line and not line.startswith('SQL') and 'ORA-' not in line and '|' in line:
                parts = line.split('|')
                if len(parts) >= 3:
                    servers.append({
                        "svrname": parts[0].strip(),
                        "dirname": parts[1].strip(),
                        "nfsversion": parts[2].strip()
                    })

        result["data"] = servers

    except Exception as e:
        result["error"] = str(e)

    return result


def check_oracle_parameters(config):
    """Collect key Oracle parameters (SGA, PGA, block size, etc.)."""
    result = {
        "sgaTarget": None,
        "pgaAggregateTarget": None,
        "memoryTarget": None,
        "dbBlockSize": None,
        "processesLimit": None,
        "openCursorsLimit": None,
        "error": None
    }

    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT name || '=' || value FROM v$parameter 
WHERE name IN ('sga_target', 'pga_aggregate_target', 'memory_target', 'db_block_size', 'processes', 'open_cursors');
EXIT;'''
        output = run_sqlplus(config, sql)

        for line in output.strip().split('\\n'):
            line = line.strip()
            if line and '=' in line and not line.startswith('SQL') and 'ORA-' not in line:
                parts = line.split('=', 1)
                if len(parts) == 2:
                    param_name = parts[0].strip()
                    param_value = parts[1].strip()

                    if param_name == 'sga_target':
                        result["sgaTarget"] = param_value
                    elif param_name == 'pga_aggregate_target':
                        result["pgaAggregateTarget"] = param_value
                    elif param_name == 'memory_target':
                        result["memoryTarget"] = param_value
                    elif param_name == 'db_block_size':
                        result["dbBlockSize"] = param_value
                    elif param_name == 'processes':
                        result["processesLimit"] = param_value
                    elif param_name == 'open_cursors':
                        result["openCursorsLimit"] = param_value

    except Exception as e:
        result["error"] = str(e)

    return result


def get_pluggable_databases(config):
    """Collect pluggable database details (pdbName, pdbId, pdbStatus, pdbSizeInBytes, pdbCreationTime, serviceName) for CDB databases.

    Queries DBA_PDBS joined with aggregated CDB_DATA_FILES to fetch
    PDB_ID, PDB_NAME, STATUS, total datafile size in bytes, CREATION_TIME,
    and service name (falls back to PDB name when no explicit service exists).
    Excludes PDB$SEED.
    Returns a list of dicts or empty list if not a CDB.
    """
    if not is_cdb_database(config):
        return []

    sql = """SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT
    JSON_OBJECT(
        'pdbId' VALUE TO_CHAR(p.PDB_ID),
        'pdbName' VALUE p.PDB_NAME,
        'pdbStatus' VALUE p.STATUS,
        'pdbSizeInBytes' VALUE NVL(df.SIZE_BYTES, 0),
        'pdbCreationTime' VALUE TO_CHAR(p.CREATION_TIME, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'serviceName' VALUE NVL((
            SELECT MIN(s.NAME)
            FROM CDB_SERVICES s
            WHERE s.PDB = p.PDB_NAME
              AND s.NAME NOT LIKE 'SYS$%'
        ), p.PDB_NAME)
        RETURNING VARCHAR2(4000)
    )
FROM DBA_PDBS p
LEFT JOIN (
    SELECT CON_ID, SUM(BYTES) AS SIZE_BYTES
    FROM CDB_DATA_FILES
    GROUP BY CON_ID
) df ON p.PDB_ID = df.CON_ID
WHERE p.PDB_NAME <> 'PDB$SEED';
EXIT;"""
    output = run_sqlplus(config, sql)
    pdbs = []
    for line in output.strip().split('\\n'):
        line = line.strip()
        if not line or line.startswith('SQL') or 'ORA-' in line or 'SP2-' in line:
            continue
        try:
            pdb_data = json.loads(line)
            if isinstance(pdb_data, dict) and pdb_data.get("pdbName"):
                pdbs.append(pdb_data)
        except Exception:
            log("Skipping unparsable PDB row: {}".format(line))
    log_info("Pluggable databases found: {}".format(len(pdbs)))
    return pdbs


def get_dataguard_details(config):
    """Detect Oracle Data Guard and return deployment flag + basic details.

    Single sqlplus call gathers role, db identity, and FAL/DG_CONFIG
    parameters to determine whether Data Guard is configured.

    Returns dict with:
      isDataGuardDeployed (bool)
      dataguardDetails    (dict with dbUniqueName, dbName, isPrimaryNode, role)
    """
    result = {
        "isDataGuardDeployed": False,
        "dataguardDetails": {}
    }

    try:
        sql = """SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'ROLE=' || DATABASE_ROLE FROM V$DATABASE;
SELECT 'DBUNIQUE=' || VALUE FROM V$PARAMETER WHERE NAME = 'db_unique_name';
SELECT 'DBNAME=' || VALUE FROM V$PARAMETER WHERE NAME = 'db_name';
SELECT 'FAL_SERVER=' || VALUE FROM V$PARAMETER WHERE NAME = 'fal_server';
SELECT 'FAL_CLIENT=' || VALUE FROM V$PARAMETER WHERE NAME = 'fal_client';
SELECT 'LOG_ARCHIVE_CONFIG=' || VALUE FROM V$PARAMETER WHERE NAME = 'log_archive_config';
SELECT 'DGMEMBER=' || db_unique_name || '|' || dest_role FROM V$DATAGUARD_CONFIG;
EXIT;"""
        output = run_sqlplus(config, sql)

        vals = {}
        dg_members = []

        for line in output.strip().split('\\n'):
            line = line.strip()
            if not line or line.upper().startswith(('SQL', 'SELECT', 'SET ', 'EXIT')):
                continue
            if 'ORA-' in line or 'SP2-' in line:
                continue
            if line.startswith('DGMEMBER='):
                member_val = line[len('DGMEMBER='):]
                parts = member_val.split('|', 1)
                if len(parts) == 2:
                    dg_members.append({
                        "serviceName": parts[0].strip(),
                        "sidName": parts[0].strip(),
                        "role": parts[1].strip()
                    })
                continue
            idx = line.find('=')
            if idx > 0:
                vals[line[:idx]] = line[idx + 1:].strip()

        db_role = vals.get("ROLE", "")
        if not db_role:
            log("Could not determine database role - DataGuard detection skipped")
            return result

        # Determine if DG is configured: multiple DGMEMBER rows or FAL parameters set
        if len(dg_members) <= 1:
            fal_server = vals.get("FAL_SERVER", "")
            fal_client = vals.get("FAL_CLIENT", "")
            lac = vals.get("LOG_ARCHIVE_CONFIG", "").upper()
            has_dg = (
                (fal_client and fal_server and fal_server != fal_client) or
                (not fal_client and fal_server) or
                (fal_client and not fal_server) or
                ("DG_CONFIG" in lac)
            )
            if not has_dg:
                log("No Data Guard configuration detected")
                return result

        is_primary = "PRIMARY" in db_role.upper()

        result["isDataGuardDeployed"] = True
        result["dataguardDetails"] = {
            "dbUniqueName": vals.get("DBUNIQUE", ""),
            "dbName": vals.get("DBNAME", ""),
            "isPrimaryNode": is_primary,
            "role": db_role,
            "associatedHosts": dg_members
        }

        log_info("DataGuard detected: role={}, isPrimary={}".format(db_role, is_primary))

    except Exception as e:
        log("Error detecting DataGuard: {}".format(e))
        result["dataguardDetails"]["error"] = str(e)

    return result
`;

export { pythonOracleHelpers, pythonOracleInstanceFunctions, pythonOracleAssessmentFunctions };
