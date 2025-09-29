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
                        sqlServerInstance: 'PROD-MarketingCampaigns',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6c',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQL-Managed-Host-Prod',
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
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'PROD-SupplierManagement',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6d',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQL-Managed-Host-Prod',
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
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'PROD-ProductCatalog',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6e',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQL-Managed-Host-Prod',
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
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'PreProd-BusinessIntelligence',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6j',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-PreProd-02',
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
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-InventoryControl',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6l',
                        isDefaultInstance: false,
                        sqlServerState: 'Stopped',
                        sqlServerVersion: '16.0.4080.1'
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-CustomerDatabase',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6m',
                        isDefaultInstance: false,
                        sqlServerState: 'Stopped',
                        sqlServerVersion: '16.0.4080.1'
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-EmployeeDirectory',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1'
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-ComplianceManagement',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
                        isDefaultInstance: false,
                        sqlServerState: 'Stopped',
                        sqlServerVersion: '16.0.4080.1'
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'Prod-HelpDesk',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
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
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'Dev-VendorManagement',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
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
                                zones: ['availability-zone-1', 'availability-zone-2']
                            }
                        ],
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'UAT-QualityControl',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQLServer-UAT-02',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
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
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-SalesAnalytics',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1',
                        databaseCount: 8,
                        windowsAuthentication: true,
                        windowsOsVersion: 'Microsoft Windows Server 2019',
                        sqlServerName: 'SQL-Managed-Host-DEV',
                        sqlServerNodes: ['EC2AMAZ-1MF7SUF', 'EC2AMAZ-1MF7SUD'],
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
                        manageReadiness: MANAGE_READINESS
                    },
                    {
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerEngineEdition: 2,
                        sqlServerProductYear: 2022,
                        sqlServerInstance: 'DEV-ProjectManagement',
                        serverGuid: 'f4b7c5d3-e1f6-4g2a-9b6n',
                        isDefaultInstance: false,
                        sqlServerState: 'Running',
                        sqlServerVersion: '16.0.4080.1'
                    }
                ]
            }
        ]
    };
}

function oracleInstanceDemoData(fsxId: string, ec2InstanceId: string) {
    return {
        count: 1,
        items: [
            {
                ec2InstanceId,
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'oracle-node-8916',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: ['vol-0e23df37c6089b3c7'],
                ebsVolumes: [
                    {
                        DeviceName: '/dev/xvda',
                        Ebs: {
                            AttachTime: '2025-03-07T03:34:27.000Z',
                            DeleteOnTermination: true,
                            Status: 'attached',
                            VolumeId: 'vol-0e23df37c6089b3c7'
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-0100cefdf732ef9e9',
                    name: 'VPC-5',
                    cidrBlock: '192.168.16.0/20'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: '7450008296037944599',
                        instanceName: 'oracle',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'MULTI_TENANT',
                        databaseCount: 2,
                        databaseDetails: {
                            databaseId: '28096904',
                            name: 'ORADB5SA',
                            openMode: 'READ WRITE',
                            isCDB: 'YES'
                        },
                        pluggableDatabases: [
                            {
                                pdbId: 3,
                                pdbName: 'ORCLPDB',
                                pdbStatus: 'NORMAL'
                            },
                            {
                                pdbId: 2,
                                pdbName: 'PDB$SEED',
                                pdbStatus: 'NORMAL'
                            }
                        ],
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId,
                                svmId: 'svm-0a333def9bfd29537',
                                fileSystemStorageType: 'SSD',
                                fileSystemName: 'demo-fsx',
                                deploymentType: 'MULTI_AZ_1',
                                zones: ['ap-southeast-1c', 'ap-southeast-1b'],
                                mountDetails: [
                                    {
                                        mountPoint: '/u01/app/oracle',
                                        protocol: 'iSCSI',
                                        mountIp: '172.31.6.100'
                                    }
                                ]
                            }
                        ],
                        isInstanceStorageAsmManaged: true,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            oracle: {
                                missingModules: [],
                                missingPermissions: []
                            }
                        }
                    }
                ]
            }
        ]
    };
}

export { instanceDemoData, oracleInstanceDemoData };
