import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import * as ontapGateway from '../../../../src/lib/ontap/ontap-gateway';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import * as assessmentUtils from '../../../../src/operations/continuous-optimization/assessment-utils';
import {
    getAvailableSnapshotPolicyList,
    handleSharedStorageOptimize,
    optimizeHASharedStorageData,
    optimizeHighAvailabilityConfiguration,
    optimizeSqlServerService
} from '../../../../src/operations/continuous-optimization/mssql/resilience-optimize-operations';
import { RESOURCE_ID } from '../../../../src/utils/consts';
import { OptimizeHighAvailabilityParams } from '../../../../src/utils/continous-optimization-consts';
import { registerJob } from '../../../../src/operations/database/job-operations';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-07e76a4b916548dc0',
            sqlDeploymentType: 'FCI'
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });
});
describe('List snapshot policies om svm and cluster level', () => {
    it('Should list snapshot policies on svm and cluster level', async () => {
        const res = await getAvailableSnapshotPolicyList(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );
        expect(res.snapshotPolicies?.length).toBeGreaterThanOrEqual(1);
        expect(res.snapshotPolicies?.[0].uuid).toBeDefined();
        expect(res.snapshotPolicies?.[0].name).toBeDefined();
        expect(res.snapshotPolicies?.[0].schedules).toBeDefined();
    });
});

describe('Optimize High Availability Configuration', () => {
    let parentJobId: string;

    beforeEach(async () => {
        // Create a parent job for testing
        const { id } = await registerJob(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: 'test-resource',
            name: 'Test Parent Job',
            startTime: Date.now(),
            description: 'Test parent job for optimization'
        });
        parentJobId = id;
    });

    it('should successfully optimize heartbeat settings configuration', async () => {
        await expect(
            optimizeHighAvailabilityConfiguration(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                ['f4b7c5d3-e1f6-4g2a-9b5d'],
                OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS,
                parentJobId
            )
        ).resolves.not.toThrow();
    });

    it('should successfully optimize cluster quorum configuration', async () => {
        await expect(
            optimizeHighAvailabilityConfiguration(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                ['f4b7c5d3-e1f6-4g2a-9b5d'],
                OptimizeHighAvailabilityParams.CLUSTER_QUORUM,
                parentJobId
            )
        ).resolves.not.toThrow();
    });

    it('should throw error for invalid configuration name', async () => {
        await expect(
            optimizeHighAvailabilityConfiguration(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                ['f4b7c5d3-e1f6-4g2a-9b5d'],
                'INVALID_CONFIG',
                parentJobId
            )
        ).rejects.toThrow('Invalid configuration name INVALID_CONFIG');
    });

    it('should throw error for non-existent database host', async () => {
        await expect(
            optimizeHighAvailabilityConfiguration(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                'non-existent-host-id',
                ['f4b7c5d3-e1f6-4g2a-9b5d'],
                OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS,
                parentJobId
            )
        ).rejects.toThrow('No database host by id non-existent-host-id');
    });

    it('should throw error for standalone SQL Server deployment', async () => {
        // Create a standalone resource for testing
        const standaloneResourceId = 'standalone-resource-id';
        await createResource(ACCOUNT_ID, {
            resourceId: standaloneResourceId,
            resourceName: 'standalone-test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-standalone',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-standalone',
                sqlDeploymentType: 'Standalone'
            }
        });

        await expect(
            optimizeHighAvailabilityConfiguration(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                standaloneResourceId,
                ['f4b7c5d3-e1f6-4g2a-9b5d'],
                OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS,
                parentJobId
            )
        ).rejects.toThrow('Standalone SQL Server deployment is not supported for high availability optimization');
    });
});

