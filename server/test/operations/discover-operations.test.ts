import { faker } from '@faker-js/faker';
import { getHostAndSqlServerInfo, saveDiscoveredParameters } from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/fsx-scope';

describe('Discover operations', () => {
    it(
        'Get host and SQL Server instance details',
        async () => {
            const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION);
            expect(response).toBeDefined();
        },
        {
            timeout: 10000
        }
    );

    it('Store discovered resource credentials', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;

        const params = [
            {
                resourceId: 'instanceId', // required
                resourceType: 'sql', // required
                username: 'username',
                password: 'password'
            }
        ];
        const response = await saveDiscoveredParameters(
            ACCOUNT_ID,
            credentialsId,
            'us-east-1',
            'i-0e5af83448e1b83ef',
            params
        );
        expect(response).toBeUndefined();
    });
});
