/* eslint-disable no-useless-escape */

/**
 * Protocol-specific assessment functions for Oracle one-time WAD.
 *
 * Contains both NFS and iSCSI assessment collectors.
 * Python 2.7+ compatible, functional style.
 */

import { supportedOracleOsVersions } from '../../../../workloads/oracle/consts';
import {
    CHECK_MULTIPATH_IO_STATUS,
    CHECK_ISCSI_TARGETS_SESSIONS,
    CHECK_TRANSPARENT_HUGEPAGE,
    CHECK_SELINUX,
    CHECK_ISCSI_REPLACEMENT_TIMEOUT,
    CHECK_TCP_FEATURES,
    CHECK_MULTIPATH_CONFIGURATION
} from '../os-iscsi-assessment-scripts';
import {
    KERNEL_TCP_SLOT_PARAMETERS,
    NFS_MOUNT_OPTIONS,
    GET_MOUNT_OPTIONS_FOR_MOUNT_POINT,
    IDMAPD_DOMAIN_CONFIG,
    HOSTNAME_DOMAIN,
    GET_DNS_RESOLUTION,
    GET_NFS_EXPORTS,
    PARSE_ORANFSTAB
} from '../os-nfs-assessment-scripts';

const pythonNfsAssessmentFunctions = `
# ========================================
# NFS Assessment Functions
# ========================================

${GET_MOUNT_OPTIONS_FOR_MOUNT_POINT}

${KERNEL_TCP_SLOT_PARAMETERS}

${NFS_MOUNT_OPTIONS}

${IDMAPD_DOMAIN_CONFIG}

${HOSTNAME_DOMAIN}

${GET_DNS_RESOLUTION}

${GET_NFS_EXPORTS}

${PARSE_ORANFSTAB}


def check_adr_info(config):
    """Query Oracle ADR Home and resolve its mount point information.

    Returns dict with adr-home path, mount device, mount options,
    and any errors encountered.
    """
    result = {
        "adr-home": None,
        "adr-home-mount": None,
        "adr-home-mount-info": None,
        "error": None
    }
    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 4000
SET TRIMSPOOL ON
SELECT value FROM v$diag_info WHERE name = 'ADR Home';
EXIT;'''
        output = run_sqlplus(config, sql)
        adr_home = None
        for line in output.strip().split('\\n'):
            line = line.strip()
            if line and not line.startswith('SQL') and 'ORA-' not in line:
                adr_home = line
                break
        if adr_home:
            result["adr-home"] = adr_home
            try:
                df_proc = subprocess.run(
                    ['sudo', 'df', '-T', adr_home],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30
                )
                if df_proc.returncode == 0:
                    df_output = df_proc.stdout
                    if isinstance(df_output, binary_type):
                        df_output = df_output.decode('utf-8', errors='replace')
                    df_lines = df_output.strip().split('\\n')
                    if len(df_lines) >= 2:
                        parts = df_lines[1].split()
                        if len(parts) >= 2:
                            result["adr-home-mount"] = parts[0]
            except Exception as df_err:
                result["error"] = "df command failed: {}".format(df_err)
            if result["adr-home-mount"]:
                mount_options = get_mount_options_for_mount_point(result["adr-home-mount"])
                if mount_options.get("error"):
                    if not result["error"]:
                        result["error"] = mount_options["error"]
                else:
                    result["adr-home-mount-info"] = mount_options
        else:
            result["error"] = "ADR Home not found in v$diag_info"
    except Exception as e:
        result["error"] = str(e)
    return result


def collect_nfs_os_assessment(oracle_config):
    """Collect NFS OS assessment data.

    Checks kernel parameters, mount options, exports, idmapd,
    hostname domain, dNFS oranfstab, DNS resolution, and ADR info.
    """
    log_info("Collecting NFS OS assessment data...")
    results = {"os": {}}

    try:
        log_info("Checking kernel parameters (sunrpc TCP slot entries)...")
        results["os"]["kernel-parameters"] = check_sunrpc_tcp_slot_entries()
    except Exception as e:
        results["os"]["kernel-parameters"] = {"error": str(e)}

    try:
        log_info("Collecting NFS mount options...")
        results["os"]["nfs-mount-options"] = get_nfs_mount_options()
    except Exception as e:
        results["os"]["nfs-mount-options"] = {"error": str(e)}

    try:
        log_info("Collecting NFS exports...")
        results["os"]["nfs-exports"] = get_nfs_exports()
    except Exception as e:
        results["os"]["nfs-exports"] = {"error": str(e)}

    try:
        log_info("Checking idmapd domain configuration...")
        results["os"]["idmapd-domain-config"] = get_idmapd_domain_config()
    except Exception as e:
        results["os"]["idmapd-domain-config"] = {"error": str(e)}

    try:
        log_info("Getting hostname domain...")
        results["os"]["hostname-domain"] = get_hostname_domain()
    except Exception as e:
        results["os"]["hostname-domain"] = {"error": str(e)}

    try:
        log_info("Parsing dNFS oranfstab...")
        results["os"]["dnfs-oranfstab"] = parse_oranfstab()
    except Exception as e:
        results["os"]["dnfs-oranfstab"] = {"error": str(e)}

    try:
        log_info("Collecting dNFS IP resolution...")
        results["os"]["dnfs-ip-resolution"] = get_dns_resolution()
    except Exception as e:
        results["os"]["dnfs-ip-resolution"] = {"error": str(e)}

    try:
        log_info("Collecting ADR info...")
        results["adr-info"] = check_adr_info(oracle_config)
    except Exception as e:
        results["adr-info"] = {"error": str(e)}

    log_info("NFS OS assessment data collection completed")
    return results
`;

