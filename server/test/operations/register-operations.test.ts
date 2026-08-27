import { faker } from '@faker-js/faker';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

import * as fsxOperations from '../../src/operations/aws/fsx-operations';
import {
    registerDatabaseServerInstances,
    manageSqlServerV2,
    validateAndStoreDiscoveredParameters,
    validateOracleCredentials,
    validateWindowsCredentials,
    unmanageDatabaseInstance
} from '../../src/operations/register-operations';
import { AWS_SSM_PARAMETER, DatabaseTypes, SSM_COMMAND_CACHE_TYPE, SSM_PARAM_PREFIX } from '../../src/utils/consts';
import { hasCache, writeToCache } from '../../src/utils/cache';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../src/lib/database/db';
import { registerProxyGetResponse, resetProxyOverrides } from '../simulator/scopes/cloud-manager/proxy-forwarder-scope';

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

    it('should store discovered resource credentials and clear stale caches', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const instanceId = 'i-0e5af83448e1b83ef';
        const commandCacheKey = `stale-mssql-discovery-${credentialsId}`;

        const params = [
            {
                resourceId: 'instanceId', // required
                resourceType: 'MSSQL', // required
                username: 'username',
                password: 'password'
            }
        ];
        writeToCache(AWS_SSM_PARAMETER, `${SSM_PARAM_PREFIX}${instanceId}`, '{"sql":[]}');
        writeToCache(SSM_COMMAND_CACHE_TYPE, commandCacheKey, 'stale discovery');

        const { response } = await validateAndStoreDiscoveredParameters(
            ACCOUNT_ID,
            credentialsId,
            'us-east-1',
            instanceId,
            params
        );
        expect(response).toBeDefined();
        expect(hasCache(AWS_SSM_PARAMETER, `${SSM_PARAM_PREFIX}${instanceId}`)).toBe(false);
        expect(hasCache(SSM_COMMAND_CACHE_TYPE, commandCacheKey)).toBe(false);
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

        const { response } = await validateOracleCredentials(
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

        const { response } = await validateOracleCredentials(
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

    describe('validateWindowsCredentials: ONTAP connectivity', () => {
        const WINDOWS_EC2_INSTANCE_ID = 'i-07e76a4b916548dc0';

        function mockManagementEndpoint(fsxId: string): void {
            vi.spyOn(fsxOperations, 'getFSXDetails').mockResolvedValueOnce([
                {
                    fileSystemId: fsxId,
                    lifecycle: 'AVAILABLE',
                    ontapConfiguration: {
                        endpoints: {
                            management: { dnsName: `management.${fsxId}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com` }
                        }
                    }
                }
            ]);
        }

        afterEach(() => {
            vi.restoreAllMocks();
            resetProxyOverrides();
        });

        it('should register FSx ONTAP credentials when the cluster connectivity check succeeds', async () => {
            const fsxId = 'fs-0f53fbecdd3d85fb2';
            mockManagementEndpoint(fsxId);
            registerProxyGetResponse({
                targetId: fsxId,
                ontapPath: 'api/cluster',
                body: { version: { full: 'NetApp Release 9.13.1' } }
            });
            const fsxCredentials = {
                resourceId: fsxId,
                resourceType: 'FSX',
                username: 'fsxadmin',
                password: 'netapp1!'
            };

            const { response } = await validateWindowsCredentials(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                WINDOWS_EC2_INSTANCE_ID,
                fsxCredentials,
                [],
                [],
                [WINDOWS_EC2_INSTANCE_ID]
            );

            expect(response).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        resourceId: fsxId,
                        resourceType: 'FSX',
                        fsxnError: ''
                    })
                ])
            );
        });

        it('should surface the ONTAP error without registering credentials when connectivity fails', async () => {
            const fsxId = 'error-target';
            mockManagementEndpoint(fsxId);
            const fsxCredentials = {
                resourceId: fsxId,
                resourceType: 'FSX',
                username: 'fsxadmin',
                password: 'netapp1!'
            };

            const { response } = await validateWindowsCredentials(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                WINDOWS_EC2_INSTANCE_ID,
                fsxCredentials,
                [],
                [],
                [WINDOWS_EC2_INSTANCE_ID]
            );

            const fsxResult = response.find(item => item.resourceId === fsxId);
            expect(fsxResult).toMatchObject({ resourceId: fsxId, resourceType: 'FSX' });
            expect(fsxResult?.fsxnError).toBeTruthy();
        });
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
            'No ORACLE databases to be registered'
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

describe('Register operations: AOAG Standalone', () => {
    const AOAG_EC2_INSTANCE_ID = 'i-0a1b2c3d4e5f6aoag1';
    const AOAG_CREDENTIALS_ID = 'aoag-test-cred-001';
    const AOAG_REGION = 'ap-southeast-1';

    it('should register AOAG instance successfully', async () => {
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
            {
                credentialsId: AOAG_CREDENTIALS_ID,
                region: AOAG_REGION,
                ec2InstanceId: AOAG_EC2_INSTANCE_ID,
                databaseInstanceNames: ['MSSQLSERVER']
            }
        ]);
        expect(jobId).toBeDefined();
    });

    it('should register AOAG primary instance', async () => {
        const { jobId } = await registerDatabaseServerInstances(ACCOUNT_ID, [
            {
                credentialsId: AOAG_CREDENTIALS_ID,
                region: AOAG_REGION,
                ec2InstanceId: AOAG_EC2_INSTANCE_ID,
                databaseInstanceNames: ['MSSQLSERVER']
            }
        ]);
        expect(jobId).toBeDefined();
    });

    it('should validate and store AOAG credentials', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const params = [
            {
                resourceId: 'MSSQLSERVER',
                resourceType: 'MSSQL',
                username: 'aoag_user',
                password: 'aoag_password'
            }
        ];
        const { response } = await validateAndStoreDiscoveredParameters(
            ACCOUNT_ID,
            credentialsId,
            AOAG_REGION,
            AOAG_EC2_INSTANCE_ID,
            params
        );
        expect(response).toBeDefined();
    });
});
