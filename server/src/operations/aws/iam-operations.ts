import { isEmpty } from 'lodash-es';
import { ContextEntry, PolicyEvaluationDecisionType, SimulatePrincipalPolicyCommandInput } from '@aws-sdk/client-iam'; // ES Modules import
import { getRoleDetails } from '../cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import simulatePrincipalPolicy from '../../lib/aws/iam';
import { MissingPermission } from '../../utils/common-types';
import { PERMISSION_DENIAL_POSSIBLE_REASONS } from '../../utils/consts';

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

    // Any implicity denied permission will be marked as missing which can be missed in policy, SCP or boundary.
    const implicitlyDenied =
        results
            ?.filter(
                ({ EvalDecision, OrganizationsDecisionDetail }) =>
                    EvalDecision === PolicyEvaluationDecisionType.IMPLICIT_DENY &&
                    OrganizationsDecisionDetail?.AllowedByOrganizations
            )
            .map(
                ({ EvalActionName, MatchedStatements, PermissionsBoundaryDecisionDetail }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        reason:
                            PermissionsBoundaryDecisionDetail &&
                            !PermissionsBoundaryDecisionDetail?.AllowedByPermissionsBoundary
                                ? PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_BOUNDARY
                                : isEmpty(MatchedStatements)
                                ? PERMISSION_DENIAL_POSSIBLE_REASONS.MISSING
                                : PERMISSION_DENIAL_POSSIBLE_REASONS.OTHERS
                    } as MissingPermission)
            ) || [];

    // Any explicitly denied permission will be marked as blocked which could be from policy, SCP or boundary.
    const explicitlyDenied =
        results
            ?.filter(({ EvalDecision }) => EvalDecision === PolicyEvaluationDecisionType.EXPLICIT_DENY)
            .map(
                ({
                    EvalActionName,
                    MatchedStatements,
                    OrganizationsDecisionDetail,
                    PermissionsBoundaryDecisionDetail
                }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        reason: !OrganizationsDecisionDetail?.AllowedByOrganizations
                            ? PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_SCP
                            : PermissionsBoundaryDecisionDetail &&
                              !PermissionsBoundaryDecisionDetail?.AllowedByPermissionsBoundary
                            ? PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_BOUNDARY
                            : isEmpty(MatchedStatements)
                            ? PERMISSION_DENIAL_POSSIBLE_REASONS.MISSING
                            : PERMISSION_DENIAL_POSSIBLE_REASONS.OTHERS
                    } as MissingPermission)
            ) || [];

    // SCP blocked permissions are returned as implicitDeny but needs to be classified as blocked.
    const blockedBySCP =
        results
            ?.filter(({ OrganizationsDecisionDetail }) => !OrganizationsDecisionDetail?.AllowedByOrganizations)
            .map(
                ({ EvalActionName }) =>
                    ({
                        service: EvalActionName?.split(':') ? EvalActionName?.split(':')[0] : EvalActionName,
                        action: EvalActionName?.split(':') ? EvalActionName?.split(':')[1] : EvalActionName,
                        reason: PERMISSION_DENIAL_POSSIBLE_REASONS.BLOCKED_SCP
                    } as MissingPermission)
            ) || [];

    explicitlyDenied.push(...blockedBySCP);

    return { implicitlyDenied, explicitlyDenied };
}
