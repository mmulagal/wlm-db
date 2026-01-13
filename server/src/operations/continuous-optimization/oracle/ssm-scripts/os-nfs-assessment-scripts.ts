import { getOracleDefaultOrUserAuthCommand, pythonLogger } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const KERNEL_TCP_SLOT_PARAMETERS = `
# Check sunrpc TCP slot table entries
def check_sunrpc_tcp_slot_entries():
    log('Checking sunrpc TCP slot table entries')
    try:
        # Check both sunrpc parameters in a single call
        result = subprocess.run(['sysctl', '-n', 'sunrpc.tcp_max_slot_table_entries', 'sunrpc.tcp_slot_table_entries'], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=5)
        
        if result.returncode != 0:
            error_msg = f'sysctl command failed: {result.stderr.strip()}'
            log(error_msg)
            return {"sunrpc-tcp-slot-entries": None, "error": error_msg}
        
        values = result.stdout.strip().split('\\n')
        results = {}
        
        # Process values
        params = ['tcp-max-slot-table', 'tcp-slot-table']
        for i, param in enumerate(params):
            if i < len(values) and values[i]:
                value = values[i]
                results[param] =  value
            else:
                results[param] = None

        log(f'sunrpc TCP slot table entries status: {results}')
        return {"sunrpc-tcp-slot-entries": results, "error": None}
        
    except Exception as e:
        error_msg = f'Exception while checking sunrpc TCP slot entries: {str(e)}'
        log(error_msg)
        return {"sunrpc-tcp-slot-entries": None, "error": error_msg}
`;

const NFS_MOUNT_OPTIONS = `
def get_nfs_mount_options():
    """Fetch NFS mount point options for database files"""
    try:
        # Get all mount points
        result = subprocess.run(['mount', '-t', 'nfs,nfs4'], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                              universal_newlines=True, timeout=10)
        
        if result.returncode != 0:
            error_msg = f'mount command failed: {result.stderr.strip()}'
            return {"nfs-mount-options": None, "error": error_msg}
        
        mount_info = []
        lines = result.stdout.strip().split('\\n')
        
        # Parse fstab for bg and nointr options
        fstab_options = {}
        try:
            with open('/etc/fstab', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split()
                        if len(parts) >= 4:
                            device, mount_point, fs_type, options = parts[0], parts[1], parts[2], parts[3]
                            if fs_type in ['nfs', 'nfs4']:
                                fstab_options[mount_point] = options
        except Exception as e:
            pass
        
        mount_data = []
        for line in lines:
            if not line.strip():
                continue

            match = re.match(r'^([^:]+):(\\S+)\\s+on\\s+(\\S+)\\s+type\\s+(\\w+)\\s+\\(([^)]+)\\)$', line)
            if match:
                server, remote_path, mount_point, fs_type, options = match.groups()
                mount_data.append((mount_point, server, remote_path, fs_type, options))
        
        mount_data.sort(key=lambda x: len(x[0]))
        processed_mounts = []
        for mount_point, server, remote_path, fs_type, options in mount_data:
            # Check if this is a subdirectory of any already processed mount
            is_subdirectory = any(mount_point.startswith(existing + '/') for existing, _, _, _, _ in processed_mounts)

            if is_subdirectory:
                continue

            # Parse options into dictionary
            option_dict = {}
            for opt in options.split(','):
                if '=' in opt:
                    key, value = opt.split('=', 1)
                    option_dict[key] = value
                else:
                    option_dict[opt] = True
                
            # Check fstab for bg and nointr options
            fstab_opts = fstab_options.get(mount_point, '')
            fstab_option_dict = {}
            if fstab_opts:
                for opt in fstab_opts.split(','):
                    if '=' in opt:
                        key, value = opt.split('=', 1)
                        fstab_option_dict[key] = value
                    else:
                        fstab_option_dict[opt] = True
            
            # Add bg and nointr status from fstab
            option_dict['bg'] = fstab_option_dict.get('bg', False)
            option_dict['nointr'] = fstab_option_dict.get('nointr', False)
            
            mount_info.append({
                'server': server,
                'remote-path': remote_path,
                'mount-point': mount_point,
                'filesystem-type': fs_type,
                'options': option_dict
            })
            
            processed_mounts.append((mount_point, server, remote_path, fs_type, options))
        
        return {
            "nfs-mount-options": mount_info,
            "error": None
        }
        
    except subprocess.TimeoutExpired:
        error_msg = 'mount command timed out'
        return {"nfs-mount-options": None, "error": error_msg}
    except Exception as e:
        error_msg = f'Exception while checking NFS mount options: {str(e)}'
        return {"nfs-mount-options": None, "error": error_msg}
`;

