function instanceDemoData(fsxId: string, ec2InstanceId: string) {
    return {
        count: 1,
        items: [
            {
                ec2InstanceId,
                ec2InstanceType: 'm5.large',
                ec2UsageOperation: 'RunInstances:0006',
                ssmState: 'connected',
                ec2InstanceName: '',
                vpc: {},
                sqlServerInstances: [
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'AMAZON',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6c',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'ANTMAN',
                        serveGuid: 'f4b7c5d3-e1f6-4g2a-9b6d',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'BATMAN',
                        serveGuid: 'f4b7c5d3-e1f6-4g2a-9b6e',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'MSSQLSERVER',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6h',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'INST_D',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6j',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'BETA',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6k',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'GAMMA',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6l',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'GANGES',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6m',
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
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DELTA',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
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
            }
        ]
    };
}

export { instanceDemoData };
