import { IAMClient, SimulatePrincipalPolicyCommand } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import IamSimulatePolicyResponse from '../../responses/aws/iam-simulate-policy.json';

const iamMock = mockClient(IAMClient);

iamMock.on(SimulatePrincipalPolicyCommand).resolves(IamSimulatePolicyResponse);
