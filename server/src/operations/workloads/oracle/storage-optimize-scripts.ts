import { OptimizeStorageParams } from '../../../utils/common-types';
import { pythonScriptInit, ontapRestApiScript, getFsxCredentials, logFileCheck } from './oracle-ssm-script-utils';

const oracleStorageConfigurationPythonTemplate = (params: OptimizeStorageParams) => `
${getFsxCredentials}
${ontapRestApiScript}

# Optimize Oracle storage configuration using ONTAP REST API
fsxId = '${params.fsxId}'
region = '${params.region}'
apiPath = '${params.apiEndpoint}'[1:]
query = '${params.apiQueryFilter}'
body = '${params.apiBody}'

if query:
    url = f"{apiPath}?{query}"

log(f"Sending PATCH request to: {url} with body: {body}")
response, error = ontapRestApiRequest(fsxId, region, 'PATCH', url, body)
if error:
    log(f"Error occurred: {error}")
    print(json.dumps(error))
    exit()

log(f"Response: {json.dumps(response)}")
print(json.dumps(response))
`;

const optimizeStorageParamsOracle = (params: OptimizeStorageParams) => `
#!/bin/bash
${logFileCheck}

sudo -i -u oracle bash <<'ORACLE_SHELL'
${pythonScriptInit(oracleStorageConfigurationPythonTemplate(params), 'wlmdb-oracle-storage-configuration')}
ORACLE_SHELL
`;

export { optimizeStorageParamsOracle };
