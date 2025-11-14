import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import {
    AssessmentCategories,
    OPTIMIZATION_CATEGORIES,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeCloneParams,
    OptimizeComputeParams,
    OptimizeOperatingSystemParams,
    OptimizeStorageTierParams
} from '../../src/utils/continous-optimization-consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../src/lib/database/database-instance-config';
import {
    bulkCloneOptimization,
    bulkComputeOptimization,
    bulkOptimization
} from '../../src/operations/bulk-cont-opt-operations';
import { updateJobDetails } from '../../src/operations/database/job-operations';

const RESOURCE_ID = '6cbdabbfe3fb147e';
const CREDENTIALS_ID = DEFAULT_AWS_CREDENTIALS_ID;
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
    await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

describe('Continuous optimization optimize operations', () => {
    it('Bulk optimize sizing parameters', async () => {
        const response = await bulkOptimization(ACCOUNT_ID, OPTIMIZATION_CATEGORIES.STORAGE_SIZING, [
            {
                configurationName: OPTIMIZE_SIZING_CONFIGS.HEADROOM,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        region: DEFAULT_AWS_REGION,
                        credentialsId: CREDENTIALS_ID
                    }
                ]
            }
        ]);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize operating system parameters', async () => {
        const response = await bulkOptimization(ACCOUNT_ID, OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM, [
            {
                configurationName: OptimizeOperatingSystemParams.MPIO_SESSIONS,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        region: DEFAULT_AWS_REGION,
                        credentialsId: CREDENTIALS_ID
                    }
                ]
            }
        ]);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize storage-tier parameters', async () => {
        const response = await bulkOptimization(ACCOUNT_ID, OPTIMIZATION_CATEGORIES.STORAGE_TIER, [
            {
                configurationName: OptimizeStorageTierParams.STORAGE_TIER,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        region: DEFAULT_AWS_REGION,
                        credentialsId: CREDENTIALS_ID
                    }
                ]
            }
        ]);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize compute parameters', async () => {
        const response = await bulkComputeOptimization(ACCOUNT_ID, [
            {
                configurationName: OptimizeComputeParams.COMPUTE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        instanceType: 'm5.large',
                        region: DEFAULT_AWS_REGION,
                        credentialsId: CREDENTIALS_ID
                    }
                ]
            }
        ]);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize clone parameters', async () => {
        const hostsToOptimize = [
            {
                configurationName: OptimizeCloneParams.CLONE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        region: DEFAULT_AWS_REGION,
                        credentialsId: CREDENTIALS_ID,
                        sqlServerInstances: [
                            {
                                instanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
                                clones: [
                                    {
                                        cloneDatabaseName: 'sandbox_clonecleanup01',
                                        clonedBy: 'netapp_wf',
                                        action: 'refresh'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ];

        const response = await bulkCloneOptimization(ACCOUNT_ID, hostsToOptimize);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });
});
