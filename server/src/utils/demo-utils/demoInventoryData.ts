import randomize from 'randomatic';

function inventoryDemoData(fsxId: string) {
    return {
        count: 16,
        items: [
            // ssm not connected
            {
                ec2InstanceId: 'i-1d9i5v18g5392mf1v',
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
                ssmState: 'connected',
                ec2InstanceName: 'app-server-3',
                vpc: {
                    id: 'vpc-046f7e26255458373',
                    name: 'wlmdb-vpc',
                    cidrBlock: '10.0.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2019,
                        sqlServerInstance: 'MSSQLSERVER',
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
                ssmState: 'connected',
                ec2InstanceName: 'app-server-4',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
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
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-5',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'INST_D',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.1000.6',
                        windowsAuthentication: false,
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    },
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4095.4',
                        windowsAuthentication: true,
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            // no windows auth
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-6',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_NOSTORAGE',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4105.2',
                        windowsAuthentication: false,
                        deploymentTypes: [
                            {
                                type: 'SINGLE_AZ_1',
                                zones: ['ap-southeast-1c']
                            }
                        ]
                    }
                ]
            },
            // un managed hosts
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-7',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_1',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Prod-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-8',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_2',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Dev-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-9',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_3',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-QA-01',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: 'i-041d3a8192609da40',
                ssmState: 'connected',
                ec2InstanceName: 'app-server-10',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_4',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-QA-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-11',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_5',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-UAT-01',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-12',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_6',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-UAT-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-13',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_7',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Training-01',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-14',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_8',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-Training-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-15',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_9',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-CRMDB',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            },
            {
                ec2InstanceId: `i-${randomize('a0', 17)}`,
                ssmState: 'connected',
                ec2InstanceName: 'app-server-16',
                vpc: {
                    id: 'vpc-84b3afe6',
                    name: 'wlmdb-vpc',
                    cidrBlock: '172.31.0.0/16'
                },
                sqlServerInstances: [
                    {
                        sqlServerEdition: 2022,
                        sqlServerInstance: 'MSSQLSERVER_10',
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        windowsAuthentication: true,
                        sqlServerName: 'SQLServer-CRMDB-Test',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF'],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId
                            }
                        ],
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b']
                            }
                        ]
                    }
                ]
            }
        ]
    };
}

export { inventoryDemoData };
