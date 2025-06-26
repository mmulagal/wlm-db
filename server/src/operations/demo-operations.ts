import randomize from 'randomatic';
import { Volume } from '@aws-sdk/client-ec2';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, STORAGE_TYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { compact, sample } from 'lodash-es';
import {
    CloudProviders,
    RESOURCESTYPE,
    MSSQL_DATABASE_TYPES,
    ONLINE,
    DEFAULT_INSTANCE_NAME,
    RESOURCE_SOURCE,
    DatabaseTypes,
    SqlServerDeploymentModel,
    DEMO_STANADLONE_SQL_SERVER_ID,
    STORAGE_PROTOCOLS
} from '../utils/consts';
import { checkAccount, createDeployment, createResource, upsertDatabaseInstance } from '../lib/database/db';
import { Metadata, Sandbox, DatabaseInstanceMetadata, ResourceAssessmentData } from '../utils/common-types';
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
    endpointData,
    sandboxJobData,
    assessmentJobData,
    optimizeStorageJobData,
    optimizeOperatingSystemJobData,
    mockPGSqlStandaloneDeploymentStack,
    optimizeMpioSessionsJobData,
    optimizeStorageTierJobData,
    enableMPIOJobData
} from '../utils/demo-utils/demoMockdata';
import { generateRandomIP } from '../utils/utils';
import { FSXConfigurationType } from '../routes/types/deployment.types';
import { SQL_DEFAULT_COLLATION } from '../lib/chatbot/consts';
import { getInstanceListFromStorage, getVolumesListFromStorage } from '../lib/cloud-manager/marketing';
import { describeFSxVolumes } from '../lib/aws/fsx';
import { AssessmentCategories } from '../utils/continous-optimization-consts';
import {
    ASSESMENT_CONFIG_DATA,
    ASSESSMENT_AWS_BACKUP_DATA,
    ASSESSMENT_CLONE_CONFIG_DATA,
    ASSESSMENT_CRR_CONFIG_DATA,
    ASSESSMENT_MAXDOP_CONFIG_DATA,
    MSSQL_ASSESMENT_CONFIG_DATA,
    MSSQL_ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA
} from '../utils/demo-utils/demoInventoryData';
import { createDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { updateInstanceMetadata, updateResourceMetaData } from './database/database-operations';
import {
    mockResourceAssessmentData,
    mockResourceAssessmentDataAllOptimized,
    optimizedResourceName
} from '../utils/demo-utils/hostAssementsData';

const logger = getLogger();
const DemoDefaultDatabaseNames = ['RetailBanking', 'MFGSales'];

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
    createSandbox: boolean = true,
    storageProtocol?: string,
    resourceId?: string
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
    serverName = serverName || `sqldatabase${randomize('a0', 4)}`;

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
            databaseType: 'Microsoft SQL Server',
            resourceName,
            fileSystemType: STORAGE_TYPE.FSXN
        }
    });

    const instanceId = randomUUID();

    resourceId = resourceId || randomUUID();
    const fsxId = `fs-${randomize('0', 8)}`;

    const metadata: Metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: `i-${randomize('A0', 17)}`,
        creationDate: new Date().getTime().toString(),
        activeDirectoryName: 'wlm.com',
        activeDirectoryAddress: generateRandomIP(),
        fsxSvmId: 'svm-0491dd89a76b7ca3d',
        sandboxCreated: true,
        storageProtocol,
        ...(createSandbox && prepareDemoSandboxMetadata(resourceName, instanceId)),
        assessment: optimizedResourceName.includes(resourceName)
            ? (mockResourceAssessmentDataAllOptimized.assessment as unknown as ResourceAssessmentData)
            : (mockResourceAssessmentData.assessment as unknown as ResourceAssessmentData)
    };

    if (sqlDeploymentMode === 'FCI') {
        metadata.node2InstanceId = `i-${randomize('A0', 17)}`;
        metadata.activeDirectoryAddress = `${generateRandomIP()}, ${generateRandomIP()}`;
    }
    await createResource(accountId, {
        resourceId,
        credentialsId,
        storageType: STORAGE_TYPE.FSXN,
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.MSSQL,
        coRelationId: fsxId,
        region,
        metadata
    });

    const instanceRecord = {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId: instanceId,
        databaseInstanceName: DEFAULT_INSTANCE_NAME,
        fsxnIds: fsxId,
        isDefault: true,
        source: RESOURCE_SOURCE.DEPLOY,
        sqlDeploymentType: sqlDeploymentMode,
        fsxSvmId: { [fsxId]: `svm-${randomize('A0', 17)}` },
        numberofUserDbsCreated: 1,
        sandboxCreated: true,
        storageProtocol,
        metaData: prepareDemoSandboxMetadata(resourceName, instanceId),
        databaseType: DatabaseTypes.MS_SQL_SERVER,
        storageType: STORAGE_TYPE.FSXN
    };

    await upsertDatabaseInstance(accountId, instanceRecord);

    await createAssessmentData(accountId, credentialsId, region, resourceId, instanceId, DEFAULT_INSTANCE_NAME);

    const jobData = await createJobMockData(
        accountId,
        resourceName,
        stackName,
        sqlDeploymentMode,
        fsxFileSystemId,
        credentialsId,
        region
    );

    await createJobs(accountId, jobData);

    if (createSandbox) {
        const sandboxJobsData = await createSandboxJobMockData(
            accountId,
            region,
            'RetailBanking',
            'RetailBanking_sandbox',
            credentialsId,
            'SQL-Managed-Host-Prod',
            resourceName
        );
        await createJobs(accountId, sandboxJobsData);
    }
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
        throughputCapacity: 128,
        fsxAdminPassword: `${randomize('Aa0', 8)}`, // Since fsx api does not allow the special characters which we allow from our deployment wizard, so randomizing the password all the time
        deploymentType: mode,
        securityGroupIds: [],
        tags: [],
        svmAdminPassword: `${randomize('Aa0', 8)}`,
        generateSecurityGroup: true,
        haPairs: 1,
        automaticBackupRetentionDays: 30,
        routeTableIds: ['rtb-11111111']
    };

    return createFSX(requestBody, true);
}

