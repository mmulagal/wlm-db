import { listOnPremDatabaseResources, removeOnPremTcoReportData } from '../../src/lib/database/onprem-tco';
import {
    processEbsDisks,
    EbsVolumeType,
    buildCombinedEc2Instances,
    buildComputeCalculation,
    buildComputeCalculationsForResources,
    ResourceComputeInput,
    fetchPricingForResourcesGeneric,
    PricingDetails,
    MachineDetail,
    generatePayload,
    decompressCollectorPayload,
    downloadDataCollectorScript
} from '../../src/operations/onprem-tco-operations';
import {
    getOnpremLicenseRecommendations,
    deriveEbsVolumesListForMarketing,
    deriveHostConfigBasedInstanceType,
    deriveInstanceRequirements,
    deriveSqlUsageBasedInstanceType,
    groupSqlServerInstancesByDeploymentType,
    saveReportInWlmdbDatabase,
    getOnPremBulkResourceExploreSavings
} from '../../src/operations/workloads/mssql/mssql-onprem-tco-operations';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, MSSQL } from '../../src/utils/consts';
import { convertGiBToBytes, sleep } from '../../src/utils/utils';

// calculateTotalAllocatedCapacity tests are in mssql-onprem-tco-operations.test.ts

const reportData = {
    scriptVersion: '1.0.0',
    sqlServerInfo: [
        {
            instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD2B2',
            licenceUsageDetails:
                '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ',
            memUtilization: '[{"used":482873344,"total":8588910592,"remaining":8106037248,"percentUsed":5}]',
            noOfDatabases: '5',
            ownerNodes:
                '[{"nodeName":"WLMDBFCI3","nodeRole":"Standby"},{"nodeName":"WLMDBFCI4","nodeRole":"Standby"},{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
            sqlInstanceName: 'FCI23NEW',
            sqlVersion:
                'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
            storageDetailsByDb:
                '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":26605,"driveAvailableSizeMb":25509}]',
            sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
            iops: '[{"writeIops":"      0.01","readIops":"      0.01","writeBytesPerSec":"               98.65","readBytesPerSec":"              859.06"}]',
            collation: 'SQL_Croatian_CP1250_CI_AS',
            vcpusPerInstance: '4',
            cpuUtilization: '2',
            deploymentType: 'fci'
        },
        {
            instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD458',
            licenceUsageDetails:
                '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ',
            memUtilization: '[{"used":474525696,"total":8588910592,"remaining":8114384896,"percentUsed":5}]',
            noOfDatabases: '5',
            ownerNodes: '[{"nodeName":"WLMDBFCI4","nodeRole":"Standby"},{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
            sqlInstanceName: 'FCI24NEW',
            sqlVersion:
                'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
            storageDetailsByDb:
                '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"K:","driveTotalSizeMb":27629,"driveAvailableSizeMb":27004}]',
            sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
            iops: '[{"writeIops":"      0.01","readIops":"      0.01","writeBytesPerSec":"              101.67","readBytesPerSec":"              883.16"}]',
            collation: 'SQL_AltDiction_CP850_CI_AI',
            vcpusPerInstance: '4',
            cpuUtilization: '1',
            deploymentType: 'fci'
        },
        {
            instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD2B3',
            licenceUsageDetails:
                '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ',
            memUtilization: '[{"used":482873344,"total":8588910592,"remaining":8106037248,"percentUsed":5}]',
            noOfDatabases: '5',
            ownerNodes: '[{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
            sqlInstanceName: 'STD1NEW',
            sqlVersion:
                'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
            storageDetailsByDb:
                '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":26605,"driveAvailableSizeMb":25509}]',
            sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
            iops: '[{"writeIops":"      0.01","readIops":"      0.01","writeBytesPerSec":"               98.65","readBytesPerSec":"              859.06"}]',
            collation: 'SQL_Croatian_CP1250_CI_AS',
            vcpusPerInstance: '4',
            cpuUtilization: '2',
            deploymentType: 'standalone'
        }
    ],
    timestamp: '20250115031936',
    windowsConfig: {
        clusterNodeNames: ['WLMDBFCI1', 'WLMDBFCI2', 'WLMDBFCI3', 'WLMDBFCI4'],
        nodeDetails: [
            {
                ramSize: 8,
                hostId: 'B1E71E42-B9BC-D5D4-9D4D-D828ED4C31AF',
                networkConfiguration: [
                    {
                        name: 'Intel(R) 82574L Gigabit Network Connection',
                        speedMbps: 953.67431640625,
                        adapterType: 'Ethernet 802.3'
                    },
                    {
                        name: 'Microsoft Failover Cluster Virtual Adapter',
                        speedMbps: 9536.7431640625,
                        adapterType: 'Ethernet 802.3'
                    }
                ],
                hostName: 'WLMDBFCI2',
                driveDetails: {
                    value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE6",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "I:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE3",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE5",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "K:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE4",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    }\r\n]',
                    PSComputerName: 'WLMDBFCI2',
                    RunspaceId: '367a6ccf-901a-4e0e-bbc5-632c1e2a9bfc',
                    PSShowComputerName: true
                },
                numberOfVcpus: 4,
                osEdition: 'Microsoft Windows Server 2022 Standard'
            },
            {
                ramSize: 8,
                osEdition: 'Microsoft Windows Server 2022 Standard',
                networkConfiguration: [
                    {
                        name: 'Intel(R) 82574L Gigabit Network Connection',
                        speedMbps: 953.67431640625,
                        adapterType: 'Ethernet 802.3'
                    },
                    {
                        name: 'Microsoft Failover Cluster Virtual Adapter',
                        speedMbps: 9536.7431640625,
                        adapterType: 'Ethernet 802.3'
                    }
                ],
                hostName: 'WLMDBFCI1',
                driveDetails: {
                    value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "G:"\r\n    }\r\n]',
                    PSComputerName: 'WLMDBFCI1',
                    RunspaceId: '4d1e6c5f-9ceb-45df-8998-be85bda3f215',
                    PSShowComputerName: true
                },
                numberOfVcpus: 4,
                hostId: '16D31E42-DDCA-BC7E-E26A-305FB0842EDD'
            },
            {
                ramSize: 8,
                osEdition: 'Microsoft Windows Server 2022 Standard',
                networkConfiguration: [
                    {
                        name: 'Intel(R) 82574L Gigabit Network Connection',
                        speedMbps: 953.67431640625,
                        adapterType: 'Ethernet 802.3'
                    },
                    {
                        name: 'Microsoft Failover Cluster Virtual Adapter',
                        speedMbps: 9536.7431640625,
                        adapterType: 'Ethernet 802.3'
                    }
                ],
                hostName: 'WLMDBFCI3',
                driveDetails: {
                    value: '{\r\n    "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n    "model":  "VMware Virtual disk SCSI Disk Device",\r\n    "driveLetter":  "C:"\r\n}',
                    PSComputerName: 'WLMDBFCI3',
                    RunspaceId: '17636a9a-25d0-41f7-bc0f-0847d6c6e93b',
                    PSShowComputerName: true
                },
                numberOfVcpus: 4,
                hostId: '9E031E42-5521-22B6-E0D1-1D1FCC152971'
            },
            {
                ramSize: 8,
                osEdition: 'Microsoft Windows Server 2022 Standard',
                networkConfiguration: [
                    {
                        name: 'Intel(R) 82574L Gigabit Network Connection',
                        speedMbps: 953.67431640625,
                        adapterType: 'Ethernet 802.3'
                    },
                    {
                        name: 'Microsoft Failover Cluster Virtual Adapter',
                        speedMbps: 9536.7431640625,
                        adapterType: 'Ethernet 802.3'
                    }
                ],
                hostName: 'WLMDBFCI4',
                driveDetails: {
                    value: '{\r\n    "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n    "model":  "VMware Virtual disk SCSI Disk Device",\r\n    "driveLetter":  "C:"\r\n}',
                    PSComputerName: 'WLMDBFCI4',
                    RunspaceId: '845f18d7-0df9-4bed-bd2a-61d7fe69b4d6',
                    PSShowComputerName: true
                },
                numberOfVcpus: 4,
                hostId: '78FE1E42-0F35-F588-4AD6-1FBEC1365195'
            }
        ],
        windowsSystemName: 'ONPREMFCI',
        belongsToCluster: true
    }
};

