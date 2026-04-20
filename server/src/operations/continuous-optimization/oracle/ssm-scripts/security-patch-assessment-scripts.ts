import {
    logFileCheck,
    pythonScriptInit,
    getOracleDefaultOrUserAuthCommand
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { ORACLE_HOME } from './os-iscsi-assessment-scripts';

const oracleSecurityPatchTemplate = (oracleSid: string) => `
${ORACLE_HOME}

oracle_sid = '${oracleSid}'
sqlplus_command = os.environ.get('SQLPLUS_CMD') or 'sqlplus -S / as sysdba'

def get_oracle_version(oracle_home, sid):
    log('Getting Oracle version for SID: ' + str(sid))
    sql_input = b'SET HEADING OFF FEEDBACK OFF PAGESIZE 0 TRIMSPOOL ON LINESIZE 200\\nSELECT VERSION_FULL FROM V$INSTANCE;\\nEXIT;\\n'
    env_vars = [
        'ORACLE_SID=' + sid,
        'ORACLE_HOME=' + oracle_home,
        'PATH=' + oracle_home + '/bin:/usr/bin:/bin:/usr/local/bin'
    ]
    try:
        result = subprocess.run(
            ['sudo', '-u', 'oracle', 'env'] + env_vars + sqlplus_command.split(),
            input=sql_input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
        )
        stdout = result.stdout.decode('utf-8', errors='replace') if isinstance(result.stdout, bytes) else result.stdout
        log('Oracle version: ' + stdout.strip())
        return stdout.strip()
    except Exception as e:
        log('Error getting Oracle version: ' + str(e))
    return None

COMPONENT_ALIASES = {
    'ojvm': 'java vm',
    'ocw': 'clusterware',
    'data pump bundle patch': 'data pump',
    'database metadata patch': 'database metadata',
    'security patch update (spu)': 'security patch update',
    'jdbc patch': 'jdbc'
}

def get_applied_patches(oracle_home):
    log('Getting applied patches from OPatch')
    env_vars = [
        'ORACLE_HOME=' + oracle_home,
        'PATH=' + oracle_home + '/OPatch:' + oracle_home + '/bin:/usr/bin:/bin:/usr/local/bin'
    ]
    try:
        result = subprocess.run(
            ['sudo', '-u', 'oracle', 'env'] + env_vars + ['opatch', 'lspatches'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120
        )
        if result.returncode != 0:
            stderr = result.stderr.decode('utf-8', errors='replace') if isinstance(result.stderr, bytes) else result.stderr
            err = 'opatch lspatches failed (rc=' + str(result.returncode) + '): ' + stderr.strip()
            log(err)
            return {}, None, err
        stdout = result.stdout.decode('utf-8', errors='replace') if isinstance(result.stdout, bytes) else result.stdout
        dates = {}
        ru_minor = None
        for m in re.finditer(r'^\\s*\\d+\\s*;\\s*(.+?)\\s+RELEASE UPDATE\\b.*?\\d+\\.(\\d+)\\.\\d+\\.\\d+\\.(\\d{2})(\\d{2})(\\d{2})\\s*\\(', stdout, re.MULTILINE | re.IGNORECASE | re.DOTALL):
            comp = m.group(1).strip().lower()
            comp = COMPONENT_ALIASES.get(comp, comp)
            minor = int(m.group(2))
            date_str = '20' + m.group(3) + '-' + m.group(4) + '-' + m.group(5)
            if comp not in dates or date_str > dates[comp]:
                dates[comp] = date_str
            # Database Release Update is the most important, will be the effective version
            if comp == 'database' and (ru_minor is None or minor > ru_minor):
                ru_minor = minor
        log('Applied patches: ' + json.dumps(dates))
        return dates, ru_minor, None
    except Exception as e:
        err = 'Error getting applied patches: ' + str(e)
        log(err)
        return {}, None, err

def build_effective_version(sqlplus_version, ru_minor):
    """Build version using major from sqlplus, minor from Database Release Update if available."""
    parts = sqlplus_version.split('.')
    if len(parts) < 2:
        return sqlplus_version
    if ru_minor is not None:
        parts[1] = str(ru_minor)
    return '.'.join(parts)

home_result = find_oracle_home(oracle_sid)
oracle_home = home_result.get('oracle-home-path')
if not oracle_home:
    print(json.dumps({'error': home_result.get('error', 'Could not determine ORACLE_HOME for the database instance')}))
    sys.exit(0)

sqlplus_version = get_oracle_version(oracle_home, oracle_sid)
if not sqlplus_version:
    print(json.dumps({'error': 'Could not determine Oracle version'}))
    sys.exit(0)

applied_patches, ru_minor, opatch_error = get_applied_patches(oracle_home)
if opatch_error:
    print(json.dumps({'error': opatch_error}))
    sys.exit(0)
version = build_effective_version(sqlplus_version, ru_minor)
log('Effective version: ' + version)
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