async function updateUserDBIntoResourceData(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    databaseName: string,
    metaData: Metadata
) {
    logger.info('updating user db into resource meta data', accountId, resourceId, credentialsId, databaseName);

    const existingDatabases = metaData.userDatabase || [];
    const hasExistingDatabase = existingDatabases.some(db => db.name === databaseName);

    if (!hasExistingDatabase) {
        const databaseDetails = {
            name: databaseName,
            size: 17179869184,
            type: MSSQL_DATABASE_TYPES.USER,
            status: ONLINE,
            protection: {
                isAwsBackupEnabled: {
                    fsxn: false,
                    fsxw: false,
                    ebs: false
                },
                isFsxOntapSnapshotsEnabled: false,
                isSqlNativeEnabled: false,
                isCRREnabled: false,
                isAppConsistentBackupEnabled: false
            },
            collation: SQL_DEFAULT_COLLATION
        };
        metaData.userDatabase = [...existingDatabases, databaseDetails];

        await updateResourceMetaData(accountId, credentialsId, resourceId, metaData);
    }
}

async function updateUserDBIntoInstanceTable(
    accountId: string,
    instanceId: string,
    databaseName: string,
    metaData: DatabaseInstanceMetadata
) {
    logger.info('updating user db into resource meta data', accountId, instanceId, databaseName);

    const existingDatabases = metaData.userDatabase || [];
    const hasExistingDatabase = existingDatabases.some(db => db.name === databaseName);

    if (!hasExistingDatabase) {
        const databaseDetails = {
            name: databaseName,
            size: 17179869184,
            type: MSSQL_DATABASE_TYPES.USER,
            status: ONLINE,
            protection: {
                isAwsBackupEnabled: {
                    fsxn: false,
                    fsxw: false,
                    ebs: false
                },
                isFsxOntapSnapshotsEnabled: false,
                isSqlNativeEnabled: false,
                isCRREnabled: false,
                isAppConsistentBackupEnabled: false
            },
            collation: SQL_DEFAULT_COLLATION
        };
        metaData.userDatabase = [...existingDatabases, databaseDetails];

        await updateInstanceMetadata(accountId, instanceId, metaData);
    }
}