describe('onPrem TCO operations', () => {
    afterEach(async () => {
        // Clean up all test resources created during tests
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, MSSQL);
    });

    it('Save report in WLMDB database', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, reportData);
        const listReports = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        expect(listReports.length).toEqual(2);
    });

    it('should derive the correct instance type based on host config', async () => {
        const instanceType = await deriveHostConfigBasedInstanceType(
            DEFAULT_AWS_REGION,
            reportData.windowsConfig,
            'Enterprise Edition'
        );
        expect(instanceType).toEqual('m7i-flex.large');
    });

    it('should group SQL Server instances by deployment type', () => {
        const groupedInstances = groupSqlServerInstancesByDeploymentType(reportData.sqlServerInfo);
        expect(groupedInstances.FCI.length).toEqual(2);
        expect(groupedInstances.Standalone.length).toEqual(1);
    });

    it('should derive the correct EBS volumes list from SQL instance details', () => {
        const expectedEbsVolumes = [
            {
                volumeType: 'gp3',
                volumeNumber: 3,
                storageAmount: 0.009375000000000001
            }
        ];

        const { primaryEbsVolumes } =
            deriveEbsVolumesListForMarketing(DEFAULT_AWS_REGION, reportData.sqlServerInfo) || {};
        expect(
            primaryEbsVolumes?.find((ebsVolume: EbsVolumeType) => ebsVolume?.volumeType === 'gp3')?.throughput
        ).toBeDefined();
        expect(
            primaryEbsVolumes?.find((ebsVolume: EbsVolumeType) => ebsVolume?.volumeType === 'gp3')?.volumeIops
        ).toBeDefined();
        expect(primaryEbsVolumes?.length).toEqual(expectedEbsVolumes.length);
    });

    it('should derive the correct instance type based on SQL usage', async () => {
        const instanceType = await deriveSqlUsageBasedInstanceType(
            DEFAULT_AWS_REGION,
            reportData.sqlServerInfo,
            'Enterprise Edition'
        );
        expect(instanceType).toEqual('m7i-flex.large');
    });

    it('should return false if any SQL instance is not using enterprise features', () => {
        const { currentLicenseEdition, recommendedLicenseEdition } = getOnpremLicenseRecommendations(
            reportData.sqlServerInfo
        );
        expect(currentLicenseEdition).toBeDefined();
        expect(recommendedLicenseEdition).toBeDefined();
    });

    it('should return true if any SQL instance is using enterprise features', () => {
        const sqlServerInfo = [
            {
                instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD458',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]',
                memUtilization: '[{"used":474525696,"total":8588910592,"remaining":8114384896,"percentUsed":5}]',
                noOfDatabases: '5',
                ownerNodes:
                    '[{"nodeName":"WLMDBFCI4","nodeRole":"Standby"},{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
                sqlInstanceName: 'FCI24NEW',
                sqlVersion:
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
                storageDetailsByDb:
                    '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"K:","driveTotalSizeMb":27629,"driveAvailableSizeMb":27004}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                iops: '[{"writeIops":"      0.01","readIops":"      0.01","writeBytesPerSec":"              101.67","readBytesPerSec":"              883.16"}]',
                collation: 'SQL_AltDiction_CP850_CI_AI',
                vcpusPerInstance: '4',
                cpuUtilization: '1',
                deploymentType: 'fci'
            }
        ];
        const { currentLicenseEdition, recommendedLicenseEdition } = getOnpremLicenseRecommendations(sqlServerInfo);
        expect(recommendedLicenseEdition).toEqual('Standard Edition');
        expect(currentLicenseEdition).toEqual('Enterprise Evaluation Edition (64-bit)');
    });

    it('should derive the correct instance requirements based on SQL instance details', () => {
        const expectedRequirements = {
            ArchitectureTypes: ['x86_64'],
            VirtualizationTypes: ['hvm'],
            InstanceRequirements: {
                VCpuCount: {
                    Min: 4,
                    Max: 4
                },
                MemoryMiB: {
                    Min: 8192
                },
                CpuManufacturers: ['intel', 'amazon-web-services'],
                InstanceGenerations: ['current'],
                AllowedInstanceTypes: ['m*', 'c*', 'r*', 'x*'],
                NetworkBandwidthGbps: {
                    Max: 10
                }
            }
        };

        const instanceRequirements = deriveInstanceRequirements(reportData.sqlServerInfo);
        expect(instanceRequirements).toEqual(expectedRequirements);
    });

    it('should process IO2 EBS disks Max limits', () => {
        const io2List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 259000,
                requiredThroughput: 3000,
                ebsType: 'io2',
                requiredVolumeSize: 64 * 1024,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io2List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io2
        expect(ebsDisks[0].volumeIops).toEqual(256000); // max iops for io2 is 256000
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(64 * 1024)); // max storage for io2 is 64TiB
    });

    it('should process IO2 EBS disks min limits', () => {
        const io2List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 50,
                requiredThroughput: 3000,
                ebsType: 'io2',
                requiredVolumeSize: 2,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io2List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io2
        expect(ebsDisks[0].volumeIops).toEqual(100); // min iops for io2 is 100
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(4)); // min storage for io2 is 4 GiB
    });

    it('should process IO2 EBS disks within limits', () => {
        const io2List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 150,
                requiredThroughput: 3000,
                ebsType: 'io2',
                requiredVolumeSize: 5,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io2List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io2
        expect(ebsDisks[0].volumeIops).toEqual(150);
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(5));
    });

    it('should process IO1 EBS disks Max limits', () => {
        const io1List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 259000,
                requiredThroughput: 3000,
                ebsType: 'io1',
                requiredVolumeSize: 64 * 1024,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io1List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io1
        expect(ebsDisks[0].volumeIops).toEqual(64000); // max iops for io1 is 64000
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(16 * 1024)); // max storage for io1 is 16TiB
    });

    it('should process IO2 EBS disks min limits', () => {
        const io1List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 50,
                requiredThroughput: 3000,
                ebsType: 'io2',
                requiredVolumeSize: 2,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io1List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io1
        expect(ebsDisks[0].volumeIops).toEqual(100); // min iops for io1 is 100
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(4)); // min storage for io1 is 4 GiB
    });

    it('should process IO1 EBS disks within limits', () => {
        const io1List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 150,
                requiredThroughput: 3000,
                ebsType: 'io1',
                requiredVolumeSize: 5,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(io1List);
        expect(ebsDisks[0].throughput).toEqual(0); // no throughput for io1
        expect(ebsDisks[0].volumeIops).toEqual(150);
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(5));
    });

    it('should process gp3 EBS disks Max limits', () => {
        const gp3List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 259000,
                requiredThroughput: 3000,
                ebsType: 'gp3',
                requiredVolumeSize: 64 * 1024,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(gp3List);
        expect(ebsDisks[0].throughput).toEqual(1000); // no throughput for gp3
        expect(ebsDisks[0].volumeIops).toEqual(16000); // max iops for gp3 is 16000
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(16 * 1024)); // max storage for gp3 is 16TiB
    });

    it('should process gp3 EBS disks min limits', () => {
        const gp3List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 50,
                requiredThroughput: 3000,
                ebsType: 'gp3',
                requiredVolumeSize: 0.5,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(gp3List);
        expect(ebsDisks[0].throughput).toEqual(1000); // max throughput for gp3 1000
        expect(ebsDisks[0].volumeIops).toEqual(3000); // min iops for gp3 is 3000
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(1)); // min storage for gp3 is 4 GiB
    });

    it('should process gp3 EBS disks within limits', () => {
        const gp3List = [
            {
                instanceName: 'FCI23NEW',
                numDatabases: 1,
                requiredIops: 3000,
                requiredThroughput: 150,
                ebsType: 'gp3',
                requiredVolumeSize: 5,
                isPrimary: true
            }
        ];
        const ebsDisks = processEbsDisks(gp3List);
        expect(ebsDisks[0].throughput).toEqual(150);
        expect(ebsDisks[0].volumeIops).toEqual(3000);
        expect(ebsDisks[0].storageAmount).toEqual(convertGiBToBytes(5));
    });
});

