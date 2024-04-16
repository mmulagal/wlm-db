import randomize from 'randomatic';
import { isEmpty } from 'lodash-es';
import { randomUUID } from 'crypto';
import { USER_TOKEN } from '../consts';
import getLogger from '../logger';
import { saveFciConfigurationData, saveStandaloneConfigurationData } from './demoMockdata';
import { createDeploymentMockDataInDB } from '../../operations/demo-operations';
import { createAwsCredential } from '../../lib/cloud-manager/credentials';
import { listConfig } from '../../lib/database/db';
import { saveConfig } from '../../operations/database/database-operations';
import { getAsyncLocalStorageResource } from '../async-local-storage';
import { listJobs } from '../../lib/database/job';
import { inventoryDemoData } from './demoInventoryData';

const logger = getLogger();

function createDemoResources(
    accountId: string,
    region: string,
    credentialsId: string,
    awsAccountId: string,
    demoServerName?: string
) {
    logger.info('Creating demo database resources and corresponding details.');
    const stackName = randomize('A', 10);
    const stackId = randomize('A0', 10);
    const sqlDeploymentMode = 'FCI';
    const fsxFilSystemId = `fs-${randomize('a0', 10)}`;
    const serverName = demoServerName || `sqldatabase${randomize('a', 4)}`;

    createDeploymentMockDataInDB(
        accountId!,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        fsxFilSystemId,
        awsAccountId,
        serverName
    );
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
}

async function creadteDemoDBData(accountId: string, credentialsList: any) {
    logger.info('Checking for default demo resources');
    const matchingCredentials = credentialsList?.find(
        (item: { name: string }) => item.name === 'DemoDefaultCredential'
    );
    let credentialsId;
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

    const configs = await listConfig(accountId);

    const jobs = await listJobs(accountId, credentialsId, 'us-east-1');
    if (isEmpty(jobs)) {
        // create 2 new resources and configurations
        logger.info('Creating demo resources');
        createDemoResources(accountId, 'us-east-1', credentialsId, awsAccountId, 'SQLServer-Prod-01');
        createDemoResources(accountId, 'us-east-1', credentialsId, awsAccountId, 'SQLServer-Dev-01');
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
        return {
            count: 1,
            items: [instanceDetails]
        };
    }
    return {
        count: inventoryData.count,
        items: inventoryData.items
    };
}

export { creadteDemoDBData, returnInventorydata };
