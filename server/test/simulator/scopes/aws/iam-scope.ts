import {
    GetInstanceProfileCommand,
    IAMClient,
    PolicyEvaluationDecisionType,
    SimulatePrincipalPolicyCommand,
    SimulatePrincipalPolicyCommandOutput
} from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';

import GetInstanceProfileCommandResponse from '../../responses/aws/get-instance-profile.json';

const iamMock = mockClient(IAMClient);

const IamSimulatePolicyResponse: Partial<SimulatePrincipalPolicyCommandOutput> = {
    $metadata: {
        httpStatusCode: 200,
        requestId: '73b5dbe2-9fa8-43c0-a84e-f85dc5387936',
        attempts: 1,
        totalRetryDelay: 0
    },
    EvaluationResults: [
        {
            EvalActionName: 'secretsmanager:GetSecretValue',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:CreateSecret',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:GetRandomPassword',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:DeleteSecret',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:ListSecretVersionIds',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:TagResource',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        },
        {
            EvalActionName: 'secretsmanager:UntagResource',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: [],
            OrganizationsDecisionDetail: { AllowedByOrganizations: true }
        }
    ]
};

iamMock.on(SimulatePrincipalPolicyCommand).resolves(IamSimulatePolicyResponse);

iamMock.on(GetInstanceProfileCommand).resolves({
    ...GetInstanceProfileCommandResponse,
    InstanceProfile: {
        ...GetInstanceProfileCommandResponse.InstanceProfile,
        CreateDate: new Date(GetInstanceProfileCommandResponse.InstanceProfile.CreateDate),
        Roles: GetInstanceProfileCommandResponse.InstanceProfile.Roles.map(role => ({
            ...role,
            CreateDate: new Date(role.CreateDate)
        }))
    }
});