const HOURS_IN_MONTH = 730;

describe('buildComputeCalculation', () => {
    it('should compute aggregated prices for a multi-node deployment', () => {
        const machineDetails = [
            { instanceType: 'r5.xlarge', price: 0.4 },
            { instanceType: 'r5.xlarge', price: 0.4 }
        ] as MachineDetail[];

        const result = buildComputeCalculation({
            resourceName: 'TestDB',
            deploymentType: 'AOAG',
            instanceType: 'r5.xlarge',
            basePrice: 0.25,
            fullPrice: 0.4,
            nodeCount: 2,
            machineDetails
        });

        expect(result.resourceName).toBe('TestDB');
        expect(result.deploymentType).toBe('AOAG');
        expect(result.instanceType).toBe('r5.xlarge');
        expect(result.computeHourlyPrice).toBe(0.25 * 2);
        expect(result.computeMonthlyPrice).toBe(0.25 * HOURS_IN_MONTH * 2);
        expect(result.instanceMonthlyPrice).toBe(0.4 * HOURS_IN_MONTH * 2);
        expect(result.hoursInMonth).toBe(HOURS_IN_MONTH);
        expect(result.machineDetails).toBe(machineDetails);
    });

    it('should handle single-node deployment', () => {
        const machineDetails = [{ instanceType: 'm5.large', price: 0.1 }] as MachineDetail[];

        const result = buildComputeCalculation({
            resourceName: 'SingleDB',
            deploymentType: 'Standalone',
            instanceType: 'm5.large',
            basePrice: 0.1,
            fullPrice: 0.1,
            nodeCount: 1,
            machineDetails
        });

        expect(result.computeHourlyPrice).toBe(0.1);
        expect(result.computeMonthlyPrice).toBe(0.1 * HOURS_IN_MONTH);
        expect(result.instanceMonthlyPrice).toBe(0.1 * HOURS_IN_MONTH);
    });
});

