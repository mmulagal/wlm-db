import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE } from '@prisma/client';
import {
    createOnPremTcoReportData,
    listOnPremDatabaseResources,
    removeOnPremTcoReportData
} from '../../../src/lib/database/onprem-tco';
import { ACCOUNT_ID, MSSQL } from '../../../src/utils/consts';
import { convertToDate } from '../../../src/utils/onprem-tco-utils';
import { prisma } from '../../../src/utils/prisma-utils';

it('should create on-prem database resources', async () => {
    const accountId = ACCOUNT_ID;
    const resource = [
        {
            account_id: accountId,
            resource_id: 'test-resource-id',
            database_type: MSSQL as DATABASE_TYPE,
            database_deployment_type: DATABASE_DEPLOYMENT_TYPE.FCI,
            creation_time: convertToDate('20250115031936'),
            version: '1.0.0',
            host_config: {
                nodeDetails: [
                    {
                        WLMDBFCI1: {
                            ramSize: 8,
                            osEdition: 'Microsoft Windows Server 2022 Standard'
                        }
                    },
                    {
                        WLMDBFCI2: {
                            hostId: 'B1E71E42-B9BC-D5D4-9D4D-D828ED4C31AF',
                            ramSize: 8,
                            osEdition: 'Microsoft Windows Server 2022 Standard'
                        }
                    }
                ],
                belongsToCluster: true,
                clusterNodeNames: ['WLMDBFCI1', 'WLMDBFCI2'],
                windowsClusterName: { Name: 'ONPREMFCI' }
            },
            database_instances_data: [
                {
                    instanceGuid:
                        '{\r\n    "error":  "Error running query \\u0027instanceGuid\\u0027 on instance FCI12"\r\n}',
                    licenceUsageDetails:
                        '{\r\n    "error":  "Error running query \\u0027licenceUsageDetails\\u0027 on instance FCI12"\r\n}',
                    memUtilization:
                        '{\r\n    "error":  "Error running query \\u0027memUtilization\\u0027 on instance FCI12"\r\n}',
                    noOfDatabases:
                        '{\r\n    "error":  "Error running query \\u0027noOfDatabases\\u0027 on instance FCI12"\r\n}',
                    sqlInstanceName: 'MSSQLSERVER',
                    ownerNode: {},
                    sqlVersion:
                        '{\r\n    "error":  "Error running query \\u0027sqlVersion\\u0027 on instance FCI12"\r\n}',
                    storageDetailsByDb:
                        '{\r\n    "error":  "Error running query \\u0027storageDetailsByDb\\u0027 on instance FCI12"\r\n}',
                    sqlEdition:
                        '{\r\n    "error":  "Error running query \\u0027sqlEdition\\u0027 on instance FCI12"\r\n}',
                    iops: '{\r\n    "error":  "Error running query \\u0027iops\\u0027 on instance FCI12"\r\n}',
                    collation:
                        '{\r\n    "error":  "Error running query \\u0027collation\\u0027 on instance FCI12"\r\n}',
                    vcpusPerInstance:
                        '{\r\n    "error":  "Error running query \\u0027vcpusPerInstance\\u0027 on instance FCI12"\r\n}',
                    cpuUtilization:
                        '{\r\n    "error":  "Error running query \\u0027cpuUtilization\\u0027 on instance FCI12"\r\n}',
                    deploymentType: 'standalone'
                },
                {
                    instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD2B2',
                    licenceUsageDetails:
                        '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ',
                    memUtilization: '[{"used":482873344,"total":8588910592,"remaining":8106037248,"percentUsed":5}]',
                    noOfDatabases: '5',
                    ownerNodes:
                        '[{"nodeName":"WLMDBFCI3","nodeRole":"Standby"},{"nodeName":"WLMDBFCI4","nodeRole":"Standby"},{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
                    sqlInstanceName: 'FCI23NEW',
                    sqlVersion: [
                        'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                        '\tOct  8 2022 05:58:25 ',
                        '\tCopyright (C) 2022 Microsoft Corporation',
                        '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
                        ''
                    ],
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
                    instanceGuid: '3',
                    licenceUsageDetails:
                        '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has \u003e 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]                                                                                                                                                                                                                             ',
                    memUtilization: '[{"used":474525696,"total":8588910592,"remaining":8114384896,"percentUsed":5}]',
                    noOfDatabases: '5',
                    ownerNodes:
                        '[{"nodeName":"WLMDBFCI4","nodeRole":"Standby"},{"nodeName":"WLMDBFCI2","nodeRole":"Primary"}]',
                    sqlInstanceName: 'FCI24NEW',
                    sqlVersion: [
                        'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                        '\tOct  8 2022 05:58:25 ',
                        '\tCopyright (C) 2022 Microsoft Corporation',
                        '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 \u003cX64\u003e (Build 20348: ) (Hypervisor)',
                        ''
                    ],
                    storageDetailsByDb:
                        '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"K:","driveTotalSizeMb":27629,"driveAvailableSizeMb":27004}]',
                    sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                    iops: '[{"writeIops":"      0.01","readIops":"      0.01","writeBytesPerSec":"              101.67","readBytesPerSec":"              883.16"}]',
                    collation: 'SQL_AltDiction_CP850_CI_AI',
                    vcpusPerInstance: '4',
                    cpuUtilization: '1',
                    deploymentType: 'fci'
                }
            ]
        }
    ];

    const { count } = await createOnPremTcoReportData(resource);
    expect(count).toEqual(1);
});

it('should list on-prem database resources', async () => {
    const accountId = ACCOUNT_ID;
    const response = await listOnPremDatabaseResources(accountId, MSSQL as DATABASE_TYPE);
    expect(response.length).toBeGreaterThanOrEqual(0);
});

it('should list on-prem database resources', async () => {
    const accountId = ACCOUNT_ID;
    const [response] = await listOnPremDatabaseResources(accountId, MSSQL as DATABASE_TYPE);
    const deleteResponse = await removeOnPremTcoReportData([response.id]);

    expect(deleteResponse.count).toBeGreaterThanOrEqual(0);
});

it('should list on-prem database resources', async () => {
    const accountId = ACCOUNT_ID;

    // Create a sample on-prem TCO report
    await prisma.client.onprem_tco_reports.create({
        data: {
            account_id: accountId,
            resource_id: 'test-resource-id',
            database_type: MSSQL,
            database_deployment_type: 'FCI',
            version: '1.0.0',
            host_config: {
                nodeDetails: [
                    {
                        WLMDBFCI1: {
                            ramSize: 8,
                            osEdition: 'Microsoft Windows Server 2022 Standard'
                        }
                    },
                    {
                        WLMDBFCI2: {
                            hostId: 'B1E71E42-B9BC-D5D4-9D4D-D828ED4C31AF',
                            ramSize: 8,
                            osEdition: 'Microsoft Windows Server 2022 Standard'
                        }
                    }
                ],
                belongsToCluster: true,
                clusterNodeNames: ['WLMDBFCI1', 'WLMDBFCI2'],
                windowsClusterName: { Name: 'ONPREMFCI' }
            }
        }
    });

    const resp = await listOnPremDatabaseResources(accountId, MSSQL);
    expect(resp.length).toBeGreaterThan(0);
    expect(resp[0].account_id).toEqual(accountId);
    expect(resp[0].database_type).toEqual(MSSQL);
    expect(resp[0].database_deployment_type).toEqual('FCI');

    // Clean up
    await prisma.client.onprem_tco_reports.deleteMany({
        where: {
            account_id: accountId
        }
    });
});
