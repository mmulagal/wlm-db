import { DiscoverMsSqlResponseBodyType } from '../../routes/types/discover.types';

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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        isDefaultInstance: true,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4095.4',
                        databaseCount: 8,
                        windowsAuthentication: true,
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    }
                ]
            },
            // no windows auth
            {
                ec2InstanceId: 'i-p9o5n2m4l8k6j7h',
                ec2InstanceType: 'm5.2xlarge',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-6',
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
                        sqlServerName: 'SQLServer-PreProd-01',
                        sqlServerVersion: '16.0.4105.2',
                        databaseCount: 8,
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        windowsAuthentication: false,
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
                                zones: ['availability-zone-3']
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
                        windowsAuthentication: false,
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
                                zones: ['availability-zone-3']
                            }
                        ]
                    }
                ]
            },
            // un managed hosts
            {
                ec2InstanceId: 'i-2a4b7c5d3e1f6g',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0102',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-7',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5d',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-Prod-02',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    },
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'Prod-HelpDesk',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5p',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-Prod-02',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: 'i-x3y7z1a9b5c2d4e',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0102',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-8',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5e',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-Dev-02',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    },
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerEngineEdition: 3,
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'Dev-VendorManagement',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5z',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-Dev-02',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: 'i-q5w3e7r9t1y2u4i',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0102',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-9',
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
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5f',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-QA-01',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: 'i-041d3a8192609da40',
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-10',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5g',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-QA-02',
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    }
                ]
            },
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
                        windowsOsVersion: 'Microsoft Windows Server 2022',
                        sqlServerAuthentication: false,
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
                                zones: ['availability-zone-2', 'availability-zone-3']
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
                        ]
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
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
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
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
                                zones: ['availability-zone-3']
                            }
                        ]
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
                                zones: ['availability-zone-3']
                            }
                        ]
                    }
                ]
            }
        ]
    };
}

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
                policy: 'Other'
            },
            {
                disk: 'Disk 1',
                policy: 'Other'
            },
            {
                disk: 'Disk 8',
                policy: 'Other'
            },
            {
                disk: 'Disk 2',
                policy: 'Other'
            },
            {
                disk: 'Disk 3',
                policy: 'Other'
            },
            {
                disk: 'Disk 5',
                policy: 'Other'
            },
            {
                disk: 'Disk 6',
                policy: 'Other'
            },
            {
                disk: 'Disk 7',
                policy: 'Other'
            }
        ]
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
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17
        },
        {
            name: 'wlmdb_sqltemp_1728552629461',
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17
        },
        {
            name: 'wlmdb_sqldata_1728574994',
            autosize: 'off',
            'autosize-mode': 'off',
            'thin-provision': true,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 10,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17
        }
    ],
    filesystemId: 'fs-07a22f282fd4f5a20'
};

export { inventoryDemoData, ASSESMENT_CONFIG_DATA };