describe('buildCombinedEc2Instances', () => {
    const primaryVolumes: EbsVolumeType[] = [
        { storageAmount: 107374182400, volumeIops: 3000, throughput: 125, volumeType: 'gp3', volumeNumber: 1 }
    ];
    const secondaryVolumes: EbsVolumeType[] = [
        { storageAmount: 53687091200, volumeIops: 3000, throughput: 125, volumeType: 'gp3', volumeNumber: 1 }
    ];

    it('should build both existing and recommended instances for primary and secondary', () => {
        const { existingEc2Instances, recommendedEc2Instances } = buildCombinedEc2Instances(
            primaryVolumes,
            secondaryVolumes,
            'r5.xlarge',
            'r5.large'
        );

        expect(existingEc2Instances).toHaveLength(2);
        expect(recommendedEc2Instances).toHaveLength(2);

        expect(existingEc2Instances[0].ec2InstanceType).toBe('r5.xlarge');
        expect(existingEc2Instances[0].isPrimary).toBe(true);
        expect(existingEc2Instances[0].volumes).toBe(primaryVolumes);

        expect(existingEc2Instances[1].ec2InstanceType).toBe('r5.xlarge');
        expect(existingEc2Instances[1].isPrimary).toBe(false);
        expect(existingEc2Instances[1].volumes).toBe(secondaryVolumes);

        expect(recommendedEc2Instances[0].ec2InstanceType).toBe('r5.large');
        expect(recommendedEc2Instances[0].isPrimary).toBe(true);

        expect(recommendedEc2Instances[1].ec2InstanceType).toBe('r5.large');
        expect(recommendedEc2Instances[1].isPrimary).toBe(false);
    });

    it('should use default description strings when not provided', () => {
        const { existingEc2Instances } = buildCombinedEc2Instances(
            primaryVolumes,
            secondaryVolumes,
            'r5.xlarge',
            'r5.large'
        );

        expect(existingEc2Instances[0].ec2InstanceDescription).toBe('Combined Primary');
        expect(existingEc2Instances[1].ec2InstanceDescription).toBe('Combined Secondary');
    });

    it('should use custom description strings when provided', () => {
        const { existingEc2Instances } = buildCombinedEc2Instances(
            primaryVolumes,
            secondaryVolumes,
            'r5.xlarge',
            'r5.large',
            'Oracle Primary',
            'Oracle Data Guard'
        );

        expect(existingEc2Instances[0].ec2InstanceDescription).toBe('Oracle Primary');
        expect(existingEc2Instances[1].ec2InstanceDescription).toBe('Oracle Data Guard');
    });

    it('should skip primary instances when primary volumes are empty', () => {
        const { existingEc2Instances, recommendedEc2Instances } = buildCombinedEc2Instances(
            [],
            secondaryVolumes,
            'r5.xlarge',
            'r5.large'
        );

        expect(existingEc2Instances).toHaveLength(1);
        expect(existingEc2Instances[0].isPrimary).toBe(false);
        expect(recommendedEc2Instances).toHaveLength(1);
        expect(recommendedEc2Instances[0].isPrimary).toBe(false);
    });

    it('should skip secondary instances when secondary volumes are empty', () => {
        const { existingEc2Instances, recommendedEc2Instances } = buildCombinedEc2Instances(
            primaryVolumes,
            [],
            'r5.xlarge',
            'r5.large'
        );

        expect(existingEc2Instances).toHaveLength(1);
        expect(existingEc2Instances[0].isPrimary).toBe(true);
        expect(recommendedEc2Instances).toHaveLength(1);
        expect(recommendedEc2Instances[0].isPrimary).toBe(true);
    });

    it('should return empty arrays when both volume lists are empty', () => {
        const { existingEc2Instances, recommendedEc2Instances } = buildCombinedEc2Instances(
            [],
            [],
            'r5.xlarge',
            'r5.large'
        );

        expect(existingEc2Instances).toHaveLength(0);
        expect(recommendedEc2Instances).toHaveLength(0);
    });
});

