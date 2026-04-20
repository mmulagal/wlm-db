import {
    getOracleDefaultOrUserAuthCommand,
    logFileCheck,
    pythonLogger
} from '../../../workloads/oracle/oracle-ssm-script-utils';

import {
    CHECK_TRANSPARENT_HUGEPAGE,
    CHECK_TCP_FEATURES,
    CHECK_INIT_ORA_PARAMETERS,
    ORACLE_HOME,
    CHECK_ORACLE_PARAMETERS
} from './os-iscsi-assessment-scripts';

/**
 * Host-level compute assessment: transparent hugepages + TCP advanced options.
 * Runs as root (no Oracle credentials needed).
 */
const HOST_OS_COMPUTE_ASSESSMENT = (ec2InstanceId: string) => `
export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

$PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess
import datetime

${pythonLogger('computeHostOsAssessment.log')}

${CHECK_TRANSPARENT_HUGEPAGE}

${CHECK_TCP_FEATURES}

log('Collecting host-level compute OS data for ${ec2InstanceId}')
def run_checks():
    results = {"os": {}}
    results["os"]["transparent-hugepages"] = check_thp()
    results["os"]["tcp-advanced-options"] = check_tcp_features()
    return results

try:
    all_results = run_checks()
    log('Host-level compute OS checks completed')
    print(json.dumps(all_results))
except Exception as e:
    log('Exception during host-level compute checks: {}'.format(e))
    print(json.dumps({"error": "Host-level compute assessment failed: {}".format(e)}))

PYTHON
`;

/**
 * Oracle-specific compute assessment: filesystemio_options + db_file_multiblock_read_count.
 * Runs as the oracle user via sudo.
 */
const ORACLE_PARAMS_COMPUTE_ASSESSMENT = (ec2InstanceId: string, dbSid: string) => `

${getOracleDefaultOrUserAuthCommand(ec2InstanceId, dbSid)}
export PYTHON_LATEST=$(ls /usr/bin/python* /usr/local/bin/python* 2>/dev/null | xargs -I {} sh -c 'version=$({} -c "import sys; print(f\\"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\\")" 2>/dev/null); if [[ "$version" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then echo "{}|$version"; fi' | sort -t'|' -k2 -V | tail -n1 | cut -d'|' -f1)

ORACLE_RESULTS=$(sudo -i -u oracle bash <<ORACLE_SHELL
export SQLPLUS_CMD="$sqlplus_command"
export ORACLE_SID="${dbSid}"

$PYTHON_LATEST <<'PYTHON'

import os
import json
import subprocess
import re
import datetime

${pythonLogger('computeOracleParamsAssessment.log')}

${CHECK_ORACLE_PARAMETERS}

${ORACLE_HOME}

${CHECK_INIT_ORA_PARAMETERS}

log('Running Oracle parameter checks for compute assessment')
oracle_params_result = get_oracle_parameters()
oracle_init_params = check_init_ora_parameters()

print(json.dumps({"oracle-parameters": oracle_params_result, "oracle-init-parameters": oracle_init_params}))

PYTHON
ORACLE_SHELL
)

${logFileCheck()}

$PYTHON_LATEST <<PYTHON
import json
import os
import sys
import datetime

${pythonLogger('computeOracleParamsAssessment.log')}

log('Assembling Oracle params compute result')

try:
    oracle_results = json.loads("""$ORACLE_RESULTS""")
    final = {"os": {
        "oracle-parameters": oracle_results.get("oracle-parameters", {}),
        "oracle-parameters-from-init": oracle_results.get("oracle-init-parameters", {})
    }}
    print(json.dumps(final))
except Exception as e:
    log('Exception assembling Oracle params: {}'.format(e))
    print(json.dumps({"error": "Failed to assemble Oracle params: {}".format(e)}))

PYTHON
`;

export { HOST_OS_COMPUTE_ASSESSMENT, ORACLE_PARAMS_COMPUTE_ASSESSMENT };
