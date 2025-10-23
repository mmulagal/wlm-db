import { logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { KERNEL_TCP_SLOT_PARAMETERS } from './os-nfs-assessment-scripts';

const CHECK_SUNRPC_SETTINGS_FUNCTION = `
# Check sunrpc settings against target values
def check_sunrpc_settings(target_settings, param_mapping):
    current_settings = check_sunrpc_tcp_slot_entries()
    
    if not current_settings or current_settings.get('error'):
        error_msg = current_settings.get('error', 'Failed to retrieve settings') if current_settings else 'No settings returned'
        return {"is_optimized": False, "verified_settings": {}, "error": error_msg}
    
    tcp_data = current_settings.get('sunrpc-tcp-slot-entries', {})
    verified_settings = {}
    is_optimized = True
    
    for param, expected in target_settings:
        key = param_mapping.get(param)
        actual = tcp_data.get(key, "not found") if key else "not found"
        
        verified_settings[param] = {"expected": expected, "actual": actual}
        
        if str(actual) != expected:
            is_optimized = False
    
    return {"is_optimized": is_optimized, "verified_settings": verified_settings, "error": None}
`;

const OPTIMISE_TCP_SUNRCP_SLOTS = `
# Optimize sunrpc TCP slot table entries
def optimize_tcp_sunrpc_options():
    log('Optimizing sunrpc TCP slot table entries')

    settings = [
        ("sunrpc.tcp_max_slot_table_entries", "128"),
        ("sunrpc.tcp_slot_table_entries", "128")
    ]

    mapping = {
        "sunrpc.tcp_max_slot_table_entries": "tcp-max-slot-table",
        "sunrpc.tcp_slot_table_entries": "tcp-slot-table"
    }

    # Check if already optimized
    check_result = check_sunrpc_settings(settings, mapping)
    
    if check_result["is_optimized"]:
        log('Settings already optimized')
        return {"status": "optimized-offline", "sunrpc-options": check_result["verified_settings"], "error": "Parameters have already been fixed to recommended values."}
    
    if check_result["error"]:
        log('Warning: {}'.format(check_result["error"]))

    # Apply optimization
    config_content = '\\n'.join(['{} = {}'.format(param, value) for param, value in settings]) + '\\n'

    try:
        log('Creating directory /etc/sysctl.d')
        subprocess.run(['sudo', 'mkdir', '-p', '/etc/sysctl.d'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=5)
        log('Writing configuration to /etc/sysctl.d/99-wlmdb-sunrpc-options.conf')
        subprocess.run(['sudo', 'tee', '/etc/sysctl.d/99-wlmdb-sunrpc-options.conf'], input=config_content, universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=5)
        log('Applying sysctl settings')
        subprocess.run(['sudo', 'sysctl', '--system'], check=True, timeout=5, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        log('Configuration applied successfully')

        # Verify results
        verify_result = check_sunrpc_settings(settings, mapping)
        
        if verify_result["error"]:
            return {"status": "failed", "error": verify_result["error"]}

        failed_count = sum(1 for param, data in verify_result["verified_settings"].items() 
                          if str(data["actual"]) != data["expected"])
        
        if failed_count == 0:
            status = "optimized"
        elif failed_count == 1:
            status = "partial"
        else:
            status = "failed"
        
        result = {"status": status, "sunrpc-options": verify_result["verified_settings"]}
        
        if failed_count > 0:
            failed_params = [param for param, data in verify_result["verified_settings"].items() 
                           if str(data["actual"]) != data["expected"]]
            result["error"] = "Failed to optimize: {}".format(", ".join(failed_params))
        
        return result

    except Exception as e:
        return {"status": "failed", "error": "Error: {}".format(e)}
`;

const optimizeTcpSunrpcSlotsTemplate = `
${CHECK_SUNRPC_SETTINGS_FUNCTION}
${OPTIMISE_TCP_SUNRCP_SLOTS}
${KERNEL_TCP_SLOT_PARAMETERS}

optimiseTcpSunRpcResults = optimize_tcp_sunrpc_options()
print(json.dumps(optimiseTcpSunRpcResults))
`;

const optimiseTcpSunrpcSlotsScript = `
#!/bin/bash
${logFileCheck(false)}

${pythonScriptInit(optimizeTcpSunrpcSlotsTemplate, 'wlmdb-os-configuration-tcp-sunrpc-optimization.log')}
`;

export { optimiseTcpSunrpcSlotsScript };
