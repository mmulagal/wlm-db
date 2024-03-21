import { isEmpty } from 'lodash-es';
import { ContextEntry, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getRoleDetails } from '../cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import simulatePrincipalPolicy from '../../lib/aws/iam';
import { MissingPermission } from '../../utils/common-types';

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

    const { EvaluationResults: results } = await simulatePrincipalPolicy(credentialsId, region, command);
    const missingPermissions =
        results
            ?.filter(
                ({ EvalDecision, OrganizationsDecisionDetail, MatchedStatements }) =>
                    EvalDecision !== 'allowed' &&
                    OrganizationsDecisionDetail?.AllowedByOrganizations &&
                    isEmpty(MatchedStatements)
            )
            .map(
                ({ EvalActionName, EvalDecision }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        error: EvalDecision as string
                    } as MissingPermission)
            ) || [];
    const blockedByOrganisation =
        results
            ?.filter(
                ({ EvalDecision, OrganizationsDecisionDetail }) =>
                    EvalDecision !== 'allowed' && !OrganizationsDecisionDetail?.AllowedByOrganizations
            )
            .map(
                ({ EvalActionName, EvalDecision }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        error: EvalDecision as string
                    } as MissingPermission)
            ) || [];
    const blockedByPermissionBoundary =
        results
            ?.filter(
                ({ EvalDecision, OrganizationsDecisionDetail, PermissionsBoundaryDecisionDetail, MatchedStatements }) =>
                    EvalDecision !== 'allowed' &&
                    OrganizationsDecisionDetail?.AllowedByOrganizations &&
                    !PermissionsBoundaryDecisionDetail?.AllowedByPermissionsBoundary &&
                    !isEmpty(MatchedStatements)
            )
            .map(
                ({ EvalActionName, EvalDecision }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        error: EvalDecision as string
                    } as MissingPermission)
            ) || [];

    return { missingPermissions, blockedByOrganisation, blockedByPermissionBoundary };
}