describe('Optimize SQL Server Service', () => {
    let parentJobId: string;

    beforeEach(async () => {
        // Create a parent job for testing
        const { id } = await registerJob(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: 'test-resource',
            name: 'Test Parent Job for SQL Service',
            startTime: Date.now(),
            description: 'Test parent job for SQL service optimization'
        });
        parentJobId = id;
    });

    it('should successfully optimize SQL Server service configuration', async () => {
        await expect(
            optimizeSqlServerService(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                parentJobId
            )
        ).resolves.not.toThrow();
    }, 120000); // 120 second timeout for complex integration test

    it('should throw error for non-existent database host in SQL service optimization', async () => {
        await expect(
            optimizeSqlServerService(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                'non-existent-host-id',
                'f4b7c5d3-e1f6-4g2a-9b5d',
                parentJobId
            )
        ).rejects.toThrow('No database host by id non-existent-host-id');
    });

    it('should handle missing instance configuration gracefully', async () => {
        // Create a resource without proper instance configuration
        const missingConfigResourceId = 'missing-config-resource-id';
        await createResource(ACCOUNT_ID, {
            resourceId: missingConfigResourceId,
            resourceName: 'missing-config-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-missing-config',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-missing-config',
                sqlDeploymentType: 'FCI'
            }
        });

        await expect(
            optimizeSqlServerService(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                missingConfigResourceId,
                'non-existent-instance-id',
                parentJobId
            )
        ).resolves.not.toThrow();
    });
});

describe('Handle Shared Storage Optimize', () => {
    let parentJobId: string;

    beforeEach(async () => {
        // Create a parent job for testing
        const { id } = await registerJob(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: 'test-resource',
            name: 'Test Parent Job for Shared Storage',
            startTime: Date.now(),
            description: 'Test parent job for shared storage optimization'
        });
        parentJobId = id;
    });

    it('should successfully handle shared storage optimization with valid data', async () => {
        const hostsToOptimize = [
            {
                configurationName: OptimizeHighAvailabilityParams.SHARED_STORAGE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        region: DEFAULT_AWS_REGION,
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
                                ontapLunPaths: ['/vol/test_volume/test_lun']
                            }
                        ]
                    }
                ]
            }
        ];

        await expect(handleSharedStorageOptimize(ACCOUNT_ID, hostsToOptimize, parentJobId)).resolves.not.toThrow();
    });

    it('should handle empty hosts list gracefully', async () => {
        await expect(handleSharedStorageOptimize(ACCOUNT_ID, [], parentJobId)).resolves.not.toThrow();
    });

    it('should handle hosts with no instances gracefully', async () => {
        const hostsToOptimize = [
            {
                configurationName: OptimizeHighAvailabilityParams.SHARED_STORAGE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        region: DEFAULT_AWS_REGION,
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        sqlServerInstances: []
                    }
                ]
            }
        ];

        await expect(handleSharedStorageOptimize(ACCOUNT_ID, hostsToOptimize, parentJobId)).resolves.not.toThrow();
    });

    it('should handle a host with multiple instances', async () => {
        const hostsToOptimize = [
            {
                configurationName: OptimizeHighAvailabilityParams.SHARED_STORAGE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        region: DEFAULT_AWS_REGION,
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'instance-id-1',
                                ontapLunPaths: ['/vol/volume1/lun1']
                            },
                            {
                                databaseInstanceId: 'instance-id-2',
                                ontapLunPaths: ['/vol/volume2/lun2', '/vol/volume3/lun3']
                            }
                        ]
                    }
                ]
            }
        ];

        await expect(handleSharedStorageOptimize(ACCOUNT_ID, hostsToOptimize, parentJobId)).resolves.not.toThrow();
    });
});

