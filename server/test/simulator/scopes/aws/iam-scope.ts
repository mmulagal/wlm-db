import {
    IAMClient,
    PolicyEvaluationDecisionType,
    SimulatePrincipalPolicyCommand,
    SimulatePrincipalPolicyCommandOutput
} from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';

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
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:CreateSecret',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:GetRandomPassword',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:DeleteSecret',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:ListSecretVersionIds',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:TagResource',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        },
        {
            EvalActionName: 'secretsmanager:UntagResource',
            EvalResourceName: '*',
            EvalDecision: PolicyEvaluationDecisionType.ALLOWED,
            MatchedStatements: [],
            MissingContextValues: []
        }
    ]
};

iamMock.on(SimulatePrincipalPolicyCommand).resolves(IamSimulatePolicyResponse);