async function updateOptimizedConfigNameInInstanceTable(
    accountId: string,
    instanceId: string,
    configNames: string[],
    configType: string,
    metaData: DatabaseInstanceMetadata
) {
    logger.info(
        'updating optimized config name into instance meta data',
        accountId,
        instanceId,
        configNames,
        configType
    );

    const existingConfigs = metaData.configsOptimized || {};

    existingConfigs[configType] = existingConfigs[configType]
        ? [...existingConfigs[configType], ...configNames]
        : [...configNames];

    // Update metaData.configsOptimized with the modified existingConfigs
    metaData.configsOptimized = existingConfigs;
    await updateInstanceMetadata(accountId, instanceId, metaData);
}

async function updateOptimizedConfigMetaData(
    accountId: string,
    instanceId: string,
    optimizedData: Record<string, any>[], // array of objects with unknown keys/values
    configType: string,
    metaData: DatabaseInstanceMetadata
) {
    logger.info(
        'updating optimized config data into instance meta data',
        accountId,
        instanceId,
        optimizedData,
        configType
    );

    const existingConfigs = metaData.configsOptimized || {};

    existingConfigs[configType] = existingConfigs[configType]
        ? [...existingConfigs[configType], ...optimizedData]
        : [...optimizedData];

    metaData.configsOptimized = existingConfigs;
    await updateInstanceMetadata(accountId, instanceId, metaData);
}

async function updateSandboxDBIntoResourceData(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    sandboxDetails: Sandbox,
    metaData: Metadata
) {
    logger.info('updating sandbox db into resource meta data', accountId, credentialsId, resourceId, sandboxDetails);

    // this is used to retreive the newly created user databases in database list for demo using meta data
    if (metaData.sandboxes) {
        metaData.sandboxes = metaData.sandboxes.filter(sandbox => sandbox.databaseName !== sandboxDetails.databaseName);
    }
    metaData.sandboxes = [...(metaData.sandboxes || []), sandboxDetails];

    await updateResourceMetaData(accountId, credentialsId, resourceId, metaData);
    return metaData;
}

async function updateSandboxDBIntoInstanceData(
    accountId: string,
    instanceID: string,
    sandboxDetails: Sandbox,
    instanceMetaData: DatabaseInstanceMetadata
) {
    logger.info('updating sandbox db into database instance  meta data', accountId, instanceID, sandboxDetails);

    // this is used to retreive the newly created user databases in database list for demo using meta data
    if (instanceMetaData.sandboxes) {
        instanceMetaData.sandboxes = instanceMetaData.sandboxes.filter(
            sandbox => sandbox.databaseName !== sandboxDetails.databaseName
        );
    }
    instanceMetaData.sandboxes = [...(instanceMetaData.sandboxes || []), sandboxDetails];

    await updateInstanceMetadata(accountId, instanceID, instanceMetaData);
    return instanceMetaData;
}

async function createSandboxJobMockData(
    accountId: string,
    region: string,
    srcDb: string,
    destDb: string,
    credentialsId: string,
    srcHost: string,
    targetHost: string
) {
    logger.info('Generate mock data for job table', accountId, region, srcDb, destDb, credentialsId, targetHost);
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();

    return sandboxJobData(accountId, region, srcHost, targetHost, srcDb, destDb, parentJobId, credentialsId);
}

async function getVolumeIdsFromStorage(accountId: string, credentialsId: string, region: string) {
    logger.info('Getting Volume ids from the storage service', { accountId, credentialsId, region });

    let demoInstanceId = '';
    const volumeIds: string[] = [];

    const {
        ec2Instances: [firstInstance]
    } = (await getInstanceListFromStorage(accountId, credentialsId, region)) || {};
    demoInstanceId = firstInstance?.instanceId;
    if (demoInstanceId) {
        const { volumeInstances } =
            (await getVolumesListFromStorage(accountId, credentialsId, region, demoInstanceId)) || {};
        if (volumeInstances && volumeInstances.length > 0) {
            for (const volumeInstance of volumeInstances) {
                volumeIds.push(volumeInstance.volumeId);
            }
        }
        logger.debug(volumeIds);
    }

    return volumeIds;
}

