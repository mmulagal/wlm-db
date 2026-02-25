const mockResourceAssessmentData = {
    assessment: {
        compute: {
            finding: 'OVER_PROVISIONED',
            findingReasonCodes: [
                'CPUOverprovisioned',
                'EBSIOPSOverprovisioned',
                'EBSThroughputOverprovisioned',
                'NetworkBandwidthOverprovisioned',
                'NetworkPPSOverprovisioned'
            ],
            currentInstanceType: 'r7i.xlarge',
            recommendationOptions: [
                {
                    instanceType: 'm6a.large',

                    platformDifferences: [],

                    rank: 1,
                    savingsOpportunity: {
                        estimatedMonthlySavings: {
                            currency: 'USD',
                            value: 57.524
                        },
                        savingsOpportunityPercentage: 37.17
                    }
                },
                {
                    instanceType: 'm7i-flex.large',

                    platformDifferences: [],

                    rank: 2,
                    savingsOpportunity: {
                        estimatedMonthlySavings: {
                            currency: 'USD',
                            value: 3.576
                        },
                        savingsOpportunityPercentage: 2.311
                    }
                },
                {
                    instanceType: 'm5a.large',

                    platformDifferences: [],

                    rank: 3,
                    savingsOpportunity: {
                        estimatedMonthlySavings: {
                            currency: 'USD',
                            value: 3.576
                        },
                        savingsOpportunityPercentage: 2.311
                    }
                }
            ]
        },
        license: {
            licenseFinding: 'OPTIMIZED',
            sqlServerInstances: [
                {
                    sqlServerInstance: 'PROD-MarketingCampaigns',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'PROD-SupplierManagement',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'PROD-ProductCatalog',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'MSSQLSERVER',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-QA-02'
                },
                {
                    sqlServerInstance: 'PreProd-BusinessIntelligence',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-PreProd-02'
                },
                {
                    sqlServerInstance: 'Prod-HelpDesk',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-Prod-02'
                },
                {
                    sqlServerInstance: 'Dev-VendorManagement',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-Dev-02'
                },
                {
                    sqlServerInstance: 'UAT-QualityControl',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-UAT-02'
                },
                {
                    sqlServerInstance: 'DEV-SalesAnalytics',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-DEV'
                }
            ],
            recommendedLicenseType: 'SQL std'
        },
        rssConfig: {
            rssAdapters: [
                {
                    adapterName: 'Ethernet 3',
                    rssEnabled: true,
                    rssProfile: 'NUMAStatic',
                    baseProcessorNumber: 0,
                    numberOfReceiveQueues: 4
                }
            ],
            tcpOffloadState: 'Disabled',
            recommendedAdapterSettings: {
                recommendedRssProfile: 'NUMAStatic',
                recommendedBaseProcessorNumber: 2,
                recommendedReceiveQueues: 4
            },
            rssConfigFinding: 'not-optimized',
            totalObjectsAssessed: 1
        },
        mssqlPatch: [
            {
                ec2InstanceId: 'i-0a1f31a39bd2d9362',
                ec2InstanceName: 'SQLServer-Dev-02',
                missingPatchDetails: [
                    {
                        kbId: 'KB4583458',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB4583458)',
                        severity: 'Important',
                        releaseDate: '2021-01-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB4583459',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB4583459)',
                        severity: 'Important',
                        releaseDate: '2021-01-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5014356',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5014356)',
                        severity: 'Important',
                        releaseDate: '2022-06-14T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5021124',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5021124)',
                        severity: 'Important',
                        releaseDate: '2023-02-14T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5021125',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5021125)',
                        severity: 'Important',
                        releaseDate: '2023-03-05T19:18:30.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5029377',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5029377)',
                        severity: 'Important',
                        releaseDate: '2023-10-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5029378',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5029378)',
                        severity: 'Important',
                        releaseDate: '2023-10-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5035434',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5035434)',
                        severity: 'Important',
                        releaseDate: '2024-04-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5036335',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5036335)',
                        severity: 'Important',
                        releaseDate: '2024-04-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5040948',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5040948)',
                        severity: 'Important',
                        releaseDate: '2024-07-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5040986',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5040986)',
                        severity: 'Important',
                        releaseDate: '2024-07-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5042214',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5042214)',
                        severity: 'Important',
                        releaseDate: '2024-09-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5046056',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5046056)',
                        severity: 'Important',
                        releaseDate: '2024-10-08T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5046859',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5046859)',
                        severity: 'Important',
                        releaseDate: '2024-11-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    }
                ],
                missingPatchesCount: 14,
                criticalMissingPatchesCount: 0,
                importantMissingPatchesCount: 14
            },
            {
                ec2InstanceId: 'i-0253886610c274a28',
                ec2InstanceName: 'SQLServer-QA-02',
                missingPatchDetails: [
                    {
                        kbId: 'KB4583458',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB4583458)',
                        severity: 'Important',
                        releaseDate: '2021-01-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB4583459',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB4583459)',
                        severity: 'Important',
                        releaseDate: '2021-01-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5014356',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5014356)',
                        severity: 'Important',
                        releaseDate: '2022-06-14T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5021124',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5021124)',
                        severity: 'Important',
                        releaseDate: '2023-02-14T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5021125',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5021125)',
                        severity: 'Important',
                        releaseDate: '2023-03-05T19:18:30.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5029377',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5029377)',
                        severity: 'Important',
                        releaseDate: '2023-10-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5029378',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5029378)',
                        severity: 'Important',
                        releaseDate: '2023-10-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5035434',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5035434)',
                        severity: 'Important',
                        releaseDate: '2024-04-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5036335',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5036335)',
                        severity: 'Important',
                        releaseDate: '2024-04-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5040948',
                        title: 'Security Update for SQL Server 2019 RTM CU (KB5040948)',
                        severity: 'Important',
                        releaseDate: '2024-07-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5040986',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5040986)',
                        severity: 'Important',
                        releaseDate: '2024-07-09T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5042214',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5042214)',
                        severity: 'Important',
                        releaseDate: '2024-09-10T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5046056',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5046056)',
                        severity: 'Important',
                        releaseDate: '2024-10-08T17:00:00.000Z',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5046859',
                        title: 'Security Update for SQL Server 2019 RTM GDR (KB5046859)',
                        severity: 'Important',
                        releaseDate: '2024-11-12T18:00:00.000Z',
                        classification: 'SecurityUpdates'
                    }
                ],
                missingPatchesCount: 14,
                criticalMissingPatchesCount: 0,
                importantMissingPatchesCount: 14
            }
        ],
        hostOsPatch: [
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0a1f31a39bd2d9362',
                ec2InstanceName: 'SQLServer-Dev-02',
                operationEndTime: 999,
                operationStartTime: 1,
                missingPatchDetails: [
                    {
                        kbId: 'KB5051979',
                        state: 'Missing',
                        title: '2025-02 Cumulative Update for Microsoft server operating system version 21H2 for x64-based Systems (KB5051979)',
                        severity: 'Critical',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5050187',
                        state: 'Missing',
                        title: '2025-01 Cumulative Update for .NET Framework 3.5, 4.8 and 4.8.1 for Microsoft server operating system version 21H2 for x64 (KB5050187)',
                        severity: 'Important',
                        classification: 'SecurityUpdates'
                    }
                ],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 2
            },
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0253886610c274a28',
                ec2InstanceName: 'SQLServer-Dev-02',
                operationEndTime: 819,
                operationStartTime: 244,
                missingPatchDetails: [
                    {
                        kbId: 'KB5051979',
                        state: 'Missing',
                        title: '2025-02 Cumulative Update for Microsoft server operating system version 21H2 for x64-based Systems (KB5051979)',
                        severity: 'Critical',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5050187',
                        state: 'Missing',
                        title: '2025-01 Cumulative Update for .NET Framework 3.5, 4.8 and 4.8.1 for Microsoft server operating system version 21H2 for x64 (KB5050187)',
                        severity: 'Important',
                        classification: 'SecurityUpdates'
                    }
                ],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 2
            }
        ],
        highAvailability: {
            clusterQuorum: {
                status: 'not-optimized',
                details: {
                    isMajority: true,
                    quorumType: 1,
                    isPhysicalDisk: false,
                    quorumResourceName: 'Quorum',
                    isPhysicalDiskAndMajority: true
                }
            },
            heartbeat: {
                status: 'not-optimized',
                details: {
                    CrossSiteDelay: {
                        status: 'optimized',
                        current: 1000,
                        recommended: 1000
                    },
                    SameSubnetDelay: {
                        status: 'not-optimized',
                        current: 100,
                        recommended: 1000
                    },
                    CrossSubnetDelay: {
                        status: 'optimized',
                        current: 1000,
                        recommended: 1000
                    },
                    CrossSiteThreshold: {
                        status: 'optimized',
                        current: 20,
                        recommended: 20
                    },
                    SameSubnetThreshold: {
                        status: 'not-optimized',
                        current: 20,
                        recommended: 10
                    },
                    CrossSubnetThreshold: {
                        status: 'optimized',
                        current: 20,
                        recommended: 20
                    }
                }
            }
        },
        mtuAlignment: {
            fsxMTU: {
                error: null,
                fsxInterfaces: [
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    },
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    }
                ]
            },
            sqlServerMTU: {
                error: null,
                sqlInterfaces: [
                    {
                        name: 'Ethernet 3',
                        mtu: 1500,
                        interfaceIndex: 9,
                        ports: ['1433'],
                        ipAddresses: [
                            { address: '172.31.32.100', family: 'IPv4' },
                            { address: 'fe80::a1b2:c3d4:e5f6:7890', family: 'IPv6' }
                        ]
                    },
                    {
                        name: 'Ethernet 4',
                        mtu: 9001,
                        interfaceIndex: 10,
                        ports: ['1434'],
                        ipAddresses: [{ address: '172.31.32.101', family: 'IPv4' }]
                    }
                ]
            }
        },
        lastAssessedDate: new Date().getTime().toString()
    }
};

