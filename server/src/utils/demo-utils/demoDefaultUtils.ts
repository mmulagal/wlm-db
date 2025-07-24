import randomize from 'randomatic';
import { isEmpty } from 'lodash-es';
import { randomUUID } from 'crypto';
import {
    DatabaseTypes,
    DEFAULT_INSTANCE_NAME,
    DEMO_AWS_ACCOUNT_ID,
    DEMO_DEFAULT_REGION,
    RESOURCE_SOURCE,
    STORAGE_PROTOCOLS,
    USER_TOKEN
} from '../consts';
import getLogger from '../logger';
import {
    saveFciConfigurationData,
    savePGSQLConfigurationData,
    savePGSQLHaConfigurationData,
    saveStandaloneConfigurationData
} from './demoMockdata';
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
    createAssessmentData,
    prepareDemoSandboxMetadata
} from '../../operations/demo-operations';
import { createAwsCredential } from '../../lib/cloud-manager/credentials';
import { listConfig, listResources, updateResource, upsertDatabaseInstance } from '../../lib/database/db';
import { saveConfig } from '../../operations/database/database-operations';
import { getAsyncLocalStorageResource } from '../async-local-storage';
import { createJobs, listJobs } from '../../lib/database/job';
import { inventoryDemoData } from './demoInventoryData';
import { getFSXFileSystemListForDemo } from '../../operations/aws/fsx-operations';
import { instanceDemoData } from './instancesResponse';
import { Metadata } from '../common-types';

const logger = getLogger();