async function getEBSVolumesForDemo(sqlDeploymentType: string, volumeIds: string[], databaseInstanceDetails?: any) {
    let VolumeType = 'gp2';
    let volumeSize = 8;
    let iops = 100;
    // let volumes = [{ volumeType: 'io2', volumeNumber: 2, storageAmount: 1024 * 2, volumeIops: 40000, throughput: 128 }];
    if (sqlDeploymentType === 'AOAG') {
        VolumeType = 'io2';
        volumeSize = 5120;
        iops = 40000;
    } else if (sqlDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
        VolumeType = 'io2';
        volumeSize = 2048;
        iops = 40000;
    }
    const volumes = volumeIds.map((volumeId, index) => {
        let volType = VolumeType; // default VolumeType

        if (
            sqlDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT &&
            databaseInstanceDetails.length &&
            databaseInstanceDetails[0].database_instance_id === DEMO_STANADLONE_SQL_SERVER_ID
        ) {
            // Change VolumeType based on the index
            volType = index % 2 === 0 ? 'io1' : 'io2';
        }

        return {
            VolumeId: volumeId,
            AvailabilityZone: 'us-east-1a',
            Attachments: [
                {
                    AttachTime: '2013-12-18T22:35:00.000Z',
                    InstanceId: 'i-1234567890abcdef0',
                    VolumeId: 'vol-049df61146c4d7901',
                    State: 'attached',
                    DeleteOnTermination: true,
                    Device: '/dev/sda1'
                }
            ],
            Encrypted: true,
            KmsKeyId: 'arn:aws:kms:us-east-2a:123456789012:key/8c5b2c63-b9bc-45a3-a87a-5513eEXAMPLE',
            VolumeType: volType,
            State: 'in-use',
            Iops: iops,
            SnapshotId: 'snap-1234567890abcdef0',
            CreateTime: '2019-12-18T22:35:00.084Z',
            Size: volumeSize,
            Throughput: 128
        } as unknown as Volume;
    });
    return {
        Volumes: volumes
    };
}

async function createAssessmentJobMockData(
    accountId: string,
    instanceDetails: any,
    credentialsId: string,
    region: string
) {
    logger.debug('Generate mock data for job table', accountId, credentialsId, region);
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return assessmentJobData(accountId, instanceDetails, credentialsId, region, parentJobId);
}

async function createOptimizeJobMockData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.debug(
        'Generate optimize mock data for job table',
        accountId,
        resourceName,
        credentialsId,
        region,
        instanceId,
        resourceId
    );
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return optimizeStorageJobData(
        accountId,
        resourceName,
        instanceName,
        credentialsId,
        region,
        parentJobId,
        instanceId,
        resourceId
    );
}

async function createOperatingSystemOptimizeJobMockData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.debug('Generate operating system optimize mock data for job table', {
        accountId,
        resourceName,
        credentialsId,
        region,
        instanceId,
        resourceId
    });
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return optimizeOperatingSystemJobData(
        accountId,
        resourceName,
        instanceName,
        credentialsId,
        region,
        parentJobId,
        instanceId,
        resourceId
    );
}

async function createOperatingSystemMpioSessionsOptimizeJobMockData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.debug('Generate operating system optimize mock data for job table', {
        accountId,
        resourceName,
        credentialsId,
        region,
        instanceId,
        resourceId
    });
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return optimizeMpioSessionsJobData(
        accountId,
        resourceName,
        instanceName,
        credentialsId,
        region,
        parentJobId,
        instanceId,
        resourceId
    );
}

