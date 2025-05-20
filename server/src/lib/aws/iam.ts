import { IAMClient, SimulatePrincipalPolicyCommand, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getIAM(credentialsId: string, region: string) {
    logger.debug('Getting IAM client:', credentialsId, region);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new IAMClient({ credentials, region });
}

export default async function simulatePrincipalPolicy(
    credentialsId: string,
    region: string,
    command: SimulatePrincipalPolicyCommandInput
) {
    logger.info('Simulating IAM principal policy', { credentialsId, region, command });

    const iamClient = await getIAM(credentialsId, region);

    const response = await iamClient.send(new SimulatePrincipalPolicyCommand(command));
    logger.debug('simulatePrincipalPolicy response', response);

    return response;
}
