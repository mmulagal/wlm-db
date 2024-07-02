import randomize from 'randomatic';
import { isEmpty } from 'lodash-es';
import { randomUUID } from 'crypto';
import { DatabaseTypes, RESOURCE_SOURCE, STORAGE_PROTOCOLS, USER_TOKEN } from '../consts';
import getLogger from '../logger';
import { saveFciConfigurationData, saveStandaloneConfigurationData } from './demoMockdata';
import { createDeploymentMockDataInDB, createFileSystemForDemo } from '../../operations/demo-operations';
import { createAwsCredential } from '../../lib/cloud-manager/credentials';
import { listConfig, upsertDatabaseInstance } from '../../lib/database/db';
import { saveConfig } from '../../operations/database/database-operations';
import { getAsyncLocalStorageResource } from '../async-local-storage';
import { listJobs } from '../../lib/database/job';
import { inventoryDemoData } from './demoInventoryData';
import { getFSXFileSystemListForDemo } from '../../operations/aws/fsx-operations';
import { instanceDemoData } from './instancesResponse';

const logger = getLogger();
const demoDefaultRegion = 'us-east-1';

function createDemoResources(
    accountId: string,
    region: string,
    credentialsId: string,
    awsAccountId: string,
    serverName: string,
    storageProtocol?: string,
    resourceId?: string
) {
    logger.info('Creating demo database resources and corresponding details.');
    const stackName = randomize('A', 10);
    const stackId = randomize('A0', 10);
    const sqlDeploymentMode = 'FCI';
    const fsxFilSystemId = `fs-${randomize('a0', 10)}`;

    createDeploymentMockDataInDB(
        accountId!,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        fsxFilSystemId,
        awsAccountId,
        serverName || `sqldatabase${randomize('a', 4)}`,
        true,
        storageProtocol,
        resourceId
    );
}

async function createConfigurations(accountId: string, awsAccountId: string, credentialsId: string) {
    logger.info('Creating demo default configurations');
    let configName = 'Staging deployment in us-east';
    const stagingData = saveFciConfigurationData(
        demoDefaultRegion,
        awsAccountId,
        credentialsId,
        'stagingDB',
        configName
    );
    saveConfig(accountId, 'SYSTEM', configName, stagingData);

    configName = 'Pre-prod deployment in us-west';
    const preprodData = saveFciConfigurationData('us-west-1', awsAccountId, credentialsId, 'preProdDB', configName);
    saveConfig(accountId, 'SYSTEM', configName, preprodData);

    configName = 'MSSQL 2 nodes FCI deployment in us-east';
    const fciData = saveFciConfigurationData(demoDefaultRegion, awsAccountId, credentialsId, 'fciDB', configName);
    saveConfig(accountId, 'SYSTEM', configName, fciData);

    configName = 'MSSQL Single Instance DR system deployment';
    const standaloneData = saveStandaloneConfigurationData(
        demoDefaultRegion,
        awsAccountId,
        credentialsId,
        'standaloneDB',
        configName
    );
    saveConfig(accountId, 'SYSTEM', configName, standaloneData);
}

async function creadteDemoDBData(accountId: string, credentialsList: any) {
    logger.info('Checking for default demo resources');
    const matchingCredentials = credentialsList?.find(
        (item: { name: string }) => item.name === 'DemoDefaultCredential'
    );
    let credentialsId: string;
    const awsAccountId = randomize('0', 12);
    if (matchingCredentials) {
        logger.info('DemoDefaultCredential credential exists', matchingCredentials.credentialsId);
        credentialsId = matchingCredentials.credentialsId;
    } else {
        logger.info('Creating DemoDefaultCredential credentials');
        const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
        const arn = `arn:aws:iam::${awsAccountId}:role/demo_role`;
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
    const existingFsxCore = await getFSXFileSystemListForDemo(credentialsId, demoDefaultRegion, randomize('a0', 10));
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
        createFileSystemForDemo(credentialsId, demoDefaultRegion, fsxConfiguration, true);
    }

    const configs = await listConfig(accountId);

    const jobs = await listJobs(accountId, credentialsId, demoDefaultRegion);
    if (isEmpty(jobs)) {
        // create 3 new resources and configurations
        logger.info('Creating demo resources');
        const prodOneResourceId = randomUUID();
        const devOneResourceId = randomUUID();
        const devFourResourceId = randomUUID();

        const instances = [
            {
                resourceId: prodOneResourceId,
                name: 'SQLServer-Prod-01',
                protocol: STORAGE_PROTOCOLS.ISCSI,
                sqlInstances: ['SQLServer-Prod-01PROD-MarketingCampaigns', 'SQLServer-Prod-01PROD-SupplierManagement']
            },
            {
                resourceId: devOneResourceId,
                name: 'SQLServer-Dev-01',
                protocol: STORAGE_PROTOCOLS.ISCSI,
                sqlInstances: [
                    'SQLServer-Dev-01DEV-FinancialAccounts',
                    'SQLServer-Dev-01DEV-EmployeeDirectory',
                    'SQLServer-Dev-01DEV-InventoryControl',
                    'SQLServer-Prod-01PROD-SupplierManagement'
                ]
            },
            {
                resourceId: devFourResourceId,
                name: 'SQLServer-Dev-04',
                protocol: STORAGE_PROTOCOLS.SMB,
                sqlInstances: ['SQLServer-Dev-04DEV-SalesAnalytics', 'SQLServer-Dev-04DEV-ProjectManagement']
            }
        ];

        instances.forEach(async ({ resourceId, name, protocol, sqlInstances }) => {
            await createDemoResources(
                accountId,
                demoDefaultRegion,
                credentialsId,
                awsAccountId,
                name,
                protocol,
                resourceId
            );

            sqlInstances.forEach(instanceName => {
                createDatabaseInstances(
                    accountId,
                    resourceId,
                    instanceName,
                    credentialsId,
                    demoDefaultRegion,
                    `fs-${randomize('A0', 17)}`,
                    protocol,
                    {}
                );
            });
        });
    }

    if (isEmpty(configs)) {
        logger.info('Creating demo and templates');
        createConfigurations(accountId, awsAccountId, credentialsId);
    }
}

async function returnInventorydata(instances?: string[]) {
    logger.info('Generate and return inventory data for demo', instances);
    const fsxId = `fs-${randomize('a0', 17)}`;
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
    credentialsId: string,
    region: string,
    fsxId: string,
    storageProtocol: string,
    databaseMetadata: any
) {
    const instanceRecord = {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId: randomUUID(),
        databaseInstanceName,
        fsxnIds: fsxId,
        isDefault: false,
        source: RESOURCE_SOURCE.DEPLOY,
        sqlDeploymentType: 'FCI',
        fsxSvmId: { [fsxId]: `svm-${randomize('A0', 17)}` },
        numberofUserDbsCreated: 1,
        sandboxCreated: true,
        storageProtocol,
        metaData: databaseMetadata,
        databaseType: DatabaseTypes.MS_SQL_SERVER
    };

    await upsertDatabaseInstance(accountId, instanceRecord);
}

export { creadteDemoDBData, returnInventorydata };
