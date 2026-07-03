import { optimizeMaxDop, optimizeSizing, optimizeStorage } from '../../src/operations/cont-opt-optimize-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import { AssessmentCategories, OPTIMIZE_SIZING_CONFIGS } from '../../src/utils/continous-optimization-consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../src/lib/database/database-instance-config';
import { updateJobDetails } from '../../src/operations/database/job-operations';
import optimizeCompute from '../../src/operations/continuous-optimization/compute-optimize-operations';
import { optimizeClone } from '../../src/operations/continuous-optimization/mssql/clone-optimization-operations';
import {
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
} from '../../src/operations/workloads/mssql/const';

const RESOURCE_ID = '6cbdabbfe3fb147e';
const CREDENTIALS_ID = DEFAULT_AWS_CREDENTIALS_ID;

const clone = {
    cloneDatabaseName: 'sandbox_clonecleanup01',
    clonedBy: 'netapp_wf',
    action: 'refresh'
};

const oldCloneDetails = [
    {
        cloneDatabaseName: 'sandbox_clonecleanup01',
        clonedBy: 'netapp_wf',
        action: 'refresh',
        databaseHostName: 'test-host',
        databaseHostId: RESOURCE_ID,
        databaseInstanceName: 'MSSQLSERVER'
    }
];

