import {
    checkCommandStatus,
    pythonScriptInit,
    getFsxCredentials,
    ontapRestApiScript,
    logFileCheck
} from '../../../workloads/oracle/oracle-ssm-script-utils';
import { LINUX_LOG_DIRECTORY } from '../consts';

const CLONE_LOG_FILE = `${LINUX_LOG_DIRECTORY}/clone-assessment.log`;
const CLONE_LOG_FILE_NAME = 'clone-assessment.log';

const FLEXCLONE_VOLUMES_FIELDS =
    'clone.parent_volume.name,clone.is_flexclone,create_time,name,uuid,svm.name,svm.uuid,space.size,space.used,space.physical_used';

const cloneAssessmentPythonTemplate = (fsxId: string, region: string, svmName: string) => `
${getFsxCredentials}
${ontapRestApiScript}

filesystemid = '${fsxId}'
region = '${region}'
svm_name = '${svmName}'

log("Starting Oracle clone assessment")
log(f"FSx ID: {filesystemid}, Region: {region}, SVM: {svm_name}")

try:
    from urllib.parse import quote
    encoded_svm = quote(svm_name)
except ImportError:
    from urllib import quote
    encoded_svm = quote(svm_name)

endpoint = f"storage/volumes?clone.is_flexclone=true&svm.name={encoded_svm}&fields=${FLEXCLONE_VOLUMES_FIELDS}"
response, error = ontapRestApiRequest(filesystemid, region, 'GET', endpoint)

if error:
    log(f"Failed to fetch FlexClone volumes: {error}")
    print(json.dumps({"error": str(error)}))
    sys.exit(0)

if not response:
    log("Empty response from ONTAP API")
    print(json.dumps({"records": []}))
    sys.exit(0)

records = response.get('records', [])
log(f"FlexClone volumes retrieved: {len(records)}")
print(json.dumps({"records": records}))
`;

function buildFlexCloneQueryScript(fsxnId: string, region: string, svmName: string) {
    return `#!/bin/bash
set -euo pipefail

${logFileCheck()}
exec 3>&1
exec >> ${CLONE_LOG_FILE} 2>&1
echo "=== Clone Assessment started at $(date -u) ==="

${checkCommandStatus}

filesystemid="${fsxnId}"
region="${region}"

cloneResults=$(${pythonScriptInit(cloneAssessmentPythonTemplate(fsxnId, region, svmName), CLONE_LOG_FILE_NAME)})

echo "$cloneResults" >&3
`;
}

export { buildFlexCloneQueryScript };
