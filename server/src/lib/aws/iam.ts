import { IAMClient, SimulatePrincipalPolicyCommand, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { AWS_RESOURCES_ACTION_MAP } from '../../utils/consts';

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

async function getPermissionsList(credentialsId: string, region: string, skipResources?: Array<string>) {
    logger.info('Get Permissions List', { credentialsId, region, skipResources });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken },
        extra: { arn }
    } = await getCredentialDetails(credentialsId);

    const iamClient = await getIAM(credentialsId, region, { accessKeyId, secretAccessKey, sessionToken });

    const command: SimulatePrincipalPolicyCommandInput = {
        PolicySourceArn: arn,
        ActionNames: Object.keys(AWS_RESOURCES_ACTION_MAP)
            .filter(key => !skipResources?.includes(key))
            .map(key => {
                return AWS_RESOURCES_ACTION_MAP[key as keyof typeof AWS_RESOURCES_ACTION_MAP];
            })
            .flat(),
        MaxItems: 500
    };

    const { EvaluationResults: results } = await iamClient.send(new SimulatePrincipalPolicyCommand(command));
    const permissions =
        results
            ?.filter(({ EvalDecision }) => EvalDecision === 'implicitDeny')
            .map(({ EvalActionName }) => EvalActionName as string) || [];

    return { permissions };
}

export { getPermissionsList };
