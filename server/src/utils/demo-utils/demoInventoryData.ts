import { isEmpty } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import {
    DiscoverMsSqlResponseBodyType,
    DiscoverOracleInstanceType,
    DiscoverOracleResponseBodyType,
    DiscoverOracleResponseType
} from '../../routes/types/discover.types';
import { RecommendationOptionType } from '../../routes/types/storage-savings.types';
import { DatabaseTypes, HOURS_IN_MONTH, SINGLE_AZ } from '../consts';
import { getMonthlyPriceFromHourlyPrice } from '../utils';
import { getDatabaseHostsSummaryV2 } from '../../operations/database-hosts-operations';
import { getSqlInstancePricingDetails } from '../../operations/aws/pricing-operations';
import { EC2InstanceDetailsResponseType } from '../../routes/types/database-hosts.types';
import { DiscoverySource } from '../common-types';

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

const ORACLE_DISCOVERY_RES: DiscoverOracleResponseBodyType = { count: 0, items: [] };

/** Matches EBS items from `getDiscoveredOracleInstancesStorageDetails` in discover-operations. */
const mkOracleDemoEbsStorageEntries = (volumeIds: string[], zone: string = 'ap-south-1a') =>
    volumeIds.map(id => ({
        type: 'EBS',
        id,
        deploymentType: SINGLE_AZ,
        isAsmManaged: false,
        zones: [zone]
    }));

