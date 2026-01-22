import { logFileCheck, pythonScriptInit } from '../../../workloads/oracle/oracle-ssm-script-utils';
import { GET_OS_INFO } from './os-iscsi-assessment-scripts';

const CHECK_LINUX_REPO_CONNECTIVITY = `
${GET_OS_INFO}

def check_linux_repo_connectivity():
    log('Checking Linux package repository connectivity')
    
    try:
        os_info = get_os_info()
        os_name = os_info.get('os', '')

        # rhel: dnf, sles: zypper
        pkg_mgr = None
        repolist_cmd = None

        if os_name == 'rhel':
            pkg_mgr = 'dnf'
            repolist_cmd = ['dnf', 'repolist', '--quiet']
        elif os_name == 'sles':
            pkg_mgr = 'zypper'
            repolist_cmd = ['zypper', 'repos', '--no-refresh']
        else:
            error_msg = 'Unsupported OS: {}. Only rhel and sles are supported'.format(os_name or 'unknown')
            log(error_msg)
            return {'status': 'failed', 'packageManager': None, 'error': error_msg}
        
        log('Using {} package manager to check repository connectivity'.format(pkg_mgr))
        result = subprocess.run(repolist_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        
        if result.returncode == 0:
            log('Successfully connected to package repositories via {}'.format(pkg_mgr))
            return {'status': 'success', 'packageManager': pkg_mgr, 'error': None}
        else:
            stderr_output = result.stderr.decode('utf-8', errors='replace').strip() if result.stderr else ''
            error_msg = '{} repolist failed with code {}: {}'.format(pkg_mgr, result.returncode, stderr_output)
            log(error_msg)
            return {'status': 'failed', 'packageManager': pkg_mgr, 'error': error_msg}
        
    except subprocess.TimeoutExpired:
        error_msg = 'Timeout while checking package repository connectivity'
        log(error_msg)
        return {'status': 'failed', 'packageManager': None, 'error': error_msg}
    except Exception as e:
        error_msg = 'Exception while checking repository connectivity: {}'.format(str(e))
        log(error_msg)
        return {'status': 'failed', 'packageManager': None, 'error': error_msg}
`;

const checkLinuxRepoConnectivityTemplate = `
${CHECK_LINUX_REPO_CONNECTIVITY}

result = check_linux_repo_connectivity()
print(json.dumps(result))
if result.get('status') != 'success':
    sys.exit(1)
`;

const checkLinuxRepoConnectivityScript = `
#!/bin/bash
${logFileCheck(false)}

${pythonScriptInit(checkLinuxRepoConnectivityTemplate, 'wlmdb-host-os-patch-assessment.log')}
`;

export { checkLinuxRepoConnectivityScript, CHECK_LINUX_REPO_CONNECTIVITY };
