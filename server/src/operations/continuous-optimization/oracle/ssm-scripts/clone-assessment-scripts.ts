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

# Query all FlexClone volumes across the FSx filesystem (not filtered by SVM)
# This allows detection of cross-SVM clones where parent volume is in one SVM
# and clone volume is in a different SVM
all_records = []
endpoint = f"storage/volumes?clone.is_flexclone=true&fields=${FLEXCLONE_VOLUMES_FIELDS}&max_records=200&return_timeout=60"
page = 1

while endpoint:
    log(f"Fetching FlexClone volumes page {page}: {endpoint}")
    response, error = ontapRestApiRequest(filesystemid, region, 'GET', endpoint)

    if error:
        log(f"Failed to fetch FlexClone volumes (page {page}): {error}")
        print(json.dumps({"error": str(error)}))
        sys.exit(0)

    if not response:
        log(f"Empty response from ONTAP API (page {page})")
        break

    page_records = response.get('records', [])
    all_records.extend(page_records)
    log(f"Page {page}: retrieved {len(page_records)} records (total so far: {len(all_records)})")

    next_link = response.get('_links', {}).get('next', {}).get('href', '')
    if next_link:
        endpoint = next_link.replace('/api/', '', 1) if next_link.startswith('/api/') else next_link
        page += 1
    else:
        endpoint = None

log(f"FlexClone volumes retrieved (all pages): {len(all_records)}")
print(json.dumps({"records": all_records}))
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