function inventoryDemoData(fsxId: string, ebsVolId: string): DiscoverMsSqlResponseBodyType {
    const items = [
        // no windows auth
        {
            ec2InstanceId: 'i-b0a57935835ddfce4',
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
                    sqlServerNodes: ['EC2WIN-A3E8F7B5', 'EC2WIN-C9D2A6E1'],
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
                            Node: 'EC2WIN-A3E8F7B5',
                            Address: '10.0.6.118'
                        },
                        {
                            Node: 'EC2WIN-C9D2A6E1',
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
                    sqlServerName: 'SQLServer-PreProd-02',
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerNodes: ['EC2WIN-F4B9D7A3', 'EC2WIN-6E2C8F15'],
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
                            Node: 'EC2WIN-F4B9D7A3',
                            Address: '10.0.6.118'
                        },
                        {
                            Node: 'EC2WIN-6E2C8F15',
                            Address: '10.0.28.145'
                        }
                    ]
                }
            ]
        },
        {
            ec2InstanceId: 'i-cb05c810a74426184',
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
                    nodeIps: ['10.0.6.11', '10.0.28.14'],
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerNodes: ['EC2WIN-8A5D3B71', 'EC2WIN-2F7C9E46'],
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
        {
            ec2InstanceId: 'i-cb05c810a74426185',
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
                    sqlServerNodes: ['EC2WIN-8A5D3B71', 'EC2WIN-2F7C9E46'],
                    nodeIps: ['10.0.6.11', '10.0.28.14'],
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
            ec2InstanceId: 'i-cb05c810a74426187',
            ec2InstanceType: 'm5.2xlarge',
            ec2UsageOperation: 'RunInstances:0002',
            ssmState: 'connected',
            ec2InstanceName: 'app-byol-server-16',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9b88',
                    sqlServerState: 'Running',
                    isDefaultInstance: false,
                    sqlServerName: 'SQLServer-Sales-04',
                    sqlServerVersion: '16.0.4105.2',
                    databaseCount: 8,
                    nodeIps: ['10.0.6.22', '10.0.28.28'],
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerNodes: ['EC2WIN-8A596F71', 'EC2WIN-2F76G346'],
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
        {
            ec2InstanceId: 'i-cb05c810a74426189',
            ec2InstanceType: 'm5.2xlarge',
            ec2UsageOperation: 'RunInstances:0102',
            ssmState: 'connected',
            ec2InstanceName: 'app-server-21',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9b5y',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQLserver-PLM',
                    sqlServerNodes: ['EC2WIN-8A596F71', 'EC2WIN-2F76G346'],
                    nodeIps: ['10.0.6.22', '10.0.28.28'],
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
        // ============================================================
        // Managed Standalone Instance (SQL-Managed-Host-Prod)
        // ============================================================
        {
            ec2InstanceId: 'i-0c1d2e3f4a5b6c701',
            ec2InstanceType: 'm5.xlarge',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'SQL-Managed-Host-Prod',
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
                    sqlServerInstance: 'PROD-MarketingCampaigns',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-mp01',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2022',
                    sqlServerName: 'SQL-Managed-Host-Prod',
                    sqlServerNodes: ['EC2WIN-MP01'],
                    sqlServerDeploymentType: 'Standalone',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                    sqlServerInstance: 'PROD-SupplierManagement',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-mp02',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 6,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2022',
                    sqlServerName: 'SQL-Managed-Host-Prod',
                    sqlServerNodes: ['EC2WIN-MP01'],
                    sqlServerDeploymentType: 'Standalone',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                    sqlServerInstance: 'PROD-ProductCatalog',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-mp03',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 5,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2022',
                    sqlServerName: 'SQL-Managed-Host-Prod',
                    sqlServerNodes: ['EC2WIN-MP01'],
                    sqlServerDeploymentType: 'Standalone',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                    sqlServerInstance: 'MSSQLSERVER',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-mp04',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 4,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2022',
                    sqlServerName: 'SQL-Managed-Host-Prod',
                    sqlServerNodes: ['EC2WIN-MP01'],
                    sqlServerDeploymentType: 'Standalone',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
        // ============================================================
        // Managed FCI Instance (SQL-Managed-Host-DEV)
        // ============================================================
        {
            ec2InstanceId: 'i-0c1d2e3f4a5b6c702',
            ec2InstanceType: 'm5.large',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'SQL-Managed-Host-DEV',
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
                    sqlServerInstance: 'DEV-SalesAnalytics',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-md01',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.1000.6',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQL-Managed-Host-DEV',
                    sqlServerNodes: ['EC2WIN-MD01', 'EC2WIN-MD02'],
                    nodeIps: ['10.0.8.50', '10.0.24.50'],
                    sqlServerDeploymentType: 'FCI',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                            Node: 'EC2WIN-MD01',
                            Address: '10.0.8.50'
                        },
                        {
                            Node: 'EC2WIN-MD02',
                            Address: '10.0.24.50'
                        }
                    ]
                },
                {
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerProductYear: 2017,
                    sqlServerInstance: 'DEV-ProjectManagement',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-md02',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.1000.6',
                    databaseCount: 6,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQL-Managed-Host-DEV',
                    sqlServerNodes: ['EC2WIN-MD01', 'EC2WIN-MD02'],
                    nodeIps: ['10.0.8.50', '10.0.24.50'],
                    sqlServerDeploymentType: 'FCI',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                            Node: 'EC2WIN-MD01',
                            Address: '10.0.8.50'
                        },
                        {
                            Node: 'EC2WIN-MD02',
                            Address: '10.0.24.50'
                        }
                    ]
                },
                {
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerProductYear: 2019,
                    sqlServerInstance: 'MSSQLSERVER',
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-md03',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQL-Managed-Host-DEV',
                    sqlServerNodes: ['EC2WIN-MD01', 'EC2WIN-MD02'],
                    nodeIps: ['10.0.8.50', '10.0.24.50'],
                    sqlServerDeploymentType: 'FCI',
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
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
                            Node: 'EC2WIN-MD01',
                            Address: '10.0.8.50'
                        },
                        {
                            Node: 'EC2WIN-MD02',
                            Address: '10.0.24.50'
                        }
                    ]
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
                    sqlServerNodes: ['EC2WIN-3E9A1F52', 'EC2WIN-8B4C7D96'],
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
            ec2InstanceId: 'i-fe881ebd880a3e61f',
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
                    sqlServerNodes: ['EC2WIN-5A8F2D64'],
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
                    sqlServerNodes: ['EC2WIN-C3F7E9A1'],
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
            ec2InstanceId: 'i-587a3738a9f5e35aa',
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
                    sqlServerNodes: ['EC2WIN-8E4A6B29'],
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
                    sqlServerNodes: ['EC2WIN-9F7D2A83'],
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
        },
        {
            ec2InstanceId: 'i-587a3738a9f5e35ab',
            ec2InstanceType: 'm5.large',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'app-server-30',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9c99',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQLserver-HR-02',
                    sqlServerNodes: ['EC2WIN-8E4AHF49'],
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
                    sqlServerNodes: ['EC2WIN-8F7D2A83'],
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
        },
        {
            ec2InstanceId: 'i-587a3738a9f5e35ac',
            ec2InstanceType: 'm5.large',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'app-server-31',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9cA9',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQLserver-Orders-02',
                    sqlServerNodes: ['EC2WIN-8E4AHF50'],
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
        },
        {
            ec2InstanceId: 'i-587a3738a9f5e35ad',
            ec2InstanceType: 'm5.large',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'app-server-32',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9cH9',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQLserver-Store-02',
                    sqlServerNodes: ['EC2WIN-8E4AHG4D'],
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
        },
        {
            ec2InstanceId: 'i-587a3738a9f5e35af',
            ec2InstanceType: 'm5.large',
            ec2UsageOperation: 'RunInstances:0006',
            ssmState: 'connected',
            ec2InstanceName: 'app-server-33',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-9cq9',
                    isDefaultInstance: false,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    databaseCount: 8,
                    windowsAuthentication: true,
                    sqlServerAuthentication: true,
                    windowsDomainUserAuthentication: true,
                    windowsOsVersion: 'Microsoft Windows Server 2019',
                    sqlServerName: 'SQLserver-Employee-02',
                    sqlServerNodes: ['EC2WIN-8E4AHK5D'],
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
        },
        // ============================================================
        // AOAG Standalone Instances (2-node cluster with default instance)
        // ============================================================
        {
            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a1',
            ec2InstanceType: 'm5.xlarge',
            ec2UsageOperation: 'RunInstances:0002',
            ssmState: 'connected',
            ec2InstanceName: 'PRD-SQL-CRM-AG1',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-aoag-primary01',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 6,
                    windowsAuthentication: true,
                    sqlServerAuthentication: false,
                    windowsDomainUserAuthentication: false,
                    windowsOsVersion: 'Microsoft Windows Server 2022 Standard',
                    sqlServerName: 'prd-sql-crm-ag1',
                    sqlServerDeploymentType: 'AOAG',
                    sqlServerNodes: ['prd-sql-crm-ag1'],
                    nodeIps: ['10.0.6.201', '10.0.28.201'],
                    windowsClusterNodes: [
                        { Node: 'PRD-SQL-CRM-AG1', Address: '10.0.6.201' },
                        { Node: 'PRD-SQL-CRM-AG2', Address: '10.0.28.201' }
                    ],
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
                        }
                    ],
                    deploymentTypes: [
                        {
                            type: 'MULTI_AZ_1',
                            zones: ['availability-zone-1', 'availability-zone-2']
                        }
                    ],
                    manageReadiness: MANAGE_READINESS,
                    aoagDetails: {
                        serverInfo: {
                            serverName: 'PRD-SQL-CRM-AG1',
                            isHadrEnabled: 1
                        },
                        baseDeploymentType: 'Standalone',
                        availabilityGroups: [
                            {
                                agName: 'ProdAOAG',
                                primaryReplica: 'PRD-SQL-CRM-AG1',
                                replicas: [
                                    {
                                        replica: 'PRD-SQL-CRM-AG1',
                                        role: 'PRIMARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: true,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 0,
                                        isRoutableReadReplica: 0
                                    },
                                    {
                                        replica: 'PRD-SQL-CRM-AG2',
                                        role: 'SECONDARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: false,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 1,
                                        isRoutableReadReplica: 1
                                    }
                                ]
                            }
                        ]
                    },
                    aoagClusterNodeDetails: [
                        {
                            node: 'PRD-SQL-CRM-AG1',
                            ip: '10.0.6.201',
                            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a1',
                            ec2InstanceName: 'PRD-SQL-CRM-AG1'
                        },
                        {
                            node: 'PRD-SQL-CRM-AG2',
                            ip: '10.0.28.201',
                            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a2',
                            ec2InstanceName: 'PRD-SQL-CRM-AG2'
                        }
                    ]
                }
            ]
        },
        {
            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a2',
            ec2InstanceType: 'm5.xlarge',
            ec2UsageOperation: 'RunInstances:0002',
            ssmState: 'connected',
            ec2InstanceName: 'PRD-SQL-CRM-AG2',
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
                    serverGuid: 'f4b7c5d3-e1f6-4g2a-aoag-secondary01',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 6,
                    windowsAuthentication: true,
                    sqlServerAuthentication: false,
                    windowsDomainUserAuthentication: false,
                    windowsOsVersion: 'Microsoft Windows Server 2022 Standard',
                    sqlServerName: 'prd-sql-crm-ag2',
                    sqlServerDeploymentType: 'AOAG',
                    sqlServerNodes: ['prd-sql-crm-ag2'],
                    nodeIps: ['10.0.6.201', '10.0.28.201'],
                    windowsClusterNodes: [
                        { Node: 'PRD-SQL-CRM-AG1', Address: '10.0.6.201' },
                        { Node: 'PRD-SQL-CRM-AG2', Address: '10.0.28.201' }
                    ],
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
                        }
                    ],
                    deploymentTypes: [
                        {
                            type: 'MULTI_AZ_1',
                            zones: ['availability-zone-1', 'availability-zone-2']
                        }
                    ],
                    manageReadiness: MANAGE_READINESS,
                    aoagDetails: {
                        serverInfo: {
                            serverName: 'PRD-SQL-CRM-AG2',
                            isHadrEnabled: 1
                        },
                        baseDeploymentType: 'Standalone',
                        availabilityGroups: [
                            {
                                agName: 'ProdAOAG',
                                primaryReplica: 'PRD-SQL-CRM-AG1',
                                replicas: [
                                    {
                                        replica: 'PRD-SQL-CRM-AG1',
                                        role: 'PRIMARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: false,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 0,
                                        isRoutableReadReplica: 0
                                    },
                                    {
                                        replica: 'PRD-SQL-CRM-AG2',
                                        role: 'SECONDARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: true,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 1,
                                        isRoutableReadReplica: 1
                                    }
                                ]
                            }
                        ]
                    },
                    aoagClusterNodeDetails: [
                        {
                            node: 'PRD-SQL-CRM-AG1',
                            ip: '10.0.6.201',
                            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a1',
                            ec2InstanceName: 'PRD-SQL-CRM-AG1'
                        },
                        {
                            node: 'PRD-SQL-CRM-AG2',
                            ip: '10.0.28.201',
                            ec2InstanceId: 'i-0a1b2c3d4e5f6a0a2',
                            ec2InstanceName: 'PRD-SQL-CRM-AG2'
                        }
                    ]
                }
            ]
        },

        // ============================================================
        // Managed AOAG Standalone Instances (2-node cluster - DemoAOAG)
        // ============================================================
        {
            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
            ec2InstanceType: 'm5.xlarge',
            ec2UsageOperation: 'RunInstances:0002',
            ssmState: 'connected',
            ec2InstanceName: 'PRD-SQL-CRM-AG3',
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
                    serverGuid: 'a1b2c3d4-e5f6-7890-aoag-managed-pri01',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 4,
                    windowsAuthentication: true,
                    sqlServerAuthentication: false,
                    windowsDomainUserAuthentication: false,
                    windowsOsVersion: 'Microsoft Windows Server 2022 Standard',
                    sqlServerName: 'prd-sql-crm-ag3',
                    sqlServerDeploymentType: 'AOAG',
                    sqlServerNodes: ['prd-sql-crm-ag3'],
                    nodeIps: ['10.0.10.101', '10.0.30.101'],
                    windowsClusterNodes: [
                        { Node: 'PRD-SQL-CRM-AG3', Address: '10.0.10.101' },
                        { Node: 'PRD-SQL-CRM-AG4', Address: '10.0.30.101' }
                    ],
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
                        }
                    ],
                    deploymentTypes: [
                        {
                            type: 'MULTI_AZ_1',
                            zones: ['availability-zone-1', 'availability-zone-2']
                        }
                    ],
                    manageReadiness: MANAGE_READINESS,
                    aoagDetails: {
                        serverInfo: {
                            serverName: 'PRD-SQL-CRM-AG3',
                            isHadrEnabled: 1
                        },
                        baseDeploymentType: 'Standalone',
                        availabilityGroups: [
                            {
                                agName: 'DemoAOAG',
                                primaryReplica: 'PRD-SQL-CRM-AG3',
                                replicas: [
                                    {
                                        replica: 'PRD-SQL-CRM-AG3',
                                        role: 'PRIMARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: true,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 0,
                                        isRoutableReadReplica: 0
                                    },
                                    {
                                        replica: 'PRD-SQL-CRM-AG4',
                                        role: 'SECONDARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: false,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 1,
                                        isRoutableReadReplica: 1
                                    }
                                ]
                            }
                        ]
                    },
                    aoagClusterNodeDetails: [
                        {
                            node: 'PRD-SQL-CRM-AG3',
                            ip: '10.0.10.101',
                            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
                            ec2InstanceName: 'PRD-SQL-CRM-AG3'
                        },
                        {
                            node: 'PRD-SQL-CRM-AG4',
                            ip: '10.0.30.101',
                            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
                            ec2InstanceName: 'PRD-SQL-CRM-AG4'
                        }
                    ]
                }
            ]
        },
        {
            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
            ec2InstanceType: 'm5.xlarge',
            ec2UsageOperation: 'RunInstances:0002',
            ssmState: 'connected',
            ec2InstanceName: 'PRD-SQL-CRM-AG4',
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
                    serverGuid: 'a1b2c3d4-e5f6-7890-aoag-managed-sec01',
                    isDefaultInstance: true,
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4095.4',
                    databaseCount: 4,
                    windowsAuthentication: true,
                    sqlServerAuthentication: false,
                    windowsDomainUserAuthentication: false,
                    windowsOsVersion: 'Microsoft Windows Server 2022 Standard',
                    sqlServerName: 'prd-sql-crm-ag4',
                    sqlServerDeploymentType: 'AOAG',
                    sqlServerNodes: ['prd-sql-crm-ag4'],
                    nodeIps: ['10.0.10.101', '10.0.30.101'],
                    windowsClusterNodes: [
                        { Node: 'PRD-SQL-CRM-AG3', Address: '10.0.10.101' },
                        { Node: 'PRD-SQL-CRM-AG4', Address: '10.0.30.101' }
                    ],
                    storage: [
                        {
                            type: 'FSXN',
                            id: fsxId,
                            protocol: 'iSCSI',
                            fileSystemStorageType: 'SSD'
                        }
                    ],
                    deploymentTypes: [
                        {
                            type: 'MULTI_AZ_1',
                            zones: ['availability-zone-1', 'availability-zone-2']
                        }
                    ],
                    manageReadiness: MANAGE_READINESS,
                    aoagDetails: {
                        serverInfo: {
                            serverName: 'PRD-SQL-CRM-AG4',
                            isHadrEnabled: 1
                        },
                        baseDeploymentType: 'Standalone',
                        availabilityGroups: [
                            {
                                agName: 'DemoAOAG',
                                primaryReplica: 'PRD-SQL-CRM-AG3',
                                replicas: [
                                    {
                                        replica: 'PRD-SQL-CRM-AG3',
                                        role: 'PRIMARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: false,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 0,
                                        isRoutableReadReplica: 0
                                    },
                                    {
                                        replica: 'PRD-SQL-CRM-AG4',
                                        role: 'SECONDARY',
                                        availabilityMode: 'SYNCHRONOUS_COMMIT',
                                        failoverMode: 'AUTOMATIC',
                                        syncHealth: 'HEALTHY',
                                        connectedState: 'CONNECTED',
                                        isLocalReplica: true,
                                        secondaryConnections: 'ALL',
                                        primaryConnections: 'ALLOW_ALL_CONNECTIONS',
                                        isReadReplica: 1,
                                        isRoutableReadReplica: 1
                                    }
                                ]
                            }
                        ]
                    },
                    aoagClusterNodeDetails: [
                        {
                            node: 'PRD-SQL-CRM-AG3',
                            ip: '10.0.10.101',
                            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
                            ec2InstanceName: 'PRD-SQL-CRM-AG3'
                        },
                        {
                            node: 'PRD-SQL-CRM-AG4',
                            ip: '10.0.30.101',
                            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
                            ec2InstanceName: 'PRD-SQL-CRM-AG4'
                        }
                    ]
                }
            ]
        }
    ];
    return {
        count: items.length,
        items: items.map(item => ({ ...item, source: DiscoverySource.DISCOVER }))
    };
}