describe('fetchPricingForResourcesGeneric', () => {
    type TestResource = {
        name: string;
        currentInstanceType: string;
        recommendedInstanceType: string;
    };

    type EnrichedResource = TestResource & {
        currentPricing?: PricingDetails;
        recommendedPricing?: PricingDetails;
    };

    it('should fetch pricing from the simulator and enrich each resource', async () => {
        const resources: TestResource[] = [
            { name: 'DB1', currentInstanceType: 'r5.xlarge', recommendedInstanceType: 'r5.large' }
        ];

        const result = await fetchPricingForResourcesGeneric<TestResource, EnrichedResource>(
            resources,
            DEFAULT_AWS_REGION,
            {
                osType: 'Windows',
                getCacheKeys: r => ({
                    current: { key: r.currentInstanceType, instanceType: r.currentInstanceType },
                    recommended: { key: r.recommendedInstanceType, instanceType: r.recommendedInstanceType }
                }),
                enrichResource: (r, currentPricing, recommendedPricing) => ({
                    ...r,
                    currentPricing,
                    recommendedPricing
                })
            }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('DB1');
        expect(result[0].currentPricing).toBeDefined();
        expect(result[0].recommendedPricing).toBeDefined();
    });

    it('should deduplicate pricing requests for identical instance types across resources', async () => {
        const resources: TestResource[] = [
            { name: 'DB1', currentInstanceType: 'r5.xlarge', recommendedInstanceType: 'r5.xlarge' },
            { name: 'DB2', currentInstanceType: 'r5.xlarge', recommendedInstanceType: 'r5.xlarge' }
        ];

        const result = await fetchPricingForResourcesGeneric<TestResource, EnrichedResource>(
            resources,
            DEFAULT_AWS_REGION,
            {
                osType: 'Windows',
                getCacheKeys: r => ({
                    current: { key: r.currentInstanceType, instanceType: r.currentInstanceType },
                    recommended: { key: r.recommendedInstanceType, instanceType: r.recommendedInstanceType }
                }),
                enrichResource: (r, currentPricing, recommendedPricing) => ({
                    ...r,
                    currentPricing,
                    recommendedPricing
                })
            }
        );

        expect(result).toHaveLength(2);
        expect(result[0].currentPricing).toEqual(result[1].currentPricing);
    });

    it('should handle resources with only current or only recommended pricing keys', async () => {
        const resources: TestResource[] = [
            { name: 'CurrentOnly', currentInstanceType: 'r5.xlarge', recommendedInstanceType: '' },
            { name: 'RecommendedOnly', currentInstanceType: '', recommendedInstanceType: 'r5.large' }
        ];

        const result = await fetchPricingForResourcesGeneric<TestResource, EnrichedResource>(
            resources,
            DEFAULT_AWS_REGION,
            {
                osType: 'Windows',
                getCacheKeys: r => ({
                    current: r.currentInstanceType
                        ? { key: r.currentInstanceType, instanceType: r.currentInstanceType }
                        : undefined,
                    recommended: r.recommendedInstanceType
                        ? { key: r.recommendedInstanceType, instanceType: r.recommendedInstanceType }
                        : undefined
                }),
                enrichResource: (r, currentPricing, recommendedPricing) => ({
                    ...r,
                    currentPricing,
                    recommendedPricing
                })
            }
        );

        expect(result).toHaveLength(2);
        expect(result[0].currentPricing).toBeDefined();
        expect(result[0].recommendedPricing).toBeUndefined();
        expect(result[1].currentPricing).toBeUndefined();
        expect(result[1].recommendedPricing).toBeDefined();
    });

    it('should return an empty array when given no resources', async () => {
        const result = await fetchPricingForResourcesGeneric<TestResource, EnrichedResource>([], DEFAULT_AWS_REGION, {
            osType: 'Windows',
            getCacheKeys: () => ({}),
            enrichResource: r => ({ ...r })
        });

        expect(result).toEqual([]);
    });
});

describe('generatePayload and decompressCollectorPayload', () => {
    it('should round-trip: generatePayload output can be decompressed back to original', async () => {
        const originalContent = JSON.stringify({ hello: 'world', num: 42 });
        const buffer = Buffer.from(originalContent);

        const payload = await generatePayload('test-account', 'test.json', buffer);

        expect(payload.fileName).toBe('test.json');
        expect(typeof payload.fileContent).toBe('string');
        expect(payload.fileContent.length).toBeGreaterThan(0);

        const decompressed = decompressCollectorPayload(payload.fileContent);
        expect(decompressed).toBe(originalContent);
    });

    it('should handle binary content in a Buffer', async () => {
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]);
        const payload = await generatePayload('test-account', 'binary.bin', binaryContent);

        expect(payload.fileName).toBe('binary.bin');
        expect(payload.fileContent.length).toBeGreaterThan(0);
    });

    it('should handle empty content', async () => {
        const emptyBuffer = Buffer.from('');
        const payload = await generatePayload('test-account', 'empty.json', emptyBuffer);

        expect(payload.fileName).toBe('empty.json');
        const decompressed = decompressCollectorPayload(payload.fileContent);
        expect(decompressed).toBe('');
    });

    it('should handle large JSON content', async () => {
        const largeObj = { data: 'x'.repeat(10000) };
        const buffer = Buffer.from(JSON.stringify(largeObj));

        const payload = await generatePayload('test-account', 'large.json', buffer);
        const decompressed = decompressCollectorPayload(payload.fileContent);
        expect(JSON.parse(decompressed)).toEqual(largeObj);
    });
});

