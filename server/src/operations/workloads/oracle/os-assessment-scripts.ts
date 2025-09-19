import { getOracleDefaultOrUserAuthCommand, pythonLogger } from './oracle-ssm-script-utils';

const CONVERT_TO_JSON = `

def coerce_value(val):
    if val is None:
        return None
    s = val.strip()
    if s == "":
        return ""
    low = s.lower()
    if low in ("yes","y","true","on"):
        return True
    if low in ("no","n","false","off"):
        return False
    if low == "infinity":
        return s
    if re.fullmatch(r'-?\\d+', s):
        try: return int(s)
        except: pass
    if re.fullmatch(r'-?\\d+\\.\\d+', s):
        try: return float(s)
        except: pass
    return s

section_start = re.compile(r'^\\s*([^\\s{]+)\\s*\\{\\s*$')
key_value_re = re.compile(r'^\\s*([A-Za-z0-9_]+)\\s+(?:"([^"]*)"|(.+?))\\s*$')

def parse(text):
    root = {}
    stack = [root]
    for raw in text.splitlines():
        if not raw.strip() or raw.strip().startswith('#'):
            continue
        if raw.strip() == '}':
            if len(stack) > 1:
                stack.pop()
            continue
        msec = section_start.match(raw)
        if msec:
            name = msec.group(1)
            parent = stack[-1]
            new = {}
            if isinstance(parent, dict):
                if name in parent:
                    if isinstance(parent[name], list):
                        parent[name].append(new)
                    else:
                        parent[name] = [parent[name], new]
                else:
                    parent[name] = new
            elif isinstance(parent, list):
                parent.append({name: new})
            stack.append(new)
            continue
        mkv = key_value_re.match(raw)
        if mkv:
            key = mkv.group(1)
            val = mkv.group(2) if mkv.group(2) is not None else mkv.group(3)
            val = "" if val is None else val.strip()
            val = coerce_value(val)
            cur = stack[-1]
            if key in cur:
                if isinstance(cur[key], list):
                    cur[key].append(val)
                else:
                    cur[key] = [cur[key], val]
            else:
                cur[key] = val
            continue
        # ignore unknown lines
    return root
`;

const CHECK_ORACLE_PARAMETERS = `
# Check init options for filesystemio_options and db_file_multiblock_read_count
def get_oracle_parameters():
    sqlplus_cmd = os.environ.get('SQLPLUS_CMD', '')
    oracle_sid = os.environ.get('ORACLE_SID', '')
    
    result = {
        "filesystemio-options": {"found": False, "value": None},
        "db-file-multiblock-read-count": {"found": False, "value": None},
        "error": None
    }
    
    if not sqlplus_cmd:
        result["error"] = "SQLPLUS_CMD not set"
        return result
    
    try:
        cmd_parts = sqlplus_cmd.split()
        env = os.environ.copy()
        env['ORACLE_SID'] = oracle_sid
        
        # Simple SQL query that returns JSON
        sql_query = """SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 4000
SET TRIMSPOOL ON
SELECT JSON_OBJECT(
    'filesystemio_options' VALUE (SELECT value FROM v\\$parameter WHERE name = 'filesystemio_options'),
    'db_file_multiblock_read_count' VALUE (SELECT value FROM v\\$parameter WHERE name = 'db_file_multiblock_read_count')
) AS params FROM dual;
EXIT;
"""
        
        result_proc = subprocess.run(
            cmd_parts,
            input=sql_query,
            env=env,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            universal_newlines=True,
            timeout=30
        )
        
        if result_proc.returncode == 0:
            output = result_proc.stdout.strip()
            
            # Find the JSON line
            for line in output.split('\\n'):
                line = line.strip()
                if line.startswith('{') and line.endswith('}'):
                    try:
                        params = json.loads(line)
                        
                        # Check filesystemio-options
                        if params.get('filesystemio_options'):
                            result["filesystemio-options"]["found"] = True
                            result["filesystemio-options"]["value"] = params['filesystemio_options']

                        # Check db-file-multiblock-read-count
                        if params.get('db_file_multiblock_read_count'):
                            result["db-file-multiblock-read-count"]["found"] = True
                            result["db-file-multiblock-read-count"]["value"] = params['db_file_multiblock_read_count']

                        break
                        
                    except json.JSONDecodeError as e:
                        result["error"] = f"JSON parse error: {str(e)}"
                        break
            else:
                result["error"] = f"No valid JSON found in output: {output}"
        else:
            result["error"] = f"sqlplus failed: {result_proc.stderr}"
            
    except Exception as e:
        result["error"] = f"Error: {str(e)}"

    return result
`;

