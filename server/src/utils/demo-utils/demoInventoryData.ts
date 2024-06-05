import randomize from 'randomatic';
import { DiscoverMsSqlResponseBodyType } from '../../routes/types/discover.types';

function inventoryDemoData(fsxId: string, ebsVolId: string): DiscoverMsSqlResponseBodyType {
    return {
        count: 16,
        items: [
            // ssm not connected
            {
                ec2InstanceId: 'i-1d9i5v18g5392mf1v',
                ec2InstanceType: 'm5.large',
                ssmState: 'notconnected',
                ec2InstanceName: 'app-server-1',
                vpc: {
                    id: 'vpc-046f7e26255458373',
                    name: 'wlmdb-vpc',
                    cidrBlock: '10.0.0.0/16'
                }
            },
            // ssm not connected
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ec2InstanceType: 'm5.large',
                ssmState: 'notconnected',
                ec2InstanceName: 'app-server-2',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                }
            },
            // sql server stopped
            {
                ec2InstanceId: 'i-57efw8txsh9rxvxe9',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-3',
                vpc: {
                    id: 'vpc-046f7e26255458373',
                    name: 'wlmdb-vpc',
                    cidrBlock: '10.0.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        isDefaultInstance: true,
                        sqlServerState: 'Stopped',
                        sqlServerVersion: '15.0.4298.1',
                        windowsAuthentication: false,
                        storage: [],
                        deploymentTypes: []
                    }
                ]
            },
            // sql server stopped
            {
                ec2InstanceId: 'i-8ct4l5ecneb7jn2oz',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-4',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
                        isDefaultInstance: true,
                        sqlServerState: 'Stopped',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: false,
                        storage: [],
                        deploymentTypes: []
                    }
                ]
            },
            // no windows auth
            {
                ec2InstanceId: 'i-7h2b6f4e8d1g5i3j',
                ec2InstanceType: 'm5.large',
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
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'INST_D',
                        sqlServerState: 'Running',
                        isDefaultInstance: false,
                        sqlServerVersion: '16.0.1000.6',
                        sqlServerName: 'SQLServer-PreProd-02',
                        windowsAuthentication: false,
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
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
                        isDefaultInstance: true,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4095.4',
                        windowsAuthentication: true,
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        sqlServerDeploymentType: 'AOAG',
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
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-6',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'MSSQLSERVER_NOSTORAGE',
                        sqlServerState: 'Running',
                        isDefaultInstance: false,
                        sqlServerName: 'SQLServer-PreProd-01',
                        sqlServerVersion: '16.0.4105.2',
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
                        windowsAuthentication: false,
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
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER_1',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
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
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER_2',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
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
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'MSSQLSERVER_3',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-QA-01',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
                        sqlServerDeploymentType: 'AOAG',
                        nodeIps: ['10.0.6.118', '10.0.28.145'],
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
                ec2InstanceId: 'i-041d3a8192609da40',
                ec2InstanceType: 'm5.large',
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
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER_4',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
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
                ec2InstanceId: 'i-l2k4j6h8g0f3d5s',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-11',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER_5',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-UAT-01',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
                        storage: [
                            {
                                type: 'FSXW',
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
                ec2InstanceId: 'i-9m8n7b6v5c4x3z',
                ec2InstanceType: 'm5.large',
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
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER_6',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
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
                ec2InstanceId: 'i-r6t8y1u2i3o5p7a',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-13',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER_7',
                        sqlServerState: 'Running',
                        isDefaultInstance: false,
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Training-01',
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
                ec2InstanceType: 'm5.large',
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
                        sqlServerProductYear: 2017,
                        sqlServerInstance: 'MSSQLSERVER_8',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Training-02',
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
                ec2InstanceId: 'i-c5x3z1a7s9d2f4g',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-15',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerProductYear: 2019,
                        sqlServerInstance: 'MSSQLSERVER_9',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-CRMDB',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        sqlServerDeploymentType: 'Standalone',
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
                ec2InstanceId: 'i-e7r9t1y2u4i6o8p',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-16',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER_10',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-CRMDB-Test',
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
                ec2InstanceId: 'i-3q5w7e9r1t2y4u6i',
                ec2InstanceType: 'm5.large',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-16',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER_10',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: false,
                        sqlServerName: 'SQLServer-Prod-2',
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
            }
        ]
    };
}

export { inventoryDemoData };