const mockResourceAssessmentDataAllOptimized = {
    assessment: {
        compute: {
            finding: 'OPTIMIZED',
            findingReasonCodes: [],
            currentInstanceType: 'r7i.xlarge',
            recommendationOptions: []
        },
        license: {
            licenseFinding: 'OPTIMIZED',
            sqlServerInstances: [
                {
                    sqlServerInstance: 'PROD-MarketingCampaigns',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'PROD-SupplierManagement',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'PROD-ProductCatalog',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-Prod'
                },
                {
                    sqlServerInstance: 'MSSQLSERVER',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-QA-02'
                },
                {
                    sqlServerInstance: 'PreProd-BusinessIntelligence',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-PreProd-02'
                },
                {
                    sqlServerInstance: 'Prod-HelpDesk',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-Prod-02'
                },
                {
                    sqlServerInstance: 'Dev-VendorManagement',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-Dev-02'
                },
                {
                    sqlServerInstance: 'UAT-QualityControl',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQLServer-UAT-02'
                },
                {
                    sqlServerInstance: 'DEV-SalesAnalytics',
                    sqlServerState: 'Running',
                    sqlServerVersion: '16.0.4080.1',
                    sqlServerProductYear: 2022,
                    sqlServerEdition: 'Standard Edition (64-bit)',
                    sqlServerEngineEdition: 2,
                    sqlServerName: 'SQL-Managed-Host-DEV'
                }
            ],
            recommendedLicenseType: 'SQL std'
        },
        rssConfig: {
            rssAdapters: [
                {
                    adapterName: 'Ethernet 3',
                    rssEnabled: true,
                    rssProfile: 'NUMAStatic',
                    baseProcessorNumber: 0,
                    numberOfReceiveQueues: 4
                }
            ],
            tcpOffloadState: 'Disabled',
            recommendedAdapterSettings: {
                recommendedRssProfile: 'NUMAStatic',
                recommendedBaseProcessorNumber: 2,
                recommendedReceiveQueues: 4
            },
            rssConfigFinding: 'optimized',
            totalObjectsAssessed: 1
        },
        mssqlPatch: [
            {
                ec2InstanceId: 'i-0a1f31a39bd2d9362',
                ec2InstanceName: 'SQLServer-Dev-02',
                missingPatchDetails: [],
                missingPatchesCount: 0,
                criticalMissingPatchesCount: 0,
                importantMissingPatchesCount: 0
            },
            {
                ec2InstanceId: 'i-0253886610c274a28',
                ec2InstanceName: 'SQLServer-QA-02',
                missingPatchDetails: [],
                missingPatchesCount: 0,
                criticalMissingPatchesCount: 0,
                importantMissingPatchesCount: 0
            }
        ],
        hostOsPatch: [
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0a1f31a39bd2d9362',
                ec2InstanceName: 'SQLServer-Dev-02',
                operationEndTime: 999,
                operationStartTime: 1,
                missingPatchDetails: [],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 0
            },
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0253886610c274a28',
                ec2InstanceName: 'SQLServer-Dev-02',
                operationEndTime: 819,
                operationStartTime: 244,
                missingPatchDetails: [],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 0
            }
        ],
        mtuAlignment: {
            fsxMTU: {
                error: null,
                fsxInterfaces: [
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    },
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    }
                ]
            },
            sqlServerMTU: {
                error: null,
                sqlInterfaces: [
                    {
                        mtu: 9001,
                        name: 'Ethernet 3',
                        ports: [
                            59628, 59587, 57948, 57910, 57769, 57271, 55251, 55082, 54977, 54876, 54568, 54512, 54466,
                            54414, 54377, 54344, 54281, 54246, 53950, 53917, 50052, 1433
                        ],
                        ipAddresses: [
                            {
                                family: 'IPv6',
                                address: 'fe80::841:f19d:c148:aa0%9'
                            },
                            {
                                family: 'IPv4',
                                address: '172.31.48.15'
                            }
                        ],
                        interfaceIndex: 9
                    }
                ]
            }
        },
        lastAssessedDate: new Date().getTime().toString()
    }
};