const ADR_HOME = `
def get_adr_info():
    sqlplus_cmd = os.environ.get('SQLPLUS_CMD', '')
    oracle_sid = os.environ.get('ORACLE_SID', '')
    
    result = {
        "adr-home": None,
        "adr-home-mount": None,
        "adr-home-mount-info": None,
        "error": None
    }
    
    if not sqlplus_cmd:
        result["error"] = "SQLPLUS_CMD not set"
        return result
    
    try:
        cmd_parts = sqlplus_cmd.split()
        env = os.environ.copy()
        env['ORACLE_SID'] = oracle_sid
        
        # SQL query to fetch ADR base and home
        sql_query = """SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 4000
SET TRIMSPOOL ON
SELECT JSON_OBJECT(
    'adr_home' VALUE (SELECT value FROM v\\$diag_info WHERE name = 'ADR Home')
) AS adr_info FROM dual;
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
                        adr_info = json.loads(line)
                        
                        # Check ADR Home
                        if adr_info.get('adr_home'):
                            result["adr-home"] = adr_info['adr_home']
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
    
    # If ADR Home found, check its filesystem type
    if result["adr-home"]:
        result_df = subprocess.run(
            ['df', '-T', result["adr-home"]],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            timeout=30
        )
        if result_df.returncode == 0:
            df_lines = result_df.stdout.strip().split('\\n')
            if len(df_lines) >= 2:
                # Skip header line
                parts = df_lines[1].split()
                if len(parts) >= 2:
                    mountpoint = parts[0]
                    result["adr-home-mount"] = mountpoint
        else:
            result["error"] = f"df command failed: {result_df.stderr}"

    if result["adr-home-mount"]: 
        mount_options = get_mount_options_for_mount_point(result["adr-home-mount"])
        if mount_options.get("error"):
            result["error"] = mount_options["error"]
        else:
            result["adr-home-mount-info"] = mount_options
    return result

def get_mount_options_for_mount_point(mount_point):
    """Get mount options for a specific mount point"""
    log(f'Getting mount options for mount point: {mount_point}')
    options_info = {
        "mount-point": mount_point,
        "filesystem-type": None,
        "mount-options": None,
        "error": None
    }
    
    try:
        # Combine mount and grep in single subprocess call
        grep_result = subprocess.run(f'mount | grep "{mount_point}"', 
                                   shell=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                                   universal_newlines=True, timeout=10)
        
        if grep_result.returncode != 0 or not grep_result.stdout.strip():
            options_info["error"] = f"Mount point {mount_point} not found"
            return options_info
        
        mount_line = grep_result.stdout.strip().split('\\n')[0]  # Take first match
        
        # Parse mount line: device on /mountpoint type filesystem (options)
        match = re.match(r'^(\\S+)\\s+on\\s+(\\S+)\\s+type\\s+(\\w+)(?:\\s+\\(([^)]+)\\))?$', mount_line)
        if not match:
            options_info["error"] = f"Could not parse mount line: {mount_line}"
            return options_info
        
        device, mp, fs_type, options = match.groups()
        options_info["filesystem-type"] = fs_type
        
        # Parse options into dictionary
        option_dict = {}
        if options:
            for opt in options.split(','):
                if '=' in opt:
                    key, value = opt.split('=', 1)
                    option_dict[key] = value
                else:
                    option_dict[opt] = True

        # Check fstab for additional mount options
        try:
            with open('/etc/fstab', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split()
                        if len(parts) >= 4 and parts[0] == mount_point:
                            # Parse and merge fstab options
                            if 'bg' in parts[3]:
                                option_dict['bg'] = True
                                break
                            break
        except Exception as e:
            log(f"Error reading fstab: {str(e)}")
        
        # Ensure bg has boolean values if not set
        if 'bg' not in option_dict:
            option_dict['bg'] = False
        options_info["mount-options"] = option_dict

    except subprocess.TimeoutExpired:
        options_info["error"] = "mount command timed out"
        log(f"Timeout expired while getting mount options for {mount_point}")
    except Exception as e:
        options_info["error"] = f"Exception getting mount options: {str(e)}"
        log(f"Exception while getting mount options for {mount_point}: {str(e)}")
    
    return options_info
`;

