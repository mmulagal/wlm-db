import randomize from 'randomatic';
import { isEmpty } from 'lodash-es';
import { randomUUID } from 'crypto';
import { RESOURCESTYPE, USER_TOKEN } from '../consts';
import getLogger from '../logger';
import { saveFciConfigurationData, saveStandaloneConfigurationData } from './demoMockdata';
import createDeploymentMockDataInDB from '../../operations/demo-operations';
import { createAwsCredential } from '../../lib/cloud-manager/credentials';
import { listResources } from '../../lib/database/db';
import { saveConfig } from '../../operations/database/database-operations';
import { getAsyncLocalStorageResource } from '../async-local-storage';

const logger = getLogger();

function createDemoResources(accountId: string, region: string, credentialsId: string, awsAccountId: string) {
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
        awsAccountId
    );
}

async function createConfigurations(accountId: string, awsAccountId: string) {
    logger.info('Creating demo default configurations');
    const stagingData = saveFciConfigurationData('us-east-1', awsAccountId, 'stagingDB');
    saveConfig(accountId, 'SYSTEM', 'Staging deployment in us-east', stagingData);

    const preprodData = saveFciConfigurationData('us-west-1', awsAccountId, 'preProdDB');
    saveConfig(accountId, 'SYSTEM', 'Pre-prod deployment in us-west', preprodData);

    const fciData = saveFciConfigurationData('us-west-1', awsAccountId, 'fciDB');
    saveConfig(accountId, 'SYSTEM', 'MSSQL 2 nodes FCI deployment in us-east', fciData);

    const standaloneData = saveStandaloneConfigurationData('us-east-1', awsAccountId, 'standaloneDB');
    saveConfig(accountId, 'SYSTEM', 'MSSQL 2 nodes FCI deployment in us-east', standaloneData);
}

async function creadteDemoDBData(accountId: string, credentialsList: any) {
    logger.info('Checking for default demo resources');
    const matchingCredentials = credentialsList.find((item: { name: string }) => item.name === 'DemoDefaultCredential');
    let credentialsId;
    const awsAccountId = randomize('0', 8);
    if (matchingCredentials) {
        credentialsId = matchingCredentials.credentialsId;
    } else {
        const token = getAsyncLocalStorageResource(USER_TOKEN) as string;
        const arn = `arn:aws:iam::${awsAccountId}:role/demo_role`;
        const externalId = randomUUID();
        const credentialsName = 'DemoDefaultCredential';
        // create a new  credentials and get the credentials ID
        const credentialsDetails: any = await createAwsCredential(accountId, token, arn, externalId, credentialsName);
        credentialsId = credentialsDetails.id;
    }
    const mssqlResources = await listResources(accountId, undefined, credentialsId, 'us-east-1', RESOURCESTYPE.MSSQL);

    if (isEmpty(mssqlResources)) {
        // create 2 new resources and configurations
        createDemoResources(accountId, 'us-east-1', credentialsId, awsAccountId);
        createDemoResources(accountId, 'us-east-1', credentialsId, awsAccountId);
        createConfigurations(accountId, awsAccountId);
    }
}

export { creadteDemoDBData };
