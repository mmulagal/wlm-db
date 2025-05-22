import { ACCOUNT_ID } from '../utils/consts';

import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/bedrock-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/cloud-watch-logs-scope';
import { manageSqlInstances } from '../../src/operations/manage-operations';

const TEST_EC2_INSTANCE_ID = '36E53042-04E8-40C9-AE69-26E56CB0D216';
const TEST_CREDENTIALS_ID = 'f6082f35-c1db-4619-bb5c-84bcb5bf3286';
const TEST_REGION = 'ap-southeast-1';

describe('Manage operations', () => {
    it('should manage SQL instances', async () => {
        const { jobId } = await manageSqlInstances(ACCOUNT_ID, [
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: TEST_EC2_INSTANCE_ID,
                databaseInstanceNames: ['MSSQLSERVER']
            }
        ]);
        expect(jobId).toBeDefined();
    });

    it('should throw error if no resources to be managed', async () => {
        await expect(manageSqlInstances(ACCOUNT_ID, [])).rejects.toThrow('No sql instances to be managed');
    });

    it('should manage multiple SQL instances in one call', async () => {
        const { jobId } = await manageSqlInstances(ACCOUNT_ID, [
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: TEST_EC2_INSTANCE_ID,
                databaseInstanceNames: ['MSSQLSERVER', 'SQLINST2']
            }
        ]);
        expect(jobId).toBeDefined();
    });

    it('should manage SQL instances for multiple EC2 resources', async () => {
        const { jobId } = await manageSqlInstances(ACCOUNT_ID, [
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: TEST_EC2_INSTANCE_ID,
                databaseInstanceNames: ['MSSQLSERVER']
            },
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: 'ANOTHER-EC2-ID',
                databaseInstanceNames: ['SQLINST3']
            }
        ]);
        expect(jobId).toBeDefined();
    });

    it('should handle missing databaseInstanceNames gracefully', async () => {
        const { jobId } = await manageSqlInstances(ACCOUNT_ID, [
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: TEST_EC2_INSTANCE_ID,
                databaseInstanceNames: []
            }
        ]);
        expect(jobId).toBeDefined();
    });
});
