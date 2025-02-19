import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/cloud-watch-scope';
import '../simulator/scopes/aws/compute-optimizer-scope';

import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
import {
    AssessmentCategories,
    OPTIMIZATION_CATEGORIES,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeComputeParams,
    OptimizeOperatingSystemParams,
    OptimizeStorageTierParams
} from '../../src/utils/continous-optimization-consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../src/lib/database/database-instance-config';
import { bulkComputeOptimization, bulkOptimization } from '../../src/operations/bulk-cont-opt-operations';
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
                    'performance-tier': [100, 100, 100],
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
        const response = await bulkOptimization(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            OPTIMIZATION_CATEGORIES.STORAGE_SIZING,
            [
                {
                    type: OPTIMIZE_SIZING_CONFIGS.HEADROOM,
                    databaseHosts: [
                        {
                            id: RESOURCE_ID,
                            sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d']
                        }
                    ]
                }
            ]
        );

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize operating system parameters', async () => {
        const response = await bulkOptimization(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM,
            [
                {
                    type: OptimizeOperatingSystemParams.MPIO_SESSIONS,
                    databaseHosts: [
                        {
                            id: RESOURCE_ID,
                            sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d']
                        }
                    ]
                }
            ]
        );

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize storage-tier parameters', async () => {
        const response = await bulkOptimization(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            OPTIMIZATION_CATEGORIES.STORAGE_TIER,
            [
                {
                    type: OptimizeStorageTierParams.STORAGE_TIER,
                    databaseHosts: [
                        {
                            id: RESOURCE_ID,
                            sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d']
                        }
                    ]
                }
            ]
        );

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });

    it('Bulk optimize compute parameters', async () => {
        const response = await bulkComputeOptimization(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            {
                type: OptimizeComputeParams.COMPUTE,
                databaseHosts: [
                    {
                        id: RESOURCE_ID,
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        instanceType: 'm5.large'
                    }
                ]
            }
        ]);

        expect(response.jobId).toBeDefined();
        await updateJobDetails(ACCOUNT_ID, response.jobId, { status: 'COMPLETED', endTime: Date.now() });
    });
});