const mockOracleHostOsPatchAssessmentData = {
    hostOsPatch: [
        {
            baselineId: 'pb-0da914616003c89f1',
            ec2InstanceId: 'i-5520fe41798c75632',
            ec2InstanceName: 'OracleDB-Prod-01',
            operationEndTime: new Date('2025-06-15T10:45:00Z').getTime(),
            operationStartTime: new Date('2025-06-15T10:30:00Z').getTime(),
            missingPatchDetails: [
                {
                    classification: 'Security',
                    cveIds: 'CVE-2025-21785,CVE-2025-21760',
                    severity: 'Critical',
                    state: 'Missing',
                    title: 'kernel-5.14.0-503.40.1.el9_5.x86_64 - Security update for Linux kernel'
                },
                {
                    classification: 'Security',
                    cveIds: 'CVE-2024-50302,CVE-2024-53197',
                    severity: 'Critical',
                    state: 'Missing',
                    title: 'kernel-headers-5.14.0-503.40.1.el9_5.x86_64 - Security update for kernel headers'
                },
                {
                    classification: 'Security',
                    cveIds: 'CVE-2025-0624',
                    severity: 'Important',
                    state: 'Missing',
                    title: 'grub2-common-2.06-94.el9_5.3.noarch - Security update for GRUB2 bootloader'
                },
                {
                    classification: 'Security',
                    cveIds: 'CVE-2024-12243',
                    severity: 'Important',
                    state: 'Missing',
                    title: 'gnutls-3.8.3-4.el9_5.5.x86_64 - Security update for GnuTLS'
                },
                {
                    classification: 'Security',
                    cveIds: 'CVE-2024-11187,CVE-2024-12705',
                    severity: 'Important',
                    state: 'Missing',
                    title: 'bind-utils-9.16.23-24.el9_5.3.x86_64 - Security update for BIND DNS utilities'
                },
                {
                    classification: 'Security',
                    cveIds: 'CVE-2024-11168',
                    severity: 'Important',
                    state: 'Missing',
                    title: 'python3-urllib3-1.26.5-5.el9_5.1.noarch - Security update for Python urllib3'
                }
            ],
            otherNonCompliantCount: 0,
            criticalNonCompliantCount: 2,
            securityNonCompliantCount: 4
        }
    ],
    lastAssessedDate: new Date().getTime().toString()
};

