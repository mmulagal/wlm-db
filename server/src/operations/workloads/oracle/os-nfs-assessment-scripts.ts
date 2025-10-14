import { getOracleDefaultOrUserAuthCommand, pythonLogger } from './oracle-ssm-script-utils';

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
    log('Checking NFS mount point options for database files')
    
    try:
        # Get all mount points
        result = subprocess.run(['mount', '-t', 'nfs,nfs4'], 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                              universal_newlines=True, timeout=10)
        
        if result.returncode != 0:
            error_msg = f'mount command failed: {result.stderr.strip()}'
            log(error_msg)
            return {"nfs-mount-options": None, "error": error_msg}
        
        mount_info = []
        lines = result.stdout.strip().split('\\n')
        
        for line in lines:
            if not line.strip():
                continue
                
            # Parse mount line format: server:/path on /mountpoint type nfs (options)
            match = re.match(r'^([^:]+):(\\S+)\\s+on\\s+(\\S+)\\s+type\\s+(\\w+)\\s+\\(([^)]+)\\)$', line)
            if match:
                server, remote_path, mount_point, fs_type, options = match.groups()
                
                # Parse options into dictionary
                option_dict = {}
                for opt in options.split(','):
                    if '=' in opt:
                        key, value = opt.split('=', 1)
                        option_dict[key] = value
                    else:
                        option_dict[opt] = True
                
                mount_info.append({
                    'server': server,
                    'remote-path': remote_path,
                    'mount-point': mount_point,
                    'filesystem-type': fs_type,
                    'options': option_dict
                })
    
        return {
            "nfs-mount-options": mount_info,
            "error": None
        }
        
    except subprocess.TimeoutExpired:
        error_msg = 'mount command timed out'
        log(error_msg)
        return {"nfs-mount-options": None, "error": error_msg}
    except Exception as e:
        error_msg = f'Exception while checking NFS mount options: {str(e)}'
        log(error_msg)
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
        
        if options:
            # Parse options into dictionary
            option_dict = {}
            for opt in options.split(','):
                if '=' in opt:
                    key, value = opt.split('=', 1)
                    option_dict[key] = value
                else:
                    option_dict[opt] = True
            options_info["mount-options"] = option_dict
        else:
            options_info["mount-options"] = {}

    except subprocess.TimeoutExpired:
        options_info["error"] = "mount command timed out"
    except Exception as e:
        options_info["error"] = f"Exception getting mount options: {str(e)}"
    
    return options_info
`;

const NFS_OS_ASSESSMENT = (ec2InstanceId: string, dbSid: string) => `

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}

sudo mkdir -p /var/log/netapp
sudo chown oracle:oracle /var/log/netapp
sudo chmod 755 /var/log/netapp

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
from pathlib import Path

${pythonLogger('storageOsAssessment.log')}

${KERNEL_TCP_SLOT_PARAMETERS}

${NFS_MOUNT_OPTIONS}

${ADR_HOME}

# Run all checks and compile results
log('Starting comprehensive system assessment')

def run_all_checks():
    results = {"os": {}}
    
    # OS checks
    log('Running OS kernel parameter checks')
    results["os"]["kernel-parameters"] = check_sunrpc_tcp_slot_entries()
    
    log('Running NFS mount options checks')
    results["os"]["nfs-mount-options"] = get_nfs_mount_options()
    
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

export { NFS_OS_ASSESSMENT };
