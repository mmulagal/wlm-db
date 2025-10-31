import { faker } from '@faker-js/faker';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/bedrock-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/cloud-watch-logs-scope';
import {
    registerDatabaseServerInstances,
    manageSqlServerV2,
    validateAndStoreDiscoveredParameters,
    validateOracleCredentials,
    unmanageDatabaseInstance
} from '../../src/operations/register-operations';
import { DatabaseTypes } from '../../src/utils/consts';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../src/lib/database/db';

const TEST_EC2_INSTANCE_ID = '36E53042-04E8-40C9-AE69-26E56CB0D216';
const TEST_CREDENTIALS_ID = 'f6082f35-c1db-4619-bb5c-84bcb5bf3286';
const TEST_REGION = 'ap-southeast-1';

describe('Manage operations', () => {
    it('should manage SQL instances', async () => {
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
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
        await expect(registerDatabaseServerInstances(ACCOUNT_ID, [])).rejects.toThrow(
            'No MSSQL server instances to be registered'
        );
    });

    it('should manage multiple SQL instances in one call', async () => {
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
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
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
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
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
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
            undefined,
            [TEST_EC2_INSTANCE_ID]
        );
        expect(response).toEqual([
            {
                resourceId: 'ordbsdl',
                databaseServerEdition: '19.0.0.0.0',
                resourceType: 'ORACLE',
                manageReadiness: {
                    assessment: {
                        missingSqlPermissions: [],
                        missingModules: []
                    },
                    remediation: {
                        missingModules: [],
                        missingSqlPermissions: []
                    }
                }
            }
        ]);
    });

    it('Validate Oracle ASM credentials', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const oracleAsmCredentials = [
            {
                resourceId: 'ordbsdl',
                resourceType: 'ORACLE_ASM',
                username: 'username',
                password: 'password'
            }
        ];

        const response = await validateOracleCredentials(
            ACCOUNT_ID,
            credentialsId,
            TEST_REGION,
            TEST_EC2_INSTANCE_ID,
            undefined,
            [],
            oracleAsmCredentials,
            [TEST_EC2_INSTANCE_ID]
        );
        expect(response).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    resourceType: 'ORACLE_ASM'
                })
            ])
        );
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

    it('should throw error if no oracle resources to be registered', async () => {
        await expect(registerDatabaseServerInstances(ACCOUNT_ID, [], DatabaseTypes.ORACLE)).rejects.toThrow(
            'No ORACLE server databases to be registered'
        );
    });

    it('should register Oracle instances', async () => {
        const { jobId } = await registerDatabaseServerInstances(
            ACCOUNT_ID,
            [
                {
                    credentialsId: TEST_CREDENTIALS_ID,
                    region: TEST_REGION,
                    ec2InstanceId: TEST_EC2_INSTANCE_ID,
                    databaseInstanceNames: ['oracleInstance1']
                }
            ],
            DatabaseTypes.ORACLE
        );
        expect(jobId).toBeDefined();
    });

    it('should register Oracle instances for multiple EC2 resources', async () => {
        const { jobId } = await registerDatabaseServerInstances(
            ACCOUNT_ID,
            [
                {
                    credentialsId: TEST_CREDENTIALS_ID,
                    region: TEST_REGION,
                    ec2InstanceId: TEST_EC2_INSTANCE_ID,
                    databaseInstanceNames: ['oracleInstance1']
                },
                {
                    credentialsId: TEST_CREDENTIALS_ID,
                    region: TEST_REGION,
                    ec2InstanceId: 'ANOTHER-EC2-ID',
                    databaseInstanceNames: ['oracleInstance2']
                }
            ],
            DatabaseTypes.ORACLE
        );
        expect(jobId).toBeDefined();
    });

    it('should register multiple Oracle instances in single invocation', async () => {
        const { jobId } = await registerDatabaseServerInstances(
            ACCOUNT_ID,
            [
                {
                    credentialsId: TEST_CREDENTIALS_ID,
                    region: TEST_REGION,
                    ec2InstanceId: TEST_EC2_INSTANCE_ID,
                    databaseInstanceNames: ['oracleInstance1', 'oracleInstance2']
                }
            ],
            DatabaseTypes.ORACLE
        );
        expect(jobId).toBeDefined();
    });
});

describe('Unmanage operations', async () => {
    const RESOURCE_ID = '6cbdabbfe3fb147e';
    const databaseInstanceId1 = 'f4b7c5d3-e1f6-4g2a-9b5d';
    const databaseInstanceId2 = 'f4b7c5d3-e1f6-4g2a-9b5f';
    const resourceName = 'test-resource';

    beforeEach(async () => {
        await createResource(ACCOUNT_ID, {
            resourceId: RESOURCE_ID,
            resourceName,
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: RESOURCE_ID,
            databaseInstanceId: databaseInstanceId1,
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: 'MSSQL'
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: RESOURCE_ID,
            databaseInstanceId: databaseInstanceId2,
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: 'MSSQL'
        });
    });

    afterAll(async () => {
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, '6cbdabbfe3fb147e', [
            databaseInstanceId2,
            databaseInstanceId1
        ]);
        await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
    });

    it('should unmanage a single database instance', async () => {
        const response = await unmanageDatabaseInstance(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            RESOURCE_ID,
            databaseInstanceId1
        );
        expect(response.items.length).toEqual(1);
        expect(response.items.map(item => item.errorMessage).join()).toBe('');
    });

    it('should unmanage multiple database instances', async () => {
        const response = await unmanageDatabaseInstance(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            RESOURCE_ID,
            `${databaseInstanceId1}, ${databaseInstanceId2}`
        );
        expect(response.items.length).toEqual(2);
        expect(response.items.map(item => item.errorMessage).join('')).toBe('');
    });

    it('should throw error if no database instances to unmanage', async () => {
        const response = await unmanageDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, RESOURCE_ID, '42');
        expect(response.items.length).toEqual(1);
        expect(response.items.map(item => item.errorMessage).join()).toBe('Instance does not exist.');
    });
});