const configData = {
    oldCloneDetails,
    status: 'not-optimized'
};

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: 'MSSQL'
    });

    const DatabaseInstanceConfigDataRecords = [
        {
            resource_id: RESOURCE_ID,
            account_id: ACCOUNT_ID,
            credentials_id: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            database_instance_id: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            creation_time: new Date(),
            last_updated: new Date(),
            config_data: {
                maxdop: {
                    current: '4',
                    recommendedMaxDOP: '4'
                },
                os: {
                    'mpio-enabled': true,
                    'mpio-iscsi-count': '5',
                    'ntfs-allocation-details': {},
                    'mpio-load-balance-policy': 'RR',
                    'ntfs-allocation-unit-size': 65536,
                    'mpio-load-balance-policy-details': [
                        {
                            disk: 'Disk 4',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 1',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 8',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 2',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 3',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 5',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 6',
                            policy: 'RR'
                        },
                        {
                            disk: 'Disk 7',
                            policy: 'RR'
                        }
                    ]
                },
                luns: [
                    {
                        name: '/vol/wlmdb_sqllog_1721094267674/sqllog',
                        'os-type': 'windows_2008',
                        'space-reservation-enabled': true,
                        'space-allocation-allocated': true
                    },
                    {
                        name: '/vol/wlmdb_sqltemp_1721094267674/tempdb',
                        'os-type': 'windows_2008',
                        'space-reservation-enabled': true,
                        'space-allocation-allocated': true
                    },
                    {
                        name: '/vol/wlmdb_sqldata_1721094267674/sqldata',
                        'os-type': 'windows_2008',
                        'space-reservation-enabled': true,
                        'space-allocation-allocated': true
                    },
                    {
                        name: '/vol/wlmdb_sqldata_1721086300049_clone_1721865177/sqldata',
                        'os-type': 'windows_2008',
                        'space-reservation-enabled': true,
                        'space-allocation-allocated': true
                    },
                    {
                        name: '/vol/wlmdb_sqllog_1721086300049_clone_1721865177/sqllog',
                        'os-type': 'windows_2008',
                        'space-reservation-enabled': true,
                        'space-allocation-allocated': true
                    }
                ],
                layout: {
                    'tempdb-files-location': 'separate-drive',
                    'default-log-files-location': 'separate-drive',
                    'default-data-files-location': 'separate-drive'
                },
                sizing: {
                    'performance-tier': [
                        {
                            volumeName: 'wlmdb_sqldata_1740015122754',
                            performanceTierPercent: 100
                        },
                        {
                            volumeName: 'wlmdb_sqldata_1740027207',
                            performanceTierPercent: 100
                        },
                        {
                            volumeName: 'wlmdb_sqllog_1740027207',
                            performanceTierPercent: 100
                        },
                        {
                            volumeName: 'wlmdb_sqltemp_1740015122754',
                            performanceTierPercent: 100
                        }
                    ],
                    'data-log-drive-details': [
                        {
                            databaseName: 'casaba',
                            logDriveLetter: 'L:',
                            dataDriveLetter: 'S:',
                            logDriveTotalSizeMB: 33262,
                            dataDriveTotalSizeMB: 133102
                        },
                        {
                            databaseName: 'msdb',
                            logDriveLetter: 'L:',
                            dataDriveLetter: 'S:',
                            logDriveTotalSizeMB: 33262,
                            dataDriveTotalSizeMB: 133102
                        },
                        {
                            databaseName: 'sandbox_1721865004590',
                            logDriveLetter: 'L:',
                            dataDriveLetter: 'S:',
                            logDriveTotalSizeMB: 33262,
                            dataDriveTotalSizeMB: 133102
                        },
                        {
                            databaseName: 'tpcc',
                            logDriveLetter: 'L:',
                            dataDriveLetter: 'S:',
                            logDriveTotalSizeMB: 33262,
                            dataDriveTotalSizeMB: 133102
                        }
                    ],
                    'data-tempdb-drive-details': {
                        tempdbDriveLetter: 'T:',
                        defaultDataDriveSize: 133102,
                        defaultDataDriveLetter: 'S:',
                        tempdbDriveTotalSizeMB: 13294
                    }
                },
                volumes: [
                    {
                        name: 'wlmdb_sqldata_1721086300049_clone_1721865177',
                        autosize: 'on',
                        'autosize-mode': 'grow',
                        'thin-provision': true,
                        'tiering-policy': 'snapshot_only',
                        'space-guarantee': 'none',
                        'fractional-reserve': 0,
                        'snapshot-autodelete': false,
                        'snapshot-copy-reserve': 0,
                        'tiering-min-cooling-days': 7
                    },
                    {
                        name: 'wlmdb_sqllog_1721086300049_clone_1721865177',
                        autosize: 'on',
                        'autosize-mode': 'grow',
                        'thin-provision': true,
                        'tiering-policy': 'snapshot_only',
                        'space-guarantee': 'none',
                        'fractional-reserve': 0,
                        'snapshot-autodelete': false,
                        'snapshot-copy-reserve': 0,
                        'tiering-min-cooling-days': 7
                    },
                    {
                        name: 'wlmdb_sqllog_1721094267674',
                        autosize: 'on',
                        'autosize-mode': 'grow',
                        'thin-provision': true,
                        'tiering-policy': 'snapshot_only',
                        'space-guarantee': 'none',
                        'fractional-reserve': 0,
                        'snapshot-autodelete': false,
                        'snapshot-copy-reserve': 0,
                        'tiering-min-cooling-days': 7
                    },
                    {
                        name: 'wlmdb_sqltemp_1721094267674',
                        autosize: 'on',
                        'autosize-mode': 'grow',
                        'thin-provision': true,
                        'tiering-policy': 'snapshot_only',
                        'space-guarantee': 'none',
                        'fractional-reserve': 0,
                        'snapshot-autodelete': false,
                        'snapshot-copy-reserve': 0,
                        'tiering-min-cooling-days': 7
                    },
                    {
                        name: 'wlmdb_sqldata_1721094267674',
                        autosize: 'on',
                        'autosize-mode': 'grow',
                        'thin-provision': true,
                        'tiering-policy': 'snapshot_only',
                        'space-guarantee': 'none',
                        'fractional-reserve': 0,
                        'snapshot-autodelete': false,
                        'snapshot-copy-reserve': 0,
                        'tiering-min-cooling-days': 7
                    }
                ],
                filesystemId: 'fs-01166dc75715b8826'
            },
            config_data_type: AssessmentCategories.STORAGE
        }
    ];

    const DatabaseInstanceMaxDOPConfigDataRecords = [
        {
            resource_id: RESOURCE_ID,
            account_id: ACCOUNT_ID,
            credentials_id: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            database_instance_id: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            creation_time: new Date(),
            last_updated: new Date(),
            config_data: {
                current: '4',
                recommendedMaxDOP: '4'
            },
            config_data_type: AssessmentCategories.MAXDOP
        }
    ];
    await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
    await createDatabaseInstanceConfigData(DatabaseInstanceMaxDOPConfigDataRecords);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