async function createDeploymentMockDataInDBForPgSql(
    accountId: string,
    stackId: string,
    stackName: string,
    region: string,
    credentialsId: string,
    sqlDeploymentMode: string,
    FSXFileSystemId: string | undefined,
    awsAccountId: string,
    serverName: string,
    storageProtocol: string = STORAGE_PROTOCOLS.NFS,
    resourceId?: string
) {
    logger.info('create deployment, resource and job table mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        serverName,
        awsAccountId,
        storageProtocol,
        resourceId
    });
    serverName = serverName || `sqldatabase${randomize('a0', 4)}`;

    const cloudProviderId = awsAccountId;
    const resourceName = serverName;
    if (sqlDeploymentMode.toLowerCase() === 'standalone') {
        sqlDeploymentMode = 'Standalone';
    } else {
        sqlDeploymentMode = 'ha';
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
            databaseType: DatabaseTypes.PG_SQL,
            resourceName,
            fileSystemType: STORAGE_TYPE.FSXN
        }
    });

    const instanceId = '7450008296037943418';

    resourceId = resourceId || randomUUID();
    const fsxId = `fs-${randomize('0', 8)}`;

    const metadata: Metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: `i-${randomize('A0', 17)}`,
        creationDate: new Date().getTime().toString(),
        fsxSvmId: 'svm-0491dd89a76b7ca3d',
        sandboxCreated: true,
        storageProtocol,
        fsxDataVolumeName: 'wlmdb-data-1234'
    };
    if (sqlDeploymentMode === 'ha') {
        metadata.node2InstanceId = `i-${randomize('A0', 17)}`;
    }

    await createResource(accountId, {
        resourceId,
        credentialsId,
        storageType: STORAGE_TYPE.FSXN,
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.PGSQL,
        coRelationId: fsxId,
        region,
        metadata
    });

    const instanceRecord = {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId: instanceId,
        databaseInstanceName: 'PostgresSQL',
        fsxnIds: fsxId,
        isDefault: true,
        source: RESOURCE_SOURCE.DEPLOY,
        sqlDeploymentType: sqlDeploymentMode,
        fsxSvmId: { [fsxId]: `svm-${randomize('A0', 17)}` },
        numberofUserDbsCreated: 1,
        storageProtocol,
        databaseType: DatabaseTypes.PG_SQL,
        storageType: STORAGE_TYPE.FSXN
    };

    await upsertDatabaseInstance(accountId, instanceRecord);

    const data: any[] = await mockPGSqlStandaloneDeploymentStack(
        accountId,
        resourceName,
        credentialsId,
        region,
        stackName,
        FSXFileSystemId,
        sqlDeploymentMode
    );

    await createJobs(accountId, data);
}

async function demoGetFsxnVolIdsFromOntapVolIds(
    credentialsId: string,
    region: string,
    fsxId: string,
    volumeUuids: string[]
) {
    logger.info('Demo Get the Fsxn volume ids from the ontap volume ids', {
        credentialsId,
        region,
        fsxId,
        volumeUuids
    });

    const { Volumes: volumes = [] } = await describeFSxVolumes(credentialsId, region, [fsxId]);

    const volumeIds: string[] = [];
    const uuidVolumeIdMap: Record<string, string> = {};
    let fsxVolIds = volumes.map(volume => volume.VolumeId) || [];
    if (volumeUuids.length > fsxVolIds.length) {
        // If the number of volumeUuids is more than the number of fsx volumes, then repeating the fsxVolIds
        fsxVolIds = Array(volumeUuids.length).fill(sample(fsxVolIds));
    }

    volumes.forEach(volume => {
        const { OntapConfiguration: { UUID = '' } = {}, VolumeId = '' } = volume;
        if (volumeUuids.includes(UUID)) {
            volumeIds.push(VolumeId);
            uuidVolumeIdMap[VolumeId] = UUID;
        } else {
            volumeIds.push(sample(fsxVolIds) || '');
            uuidVolumeIdMap[VolumeId] = sample(volumeUuids) || '';
        }
    });

    logger.debug('List volume ids in an fsx response', volumeIds);

    return {
        volumeIds: compact(volumeIds),
        uuidVolumeIdMap
    };
}

async function createStorageTierJobMockData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.debug('Generate storage-tier optimize mock data for job table', {
        accountId,
        resourceName,
        credentialsId,
        region,
        instanceId,
        resourceId
    });
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return optimizeStorageTierJobData(
        accountId,
        resourceName,
        instanceName,
        credentialsId,
        region,
        parentJobId,
        instanceId,
        resourceId
    );
}

