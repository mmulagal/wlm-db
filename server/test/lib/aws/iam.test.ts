import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/iam-scope';
import '../../simulator/scopes/opentelemetry-scope';
import simulatePrincipalPolicy from '../../../src/lib/aws/iam';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const REGION = 'us-east-1';

describe('List permissions required', () => {
    it('list permissions required to deploy the stack - with all resources', async () => {
        const response = await simulatePrincipalPolicy(CREDENTIALS_ID, REGION, {
            PolicySourceArn: 'arn',
            ActionNames: undefined,
            MaxItems: 500
        });
        expect(response.EvaluationResults).toBeDefined();
    });
});