async function createDemoResources(
    accountId: string,
    region: string,
    credentialsId: string,
    awsAccountId: string,
    serverName: string,
    storageProtocol?: string,
    resourceId?: string,
    databaseType: string = DatabaseTypes.MS_SQL_SERVER,
    deploymentType: string = 'Standalone'
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
            resourceId
        );
    } else {
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
    // Workaround added till GROGU-5485 is resolved
    if (region !== 'ap-southeast-5') {
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
            createFileSystemForDemo(credentialsId, region, fsxConfiguration, true);
        }
    }

    const jobs = await listJobs(accountId, credentialsId, region);
    if (isEmpty(jobs)) {
        // create 3 new resources and configurations
        logger.info('Creating demo resources');
        const prodOneResourceId = randomUUID();
        const devFourResourceId = randomUUID();

        const instances = [
            {
                resourceId: prodOneResourceId,
                hostName: 'SQL-Managed-Host-Prod',
                protocol: STORAGE_PROTOCOLS.ISCSI,
                sqlInstances: [
                    { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-MarketingCampaigns' },
                    { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-SupplierManagement' },
                    { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-ProdPROD-ProductCatalog' }
                ],
                databaseType: DatabaseTypes.MS_SQL_SERVER,
                deploymentType: 'Standalone'
            },
            {
                resourceId: devFourResourceId,
                hostName: 'SQL-Managed-Host-DEV',
                protocol: STORAGE_PROTOCOLS.ISCSI,
                sqlInstances: [
                    { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-DEVDEV-SalesAnalytics' },
                    { sqlInstanceId: randomUUID(), sqlInstanceName: 'SQL-Managed-Host-DEVDEV-ProjectManagement' }
                ],
                databaseType: DatabaseTypes.MS_SQL_SERVER,
                deploymentType: 'FCI'
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
            }
        ];
        const resourceSandboxMetadata: any = { sandboxes: [], userDatabase: [] };

        for await (const instance of instances) {
            const { resourceId, hostName, protocol, sqlInstances, databaseType, deploymentType } = instance;
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
                deploymentType
            );
            const instanceNames: string[] = [];
            let instanceIds: string = '';
            for await (const sqlInstance of sqlInstances) {
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
                        resourceSandboxMetadata.sandboxes.push(...(sqlInstanceSandboxMetadata?.sandboxes ?? []));
                        resourceSandboxMetadata.userDatabase.push(...(sqlInstanceSandboxMetadata?.userDatabase ?? []));
                    }
                }

                // create additional database instance from the "instances" array
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
            }

            if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
                const [resource] = await listResources({ accountId, resourceId, includeDatabaseInstances: true });
                if (!isEmpty(resource?.metadata)) {
                    (resource.metadata as unknown as Metadata).sandboxes = (
                        (resource?.metadata as unknown as Metadata)?.sandboxes ?? []
                    )?.concat(resourceSandboxMetadata.sandboxes ?? []);
                    (resource.metadata as unknown as Metadata).userDatabase = (
                        (resource?.metadata as unknown as Metadata)?.userDatabase ?? []
                    )?.concat(resourceSandboxMetadata.userDatabase ?? []);
                    await updateResource({ accountId, credentialsId, region, resourceId, metaData: resource.metadata });
                }

                // create sandbox metadata for instances
                // Update assessment configs
                const optimizeStorageJobMockdata = await createOptimizeJobMockData(
                    accountId,
                    hostName,
                    instanceNames[0],
                    credentialsId,
                    region,
                    instanceIds.split(',')[0],
                    resourceId
                );

                // create assessment and optimization jobs
                await createJobs(accountId, optimizeStorageJobMockdata);

                const operatingSystemOptimizeJobMockData = await createOperatingSystemOptimizeJobMockData(
                    accountId,
                    hostName,
                    instanceNames[0],
                    credentialsId,
                    region,
                    instanceIds.split(',')[0],
                    resourceId
                );
                await createJobs(accountId, operatingSystemOptimizeJobMockData);

                const operatingSystemMpioSessionsOptimizeJobMockData =
                    await createOperatingSystemMpioSessionsOptimizeJobMockData(
                        accountId,
                        hostName,
                        instanceNames[0],
                        credentialsId,
                        region,
                        instanceIds.split(',')[0],
                        resourceId
                    );
                await createJobs(accountId, operatingSystemMpioSessionsOptimizeJobMockData);
                const storageTierJobMockData = await createStorageTierJobMockData(
                    accountId,
                    hostName,
                    instanceNames[0],
                    credentialsId,
                    region,
                    instanceIds.split(',')[0],
                    resourceId
                );
                await createJobs(accountId, storageTierJobMockData);
                const enableMpioJobMockData = await createEnableMpioJobMockData(
                    accountId,
                    hostName,
                    instanceNames[0],
                    credentialsId,
                    region,
                    instanceIds.split(',')[0],
                    resourceId
                );
                await createJobs(accountId, enableMpioJobMockData);
            }
        }
        const filteredInstances = instances.filter(instance => instance.databaseType !== DatabaseTypes.PG_SQL);
        const assessmentJobMockData = await createAssessmentJobMockData(
            accountId,
            filteredInstances,
            credentialsId,
            region
        );
        await createJobs(accountId, assessmentJobMockData);
        return { message: 'Demo Data created' };
    }
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
            'STANDARD',
            true
        );
        credentialsId = credentialsDetails?.id || credentialsList?.[0]?.credentialsId;
    }
    const configs = await listConfig(accountId);

    if (isEmpty(configs)) {
        logger.info('Creating demo and templates');

        createConfigurations(accountId, DEMO_AWS_ACCOUNT_ID, credentialsId);

        createDemoResourcesPerRegion(accountId, credentialsId, DEMO_DEFAULT_REGION, DEMO_AWS_ACCOUNT_ID);
    }
}

async function returnInventorydata(instances?: string[]) {
    logger.info('Generate and return inventory data for demo', instances);
    const fsxId = `fs-${randomize('0', 8)}`;
    const ebsVolId = `vol -${randomize('a0', 17)}`;
    const inventoryData = inventoryDemoData(fsxId, ebsVolId);

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
            return instanceDemoData(fsxId, instances[0]);
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

    return databaseInstanceId;
}

export { creadteDemoDBData, returnInventorydata, createConfigurations, createDemoResourcesPerRegion };