async function discoverDemoDataOracle(
    accountId: string,
    region: string,
    credentialsId: string,
    fsxId: string,
    ebsVolId: string,
    fsxIdStandby?: string
) {
    if (isEmpty(ORACLE_DISCOVERY_RES.items)) {
        const oracleEbsDemoAttachTime = '2025-03-07T03:34:27.000Z';
        const mkOracleDemoEbsVolumes = (volumeIds: string[]) =>
            volumeIds.map((VolumeId, index) => ({
                DeviceName: `/dev/xvd${String.fromCharCode(97 + index)}`,
                Ebs: {
                    AttachTime: oracleEbsDemoAttachTime,
                    DeleteOnTermination: true,
                    Status: 'attached',
                    VolumeId
                }
            }));

        const mkOracleDemoDeploymentTypes = (zones: string[]) => [
            {
                type: 'SINGLE_AZ_1',
                zones
            }
        ];

        // Order for multi-type EBS: 00001–00004 = gp3, 00005–00008 = io2 (aligns with Oracle TCO marketing demo in demo-operations).
        const oracleEbsTcoDemoSa1Vols = [
            'vol-0a1b2c3d4e5f00001',
            'vol-0a1b2c3d4e5f00002',
            'vol-0a1b2c3d4e5f00003',
            'vol-0a1b2c3d4e5f00004',
            'vol-0a1b2c3d4e5f00005',
            'vol-0a1b2c3d4e5f00006',
            'vol-0a1b2c3d4e5f00007',
            'vol-0a1b2c3d4e5f00008'
        ];
        const oracleEbsTcoDemoSa2Vols = [
            'vol-0b2c3d4e5f6a70001',
            'vol-0b2c3d4e5f6a70002',
            'vol-0b2c3d4e5f6a70003',
            'vol-0b2c3d4e5f6a70004',
            'vol-0b2c3d4e5f6a70005',
            'vol-0b2c3d4e5f6a70006',
            'vol-0b2c3d4e5f6a70007',
            'vol-0b2c3d4e5f6a70008'
        ];
        const oracleEbsTcoDemoDgPrimaryVols = [
            'vol-0c4d5e6f7a8b00001',
            'vol-0c4d5e6f7a8b00002',
            'vol-0c4d5e6f7a8b00003',
            'vol-0c4d5e6f7a8b00004',
            'vol-0c4d5e6f7a8b00005',
            'vol-0c4d5e6f7a8b00006',
            'vol-0c4d5e6f7a8b00007',
            'vol-0c4d5e6f7a8b00008'
        ];
        const oracleEbsTcoDemoDgStandbyVols = [
            'vol-0d5e6f7a8b9c00001',
            'vol-0d5e6f7a8b9c00002',
            'vol-0d5e6f7a8b9c00003',
            'vol-0d5e6f7a8b9c00004',
            'vol-0d5e6f7a8b9c00005',
            'vol-0d5e6f7a8b9c00006',
            'vol-0d5e6f7a8b9c00007',
            'vol-0d5e6f7a8b9c00008'
        ];
        const oracleEbsTcoDemoMixedStdVols = [
            'vol-0e6f7a8b9c0d00001',
            'vol-0e6f7a8b9c0d00002',
            'vol-0e6f7a8b9c0d00003',
            'vol-0e6f7a8b9c0d00004',
            'vol-0e6f7a8b9c0d00005',
            'vol-0e6f7a8b9c0d00006'
        ];
        const oracleEbsTcoDemoMixedDgVols = [
            'vol-0f7a8b9c0d1e00001',
            'vol-0f7a8b9c0d1e00002',
            'vol-0f7a8b9c0d1e00003',
            'vol-0f7a8b9c0d1e00004',
            'vol-0f7a8b9c0d1e00005',
            'vol-0f7a8b9c0d1e00006'
        ];
        const oracleEbsTcoDemoMixedHostAllVols = [...oracleEbsTcoDemoMixedStdVols, ...oracleEbsTcoDemoMixedDgVols];
        // ORCLSTD6 (Standalone) — 8-vol TCO set; first id retains the historical `vol-094b644283b4fd16a`
        // so existing references in mock-server fixtures continue to resolve.
        const oracleEbsTcoDemoOrclStd6Vols = [
            'vol-094b644283b4fd16a',
            'vol-094b644283b4f0002',
            'vol-094b644283b4f0003',
            'vol-094b644283b4f0004',
            'vol-094b644283b4f0005',
            'vol-094b644283b4f0006',
            'vol-094b644283b4f0007',
            'vol-094b644283b4f0008'
        ];

        const discoveryRes = [
            {
                ec2InstanceId: 'i-25694686',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'oracle-node-64789',
                ec2InstancePrivateIpAddress: '172.31.48.86',
                ec2HostName: 'ip-172-31-48-86.ap-southeast-1.compute.internal',
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
                            VolumeId: ebsVolId
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-0100cefdf732ef9e9',
                    name: 'VPC-5',
                    cidrBlock: '192.168.16.0/20'
                },
                error: undefined,
                platform: 'Red Hat Enterprise Linux 8.10 (Ootpa)',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: 'oracleasm',
                        instanceName: 'oracleasm',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'MULTI_TENANT',
                        databaseCount: 2,
                        databaseDetails: {
                            databaseId: '28096914',
                            name: 'ORADB1',
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
                        isDefaultAuthentication: false,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-37030647',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'oracle-node-5716',
                ec2HostName: 'ip-172-31-48-87.ap-southeast-1.compute.internal',
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
                            VolumeId: ebsVolId
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-0100cefdf732ef9e9',
                    name: 'VPC-5',
                    cidrBlock: '192.168.16.0/20'
                },
                error: undefined,
                platform: 'Red Hat Enterprise Linux 8.10 (Ootpa)',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: 'oracle',
                        instanceName: 'oracle',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'MULTI_TENANT',
                        databaseCount: 2,
                        databaseDetails: {
                            databaseId: '28096904',
                            name: 'ORADB1SA',
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
                                        mountPoint: 'lWB23]VAYAWk',
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
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-5520fe41798c75632',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'oracle-node-5716',
                ec2HostName: 'ip-171-30-40-16.ap-southeast-1.compute.internal',
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
                            VolumeId: ebsVolId
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-0100cefdf732ef9e9',
                    name: 'VPC-5',
                    cidrBlock: '192.168.16.0/20'
                },
                error: undefined,
                platform: 'Red Hat Enterprise Linux 8.10 (Ootpa)',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        databaseDetails: {
                            databaseId: '28096904',
                            name: 'oracle-dev',
                            openMode: 'READ WRITE',
                            isCDB: 'NO'
                        },
                        instanceId: 'oracle-dev',
                        instanceName: 'oracle-dev',
                        version: '19.0.0.0.0',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        instanceState: 'OPEN',
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
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: false,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-12456768',
                ec2InstanceType: 'm5.2xlarge',
                ec2InstanceName: 'oracle-node-5717',
                ec2HostName: 'ORACLE-EBS-PRD-STG-ORCLSTD6',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoOrclStd6Vols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoOrclStd6Vols),
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
                        instanceId: 'pdbebs1',
                        instanceName: 'pdbebs1',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044225',
                            openMode: 'READ WRITE'
                        },

                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoOrclStd6Vols, 'ap-south-1c'),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1c']),
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            // DataGuard Primary Instance
            {
                ec2InstanceId: 'i-0123456789abcdef0',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'DATAGUARD-PRIMARY-oracle19c-normal-nfs-141225181923',
                ec2HostName: 'ip-10-0-131-169.ap-south-1.compute.internal',
                ec2UsageOperation: 'RunInstances:0014',
                ssmState: 'connected',
                ebsVolumeIDs: [ebsVolId],
                ebsVolumes: [
                    {
                        DeviceName: '/dev/xvda',
                        Ebs: {
                            AttachTime: '2025-03-07T03:34:27.000Z',
                            DeleteOnTermination: true,
                            Status: 'attached',
                            VolumeId: ebsVolId
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Red Hat Enterprise Linux with SQL Server Standard',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceName: 'dataguard-primary',
                        instanceId: 'dataguard-primary',
                        instanceState: 'OPEN',
                        version: '19.0.0.0.0',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '1167481941',
                            openMode: 'READ WRITE'
                        },
                        oracleServerAuthentication: false,
                        isDefaultAuthentication: true,
                        isInstanceStorageAsmManaged: false,
                        asmAuthentication: false,
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxId,
                                svmId: 'svm-0a333def9bfd29537',
                                fileSystemStorageType: 'SSD',
                                fileSystemName: 'demo-fsx',
                                deploymentType: 'MULTI_AZ_1',
                                zones: ['ap-south-1c', 'ap-south-1b'],
                                mountDetails: [
                                    {
                                        mountPoint: '/data_141225182258',
                                        protocol: 'NFS',
                                        mountIp: '198.19.255.89'
                                    }
                                ]
                            }
                        ],
                        manageReadiness: {
                            assessment: {
                                missingSqlPermissions: [],
                                missingModules: []
                            },
                            remediation: {
                                missingSqlPermissions: [],
                                missingModules: []
                            }
                        },
                        isDataGuardDeployed: true,
                        dataguardDetails: {
                            dbUniqueName: 'dataguard-primary',
                            dbName: 'dataguardDomain-1',
                            associatedHosts: [
                                {
                                    serviceName: 'dataguard-primary',
                                    hostIp: '127.0.0.1',
                                    ec2InstanceId: 'i-0123456789abcdef0',
                                    listenerPort: '1532',
                                    sidName: 'dataguard-primary'
                                },
                                {
                                    serviceName: 'dataguard-standby',
                                    hostIp: '127.0.0.2',
                                    ec2InstanceId: 'i-0123456789abcdef1',
                                    listenerPort: '1532',
                                    sidName: 'dataguard-standby'
                                }
                            ],
                            isPrimaryNode: true
                        }
                    }
                ]
            },
            // DataGuard Standby Instance
            {
                ec2InstanceId: 'i-0123456789abcdef1',
                ec2InstanceType: 'm5.large',
                ec2InstanceName: 'DATAGAURD-STANDBY-oracle19c-normal-nfs-141225181923',
                ec2HostName: 'ip-10-0-131-169.ap-south-1.compute.internal',
                ec2UsageOperation: 'RunInstances:0014',
                ssmState: 'connected',
                ebsVolumeIDs: [ebsVolId],
                ebsVolumes: [
                    {
                        DeviceName: '/dev/xvda',
                        Ebs: {
                            AttachTime: '2025-03-07T03:34:27.000Z',
                            DeleteOnTermination: true,
                            Status: 'attached',
                            VolumeId: ebsVolId
                        }
                    }
                ],
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Red Hat Enterprise Linux with SQL Server Standard',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceName: 'dataguard-standby',
                        instanceId: 'dataguard-standby',
                        instanceState: 'OPEN',
                        version: '19.0.0.0.0',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '1167481941',
                            openMode: 'READ WRITE'
                        },
                        oracleServerAuthentication: false,
                        isDefaultAuthentication: true,
                        isInstanceStorageAsmManaged: false,
                        asmAuthentication: false,
                        storage: [
                            {
                                type: 'FSXN',
                                id: fsxIdStandby || fsxId,
                                svmId: 'svm-098b3b2800853b868',
                                fileSystemStorageType: 'SSD',
                                fileSystemName: 'wlmdb-fsx-1737951297350',
                                deploymentType: 'MULTI_AZ_1',
                                zones: ['ap-south-1c', 'ap-south-1b'],
                                mountDetails: [
                                    {
                                        mountPoint: '/data_141225182258',
                                        protocol: 'NFS',
                                        mountIp: '198.19.255.89'
                                    }
                                ]
                            }
                        ],
                        manageReadiness: {
                            assessment: {
                                missingSqlPermissions: [],
                                missingModules: []
                            },
                            remediation: {
                                missingSqlPermissions: [],
                                missingModules: []
                            }
                        },
                        isDataGuardDeployed: true,
                        dataguardDetails: {
                            dbUniqueName: 'dataguard-standby',
                            dbName: 'dataguardDomain-1',
                            associatedHosts: [
                                {
                                    serviceName: 'dataguard-primary',
                                    hostIp: '127.0.0.1',
                                    ec2InstanceId: 'i-0123456789abcdef0',
                                    listenerPort: '1532',
                                    sidName: 'dataguard-primary'
                                },
                                {
                                    serviceName: 'dataguard-standby',
                                    hostIp: '127.0.0.2',
                                    ec2InstanceId: 'i-0123456789abcdef1',
                                    listenerPort: '1532',
                                    sidName: 'dataguard-standby'
                                }
                            ],
                            isPrimaryNode: false
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-02a8c7e5d4b3f12a9',
                ec2InstanceType: 'm5.4xlarge',
                ec2InstanceName: 'ORACLE-EBS-PRD-ORCLSTD1',
                ec2HostName: 'ORACLE-EBS-PRD-ORCLSTD1',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoSa1Vols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoSa1Vols),
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: 'orclstd1',
                        instanceName: 'orclstd1',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044226',
                            openMode: 'READ WRITE'
                        },
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoSa1Vols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-03b9d6f4c5e2a8b71',
                ec2InstanceType: 'm5.4xlarge',
                ec2InstanceName: 'ORACLE-EBS-PRD-ORCLSTD2',
                ec2HostName: 'ORACLE-EBS-PRD-ORCLSTD2',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoSa2Vols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoSa2Vols),
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: 'orclstd2',
                        instanceName: 'orclstd2',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044227',
                            openMode: 'READ WRITE'
                        },
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoSa2Vols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-04c8e5b3d6a9f12c4',
                ec2InstanceType: 'm5.4xlarge',
                ec2InstanceName: 'ORACLE-EBS-DG-PRIMARY-ORC19C',
                ec2HostName: 'ORACLE-EBS-DG-PRIMARY-ORC19C',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoDgPrimaryVols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoDgPrimaryVols),
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceName: 'orclebs_pri',
                        instanceId: 'orclebs_pri',
                        instanceState: 'OPEN',
                        version: '19.0.0.0.0',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044228',
                            openMode: 'READ WRITE'
                        },
                        oracleServerAuthentication: false,
                        isDefaultAuthentication: true,
                        isInstanceStorageAsmManaged: false,
                        asmAuthentication: false,
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoDgPrimaryVols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        manageReadiness: {
                            assessment: {
                                missingSqlPermissions: [],
                                missingModules: []
                            },
                            remediation: {
                                missingSqlPermissions: [],
                                missingModules: []
                            }
                        },
                        isDataGuardDeployed: true,
                        dataguardDetails: {
                            dbUniqueName: 'orclebs_pri',
                            dbName: 'orclebsdg',
                            associatedHosts: [
                                {
                                    serviceName: 'orclebs_pri',
                                    hostIp: '10.0.142.10',
                                    ec2InstanceId: 'i-04c8e5b3d6a9f12c4',
                                    listenerPort: '1521',
                                    sidName: 'orclebs_pri'
                                },
                                {
                                    serviceName: 'orclebs_stdby',
                                    hostIp: '10.0.142.11',
                                    ec2InstanceId: 'i-05d7f6c4e3b8a9d52',
                                    listenerPort: '1521',
                                    sidName: 'orclebs_stdby'
                                }
                            ],
                            isPrimaryNode: true
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-05d7f6c4e3b8a9d52',
                ec2InstanceType: 'm5.4xlarge',
                ec2InstanceName: 'ORACLE-EBS-DG-STANDBY-ORC19C',
                ec2HostName: 'ORACLE-EBS-DG-STANDBY-ORC19C',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoDgStandbyVols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoDgStandbyVols),
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceName: 'orclebs_stdby',
                        instanceId: 'orclebs_stdby',
                        instanceState: 'OPEN',
                        version: '19.0.0.0.0',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044228',
                            openMode: 'READ WRITE'
                        },
                        oracleServerAuthentication: false,
                        isDefaultAuthentication: true,
                        isInstanceStorageAsmManaged: false,
                        asmAuthentication: false,
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoDgStandbyVols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        manageReadiness: {
                            assessment: {
                                missingSqlPermissions: [],
                                missingModules: []
                            },
                            remediation: {
                                missingSqlPermissions: [],
                                missingModules: []
                            }
                        },
                        isDataGuardDeployed: true,
                        dataguardDetails: {
                            dbUniqueName: 'orclebs_stdby',
                            dbName: 'orclebsdg',
                            associatedHosts: [
                                {
                                    serviceName: 'orclebs_pri',
                                    hostIp: '10.0.142.10',
                                    ec2InstanceId: 'i-04c8e5b3d6a9f12c4',
                                    listenerPort: '1521',
                                    sidName: 'orclebs_pri'
                                },
                                {
                                    serviceName: 'orclebs_stdby',
                                    hostIp: '10.0.142.11',
                                    ec2InstanceId: 'i-05d7f6c4e3b8a9d52',
                                    listenerPort: '1521',
                                    sidName: 'orclebs_stdby'
                                }
                            ],
                            isPrimaryNode: false
                        }
                    }
                ]
            },
            {
                ec2InstanceId: 'i-06e9a7b5c8d4f3e12',
                ec2InstanceType: 'm5.4xlarge',
                ec2InstanceName: 'ORACLE-EBS-PRD-MIXED-01',
                ec2HostName: 'ORACLE-EBS-PRD-MIXED-01',
                ec2UsageOperation: 'RunInstances',
                ssmState: 'connected',
                ebsVolumeIDs: oracleEbsTcoDemoMixedHostAllVols,
                ebsVolumes: mkOracleDemoEbsVolumes(oracleEbsTcoDemoMixedHostAllVols),
                vpc: {
                    id: 'vpc-075ecf35aaafc2a4f',
                    name: 'VPC-5',
                    cidrBlock: '10.0.0.0/16'
                },
                error: undefined,
                platform: 'Linux/UNIX',
                oracleServerDeploymentType: 'Standalone',
                databaseInstanceDetails: [
                    {
                        instanceId: 'orclmix_std',
                        instanceName: 'orclmix_std',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044229',
                            openMode: 'READ WRITE'
                        },
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoMixedStdVols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        }
                    },
                    {
                        instanceId: 'orclmix_dg',
                        instanceName: 'orclmix_dg',
                        version: '19.0.0.0.0',
                        instanceState: 'OPEN',
                        instanceType: 'SINGLE_TENANT',
                        databaseCount: 1,
                        databaseDetails: {
                            databaseId: '3578044230',
                            openMode: 'READ WRITE'
                        },
                        storage: mkOracleDemoEbsStorageEntries(oracleEbsTcoDemoMixedDgVols),
                        deploymentTypes: mkOracleDemoDeploymentTypes(['ap-south-1a']),
                        isInstanceStorageAsmManaged: false,
                        isDefaultAuthentication: true,
                        oracleServerAuthentication: false,
                        asmAuthentication: false,
                        manageReadiness: {
                            assessment: {
                                missingModules: [],
                                missingSqlPermissions: []
                            },
                            remediation: {
                                missingModules: [],
                                missingSqlPermissions: []
                            }
                        },
                        isDataGuardDeployed: true,
                        dataguardDetails: {
                            dbUniqueName: 'orclmix_dg',
                            dbName: 'orclmixdg',
                            associatedHosts: [
                                {
                                    serviceName: 'orclmix_dg',
                                    hostIp: '10.0.141.200',
                                    ec2InstanceId: 'i-06e9a7b5c8d4f3e12',
                                    listenerPort: '1521',
                                    sidName: 'orclmix_dg'
                                }
                            ],
                            isPrimaryNode: true
                        }
                    }
                ]
            }
        ] as unknown as DiscoverOracleResponseType[];
        ORACLE_DISCOVERY_RES.items = discoveryRes;
    }

    // reconcile registered hosts data into discovery results
    const registeredHostsData = await getDatabaseHostsSummaryV2(
        accountId,
        region,
        credentialsId,
        'nodeTopology,databases',
        undefined,
        undefined,
        undefined,
        undefined,
        DatabaseTypes.ORACLE
    );

    if (!isEmpty(registeredHostsData.items)) {
        for (const registeredHost of registeredHostsData.items) {
            if (!isEmpty(registeredHost.databaseInstancesSummary)) {
                let activeNode: EC2InstanceDetailsResponseType | undefined;
                const matchedDiscoveredHost = (registeredHost.databaseInstancesSummary ?? []).some(dbInstance => {
                    activeNode = dbInstance?.nodeTopology?.ec2Details?.[0];
                    return ORACLE_DISCOVERY_RES.items.some(
                        discoveredHost => discoveredHost.ec2InstanceId === activeNode?.id
                    );
                });

                if (!matchedDiscoveredHost && activeNode) {
                    const newDiscoveredHost = {
                        ec2InstanceId: activeNode?.id || 'unknown',
                        ec2InstanceType: activeNode?.instanceType || 'unknown',
                        ec2InstanceName: activeNode?.name,
                        ec2HostName: registeredHost.nodeTopology?.fqdn,
                        ec2UsageOperation: 'Unknown',
                        ssmState: registeredHost.ssmStatus,
                        vpc: {
                            id: registeredHost.nodeTopology?.vpcId,
                            name: registeredHost.nodeTopology?.vpcName,
                            cidrBlock: registeredHost.nodeTopology?.vpcCidr
                        },
                        platform: registeredHost.platform,
                        oracleServerDeploymentType: 'Standalone',
                        databaseInstanceDetails: registeredHost.databaseInstancesSummary?.map(
                            dbInstance =>
                                ({
                                    instanceType: 'SINGLE_TENANT',
                                    databaseDetails: {
                                        databaseId: dbInstance.databaseInstanceId,
                                        name: dbInstance.databaseInstanceName,
                                        openMode: 'READ WRITE',
                                        isCDB: 'NO'
                                    },
                                    instanceId: dbInstance.databaseInstanceId,
                                    instanceName: dbInstance.databaseInstanceName,
                                    version: '19.0.0.0.0',
                                    instanceState: 'OPEN',
                                    databaseCount: 1,
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
                                    isInstanceStorageAsmManaged: dbInstance.isInstanceStorageAsmManaged || false,
                                    isDefaultAuthentication: false,
                                    oracleServerAuthentication: false,
                                    asmAuthentication: false,
                                    manageReadiness: {
                                        assessment: {
                                            missingModules: [],
                                            missingSqlPermissions: []
                                        },
                                        remediation: {
                                            missingModules: [],
                                            missingSqlPermissions: []
                                        }
                                    }
                                } as unknown as DiscoverOracleInstanceType)
                        )
                    } as unknown as DiscoverOracleResponseType;
                    ORACLE_DISCOVERY_RES.items.push(newDiscoveredHost);
                }
            }
        }
    }

    ORACLE_DISCOVERY_RES.count = ORACLE_DISCOVERY_RES.items.length ?? 0;
    return ORACLE_DISCOVERY_RES as unknown as DiscoverOracleResponseBodyType;
}