const CHECK_MULTIPATH_IO_STATUS = `
# Check if multipath I/O is enabled and active
def check_multipath_io():
    log('Checking multipath I/O status')
    try:
        # Single command to check if multipathd service is active and enabled
        result = subprocess.run(['bash', '-c', 'systemctl is-active multipathd && systemctl is-enabled multipathd'], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)

        output_lines = result.stdout.strip().split('\\n')
        is_active = len(output_lines) > 0 and output_lines[0] == 'active'
        is_enabled = len(output_lines) > 1 and output_lines[1] == 'enabled'
        
        log(f'multipathd active: {is_active}, enabled: {is_enabled}')
        return {
            "multipath-io-is-active": is_active, 
            "multipath-io-is-enabled": is_enabled,
            "multipath-io-active-value": output_lines[0] if output_lines else "unknown",
            "multipath-io-enabled-value": output_lines[1] if len(output_lines) > 1 else "unknown",
            "error": None
        }
        
    except Exception as e:
        log(f'Exception while checking multipath I/O status: {str(e)}')
        return {
            "multipath-io-is-active": False, 
            "multipath-io-is-enabled": False,
            "multipath-io-active-value": "unknown",
            "multipath-io-enabled-value": "unknown", 
            "error": str(e)
        }
`;

const CHECK_SANLUN = `
# Check if ONTAP sanlun is installed and get version
def check_sanlun():
    log('Checking ONTAP sanlun installation and version')
    try:
        result = subprocess.run(['sanlun', 'version'], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)

        if result.returncode == 0:
            version_output = result.stdout.strip()
            log(f'ONTAP sanlun version: {version_output}')
            return {
                "sanlun-installed": True,
                "sanlun-version": version_output,
                "error": None
            }
        else:
            log(f'sanlun command failed: {result.stderr.strip()}')
            return {
                "sanlun-installed": False,
                "sanlun-version": None,
                "error": "sanlun command failed"
            }
            
    except FileNotFoundError:
        log('sanlun command not found')
        return {
            "sanlun-installed": False,
            "sanlun-version": None,
            "error": "sanlun command not found"
        }
    except Exception as e:
        log(f'Exception while checking sanlun: {str(e)}')
        return {
            "sanlun-installed": False,
            "sanlun-version": None,
            "error": str(e)
        }      
`;