const mockOracleHostOsPatchAssessmentDataAllOptimized = {
    hostOsPatch: [
        {
            baselineId: 'pb-0da914616003c89f1',
            ec2InstanceId: 'i-5520fe41798c75632',
            ec2InstanceName: 'OracleDB-Prod-01',
            operationEndTime: new Date('2025-06-15T10:45:00Z').getTime(),
            operationStartTime: new Date('2025-06-15T10:30:00Z').getTime(),
            missingPatchDetails: [],
            otherNonCompliantCount: 0,
            criticalNonCompliantCount: 0,
            securityNonCompliantCount: 0
        }
    ],
    lastAssessedDate: new Date().getTime().toString()
};

const mockAoagResourceAssessmentData = {
    assessment: {
        rssConfig: {
            rssAdapters: [
                {
                    adapterName: 'Ethernet 3',
                    rssEnabled: true,
                    rssProfile: 'NUMAStatic',
                    baseProcessorNumber: 0,
                    numberOfReceiveQueues: 4
                }
            ],
            tcpOffloadState: 'Disabled',
            recommendedAdapterSettings: {
                recommendedRssProfile: 'NUMAStatic',
                recommendedBaseProcessorNumber: 2,
                recommendedReceiveQueues: 4
            },
            rssConfigFinding: 'not-optimized',
            totalObjectsAssessed: 1
        },
        hostOsPatch: [
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
                ec2InstanceName: 'PRD-SQL-CRM-AG3',
                operationEndTime: 999,
                operationStartTime: 1,
                missingPatchDetails: [
                    {
                        kbId: 'KB5051979',
                        state: 'Missing',
                        title: '2025-02 Cumulative Update for Microsoft server operating system version 21H2 for x64-based Systems (KB5051979)',
                        severity: 'Critical',
                        classification: 'SecurityUpdates'
                    },
                    {
                        kbId: 'KB5050187',
                        state: 'Missing',
                        title: '2025-01 Cumulative Update for .NET Framework 3.5, 4.8 and 4.8.1 for Microsoft server operating system version 21H2 for x64 (KB5050187)',
                        severity: 'Important',
                        classification: 'SecurityUpdates'
                    }
                ],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 2
            },
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
                ec2InstanceName: 'PRD-SQL-CRM-AG4',
                operationEndTime: 819,
                operationStartTime: 244,
                missingPatchDetails: [
                    {
                        kbId: 'KB5051979',
                        state: 'Missing',
                        title: '2025-02 Cumulative Update for Microsoft server operating system version 21H2 for x64-based Systems (KB5051979)',
                        severity: 'Critical',
                        classification: 'SecurityUpdates'
                    }
                ],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 1
            }
        ],
        highAvailability: {
            clusterQuorum: {
                status: 'not-optimized',
                details: {
                    isMajority: true,
                    quorumType: 1,
                    isPhysicalDisk: false,
                    quorumResourceName: 'Quorum',
                    isPhysicalDiskAndMajority: true
                }
            },
            heartbeat: {
                status: 'not-optimized',
                details: {
                    CrossSiteDelay: {
                        status: 'optimized',
                        current: 1000,
                        recommended: 1000
                    },
                    SameSubnetDelay: {
                        status: 'not-optimized',
                        current: 100,
                        recommended: 1000
                    },
                    CrossSubnetDelay: {
                        status: 'optimized',
                        current: 1000,
                        recommended: 1000
                    },
                    CrossSiteThreshold: {
                        status: 'optimized',
                        current: 20,
                        recommended: 20
                    },
                    SameSubnetThreshold: {
                        status: 'not-optimized',
                        current: 20,
                        recommended: 10
                    },
                    CrossSubnetThreshold: {
                        status: 'optimized',
                        current: 20,
                        recommended: 20
                    }
                }
            }
        },
        mtuAlignment: {
            fsxMTU: {
                error: null,
                fsxInterfaces: [
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    },
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    }
                ]
            },
            sqlServerMTU: {
                error: null,
                sqlInterfaces: [
                    {
                        name: 'Ethernet 3',
                        mtu: 1500,
                        interfaceIndex: 9,
                        ports: ['1433'],
                        ipAddresses: [
                            { address: '10.0.10.101', family: 'IPv4' },
                            { address: 'fe80::a1b2:c3d4:e5f6:7891', family: 'IPv6' }
                        ]
                    },
                    {
                        name: 'Ethernet 4',
                        mtu: 9001,
                        interfaceIndex: 10,
                        ports: ['1434'],
                        ipAddresses: [{ address: '10.0.10.102', family: 'IPv4' }]
                    }
                ]
            }
        },
        lastAssessedDate: new Date().getTime().toString()
    }
};

