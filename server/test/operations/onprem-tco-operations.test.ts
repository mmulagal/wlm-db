import { listOnPremDatabaseResources } from '../../src/lib/database/onprem-tco';
import {
    getOnpremLicenseRecommendations,
    deriveEbsVolumesListForMarketing,
    deriveHostConfigBasedInstanceType,
    deriveInstanceRequirements,
    deriveSqlUsageBasedInstanceType,
    groupSqlServerInstancesByDeploymentType,
    saveReportInWlmdbDatabase,
    processEbsDisks
} from '../../src/operations/onprem-tco-operations';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, MSSQL } from '../../src/utils/consts';
import { prisma } from '../../src/utils/prisma-utils';
import { convertGiBToBytes } from '../../src/utils/utils';

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
    it('Save report in WLMDB database', async () => {
        await saveReportInWlmdbDatabase(ACCOUNT_ID, MSSQL, reportData);
        const listReports = await listOnPremDatabaseResources(ACCOUNT_ID, MSSQL);
        expect(listReports.length).toEqual(2);
        await prisma.client.onprem_tco_reports.deleteMany({
            where: {
                account_id: ACCOUNT_ID
            }
        });
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
        expect(primaryEbsVolumes?.find(ebsVolume => ebsVolume?.volumeType === 'gp3')?.throughput).toBeDefined();
        expect(primaryEbsVolumes?.find(ebsVolume => ebsVolume?.volumeType === 'gp3')?.volumeIops).toBeDefined();
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
                AllowedInstanceTypes: ['m*', 'c*', 'r*'],
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

    it('should process IO1 EBS disks min limits', () => {
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
