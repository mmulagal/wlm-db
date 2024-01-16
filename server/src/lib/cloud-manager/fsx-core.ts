import { HEADERS, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

interface registerCredentialsResponse {
    fileSystemId: string;
    ontapCredentialsId: string;
}

export default async function registerFsxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxId: string,
    fsxPassword: string
) {
    logger.info('Registering FSX ONTAP credentials ', { accountId, credentialsId, region, fsxId, fsxPassword });

    const { token } = await getWfServiceToken();

    const response = await gotInstanceForInternalRequest
        .post(
            `accounts/${accountId}/fsx/v2/credentials/${credentialsId}/regions/${region}/file-systems/${fsxId}/ontap-credentials`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                },
                json: {
                    password: fsxPassword
                }
            }
        )
        .json<registerCredentialsResponse>();
    return response;
}