// async function waitForStorageOptimizeSubJobs(
//     jobId: string,
//     expectedSubJobCount: number
// ): Promise<Awaited<ReturnType<typeof getJobDetails>> & { subJobs: Job[] }> {
//     for (let attempt = 0; attempt < 50; attempt++) {
//         // eslint-disable-next-line no-await-in-loop
//         const jobDetails = await getJobDetails(ACCOUNT_ID, jobId, CREDENTIALS_ID, DEFAULT_AWS_REGION);
//         const storageSubJobs = jobDetails.subJobs.filter((subJob: Job) =>
//             subJob.name?.includes('Storage Configuration')
//         );
//         if (
//             storageSubJobs.length === expectedSubJobCount &&
//             storageSubJobs.every((subJob: Job) => subJob.status === 'COMPLETED')
//         ) {
//             return { ...jobDetails, subJobs: storageSubJobs };
//         }
//         // eslint-disable-next-line no-await-in-loop
//         await sleep(100);
//     }
//     const jobDetails = await getJobDetails(ACCOUNT_ID, jobId, CREDENTIALS_ID, DEFAULT_AWS_REGION);
//     const storageSubJobs = jobDetails.subJobs.filter((subJob: Job) => subJob.name?.includes('Storage Configuration'));
//     throw new Error(
//         `Storage optimize sub-jobs for ${jobId} did not settle: ${JSON.stringify(
//             storageSubJobs.map((subJob: Job) => ({
//                 status: subJob.status,
//                 error: subJob.error
//             }))
//         )}`
//     );
// }

