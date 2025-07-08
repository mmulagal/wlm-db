import { faker } from '@faker-js/faker';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/bedrock-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/cloud-watch-logs-scope';
import {
    registerSqlInstances,
    manageSqlServerV2,
    validateAndStoreDiscoveredParameters,
    validateOracleCredentials
} from '../../src/operations/register-operations';

const TEST_EC2_INSTANCE_ID = '36E53042-04E8-40C9-AE69-26E56CB0D216';
const TEST_CREDENTIALS_ID = 'f6082f35-c1db-4619-bb5c-84bcb5bf3286';
const TEST_REGION = 'ap-southeast-1';

describe('Manage operations', () => {
    it('should manage SQL instances', async () => {
        const { jobId } = await registerSqlInstances(ACCOUNT_ID, [
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
        await expect(registerSqlInstances(ACCOUNT_ID, [])).rejects.toThrow('No sql instances to be registered');
    });

    it('should manage multiple SQL instances in one call', async () => {
        const { jobId } = await registerSqlInstances(ACCOUNT_ID, [
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
        const { jobId } = await registerSqlInstances(ACCOUNT_ID, [
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
        const { jobId } = await registerSqlInstances(ACCOUNT_ID, [
            {
                credentialsId: TEST_CREDENTIALS_ID,
                region: TEST_REGION,
                ec2InstanceId: TEST_EC2_INSTANCE_ID,
                databaseInstanceNames: []
            }
        ]);
        expect(jobId).toBeDefined();
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

    it('Validate Oracle discovered resource credentials', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const fsxCredentials = {
            resourceId: 'fs-0d5efc3057c4cb',
            resourceType: 'FSX',
            username: 'username',
            password: 'password'
        };
        const oracleCredentials = [
            {
                resourceId: 'ordbsdl',
                resourceType: 'ORACLE',
                username: 'username',
                password: 'password'
            }
        ];

        const response = await validateOracleCredentials(
            ACCOUNT_ID,
            credentialsId,
            TEST_REGION,
            TEST_EC2_INSTANCE_ID,
            fsxCredentials,
            oracleCredentials,
            [TEST_EC2_INSTANCE_ID]
        );
        expect(response).toEqual([
            { resourceId: 'ordbsdl', databaseServerEdition: '19.0.0.0.0', resourceType: 'ORACLE' }
        ]);
    });

    it('Manage EC2 hosting SQL Server V2: No SSM connectivity)', async () => {
        const resp = await manageSqlServerV2(ACCOUNT_ID, [
            {
                credentialsId: CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                ec2InstanceId: 'i-1d9i5v18g5392mf1v',
                databaseInstanceNames: ['NO_SUCH_INSTANCE']
            }
        ]);

        expect(resp).toEqual({
            hosts: [
                {
                    resourceId: '67e09d3a49604bf2',
                    instances: [
                        {
                            databaseInstanceName: 'NO_SUCH_INSTANCE',
                            status: 'failed',
                            errorMessage: 'SQL Server instance not found.'
                        }
                    ],
                    credentialsId: CREDENTIALS_ID,
                    region: 'us-east-1',
                    ec2InstanceId: 'i-1d9i5v18g5392mf1v'
                }
            ]
        });
    });
});