const pythonIscsiAssessmentFunctions = `
# ========================================
# iSCSI Assessment Functions
# ========================================


${CHECK_MULTIPATH_IO_STATUS}

${CHECK_ISCSI_TARGETS_SESSIONS}

${CHECK_TRANSPARENT_HUGEPAGE}

${CHECK_SELINUX}

${CHECK_ISCSI_REPLACEMENT_TIMEOUT}

${CHECK_TCP_FEATURES}

${CHECK_MULTIPATH_CONFIGURATION}


def get_iscsi_os_info():
    """Detect the OS distribution and version from /etc/os-release.

    Returns dict with os, version, code (e.g. 'rhel8'), and error fields.
    """
    try:
        os_id = None
        version_id = None
        try:
            id_result = subprocess.run(
                ['grep', '^ID=', '/etc/os-release'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
            )
            if id_result.returncode == 0 and id_result.stdout:
                out = id_result.stdout
                if isinstance(out, binary_type):
                    out = out.decode('utf-8', errors='replace')
                os_id = out.strip().split('=')[1].strip('"').strip("'")
        except Exception as e:
            log("Error reading ID from /etc/os-release: {}".format(e))
        try:
            ver_result = subprocess.run(
                ['grep', 'VERSION_ID', '/etc/os-release'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
            )
            if ver_result.returncode == 0 and ver_result.stdout:
                out = ver_result.stdout
                if isinstance(out, binary_type):
                    out = out.decode('utf-8', errors='replace')
                version_id = out.strip().split('=')[1].strip('"').strip("'")
        except Exception as e:
            log("Error reading VERSION_ID from /etc/os-release: {}".format(e))
        if os_id and version_id:
            major_version = version_id.split('.')[0]
            code = "{}{}".format(os_id, major_version)
            return {"os": os_id, "version": version_id, "code": code, "error": None}
        error_msg = "Could not determine OS distro. ID={}, VERSION_ID={}".format(os_id, version_id)
        log(error_msg)
        return {"os": None, "version": None, "code": None, "error": error_msg}
    except Exception as e:
        error_msg = "Error reading /etc/os-release: {}".format(e)
        log(error_msg)
        return {"os": None, "version": None, "code": None, "error": error_msg}


def check_sanlun():
    """Check whether the NetApp Host Utilities (sanlun) package is installed.

    Verifies OS compatibility against the supported versions list before
    attempting to run the sanlun command.
    """
    os_info = get_iscsi_os_info()
    os_code = os_info.get("code")
    os_error = os_info.get("error")
    if not os_code or os_error:
        log("Failed to detect OS: {}".format(os_error or "unknown"))
    supported_os = ${JSON.stringify(supportedOracleOsVersions)}
    if os_code not in supported_os:
        log("ONTAP sanlun not supported on {}".format(os_code))
        return {"sanlun-installed": False, "sanlun-version": None,
                "error": "sanlun not supported on {}".format(os_code), "os-version": os_code}
    log("Checking ONTAP sanlun installation")
    try:
        env = os.environ.copy()
        env["PATH"] = env.get("PATH", "") + ":/usr/sbin:/usr/bin:/opt/netapp:/opt/netapp/sanlun/bin"
        result = subprocess.run(
            ['sanlun', 'version'], env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10
        )
        if result.returncode == 0:
            out = result.stdout
            if isinstance(out, binary_type):
                out = out.decode('utf-8', errors='replace')
            log("ONTAP sanlun version: {}".format(out.strip()))
            return {"sanlun-installed": True, "sanlun-version": out.strip(),
                    "error": None, "os-version": os_code}
        else:
            return {"sanlun-installed": False, "sanlun-version": None,
                    "error": "sanlun command failed", "os-version": os_code}
    except OSError:
        return {"sanlun-installed": False, "sanlun-version": None,
                "error": "sanlun command not found", "os-version": os_code}
    except Exception as e:
        return {"sanlun-installed": False, "sanlun-version": None,
                "error": str(e), "os-version": os_code}


def check_oracle_iscsi_parameters(config):
    """Query Oracle for iSCSI-relevant parameters.

    Checks filesystemio_options and db_file_multiblock_read_count
    from v$parameter.
    """
    result = {
        "filesystemio-options": {"found": False, "value": None},
        "db-file-multiblock-read-count": {"found": False, "value": None},
        "error": None
    }
    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'FILESYSTEMIO=' || value FROM v$parameter WHERE name = 'filesystemio_options';
SELECT 'MULTIBLOCK=' || value FROM v$parameter WHERE name = 'db_file_multiblock_read_count';
EXIT;'''
        output = run_sqlplus(config, sql)
        for line in output.strip().split('\\n'):
            line = line.strip()
            if not line or line.startswith('SQL') or 'ORA-' in line:
                continue
            if line.startswith('FILESYSTEMIO='):
                val = line[len('FILESYSTEMIO='):].strip()
                if val:
                    result["filesystemio-options"]["found"] = True
                    result["filesystemio-options"]["value"] = val
            elif line.startswith('MULTIBLOCK='):
                val = line[len('MULTIBLOCK='):].strip()
                if val:
                    result["db-file-multiblock-read-count"]["found"] = True
                    result["db-file-multiblock-read-count"]["value"] = val
    except Exception as e:
        result["error"] = str(e)
    return result


def check_oracle_spfile(config):
    """Query Oracle for spfile configuration.

    Determines whether the instance uses an spfile or pfile and
    returns the file path and type.
    """
    result = {"spfile-path": None, "spfile-type": None, "is-default": False, "error": None}
    try:
        sql = '''SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SET HEADING OFF
SET ECHO OFF
SET LINESIZE 500
SELECT 'SPFILE_NAME=' || name || '|SPFILE_TYPE=' || type || '|SPFILE_VAL=' || value || '|SPFILE_DEF=' || isdefault FROM v$parameter WHERE name = 'spfile';
EXIT;'''
        output = run_sqlplus(config, sql)
        for line in output.strip().split('\\n'):
            line = line.strip()
            if not line or line.startswith('SQL') or 'ORA-' in line:
                continue
            if 'SPFILE_NAME=' in line:
                parts = {}
                for seg in line.split('|'):
                    if '=' in seg:
                        k, v = seg.split('=', 1)
                        parts[k.strip()] = v.strip()
                spfile_val = parts.get('SPFILE_VAL', '')
                is_default = parts.get('SPFILE_DEF', '')
                result["is-default"] = is_default == "TRUE"
                if spfile_val and spfile_val.lower() not in ('', 'null', '(null)'):
                    result["spfile-path"] = spfile_val
                    result["spfile-type"] = "spfile"
                else:
                    result["spfile-type"] = "pfile"
                break
    except Exception as e:
        result["error"] = str(e)
    return result


def check_init_ora_parameters(config):
    """Check db_file_multiblock_read_count in Oracle init files.

    Examines spfile (binary grep) or pfile (text parse) for the
    db_file_multiblock_read_count parameter.
    """
    oracle_sid = config.get("oracle_sid", "")
    result = {"db-file-multiblock-read-count-in-init": [], "current-spfile-info": None, "error": None}
    try:
        oracle_home = config.get("oracle_home") or get_oracle_home(oracle_sid)
        if not oracle_home or not oracle_sid:
            result["error"] = "ORACLE_HOME or ORACLE_SID not set"
            return result
        spfile_info = check_oracle_spfile(config)
        result["current-spfile-info"] = spfile_info
        files_to_check = []
        if spfile_info.get("spfile-path") and spfile_info.get("spfile-type") == "spfile":
            files_to_check = [(spfile_info["spfile-path"], "spfile")]
        else:
            files_to_check = [
                ("{}/dbs/init{}.ora".format(oracle_home, oracle_sid), "pfile"),
                ("{}/dbs/init.ora".format(oracle_home), "pfile")
            ]
        for init_path, file_type in files_to_check:
            if not os.path.exists(init_path):
                continue
            file_info = {"path": init_path, "file-type": file_type,
                         "parameter-found": False, "parameter-value": None, "error": None}
            try:
                if file_type == "spfile":
                    try:
                        grep_result = subprocess.run(
                            ['grep', '-a', '-i', 'db_file_multiblock_read_count', init_path],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10
                        )
                        if grep_result.returncode == 0:
                            file_info["parameter-found"] = True
                            grep_out = grep_result.stdout
                            if isinstance(grep_out, binary_type):
                                grep_out = grep_out.decode('utf-8', errors='replace')
                            match = re.search(r'db_file_multiblock_read_count[^\\w]*(\\d+)', grep_out, re.IGNORECASE)
                            if match:
                                file_info["parameter-value"] = match.group(1)
                            else:
                                file_info["parameter-value"] = "Parameter found but value unclear"
                        else:
                            file_info["parameter-found"] = False
                            file_info["parameter-value"] = "Parameter not found in SPFile"
                    except Exception as e:
                        file_info["error"] = "Error searching SPFile: {}".format(e)
                else:
                    try:
                        with open(init_path, 'r') as f:
                            content = f.read()
                        found = False
                        for pline in content.splitlines():
                            pline_stripped = pline.strip()
                            if not pline_stripped:
                                continue
                            if re.search(r'db_file_multiblock_read_count', pline_stripped, re.IGNORECASE):
                                if not (pline_stripped.startswith('#') or pline_stripped.startswith('*')):
                                    match = re.search(r'db_file_multiblock_read_count\\s*=\\s*([^\\s#]+)', pline_stripped, re.IGNORECASE)
                                    if match:
                                        file_info["parameter-found"] = True
                                        file_info["parameter-value"] = match.group(1).strip()
                                        found = True
                                        break
                        if not found:
                            file_info["parameter-found"] = False
                            file_info["parameter-value"] = "Parameter not found or is commented out"
                    except Exception as e:
                        file_info["error"] = "Error reading pfile: {}".format(e)
            except Exception as e:
                file_info["error"] = "Error processing file: {}".format(e)
            result["db-file-multiblock-read-count-in-init"].append(file_info)
            if file_type == "spfile":
                break
        if not result["db-file-multiblock-read-count-in-init"]:
            if spfile_info.get("spfile-path"):
                result["error"] = "SPFile path found but file does not exist: {}".format(spfile_info["spfile-path"])
            else:
                result["error"] = "No initialization files found"
    except Exception as e:
        result["error"] = str(e)
    return result


def check_asm_os_config(config, disk_groups):
    """Check ASM OS-level configuration for iSCSI environments.

    Verifies external redundancy for disk groups, and checks AFD/ASMLib
    logical block size kernel module parameters.
    """
    is_asm = check_asm_managed(config)
    result = {}
    result["isIscsi"] = "true"
    result["asm-setup"] = "false"

    if not is_asm:
        log_info("Not ASM managed, skipping ASM OS config checks")
        return result
    result["asm-setup"] = "true"

    result["asm-external-redundancy"] = {"error": "", "assessment": {
        "violations": [], "result": "", "totalObjects": len(disk_groups)
    }}
    try:
        all_external = True
        for dg in disk_groups:
            sql = """SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 500
SELECT CASE WHEN type IN ('EXTERNAL','EXTERN') THEN 'YES' ELSE 'NO' END FROM v$asm_diskgroup WHERE name = UPPER('{dg_name}');
EXIT;""".format(dg_name=dg)
            output = run_sqlplus(config, sql)
            found_answer = False
            for line in output.strip().split('\\n'):
                line = line.strip()
                if line in ('YES', 'NO'):
                    found_answer = True
                    if line == 'NO':
                        all_external = False
                        result["asm-external-redundancy"]["assessment"]["violations"].append(dg)
                    break
            if not found_answer:
                result["asm-external-redundancy"]["error"] = "Could not determine redundancy for disk group {}".format(dg)
        if not result["asm-external-redundancy"]["error"]:
            result["asm-external-redundancy"]["assessment"]["result"] = "true" if all_external else "false"
    except Exception as e:
        result["asm-external-redundancy"]["error"] = str(e)

    result["afd-logical-block-size"] = {}
    try:
        chk = subprocess.run(
            ['bash', '-c', 'lsmod | grep -w oracleafd'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
        )
        out = chk.stdout
        if isinstance(out, binary_type):
            out = out.decode('utf-8', errors='replace')
        if chk.returncode == 0 and out.strip() and 'oracleafd' in out.strip():
            result["afd-logical-block-size"]["assessment"] = {"result": ""}
            result["afd-logical-block-size"]["error"] = ""
            afd_out = subprocess.run(
                ['bash', '-c', 'cat /sys/module/oracleafd/parameters/oracleafd_use_logical_block_size'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
            )
            afd_stdout = afd_out.stdout
            if isinstance(afd_stdout, binary_type):
                afd_stdout = afd_stdout.decode('utf-8', errors='replace')
            if afd_out.returncode == 0 and afd_stdout.strip():
                result["afd-logical-block-size"]["assessment"]["result"] = afd_stdout.strip()
            else:
                afd_stderr = afd_out.stderr
                if isinstance(afd_stderr, binary_type):
                    afd_stderr = afd_stderr.decode('utf-8', errors='replace')
                result["afd-logical-block-size"]["error"] = "Command failed: {}".format(afd_stderr.strip())
    except Exception as e:
        result["afd-logical-block-size"]["error"] = "Error checking AFD module: {}".format(e)

    result["asmlib-logical-block-size"] = {}
    try:
        chk = subprocess.run(
            ['bash', '-c', 'lsmod | grep -w oracleasm'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
        )
        out = chk.stdout
        if isinstance(out, binary_type):
            out = out.decode('utf-8', errors='replace')
        if chk.returncode == 0 and out.strip() and 'oracleasm' in out.strip():
            result["asmlib-logical-block-size"]["assessment"] = {"result": ""}
            result["asmlib-logical-block-size"]["error"] = ""
            asm_out = subprocess.run(
                ['bash', '-c', 'cat /sys/module/oracleasm/parameters/use_logical_block_size'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
            )
            asm_stdout = asm_out.stdout
            if isinstance(asm_stdout, binary_type):
                asm_stdout = asm_stdout.decode('utf-8', errors='replace')
            if asm_out.returncode == 0 and asm_stdout.strip():
                result["asmlib-logical-block-size"]["assessment"]["result"] = asm_stdout.strip()
            else:
                asm_stderr = asm_out.stderr
                if isinstance(asm_stderr, binary_type):
                    asm_stderr = asm_stderr.decode('utf-8', errors='replace')
                result["asmlib-logical-block-size"]["error"] = "Command failed: {}".format(asm_stderr.strip())
    except Exception as e:
        result["asmlib-logical-block-size"]["error"] = "Error checking ASMLib module: {}".format(e)

    return result


def collect_iscsi_assessment(oracle_config, disk_groups):
    """Collect all iSCSI-specific assessment data.

    Runs OS-level checks (multipath, sanlun, iSCSI sessions, THP,
    SELinux, replacement timeout, TCP options, multipath config) and
    Oracle-level checks (iSCSI parameters, init files, ASM config).
    """
    log_info("Collecting iSCSI-specific assessment data...")
    results = {"os": {}}
    try:
        results["os"]["multipath-io"] = check_multipath_io()
    except Exception as e:
        results["os"]["multipath-io"] = {"error": str(e)}
    try:
        results["os"]["host-utilities"] = check_sanlun()
    except Exception as e:
        results["os"]["host-utilities"] = {"error": str(e)}
    try:
        results["os"]["iscsi-targets-sessions"] = check_iscsi_targets_sessions()
    except Exception as e:
        results["os"]["iscsi-targets-sessions"] = {"error": str(e)}
    try:
        results["os"]["transparent-hugepages"] = check_thp()
    except Exception as e:
        results["os"]["transparent-hugepages"] = {"error": str(e)}
    try:
        results["os"]["selinux"] = check_selinux()
    except Exception as e:
        results["os"]["selinux"] = {"error": str(e)}
    try:
        results["os"]["iscsi-replacement-timeout"] = check_iscsi_replacement_timeout()
    except Exception as e:
        results["os"]["iscsi-replacement-timeout"] = {"error": str(e)}
    try:
        results["os"]["tcp-advanced-options"] = check_tcp_features()
    except Exception as e:
        results["os"]["tcp-advanced-options"] = {"error": str(e)}
    try:
        results["os"]["multipath-configuration"] = check_multipath_configuration()
    except Exception as e:
        results["os"]["multipath-configuration"] = {"error": str(e)}
    try:
        results["oracle-parameters"] = check_oracle_iscsi_parameters(oracle_config)
    except Exception as e:
        results["oracle-parameters"] = {"error": str(e)}
    try:
        results["oracle-init-parameters"] = check_init_ora_parameters(oracle_config)
    except Exception as e:
        results["oracle-init-parameters"] = {"error": str(e)}
    try:
        results["asm-os-config"] = check_asm_os_config(oracle_config, disk_groups)
    except Exception as e:
        results["asm-os-config"] = {"error": str(e)}
    log_info("iSCSI assessment data collection completed")
    return results
`;

export { pythonNfsAssessmentFunctions, pythonIscsiAssessmentFunctions };
