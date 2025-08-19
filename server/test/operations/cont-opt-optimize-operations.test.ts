import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/cloud-watch-scope';
import '../simulator/scopes/aws/compute-optimizer-scope';

import { optimizeMaxDop, optimizeSizing, optimizeStorage } from '../../src/operations/cont-opt-optimize-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import { AssessmentCategories, OPTIMIZE_SIZING_CONFIGS } from '../../src/utils/continous-optimization-consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../src/lib/database/database-instance-config';
import { updateJobDetails } from '../../src/operations/database/job-operations';
import optimizeCompute from '../../src/operations/continuous-optimization/compute-optimize-operations';
import { optimizeClone } from '../../src/operations/continuous-optimization/mssql/clone-optimization-operations';

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
        databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });

    const DatabaseInstanceConfigDataRecords = [
        {
            resource_id: RESOURCE_ID,
            account_id: ACCOUNT_ID,
            credentials_id: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            database_instance_id: 'f4b7c5d3-e1f6-4g2a-9b5d',
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
            database_instance_id: 'f4b7c5d3-e1f6-4g2a-9b5d',
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

describe('Continuous optimization optimize operations', () => {
    it('Optimize storage parameters', async () => {
        const response = await optimizeStorage({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            databaseHostId: RESOURCE_ID,
            databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            optimizationTargets: [
                {
                    configurationName: 'thin-provisioning',
                    objectsToOptimize: ['vol1', 'vol2']
                }
            ]
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
            'f4b7c5d3-e1f6-4g2a-9b5d',
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
            'f4b7c5d3-e1f6-4g2a-9b5d',
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
            'f4b7c5d3-e1f6-4g2a-9b5d',
            'test-jobid'
        );

        expect(response.jobId).toBeDefined();
    });
});
describe('Continuous optimization optimizeOperatingSystemSettings', () => {
    const databaseHostId = RESOURCE_ID;
    const databaseInstanceId = 'f4b7c5d3-e1f6-4g2a-9b5d';

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
            'f4b7c5d3-e1f6-4g2a-9b5d',
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
                'f4b7c5d3-e1f6-4g2a-9b5d',
                clone,
                configDataNoMatch,
                'test-server',
                'MSSQLSERVER',
                'test-jobid'
            )
        ).rejects.toThrow('Clone sandbox_clonecleanup01 not found for netapp_wf');
    });
});