describe('optimizeHASharedStorageData', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should use the first FSx id when fsxFileSystem is comma-separated', async () => {
        vi.spyOn(assessmentUtils, 'activeSqlNodeDetails').mockResolvedValue({
            sqlAuthEnabled: false,
            activeNodeInstanceId: 'i-07e76a4b916548dc0',
            fsxId: 'fs-a,fs-b',
            instanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            instanceName: 'MSSQLSERVER',
            databaseType: 'MSSQL',
            awsAccountId: 'test-aws-account',
            serverNameWithHostName: 'test-resource\\MSSQLSERVER',
            svmDetails: {},
            instanceMetadata: {},
            databaseDeploymentType: 'FCI'
        } as Awaited<ReturnType<typeof assessmentUtils.activeSqlNodeDetails>>);

        const addInitiatorsSpy = vi.spyOn(ontapGateway, 'addInitiatorsToIgroup').mockResolvedValue(undefined);

        const { result, error } = await optimizeHASharedStorageData(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            [
                {
                    igroupName: 'igroup-1',
                    igroupUuid: 'igroup-uuid-1',
                    missingIqns: ['iqn.1991-05.com.microsoft:host1']
                }
            ]
        );

        expect(result).toBe('success');
        expect(error).toBe('');
        expect(addInitiatorsSpy).toHaveBeenCalledWith(expect.objectContaining({ fsxId: 'fs-a' }), 'igroup-uuid-1', [
            'iqn.1991-05.com.microsoft:host1'
        ]);
        expect(addInitiatorsSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ fsxId: 'fs-a,fs-b' }),
            expect.anything(),
            expect.anything()
        );
    });

    it('should return partial when only conflicts occur', async () => {
        vi.spyOn(assessmentUtils, 'activeSqlNodeDetails').mockResolvedValue({
            sqlAuthEnabled: false,
            activeNodeInstanceId: 'i-07e76a4b916548dc0',
            fsxId: 'fs-a',
            instanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            instanceName: 'MSSQLSERVER',
            databaseType: 'MSSQL',
            awsAccountId: 'test-aws-account',
            serverNameWithHostName: 'test-resource\\MSSQLSERVER',
            svmDetails: {},
            instanceMetadata: {},
            databaseDeploymentType: 'FCI'
        } as Awaited<ReturnType<typeof assessmentUtils.activeSqlNodeDetails>>);

        vi.spyOn(ontapGateway, 'addInitiatorsToIgroup')
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('409 Conflict'));

        const { result, error } = await optimizeHASharedStorageData(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            [
                {
                    igroupName: 'igroup-ok',
                    igroupUuid: 'igroup-uuid-ok',
                    missingIqns: ['iqn.1991-05.com.microsoft:host1']
                },
                {
                    igroupName: 'ig1',
                    igroupUuid: 'igroup-uuid-conflict',
                    missingIqns: ['iqn.1991-05.com.microsoft:host2']
                }
            ]
        );

        expect(result).toBe('partial');
        expect(error).toBe('Initiator already exists in igroup ig1 (409 Conflict)');
    });

    it('should delimit multiple failed outcomes with a semicolon', async () => {
        vi.spyOn(assessmentUtils, 'activeSqlNodeDetails').mockResolvedValue({
            sqlAuthEnabled: false,
            activeNodeInstanceId: 'i-07e76a4b916548dc0',
            fsxId: 'fs-a',
            instanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            instanceName: 'MSSQLSERVER',
            databaseType: 'MSSQL',
            awsAccountId: 'test-aws-account',
            serverNameWithHostName: 'test-resource\\MSSQLSERVER',
            svmDetails: {},
            instanceMetadata: {},
            databaseDeploymentType: 'FCI'
        } as Awaited<ReturnType<typeof assessmentUtils.activeSqlNodeDetails>>);

        vi.spyOn(ontapGateway, 'addInitiatorsToIgroup')
            .mockRejectedValueOnce(new Error('first failure'))
            .mockRejectedValueOnce(new Error('second failure'));

        const { result, error } = await optimizeHASharedStorageData(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            [
                {
                    igroupName: 'igroup-1',
                    igroupUuid: 'igroup-uuid-1',
                    missingIqns: ['iqn.1991-05.com.microsoft:host1']
                },
                {
                    igroupName: 'igroup-2',
                    igroupUuid: 'igroup-uuid-2',
                    missingIqns: ['iqn.1991-05.com.microsoft:host2']
                }
            ]
        );

        expect(result).toBe('failed');
        expect(error).toBe('first failure; second failure');
    });
});
