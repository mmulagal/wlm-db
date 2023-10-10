import { SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getRoleDetails } from '../cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import { AWS_RESOURCES_ACTION_MAP } from '../../utils/consts';
import getPermissionsList from '../../lib/aws/iam';

const logger = getLogger();

export default async function getMissingPermissionsList(
    credentialsId: string,
    region: string,
    skipResources?: Array<string>
) {
    logger.info('Get missing permissions List', { credentialsId, region, skipResources });

    const { roleArn } = await getRoleDetails(credentialsId);

    const command: SimulatePrincipalPolicyCommandInput = {
        PolicySourceArn: roleArn,
        ActionNames: Object.keys(AWS_RESOURCES_ACTION_MAP)
            .filter(key => !skipResources?.includes(key))
            .map(key => AWS_RESOURCES_ACTION_MAP[key as keyof typeof AWS_RESOURCES_ACTION_MAP])
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
