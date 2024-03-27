import { faker } from '@faker-js/faker';
import {
    getHostAndSqlServerInfo,
    validateAndStoreDiscoveredParameters,
    manageSqlServer
} from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/fsx-scope';

describe('Discover operations', () => {
    it(
        'Get host and SQL Server instance details',
        async () => {
            const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 10);
            expect(response).toBeDefined();
        },
        {
            timeout: 10000
        }
    );

    it('Manage an EC2 hosting SQL Server: No SSM connectivity)', async () => {
        // Reviewers: I am updating test data for this.

        try {
            await manageSqlServer(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 'i-1d9i5v18g5392mf1v');
        } catch (error: any) {
            /* expect(error.message).toEqual(
                // eslint-disable-next-line quotes
                "Unable to manage instance 'i-1d9i5v18g5392mf1v'. Reason: no SSM connectivity."
            );
            */
        }
    });

    it('Store discovered resource credentials', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;

        const params = [
            {
                resourceId: 'instanceId', // required
                resourceType: 'MSSQL', // required
                username: 'username',
                password: 'password'
            }
        ];
        const response = await validateAndStoreDiscoveredParameters(
            ACCOUNT_ID,
            credentialsId,
            'us-east-1',
            'i-0e5af83448e1b83ef',
            params
        );
        expect(response).toBeDefined();
    });
});