const mockAoagResourceAssessmentDataAllOptimized = {
    assessment: {
        rssConfig: {
            rssAdapters: [
                {
                    adapterName: 'Ethernet 3',
                    rssEnabled: true,
                    rssProfile: 'NUMAStatic',
                    baseProcessorNumber: 2,
                    numberOfReceiveQueues: 4
                }
            ],
            tcpOffloadState: 'Disabled',
            recommendedAdapterSettings: {
                recommendedRssProfile: 'NUMAStatic',
                recommendedBaseProcessorNumber: 2,
                recommendedReceiveQueues: 4
            },
            rssConfigFinding: 'optimized',
            totalObjectsAssessed: 1
        },
        hostOsPatch: [
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
                ec2InstanceName: 'PRD-SQL-CRM-AG3',
                operationEndTime: 999,
                operationStartTime: 1,
                missingPatchDetails: [],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 0
            },
            {
                baselineId: 'pb-03e4a480964bbb87f',
                ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
                ec2InstanceName: 'PRD-SQL-CRM-AG4',
                operationEndTime: 819,
                operationStartTime: 244,
                missingPatchDetails: [],
                otherNonCompliantCount: 0,
                criticalNonCompliantCount: 0,
                securityNonCompliantCount: 0
            }
        ],
        mtuAlignment: {
            fsxMTU: {
                error: null,
                fsxInterfaces: [
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    },
                    {
                        MTU: 9001,
                        Name: 'e0e'
                    }
                ]
            },
            sqlServerMTU: {
                error: null,
                sqlInterfaces: [
                    {
                        mtu: 9001,
                        name: 'Ethernet 3',
                        ports: [
                            59628, 59587, 57948, 57910, 57769, 57271, 55251, 55082, 54977, 54876, 54568, 54512, 54466,
                            54414, 54377, 54344, 54281, 54246, 53950, 53917, 50052, 1433
                        ],
                        ipAddresses: [
                            {
                                family: 'IPv6',
                                address: 'fe80::841:f19d:c148:aa1%9'
                            },
                            {
                                family: 'IPv4',
                                address: '10.0.30.101'
                            }
                        ],
                        interfaceIndex: 9
                    }
                ]
            }
        },
        lastAssessedDate: new Date().getTime().toString()
    }
};

const optimizedResourceName = ['SQL-Managed-Host-DEV'];
const aoagPrimaryHostName = 'PRD-SQL-CRM-AG3';

export {
    mockResourceAssessmentData,
    mockResourceAssessmentDataAllOptimized,
    mockAoagResourceAssessmentData,
    mockAoagResourceAssessmentDataAllOptimized,
    mockOracleHostOsPatchAssessmentData,
    mockOracleHostOsPatchAssessmentDataAllOptimized,
    optimizedResourceName,
    aoagPrimaryHostName
};