const CHECK_ISCSI_TARGETS_SESSIONS = `
# Check iSCSI targets and sessions
def check_iscsi_targets_sessions():
    log('Checking iSCSI targets and sessions')
    try:
        targets = []
        target_sessions = {}
        ip_re = re.compile(r'(\\d{1,3}(?:\\.\\d{1,3}){3})')

        # Get configured targets (use the IP as the target_name)
        try:
            targets_result = subprocess.run(['iscsiadm', '-m', 'node'],
                                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)

            if targets_result.returncode == 0 and targets_result.stdout.strip():
                for line in targets_result.stdout.strip().split('\\n'):
                    if not line.strip():
                        continue
                    m = ip_re.search(line)
                    if m:
                        ip = m.group(1)
                        targets.append({
                            "portal": line.strip(),
                            "target_name": ip,
                            "active_sessions": 0
                        })
                        # initialize count if not present
                        if ip not in target_sessions:
                            target_sessions[ip] = 0
        except Exception as e:
            log(f'Exception while checking iSCSI targets: {str(e)}')
            pass

        # Count active sessions per IP (session lines may contain the portal IP)
        try:
            sessions_result = subprocess.run(['iscsiadm', '-m', 'session'],
                                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)

            if sessions_result.returncode == 0 and sessions_result.stdout.strip():
                for line in sessions_result.stdout.strip().split('\\n'):
                    if not line.strip():
                        continue
                    m = ip_re.search(line)
                    if m:
                        ip = m.group(1)
                        target_sessions[ip] = target_sessions.get(ip, 0) + 1
        except Exception as e:
            log(f'Exception while checking iSCSI sessions: {str(e)}')
            pass

        # Update active sessions count on targets list
        for target in targets:
            target["active_sessions"] = target_sessions.get(target["target_name"], 0)

        log(f'iSCSI targets found: {len(set(t["target_name"] for t in targets))}')
        return {
            "iscsi-targets-found": len(set(t["target_name"] for t in targets)),
            "iscsi-targets": targets,
            "iscsi-sessions-per-target": target_sessions,
            "total-active-sessions": sum(target_sessions.values()),
            "error": None
        }

    except Exception as e:
        log(f'Exception while checking iSCSI targets and sessions: {str(e)}')
        return {
            "iscsi-targets-found": 0,
            "iscsi-targets": [],
            "iscsi-sessions-per-target": {},
            "total-active-sessions": 0,
            "error": str(e)
        }

`;

const CHECK_TRANSPARENT_HUGEPAGE = `
# Check if Transparent Hugepages are enabled
def check_thp():
    log('Checking Transparent Hugepages status')
    try:
        content = Path('/sys/kernel/mm/transparent_hugepage/enabled').read_text()
        disabled = '[never]' in content  # This is correct - disabled when [never]
        
        # Fix the status logic
        if '[never]' in content:
            status = "disabled"
        elif '[always]' in content:
            status = "always"
        elif '[madvise]' in content:
            status = "madvise"
        else:
            status = "unknown"

        log(f'Transparent Hugepages status: {status}, disabled: {disabled}')
        return {"thp-disabled": disabled, "thp-value": status, "error": None}
    except Exception as e:
        log(f'Exception while checking Transparent Hugepages: {str(e)}')
        return {"thp-disabled": False, "thp-value": "unknown", "error": str(e)}

`;

const CHECK_SELINUX = `
# Check if SELinux is disabled
def check_selinux():
    log('Checking SELinux status')
    try:
        # Use getenforce command
        try:
            result = subprocess.run(['getenforce'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if result.returncode == 0:
                status = result.stdout.strip().lower()
                if status == 'disabled':
                    return {"selinux-disabled": True, "selinux-value": "disabled", "error": None}
                elif status == 'enforcing':
                    return {"selinux-disabled": False, "selinux-value": "enforcing", "error": None}
                elif status == 'permissive':
                    return {"selinux-disabled": False, "selinux-value": "permissive", "error": None}
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            log(f'Exception while checking SELinux status: {str(e)}')
            pass
        
        # If no methods work, SELinux is likely not installed/available
        log('SELinux not available on this system')
        return {"selinux-disabled": True, "selinux-value": "not_available", "error": None}

    except Exception as e:
        log(f'Exception while checking SELinux: {str(e)}')
        return {"selinux-disabled": False, "selinux-value": "unknown", "error": str(e)}
`;

const CHECK_ISCSI_REPLACEMENT_TIMEOUT = `
# Check if iSCSI replacement timeout 
def check_iscsi_replacement_timeout():
    log('Checking iSCSI replacement timeout')
    try:
        config = Path('/etc/iscsi/iscsid.conf').read_text()
        for line in config.split('\\n'):
            if 'node.session.timeo.replacement_timeout' in line and not line.strip().startswith('#'):
                timeout_value = int(line.split('=')[1].strip())
                return {"replacement-timeout": timeout_value, "error": None}
        log('replacement_timeout not found in config')
        return {"replacement-timeout": None, "error": "replacement_timeout not found in config"}
    except Exception as e:
        log(f'Exception while checking iSCSI replacement timeout: {str(e)}')
        return {"replacement-timeout": None, "error": str(e)}
`;

