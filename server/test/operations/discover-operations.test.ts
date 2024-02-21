import { getHostAndSqlServerInfo } from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';

describe('Discover operations', () => {
    it('Get host and SQL Server instance details', async () => {
        const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(response).toBeDefined();
    });
});