const IDMAPD_DOMAIN_CONFIG = `
def get_idmapd_domain_config():
    """Check /etc/idmapd.conf and extract domain configuration"""
    log('Checking /etc/idmapd.conf for domain configuration')
    
    result = {
        "config-file": "/etc/idmapd.conf",
        "domain": None,
        "config-exists": False,
        "error": None
    }
    
    try:
        config_path = Path("/etc/idmapd.conf")
        
        # Check if file exists
        if not config_path.exists():
            result["error"] = "idmapd.conf file does not exist"
            log("idmapd.conf file not found")
            return result
        
        result["config-exists"] = True
        
        # Read and parse the configuration file
        with open(config_path, 'r') as f:
            content = f.read()
        
        log(f"Successfully read idmapd.conf file ({len(content)} characters)")
        
        # Parse configuration to find domain setting
        domain_value = None
        in_general_section = False
        
        for line_num, line in enumerate(content.split('\\n'), 1):
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            
            # Check for section headers
            if line.startswith('[') and line.endswith(']'):
                section_name = line[1:-1].strip()
                in_general_section = (section_name.lower() == 'general')
                continue
            
            # Look for Domain setting in General section or globally
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Check if this is a Domain setting
                if key.lower() == 'domain':
                    if in_general_section or domain_value is None:
                        domain_value = value
                        log(f"Found domain setting at line {line_num}: {domain_value}")
                        
                        # If found in General section, prefer it and break
                        if in_general_section:
                            break
        
        if domain_value:
            result["domain"] = domain_value
            log(f"Successfully extracted domain: {domain_value}")
        else:
            result["error"] = "No domain configuration found in idmapd.conf"
            log("No domain configuration found in idmapd.conf")
            
    except PermissionError:
        error_msg = "Permission denied reading /etc/idmapd.conf"
        result["error"] = error_msg
        log(error_msg)
    except Exception as e:
        error_msg = f"Exception while reading idmapd.conf: {str(e)}"
        result["error"] = error_msg
        log(error_msg)
    
    return result
`;

const HOSTNAME_DOMAIN = `
def get_hostname_domain():
    """Get domain from hostname -d command"""
    log('Getting domain from hostname -d command')
    
    result = {
        "domain": None,
        "error": None
    }
    
    try:
        hostname_result = subprocess.run(
            ['hostname', '-d'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            timeout=5
        )
        
        if hostname_result.returncode == 0:
            hostname_domain = hostname_result.stdout.strip()
            if hostname_domain:
                result["domain"] = hostname_domain
                log(f"Successfully retrieved hostname domain: {hostname_domain}")
            else:
                log("hostname -d returned empty string")
        else:
            error_msg = f"hostname -d command failed: {hostname_result.stderr.strip()}"
            result["error"] = error_msg
            log(error_msg)
    except subprocess.TimeoutExpired:
        error_msg = "hostname -d command timed out"
        result["error"] = error_msg
        log(error_msg)
    except Exception as e:
        error_msg = f"Exception while running hostname -d: {str(e)}"
        result["error"] = error_msg
        log(error_msg)
    
    return result
`;

const PARSE_ORANFSTAB = `
def parse_oranfstab(path='/etc/oranfstab'):
    """Parse /etc/oranfstab file and extract server configurations with options"""
    log('Collecting oranfstab data')
    servers = []
    cur = None
    error = None
    try:
        with open(path) as f:
            for line in f:
                l = line.strip()
                if not l or l.startswith('#'):
                    continue
                if l.startswith('server:'):
                    if cur:
                        servers.append(cur)
                    cur = {
                        'server': l.split(':', 1)[1].strip(),
                        'paths': [],
                        'exports': [],
                        'nfs_version': None,
                        'options': {}
                    }
                elif cur:
                    if l.startswith('path:'):
                        cur['paths'].append(l.split(':', 1)[1].strip())
                    elif l.startswith('export:'):
                        m = re.match(r'export:\\s*(\\S+)(?:\\s+mount:\\s*(\\S+))?', l)
                        if m:
                            cur['exports'].append({'export': m.group(1), 'mount': m.group(2)})
                    elif l.startswith('nfs_version:'):
                        cur['nfs_version'] = l.split(':', 1)[1].strip()
                    elif ':' in l:
                        # Options with values like rsize:262144, wsize:262144
                        key, value = l.split(':', 1)
                        cur['options'][key.strip()] = value.strip()
                    else:
                        # Boolean options like tcp_nodelay, noactimeo, nolock
                        cur['options'][l] = True
            if cur:
                servers.append(cur)
        log(f"oranfstab data collected: {len(servers)} servers")
    except FileNotFoundError:
        error = f"File not found: {path}"
        log(error)
    except Exception as e:
        error = f"Error parsing oranfstab: {str(e)}"
        log(error)
    return {'oranfstab_servers': servers, 'error': error}
`;

