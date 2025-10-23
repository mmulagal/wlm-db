import { getOracleDefaultOrUserAuthCommand, pythonLogger } from '../../../workloads/oracle/oracle-ssm-script-utils';

const CONVERT_TO_JSON = `

def coerce_value(val):
    if val is None:
        return None
    s = val.strip()
    if s == "":
        return ""
    low = s.lower()
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

const ORACLE_HOME = `
def find_oracle_home(oracle_sid):
    """Find Oracle Home by reading /etc/oratab"""

    result = {
        "oracle-home-found": None,
        "oracle-home-path": None,
        "error": None
    }
    
    try:
        oracle_home = os.environ.get('ORACLE_HOME', '')
        if oracle_home and os.path.exists(oracle_home):
            result["oracle-home-path"] = oracle_home
            return result
        
        if not os.path.exists('/etc/oratab'):
            result["error"] = "/etc/oratab file not found"
            return result
        
        with open('/etc/oratab', 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('+'):
                    continue
                # Parse the line: SID:ORACLE_HOME:Y/N
                parts = line.split(':')
                if len(parts) < 2:
                    continue
                
                sid = parts[0].strip()
                home = parts[1].strip()
                if oracle_sid:
                    if sid == oracle_sid and os.path.exists(home):
                        result["oracle-home-path"] = home
                        return result
                else:
                    if os.path.exists(home) and os.path.exists(os.path.join(home, 'bin', 'sqlplus')):
                        result["oracle-home-path"] = home
                        return result
        if oracle_sid:
            result["error"] = f"Oracle Home not found for SID '{oracle_sid}' in /etc/oratab"
        else:
            result["error"] = "No valid Oracle Home found in /etc/oratab"
    except Exception as e:
        result["error"] = f"Error reading /etc/oratab: {str(e)}"
    return result
`;

const GET_ORACLE_SPFILE = `
def get_oracle_spfile():
    """Get the current spfile used by Oracle instance"""
    
    oracle_sid = os.environ.get('ORACLE_SID', '')
    sqlplus_cmd = os.environ.get('SQLPLUS_CMD', '')
    
    result = {
        "spfile-path": None,
        "spfile-type": None,
        "is-default": False,
        "error": None
    }
    
    if not sqlplus_cmd:
        result["error"] = "SQLPLUS_CMD not set"
        return result
    
    if not oracle_sid:
        result["error"] = "ORACLE_SID not set"
        return result
    
    try:
        cmd_parts = sqlplus_cmd.split()
        env = os.environ.copy()
        env['ORACLE_SID'] = oracle_sid
        
        sql_query = """SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 4000
SET TRIMSPOOL ON
SELECT JSON_OBJECT(
    'name' VALUE name,
    'type' VALUE type,
    'value' VALUE value,
    'isdefault' VALUE isdefault
) AS spfile_param
FROM v\\$parameter 
WHERE name = 'spfile';
EXIT;
"""
        
        spfile_result = subprocess.run(
            cmd_parts,
            input=sql_query,
            env=env,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            universal_newlines=True,
            timeout=30
        )
        
        if spfile_result.returncode == 0:
            output = spfile_result.stdout.strip()
            
            # Find the JSON line in the output
            for line in output.split('\\n'):
                line = line.strip()
                if line.startswith('{') and line.endswith('}'):
                    try:
                        param_info = json.loads(line)
                        
                        # Extract spfile parameter information
                        spfile_value = param_info.get("value")
                        is_default = param_info.get("isdefault")
                        
                        # Set is-default
                        result["is-default"] = is_default == "TRUE" if is_default else False
                        
                        # Check if Oracle is using an spfile
                        if spfile_value and spfile_value.lower() not in ['', 'null', '(null)']:
                            result["spfile-path"] = spfile_value
                            result["spfile-type"] = "spfile"
                        else:
                            result["spfile-path"] = None
                            result["spfile-type"] = "pfile"
                        
                        break
                        
                    except json.JSONDecodeError as e:
                        result["error"] = f"JSON parse error: {str(e)}"
                        break
            else:
                result["error"] = f"No valid JSON found in output: {output}"
                
        else:
            result["error"] = f"SQL query failed: {spfile_result.stderr.strip()}"
            
    except subprocess.TimeoutExpired:
        result["error"] = "SQL query timed out"
    except Exception as e:
        result["error"] = f"Error running SQL query: {str(e)}"
    
    return result
`;

const CHECK_INIT_ORA_PARAMETERS = `

${GET_ORACLE_SPFILE}

# Check init.ora and spfile for db_file_multiblock_read_count parameter
def check_init_ora_parameters():

    oracle_sid = os.environ.get('ORACLE_SID', '')

    result = {
        "db-file-multiblock-read-count-in-init": [],
        "current-spfile-info": None,
        "error": None
    }
    
    try:
        oracle_home_result = find_oracle_home(oracle_sid)
        oracle_home = oracle_home_result.get("oracle-home-path")

        if not oracle_home or not oracle_sid:
            result["error"] = "ORACLE_HOME or ORACLE_SID not set"
            return result
    
        # First, get the current spfile information
        spfile_info = get_oracle_spfile()
        result["current-spfile-info"] = spfile_info
        
        files_to_check = []
        
        if spfile_info.get("spfile-path") and spfile_info.get("spfile-type") == "spfile":
            # Oracle is using an spfile, check that specific file
            spfile_path = spfile_info["spfile-path"]
            files_to_check = [(spfile_path, "spfile")]
        else:
            # Oracle is using pfile, check traditional init files
            files_to_check = [
                (f"{oracle_home}/dbs/init{oracle_sid}.ora", "pfile"),
                (f"{oracle_home}/dbs/init.ora", "pfile")
            ]
        
        for init_path, file_type in files_to_check:
            if os.path.exists(init_path):
                file_info = {
                    "path": init_path,
                    "file-type": file_type,
                    "parameter-found": False,
                    "parameter-value": None,
                    "error": None
                }
                    
                try:
                    if file_type == "spfile":
                        try:
                            grep_result = subprocess.run(
                                ['grep', '-a', '-i', 'db_file_multiblock_read_count', init_path],
                                stdout=subprocess.PIPE, 
                                stderr=subprocess.PIPE, 
                                universal_newlines=True, 
                                timeout=10
                            )
                            
                            if grep_result.returncode == 0:
                                file_info["parameter-found"] = True
                                grep_output = grep_result.stdout.strip()
                                
                                # Try to extract value from grep output
                                match = re.search(r'db_file_multiblock_read_count[^\\w]*(\\d+)', grep_output, re.IGNORECASE)
                                if match:
                                    file_info["parameter-value"] = match.group(1)
                                else:
                                    file_info["parameter-value"] = "Parameter found but value unclear from binary search"
                            else:
                                file_info["parameter-found"] = False
                                file_info["parameter-value"] = "Parameter not found in SPFile"
                        
                        except subprocess.TimeoutExpired:
                            file_info["error"] = "SPFile search timed out"
                        except FileNotFoundError:
                            file_info["error"] = "grep command not available"
                        except Exception as e:
                            file_info["error"] = f"Error searching SPFile: {str(e)}"
                    
                    else:  # pfile
                        try:
                            with open(init_path, 'r') as f:
                                content = f.read()
                    
                            found_parameter = False
                            for line_num, line in enumerate(content.splitlines(), 1):
                                line_stripped = line.strip()
                                
                                if not line_stripped:
                                    continue
                                if re.search(r'db_file_multiblock_read_count', line_stripped, re.IGNORECASE):
                                    # Check if it's commented out
                                    is_commented = line_stripped.startswith('#') or line_stripped.startswith('*')
                                    if not is_commented:
                                        match = re.search(r'db_file_multiblock_read_count\\s*=\\s*([^\\s#]+)', line_stripped, re.IGNORECASE)
                                        if match:
                                            file_info["parameter-found"] = True
                                            file_info["parameter-value"] = match.group(1).strip()
                                            found_parameter = True
                                            break
                            
                            if not found_parameter:
                                file_info["parameter-found"] = False
                                file_info["parameter-value"] = "Parameter not found or is commented out"
                        except Exception as e:
                            file_info["error"] = f"Error reading pfile: {str(e)}"
                    
                except Exception as e:
                    file_info["error"] = f"Error processing file: {str(e)}"
                
                # Add file info to the list
                result["db-file-multiblock-read-count-in-init"].append(file_info)
                
                # If we found the spfile, we only need to check that one file
                if file_type == "spfile":
                    break
        
        # If no files were found or checked
        if not result["db-file-multiblock-read-count-in-init"]:
            if spfile_info.get("spfile-path"):
                result["error"] = f"SPFile path found but file does not exist: {spfile_info['spfile-path']}"
            else:
                result["error"] = "No initialization files found"
            
    except Exception as e:
        result["error"] = str(e)

    return result
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
        # Set up environment with additional PATH entries
        env = os.environ.copy()
        current_path = env.get('PATH', '')
        additional_paths = ':/usr/sbin:/usr/bin:/opt/netapp:/opt/netapp/sanlun/bin'
        env['PATH'] = current_path + additional_paths
        
        result = subprocess.run(['sanlun', 'version'], env=env,
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

const ASM_OS_CONFIG_ASSESSMENTS = (diskGroups: string[]) => `
def check_asm_os_config(isAsmManaged, isIscsi):
    disk_groups = json.loads('${JSON.stringify(diskGroups)}')
    log('Checking ASM related OS configurations')
    result = {}
    result['isIscsi'] = 'true'
    result['asm-setup'] = 'false'
    result.setdefault('asm-external-redundancy', {})
    result.setdefault('afd-logical-block-size', {})
    result.setdefault('asmlib-logical-block-size', {})

    if isIscsi.lower() != 'true':
        log('Not an iSCSI setup, skipping ASM OS config checks')
        result['isIscsi'] = 'false'
        return result
    else:
        result['isIscsi'] = 'true'
    if isAsmManaged.lower() != 'true':
        log('Not an ASM managed setup, skipping ASM OS config checks')
        result['asm-setup'] = 'false'
        return result
    else:
        result['asm-setup'] = 'true'

    # Check asm_external_redundancy parameter

    try:
        sqlplus_cmd = os.environ.get('SQLPLUS_CMD', '')
        oracle_sid = os.environ.get('ORACLE_SID', '')
        result['asm-external-redundancy']['error'] = ''
        result['asm-external-redundancy']['assessment'] = {}
        result['asm-external-redundancy']['assessment']['violations'] = []
        result['asm-external-redundancy']['assessment']['result'] = ''
        result['asm-external-redundancy']['assessment']['totalObjects'] = len(disk_groups)
        instanceLevelRedundancy = True
        for dg in disk_groups:
            if not sqlplus_cmd:
                result['asm-external-redundancy']['error'] = "SQLPLUS_CMD not set"
                break;
            cmd_parts = sqlplus_cmd.split()
            env = os.environ.copy()
            env['ORACLE_SID'] = oracle_sid
            sql_query = """SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 4000
SET TRIMSPOOL ON
SELECT CASE WHEN type IN ('EXTERNAL','EXTERN') THEN 'YES' ELSE 'NO' END AS is_external FROM v\\$asm_diskgroup WHERE name = UPPER('{dg}');
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
                if output == 'NO':
                    instanceLevelRedundancy = instanceLevelRedundancy and False
                    result['asm-external-redundancy']['assessment']['violations'].append(dg)
            else:
                result['asm-external-redundancy']['error'] = f"sqlplus failed: {result_proc.stderr}"
                break;
        if result['asm-external-redundancy']['error'] == '':
            if instanceLevelRedundancy:
                result['asm-external-redundancy']['assessment']['result'] = 'true'
            else:
                result['asm-external-redundancy']['assessment']['result'] = 'false'
    except Exception as e:
        result['asm-external-redundancy']['error'] = f"Error: {str(e)}"

    
    # AFD logical block size check
    try:
        checkAFDModuleCmd = 'lsmod | grep -w oracleafd'
        result_proc = subprocess.run(['bash', '-c', checkAFDModuleCmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
        if result_proc.returncode == 0 and result_proc.stdout.strip() and ('oracleafd' in result_proc.stdout.strip()):
            result['afd-logical-block-size']['assessment'] = {}
            result['afd-logical-block-size']['error'] = ''
            result['afd-logical-block-size']['assessment']['result'] = ''
            afdBlockSizeCmd = 'cat /sys/module/oracleafd/parameters/oracleafd_use_logical_block_size'
            afdBlockSizeCmdOutput = subprocess.run(['bash', '-c', checkAFDModuleCmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if afdBlockSizeCmdOutput.returncode == 0 and afdBlockSizeCmdOutput.stdout.strip():
                result['afd-logical-block-size']['result'] = afdBlockSizeCmdOutput.stdout.strip()
            else:
                result['afd-logical-block-size']['error'] = f"Command failed: {afdBlockSizeCmdOutput.stderr.strip()}"
        elif result_proc.returncode != 0:
            result['afd-logical-block-size'] = {}
    except Exception as e:
        result['afd-logical-block-size']['error'] = f"Error checking AFD module: {str(e)}"
    
    # ASMLib logical block size check
    try:
        checkASMLibModuleCmd = 'lsmod | grep -w oracleasm'
        result_proc = subprocess.run(['bash', '-c', checkASMLibModuleCmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
        if result_proc.returncode == 0 and result_proc.stdout.strip() and ('oracleasm' in result_proc.stdout.strip()):
            result['asmlib-logical-block-size']['assessment'] = {}
            result['asmlib-logical-block-size']['error'] = ''
            result['asmlib-logical-block-size']['assessment']['result'] = ''
            asmLibBlockSizeCmd = 'cat /sys/module/oracleasm/parameters/use_logical_block_size'
            asmLibBlockSizeCmdOutput = subprocess.run(['bash', '-c', asmLibBlockSizeCmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
            if asmLibBlockSizeCmdOutput.returncode == 0 and asmLibBlockSizeCmdOutput.stdout.strip():
                result['asmlib-logical-block-size']['assessment']['result'] = asmLibBlockSizeCmdOutput.stdout.strip()
            else:
                result['asmlib-logical-block-size']['error'] = f"Command failed: {asmLibBlockSizeCmdOutput.stderr.strip()}"
        elif result_proc.returncode != 0:
            result['asmlib-logical-block-size'] = {}
    except Exception as e:
        result['asmlib-logical-block-size']['error'] = f"Error checking ASMLib module: {str(e)}"

    return result
`;

const OS_ASSESSMENT = (
    ec2InstanceId: string,
    dbSid: string,
    protocol: string,
    isAsmManaged: boolean,
    diskGroups?: string[]
) => `

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

OS_RESULTS=$($PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess
import re
import datetime
from pathlib import Path

${pythonLogger('storageOsAssessment.log')}

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
import re
import datetime

${pythonLogger('storageOsAssessment.log')}

${CHECK_ORACLE_PARAMETERS}

${ORACLE_HOME}

${CHECK_INIT_ORA_PARAMETERS}

${ASM_OS_CONFIG_ASSESSMENTS(diskGroups || [])}

# Run Oracle parameters check
oracle_params_result = get_oracle_parameters()

# Run init.ora/spfile check
oracle_init_params = check_init_ora_parameters()

# ASM OS config checks (only if ASM managed and iSCSI)
protocol = '${protocol.toLowerCase()}'
isAsmManaged = '${isAsmManaged ? 'true' : 'false'}'
isIscsi = 'true' if protocol == 'iscsi' else 'false'
asm_os_config = check_asm_os_config(isAsmManaged, isIscsi)


print(json.dumps({"oracle-parameters": oracle_params_result, "oracle-init-parameters": oracle_init_params, "asm_os_config": asm_os_config}))

PYTHON
ORACLE_SHELL
)

$PYTHON_LATEST <<PYTHON
import os
import json
import sys
import datetime

${pythonLogger('storageOsAssessment.log')}

log('Combining OS and Oracle results')

try:
    os_results = json.loads('$OS_RESULTS')
    oracle_results = json.loads("""$ORACLE_RESULTS""")
    
    # Add oracle-parameters to the os section
    os_results["os"]["oracle-parameters"] = oracle_results.get("oracle-parameters", {})
    os_results["os"]["oracle-parameters-from-init"] = oracle_results.get("oracle-init-parameters", {})
    os_results["os"]["asm-os-config"] = oracle_results.get("asm_os_config", {})

    print(json.dumps(os_results))
except Exception as e:
    log(f'Exception while combining results: {str(e)}')
    print(json.dumps({"error": f"Failed to combine results: {str(e)}"}))

PYTHON

`;

export { OS_ASSESSMENT, CHECK_TCP_FEATURES, CHECK_ISCSI_REPLACEMENT_TIMEOUT, CHECK_ISCSI_TARGETS_SESSIONS };