describe('Continuous optimization optimize operations', () => {
    it('Optimize storage parameters', async () => {
        const response = await optimizeStorage({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            databaseHostId: RESOURCE_ID,
            databaseInstanceId: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            optimizationTargets: [
                {
                    configurationName: 'thin-provisioning',
                    objectsToOptimize: ['vol1', 'vol2']
                }
            ],
            documentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
        });
        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Optimize storage parameters using combined tiering target', async () => {
        const response = await optimizeStorage({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            databaseHostId: RESOURCE_ID,
            databaseInstanceId: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            optimizationTargets: [
                {
                    configurationName: 'tiering-tco-optimization',
                    objectsToOptimize: ['wlmdb_sqldata_1721094267674', 'wlmdb_sqltemp_1721094267674']
                }
            ],
            documentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
        });

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Optimize sizing parameters', async () => {
        const response = await optimizeSizing(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            [OPTIMIZE_SIZING_CONFIGS.HEADROOM, OPTIMIZE_SIZING_CONFIGS.LOG_DRIVE_SIZE]
        );

        expect(response.jobId).toBeDefined();
    });

    it('Optimize compute parameters', async () => {
        const response = await optimizeCompute(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            'm5.large'
        );

        expect(response.jobId).toBeDefined();
    });

    it('Optimize max dop', async () => {
        const response = await optimizeMaxDop(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            'test-jobid'
        );

        expect(response.jobId).toBeDefined();
    });

    // it('should deduplicate identical ONTAP PATCH requests across sub-jobs', async () => {
    //     const objectsToOptimize = [
    //         'wlmdb_sqldata_1721094267674',
    //         'wlmdb_sqltemp_1721094267674',
    //         'wlmdb_sqllog_1721094267674'
    //     ];

    //     const response = await optimizeStorage({
    //         accountId: ACCOUNT_ID,
    //         credentialsId: CREDENTIALS_ID,
    //         region: DEFAULT_AWS_REGION,
    //         databaseHostId: RESOURCE_ID,
    //         databaseInstanceId: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
    //         optimizationTargets: [
    //             {
    //                 configurationName: OptimizeStorageConfigs.THIN_PROVISIONING,
    //                 objectsToOptimize
    //             },
    //             {
    //                 configurationName: OptimizeStorageConfigs.THIN_PROVISIONING,
    //                 objectsToOptimize
    //             }
    //         ],
    //         documentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
    //         documentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
    //     });

    //     try {
    //         const jobDetails = await waitForStorageOptimizeSubJobs(response.jobId, 2);

    //         expect(jobDetails.subJobs).toHaveLength(2);
    //         expect(jobDetails.subJobs.every((subJob: Job) => subJob.status === 'COMPLETED')).toBe(true);
    //     } finally {
    //         await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    //     }
    // });

    // it('should drop empty objectsToOptimize targets and optimize actionable ones', async () => {
    //     const response = await optimizeStorage({
    //         accountId: ACCOUNT_ID,
    //         credentialsId: CREDENTIALS_ID,
    //         region: DEFAULT_AWS_REGION,
    //         databaseHostId: RESOURCE_ID,
    //         databaseInstanceId: 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
    //         optimizationTargets: [
    //             {
    //                 configurationName: OptimizeStorageConfigs.AUTOSIZE,
    //                 objectsToOptimize: []
    //             },
    //             {
    //                 configurationName: OptimizeStorageConfigs.THIN_PROVISIONING,
    //                 objectsToOptimize: ['wlmdb_sqldata_1721094267674', 'wlmdb_sqltemp_1721094267674']
    //             }
    //         ],
    //         documentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
    //         documentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
    //     });

    //     expect(response.jobId).toBeDefined();

    //     const jobDetails = await waitForStorageOptimizeSubJobs(response.jobId, 1);
    //     expect(jobDetails.subJobs).toHaveLength(1);

    //     await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    // });
});
describe('Continuous optimization optimizeOperatingSystemSettings', () => {
    const databaseHostId = RESOURCE_ID;
    const databaseInstanceId = 'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456';

    it('should optimize MPIO policy', async () => {
        const { optimizeOperatingSystemSettings } = await import('../../src/operations/cont-opt-optimize-operations');
        try {
            const response = await optimizeOperatingSystemSettings(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                databaseHostId,
                databaseInstanceId,
                'mpio-load-balance-policy'
            );
            expect(response.jobId).toBeDefined();
            await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
        } catch (err: any) {
            // If PreconditionFailedError, extract jobId and mark as completed, then retry once
            if (err.status === 412 && /ID:\s+([a-f0-9-]+)/i.test(err.message)) {
                const match = err.message.match(/ID:\s+([a-f0-9-]+)/i);
                if (match) {
                    const jobId = match[1];
                    await updateJobDetails(ACCOUNT_ID, jobId, { status: 'COMPLETED', endTime: Date.now() });
                    // Retry after marking previous job as completed
                    const response = await optimizeOperatingSystemSettings(
                        ACCOUNT_ID,
                        CREDENTIALS_ID,
                        DEFAULT_AWS_REGION,
                        databaseHostId,
                        databaseInstanceId,
                        'mpio-load-balance-policy'
                    );
                    expect(response.jobId).toBeDefined();
                    await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    });

    it('should optimize MPIO sessions', async () => {
        const { optimizeOperatingSystemSettings } = await import('../../src/operations/cont-opt-optimize-operations');
        try {
            const response = await optimizeOperatingSystemSettings(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                databaseHostId,
                databaseInstanceId,
                'mpio-iscsi-count'
            );
            expect(response.jobId).toBeDefined();
            await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
        } catch (err: any) {
            // If PreconditionFailedError, extract jobId and mark as completed, then retry once
            if (err.status === 412 && /ID:\s+([a-f0-9-]+)/i.test(err.message)) {
                const match = err.message.match(/ID:\s+([a-f0-9-]+)/i);
                if (match) {
                    const jobId = match[1];
                    await updateJobDetails(ACCOUNT_ID, jobId, { status: 'COMPLETED', endTime: Date.now() });
                    // Retry after marking previous job as completed
                    const response = await optimizeOperatingSystemSettings(
                        ACCOUNT_ID,
                        CREDENTIALS_ID,
                        DEFAULT_AWS_REGION,
                        databaseHostId,
                        databaseInstanceId,
                        'mpio-iscsi-count'
                    );
                    expect(response.jobId).toBeDefined();
                    await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    });

    it('should enable MPIO and configure sessions', async () => {
        const { optimizeOperatingSystemSettings } = await import('../../src/operations/cont-opt-optimize-operations');
        try {
            const response = await optimizeOperatingSystemSettings(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                databaseHostId,
                databaseInstanceId,
                'mpio-enabled'
            );
            expect(response.jobId).toBeDefined();
            await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
        } catch (err: any) {
            // If PreconditionFailedError, extract jobId and mark as completed, then retry once
            if (err.status === 412 && /ID:\s+([a-f0-9-]+)/i.test(err.message)) {
                const match = err.message.match(/ID:\s+([a-f0-9-]+)/i);
                if (match) {
                    const jobId = match[1];
                    await updateJobDetails(ACCOUNT_ID, jobId, { status: 'COMPLETED', endTime: Date.now() });
                    // Retry after marking previous job as completed
                    const response = await optimizeOperatingSystemSettings(
                        ACCOUNT_ID,
                        CREDENTIALS_ID,
                        DEFAULT_AWS_REGION,
                        databaseHostId,
                        databaseInstanceId,
                        'mpio-enabled'
                    );
                    expect(response.jobId).toBeDefined();
                    await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    });

    it('should set MPIO timeout', async () => {
        const { optimizeOperatingSystemSettings } = await import('../../src/operations/cont-opt-optimize-operations');
        // Ensure any previous job is marked as completed before running this test
        // This is a workaround for PreconditionFailedError due to running jobs
        try {
            const response = await optimizeOperatingSystemSettings(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                databaseHostId,
                databaseInstanceId,
                'mpio-timeout'
            );
            expect(response.jobId).toBeDefined();
            await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
        } catch (err: any) {
            // If PreconditionFailedError, extract jobId and mark as completed, then retry once
            if (err.status === 412 && /ID:\s+([a-f0-9-]+)/i.test(err.message)) {
                const match = err.message.match(/ID:\s+([a-f0-9-]+)/i);
                if (match) {
                    const jobId = match[1];
                    await updateJobDetails(ACCOUNT_ID, jobId, { status: 'COMPLETED', endTime: Date.now() });
                    // Retry after marking previous job as completed
                    const response = await optimizeOperatingSystemSettings(
                        ACCOUNT_ID,
                        CREDENTIALS_ID,
                        DEFAULT_AWS_REGION,
                        databaseHostId,
                        databaseInstanceId,
                        'mpio-timeout'
                    );
                    expect(response.jobId).toBeDefined();
                    await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    });

    it('should optimize clone and complete the job', async () => {
        const response = await optimizeClone(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
            clone,
            configData,
            'test-server',
            'MSSQLSERVER',
            'test-jobid'
        );

        expect(response).toBeUndefined();
    });

    it('should throw error if matching clone is not found', async () => {
        const configDataNoMatch = {
            oldCloneDetails: [
                {
                    cloneDatabaseName: 'sandbox_clonecleanup02',
                    clonedBy: 'netapp_wf',
                    action: 'refresh',
                    databaseHostName: 'test-host',
                    databaseHostId: RESOURCE_ID,
                    databaseInstanceName: 'MSSQLSERVER'
                }
            ],
            status: 'not-optimized'
        };
        await expect(
            optimizeClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'f4b7c5d3-e1f6-4a2a-9b5d-c8e9f0123456',
                clone,
                configDataNoMatch,
                'test-server',
                'MSSQLSERVER',
                'test-jobid'
            )
        ).rejects.toThrow('Clone sandbox_clonecleanup01 not found for netapp_wf');
    });
});