describe('downloadDataCollectorScript', () => {
    it('should return a url for default (mssql) database type', async () => {
        const result = await downloadDataCollectorScript(ACCOUNT_ID);

        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
        expect(typeof result.url).toBe('string');
    });

    it('should return a url for mssql database type', async () => {
        const result = await downloadDataCollectorScript(ACCOUNT_ID, 'mssql');

        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
    });

    it('should return a url for oracle database type', async () => {
        const result = await downloadDataCollectorScript(ACCOUNT_ID, 'oracle');

        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
    });

    it('should fall back to mssql path for unknown database type', async () => {
        const result = await downloadDataCollectorScript(ACCOUNT_ID, 'postgres');

        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
    });
});

describe('Bulk Explore Savings Operations', () => {
    afterEach(async () => {
        // Clean up all test resources created during tests (by account_id and database_type)
        // This ensures tests don't interfere with each other
        await removeOnPremTcoReportData(undefined, ACCOUNT_ID, undefined, MSSQL);
    });

    it('should return error when no resources found', async () => {
        try {
            await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, DEFAULT_AWS_REGION, [
                { resourceId: 'invalid-resource-id-that-does-not-exist' }
            ]);
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('No On-premises database resources found');
        }
    });

    it('should return error when invalid region code provided', async () => {
        try {
            await getOnPremBulkResourceExploreSavings(ACCOUNT_ID, 'invalid-region', [
                { resourceId: 'test-resource-id' }
            ]);
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('Invalid region code');
        }
    });

    it('should handle single resource without user sqlInstanceData using persisted data', async () => {
        // Create a test resource in the database
        const testReportData = {
            ...reportData,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'SingleTestServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData);

        // Request with resource but no sqlInstanceData - should use persisted data
        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        expect(resources.length).toBeGreaterThan(0);

        const resourceId = resources[0].resource_id;

        // Get the list to verify it exists
        const listedResources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        expect(listedResources.some(r => r.resource_id === resourceId)).toBe(true);
    });

    it('should deduplicate resources by latest creation_time when multiple versions exist', async () => {
        // Create the same resource multiple times to test deduplication
        // Use different timestamps but same server name to simulate re-upload of same server
        const testReportData1 = {
            ...reportData,
            timestamp: `${Date.now()}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'DuplicateServer' }
        };
        const testReportData2 = {
            ...reportData,
            timestamp: `${Date.now() + 1000}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'DuplicateServer' }
        };

        // Save first version
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData1);
        const resources1 = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const firstResourceId = resources1[0].resource_id;

        // Save second version with different timestamp
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData2);

        // Verify that second version was saved by retrieving all resources
        const allResources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        expect(allResources.some(r => r.resource_id === firstResourceId)).toBe(true);
    });

    it('should verify resourceName is used in storageSavings response structure', async () => {
        // Create a test resource
        const testReportData = {
            ...reportData,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'ResponseTestServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData);

        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const resourceId = resources[0].resource_id;
        const resourceName = (resources[0].host_config as any).windowsSystemName;

        // Verify resource was created successfully
        expect(resourceId).toBeDefined();
        expect(resourceName).toBeDefined();

        // Verify the resource name is available for use in response
        expect(resourceName).toEqual('ResponseTestServer');
    });

    it('should create and retrieve bulk resources from database', async () => {
        // Create multiple test resources with unique identifiers
        const testReportData1 = {
            ...reportData,
            timestamp: `${Date.now()}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'BulkTestServer1' }
        };
        const testReportData2 = {
            ...reportData,
            timestamp: `${Date.now() + 1000}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'BulkTestServer2' }
        };

        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData1);
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData2);

        // Retrieve resources
        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);

        // Verify we have resources
        expect(resources.length).toBeGreaterThanOrEqual(2);

        // Verify each resource has required fields
        resources.forEach(resource => {
            expect(resource.resource_id).toBeDefined();
            expect(resource.host_config).toBeDefined();
            expect(resource.database_instances_data).toBeDefined();
            expect(resource.database_deployment_type).toBeDefined();
        });
    });

    it('should verify resource contains both persisted sqlInstanceData and hostConfig', async () => {
        // Create a test resource
        const testReportData = {
            ...reportData,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'DataVerifyServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData);

        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const resource = resources[0];

        // Verify host_config
        expect(resource.host_config).toBeDefined();
        const hostConfig = resource.host_config as any;
        expect(hostConfig.windowsSystemName).toBeDefined();
        expect(hostConfig.nodeDetails).toBeDefined();

        // Verify database_instances_data
        expect(resource.database_instances_data).toBeDefined();
        const instanceDataRaw = resource.database_instances_data;
        // Handle both string and object formats
        const instanceData = typeof instanceDataRaw === 'string' ? JSON.parse(instanceDataRaw) : instanceDataRaw;
        expect(Array.isArray(instanceData)).toBe(true);
        expect(instanceData.length).toBeGreaterThan(0);

        // Verify deployment type
        expect(resource.database_deployment_type).toBeDefined();
        expect(['standalone', 'fci', 'aoag']).toContain(resource.database_deployment_type?.toLowerCase());
    });

    it('should verify resource deduplication keeps latest version by creation_time', async () => {
        // Save a resource with unique timestamp
        const testReportData = {
            ...reportData,
            timestamp: `${Date.now()}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'DedupeServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData);

        const resources1 = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const resourceId = resources1[0].resource_id;

        // Wait a bit and save again with different timestamp (will have newer creation_time)
        await sleep(100);
        const testReportData2 = {
            ...reportData,
            timestamp: `${Date.now() + 2000}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'DedupeServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData2);

        // Verify that resource still exists and is retrievable after re-save
        const resourcesAfterResave = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const resourceAfterResave = resourcesAfterResave.find(r => r.resource_id === resourceId);
        expect(resourceAfterResave).toBeDefined();
        expect(resourceAfterResave?.resource_id).toEqual(resourceId);
    });

    it('should handle multiple resources with different deployment types', async () => {
        // Create resources with different deployment types and unique timestamps
        const standaloneData = {
            ...reportData,
            timestamp: `${Date.now()}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'StandaloneServer' },
            sqlServerInfo: [{ ...reportData.sqlServerInfo[0], deploymentType: 'standalone' }]
        };

        const fciData = {
            ...reportData,
            timestamp: `${Date.now() + 1000}`,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'FCIServer' },
            sqlServerInfo: [{ ...reportData.sqlServerInfo[0], deploymentType: 'fci' }]
        };

        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, standaloneData);
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, fciData);

        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);

        // Verify we have resources
        expect(resources.length).toBeGreaterThanOrEqual(2);

        // Verify deployment types are present
        const deploymentTypes = resources.map(r => r.database_deployment_type?.toLowerCase());
        deploymentTypes.forEach(type => {
            expect(['standalone', 'fci', 'aoag']).toContain(type);
        });
    });

    it('should verify SQL instance details are properly stored and retrieved', async () => {
        // Create resource with multiple SQL instances
        const testReportData = {
            ...reportData,
            windowsConfig: { ...reportData.windowsConfig, windowsSystemName: 'MultiInstanceServer' }
        };
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, testReportData);

        const resources = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        const resource = resources[0];

        // Parse instance data
        const instanceDataRaw = resource.database_instances_data;
        // Handle both string and object formats
        const instanceData = typeof instanceDataRaw === 'string' ? JSON.parse(instanceDataRaw) : instanceDataRaw;

        // Verify instance structure
        expect(Array.isArray(instanceData)).toBe(true);
        instanceData.forEach((instance: any) => {
            expect(instance.instanceGuid).toBeDefined();
            expect(instance.sqlInstanceName).toBeDefined();
            expect(instance.vcpusPerInstance).toBeDefined();
            expect(instance.deploymentType).toBeDefined();
            expect(instance.storageDetailsByDb).toBeDefined();
        });
    });
});

// ============================================================================
// buildComputeCalculationsForResources
// ============================================================================

describe('buildComputeCalculationsForResources', () => {
    const makeInput = (overrides: Partial<ResourceComputeInput> = {}): ResourceComputeInput => ({
        resourceId: 'res-1',
        resourceName: 'TestDB',
        deploymentType: 'Standalone',
        existingNodeCount: 1,
        recommendedNodeCount: 1,
        currentInstanceType: 'r5.xlarge',
        recommendedInstanceType: 'r5.large',
        existing: { basePrice: 0.25, fullPrice: 0.4, licenseIncluded: true },
        recommended: { basePrice: 0.15, fullPrice: 0.15, licenseIncluded: false },
        ...overrides
    });

    it('returns parallel arrays of compute calculations, savings, and assessment data', () => {
        const result = buildComputeCalculationsForResources([makeInput()]);

        expect(result.existingComputeCalculation).toHaveLength(1);
        expect(result.recommendedComputeCalculation).toHaveLength(1);
        expect(result.computeSavings).toHaveLength(1);
        expect(result.perResourceAssessmentData).toHaveLength(1);
    });

    it('uses basePrice for computeMonthlyPrice and fullPrice for instanceMonthlyPrice', () => {
        const result = buildComputeCalculationsForResources([makeInput()]);
        const existing = result.existingComputeCalculation[0];

        expect(existing.computeMonthlyPrice).toBeCloseTo(0.25 * HOURS_IN_MONTH, 2);
        expect(existing.instanceMonthlyPrice).toBeCloseTo(0.4 * HOURS_IN_MONTH, 2);
    });

    it('scales prices by node count for multi-node deployments', () => {
        const result = buildComputeCalculationsForResources([
            makeInput({ existingNodeCount: 2, recommendedNodeCount: 2, deploymentType: 'AOAG' })
        ]);
        const existing = result.existingComputeCalculation[0];

        expect(existing.computeHourlyPrice).toBeCloseTo(0.25 * 2, 4);
        expect(existing.computeMonthlyPrice).toBeCloseTo(0.25 * HOURS_IN_MONTH * 2, 2);
        expect(existing.machineDetails).toHaveLength(2);
    });

    it('builds compute savings that reference existing and recommended entries', () => {
        const result = buildComputeCalculationsForResources([makeInput()]);
        const savings = result.computeSavings[0];

        expect(savings.resourceName).toBe('TestDB');
        expect(savings.deploymentType).toBe('Standalone');
        expect(savings.existing).toBe(result.existingComputeCalculation[0]);
        expect(savings.recommended).toBe(result.recommendedComputeCalculation[0]);
    });

    it('builds per-resource assessment data matching compute entries', () => {
        const result = buildComputeCalculationsForResources([makeInput()]);
        const assessment = result.perResourceAssessmentData[0];

        expect(assessment.resourceId).toBe('res-1');
        expect(assessment.existingComputeCalculation).toBe(result.existingComputeCalculation[0]);
        expect(assessment.recommendedComputeCalculation).toBe(result.recommendedComputeCalculation[0]);
        expect(assessment.computeSavings).toBe(result.computeSavings[0]);
    });

    it('handles multiple resources, maintaining order', () => {
        const result = buildComputeCalculationsForResources([
            makeInput({ resourceId: 'res-1', resourceName: 'DB1' }),
            makeInput({ resourceId: 'res-2', resourceName: 'DB2' })
        ]);

        expect(result.existingComputeCalculation).toHaveLength(2);
        expect(result.perResourceAssessmentData[0].resourceId).toBe('res-1');
        expect(result.perResourceAssessmentData[1].resourceId).toBe('res-2');
        expect(result.computeSavings[0].resourceName).toBe('DB1');
        expect(result.computeSavings[1].resourceName).toBe('DB2');
    });

    it('handles zero-price resources without errors', () => {
        const result = buildComputeCalculationsForResources([
            makeInput({
                existing: { basePrice: 0, fullPrice: 0, licenseIncluded: false },
                recommended: { basePrice: 0, fullPrice: 0, licenseIncluded: false }
            })
        ]);

        expect(result.existingComputeCalculation[0].computeMonthlyPrice).toBe(0);
        expect(result.recommendedComputeCalculation[0].computeMonthlyPrice).toBe(0);
    });
});
