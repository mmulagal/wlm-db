import randomize from 'randomatic';
import { isEmpty } from 'lodash-es';
import { randomUUID } from 'crypto';
import { DATABASE_TYPE } from '@prisma/client';
import {
    DatabaseTypes,
    DEFAULT_INSTANCE_NAME,
    DEMO_AWS_ACCOUNT_ID,
    RESOURCE_SOURCE,
    STORAGE_PROTOCOLS,
    USER_TOKEN
} from '../consts';
import getLogger from '../logger';
import { decodeBase64FileContent } from '../../operations/offline-assessment-operations';
import {
    listOfflineAssessments,
    bulkUpsertOfflineAssessments,
    OfflineAssessmentRecord
} from '../../lib/database/offline-assessment';
import {
    createAssessmentData,
    saveFciConfigurationData,
    savePGSQLConfigurationData,
    savePGSQLHaConfigurationData,
    saveStandaloneConfigurationData,
    offlineAssessmentStdUploadObject,
    offlineAssessmentFCIUploadObject,
    offlineAssessmentAOAGUploadObject,
    offlineAssessmentOracleNFSUploadObject,
    offlineAssessmentOracleISCSIUploadObject
} from './demoMockdata';
import { parseAssessmentFileContent, generateSqlResourceId } from '../utils';
import {
    createAssessmentJobMockData,
    createDeploymentMockDataInDB,
    createFileSystemForDemo,
    createOperatingSystemOptimizeJobMockData,
    createOptimizeJobMockData,
    createOperatingSystemMpioSessionsOptimizeJobMockData,
    createStorageTierJobMockData,
    createEnableMpioJobMockData,
    createDeploymentMockDataInDBForPgSql,
    prepareDemoSandboxMetadata,
    createDeploymentMockDataInDBForOracle
} from '../../operations/demo-operations';
import { createAwsCredential } from '../../lib/cloud-manager/credentials';
import { listConfig, listResources, updateResource, upsertDatabaseInstance } from '../../lib/database/db';
import { saveConfig } from '../../operations/database/database-operations';
import { getAsyncLocalStorageResource } from '../async-local-storage';
import { createJobs, listJobs } from '../../lib/database/job';
import { discoverDemoDataOracle, inventoryDemoData } from './demoInventoryData';
import { getFSXFileSystemListForDemo } from '../../operations/aws/fsx-operations';
import { instanceDemoData, oracleInstanceDemoData } from './instancesResponse';
import { Metadata } from '../common-types';
import { triggerLogsAnalysis } from '../../operations/logs-analyzer/logs-analyzer-operations';
import { DiscoverOracleResponseBodyType } from '../../routes/types/discover.types';

const logger = getLogger();

