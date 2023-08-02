import { SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getCredentialDetails } from '../../lib/cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { AWS_RESOURCES_ACTION_MAP } from '../../utils/consts';
import { getPermissionsList } from '../../lib/aws/iam';
const logger = getLogger();

export default async function getMissingPermissionsList(
    credentialsId: string,
    region: string,
    skipResources?: Array<string>
) {
    logger.info('Get missing permissions List', { credentialsId, region, skipResources });

    const {
        extra: { arn }
    } = await getCredentialDetails(credentialsId);

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

    const { EvaluationResults: results } = await getPermissionsList(credentialsId, region, command);
    const permissions =
        results
            ?.filter(({ EvalDecision }) => EvalDecision === 'implicitDeny')
            .map(({ EvalActionName }) => EvalActionName as string) || [];

    return { permissions };
}
