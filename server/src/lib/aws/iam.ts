import { IAMClient, SimulatePrincipalPolicyCommand, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getIAM(
    credentialsId: string,
    region: string,
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
    }
) {
    logger.debug('Getting IAM client:', credentialsId, region);

    if (!credentials) {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialDetails(credentialsId);
        credentials = { accessKeyId, secretAccessKey, sessionToken };
    }

    return new IAMClient({ credentials });
}

async function getPermissionsList(credentialsId: string, region: string, command: SimulatePrincipalPolicyCommandInput) {
    logger.info('Get missing permissions List', { credentialsId, region, command });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);

    const iamClient = await getIAM(credentialsId, region, { accessKeyId, secretAccessKey, sessionToken });

    const response = await iamClient.send(new SimulatePrincipalPolicyCommand(command));
    logger.debug('getPermissionsList response', response);

    return response;
}

export { getPermissionsList };