function generateDemoResources() {
    return [
        {
            resourceId: randomUUID(),
            hostName: 'SQL-Managed-Host-Prod',
            protocol: STORAGE_PROTOCOLS.ISCSI,
            sqlInstances: [
                { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-MarketingCampaigns' },
                { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-SupplierManagement' },
                { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-ProductCatalog' }
            ],
            databaseType: DatabaseTypes.MS_SQL_SERVER,
            deploymentType: 'Standalone',
            ec2InstanceId: 'i-0c1d2e3f4a5b6c701'
        },
        {
            resourceId: randomUUID(),
            hostName: 'SQL-Managed-Host-DEV',
            protocol: STORAGE_PROTOCOLS.ISCSI,
            sqlInstances: [
                { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-DEVDEV-SalesAnalytics' },
                { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-DEVDEV-ProjectManagement' }
            ],
            databaseType: DatabaseTypes.MS_SQL_SERVER,
            deploymentType: 'FCI',
            ec2InstanceId: 'i-0c1d2e3f4a5b6c702',
            partnerEc2InstanceId: 'i-0c1d2e3f4a5b6c703'
        },
        {
            resourceId: randomUUID(),
            hostName: 'PGSQL-Managed-Host-STG',
            protocol: STORAGE_PROTOCOLS.NFS,
            sqlInstances: [{ sqlInstanceId: randomUUID(), sqlInstanceName: 'pgsqlserver' }],
            databaseType: DatabaseTypes.PG_SQL,
            deploymentType: 'Standalone'
        },
        {
            resourceId: randomUUID(),
            hostName: 'PGSQLServer-Dev-02',
            protocol: STORAGE_PROTOCOLS.NFS,
            sqlInstances: [{ sqlInstanceId: randomUUID(), sqlInstanceName: 'pgsqlserver' }],
            databaseType: DatabaseTypes.PG_SQL,
            deploymentType: 'HA'
        },
        {
            resourceId: randomUUID(),
            hostName: 'ip-171-30-40-16.ap-southeast-1.compute.internal',
            protocol: STORAGE_PROTOCOLS.NFS,
            sqlInstances: [{ sqlInstanceId: randomUUID(), sqlInstanceName: 'oracle-orahost' }],
            databaseType: DatabaseTypes.ORACLE,
            deploymentType: 'Standalone'
        },
        {
            resourceId: randomUUID(),
            hostName: 'prd-sql-crm-ag3',
            protocol: STORAGE_PROTOCOLS.ISCSI,
            sqlInstances: [],
            databaseType: DatabaseTypes.MS_SQL_SERVER,
            deploymentType: 'AOAG',
            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
            partnerEc2InstanceId: 'i-0b2c3d4e5f6a7b8c2'
        },
        {
            resourceId: randomUUID(),
            hostName: 'prd-sql-crm-ag4',
            protocol: STORAGE_PROTOCOLS.ISCSI,
            sqlInstances: [],
            databaseType: DatabaseTypes.MS_SQL_SERVER,
            deploymentType: 'AOAG',
            ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
            partnerEc2InstanceId: 'i-0b2c3d4e5f6a7b8c1'
        }
    ];
}

async function createDemoResources(
    accountId: string,
    region: string,
    credentialsId: string,
    awsAccountId: string,
    serverName: string,
    storageProtocol?: string,
    resourceId?: string,
    databaseType: string = DatabaseTypes.MS_SQL_SERVER,
    deploymentType: string = 'Standalone',
    ec2InstanceId?: string,
    partnerEc2InstanceId?: string
) {
    logger.info('Creating demo database resources and corresponding details.');
    const stackName = randomize('A', 10);
    const stackId = randomize('A0', 10);
    const fsxFilSystemId = `fs-${randomize('0', 8)}`;

    if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
        await createDeploymentMockDataInDB(
            accountId!,
            stackId,
            stackName,
            region,
            credentialsId,
            deploymentType,
            fsxFilSystemId,
            awsAccountId,
            serverName || `sqldatabase${randomize('a', 4)}`,
            true,
            storageProtocol,
            resourceId,
            ec2InstanceId,
            partnerEc2InstanceId
        );
    } else if (databaseType === DatabaseTypes.PG_SQL) {
        await createDeploymentMockDataInDBForPgSql(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            deploymentType,
            fsxFilSystemId,
            awsAccountId,
            serverName || `pgsqldatabase${randomize('a', 4)}`,
            DatabaseTypes.PG_SQL
        );
    } else {
        await createDeploymentMockDataInDBForOracle(
            accountId,
            stackId,
            stackName,
            region,
            credentialsId,
            deploymentType,
            fsxFilSystemId,
            awsAccountId,
            serverName || `oracledatabase${randomize('a', 4)}`
        );
    }
}

async function createConfigurations(accountId: string, awsAccountId: string, credentialsId: string) {
    logger.info('Creating demo default configurations');
    let configName = 'Staging deployment in us-east';
    const stagingData = saveFciConfigurationData('us-east-1', awsAccountId, credentialsId, 'stagingDB', configName);
    saveConfig(accountId, 'SYSTEM', configName, stagingData);

    configName = 'Pre-prod deployment in us-west';
    const preprodData = saveFciConfigurationData('us-west-1', awsAccountId, credentialsId, 'preProdDB', configName);
    saveConfig(accountId, 'SYSTEM', configName, preprodData);

    configName = 'MSSQL 2 nodes FCI deployment in us-east';
    const fciData = saveFciConfigurationData('us-east-1', awsAccountId, credentialsId, 'fciDB', configName);
    saveConfig(accountId, 'SYSTEM', configName, fciData);

    configName = 'MSSQL Single Instance DR system deployment';
    const standaloneData = saveStandaloneConfigurationData(
        'us-east-1',
        awsAccountId,
        credentialsId,
        'standaloneDB',
        configName
    );
    saveConfig(accountId, 'SYSTEM', configName, standaloneData);

    configName = 'PostgreSQL Single Instance deployment';
    const standalonePostgresData = savePGSQLConfigurationData(
        'us-east-1',
        awsAccountId,
        credentialsId,
        'standaloneDB',
        configName
    );
    saveConfig(accountId, 'SYSTEM', configName, standalonePostgresData, 'pgsql');

    configName = 'PostgreSQL HA deployment in us-east';
    const haDeploymentPostgresData = savePGSQLHaConfigurationData(
        'us-east-1',
        awsAccountId,
        credentialsId,
        'haDB',
        configName
    );
    saveConfig(accountId, 'SYSTEM', configName, haDeploymentPostgresData, 'pgsql');
}

async function createDemoResourcesPerRegion(
    accountId: string,
    credentialsId: string,
    region: string,
    awsAccountId: string
) {
    const existingFsxCore = await getFSXFileSystemListForDemo(credentialsId, region, randomize('a0', 10));
    const fileSystemExists = existingFsxCore.some(obj => obj.name === 'fsx-wlmdb-DEFAULT');
    if (!fileSystemExists) {
        const fsxConfiguration = {
            fsxDeploymentMode: 'MULTI_AZ_1',
            fsxFileSystemId: randomUUID(),
            fsxUsername: 'wlmdb-user',
            fsxPassword: randomize('a0', 10),
            databaseSize: 1024,
            ontapSgGroupId: [randomize('a0', 10)],
            fsxVolThroughput: 256,
            fsxIOPS: 10,
            encryptionKey: randomize('a0', 10),
            snapshotPolicy: 'daily_weekretention'
        };
        await createFileSystemForDemo(credentialsId, region, fsxConfiguration, true);

        // Create a second FSx for the DataGuard standby instance
        const standbyFsxConfiguration = {
            fsxDeploymentMode: 'MULTI_AZ_1',
            fsxFileSystemId: randomUUID(),
            fsxUsername: 'wlmdb-user',
            fsxPassword: randomize('a0', 10),
            databaseSize: 1024,
            ontapSgGroupId: [randomize('a0', 10)],
            fsxVolThroughput: 256,
            fsxIOPS: 10,
            encryptionKey: randomize('a0', 10),
            snapshotPolicy: 'daily_weekretention'
        };
        await createFileSystemForDemo(credentialsId, region, standbyFsxConfiguration, false);
    }

    const jobs = await listJobs(accountId, credentialsId, region);
    if (isEmpty(jobs)) {
        // create 3 new resources and configurations
        logger.info('Creating demo resources');
        const mockedHosts = generateDemoResources();
        const resourceSandboxMetadata: any = { sandboxes: [], userDatabase: [] };

        await Promise.all(
            mockedHosts.map(async mockedHost => {
                const { resourceId, hostName, protocol, sqlInstances, databaseType, deploymentType } = mockedHost;
                const ec2InstanceId = 'ec2InstanceId' in mockedHost ? mockedHost.ec2InstanceId : undefined;
                const partnerEc2InstanceId =
                    'partnerEc2InstanceId' in mockedHost ? mockedHost.partnerEc2InstanceId : undefined;
                // create hosts and default instances
                await createDemoResources(
                    accountId,
                    region,
                    credentialsId,
                    awsAccountId,
                    hostName,
                    protocol,
                    resourceId,
                    databaseType,
                    deploymentType,
                    ec2InstanceId as string | undefined,
                    partnerEc2InstanceId as string | undefined
                );
                const instanceNames: string[] = [];
                let instanceIds: string = '';
                await Promise.all(
                    sqlInstances.map(async sqlInstance => {
                        const { sqlInstanceId, sqlInstanceName } = sqlInstance;
                        const dismissedConfigurations = {
                            crr: {
                                configurationName: 'crr',
                                configState: 'POSTPONED',
                                startTime: Date.now(),
                                endTime: Date.now() + 30 * 24 * 60 * 60 * 1000
                            },
                            maxDOP: {
                                configurationName: 'maxdop',
                                configState: 'POSTPONED',
                                startTime: Date.now(),
                                endTime: Date.now() + 30 * 24 * 60 * 60 * 1000
                            }
                        };
                        const databaseConfigurationData = { dismissedConfigurations };
                        // create sandbox metadata for resource and instance
                        let sqlInstanceSandboxMetadata: any = {};
                        if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
                            sqlInstanceSandboxMetadata = prepareDemoSandboxMetadata(
                                hostName,
                                sqlInstanceId,
                                undefined,
                                sqlInstanceName
                            );
                            if (
                                sqlInstanceSandboxMetadata &&
                                sqlInstanceSandboxMetadata?.sandboxes?.length > 0 &&
                                sqlInstanceSandboxMetadata?.userDatabase?.length > 0
                            ) {
                                resourceSandboxMetadata.sandboxes.push(
                                    ...(sqlInstanceSandboxMetadata?.sandboxes ?? [])
                                );
                                resourceSandboxMetadata.userDatabase.push(
                                    ...(sqlInstanceSandboxMetadata?.userDatabase ?? [])
                                );
                            }
                        }

                        // create additional database instance from the "mockedHosts" array
                        await createDatabaseInstances(
                            accountId,
                            resourceId,
                            sqlInstanceName,
                            deploymentType,
                            sqlInstanceId,
                            credentialsId,
                            region,
                            `fs-${randomize('0', 8)}`,
                            protocol,
                            databaseType === DatabaseTypes.MS_SQL_SERVER ? sqlInstanceSandboxMetadata : {},
                            databaseConfigurationData
                        );
                        const newInstanceName = sqlInstanceName.replace(hostName, '');
                        instanceNames.push(newInstanceName);
                        instanceNames.push(DEFAULT_INSTANCE_NAME);
                        instanceIds += `${sqlInstanceId},`;
                    })
                );

                if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
                    const [resource] = await listResources({ accountId, resourceId, includeDatabaseInstances: true });
                    let updateResourcePromise;
                    if (!isEmpty(resource?.metadata)) {
                        (resource.metadata as unknown as Metadata).sandboxes = (
                            (resource?.metadata as unknown as Metadata)?.sandboxes ?? []
                        )?.concat(resourceSandboxMetadata.sandboxes ?? []);
                        (resource.metadata as unknown as Metadata).userDatabase = (
                            (resource?.metadata as unknown as Metadata)?.userDatabase ?? []
                        )?.concat(resourceSandboxMetadata.userDatabase ?? []);
                        updateResourcePromise = updateResource({
                            accountId,
                            credentialsId,
                            region,
                            resourceId,
                            metaData: resource.metadata
                        });
                    }

                    const defaultInstance = resource.database_instances?.find(
                        (i: { is_default: boolean }) => i.is_default
                    );
                    const effectiveInstanceName = instanceNames[0] || DEFAULT_INSTANCE_NAME;
                    const effectiveInstanceId =
                        instanceIds.split(',').filter(Boolean)[0] || defaultInstance?.database_instance_id || '';

                    const optimizeStorageJobMockdata = createOptimizeJobMockData(
                        accountId,
                        hostName,
                        effectiveInstanceName,
                        credentialsId,
                        region,
                        effectiveInstanceId,
                        resourceId
                    );

                    const jobPromiseList = [createJobs(accountId, optimizeStorageJobMockdata)];

                    const operatingSystemOptimizeJobMockData = createOperatingSystemOptimizeJobMockData(
                        accountId,
                        hostName,
                        effectiveInstanceName,
                        credentialsId,
                        region,
                        effectiveInstanceId,
                        resourceId
                    );
                    jobPromiseList.push(createJobs(accountId, operatingSystemOptimizeJobMockData));

                    const operatingSystemMpioSessionsOptimizeJobMockData =
                        createOperatingSystemMpioSessionsOptimizeJobMockData(
                            accountId,
                            hostName,
                            effectiveInstanceName,
                            credentialsId,
                            region,
                            effectiveInstanceId,
                            resourceId
                        );
                    jobPromiseList.push(createJobs(accountId, operatingSystemMpioSessionsOptimizeJobMockData));
                    const storageTierJobMockData = createStorageTierJobMockData(
                        accountId,
                        hostName,
                        effectiveInstanceName,
                        credentialsId,
                        region,
                        effectiveInstanceId,
                        resourceId
                    );
                    jobPromiseList.push(createJobs(accountId, storageTierJobMockData));
                    const enableMpioJobMockData = createEnableMpioJobMockData(
                        accountId,
                        hostName,
                        effectiveInstanceName,
                        credentialsId,
                        region,
                        effectiveInstanceId,
                        resourceId
                    );
                    jobPromiseList.push(createJobs(accountId, enableMpioJobMockData));

                    let logAnalysisJob;
                    if (accountId && !isEmpty(resource.database_instances)) {
                        // Run logs analysis for only the first instance per resource so that dashboard has metrics to show by default; for other instances we still want to trigger the analysis
                        const [firstInstance] = resource.database_instances;
                        logAnalysisJob = triggerLogsAnalysis(
                            accountId,
                            credentialsId,
                            region,
                            resourceId,
                            firstInstance.database_instance_id,
                            {}
                        );
                    }
                    await Promise.all([
                        updateResourcePromise ?? Promise.resolve(),
                        ...jobPromiseList,
                        logAnalysisJob ?? Promise.resolve()
                    ]);
                }
            })
        );

        const filteredInstances = mockedHosts.filter(mockedHost => mockedHost.databaseType !== DatabaseTypes.PG_SQL);
        const assessmentJobMockData = createAssessmentJobMockData(accountId, filteredInstances, credentialsId, region);
        await createJobs(accountId, assessmentJobMockData);

        return { message: 'Default Demo Data created' };
    }
    return { message: 'Default Demo Data exists' };
}

async function creadteDemoDBData(accountId: string, credentialsList: any) {
    logger.info('Checking for default demo resources');

    const matchingCredentials = credentialsList?.find(
        (item: { name: string }) => item.name === 'DemoDefaultCredential'
    );
    let credentialsId: string;

    if (matchingCredentials) {
        logger.info('DemoDefaultCredential credential exists', matchingCredentials.credentialsId);
        credentialsId = matchingCredentials.credentialsId;
    } else {
        logger.info('Creating DemoDefaultCredential credentials');
        const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
        const arn = `arn:aws:iam::${DEMO_AWS_ACCOUNT_ID}:role/demo_role`;
        const externalId = randomUUID();
        const credentialsName = 'DemoDefaultCredential';
        // create a new  credentials and get the credentials ID
        const credentialsDetails: any = await createAwsCredential(
            accountId,
            token,
            arn,
            externalId,
            credentialsName,
            'STANDARD'
        );
        credentialsId = credentialsDetails?.id || credentialsList?.[0]?.credentialsId;
    }
    const configs = await listConfig(accountId);

    if (isEmpty(configs)) {
        logger.info('Creating demo and templates');

        createConfigurations(accountId, DEMO_AWS_ACCOUNT_ID, credentialsId);
    }
}

async function returnInventorydata(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseType: DatabaseTypes,
    instances?: string[]
) {
    logger.info('Generate and return inventory data for demo', instances);
    const fsxId = `fs-${randomize('0', 8)}`;
    const fsxIdStandby = `fs-${randomize('0', 8)}`;
    const ebsVolId = `vol-${randomize('a0', 17)}`;
    const inventoryData =
        databaseType === DatabaseTypes.MS_SQL_SERVER
            ? await inventoryDemoData(fsxId, ebsVolId)
            : ((await discoverDemoDataOracle(
                  accountId,
                  credentialsId,
                  region,
                  fsxId,
                  ebsVolId,
                  fsxIdStandby
              )) as unknown as DiscoverOracleResponseBodyType);

    if (instances !== undefined && instances.length > 0) {
        const { items: inventoryItems } = inventoryData;
        const items = inventoryItems.filter(item => instances.includes(item.ec2InstanceId));
        if (items.length > 0 && items !== undefined) {
            return {
                count: items.length,
                items
            };
        }
        const instanceDetails = inventoryData.items.find(item => item.ec2InstanceId === instances[0])!;
        // for random EC2 instance ID need to send generic value will be updated in phase 2
        if (!instanceDetails) {
            return databaseType === DatabaseTypes.MS_SQL_SERVER
                ? instanceDemoData(fsxId, instances[0])
                : oracleInstanceDemoData(fsxId, instances[0]);
        }
    }
    return {
        count: inventoryData.count,
        items: inventoryData.items
    };
}

async function createDatabaseInstances(
    accountId: string,
    resourceId: string,
    databaseInstanceName: string,
    deploymentType: string,
    databaseInstanceId: string,
    credentialsId: string,
    region: string,
    fsxId: string,
    storageProtocol: string,
    databaseMetadata: any,
    configurations: any
) {
    const instanceRecord = {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseInstanceName,
        fsxnIds: fsxId,
        isDefault: false,
        source: RESOURCE_SOURCE.DEPLOY,
        sqlDeploymentType: deploymentType,
        fsxSvmId: { [fsxId]: `svm-${randomize('A0', 17)}` },
        numberofUserDbsCreated: 1,
        sandboxCreated: true,
        storageProtocol,
        metaData: databaseMetadata,
        databaseType: DatabaseTypes.MS_SQL_SERVER,
        configurations
    };
    try {
        await upsertDatabaseInstance(accountId, instanceRecord);
        await createAssessmentData(
            accountId,
            credentialsId,
            region,
            resourceId,
            databaseInstanceId,
            databaseInstanceName,
            deploymentType
        );
    } catch (error) {
        const errorMsg = `Failed to create Assessment Data for region ${region}, databaseInstanceName ${databaseInstanceName}, error: ${error}`;
        logger.info(errorMsg);
        throw new Error(errorMsg);
    }

    return databaseInstanceId;
}

async function prepopulateOfflineAssessmentData(accountId: string) {
    logger.info('Prepopulating offline assessment data for account.', accountId);
    const offlineAssessments = await listOfflineAssessments({
        accountId,
        databaseType: DATABASE_TYPE.mssql,
        pageSize: 1
    });
    if (offlineAssessments.length === 0) {
        const allRecords = [
            offlineAssessmentFCIUploadObject,
            offlineAssessmentAOAGUploadObject,
            offlineAssessmentStdUploadObject
        ].flatMap(demoFile => {
            const assessmentData = parseAssessmentFileContent(decodeBase64FileContent(demoFile.fileContent)) as any;
            const { metadata, rawdata } = assessmentData;
            const { hostLevelDetails, instanceLevelDetails } = rawdata;
            const { ec2InstanceId } = metadata;

            return Object.entries(instanceLevelDetails).map(([instanceName, instanceData]: [string, any]) => {
                const { instanceDetails, mappedVolumes, assessment } = instanceData;
                const { databaseInstanceId, windowsClusterNodes, deploymentType, baseDeploymentType } = instanceDetails;

                const isFciOrAoagFci =
                    deploymentType === 'FCI' || (deploymentType === 'AOAG' && baseDeploymentType === 'FCI');
                const partnerNode =
                    isFciOrAoagFci && windowsClusterNodes?.length === 2
                        ? windowsClusterNodes.find((n: any) => n.ec2InstanceId && n.ec2InstanceId !== ec2InstanceId)
                        : null;
                const resourceId = partnerNode?.ec2InstanceId
                    ? generateSqlResourceId(ec2InstanceId, partnerNode.ec2InstanceId)
                    : generateSqlResourceId(ec2InstanceId);

                return {
                    accountId,
                    resourceId,
                    databaseInstanceId,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata: {
                        instanceLevelAssessment: assessment || {},
                        rssConfig: hostLevelDetails.rssConfig || {},
                        headroom: hostLevelDetails.headroom || {},
                        hostLevelHighAvailability: hostLevelDetails.highAvailability || {},
                        errors: hostLevelDetails.errors?.[instanceName] || hostLevelDetails.errors || {}
                    },
                    mappedOntapVolumes: mappedVolumes || {},
                    metadata: {
                        ...metadata,
                        ...instanceDetails,
                        databaseInstanceName: instanceName
                    }
                } as OfflineAssessmentRecord;
            });
        });

        await bulkUpsertOfflineAssessments(allRecords);
        logger.info('Successfully prepopulated offline assessment data', {
            accountId,
            recordCount: allRecords.length
        });
    }

    // Prepopulate Oracle data

    const allRecords = [offlineAssessmentOracleISCSIUploadObject, offlineAssessmentOracleNFSUploadObject].flatMap(
        demoFile => {
            const assessmentData = parseAssessmentFileContent(decodeBase64FileContent(demoFile.fileContent)) as any;
            const { metadata, rawdata } = assessmentData;
            const { hostLevelDetails, instanceLevelDetails } = rawdata;
            const { ec2InstanceId } = metadata;

            return Object.entries(instanceLevelDetails).map(([instanceName, instanceData]: [string, any]) => {
                const {
                    instanceDetails,
                    mappedOntapVolumes,
                    storage,
                    os,
                    pluggableDatabases,
                    isDataGuardDeployed,
                    dataguardDetails
                } = instanceData;
                const databaseInstanceId = instanceDetails?.sid || instanceName;
                const resourceId = generateSqlResourceId(ec2InstanceId);

                return {
                    accountId,
                    resourceId,
                    databaseInstanceId,
                    databaseType: DATABASE_TYPE.oracle,
                    rawdata: {
                        instanceLevelAssessment: storage || {},
                        hostLevelDetails: hostLevelDetails || {},
                        os: os || {},
                        errors: rawdata.errors || [],
                        pluggableDatabases: pluggableDatabases || [],
                        isDataGuardDeployed: isDataGuardDeployed || false,
                        dataguardDetails: dataguardDetails || {}
                    },
                    mappedOntapVolumes: mappedOntapVolumes || {},
                    metadata: {
                        ...metadata,
                        ...instanceDetails,
                        databaseInstanceName: instanceName
                    }
                } as OfflineAssessmentRecord;
            });
        }
    );

    await bulkUpsertOfflineAssessments(allRecords);
    logger.info('Successfully prepopulated Oracle offline assessment data', {
        accountId,
        recordCount: allRecords.length
    });
}

export {
    creadteDemoDBData,
    returnInventorydata,
    createConfigurations,
    createDemoResourcesPerRegion,
    prepopulateOfflineAssessmentData
};
