import { vi } from 'vitest';
import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import {
    calculateMSSQLPatchDrift,
    fetchMssqlPatchWithMissingPatches,
    managedHostMSSQLPatchAssessment,
    runMSSQLPatchAssessment
} from '../../../../src/operations/continuous-optimization/mssql/mssqlPatch-assessment-operations';
import * as mssqlOps from '../../../../src/operations/workloads/mssql/mssql-operations';
import { ResourceAssessmentData } from '../../../../src/utils/common-types';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

const RESOURCE_ID = '6cbdabbfe3fb147e';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
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
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        },
        assessmentData: {
            mssqlPatch: [
                {
                    ec2InstanceId: 'i-0a1f31a39bd2d9362',
                    ec2InstanceName: 'SQLServer-Dev-02',
                    missingPatchDetails: [
                        {
                            kbId: 'KB4583458',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB4583458)',
                            severity: 'Important',
                            releaseDate: '2021-01-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB4583459',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB4583459)',
                            severity: 'Important',
                            releaseDate: '2021-01-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5014356',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5014356)',
                            severity: 'Important',
                            releaseDate: '2022-06-14T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5021124',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5021124)',
                            severity: 'Important',
                            releaseDate: '2023-02-14T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5021125',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5021125)',
                            severity: 'Important',
                            releaseDate: '2023-03-05T19:18:30.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5029377',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5029377)',
                            severity: 'Important',
                            releaseDate: '2023-10-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5029378',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5029378)',
                            severity: 'Important',
                            releaseDate: '2023-10-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5035434',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5035434)',
                            severity: 'Important',
                            releaseDate: '2024-04-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5036335',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5036335)',
                            severity: 'Important',
                            releaseDate: '2024-04-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5040948',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5040948)',
                            severity: 'Important',
                            releaseDate: '2024-07-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5040986',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5040986)',
                            severity: 'Important',
                            releaseDate: '2024-07-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5042214',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5042214)',
                            severity: 'Important',
                            releaseDate: '2024-09-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5046056',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5046056)',
                            severity: 'Important',
                            releaseDate: '2024-10-08T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5046859',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5046859)',
                            severity: 'Important',
                            releaseDate: '2024-11-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        }
                    ],
                    missingPatchesCount: 14,
                    criticalMissingPatchesCount: 0,
                    importantMissingPatchesCount: 14
                },
                {
                    ec2InstanceId: 'i-0253886610c274a28',
                    ec2InstanceName: 'SQLServer-QA-02',
                    missingPatchDetails: [
                        {
                            kbId: 'KB4583458',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB4583458)',
                            severity: 'Important',
                            releaseDate: '2021-01-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB4583459',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB4583459)',
                            severity: 'Important',
                            releaseDate: '2021-01-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5014356',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5014356)',
                            severity: 'Important',
                            releaseDate: '2022-06-14T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5021124',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5021124)',
                            severity: 'Important',
                            releaseDate: '2023-02-14T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5021125',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5021125)',
                            severity: 'Important',
                            releaseDate: '2023-03-05T19:18:30.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5029377',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5029377)',
                            severity: 'Important',
                            releaseDate: '2023-10-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5029378',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5029378)',
                            severity: 'Important',
                            releaseDate: '2023-10-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5035434',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5035434)',
                            severity: 'Important',
                            releaseDate: '2024-04-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5036335',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5036335)',
                            severity: 'Important',
                            releaseDate: '2024-04-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5040948',
                            title: 'Security Update for SQL Server 2019 RTM CU (KB5040948)',
                            severity: 'Important',
                            releaseDate: '2024-07-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5040986',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5040986)',
                            severity: 'Important',
                            releaseDate: '2024-07-09T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5042214',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5042214)',
                            severity: 'Important',
                            releaseDate: '2024-09-10T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5046056',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5046056)',
                            severity: 'Important',
                            releaseDate: '2024-10-08T17:00:00.000Z',
                            classification: 'SecurityUpdates'
                        },
                        {
                            kbId: 'KB5046859',
                            title: 'Security Update for SQL Server 2019 RTM GDR (KB5046859)',
                            severity: 'Important',
                            releaseDate: '2024-11-12T18:00:00.000Z',
                            classification: 'SecurityUpdates'
                        }
                    ],
                    missingPatchesCount: 14,
                    criticalMissingPatchesCount: 0,
                    importantMissingPatchesCount: 14
                }
            ]
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
describe('MSSql Patch assessment operations', () => {
    it('should run mssql patch assessment', async () => {
        const result = await runMSSQLPatchAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'i-07e76a4b916548dc0',
            true,
            'i-07e76a4b916548dc0',
            false,
            'MSSQLSERVER'
        );
        expect(result).toBeDefined();
    });

    it('Should calculate mssql patch drift', async () => {
        const [{ assessment_data: assessmentData }] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                selectKeys: ['assessment_data']
            })) || [];
        const response = await calculateMSSQLPatchDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            assessmentData as unknown as ResourceAssessmentData
        );
        expect(response.name).toEqual('mssql-patch');
    });

    it('Should perform mssql patch assessment for managed hosts clustered', async () => {
        const { patchAssessment } =
            (await managedHostMSSQLPatchAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'i-07e76a4b916548dc0',
                true,
                'test-resource',
                false,
                'MSSQLSERVER',
                'test-job-id'
            )) || {};
        expect(patchAssessment?.[0]?.ec2InstanceId).toBeDefined();
    });

    it('Should perform mssql patch assessment for managed hosts standalone', async () => {
        const { patchAssessment } =
            (await managedHostMSSQLPatchAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'i-07e76a4b916548dc0',
                false,
                'test-resource',
                false,
                'MSSQLSERVER',
                'test-job-id'
            )) || [];
        expect(patchAssessment?.[0]?.ec2InstanceId).toBeDefined();
    });
});

