import simulatePrincipalPolicy from '../../../src/lib/aws/iam';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const REGION = 'us-east-1';

describe('List permissions required', () => {
    it.skip('list permissions required to deploy the stack - with all resources', async () => {
        const response = await simulatePrincipalPolicy(CREDENTIALS_ID, REGION, {
            PolicySourceArn: 'arn',
            ActionNames: undefined,
            MaxItems: 500
        });
        expect(response.EvaluationResults).toBeDefined();
    });
});
