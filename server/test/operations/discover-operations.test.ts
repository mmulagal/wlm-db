import { faker } from '@faker-js/faker';
import {
    getHostAndSqlServerInfo,
    validateAndStoreDiscoveredParameters,
    manageSqlServerV2,
    discoverPgSqlResources
} from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import '../simulator/scopes/aws/ec2-scope';
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

    // it('Manage an EC2 hosting SQL Server: No SSM connectivity)', async () => {
    //     try {
    //         await manageSqlServer(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 'i-1d9i5v18g5392mf1v');
    //     } catch (error: any) {
    //         expect(error.message).toEqual(
    //             // eslint-disable-next-line quotes
    //             "Unable to manage instance 'i-1d9i5v18g5392mf1v'. Reason: no SSM connectivity."
    //         );
    //     }
    // });

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

describe('Discover operations: PGSQL', () => {
    it('Discover EC2 instances hosting PostgreSQL Server', async () => {
        const response = await discoverPgSqlResources(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 10);
        const connectedResources = response.items.find(item => item.ssmState === 'connected');
        expect(connectedResources?.pgsqlServerVersion).toEqual('psql (PostgreSQL) 16.5');
        expect(response).toBeDefined();
    });
});