describe('fetchMssqlPatchWithMissingPatches', () => {
    const NODE1_INSTANCE_ID = 'i-07e76a4b916548dc0';
    const NODE2_INSTANCE_ID = 'i-0880a21327284f67c';
    const DB_INSTANCE_ID = 'f4b7c5d3-e1f6-4g2a-9b5d';

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns ec2InstancesToPatch for a clustered host using the active SQL node', async () => {
        const response = await fetchMssqlPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            DB_INSTANCE_ID,
            'MSSQLSERVER',
            false,
            NODE1_INSTANCE_ID,
            NODE2_INSTANCE_ID
        );

        expect('errorMessage' in response).toBe(false);
        if ('errorMessage' in response) {
            return;
        }

        expect([AssessmentStatus.OPTIMIZED, AssessmentStatus.NOT_OPTIMIZED]).toContain(response.status);
        expect(Array.isArray(response.ec2InstancesToPatch)).toBe(true);
        expect(response.ec2InstancesToPatch.length).toBeGreaterThan(0);
        response.ec2InstancesToPatch.forEach(({ ec2InstanceId, missingPatchDetails }) => {
            expect(typeof ec2InstanceId).toBe('string');
            expect(Array.isArray(missingPatchDetails)).toBe(true);
        });
    });

    it('returns ec2InstancesToPatch for a standalone host when node2 is not provided', async () => {
        const response = await fetchMssqlPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            DB_INSTANCE_ID,
            'MSSQLSERVER',
            false,
            NODE1_INSTANCE_ID,
            undefined
        );

        expect('errorMessage' in response).toBe(false);
        if ('errorMessage' in response) {
            return;
        }

        expect(response.ec2InstancesToPatch.length).toBeGreaterThan(0);
        response.ec2InstancesToPatch.forEach(instance => {
            expect(typeof instance.ec2InstanceId).toBe('string');
        });
    });

    it('returns an errorMessage when getActiveSqlNode cannot resolve an active node', async () => {
        vi.spyOn(mssqlOps, 'getActiveSqlNode').mockResolvedValueOnce({
            activeNodeInstanceId: '',
            instanceName: ''
        } as unknown as Awaited<ReturnType<typeof mssqlOps.getActiveSqlNode>>);

        const response = await fetchMssqlPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            DB_INSTANCE_ID,
            'MSSQLSERVER',
            false,
            NODE1_INSTANCE_ID,
            NODE2_INSTANCE_ID
        );

        expect(response).toMatchObject({
            errorMessage: expect.stringContaining(`Active node instance ID not found for database host ${RESOURCE_ID}`)
        });
    });

    it('returns a generic errorMessage when getActiveSqlNode throws', async () => {
        vi.spyOn(mssqlOps, 'getActiveSqlNode').mockRejectedValueOnce(new Error('unexpected ssm failure'));

        const response = await fetchMssqlPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            DB_INSTANCE_ID,
            'MSSQLSERVER',
            false,
            NODE1_INSTANCE_ID,
            NODE2_INSTANCE_ID
        );

        expect(response).toMatchObject({
            errorMessage: 'Failed to run MSSQL patch scan'
        });
    });
});
