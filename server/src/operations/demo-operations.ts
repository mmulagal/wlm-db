import randomize from 'randomatic';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, STORAGE_TYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CloudProviders, RESOURCESTYPE, DATABASE_TYPE, MSSQL_DATABASE_TYPES, ONLINE } from '../utils/consts';
// import { handleNotification } from './cloud-manager/notification-operations';
import { checkAccount, createDeployment, createResource, updateResourceMetaData } from '../lib/database/db';
import { Metadata } from '../utils/common-types';
import { createJobs } from '../lib/database/job';
import { createFSX } from '../lib/cloud-manager/fsx-core';
import getLogger from '../utils/logger';
import {
    masterStackData,
    fsxStackData,
    validationStack1Data,
    sqlFciServerStackData,
    validationStack2Data,
    sqlStandaloneStackData,
    endpointData
} from '../utils/demo-utils/demoMockdata';
import { generateRandomIP } from '../utils/utils';
import { FSXConfigurationType } from '../routes/types/deployment.types';

const logger = getLogger();

async function createJobMockData(
    accountId: string,
    resourceName: string,
    stackName: string,
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined,
    credentialsId: string,
    region: string
) {
    logger.info('Generate mock data for job table', accountId, resourceName, stackName);
    accountId = checkAccount(accountId);
    const masterStackId = randomUUID();
    const serverStackId = randomUUID();
    const fsxStackId = randomUUID();
    const validationStack1Id = randomUUID();
    const validationStack2Id = randomUUID();
    const endpointStackId = randomUUID();

    const data: any[] = [];

    const fsxType = fsxFileSystemId ? 'ExistingFSxStack' : 'NewFSxStack';

    data.push(
        ...masterStackData(accountId, resourceName, stackName, masterStackId, credentialsId, region),
        ...endpointData(accountId, resourceName, endpointStackId, masterStackId, credentialsId, region),
        ...fsxStackData(accountId, resourceName, stackName, fsxStackId, masterStackId, fsxType, credentialsId, region),
        ...validationStack1Data(
            accountId,
            resourceName,
            stackName,
            validationStack1Id,
            masterStackId,
            sqlDeploymentMode,
            credentialsId,
            region
        )
    );
    if (sqlDeploymentMode.toLowerCase() === 'fci') {
        data.push(
            ...sqlFciServerStackData(accountId, resourceName, serverStackId, masterStackId, credentialsId, region),
            ...validationStack2Data(
                accountId,
                resourceName,
                stackName,
                validationStack2Id,
                masterStackId,
                credentialsId,
                region
            )
        );
    } else {
        data.push(
            ...sqlStandaloneStackData(
                accountId,
                resourceName,
                stackName,
                serverStackId,
                masterStackId,
                credentialsId,
                region
            )
        );
    }
    return data;
}

async function createDeploymentMockDataInDB(
    accountId: string,
    stackId: string,
    stackName: string,
    region: string,
    credentialsId: string,
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined,
    awsAccountId: string,
    serverName: string,
    storageProtocol?: string
) {
    logger.info('create deployment, resource and job table mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        fsxFileSystemId,
        serverName
    });

    const cloudProviderId = awsAccountId;
    const resourceName = serverName;
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
        activeDirectoryAddress: generateRandomIP(),
        fsxSvmId: 'svm-0491dd89a76b7ca3d',
        sandboxCreated: true,
        storageProtocol
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

async function createFileSystemForDemo(
    credentialsId: string,
    region: string,
    fsxConfiguration: FSXConfigurationType,
    defaultFsx: boolean
) {
    logger.info('Creating fsx for demo', credentialsId, region, fsxConfiguration);
    const fsxName = defaultFsx ? 'fsx-wlmdb-DEFAULT' : `fsx-wlmdb-${randomize('A', 5)}`;
    const { fsxDeploymentMode } = fsxConfiguration;
    const mode = fsxDeploymentMode.replace(/_\d+$/, '');

    const requestBody = {
        name: fsxName,
        credentialsId,
        region,
        storageCapacity: {
            size: 2,
            unit: 'TiB'
        },
        primarySubnetId: 'subnet-a1', // default subnet for fsx
        ...(mode === 'MULTI_AZ' && { secondarySubnetId: 'subnet-a2' }),
        throughputCapacity: 3072,
        fsxAdminPassword: `${randomize('Aa0', 8)}`, // Since fsx api does not allow the special characters which we allow from our deployment wizard, so randomizing the password all the time
        deploymentType: mode,
        securityGroupIds: [],
        tags: [],
        svmAdminPassword: `${randomize('Aa0', 8)}`,
        generateSecurityGroup: true,
        haPairs: 2,
        automaticBackupRetentionDays: 30,
        routeTableIds: ['rtb-11111111']
    };

    return createFSX(requestBody, true);
}

async function updateUserDBIntoResourceData(
    accountId: string,
    resourceId: string,
    databaseName: string,
    metaData: Metadata
) {
    logger.info('updating user db into resource meta data', accountId, resourceId, databaseName);

    // this is used to retreive the newly created user databases in database list for demo using meta data
    const databaseDetails = {
        name: databaseName,
        size: 16777216,
        type: MSSQL_DATABASE_TYPES.USER,
        status: ONLINE,
        protection: {
            isAwsBackupEnabled: {
                fsxn: false,
                fsxw: false,
                ebs: false
            },
            isFsxOntapSnapshotsEnabled: false,
            isSqlNativeEnabled: false
        }
    };
    metaData.userDatabase = [...(metaData.userDatabase || []), databaseDetails];

    await updateResourceMetaData(accountId, resourceId, metaData);
}

async function updateSandboxDBIntoResourceData(
    accountId: string,
    resourceId: string,
    databaseName: string,
    databaseSource: string,
    createdAt: number,
    updatedAt: number,
    tag: string,
    metaData: Metadata
) {
    logger.info('updating sandbox db into resource meta data', accountId, resourceId, databaseName);

    // this is used to retreive the newly created user databases in database list for demo using meta data
    const sandboxDetails = {
        databaseName,
        createdAt,
        updatedAt,
        source: databaseSource,
        tag
    };
    metaData.sandboxes = [...(metaData.sandboxes || []), sandboxDetails];

    await updateResourceMetaData(accountId, resourceId, metaData);
}

export {
    createFileSystemForDemo,
    createDeploymentMockDataInDB,
    updateUserDBIntoResourceData,
    updateSandboxDBIntoResourceData
};
