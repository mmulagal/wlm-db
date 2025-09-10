import { DiscoverMsSqlResponseBodyType } from '../../routes/types/discover.types';

const MANAGE_READINESS = {
    missingSqlCmd: false,
    assessment: {
        missingSqlPermissions: [],
        missingModules: []
    },
    remediation: {
        missingSqlPermissions: [],
        missingModules: []
    },
    dbcreation: {
        missingSqlPermissions: [],
        missingModules: []
    },
    sandbox: {
        missingSqlPermissions: [],
        missingModules: []
    }
    // logsanalyzer: {
    //     missingSqlPermissions: [],
    //     missingModules: []
    // }
};
function inventoryDemoData(fsxId: string, ebsVolId: string): DiscoverMsSqlResponseBodyType {
    return {
        count: 11,
        items: [
            // no windows auth
            {
                ec2InstanceId: 'i-7h2b6f4e8d1g5i3j',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-5',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'PreProd-BusinessIntelligence',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6j',
                        sqlServerState: 'Running',
                        isDefaultInstance: false,
                        sqlServerVersion: '16.0.1000.6',
                        databaseCount: 8,
                        sqlServerName: 'SQLServer-PreProd-02',
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
                        sqlServerDeploymentType: 'FCI',
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS,
                        windowsClusterNodes: [
                            {
                                Node: 'EC2AMAZ-1MF7SUF',
                                Address: '10.0.6.118'
                            },
                            {
                                Node: 'EC2AMAZ-1MF7SUD',
                                Address: '10.0.28.145'
                            }
                        ]
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9679',
                        isDefaultInstance: true,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4095.4',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        sqlServerDeploymentType: 'FCI',
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS,
                        windowsClusterNodes: [
                            {
                                Node: 'EC2AMAZ-1MF7SUF',
                                Address: '10.0.6.118'
                            },
                            {
                                Node: 'EC2AMAZ-1MF7SUD',
                                Address: '10.0.28.145'
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: 'i-p9o5n2m4l8k6byol',
                ec2InstanceType: 'm5.2xlarge',
                ec2UsageOperation: 'RunInstances:0002',
                ssmState: 'connected',
                ec2InstanceName: 'app-byol-server-6',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5c',
                        sqlServerState: 'Running',
                        isDefaultInstance: false,
                        sqlServerName: 'SQLServer-BYOL-01',
                        sqlServerVersion: '16.0.4105.2',
                        databaseCount: 8,
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
                        sqlServerDeploymentType: 'AOAG',
                        storage: [
                            {
                                type: 'EBS',
                                id: ebsVolId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'SINGLE_AZ_1',
                                zones: ['availability-zone-1']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    }
                ]
            },
            // un managed hosts

            {
                ec2InstanceId: 'i-0ab2e12971d543c14',
                ec2InstanceType: 'm5.xlarge',
                ec2InstanceName: 'app-server-19',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                sqlServerInstances: [
                    {
                        sqlServerVersion: '16.0.4015.1',
                        sqlServerName: 'SQLServer-UAT-03',
                        sqlServerNodes: ['sql-node1', 'sql-node2'],
                        nodeIps: ['10.0.2.224', '10.0.18.80'],
                        sqlServerDeploymentType: 'FCI',
                        sqlServerInstance: 'MSSQLSERVER',
                        sqlServerState: 'Running',
                        sqlServerProductYear: 2022,
                        sqlServerEngineEdition: 3,
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5h',
                        isDefaultInstance: true,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2022',
                        storage: [
                            {
                                type: 'FSXW',
                                id: 'fs-0948f9c267a5b9300',
                                protocol: 'SMB',
                                fileSystemStorageType: 'SSD'
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-2', 'availability-zone-1']
                            }
                        ],
                        databaseCount: 4,
                        windowsClusterName: 'fsxwcluster03',
                        windowsClusterNodes: [
                            {
                                Node: 'sql-node1',
                                Address: '10.0.2.224'
                            },
                            {
                                Node: 'sql-node2',
                                Address: '10.0.18.80'
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    }
                ],
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                }
            },
            {
                ec2InstanceId: 'i-9m8n7b6v5c4x3z',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0102',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-12',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5o',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-UAT-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'UAT-QualityControl',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5i',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-UAT-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    }
                ]
            },
            {
                ec2InstanceId: 'i-4s6d8f2g1h0j3k5',
                ec2InstanceType: 'm5.2xlarge',
                ec2UsageOperation: 'RunInstances:0102',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-14',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5k',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLserver-PLM',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUZ'],
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        sqlServerDeploymentType: 'AOAG',
                        storage: [
                            {
                                type: 'EBS',
                                id: ebsVolId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    }
                ]
            },
            {
                ec2InstanceId: 'i-c5x3z1a7s9d2f3g',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-18',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9c4l',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLserver-Finance-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
                        storage: [
                            {
                                type: 'EBS',
                                id: ebsVolId
                            },
                            {
                                type: 'EBS',
                                id: 'vol-0a1b2c3d4e5f6i7h'
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'SINGLE_AZ_1',
                                zones: ['availability-zone-1']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'PROD-DB',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9c6l',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        sqlServerAuthentication: true,
                        windowsDomainUserAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',

                        sqlServerName: 'SQLserver-Finance-03',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
                        storage: [
                            {
                                type: 'EBS',
                                id: ebsVolId
                            },
                            {
                                type: 'EBS',
                                id: 'vol-0a1b2c3d4e5f6i7h'
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'SINGLE_AZ_1',
                                zones: ['availability-zone-1']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    }
                ]
            }
        ]
    };
}

const MAPPED_ONTAP_VOLUMES_DATA = {
    SQL1: {
        lunRecords: [
            {
                name: '/vol/wlmdb_sqllog_1737955806953/sqllog',
                uuid: '5b2c2bfb-2bbf-4acd-be19-f690944c1451',
                serial_number: 'SERIAL1'
            },
            {
                name: '/vol/wlmdb_sqldata_1737955806953/sqldata',
                uuid: '81e84adc-cdb8-4cf1-8a85-a5559d18f2c7',
                serial_number: 'SERIAL2'
            }
        ],
        volumeDBMap: [
            {
                databaseName: 'dsfs',
                ontapVolumeuuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'dsfs',
                ontapVolumeuuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'kljghfgf',
                ontapVolumeuuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'kljghfgf',
                ontapVolumeuuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df'
            }
        ],
        volumeRecords: [
            {
                svm: {
                    uuid: '2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df',
                    _links: {
                        self: {
                            href: '/api/svm/svms/2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df'
                        }
                    }
                },
                name: 'wlmdb_sqllog_1737955806953',
                uuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df',
                fsxVolumeId: 'fsvol-043070d5487',
                snapshot_count: 9
            },
            {
                svm: {
                    uuid: '2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df',
                    _links: {
                        self: {
                            href: '/api/svm/svms/2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df'
                        }
                    }
                },
                name: 'wlmdb_sqldata_1737955806953',
                uuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df',
                fsxVolumeId: 'fsvol-0e5d5b33d988',
                snapshot_count: 15
            }
        ]
    }
};

const PDB_DETAILS = {
    name: 'pdb1',
    size: 2500000000,
    status: 'online',
    type: 'PDB',
    created: `${new Date(Date.now()).toISOString().split('.')[0]}Z`,
    service: 'ip-172-31-48-50.ap-southeast-1.compute.internal:1521'
};

const ORACLE_MAPPED_ONTAP_VOLUMES_DATA = {
    'fs-0d5efc3057c4f12cb': {
        protocol: '',
        lunRecords: [],
        isASMManaged: false,
        volumeMappings: [
            {
                ordbsdl: {
                    isCDB: false,
                    ontapVolumes: {
                        REDO_LOGS: [
                            {
                                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                                svmName: 'wlmdb_sqlsvm_1735809893269',
                                volumeId: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                                volumeName: 'oracleredo2',
                                lunName: '/vol/wlmdb_oracleredo_1735809893269/lun1',
                                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7a'
                            }
                        ],
                        DATA_FILES: [
                            {
                                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                                svmName: 'wlmdb_sqlsvm_1735809893269',
                                volumeId: 'db1ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                                volumeName: 'oracledata2',
                                lunName: '/vol/wlmdb_oracledata_1735809893269/lun2',
                                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7b'
                            }
                        ],
                        TEMP_FILES: [
                            {
                                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                                svmName: 'wlmdb_sqlsvm_1735809893269',
                                volumeId: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                                volumeName: 'oracleredo2',
                                lunName: '/vol/wlmdb_oracletemp_1735809893269/lun3',
                                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7c'
                            }
                        ],
                        ARCHIVE_LOGS: [
                            {
                                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                                svmName: 'wlmdb_sqlsvm_1735809893269',
                                volumeId: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                                volumeName: 'oraclearch2',
                                lunName: '/vol/wlmdb_oraclearch_1735809893269/lun4',
                                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7d'
                            }
                        ],
                        CONTROL_FILES: [
                            {
                                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                                svmName: 'wlmdb_sqlsvm_1735809893269',
                                volumeId: 'db1ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                                volumeName: 'oracledata2',
                                lunName: '/vol/wlmdb_oraclectrl_1735809893269/lun5',
                                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7e'
                            }
                        ]
                    }
                }
            }
        ]
    }
};

const ASSESMENT_CONFIG_DATA = {
    os: {
        'mpio-enabled': false,
        'mpio-iscsi-count': '50',
        'ntfs-allocation-details': [
            { DriveLetter: 'S', BlockSize: 6553 },
            { DriveLetter: 'T', BlockSize: 6553 },
            { DriveLetter: 'L', BlockSize: 6553 }
        ],
        'ntfs-allocation-unit-size': 6553,
        'mpio-load-balance-policy': 'Other',
        'mpio-load-balance-policy-details': [
            {
                disk: 'Disk 4',
                accessPath: 'L:\\',
                policy: 'LB'
            },
            {
                disk: 'Disk 1',
                accessPath: 'S:\\',
                policy: 'LB'
            },
            {
                disk: 'Disk 8',
                accessPath: 'T:\\',
                policy: 'LB'
            }
        ],
        'mpio-timeout': 40
    },
    luns: [
        {
            name: '/vol/wlmdb_sqldata_1728552629461/sqldata',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
        },
        {
            name: '/vol/wlmdb_sqltemp_1728552629461/tempdb',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
        },
        {
            name: '/vol/wlmdb_sqldata_1728574994/sqldata',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
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
                performanceTierPercent: 95
            },
            {
                volumeName: 'wlmdb_sqllog_1740027207',
                performanceTierPercent: 94
            },
            {
                volumeName: 'wlmdb_sqltemp_1740015122754',
                performanceTierPercent: 100
            }
        ],
        'data-log-drive-details': [
            {
                databaseName: 'msdb',
                logDrivePath: 'S:\\mssql\\system\\MSSQL15.MSSQLSERVER\\MSSQL\\DATA\\MSDBLog.ldf',
                dataDrivePath: 'S:\\mssql\\system\\MSSQL15.MSSQLSERVER\\MSSQL\\DATA\\MSDBData.mdf',
                logAccessPath: 'S:\\mssql',
                dataAccessPath: 'S:\\mssql',
                logDriveLetter: 'S:',
                dataDriveLetter: 'S:',
                logDriveTotalSizeMB: 307,
                dataDriveTotalSizeMB: 3071820
            },
            {
                lunUuid: 'ce0cca99-e9fd-42af-9daa-50039625d44d',
                svmName: 'wlmdb_sqlsvm_1731915150431',
                diskNumber: 8,
                databaseName: 'Nachos',
                logDrivePath: 'G:\\MSSQL\\log\\Nachos_log.ldf',
                dataDrivePath: 'F:\\MSSQL\\data\\Nachos_data.mdf',
                logAccessPath: 'G:\\MSSQL',
                dataAccessPath: 'F:\\MSSQL',
                logDriveLetter: 'G:',
                dataDriveLetter: 'F:',
                ontapVolumeName: 'wlmdb_sqllog_1731988070',
                ontapVolumeUuid: '1c3c25e9-a629-11ef-8dba-75539f3dc73f',
                diskSerialNumber: 'lWB4c$XRevTA',
                logDriveTotalSizeMB: 97,
                dataDriveTotalSizeMB: 429420
            },
            {
                lunUuid: '74897647-0db1-4e4c-934a-8faa6cae7087',
                svmName: 'wlmdb_sqlsvm_1731915150431',
                diskNumber: 6,
                databaseName: 'Primordial',
                logDrivePath: 'E:\\MSSQL\\log\\Primordial_log.ldf',
                dataDrivePath: 'D:\\MSSQL\\data\\Primordial_data.mdf',
                logAccessPath: 'E:\\MSSQL',
                dataAccessPath: 'D:\\MSSQL',
                logDriveLetter: 'E:',
                dataDriveLetter: 'D:',
                ontapVolumeName: 'wlmdb_sqllog_1731987160',
                ontapVolumeUuid: 'f3c8df60-a626-11ef-8dba-75539f3dc73f',
                diskSerialNumber: 'lWB4c$XRevT9',
                logDriveTotalSizeMB: 107,
                dataDriveTotalSizeMB: 1072200
            }
        ],
        'data-tempdb-drive-details': {
            lunUuid: 'ab3fd3b5-b2e2-4c97-b026-52ba19accc41',
            svmName: 'wlmdb_sqlsvm_1731915150431',
            diskNumber: 6,
            ontapVolumeName: 'wlmdb_sqltemp_1731915150431',
            ontapVolumeUuid: 'c4585626-a581-11ef-8dba-75539f3dc73f',
            tempdbDrivePath: 'T:\\mssql\\data\\tempdb.mdf',
            diskSerialNumber: 'lWB4c$XRevT9',
            tempdbDriveLetter: 'T:',
            dataDriveTotalSizeMB: 9731000,
            defaultDataDriveLetter: 'S:',
            tempdbDriveTotalSizeMB: 42
        }
    },
    volumes: [
        {
            name: 'wlmdb_sqldata_1728552629461',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        },
        {
            name: 'wlmdb_sqltemp_1728552629461',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        },
        {
            name: 'wlmdb_sqldata_1728574994',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'none',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        }
    ],
    filesystemId: 'fs-07a22f282fd4f5a20',
    ec2InstanceId: 'i-0abcd1234efgh5678',
    databaseInstanceName: 'MSSQLSERVER'
};

const ASSESSMENT_CRR_CONFIG_DATA = {
    errors: '',
    crrDetails: [
        {
            volumeName: 'wlmdb_sqldata_1728552629461',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqldata_1728552629461_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqldata_1728552629461_dp'
        },
        {
            volumeName: 'wlmdb_sqltemp_1728552629461',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqltemp_1728552629461_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqltemp_1728552629461_dp'
        },
        {
            volumeName: 'wlmdb_sqldata_1728574994',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqldata_1728574994_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqldata_1728574994_dp'
        }
    ]
};

const ASSESSMENT_AWS_BACKUP_DATA = {
    filesystemId: 'fs-07a22f282fd4f5a20',
    isAWSBackupEnabled: true
};

const ASSESSMENT_MAXDOP_CONFIG_DATA = { status: 'not-optimized', current: '2', recommendedMaxDOP: '4' };

const ASSESSMENT_CLONE_CONFIG_DATA = {
    cloneDetails: [
        {
            cloneDatabaseName: 'sandbox_1743487277979',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'apr1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4bc548cb-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:22+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4d307ed8-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:24+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_ap90',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_test234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7dc7d028-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:46+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7f32d8e6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:48+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'apr11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'apr11'
                }
            ]
        },
        {
            cloneDatabaseName: 'test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_ap90002',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743486831',
                    cloneVolumeUuid: 'b519f67b-0ebd-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T05:53:59+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'master',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'master'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'master'
                }
            ]
        },
        {
            cloneDatabaseName: 'model',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'model'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'model'
                }
            ]
        },
        {
            cloneDatabaseName: 'msdb',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'msdb'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'msdb'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567890',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes0',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes0'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes0'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes1'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes11'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes11'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes12',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes12'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes12'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes13',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes13'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes13'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes14',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes14'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes14'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes15',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes15'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes15'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes16',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes16'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes16'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes17',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes17'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes17'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes18',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes18'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes18'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes19',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes19'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes19'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes2',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes2'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes2'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes20',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes20'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes20'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes3',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes3'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes3'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes4',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes4'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes4'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes5',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes5'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes5'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes6',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes6'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes6'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes7',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes7'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes7'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes8',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes8'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes8'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes9',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes9'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes9'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487633',
                    cloneVolumeUuid: '933ce6d6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:22+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487633',
                    cloneVolumeUuid: '954842b3-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567tyu',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'abdada62-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:03+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'addfcb67-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:06+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567xcvbn',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'da7d2a9a-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:21+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'dc855cd7-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                }
            ]
        }
    ],
    status: 'not-optimized',
    oldClones: 34,
    oldCloneDetails: [
        {
            cloneDatabaseName: 'sandbox_1743487277979',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'apr1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4bc548cb-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:22+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4d307ed8-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:24+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_ap90',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_test234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7dc7d028-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:46+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7f32d8e6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:48+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'apr11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'apr11'
                }
            ]
        },
        {
            cloneDatabaseName: 'test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_ap90002',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743486831',
                    cloneVolumeUuid: 'b519f67b-0ebd-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T05:53:59+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'master',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'master'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'master'
                }
            ]
        },
        {
            cloneDatabaseName: 'model',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'model'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'model'
                }
            ]
        },
        {
            cloneDatabaseName: 'msdb',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'msdb'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'msdb'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567890',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes0',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes0'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes0'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes1'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes11'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes11'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes12',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes12'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes12'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes13',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes13'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes13'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes14',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes14'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes14'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes15',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes15'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes15'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes16',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes16'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes16'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes17',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes17'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes17'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes18',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes18'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes18'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes19',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes19'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes19'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes2',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes2'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes2'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes20',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes20'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes20'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes3',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes3'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes3'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes4',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes4'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes4'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes5',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes5'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes5'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes6',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes6'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes6'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes7',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes7'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes7'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes8',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes8'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes8'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes9',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes9'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes9'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487633',
                    cloneVolumeUuid: '933ce6d6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:22+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487633',
                    cloneVolumeUuid: '954842b3-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567tyu',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'abdada62-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:03+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'addfcb67-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:06+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567xcvbn',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'da7d2a9a-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:21+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'dc855cd7-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                }
            ]
        }
    ],
    oldCloneDatabaseNames: [
        'sandbox_1743487277979',
        'sandbox_ap90',
        'sandbox_test234',
        'apr11',
        'test1',
        'sandbox_ap90002',
        'sandbox_test1',
        'master',
        'model',
        'msdb',
        'sandbox_apr567890',
        'tes0',
        'tes1',
        'tes11',
        'tes12',
        'tes13',
        'tes14',
        'tes15',
        'tes16',
        'tes17',
        'tes18',
        'tes19',
        'tes2',
        'tes20',
        'tes3',
        'tes4',
        'tes5',
        'tes6',
        'tes7',
        'tes8',
        'tes9',
        'sandbox_apr567234',
        'sandbox_apr567tyu',
        'sandbox_apr567xcvbn'
    ]
};

const MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA = { status: 'optimized', current: '4', recommendedMaxDOP: '4' };

const MSSQL_ASSESSMENT_CLONE_CONFIG_DATA = {
    status: 'optimized',
    oldClones: 0,
    cloneDetails: [],
    oldCloneDetails: [],
    oldCloneDatabaseNames: []
};

const MSSQL_ASSESMENT_CONFIG_DATA = {
    os: {
        'mpio-enabled': true,
        'mpio-timeout': '60',
        'mpio-iscsi-count': '5',
        'ntfs-allocation-details': [
            {
                BlockSize: 65536,
                DriveLetter: 'S:'
            },
            {
                BlockSize: 65536,
                DriveLetter: 'T:'
            }
        ],
        'mpio-load-balance-policy': 'RR',
        'ntfs-allocation-unit-size': 65536,
        'mpio-load-balance-policy-details': [
            {
                disk: 'Disk 3',
                policy: 'RRWS',
                accessPath: 'T:\\'
            },
            {
                disk: 'Disk 1',
                policy: 'RRWS',
                accessPath: 'S:\\'
            }
        ]
    },
    luns: [
        {
            name: '/vol/wlmdb_sqldata_1750140716368/sqldata',
            'os-type': 'windows_2008',
            'space-reservation-enabled': true,
            'space-allocation-allocated': true
        },
        {
            name: '/vol/wlmdb_sqltemp_1750140716368/tempdb',
            'os-type': 'windows_2008',
            'space-reservation-enabled': true,
            'space-allocation-allocated': true
        }
    ],
    errors: {},
    layout: {
        'user-database-layout': {
            log: [
                {
                    name: 'msdb',
                    lunPath: '/vol/wlmdb_sqldata_1750140716368/sqldata',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 23.8125,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e32}\\'],
                    databaseDetails: [
                        {
                            name: 'msdb',
                            sizeInMb: 23.8125
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620'
                }
            ],
            data: [
                {
                    name: 'msdb',
                    lunPath: '/vol/wlmdb_sqldata_1750140716368/sqldata',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 16.875,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e32}\\'],
                    databaseDetails: [
                        {
                            name: 'msdb',
                            sizeInMb: 16.875
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620'
                }
            ],
            tempDb: [
                {
                    name: 'tempdev',
                    lunPath: '/vol/wlmdb_sqltemp_1750140716368/tempdb',
                    lunUuid: 'c8bcdf6e-060c-4cb9-b07e-d8036108379f',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 8,
                    diskNumber: 3,
                    accessPaths: ['T:\\', '\\\\?\\Volume{f3a06d64-ba64-40e9-af09-123ca22ac071}\\'],
                    lunSerialNumber: 'lWB5g?XW76mb',
                    ontapVolumeName: 'wlmdb_sqltemp_1750140716368',
                    ontapVolumeUuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620'
                }
            ]
        },
        'tempdb-files-location': 'separate-drive',
        'default-log-files-location': 'shared-drive',
        'default-data-files-location': 'shared-drive'
    },
    sizing: {
        'performance-tier': [
            {
                volumeName: 'wlmdb_sqldata_1750140716368',
                performanceTierPercent: 100
            },
            {
                volumeName: 'wlmdb_sqltemp_1750140716368',
                performanceTierPercent: 100
            }
        ],
        'data-log-drive-details': [
            {
                lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                svmName: 'wlmdb_sqlsvm_1750140716368',
                diskNumber: 1,
                databaseName: 'msdb',
                logAccessPath: 'S:\\',
                dataAccessPath: 'S:\\',
                logDriveLetter: 'S:',
                dataDriveLetter: 'S:',
                ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620',
                diskSerialNumber: 'lWB5g?XW76m/',
                logDriveTotalSizeMB: 204782,
                dataDriveTotalSizeMB: 204782
            }
        ],
        'data-tempdb-drive-details': {
            lunUuid: 'c8bcdf6e-060c-4cb9-b07e-d8036108379f',
            svmName: 'wlmdb_sqlsvm_1750140716368',
            diskNumber: 3,
            dataDriveLetter: 'S:',
            ontapVolumeName: 'wlmdb_sqltemp_1750140716368',
            ontapVolumeUuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620',
            tempdbDrivePath: 'T:\\mssql\\data\\tempdb.mdf',
            diskSerialNumber: 'lWB5g?XW76mb',
            tempdbDriveLetter: 'T:',
            dataDriveTotalSizeMB: 204782,
            tempdbDriveTotalSizeMB: 20462
        }
    },
    volumes: [
        {
            name: 'wlmdb_sqldata_1750140716368',
            uuid: 'af03a358-4b44-11f0-a105-fda4bda8e620',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'snapshot_only',
            'snapshot-policy': 'daily_weekretention',
            'space-guarantee': 'none',
            'fractional-reserve': 0,
            'snapshot-autodelete': true,
            'snapshot-copy-reserve': 0,
            'tiering-min-cooling-days': 7
        },
        {
            name: 'wlmdb_sqltemp_1750140716368',
            uuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'snapshot_only',
            'snapshot-policy': 'daily_weekretention',
            'space-guarantee': 'none',
            'fractional-reserve': 0,
            'snapshot-autodelete': true,
            'snapshot-copy-reserve': 0,
            'tiering-min-cooling-days': 7
        }
    ],
    filesystemId: 'fs-07a22f282fd4f5a20'
};

const ORACLE_STORAGE_ASSESSMENT_DATA = {
    volumes: {
        data: [
            {
                name: 'oracleredo2',
                uuid: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'none',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            },
            {
                name: 'oraclearch2',
                uuid: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'none',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            },
            {
                name: 'oracledata2',
                uuid: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'all',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            }
        ],
        error: '',
        filesystemId: 'fs-0d5efc3057c4f12cb'
    },
    binaryVolumes: {
        data: [
            {
                volumeId: '6264d520-3fb9-423f-8ab8-7a0a8e3d3562',
                volumeName: 'root'
            }
        ],
        error: ''
    }
};

const MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA = {
    driveLetter: {
        status: 'optimized',
        details: {
            missingDriveLetters: [],
            primaryNodeDriveLetters: ['S:', 'S:', 'T:']
        }
    },
    sharedStorage: {
        status: 'optimized',
        lunDetails: [
            {
                status: 'optimized',
                lunUuid: '96bd5d5e-877e-4846-b37c-4d2782dc02d8',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            },
            {
                status: 'optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831a',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            }
        ]
    },
    sqlServerServices: {
        status: 'optimized',
        details: [
            {
                Name: 'MSSQLSERVER',
                Status: 'Running',
                StartType: 'Manual',
                DisplayName: 'SQL Server (MSSQLSERVER)'
            }
        ]
    }
};

const ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA = {
    sharedStorage: {
        status: 'not-optimized',
        lunDetails: [
            {
                status: 'optimized',
                lunUuid: '96bd5d5e-877e-4846-b37c-4d2782dc02d8',
                lunName: '/vol/wlmdb_sqldata_1753227905582/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831a',
                lunName: '/vol/wlmdb_sqldata_1753227905523/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831b',
                lunName: '/vol/wlmdb_sqldata_1753227905523/sqllog',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831c',
                lunName: '/vol/wlmdb_sqldata_1753227905567/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            }
        ],
        allHostIqns: [
            'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
            'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
        ]
    },
    driveLetter: {
        status: 'optimized',
        details: { missingDriveLetters: [], primaryNodeDriveLetters: ['S:', 'S:', 'T:'] }
    },
    sqlServerServices: {
        status: 'not-optimized',
        details: [
            { Name: 'MSSQLSERVER', Status: 'Running', StartType: 'Automatic', DisplayName: 'SQL Server (MSSQLSERVER)' }
        ]
    }
};

export {
    inventoryDemoData,
    ASSESMENT_CONFIG_DATA,
    ASSESSMENT_CRR_CONFIG_DATA,
    ASSESSMENT_AWS_BACKUP_DATA,
    ASSESSMENT_MAXDOP_CONFIG_DATA,
    ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA,
    MSSQL_ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESMENT_CONFIG_DATA,
    MAPPED_ONTAP_VOLUMES_DATA,
    MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA,
    ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA,
    ORACLE_STORAGE_ASSESSMENT_DATA,
    ORACLE_MAPPED_ONTAP_VOLUMES_DATA,
    PDB_DETAILS
};
