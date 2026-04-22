export const offlineAssessmentDemoSTD = {
    metadata: {
        databaseType: 'MSSQL',
        storageEndpoint: 'fs-0f06b4d3901153300',
        virtualNetworkId: 'vpc-046f7e26255458373',
        ontapHostName: 'management.fs-0f06b4d3901153300.fsx.ap-southeast-1.amazonaws.com',
        ec2InstanceId: 'demo-sql-prod-std-001',
        ec2InstanceType: {
            Value: 'm5.large'
        },
        vmName: 'SQL-PROD-STD-01',
        credentialSource: 'Interactive',
        ec2UsageOperation: 'RunInstances:0006',
        osVersion: 'Microsoft Windows Server 2022 Datacenter',
        assessmentTimestamp: '2026-02-11T05:41:20Z',
        region: 'ap-southeast-1',
        virtualNetworkName: 'demo-vpc',
        hostname: 'SQL-PROD-STD-01',
        numberOfDatabaseInstances: 1
    },
    rawdata: {
        hostLevelDetails: {
            errors: {},
            headroom: {
                aggregateCount: 1,
                storageAvailableInBytes: 922652327936,
                ssdStorageCapacityInBytes: 925308932096,
                storageUsedInBytes: 2656604160,
                headroomPercent: 100
            },
            rssConfig: {
                rssAdapters: [],
                rssConfigFinding: 'optimized',
                recommendedAdapterSettings: {},
                tcpOffloadState: 'Disabled',
                totalObjectsAssessed: 1,
                totalObjectsInViolation: 0
            }
        },
        instanceLevelDetails: {
            MSSQLSERVER: {
                mappedVolumes: {
                    volumeDBMap: [
                        {
                            ontapVolumeuuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'master',
                            ontapVolumeName: 'wlmdb_sqldata_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'master',
                            ontapVolumeName: 'wlmdb_sqllog_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'model',
                            ontapVolumeName: 'wlmdb_sqldata_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'model',
                            ontapVolumeName: 'wlmdb_sqllog_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'msdb',
                            ontapVolumeName: 'wlmdb_sqldata_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'msdb',
                            ontapVolumeName: 'wlmdb_sqllog_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'b8fc4031-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'tempdb',
                            ontapVolumeName: 'wlmdb_sqltemp_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'CustomerDB',
                            ontapVolumeName: 'wlmdb_sqldata_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'CustomerDB',
                            ontapVolumeName: 'wlmdb_sqllog_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'ProductDB',
                            ontapVolumeName: 'wlmdb_sqldata_1770775096801'
                        },
                        {
                            ontapVolumeuuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            databaseName: 'ProductDB',
                            ontapVolumeName: 'wlmdb_sqllog_1770775096801'
                        }
                    ],
                    luns: [
                        {
                            uuid: '5dade84d-d567-4077-89be-91c9ac0c3d41',
                            name: '/vol/wlmdb_sqldata_1770775096801/sqldata',
                            serial_number: 'lWB0t?Ze3zn1'
                        },
                        {
                            uuid: '1071ce88-0a92-42d3-bd95-20bed179e67c',
                            name: '/vol/wlmdb_sqltemp_1770775096801/tempdb',
                            serial_number: 'lWB0t?Ze3zn3'
                        },
                        {
                            uuid: '309c04cc-88c3-40f3-b3bc-36e2970f3980',
                            name: '/vol/wlmdb_sqllog_1770775096801/sqllog',
                            serial_number: 'lWB0t?Ze3zn2'
                        }
                    ],
                    volumes: {
                        records: [
                            {
                                uuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                                name: 'wlmdb_sqldata_1770775096801',
                                snapshot_count: 1,
                                svm: {
                                    name: 'wlmdb_sqlsvm_1770775096801',
                                    uuid: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                                    _links: {
                                        self: {
                                            href: '/api/svm/svms/6c800e9f-06f2-11f1-a170-7143fc0c8c33'
                                        }
                                    }
                                }
                            },
                            {
                                uuid: 'b8fc4031-06f2-11f1-a170-7143fc0c8c33',
                                name: 'wlmdb_sqltemp_1770775096801',
                                snapshot_count: 1,
                                svm: {
                                    name: 'wlmdb_sqlsvm_1770775096801',
                                    uuid: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                                    _links: {
                                        self: {
                                            href: '/api/svm/svms/6c800e9f-06f2-11f1-a170-7143fc0c8c33'
                                        }
                                    }
                                }
                            },
                            {
                                uuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                                name: 'wlmdb_sqllog_1770775096801',
                                snapshot_count: 1,
                                svm: {
                                    name: 'wlmdb_sqlsvm_1770775096801',
                                    uuid: '6c800e9f-06f2-11f1-a170-7143fc0c8c33',
                                    _links: {
                                        self: {
                                            href: '/api/svm/svms/6c800e9f-06f2-11f1-a170-7143fc0c8c33'
                                        }
                                    }
                                }
                            }
                        ]
                    }
                },
                instanceDetails: {
                    deploymentType: 'Standalone',
                    baseDeploymentType: null,
                    enterpriseFeatures: [],
                    isHadrEnabled: false,
                    isUsingEnterpriseFeatures: false,
                    isClustered: false,
                    availabilityReplicas: [],
                    instanceName: 'MSSQLSERVER',
                    windowsClusterName: null,
                    executableInstance: 'SQL-PROD-STD-01',
                    databaseInstanceId: 'demo-offline-std-instance-001',
                    windowsClusterNodes: [],
                    databaseEdition: 'Standard Edition (64-bit)',
                    sqlEngineEdition: 2,
                    databaseVersion:
                        'Microsoft SQL Server 2022 (RTM-CU21-GDR) (KB5068406) - 16.0.4222.2 (X64) \n\tOct  3 2025 16:55:17 \n\tCopyright (C) 2022 Microsoft Corporation\n\tStandard Edition (64-bit) on Windows Server 2022 Datacenter 10.0 <X64> (Build 20348: ) (Hypervisor)\n',
                    availabilityGroups: []
                },
                assessment: {
                    layout: {
                        'tempdb-files-location': 'separate-drive',
                        'user-database-layout': {
                            tempDb: [
                                {
                                    name: 'tempdev',
                                    driveLetter: 'T:',
                                    sizeInMb: 20462,
                                    accessPaths: ['T:\\', '\\\\?\\Volume{4c66fc95-4007-4c1b-b210-cf87a1e0772e}\\'],
                                    lunSerialNumber: 'lWB0t?Ze3zn3',
                                    diskNumber: 3,
                                    ontapVolumeUuid: 'b8fc4031-06f2-11f1-a170-7143fc0c8c33',
                                    ontapVolumeName: 'wlmdb_sqltemp_1770775096801',
                                    lunUuid: '1071ce88-0a92-42d3-bd95-20bed179e67c',
                                    lunPath: '/vol/wlmdb_sqltemp_1770775096801/tempdb',
                                    svmName: 'wlmdb_sqlsvm_1770775096801'
                                }
                            ],
                            data: [
                                {
                                    driveLetter: 'S:',
                                    accessPaths: ['S:\\', '\\\\?\\Volume{4ceb8878-0089-41ef-95b1-d4dd44316fff}\\'],
                                    diskNumber: 1,
                                    lunSerialNumber: 'lWB0t?Ze3zn1',
                                    ontapVolumeUuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                                    ontapVolumeName: 'wlmdb_sqldata_1770775096801',
                                    lunUuid: '5dade84d-d567-4077-89be-91c9ac0c3d41',
                                    lunPath: '/vol/wlmdb_sqldata_1770775096801/sqldata',
                                    svmName: 'wlmdb_sqlsvm_1770775096801',
                                    databaseDetails: [
                                        {
                                            sizeInMb: 102400,
                                            name: 'CustomerDB',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        },
                                        {
                                            sizeInMb: 81920,
                                            name: 'ProductDB',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        },
                                        {
                                            sizeInMb: 204782,
                                            name: 'msdb',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        }
                                    ]
                                }
                            ],
                            log: [
                                {
                                    driveLetter: 'L:',
                                    accessPaths: ['L:\\', '\\\\?\\Volume{4d95d0d8-3390-426f-bb4e-1c6ac269df2e}\\'],
                                    diskNumber: 2,
                                    lunSerialNumber: 'lWB0t?Ze3zn2',
                                    ontapVolumeUuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                                    ontapVolumeName: 'wlmdb_sqllog_1770775096801',
                                    lunUuid: '309c04cc-88c3-40f3-b3bc-36e2970f3980',
                                    lunPath: '/vol/wlmdb_sqllog_1770775096801/sqllog',
                                    svmName: 'wlmdb_sqlsvm_1770775096801',
                                    databaseDetails: [
                                        {
                                            sizeInMb: 25600,
                                            name: 'CustomerDB',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        },
                                        {
                                            sizeInMb: 20480,
                                            name: 'ProductDB',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        },
                                        {
                                            sizeInMb: 51182,
                                            name: 'msdb',
                                            collationName: 'SQL_Latin1_General_CP1_CI_AS'
                                        }
                                    ]
                                }
                            ]
                        },
                        'default-log-files-location': 'separate-drive',
                        'default-data-files-location': 'separate-drive'
                    },
                    maxDop: {
                        current: '4',
                        vcpuCount: 2
                    },
                    os: {
                        'ntfs-allocation-unit-size': 65536,
                        'mpio-load-balance-policy-details': [
                            {
                                disk: 'Disk 1',
                                policy: 'RRWS'
                            },
                            {
                                disk: 'Disk 2',
                                policy: 'RRWS'
                            },
                            {
                                disk: 'Disk 3',
                                policy: 'RRWS'
                            }
                        ],
                        'mpio-iscsi-count': '5',
                        'mpio-enabled': true,
                        'mpio-timeout': '60',
                        'ntfs-allocation-details': [
                            {
                                DriveLetter: 'S:',
                                BlockSize: 65536
                            },
                            {
                                DriveLetter: 'L:',
                                BlockSize: 65536
                            },
                            {
                                DriveLetter: 'T:',
                                BlockSize: 65536
                            }
                        ],
                        'mpio-load-balance-policy': 'RR'
                    },
                    errors: {},
                    luns: [
                        {
                            name: '/vol/wlmdb_sqldata_1770775096801/sqldata',
                            'os-type': 'windows_2008',
                            'space-reservation-enabled': true,
                            'space-allocation-allocated': true
                        },
                        {
                            name: '/vol/wlmdb_sqltemp_1770775096801/tempdb',
                            'os-type': 'windows_2008',
                            'space-reservation-enabled': true,
                            'space-allocation-allocated': true
                        },
                        {
                            name: '/vol/wlmdb_sqllog_1770775096801/sqllog',
                            'os-type': 'windows_2008',
                            'space-reservation-enabled': true,
                            'space-allocation-allocated': true
                        }
                    ],
                    filesystemId: 'fs-0f06b4d3901153300',
                    volumes: [
                        {
                            name: 'wlmdb_sqldata_1770775096801',
                            uuid: 'b2f08f14-06f2-11f1-a170-7143fc0c8c33',
                            'thin-provision': true,
                            'space-guarantee': 'none',
                            'autosize-mode': 'grow',
                            'fractional-reserve': 0,
                            'snapshot-copy-reserve': 0,
                            'snapshot-autodelete': true,
                            'snapshot-policy': 'daily_weekretention',
                            'tiering-policy': 'snapshot_only',
                            'tiering-min-cooling-days': 7,
                            autosize: 'on'
                        },
                        {
                            name: 'wlmdb_sqltemp_1770775096801',
                            uuid: 'b8fc4031-06f2-11f1-a170-7143fc0c8c33',
                            'thin-provision': true,
                            'space-guarantee': 'none',
                            'autosize-mode': 'grow',
                            'fractional-reserve': 0,
                            'snapshot-copy-reserve': 0,
                            'snapshot-autodelete': true,
                            'snapshot-policy': 'daily_weekretention',
                            'tiering-policy': 'snapshot_only',
                            'tiering-min-cooling-days': 7,
                            autosize: 'on'
                        },
                        {
                            name: 'wlmdb_sqllog_1770775096801',
                            uuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                            'thin-provision': true,
                            'space-guarantee': 'none',
                            'autosize-mode': 'grow',
                            'fractional-reserve': 0,
                            'snapshot-copy-reserve': 0,
                            'snapshot-autodelete': true,
                            'snapshot-policy': 'daily_weekretention',
                            'tiering-policy': 'snapshot_only',
                            'tiering-min-cooling-days': 7,
                            autosize: 'on'
                        }
                    ],
                    sizing: {
                        'data-tempdb-drive-details': [
                            {
                                tempdbDriveLetter: 'T:',
                                tempdbDrivePath: 'T:\\mssql\\data\\tempdb.mdf',
                                tempdbDriveTotalSizeMB: 20462,
                                dataDriveLetter: 'S:',
                                dataDriveTotalSizeMB: 389102,
                                ontapVolumeUuid: 'b8fc4031-06f2-11f1-a170-7143fc0c8c33',
                                ontapVolumeName: 'wlmdb_sqltemp_1770775096801',
                                lunUuid: '1071ce88-0a92-42d3-bd95-20bed179e67c',
                                lunPath: '/vol/wlmdb_sqltemp_1770775096801/tempdb',
                                diskSerialNumber: 'lWB0t?Ze3zn3',
                                diskNumber: 3,
                                svmName: 'wlmdb_sqlsvm_1770775096801'
                            }
                        ],
                        'data-log-drive-details': [
                            {
                                databaseName: 'CustomerDB',
                                dataDriveLetter: 'S:',
                                dataDriveTotalSizeMB: 102400,
                                logDriveLetter: 'L:',
                                logDrivePath: 'L:\\mssql\\log\\CustomerDBLog.ldf',
                                logDriveTotalSizeMB: 25600,
                                ontapVolumeUuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                                ontapVolumeName: 'wlmdb_sqllog_1770775096801',
                                lunUuid: '309c04cc-88c3-40f3-b3bc-36e2970f3980',
                                diskSerialNumber: 'lWB0t?Ze3zn2',
                                diskNumber: 2,
                                svmName: 'wlmdb_sqlsvm_1770775096801',
                                dataAccessPath: 'S:\\',
                                logAccessPath: 'L:\\'
                            },
                            {
                                databaseName: 'ProductDB',
                                dataDriveLetter: 'S:',
                                dataDriveTotalSizeMB: 81920,
                                logDriveLetter: 'L:',
                                logDrivePath: 'L:\\mssql\\log\\ProductDBLog.ldf',
                                logDriveTotalSizeMB: 20480,
                                ontapVolumeUuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                                ontapVolumeName: 'wlmdb_sqllog_1770775096801',
                                lunUuid: '309c04cc-88c3-40f3-b3bc-36e2970f3980',
                                diskSerialNumber: 'lWB0t?Ze3zn2',
                                diskNumber: 2,
                                svmName: 'wlmdb_sqlsvm_1770775096801',
                                dataAccessPath: 'S:\\',
                                logAccessPath: 'L:\\'
                            },
                            {
                                databaseName: 'msdb',
                                dataDriveLetter: 'S:',
                                dataDriveTotalSizeMB: 204782,
                                logDriveLetter: 'L:',
                                logDrivePath: 'L:\\mssql\\log\\MSDBLog.ldf',
                                logDriveTotalSizeMB: 51182,
                                ontapVolumeUuid: 'bf0d4032-06f2-11f1-a170-7143fc0c8c33',
                                ontapVolumeName: 'wlmdb_sqllog_1770775096801',
                                lunUuid: '309c04cc-88c3-40f3-b3bc-36e2970f3980',
                                diskSerialNumber: 'lWB0t?Ze3zn2',
                                diskNumber: 2,
                                svmName: 'wlmdb_sqlsvm_1770775096801',
                                dataAccessPath: 'S:\\',
                                logAccessPath: 'L:\\'
                            }
                        ],
                        'performance-tier': [
                            {
                                volumeName: 'wlmdb_sqldata_1770775096801',
                                performanceTierPercent: 100
                            },
                            {
                                volumeName: 'wlmdb_sqllog_1770775096801',
                                performanceTierPercent: 100
                            },
                            {
                                volumeName: 'wlmdb_sqltemp_1770775096801',
                                performanceTierPercent: 100
                            }
                        ]
                    }
                }
            }
        }
    }
} as const;