/**
 * Demo-only fixture for Oracle TCO EBS hosts. Real AWS Compute Optimizer has no data for our seeded
 * `i-…` ids, so for hosts in `ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE` (see `demo-operations.ts`) the
 * Oracle storage-savings flow falls back to this map, which unblocks the UI recommended-instance-type
 * dropdown without affecting non-demo flows.
 *
 * Each entry is keyed on the existing EC2 instance type and supplies a plausible right-sizing:
 * the list always **starts with the existing type** (so it appears in the dropdown), followed by
 * sensible alternates from the same/adjacent families. The first non-existing entry is the
 * "recommended" default selection.
 */
const ORACLE_TCO_DEMO_INSTANCE_RECOMMENDATIONS: Readonly<Record<string, readonly string[]>> = {
    'm5.2xlarge': ['m5.2xlarge', 'm6i.2xlarge', 'r6i.xlarge'],
    'm5.4xlarge': ['m5.4xlarge', 'm6i.4xlarge', 'r6i.2xlarge']
};

const ORACLE_TCO_DEMO_DEFAULT_RECOMMENDATIONS: readonly string[] = ['m5.2xlarge', 'm6i.2xlarge', 'r6i.xlarge'];

async function getLinuxInstanceHourlyPriceForDemo(region: string, instanceType: string): Promise<number> {
    if (!instanceType) {
        return 0;
    }
    const pricingMap = await getSqlInstancePricingDetails(region, instanceType as _InstanceType, 'Linux');
    const row = pricingMap?.[instanceType]?.NA;
    return row?.pricePerUnit ?? 0;
}

