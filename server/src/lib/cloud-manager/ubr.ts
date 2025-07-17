import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { USER_TOKEN, CLOUD_MANAGER_ENDPOINT, HEADERS } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';

const logger = getLogger();

const AUTHMODE_WINDOWS = 'Windows';
const CREDENTIALS_TYPE_PASSWORD = 'PASSWORD';

interface RegisterUbrCredentialsResponse {
    credentialsId?: string;
    jobId?: string;
    jobUrl?: string;
    errorMessage?: string;
}

async function registerUbrCredentials({ ...params }) {
    logger.info('Registering UBR credentials ', { ...params });

    // Since list credentials API doesn't support service token, we are using user token here.
    const token = getAsyncLocalStorageResource(USER_TOKEN);

    const { accountId, workspaceId, connectorId, sqlInstanceName, username, password, resourceId } = params;

    const response = await gotInstanceForInternalRequest
        .post(`backup-recovery/organizations/${accountId}/v1/workloads/sql/credentials`, {
            prefixUrl: CLOUD_MANAGER_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token as string,
                [HEADERS.NETAPP_WORKSPACE_ID]: workspaceId,
                [HEADERS.X_AGENT_ID]: connectorId,
                [HEADERS.X_ACCOUNT_ID]: accountId
            },
            json: {
                credentialsName: resourceId,
                authMode: AUTHMODE_WINDOWS,
                userName: username,
                passphrase: password,
                credentialsType: CREDENTIALS_TYPE_PASSWORD,
                hostName: '',
                sqlInstance: sqlInstanceName,
                connectorId
            }
        })
        .json<RegisterUbrCredentialsResponse>();
    return response;
}

export default registerUbrCredentials;
