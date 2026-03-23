import {
    logFileCheck,
    pythonScriptInit,
    getOracleDefaultOrUserAuthCommand
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { ORACLE_HOME } from './os-iscsi-assessment-scripts';

const oracleSecurityPatchTemplate = (oracleSid: string) => `
${ORACLE_HOME}

oracle_sid = '${oracleSid}'
sqlplus_command = os.environ.get('SQLPLUS_CMD', 'sqlplus -S / as sysdba')

def get_oracle_version(oracle_home, sid):
    log(f'Getting Oracle version for SID: \${sid}')
    bash_cmd = f"""export ORACLE_SID="\${sid}"; export ORACLE_HOME="\${oracle_home}"; \${sqlplus_command} <<'EOSQL'
SET HEADING OFF FEEDBACK OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 200
SELECT VERSION_FULL FROM V$INSTANCE;
EXIT;
EOSQL"""
    try:
        result = subprocess.run(
            ['sudo', '-i', '-u', 'oracle', 'bash', '-c', bash_cmd],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
        )
        stdout = result.stdout.decode('utf-8', errors='replace') if isinstance(result.stdout, bytes) else result.stdout
        version = stdout.strip()
        if version:
            log(f'Oracle version: \${version}')
            return version
    except Exception as e:
        log(f'Error getting Oracle version: \${e}')
    return None

def get_applied_patches(oracle_home):
    log('Getting applied patches from OPatch')
    opatch_cmd = f'export ORACLE_HOME="\${oracle_home}"; \${oracle_home}/OPatch/opatch lspatches'
    try:
        result = subprocess.run(
            ['sudo', '-i', '-u', 'oracle', 'bash', '-c', opatch_cmd],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
        )
        stdout = result.stdout.decode('utf-8', errors='replace') if isinstance(result.stdout, bytes) else result.stdout
        patches = [{'patchId': m.group(1), 'description': m.group(2).strip()} for m in re.finditer(r'^\\s*(\\d+)\\s*;\\s*(.+)$', stdout, re.MULTILINE)]
        log(f'Found \${len(patches)} applied patches')
        return patches
    except Exception as e:
        log(f'Error getting applied patches: \${e}')
        return []

home_result = find_oracle_home(oracle_sid)
oracle_home = home_result.get('oracle-home-path')
if not oracle_home:
    print(json.dumps({'error': home_result.get('error', 'Could not determine ORACLE_HOME for the database instance')}))
    sys.exit(0)

version = get_oracle_version(oracle_home, oracle_sid)
if not version:
    print(json.dumps({'error': 'Could not determine Oracle version'}))
    sys.exit(0)

applied_patches = get_applied_patches(oracle_home)
print(json.dumps({'version': version, 'appliedPatches': applied_patches}))
`;

const ORACLE_SECURITY_PATCH_ASSESSMENT = (oracleSid: string, ec2InstanceId: string) => `
#!/bin/bash
${logFileCheck(true, 'oracle', 'oinstall')}
${getOracleDefaultOrUserAuthCommand(ec2InstanceId, oracleSid)}
export SQLPLUS_CMD="$sqlplus_command"
${pythonScriptInit(oracleSecurityPatchTemplate(oracleSid), 'wlmdb-oracle-security-patch-assessment')}
`;

export default ORACLE_SECURITY_PATCH_ASSESSMENT;