async function createEnableMpioJobMockData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.debug('Generate enable mpio mock data for job table', {
        accountId,
        resourceName,
        credentialsId,
        region,
        instanceId,
        resourceId
    });
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return enableMPIOJobData(
        accountId,
        resourceName,
        instanceName,
        credentialsId,
        region,
        parentJobId,
        instanceId,
        resourceId
    );
}

async function createAssessmentData(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceId: string,
    databaseInstanceName: string = DEFAULT_INSTANCE_NAME
) {
    const instanceConfigDataRecord = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now()),
        config_data_type: AssessmentCategories.STORAGE,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME ? MSSQL_ASSESMENT_CONFIG_DATA : ASSESMENT_CONFIG_DATA
    };
    const instanceCRRConfigDataRecord = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now()),
        config_data_type: AssessmentCategories.CRR,
        config_data: ASSESSMENT_CRR_CONFIG_DATA
    };
    const instanceAWSBackupConfigDataRecord = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now()),
        config_data_type: AssessmentCategories.AWS_BACKUP,
        config_data: ASSESSMENT_AWS_BACKUP_DATA
    };
    const instanceMaxdopConfigDataRecord = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now()),
        config_data_type: AssessmentCategories.MAXDOP,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME
                ? MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA
                : ASSESSMENT_MAXDOP_CONFIG_DATA
    };
    const instanceCloneConfigDataRecord = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now()),
        config_data_type: AssessmentCategories.CLONE,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME
                ? MSSQL_ASSESSMENT_CLONE_CONFIG_DATA
                : ASSESSMENT_CLONE_CONFIG_DATA
    };
    await createDatabaseInstanceConfigData([
        instanceConfigDataRecord,
        instanceCRRConfigDataRecord,
        instanceAWSBackupConfigDataRecord,
        instanceMaxdopConfigDataRecord,
        instanceCloneConfigDataRecord
    ]);
}

function prepareDemoSandboxMetadata(
    hostname: string,
    instanceId?: string,
    dbName: string = DemoDefaultDatabaseNames[0],
    instancename: string = DEFAULT_INSTANCE_NAME
) {
    const hostMetadata: any = {};
    hostMetadata.sandboxes = [];
    hostMetadata.userDatabase = [];

    hostMetadata.sandboxes.push({
        databaseName: `${dbName}_sandbox`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: `${hostname}|${instancename}|${dbName}`,
        tag: 'Development',
        databaseInstanceId: instanceId
    });
    hostMetadata.userDatabase.push({
        name: `${dbName}_sandbox`,
        size: 17179869184,
        type: 'User Database',
        status: 'ONLINE',
        protection: {
            isAwsBackupEnabled: { fsxn: false, fsxw: false, ebs: false },
            isFsxOntapSnapshotsEnabled: false,
            isSqlNativeEnabled: false,
            isCRREnabled: false,
            isAppConsistentBackupEnabled: false
        },
        collation: SQL_DEFAULT_COLLATION
    });
    if (!instanceId) {
        hostMetadata.sandboxes[0].databaseInstanceId = instanceId;
    }
    return hostMetadata;
}

export {
    createFileSystemForDemo,
    createDeploymentMockDataInDB,
    updateUserDBIntoResourceData,
    updateSandboxDBIntoResourceData,
    createSandboxJobMockData,
    getVolumeIdsFromStorage,
    updateUserDBIntoInstanceTable,
    updateSandboxDBIntoInstanceData,
    getEBSVolumesForDemo,
    createAssessmentJobMockData,
    createOptimizeJobMockData,
    updateOptimizedConfigNameInInstanceTable,
    createDeploymentMockDataInDBForPgSql,
    createOperatingSystemOptimizeJobMockData,
    demoGetFsxnVolIdsFromOntapVolIds,
    createOperatingSystemMpioSessionsOptimizeJobMockData,
    createStorageTierJobMockData,
    createEnableMpioJobMockData,
    createAssessmentData,
    prepareDemoSandboxMetadata,
    updateOptimizedConfigMetaData
};