const CHECK_TCP_FEATURES = `
# Check if TCP features are enabled
def check_tcp_features():
    log('Checking TCP advanced features')
    try:
        results = {}
        
        # Check TCP timestamps
        try:
            result = subprocess.run(['sysctl', '-n', 'net.ipv4.tcp_timestamps'], 
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if(result.returncode != 0):
                raise Exception(f'sysctl command failed: {result.stderr.strip()}')
            tcp_timestamps = result.stdout.strip()
            results["tcp-timestamps-enabled"] = tcp_timestamps == "1"
            results["tcp-timestamps-value"] = tcp_timestamps
        except Exception as e:
            log(f'Exception while checking TCP timestamps: {str(e)}')
            results["tcp-timestamps-enabled"] = None
            results["tcp-timestamps-value"] = None
            results["tcp-timestamps-error"] = str(e)

        # Check TCP SACK
        try:
            result = subprocess.run(['sysctl', '-n', 'net.ipv4.tcp_sack'], 
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if(result.returncode != 0):
                raise Exception(f'sysctl command failed: {result.stderr.strip()}')
            tcp_sack = result.stdout.strip()
            results["tcp-sack-enabled"] = tcp_sack == "1"
            results["tcp-sack-value"] = tcp_sack
        except Exception as e:
            log(f'Exception while checking TCP SACK: {str(e)}')
            results["tcp-sack-enabled"] = None
            results["tcp-sack-value"] = None
            results["tcp-sack-error"] = str(e)

        # Check TCP window scaling
        try:
            result = subprocess.run(['sysctl', '-n', 'net.ipv4.tcp_window_scaling'], 
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if(result.returncode != 0):
                raise Exception(f'sysctl command failed: {result.stderr.strip()}')
            tcp_window_scaling = result.stdout.strip()
            results["tcp-window-scaling-enabled"] = tcp_window_scaling == "1"
            results["tcp-window-scaling-value"] = tcp_window_scaling
        except Exception as e:
            log(f'Exception while checking TCP window scaling: {str(e)}')
            results["tcp-window-scaling-enabled"] = None
            results["tcp-window-scaling-value"] = None
            results["tcp-window-scaling-error"] = str(e)

        log(f'TCP advanced features status: {results}')
        return {"tcp-features": results, "error": None}
        
    except Exception as e:
        log(f'Exception while checking TCP features: {str(e)}')
        return {"tcp-features": None, "error": str(e)}
`;