const RESOLVE_HOSTNAMES = `
def resolve_hostnames(hostnames):
    socket.setdefaulttimeout(10)
    res = {}
    for h in hostnames:
        try:
            # Check if hostname is already an IP address (IPv4 or IPv6)
            # Using ipaddress module for Python 3.6+ compatibility
            is_ip = False
            try:
                ipaddress.ip_address(h)
                is_ip = True
            except ValueError:
                pass
            
            if is_ip:
                # Already an IP address, no need for DNS resolution
                res[h] = [h]
            else:
                # Domain name - resolve to IP addresses
                ips = set()
                for ai in socket.getaddrinfo(h, None):
                    ips.add(ai[4][0])
                res[h] = list(ips)
        except Exception as e:
            res[h] = ["Error: {}".format(e)]
    return res
`;

const GET_ORANFSTAB_DATA = `
${PARSE_ORANFSTAB}
`;

const GET_DNS_RESOLUTION = `
${PARSE_ORANFSTAB}

${RESOLVE_HOSTNAMES}

def get_dns_resolution():
    log('Collecting DNS resolution data from oranfstab')
    
    oranfstab_path = '/etc/oranfstab'
    
    try:
        hostnames = set()
        
        # Collect hostnames from oranfstab
        oranfstab_result = parse_oranfstab(oranfstab_path)
        oranfstab_servers = oranfstab_result.get('oranfstab_servers', [])
        for s in oranfstab_servers:
            # Add 'server' field if it looks like a hostname or IP
            server = s.get('server', '').strip()
            if server and not server.startswith('/'):
                # Valid if it's an IP pattern or contains a dot (FQDN/IP)
                if re.match(r'^[\\d\\.]+$', server) or '.' in server or ':' in server:
                    hostnames.add(server)
            
            # Add 'paths' field entries if they look like hostnames or IPs
            for p in s.get('paths', []):
                p = p.strip() if p else ''
                if p and not p.startswith('/'):
                    if re.match(r'^[\\d\\.]+$', p) or '.' in p or ':' in p:
                        hostnames.add(p)
        
        dns_resolution = resolve_hostnames(hostnames)
        log(f"DNS resolution collected for {len(hostnames)} hostnames")
        
        return {
            'dns_resolution': dns_resolution,
            'error': None
        }
        
    except Exception as e:
        error_msg = f"Exception while collecting DNS resolution: {str(e)}"
        log(error_msg)
        return {
            'dns_resolution': {},
            'error': error_msg
        }
`;

const NFS_OS_ASSESSMENT = (ec2InstanceId: string, dbSid: string) => `

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}

sudo mkdir -p ${LINUX_LOG_DIRECTORY}
sudo chown oracle:oinstall ${LINUX_LOG_DIRECTORY}
sudo chmod 755 ${LINUX_LOG_DIRECTORY}

export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

assessment_result=$(sudo -i -u oracle bash <<ORACLE_SHELL
export SQLPLUS_CMD="$sqlplus_command"
export ORACLE_SID="${dbSid}"
export PYTHON_LATEST="$PYTHON_LATEST"

$PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess
import re
import datetime
import socket
import ipaddress
from pathlib import Path

${pythonLogger('storageOsAssessment.log')}

${KERNEL_TCP_SLOT_PARAMETERS}

${NFS_MOUNT_OPTIONS}

${ADR_HOME}

${IDMAPD_DOMAIN_CONFIG}

${HOSTNAME_DOMAIN}

${GET_ORANFSTAB_DATA}

${GET_DNS_RESOLUTION}

# Run all checks and compile results
log('Starting comprehensive system assessment')

def run_all_checks():
    results = {"os": {}}
    
    # OS checks
    log('Running OS kernel parameter checks')
    results["os"]["kernel-parameters"] = check_sunrpc_tcp_slot_entries()
    
    log('Running NFS mount options checks')
    results["os"]["nfs-mount-options"] = get_nfs_mount_options()

    log('Running idmapd domain configuration checks')
    results["os"]["idmapd-domain-config"] = get_idmapd_domain_config()
    
    log('Running hostname domain checks')
    results["os"]["hostname-domain"] = get_hostname_domain()

    log('Running dNFS oranfstab data collection')
    results["os"]["dnfs-oranfstab"] = parse_oranfstab()

    log('Running dNFS IP resolution')
    results["os"]["dnfs-ip-resolution"] = get_dns_resolution()
    
    # Oracle checks
    log('Running Oracle ADR checks')
    adr_info = get_adr_info()
    results["os"]["adr-info"] = adr_info
    
    return results

try:
    all_results = run_all_checks()
    log('All checks completed successfully')
    print(json.dumps(all_results))
except Exception as e:
    log(f'Exception during assessment: {str(e)}')
    print(json.dumps({"error": f"Assessment failed: {str(e)}"}))

PYTHON
ORACLE_SHELL
)
echo "$assessment_result"
`;

export { NFS_OS_ASSESSMENT, KERNEL_TCP_SLOT_PARAMETERS };
