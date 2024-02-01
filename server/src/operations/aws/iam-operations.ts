import { ContextEntry, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getRoleDetails } from '../cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import getPermissionsList from '../../lib/aws/iam';

const logger = getLogger();

export default async function getMissingPermissionsList(
    credentialsId: string,
    region: string,
    actionMap: any,
    resourceArn?: Array<string>,
    conditionMap?: ContextEntry[],
    skipResources?: Array<string>
) {
    logger.info('Get missing permissions List', { credentialsId, region, skipResources });

    const { roleArn } = await getRoleDetails(credentialsId);

    // ResourceArns & ContextEntries has to be given any one at a time, both are not working together with the api
    const command: SimulatePrincipalPolicyCommandInput = {
        PolicySourceArn: roleArn,
        ...(resourceArn && { ResourceArns: resourceArn }), // A list of ARNs of Amazon Web Services resources to include in the simulation. If this parameter is not provided, then the value defaults to * (all resources)
        ...(conditionMap && { ContextEntries: conditionMap }), // this needs to be provided when the resource is allowed with the condition in iam policy
        ActionNames: Object.entries(actionMap)
            .filter(([key]) => !skipResources?.includes(key))
            .map(([, value]) => value)
            .flat() as string[],
        MaxItems: 500
    };

    const { EvaluationResults: results } = await getPermissionsList(credentialsId, region, command);
    const permissions =
        results
            ?.filter(({ EvalDecision }) => EvalDecision === 'implicitDeny')
            .map(({ EvalActionName }) => EvalActionName as string) || [];

    return { permissions };
}