const CHECK_MULTIPATH_CONFIGURATION = `

${CONVERT_TO_JSON}

# Check multipath configuration by calling multipathd and parsing output
def check_multipath_configuration():
    log('Checking multipath configuration')
    try:
        response = subprocess.run(['multipathd', 'show', 'config'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=10)
        if response.returncode != 0:
            return {"multipath-config-found": False, "error": response.stderr.strip(), "config": None}

        text = response.stdout
        parsed = parse(text)
        
        # Extract defaults section (parser may return dict or list)
        defaults = parsed.get('defaults') if isinstance(parsed, dict) else None
        if isinstance(defaults, list):
            defaults = defaults[0] if defaults else {}
        if defaults is None:
            defaults = {}

        find_multipaths_val = defaults.get('find_multipaths')
        user_friendly_names_val = defaults.get('user_friendly_names')
        polling_interval_val = defaults.get('polling_interval')

        # Now look for the NETAPP device entry with required properties
        netapp_found = False
        netapp_match = None

        devices_section = parsed.get('devices') if isinstance(parsed, dict) else None
        device_entries = []
        if isinstance(devices_section, dict):
            device_entries = devices_section.get('device')
        if isinstance(device_entries, dict):
            device_entries = [device_entries]
        if not device_entries:
            device_entries = device_entries or []

        for dev in device_entries:
            if not isinstance(dev, dict):
                continue
            vendor = (dev.get('vendor') or "").strip()
            product = (dev.get('product') or "").strip()

            # match vendor NETAPP and product starting with LUN (case-insensitive)
            if not (re.search(r'(?i)netapp', vendor) and re.search(r'(?i)^lun', product)):
                continue

            # check properties (tolerant matching for types)
            def eq(val, expected):
                if val is None:
                    return False
                if isinstance(expected, bool):
                    return val is expected
                try:
                    return str(val).lower() == str(expected).lower()
                except:
                    return val == expected

            netapp_found = True
            netapp_match = dev
            break

        log(f'Multipath configuration found: {netapp_found}, defaults: {defaults}, netapp device: {netapp_match}')

        return {
            "multipath-config-found": True,
            "error": None,
            "defaults": {
                "find_multipaths": find_multipaths_val,
                "user_friendly_names": user_friendly_names_val,
                "polling_interval": polling_interval_val
            },
            "netapp-device": netapp_match
        }
    except FileNotFoundError:
        log('multipathd not found')
        return {"multipath-config-found": False, "error": "multipathd not found", "defaults": None, "netapp-device": None}
    except Exception as e:
        log(f'Exception while checking multipath configuration: {str(e)}')
        return {"multipath-config-found": False, "error": str(e), "defaults": None, "netapp-device": None}

`;

const OS_ASSESSMENT = (ec2InstanceId: string, dbSid: string) => `

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

OS_RESULTS=$($PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess
import re
import datetime
from pathlib import Path

${pythonLogger('storage-assessment.log')}

${CHECK_MULTIPATH_IO_STATUS}

${CHECK_SANLUN}

${CHECK_ISCSI_TARGETS_SESSIONS}

${CHECK_TRANSPARENT_HUGEPAGE}

${CHECK_SELINUX}

${CHECK_ISCSI_REPLACEMENT_TIMEOUT}

${CHECK_TCP_FEATURES}

${CHECK_MULTIPATH_CONFIGURATION}

# Run all checks and compile results
log('Collecting all os configuration data')
def run_all_checks():
    results = {"os": {}}
    results["os"]["multipath-io"] = check_multipath_io()
    results["os"]["host-utilities"] = check_sanlun()
    results["os"]["iscsi-targets-sessions"] = check_iscsi_targets_sessions()
    results["os"]["transparent-hugepages"] = check_thp()
    results["os"]["selinux"] = check_selinux()
    results["os"]["iscsi-replacement-timeout"] = check_iscsi_replacement_timeout()
    results["os"]["tcp-advanced-options"] = check_tcp_features()
    results["os"]["multipath-configuration"] = check_multipath_configuration()
    return results

log('Running all OS checks')
all_results = run_all_checks()
print(json.dumps(all_results))

PYTHON
)

ORACLE_RESULTS=$(sudo -i -u oracle bash <<ORACLE_SHELL
export SQLPLUS_CMD="$sqlplus_command"
export ORACLE_SID="${dbSid}"

$PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess

${CHECK_ORACLE_PARAMETERS}

# Run Oracle parameters check
oracle_params_result = get_oracle_parameters()

print(json.dumps(oracle_params_result))

PYTHON
ORACLE_SHELL
)

$PYTHON_LATEST <<PYTHON
import os
import json
import sys
import datetime

${pythonLogger('storage-assessment.log')}

log('Combining OS and Oracle results')

try:
    os_results = json.loads('$OS_RESULTS')
    oracle_results = json.loads('$ORACLE_RESULTS')
    
    # Add oracle-parameters to the os section
    os_results["os"]["oracle-parameters"] = oracle_results
    
    print(json.dumps(os_results))
except Exception as e:
    log(f'Exception while combining results: {str(e)}')
    print(json.dumps({"error": f"Failed to combine results: {str(e)}"}))

PYTHON

`;

export { OS_ASSESSMENT };
