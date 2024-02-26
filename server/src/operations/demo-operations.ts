import randomize from 'randomatic';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, STORAGE_TYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CloudProviders, RESOURCESTYPE, DATABASE_TYPE } from '../utils/consts';
import { createJobMockData, generateRandomIP } from '../utils/utils';
// import { handleNotification } from './cloud-manager/notification-operations';
import { createDeployment, createResource } from '../lib/database/db';
import { Metadata } from '../utils/common-types';
import { createJobs } from '../lib/database/job';
import getLogger from '../utils/logger';

const logger = getLogger();

export default async function createDeploymentMockDataInDB(
    accountId: string,
    stackId: string,
    stackName: string,
    region: string,
    credentialsId: string,
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined,
    awsAccountId: string
) {
    logger.info('create deployment, resource and job table mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        fsxFileSystemId
    });

    const cloudProviderId = awsAccountId;
    const resourceName = `sqlnode-${randomize('0', 5)}`;
    if (sqlDeploymentMode.toLowerCase() === 'fci') {
        sqlDeploymentMode = 'FCI';
    } else if (sqlDeploymentMode.toLowerCase() === 'standalone') {
        sqlDeploymentMode = 'Standalone';
    }
    await createDeployment(accountId, {
        deploymentId: stackId,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        credentialsId,
        deploymentStatus: DEPLOYMENT_STATUS.CREATE_COMPLETE,
        startTime: new Date().valueOf(),
        region,
        deploymentName: stackName,
        deploymentModel: sqlDeploymentMode as DEPLOYMENT_MODEL,
        endTime: new Date().valueOf(),
        data: {
            databaseType: DATABASE_TYPE,
            resourceName,
            fileSystemType: STORAGE_TYPE.FSXN
        }
    });
    const metadata: Metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: `i-${randomize('A0', 17)}`,
        creationDate: new Date().getTime().toString(),
        activeDirectoryName: 'wlm.com',
        activeDirectoryAddress: generateRandomIP()
    };

    if (sqlDeploymentMode === 'FCI') {
        metadata.node2InstanceId = `i-${randomize('A0', 17)}`;
        metadata.activeDirectoryAddress = `${generateRandomIP()}, ${generateRandomIP()}`;
    }
    await createResource(accountId, {
        resourceId: randomUUID(),
        credentialsId,
        storageType: STORAGE_TYPE.FSXN,
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.MSSQL,
        coRelationId: `fs-${randomize('A0', 17)}`,
        region,
        metadata
    });

    const data = await createJobMockData(
        accountId,
        resourceName,
        stackName,
        sqlDeploymentMode,
        fsxFileSystemId,
        credentialsId,
        region
    );
    await createJobs(accountId, data);
}
