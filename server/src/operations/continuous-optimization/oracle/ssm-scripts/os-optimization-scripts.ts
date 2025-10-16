import { logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { CHECK_TCP_FEATURES } from '../../../workloads/oracle/os-iscsi-assessment-scripts';

const OPTIMIZE_TCP_OPTIONS = `
# Optimize TCP options for Oracle workloads
def optimize_tcp_options():
    log('Optimizing TCP advanced features')
    
    errorMessage = ''

    tcp_settings = [
        ("net.ipv4.tcp_timestamps", "1", "tcp-timestamps"),
        ("net.ipv4.tcp_sack", "1", "tcp-sack"),
        ("net.ipv4.tcp_window_scaling", "1", "tcp-window-scaling")
    ]
    
    # Step 1: Create directory if it doesn't exist
    log('Creating /etc/sysctl.d directory if it does not exist')
    result = subprocess.run(
        ['sudo', 'mkdir', '-p', '/etc/sysctl.d'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to create /etc/sysctl.d directory: {result.stderr.strip()}'
        log(error_msg)
        errorMessage = error_msg
        return {error: errorMessage}
    
    log('Successfully ensured /etc/sysctl.d directory exists')
    
    # Step 2: Create the config file with content
    log('Writing TCP options to /etc/sysctl.d/99-wlmdb-tcp-options.conf')
    config_lines = []
    for param, value, _ in tcp_settings:
        config_lines.append(f'{param} = {value}')
    config_text = '\\n'.join(config_lines) + '\\n'
    
    result = subprocess.run(
        ['sudo', 'tee', '/etc/sysctl.d/99-wlmdb-tcp-options.conf'],
        input=config_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to write config file: {result.stderr.strip()}'
        log(error_msg)
        return {"error":errorMessage}

    log('Successfully wrote TCP options to /etc/sysctl.d/99-wlmdb-tcp-options.conf')
    
    # Step 3: Apply settings using sudo sysctl --system
    log('Applying sysctl configuration with sudo sysctl --system')
    result = subprocess.run(
        ['sudo', 'sysctl', '--system'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        timeout=5
    )
    
    if result.returncode != 0:
        error_msg = f'Failed to apply sysctl configuration: {result.stderr.strip()}'
        log(error_msg)
        return {"error":errorMessage}

    log('Successfully applied sysctl configuration')
    
    # Step 4: Verify each value with sudo sysctl -n param
    log('Verifying TCP options are correctly applied')

    statusAfterOptimization = check_tcp_features()

    return statusAfterOptimization
`;

const optimizeTcpOptionsTemplate = `
${OPTIMIZE_TCP_OPTIONS}
${CHECK_TCP_FEATURES}

tcp_params = ["tcp-timestamps", "tcp-sack", "tcp-window-scaling"]

existing = check_tcp_features()
existing_tcp_features = existing.get("tcp-features", {})
all_optimized = all(existing_tcp_features.get(f"{param}-value") == "1" for param in tcp_params)

if all_optimized:
    log('All TCP options are already set to 1, no update needed')
    print(json.dumps({
        "tcp-features": {
            "tcp-timestamps": {"enabled": True, "error": None},
            "tcp-sack": {"enabled": True, "error": None},
            "tcp-window-scaling": {"enabled": True, "error": None}
        },
        "already-optimized": True
    }))
else:
    print(json.dumps(optimize_tcp_options()))    
`;

const optimizeTcpOptionsCommand = () => `
#!/bin/bash
${logFileCheck(false)}

# This script doesn't need to be run as oracle user
${pythonScriptInit(optimizeTcpOptionsTemplate, 'wlmdb-os-configuration-tcp-optimization.log')}
`;

export { optimizeTcpOptionsCommand };