async function buildOracleTcoDemoRecommendation(
    region: string,
    existingInstanceType: string
): Promise<{ recommendedInstanceType: string; recommendationOptions: RecommendationOptionType[] }> {
    const types =
        ORACLE_TCO_DEMO_INSTANCE_RECOMMENDATIONS[existingInstanceType] ?? ORACLE_TCO_DEMO_DEFAULT_RECOMMENDATIONS;
    const hourlyPrices = await Promise.all(types.map(t => getLinuxInstanceHourlyPriceForDemo(region, t)));
    const recommendationOptions: RecommendationOptionType[] = types.map((instanceType, idx) => {
        const hourly = hourlyPrices[idx] || 0;
        const monthly = getMonthlyPriceFromHourlyPrice(hourly);
        return {
            instanceType,
            price: hourly,
            basePrice: hourly,
            computeMonthlyPrice: monthly,
            instanceMonthlyPrice: monthly,
            hoursInMonth: HOURS_IN_MONTH
        };
    });
    // Recommended default = first alternate that differs from the existing type (so the user sees
    // a real right-sizing suggestion); fall back to the existing type if none match.
    const recommendedInstanceType = types.find(t => t !== existingInstanceType) ?? existingInstanceType;
    return { recommendedInstanceType, recommendationOptions };
}

export { buildOracleTcoDemoRecommendation, discoverDemoDataOracle, inventoryDemoData };
