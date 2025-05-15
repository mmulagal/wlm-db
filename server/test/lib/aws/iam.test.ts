import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/iam-scope';
import '../../simulator/scopes/opentelemetry-scope';
import simulatePrincipalPolicy, { getInstanceProfile } from '../../../src/lib/aws/iam';
import { derivePropertiesFromARN } from '../../../src/utils/utils';

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

    it('Gets IAM instance profile', async () => {
        const instanceProfileArn =
            'arn:aws:iam::464262061435:instance-profile/WLMDB-SqlStandaloneStack-1742880721338-SQLStandaloneStack-17700AI3XQKN4-LaunchWizardSqlFSxProfile-sLMUD6geCV2J';
        const { resourceName } = derivePropertiesFromARN(instanceProfileArn) || {};
        const response = await getInstanceProfile(CREDENTIALS_ID, 'eu-west-3', {
            InstanceProfileName: resourceName?.split('/').pop() || ''
        });
        expect(response).toBeDefined();
    });
});
