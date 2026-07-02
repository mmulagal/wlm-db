/* eslint-disable no-await-in-loop */
import randomize from 'randomatic';
import { Volume, type DescribeVolumesResult } from '@aws-sdk/client-ec2';
import { DEPLOYMENT_MODEL, STORAGE_TYPE } from '@prisma/client';
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
    DEMO_STANDALONE_SQL_SERVER_ID,
    STORAGE_PROTOCOLS
} from '../utils/consts';
import { checkAccount, createResource, updateResource, upsertDatabaseInstance } from '../lib/database/db';
import {
    Metadata,
    Sandbox,
    DatabaseInstanceMetadata,
    ResourceAssessmentData,
    DatabaseInstance,
    CloneDetail,
    CloneAssessment
} from '../utils/common-types';
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
    enableMPIOJobData,
    createAssessmentData,
    ORACLE_STORAGE_ASSESSMENT_DATA,
    ORACLE_ASSESSMENT_CRR_CONFIG_DATA,
    ORACLE_MAPPED_ONTAP_VOLUMES_DATA,
    buildOracleDemoAwsBackupAssessmentSeed,
    buildOracleSecurityPatchAssessmentData,
    ORACLE_SNAPCENTER_ASSESSMENT_DATA,
    ORACLE_ASSESSMENT_CLONE_CONFIG_DATA,
    createAssessmentDataWithRetry,
    ORACLE_DATAGUARD_INSTANCES
} from '../utils/demo-utils/demoMockdata';
import { convertToBytes, generateRandomIP, summarizeFirstLevel, parseAssessmentFileContent } from '../utils/utils';
import { FSXConfigurationType } from '../routes/types/deployment.types';
import { SQL_DEFAULT_COLLATION } from '../lib/chatbot/consts';
import { getInstanceListFromStorage, getVolumesListFromStorage } from '../lib/cloud-manager/marketing';
import { describeFSxVolumes } from '../lib/aws/fsx';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentStatus,
    OptimizeOracleComputeHostOs
} from '../utils/continous-optimization-consts';
import { offlineAssessmentDemoFCI } from '../utils/demo-utils/offlineAssessmentRecords/offlineAssessmentDemoFCI';
import { offlineAssessmentDemoOracleISCSI } from '../utils/demo-utils/offlineAssessmentRecords/offlineAssessmentDemoOracleISCSI';
import { getInstanceInfo, updateInstanceMetadata, updateResourceMetaData } from './database/database-operations';
import {
    mockResourceAssessmentData,
    mockResourceAssessmentDataAllOptimized,
    mockAoagResourceAssessmentData,
    mockAoagResourceAssessmentDataAllOptimized,
    mockOracleHostOsPatchAssessmentData,
    optimizedResourceName,
    aoagPrimaryHostName
} from '../utils/demo-utils/hostAssementsData';
import {
    ParameterDriftResponseType,
    CloneDetailType,
    CloneDriftResponseType
} from '../routes/types/mssql-continuous-optimisation.types';
import { OracleDeploymentTenacy, STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS } from './workloads/oracle/consts';
import type { AssessmentItemType, AssessmentErrorItemType } from '../routes/types/continuous-optimization.types';
import { StorageIscsiAssessment } from './continuous-optimization/oracle/common-types';

const logger = getLogger();
const DemoDefaultDatabaseNames = ['RetailBanking', 'MFGSales'];
const ORACLE_COMPUTE_HOST_OS_DEMO_CONFIG_NAMES = new Set<string>(Object.values(OptimizeOracleComputeHostOs));
const oracleComputeHostOsDemoMetadataUpdates = new Map<string, Promise<void>>();
const generateRandomEc2InstanceId = () => `i-${randomize('?0', 17, { chars: 'abcdef' })}`;

function createJobMockData(
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
    resourceId?: string,
    ec2InstanceId?: string,
    partnerEc2InstanceId?: string
) {
    logger.info('create resource and job table mock data in database', {
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

    const instanceId = randomUUID();

    resourceId = resourceId || randomUUID();
    const fsxId = `fs-${randomize('0', 8)}`;

    const metadata: Metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: ec2InstanceId || generateRandomEc2InstanceId(),
        creationDate: new Date().getTime().toString(),
        activeDirectoryName: 'wlm.com',
        activeDirectoryAddress: generateRandomIP(),
        fsxSvmId: 'svm-0491dd89a76b7ca3d',
        sandboxCreated: true,
        storageProtocol,
        ...(createSandbox && prepareDemoSandboxMetadata(resourceName, instanceId))
    };

    let assessmentData: ResourceAssessmentData;
    if (sqlDeploymentMode === 'AOAG') {
        assessmentData =
            resourceName === aoagPrimaryHostName
                ? (mockAoagResourceAssessmentData.assessment as unknown as ResourceAssessmentData)
                : (mockAoagResourceAssessmentDataAllOptimized.assessment as unknown as ResourceAssessmentData);
    } else {
        assessmentData = optimizedResourceName.includes(resourceName)
            ? (mockResourceAssessmentData.assessment as unknown as ResourceAssessmentData)
            : (mockResourceAssessmentDataAllOptimized.assessment as unknown as ResourceAssessmentData);
    }

    if (sqlDeploymentMode === 'FCI') {
        metadata.node2InstanceId = generateRandomEc2InstanceId();
        metadata.activeDirectoryAddress = `${generateRandomIP()}, ${generateRandomIP()}`;
    }
    if (sqlDeploymentMode === 'AOAG' && partnerEc2InstanceId) {
        metadata.node2InstanceId = partnerEc2InstanceId;
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
        metadata,
        assessmentData
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

    await createAssessmentData(
        accountId,
        credentialsId,
        region,
        resourceId,
        instanceId,
        DEFAULT_INSTANCE_NAME,
        sqlDeploymentMode
    );

    const jobData = createJobMockData(
        accountId,
        resourceName,
        stackName,
        sqlDeploymentMode,
        fsxFileSystemId,
        credentialsId,
        region
    );

    const jobPromises = [createJobs(accountId, jobData)];

    if (createSandbox) {
        const sandboxJobsData = createSandboxJobMockData(
            accountId,
            region,
            'RetailBanking',
            'RetailBanking_sandbox',
            credentialsId,
            'SQL-Managed-Host-Prod',
            resourceName
        );
        jobPromises.push(createJobs(accountId, sandboxJobsData));
    }

    await Promise.all(jobPromises);
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
        fsxAdminPassword: `Fsx${randomize('Aa', 4)}${randomize('0', 2)}`, // Ensure password has letters and digits (8+ chars)
        deploymentType: mode,
        securityGroupIds: [],
        tags: [],
        svmAdminPassword: `Svm${randomize('Aa', 4)}${randomize('0', 2)}`,
        generateSecurityGroup: false,
        haPairs: 1,
        automaticBackupRetentionDays: 30,
        routeTableIds: ['rtb-11111111']
    };

    const response = await createFSX(requestBody);
    // adding delay to ensure fsx is available for subsequent operations
    await new Promise(resolve => {
        setTimeout(resolve, 3000);
    });
    return response;
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
            luns: {
                dataFiles: [{ name: '/vol/wlmdb_sqldata_demo/sqldata', driveLetter: 'E:\\' }],
                logFiles: [{ name: '/vol/wlmdb_sqllog_demo/sqllog', driveLetter: 'L:\\' }]
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
            luns: {
                dataFiles: [{ name: '/vol/wlmdb_sqldata_demo/sqldata', driveLetter: 'E:\\' }],
                logFiles: [{ name: '/vol/wlmdb_sqllog_demo/sqllog', driveLetter: 'L:\\' }]
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

async function updateOracleComputeHostOsOptimizedConfigInResourceMetadata(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configName: string
) {
    logger.info('updating Oracle compute host OS optimized config into resource metadata', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        configName
    });

    const updateKey = `${accountId}:${credentialsId}:${region}:${databaseHostId}`;
    const previousUpdate = oracleComputeHostOsDemoMetadataUpdates.get(updateKey);
    const currentUpdate = (async () => {
        if (previousUpdate) {
            await previousUpdate;
        }

        const { resource: { metadata = {} } = {} } = (await getInstanceInfo(
            accountId,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            region
        )) as DatabaseInstance;
        const currentMetadata = metadata as unknown as Metadata;
        const oracleComputeHostOsDemoOptimized = [
            ...new Set([...(currentMetadata.oracleComputeHostOsDemoOptimized || []), configName])
        ];

        await updateResource({
            accountId,
            credentialsId,
            region,
            resourceId: databaseHostId,
            metaData: {
                ...currentMetadata,
                oracleComputeHostOsDemoOptimized
            }
        });
    })();

    oracleComputeHostOsDemoMetadataUpdates.set(updateKey, currentUpdate);

    try {
        await currentUpdate;
    } finally {
        if (oracleComputeHostOsDemoMetadataUpdates.get(updateKey) === currentUpdate) {
            oracleComputeHostOsDemoMetadataUpdates.delete(updateKey);
        }
    }
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
    logger.info(
        'updating sandbox db into database instance  meta data',
        accountId,
        instanceID,
        summarizeFirstLevel(sandboxDetails)
    );

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

function createSandboxJobMockData(
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
            databaseInstanceDetails[0].database_instance_id === DEMO_STANDALONE_SQL_SERVER_ID
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
                    InstanceId: generateRandomEc2InstanceId(),
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

/** volumeId prefixes for discoverDemoDataOracle EBS TCO rows — first half gp3, second half io2 (8-vol) or 3+3 (6-vol) */
const ORACLE_TCO_DEMO_EBS_8_PREFIXES = [
    'vol-0a1b2c3d4e5f',
    'vol-0b2c3d4e5f6a7',
    'vol-0c4d5e6f7a8b0',
    'vol-0d5e6f7a8b9c0',
    'vol-094b644283b4f'
] as const;
const ORACLE_TCO_DEMO_EBS_6_PREFIXES = ['vol-0e6f7a8b9c0d0', 'vol-0f7a8b9c0d1e0'] as const;

type OracleTcoEbsVolSpec = {
    sizeGiB: number;
    gp3: { Iops: number; Throughput: number };
    io2: { Iops: number; Throughput: number };
};

/** Default for unknown prefix; per-host TCO uses `ORACLE_TCO_DEMO_EBS_SPECS`. */
const ORACLE_TCO_DEMO_EBS_GIB = 256;
const ORACLE_TCO_GP3 = { Iops: 3000, Throughput: 125 } as const;
const ORACLE_TCO_IO2 = { Iops: 12000, Throughput: 1000 } as const;

const ORACLE_TCO_DEMO_EBS_DEFAULT_SPEC: OracleTcoEbsVolSpec = {
    sizeGiB: ORACLE_TCO_DEMO_EBS_GIB,
    gp3: { Iops: ORACLE_TCO_GP3.Iops, Throughput: ORACLE_TCO_GP3.Throughput },
    io2: { Iops: ORACLE_TCO_IO2.Iops, Throughput: ORACLE_TCO_IO2.Throughput }
};

/** Each TCO demo host / spec-prefix group has distinct capacity and IOPS (still gp3 + io2 mix). */
const ORACLE_TCO_DEMO_EBS_SPECS: Readonly<Record<string, OracleTcoEbsVolSpec>> = {
    [ORACLE_TCO_DEMO_EBS_8_PREFIXES[0]]: {
        sizeGiB: 200,
        gp3: { Iops: 3000, Throughput: 125 },
        io2: { Iops: 10000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_8_PREFIXES[1]]: {
        sizeGiB: 256,
        gp3: { Iops: 3000, Throughput: 125 },
        io2: { Iops: 12000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_8_PREFIXES[2]]: {
        sizeGiB: 400,
        gp3: { Iops: 4000, Throughput: 125 },
        io2: { Iops: 12000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_8_PREFIXES[3]]: {
        sizeGiB: 256,
        gp3: { Iops: 3000, Throughput: 125 },
        io2: { Iops: 8000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_8_PREFIXES[4]]: {
        sizeGiB: 300,
        gp3: { Iops: 3000, Throughput: 125 },
        io2: { Iops: 12000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_6_PREFIXES[0]]: {
        sizeGiB: 128,
        gp3: { Iops: 3000, Throughput: 125 },
        io2: { Iops: 10000, Throughput: 1000 }
    },
    [ORACLE_TCO_DEMO_EBS_6_PREFIXES[1]]: {
        sizeGiB: 512,
        gp3: { Iops: 3000, Throughput: 250 },
        io2: { Iops: 16000, Throughput: 1000 }
    }
};

/** EBS TCO host EC2 id → first volume id prefix (marketing + spec lookup for that host). */
const ORACLE_TCO_DEMO_EBS_HOST_PREFIX: Readonly<Record<string, string>> = {
    'i-02a8c7e5d4b3f12a9': ORACLE_TCO_DEMO_EBS_8_PREFIXES[0], // orclstd1
    'i-03b9d6f4c5e2a8b71': ORACLE_TCO_DEMO_EBS_8_PREFIXES[1], // orclstd2
    'i-04c8e5b3d6a9f12c4': ORACLE_TCO_DEMO_EBS_8_PREFIXES[2], // DG primary
    'i-05d7f6c4e3b8a9d52': ORACLE_TCO_DEMO_EBS_8_PREFIXES[3], // DG standby
    'i-12456768': ORACLE_TCO_DEMO_EBS_8_PREFIXES[4], // ORCLSTD6 (Standalone)
    // Mixed 12-vol host: use std (smaller) group for the automatic marketing line item
    'i-06e9a7b5c8d4f3e12': ORACLE_TCO_DEMO_EBS_6_PREFIXES[0]
};

function getOracleTco8Or6Prefix(
    volumeId: string
): (typeof ORACLE_TCO_DEMO_EBS_8_PREFIXES)[number] | (typeof ORACLE_TCO_DEMO_EBS_6_PREFIXES)[number] | undefined {
    const p8 = ORACLE_TCO_DEMO_EBS_8_PREFIXES.find(p => volumeId.startsWith(p));
    if (p8) {
        return p8;
    }
    return ORACLE_TCO_DEMO_EBS_6_PREFIXES.find(p => volumeId.startsWith(p));
}

/**
 * Oracle TCO EBS demo in `discoverDemoDataOracle` (same ids as `demoInventoryData` EBS TCO block).
 * 8-vol: 4×gp3 + 4×io2; 6-vol (mixed host): 3+3. Marketing demo keys off `instanceIds` (no ebs in util).
 */
const ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE: Readonly<Record<string, 'eight' | 'six'>> = {
    'i-02a8c7e5d4b3f12a9': 'eight', // orclstd1
    'i-03b9d6f4c5e2a8b71': 'eight', // orclstd2
    'i-04c8e5b3d6a9f12c4': 'eight', // DG primary
    'i-05d7f6c4e3b8a9d52': 'eight', // DG standby
    'i-12456768': 'eight', // ORCLSTD6 (Standalone)
    'i-06e9a7b5c8d4f3e12': 'six' // mixed: two 6-vol groups
};

function getOracleTcoSpecForPrefix(prefix: string): OracleTcoEbsVolSpec {
    return ORACLE_TCO_DEMO_EBS_SPECS[prefix] ?? ORACLE_TCO_DEMO_EBS_DEFAULT_SPEC;
}

/**
 * Groups volumeIds into consecutive runs that share the same TCO demo EBS spec prefix
 * (volume id `startsWith` that string → same `getOracleTcoSpecForPrefix` row and same 8- vs 6-vol layout).
 * Returns null if any id has no known TCO prefix or the input is empty.
 *
 * Example — mixed host with two 6-vol groups (two different spec prefixes):
 *   input:  ['vol-0e6f...01', 'vol-0e6f...02', ...(6 total), 'vol-0f7a...01', ...(6 total)]
 *   output: [['vol-0e6f...01', ...(6)], ['vol-0f7a...01', ...(6)]]
 */
function segmentOracleTcoVolumeIdsByConsecutivePrefix(volumeIds: string[]): string[][] | null {
    if (volumeIds.length === 0) {
        return null;
    }
    const segments: string[][] = [];
    let current: string[] = [];
    let lastPrefix: string | undefined;
    for (const id of volumeIds) {
        const matchedDemoTcoPrefix = getOracleTco8Or6Prefix(id);
        if (!matchedDemoTcoPrefix) {
            return null;
        }
        if (lastPrefix !== undefined && matchedDemoTcoPrefix !== lastPrefix) {
            segments.push(current);
            current = [];
        }
        lastPrefix = matchedDemoTcoPrefix;
        current.push(id);
    }
    if (current.length) {
        segments.push(current);
    }
    return segments;
}

/**
 * Returns true only when all volumeIds share one TCO demo EBS spec prefix AND the count
 * matches that prefix’s layout: 8 volumes for an 8-prefix spec (4×gp3 + 4×io2),
 * or 6 for a 6-prefix spec (3×gp3 + 3×io2).
 */
function isOracleTcoEbsMultiTypeVolumeIdsForDemo(volumeIds: string[]): boolean {
    if (volumeIds.length === 0) {
        return false;
    }
    const sharedDemoTcoPrefix = getOracleTco8Or6Prefix(volumeIds[0]!); // every volume id in this group must start with this spec prefix
    if (!sharedDemoTcoPrefix) {
        return false;
    }
    const is8 = ORACLE_TCO_DEMO_EBS_8_PREFIXES.includes(
        sharedDemoTcoPrefix as (typeof ORACLE_TCO_DEMO_EBS_8_PREFIXES)[number]
    );
    if (is8 && volumeIds.length !== 8) {
        return false;
    }
    if (!is8 && volumeIds.length !== 6) {
        return false;
    }
    return volumeIds.every(volumeId => getOracleTco8Or6Prefix(volumeId) === sharedDemoTcoPrefix);
}

/**
 * Maps volumeIds to AWS DescribeVolumes-shaped rows using a mixed gp3/io2 layout.
 * The first gp3VolumeCount entries become gp3 volumes; the remainder become io2.
 * For an 8-vol host: gp3VolumeCount=4 (4×gp3 + 4×io2).
 * For a 6-vol host:  gp3VolumeCount=3 (3×gp3 + 3×io2).
 */
function buildOracleTcoEbsVolumeRowsForSimulator(
    volumeIds: string[],
    gp3VolumeCount: 4 | 3,
    spec: OracleTcoEbsVolSpec
): Volume[] {
    return volumeIds.map((VolumeId, index) => {
        const isGp3 = index < gp3VolumeCount;
        if (isGp3) {
            return {
                VolumeId,
                AvailabilityZone: 'ap-south-1a',
                State: 'in-use',
                VolumeType: 'gp3',
                Size: spec.sizeGiB,
                Iops: spec.gp3.Iops,
                Throughput: spec.gp3.Throughput
            } as Volume;
        }
        return {
            VolumeId,
            AvailabilityZone: 'ap-south-1a',
            State: 'in-use',
            VolumeType: 'io2',
            Size: spec.sizeGiB,
            Iops: spec.io2.Iops,
            Throughput: spec.io2.Throughput
        } as Volume;
    });
}

/**
 * Oracle TCO EBS demo: `DescribeVolumes`-shaped rows (gp3 + io2) for inventory volume ids in `discoverDemoDataOracle`.
 * Used in `IS_DEMO_FLOW` by `getEbsResourceInfo` (same pattern as `getEBSVolumesForDemo` for MSSQL) and by the test
 * EC2 `DescribeVolumes` mock. Returns `null` when `volumeIds` are not the TCO multi-type set.
 */
function getOracleTcoEbsDescribeVolumesForSimulator(volumeIds: string[] | undefined): DescribeVolumesResult | null {
    if (!volumeIds?.length) {
        return null;
    }
    if (isOracleTcoEbsMultiTypeVolumeIdsForDemo(volumeIds)) {
        const sharedDemoTcoPrefix = getOracleTco8Or6Prefix(volumeIds[0]!)!; // shared spec prefix for this group → 8 vs 6 layout + `getOracleTcoSpecForPrefix`
        const is8 = ORACLE_TCO_DEMO_EBS_8_PREFIXES.includes(
            sharedDemoTcoPrefix as (typeof ORACLE_TCO_DEMO_EBS_8_PREFIXES)[number]
        );
        const spec = getOracleTcoSpecForPrefix(sharedDemoTcoPrefix);
        const volumes = buildOracleTcoEbsVolumeRowsForSimulator(volumeIds, is8 ? 4 : 3, spec);
        return { Volumes: volumes } as DescribeVolumesResult;
    }
    // Second path: mixed host — one instance, two consecutive 6-vol groups with different TCO demo spec prefixes (12 volumes total).
    const segments = segmentOracleTcoVolumeIdsByConsecutivePrefix(volumeIds);
    if (!segments || segments.length < 2) {
        return null;
    }
    if (!segments.every(segment => isOracleTcoEbsMultiTypeVolumeIdsForDemo(segment))) {
        return null;
    }
    const allVolumes: Volume[] = [];
    for (const segment of segments) {
        const sharedDemoTcoPrefix = getOracleTco8Or6Prefix(segment[0]!)!; // shared spec prefix for this segment → 8 vs 6 layout + `getOracleTcoSpecForPrefix`
        const is8 = ORACLE_TCO_DEMO_EBS_8_PREFIXES.includes(
            sharedDemoTcoPrefix as (typeof ORACLE_TCO_DEMO_EBS_8_PREFIXES)[number]
        );
        const spec = getOracleTcoSpecForPrefix(sharedDemoTcoPrefix);
        allVolumes.push(...buildOracleTcoEbsVolumeRowsForSimulator(segment, is8 ? 4 : 3, spec));
    }
    return { Volumes: allVolumes } as DescribeVolumesResult;
}

type OracleTcoMarketingVol = {
    volumeType: string;
    volumeNumber: number;
    storageAmount: number;
    volumeIops: number;
    throughput: number;
};

/**
 * @returns `null` when the request is not the Oracle TCO EBS multi-type demo (manual marketing path uses defaults).
 * Prefers `instanceIds` (discover EBS TCO hosts); optional ebs-id fallback for tests that call the demo API without instance ids.
 */
function getOracleTcoEbsDemoMarketingVolsAndInstanceType(
    instanceIds: string[] | undefined,
    ebsVolumeIdsForTestFallback?: string[] | undefined
): { volumes: OracleTcoMarketingVol[]; ec2InstanceType: string } | null {
    const fromSizeAndSpec = (volumeCountPerType: 4 | 3, spec: OracleTcoEbsVolSpec) => {
        const storageSizeBytes = convertToBytes(spec.sizeGiB, 'GiB') || 0;
        return {
            ec2InstanceType: 'm5.4xlarge' as const,
            volumes: [
                {
                    volumeType: 'gp3',
                    volumeNumber: volumeCountPerType,
                    storageAmount: storageSizeBytes,
                    volumeIops: spec.gp3.Iops,
                    throughput: spec.gp3.Throughput
                },
                {
                    volumeType: 'io2',
                    volumeNumber: volumeCountPerType,
                    storageAmount: storageSizeBytes,
                    volumeIops: spec.io2.Iops,
                    throughput: spec.io2.Throughput
                }
            ]
        };
    };

    for (const id of instanceIds ?? []) {
        const tco = ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE[id];
        if (tco) {
            const hostVolumePrefix = ORACLE_TCO_DEMO_EBS_HOST_PREFIX[id];
            if (!hostVolumePrefix) {
                return null;
            }
            const spec = getOracleTcoSpecForPrefix(hostVolumePrefix);
            return fromSizeAndSpec(tco === 'eight' ? 4 : 3, spec);
        }
    }
    if (ebsVolumeIdsForTestFallback?.length) {
        if (!isOracleTcoEbsMultiTypeVolumeIdsForDemo(ebsVolumeIdsForTestFallback)) {
            return null;
        }
        const sharedDemoTcoPrefix = getOracleTco8Or6Prefix(ebsVolumeIdsForTestFallback[0]!)!; // shared spec prefix for fallback ids → 8 vs 6 layout + `getOracleTcoSpecForPrefix`
        const is8 = ORACLE_TCO_DEMO_EBS_8_PREFIXES.includes(
            sharedDemoTcoPrefix as (typeof ORACLE_TCO_DEMO_EBS_8_PREFIXES)[number]
        );
        const spec = getOracleTcoSpecForPrefix(sharedDemoTcoPrefix);
        return fromSizeAndSpec(is8 ? 4 : 3, spec);
    }
    return null;
}

function createAssessmentJobMockData(accountId: string, instanceDetails: any, credentialsId: string, region: string) {
    logger.debug('Generate mock data for job table', accountId, credentialsId, region);
    accountId = checkAccount(accountId);
    const parentJobId = randomUUID();
    return assessmentJobData(accountId, instanceDetails, credentialsId, region, parentJobId);
}

function createOptimizeJobMockData(
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

function createOperatingSystemOptimizeJobMockData(
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

function createOperatingSystemMpioSessionsOptimizeJobMockData(
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
    logger.info('create resource and job table mock data in database', {
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

    const instanceId = '7450008296037943418';

    resourceId = resourceId || randomUUID();
    const fsxId = `fs-${randomize('0', 8)}`;

    const metadata: Metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: generateRandomEc2InstanceId(),
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

    const data: any[] = mockPGSqlStandaloneDeploymentStack(
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

async function createDeploymentMockDataInDBForOracle(
    accountId: string,
    stackId: string,
    stackName: string,
    region: string,
    credentialsId: string,
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined,
    awsAccountId: string,
    serverName: string,
    resourceId?: string,
    storageProtocol: string = STORAGE_PROTOCOLS.NFS,
    seedInstanceId: string = 'oracle-dev'
) {
    logger.info('create resource mock data in database', {
        accountId,
        stackId,
        stackName,
        region,
        credentialsId,
        sqlDeploymentMode,
        fsxFileSystemId,
        serverName,
        awsAccountId,
        resourceId
    });
    serverName = serverName || `oracledatabase${randomize('a0', 4)}`;

    const cloudProviderId = awsAccountId;
    const resourceName = serverName;
    if (sqlDeploymentMode.toLowerCase() === 'standalone') {
        sqlDeploymentMode = 'Standalone';
    } else {
        sqlDeploymentMode = 'ha';
    }

    const instanceId = storageProtocol === STORAGE_PROTOCOLS.ISCSI ? 'i-5520fe41798c75633' : 'i-5520fe41798c75632';
    const databaseInstanceId = seedInstanceId;

    resourceId = resourceId || randomUUID();
    const fsxId = `fs-${randomize('0', 8)}`;

    const metadata = {
        sqlDeploymentType: sqlDeploymentMode as DEPLOYMENT_MODEL,
        node1InstanceId: instanceId,
        creationDate: new Date().getTime().toString(),
        fsxSvmId: 'svm-0491dd89a76b7ca3d',
        storageProtocol,
        fsxDataVolumeName: 'wlmdb-data-12345'
    };

    await createResource(accountId, {
        resourceId,
        credentialsId,
        storageType: STORAGE_TYPE.FSXN,
        resourceName,
        cloudProviderAccountId: cloudProviderId,
        cloudProviderName: CloudProviders.AWS,
        resourceType: RESOURCESTYPE.ORACLE,
        coRelationId: fsxId,
        region,
        metadata,
        assessmentData: mockOracleHostOsPatchAssessmentData as ResourceAssessmentData
    });

    const instanceRecord = {
        resourceId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseInstanceName: databaseInstanceId,
        fsxnIds: fsxId,
        isDefault: true,
        instanceState: 'OPEN',
        source: RESOURCE_SOURCE.DISCOVER,
        sqlDeploymentType: sqlDeploymentMode,
        fsxSvmId: { [fsxId]: `svm-${randomize('A0', 17)}` },
        storageProtocol,
        databaseType: DatabaseTypes.ORACLE,
        storageType: STORAGE_TYPE.FSXN
    };

    await upsertDatabaseInstance(accountId, instanceRecord);
    const instanceMetadata = { oracleDeploymentType: OracleDeploymentTenacy.SINGLE_TENANT };
    await updateInstanceMetadata(accountId, databaseInstanceId, instanceMetadata);

    await createAssessmentDataForOracle(
        accountId,
        credentialsId,
        region,
        resourceId,
        databaseInstanceId,
        fsxId,
        instanceRecord.storageProtocol
    );
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
    const fsxVolumeIdUuidMap: Map<string, string> = new Map();
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
        fsxVolumeIdUuidMap.set(UUID, sample(fsxVolIds) || '');
    });

    logger.debug('List volume ids in an fsx response', volumeIds);

    return {
        volumeIds: compact(volumeIds),
        uuidVolumeIdMap,
        fsxVolumeIdUuidMap
    };
}

function createStorageTierJobMockData(
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

function createEnableMpioJobMockData(
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

async function createAssessmentDataForOracle(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceId: string,
    fsxId: string,
    storageProtocol: string
) {
    const baseConfig = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now())
    };
    const creationTime = baseConfig.creation_time;
    const instanceConfigDataRecord = {
        ...baseConfig,
        creation_time: creationTime,
        config_data_type: AssessmentCategories.STORAGE,
        config_data: ORACLE_STORAGE_ASSESSMENT_DATA
    };
    const oracleParams = (ORACLE_STORAGE_ASSESSMENT_DATA as Record<string, unknown>).os as
        | Record<string, unknown>
        | undefined;
    const computePayload =
        storageProtocol === STORAGE_PROTOCOLS.ISCSI && oracleParams
            ? {
                  os: {
                      'oracle-parameters': oracleParams['oracle-parameters'],
                      'oracle-parameters-from-init': oracleParams['oracle-parameters-from-init']
                  }
              }
            : null;
    const instanceComputeConfigDataRecord = computePayload
        ? {
              ...baseConfig,
              creation_time: creationTime,
              config_data_type: AssessmentCategoriesOracle.COMPUTE,
              config_data: computePayload
          }
        : null;
    const instanceConfigMappedOntapDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
        config_data: ORACLE_MAPPED_ONTAP_VOLUMES_DATA(fsxId, storageProtocol, databaseInstanceId, false)
    };
    const instanceCRRConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.CRR,
        config_data: ORACLE_ASSESSMENT_CRR_CONFIG_DATA
    };

    const instanceSecurityPatchConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
        config_data: buildOracleSecurityPatchAssessmentData(databaseInstanceId)
    };

    const instanceSnapcenterConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT,
        config_data: ORACLE_SNAPCENTER_ASSESSMENT_DATA
    };

    const instanceCloneConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategoriesOracle.CLONE,
        config_data: ORACLE_ASSESSMENT_CLONE_CONFIG_DATA
    };

    const instanceAwsBackupConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.AWS_BACKUP,
        config_data: buildOracleDemoAwsBackupAssessmentSeed(fsxId)
    };

    const configDataRecords = [
        instanceConfigDataRecord,
        ...(instanceComputeConfigDataRecord ? [instanceComputeConfigDataRecord] : []),
        instanceConfigMappedOntapDataRecord,
        instanceCRRConfigDataRecord,
        instanceAwsBackupConfigDataRecord,
        instanceSecurityPatchConfigDataRecord,
        instanceSnapcenterConfigDataRecord,
        instanceCloneConfigDataRecord
    ];

    await createAssessmentDataWithRetry(
        configDataRecords,
        {
            accountId,
            region,
            credentialsId,
            resourceId,
            databaseInstanceId
        },
        DatabaseTypes.ORACLE
    );

    await updateResource({
        accountId,
        credentialsId,
        region,
        resourceId,
        updatedAssessmentData: mockOracleHostOsPatchAssessmentData as ResourceAssessmentData
    });
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
        luns: {
            dataFiles: [{ name: '/vol/wlmdb_sqldata_demo_sandbox/sqldata', driveLetter: 'E:\\' }],
            logFiles: [{ name: '/vol/wlmdb_sqllog_demo_sandbox/sqllog', driveLetter: 'L:\\' }]
        },
        collation: SQL_DEFAULT_COLLATION
    });
    if (!instanceId) {
        hostMetadata.sandboxes[0].databaseInstanceId = instanceId;
    }
    return hostMetadata;
}

function handleGetMssqlAssessmentForDemo(
    accountId: string,
    instanceDetail: DatabaseInstance,
    assessments: (AssessmentItemType | AssessmentErrorItemType)[]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Handling demo for assessment', { accountId });
    const { resource: { metadata = {} } = {}, metadata: instanceMetadata } =
        instanceDetail as unknown as DatabaseInstance;

    const storageConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
    const osConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.OS || [];
    const sizingConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.SIZING || [];
    const maxDopConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.maxdop || [];
    const cloneConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.CLONE || [];

    return assessments.map(item => {
        const i = { ...item } as AssessmentItemType & Record<string, unknown>;

        if (i.id === 'compute-rightsizing' && !('errorMessage' in i)) {
            const computeConfigsOptimized = (metadata as unknown as Metadata).isComputeOptimized;
            if (computeConfigsOptimized) {
                i.status = AssessmentStatus.OPTIMIZED;
                i.recommendation = 'Optimized instance for your workload.';
            }
        } else if (i.id === 'sql-license' && !('errorMessage' in i)) {
            const licenseConfigsOptimized = (metadata as unknown as Metadata).isLicenseOptimized;
            if (licenseConfigsOptimized) {
                i.status = AssessmentStatus.OPTIMIZED;
                i.recommendation = 'Your current SQL license is optimized for your workload.';
            }
        } else if (i.id === 'host-os-patch' && !('errorMessage' in i)) {
            const hostOsPatchOptimized = (metadata as unknown as Metadata).isHostOsPatchOptimized;
            if (hostOsPatchOptimized) {
                i.status = AssessmentStatus.OPTIMIZED;
                i.recommendation = 'Your current windows host is optimized with security best practices.';
            }
        } else if (i.id === 'clone-management' && !('errorMessage' in i)) {
            const cloneResponse = i as AssessmentItemType & CloneDriftResponseType;
            if (cloneConfigsOptimized.length > 0) {
                const { oldCloneDetails = [], cloneDetails = [] } = cloneResponse;
                const cloneDatabaseNamesToRemove = new Set(
                    (cloneConfigsOptimized as CloneDetail[]).map(({ cloneDatabaseName }) => cloneDatabaseName)
                );
                const filteredOldCloneDetails = oldCloneDetails.filter(
                    ({ cloneDatabaseName }) => !cloneDatabaseNamesToRemove.has(cloneDatabaseName)
                );
                const totalObjectsInViolation = filteredOldCloneDetails.length;
                cloneResponse.oldCloneDetails = filteredOldCloneDetails;
                cloneResponse.totalObjectsInViolation = totalObjectsInViolation;
                cloneResponse.status =
                    totalObjectsInViolation === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
                cloneResponse.objectsInViolation = filteredOldCloneDetails.map(
                    ({ cloneDatabaseName }) => cloneDatabaseName as string
                );
                cloneResponse.cloneDriftMessage = `${filteredOldCloneDetails.length} out of ${cloneDetails.length} clones are old and divergent`;
            }
        } else if (i.id === 'maxdop' && !('errorMessage' in i)) {
            if (maxDopConfigsOptimized.length > 0 && maxDopConfigsOptimized.includes(i.id)) {
                i.status = AssessmentStatus.OPTIMIZED;
                i.objectsInViolation = [];
                i.violationDetails = [];
                i.totalObjectsInViolation = 0;
                i.current = '4';
            }
        } else if (i.type === 'storage' && i.subType === 'configuration' && !('errorMessage' in i)) {
            if (storageConfigsOptimized.includes(i.id) || osConfigsOptimized.includes(i.id)) {
                optimizeDriftConfig(i as ParameterDriftResponseType);
            }
        } else if (i.type === 'storage' && i.subType === 'sizing' && !('errorMessage' in i)) {
            if (sizingConfigsOptimized.includes(i.id)) {
                i.status = AssessmentStatus.OPTIMIZED;
                i.objectsInViolation = [];
                i.totalObjectsInViolation = 0;
            }
        }

        return i;
    });
}

async function updateAllOptimizedClonesDemoFlow(
    accountId: string,
    credentialsId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configData: CloneAssessment,
    clones: CloneDetailType[]
) {
    logger.info('Updating all optimized clones for demo flow', {
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });

    // Filter only the clones that were optimized
    const { oldCloneDetails } = configData as unknown as CloneAssessment;
    const matchingClones: CloneDetail[] = Array.isArray(oldCloneDetails)
        ? oldCloneDetails.filter(({ cloneDatabaseName, clonedBy }) =>
              clones.some(c => c.cloneDatabaseName === cloneDatabaseName && c.clonedBy?.toLowerCase() === clonedBy)
          )
        : [];

    // Fetch instance metadata once
    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;

    // Update all matching clones in one DB call
    await updateOptimizedConfigMetaData(
        accountId,
        databaseInstanceId,
        matchingClones,
        'CLONE',
        instanceMetadata as DatabaseInstanceMetadata
    );
}

// Percentage constants for MSSQL storage calculations
const PHYSICAL_USED_PERCENTAGE = 0.6; // 60% of used data is physicalUsed
const SSD_USED_PERCENTAGE = 0.8; // 80% of physicalUsed is ssdUsed
const CAPACITY_POOL_USED_PERCENTAGE = 0.03; // 3% of physicalUsed is capacityPoolUsed
const SNAPSHOT_USED_PERCENTAGE = 0.1; // 10% of physicalUsed is snapshotUsed

function getMssqlStorageDataForDemo(totalUsed: number) {
    totalUsed = Number(Number.isNaN(totalUsed) ? 0 : totalUsed);
    const physicalUsed = Number(totalUsed * PHYSICAL_USED_PERCENTAGE);

    return {
        ssdUsed: Number(physicalUsed * SSD_USED_PERCENTAGE),
        capacityPoolUsed: Number(physicalUsed * CAPACITY_POOL_USED_PERCENTAGE),
        snapshotUsed: Number(physicalUsed * SNAPSHOT_USED_PERCENTAGE),
        physicalUsed
    };
}

function loadAndModifyDemoFCIData() {
    const assessmentData = parseAssessmentFileContent(JSON.stringify(offlineAssessmentDemoFCI)) as {
        metadata?: Record<string, unknown>;
        rawdata?: Record<string, unknown>;
    };

    // Generate unique identifiers for this upload
    const uniqueId = randomUUID().substring(0, 8);
    const timestamp = new Date().toISOString();

    // Modify metadata with unique identifiers
    if (assessmentData.metadata) {
        assessmentData.metadata.ec2InstanceId = `demo-offline-fci-${uniqueId}`;
        assessmentData.metadata.hostname = `SQL-PROD-FCI-${uniqueId}`;
        assessmentData.metadata.vmName = `SQL-PROD-FCI-${uniqueId}`;
        assessmentData.metadata.assessmentTimestamp = timestamp;
        assessmentData.metadata.ontapHostName = [`management.fs-${uniqueId}.fsx.ap-southeast-1.amazonaws.com`];
        assessmentData.metadata.storageEndpoint = `fs-${uniqueId}`;
        assessmentData.metadata.fsxId = `fs-${uniqueId}`;
        assessmentData.metadata.region = 'ap-southeast-1';
    }

    // Modify instance-level details with unique identifiers
    if (assessmentData.rawdata?.instanceLevelDetails) {
        const instanceLevelDetails = assessmentData.rawdata.instanceLevelDetails as Record<
            string,
            Record<string, unknown>
        >;
        const instanceKeys = Object.keys(instanceLevelDetails);
        instanceKeys.forEach(instanceName => {
            const instanceData = instanceLevelDetails[instanceName];
            if (instanceData?.instanceDetails) {
                const instanceDetails = instanceData.instanceDetails as Record<string, unknown>;
                instanceDetails.databaseInstanceId = `demo-offline-fci-instance-${uniqueId}`;
                instanceDetails.executableInstance = `SQL-PROD-FCI-${uniqueId}`;
            }
        });
    }

    return assessmentData;
}

function loadAndModifyDemoOracleISCSIData() {
    const assessmentData = parseAssessmentFileContent(JSON.stringify(offlineAssessmentDemoOracleISCSI)) as {
        metadata?: Record<string, unknown>;
        rawdata?: Record<string, unknown>;
    };

    // Generate unique identifiers for this upload
    const uniqueId = randomUUID().substring(0, 8);
    const timestamp = new Date().toISOString();

    // Modify metadata with unique identifiers
    if (assessmentData.metadata) {
        assessmentData.metadata.ec2InstanceId = `demo-oracle-iscsi-${uniqueId}`;
        assessmentData.metadata.hostname = `ORACLE-ISCSI-${uniqueId}`;
        assessmentData.metadata.vmName = `ORACLE-ISCSI-${uniqueId}`;
        assessmentData.metadata.assessmentTimestamp = timestamp;
        assessmentData.metadata.storageEndpoint = `fs-${uniqueId}`;
        assessmentData.metadata.fsxId = `fs-${uniqueId}`;
        assessmentData.metadata.region = 'ap-southeast-1';
    }

    // Modify instance-level details with unique identifiers
    if (assessmentData.rawdata?.instanceLevelDetails) {
        const instanceLevelDetails = assessmentData.rawdata.instanceLevelDetails as Record<
            string,
            Record<string, unknown>
        >;
        const instanceKeys = Object.keys(instanceLevelDetails);
        instanceKeys.forEach(instanceName => {
            const instanceData = instanceLevelDetails[instanceName];
            if (instanceData?.instanceDetails) {
                const instanceDetails = instanceData.instanceDetails as Record<string, unknown>;
                instanceDetails.sid = `ORCL${uniqueId.substring(0, 4).toUpperCase()}`;
            }
        });
    }

    return assessmentData;
}

function handleGetOracleAssessmentForDemo(
    accountId: string,
    instanceDetail: DatabaseInstance,
    assessments: (AssessmentItemType | AssessmentErrorItemType)[]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Handling Oracle demo for assessment', { accountId });
    const { resource: { metadata = {} } = {}, metadata: instanceMetadata } =
        instanceDetail as unknown as DatabaseInstance;

    const oracleComputeHostOsDemoOptimized = (metadata as unknown as Metadata).oracleComputeHostOsDemoOptimized || [];
    const oracleComputeHostOsDemoOptimizedConfigs = new Set<string>(oracleComputeHostOsDemoOptimized);

    const storageConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
    const osConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.OS || [];
    const sizingConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.SIZING || [];
    const cloneConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.CLONE || [];
    const snapcenterConfigsOptimized =
        (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.SNAPCENTER_SNAPSHOT || [];

    // Remove snapcenter item for dataguard primary instances.
    const isDataguardPrimary = ORACLE_DATAGUARD_INSTANCES.primary.includes(instanceDetail.database_instance_id);

    const hasIscsiItems = assessments.some(
        item =>
            item.type === 'storage' &&
            item.subType === 'configuration' &&
            (item.id === 'os-type' || item.id === 'space-reservation-enabled')
    );

    return assessments
        .filter(item => {
            // Remove snapcenter item for dataguard primary instances.
            if (isDataguardPrimary && item.id === 'snapcenter-snapshot') {
                return false;
            }
            return true;
        })
        .map(item => {
            const i = { ...item } as AssessmentItemType & Record<string, unknown>;

            if (i.id === 'host-os-patch' && !('errorMessage' in i)) {
                const hostOsPatchOptimized = (metadata as unknown as Metadata).isHostOsPatchOptimized;
                if (hostOsPatchOptimized) {
                    i.status = AssessmentStatus.OPTIMIZED;
                    i.recommendation = 'Your current Linux host is optimized with security best practices.';
                }
            } else if (i.id === 'clone-management' && !('errorMessage' in i)) {
                const cloneResponse = i as AssessmentItemType & CloneDriftResponseType & Record<string, unknown>;
                if (cloneConfigsOptimized.length > 0) {
                    const cloneDetails = (cloneResponse.cloneDetails as { cloneDatabaseName?: string }[]) ?? [];
                    const oldCloneDetails = (cloneResponse.oldCloneDetails as { cloneDatabaseName?: string }[]) ?? [];
                    const cloneDatabaseNamesToRemove = new Set(
                        (cloneConfigsOptimized as { cloneDatabaseName?: string }[])
                            .map(({ cloneDatabaseName }) => cloneDatabaseName)
                            .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
                    );
                    const filteredCloneDetails = cloneDetails.filter(
                        ({ cloneDatabaseName }) =>
                            typeof cloneDatabaseName === 'string' && !cloneDatabaseNamesToRemove.has(cloneDatabaseName)
                    );
                    const filteredOldCloneDetails = oldCloneDetails.filter(
                        ({ cloneDatabaseName }) =>
                            typeof cloneDatabaseName === 'string' && !cloneDatabaseNamesToRemove.has(cloneDatabaseName)
                    );
                    const totalObjectsInViolation = filteredOldCloneDetails.length;
                    const objectsInViolation = filteredOldCloneDetails
                        .map(({ cloneDatabaseName }) => cloneDatabaseName)
                        .filter((name): name is string => typeof name === 'string');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cloneResponse.cloneDetails = filteredCloneDetails as any;
                    cloneResponse.totalObjectsAssessed = filteredCloneDetails.length;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cloneResponse.oldCloneDetails = filteredOldCloneDetails as any;
                    cloneResponse.totalObjectsInViolation = totalObjectsInViolation;
                    cloneResponse.status =
                        totalObjectsInViolation === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
                    cloneResponse.objectsInViolation = objectsInViolation;
                    cloneResponse.cloneDriftMessage = `${filteredOldCloneDetails.length} out of ${filteredCloneDetails.length} clones are old and divergent`;
                }
            } else if (i.id === 'snapcenter-snapshot' && !('errorMessage' in i)) {
                if (snapcenterConfigsOptimized.includes(i.id)) {
                    i.status = AssessmentStatus.OPTIMIZED;
                    i.objectsInViolation = [];
                    i.violationDetails = [];
                    i.totalObjectsInViolation = 0;
                }
            } else if (
                i.type === 'compute' &&
                i.subType === 'configuration' &&
                ORACLE_COMPUTE_HOST_OS_DEMO_CONFIG_NAMES.has(i.id) &&
                oracleComputeHostOsDemoOptimizedConfigs.has(i.id) &&
                !('errorMessage' in i)
            ) {
                // Oracle compute host-OS items (transparent-hugepages, tcp-advanced-options, etc.)
                optimizeDriftConfig(i as ParameterDriftResponseType);
            } else if (i.type === 'storage' && i.subType === 'configuration' && !('errorMessage' in i)) {
                const isOracleComputeHostOsConfig = ORACLE_COMPUTE_HOST_OS_DEMO_CONFIG_NAMES.has(i.id);
                const isOptimized = isOracleComputeHostOsConfig
                    ? oracleComputeHostOsDemoOptimizedConfigs.has(i.id)
                    : osConfigsOptimized.includes(i.id) || storageConfigsOptimized.includes(i.id);
                if (isOptimized) {
                    optimizeDriftConfig(i as ParameterDriftResponseType);
                }
            } else if (i.type === 'storage' && i.subType === 'sizing' && !('errorMessage' in i)) {
                if (sizingConfigsOptimized.includes(i.id)) {
                    i.status = AssessmentStatus.OPTIMIZED;
                    i.objectsInViolation = [];
                    i.totalObjectsInViolation = 0;
                }
            } else if (i.type === 'storage' && i.subType === 'layout' && !('errorMessage' in i)) {
                if (!hasIscsiItems && STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS.includes(i.id)) {
                    // Non-iSCSI: these layout items should be filtered out entirely
                    return null as unknown as AssessmentItemType;
                }
                if (hasIscsiItems && storageConfigsOptimized.includes(i.id)) {
                    optimizeDriftConfig(i as ParameterDriftResponseType);
                }
            }

            return i;
        })
        .filter((item): item is AssessmentItemType => item !== null);
}

function optimizeDriftConfig(config: ParameterDriftResponseType) {
    config.status = AssessmentStatus.OPTIMIZED;
    config.objectsInViolation = [];
    config.violationDetails = [];
    config.totalObjectsInViolation = 0;
    return config;
}

function buildDemoComputeHostOsAssessmentInputs(metadata: Metadata): {
    computeHostOs: ResourceAssessmentData['computeHostOs'];
    oracleParamsConfigData: StorageIscsiAssessment;
} {
    const optimizedConfigs = new Set(metadata.oracleComputeHostOsDemoOptimized || []);
    const isTransparentHugepagesOptimized = optimizedConfigs.has(OptimizeOracleComputeHostOs.THP_DISABLE);
    const isTcpOptimized = optimizedConfigs.has(OptimizeOracleComputeHostOs.TCP_OPTIONS);
    const isFilesystemIoOptimized = optimizedConfigs.has(OptimizeOracleComputeHostOs.FILESYSTEM_IO_OPTIONS);
    const isMultiblockOptimized = optimizedConfigs.has(OptimizeOracleComputeHostOs.MULTIBLOCK_READCOUNT);

    return {
        computeHostOs: {
            transparentHugepages: {
                error: null,
                'thp-status': isTransparentHugepagesOptimized ? 'never' : 'always',
                'thp-disabled': isTransparentHugepagesOptimized
            },
            tcpAdvancedOptions: {
                error: null,
                'tcp-features': {
                    'tcp-sack-value': isTcpOptimized ? '1' : '0',
                    'tcp-sack-enabled': isTcpOptimized,
                    'tcp-timestamps-value': isTcpOptimized ? '1' : '0',
                    'tcp-timestamps-enabled': isTcpOptimized,
                    'tcp-window-scaling-value': isTcpOptimized ? '1' : '0',
                    'tcp-window-scaling-enabled': isTcpOptimized
                }
            }
        },
        oracleParamsConfigData: {
            os: {
                'oracle-parameters': {
                    error: null,
                    'filesystemio-options': {
                        found: true,
                        value: isFilesystemIoOptimized ? 'setall' : 'none'
                    }
                },
                'oracle-parameters-from-init': {
                    error: null,
                    'db-file-multiblock-read-count-in-init': isMultiblockOptimized
                        ? []
                        : [
                              {
                                  'parameter-found': true,
                                  'parameter-value': '128'
                              }
                          ]
                }
            }
        } as StorageIscsiAssessment
    };
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
    updateOracleComputeHostOsOptimizedConfigInResourceMetadata,
    createDeploymentMockDataInDBForPgSql,
    createOperatingSystemOptimizeJobMockData,
    demoGetFsxnVolIdsFromOntapVolIds,
    createOperatingSystemMpioSessionsOptimizeJobMockData,
    createStorageTierJobMockData,
    createEnableMpioJobMockData,
    prepareDemoSandboxMetadata,
    updateOptimizedConfigMetaData,
    handleGetMssqlAssessmentForDemo,
    handleGetOracleAssessmentForDemo,
    createDeploymentMockDataInDBForOracle,
    createAssessmentDataForOracle,
    updateAllOptimizedClonesDemoFlow,
    getMssqlStorageDataForDemo,
    loadAndModifyDemoFCIData,
    loadAndModifyDemoOracleISCSIData,
    getOracleTcoEbsDemoMarketingVolsAndInstanceType,
    ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE,
    getOracleTcoEbsDescribeVolumesForSimulator,
    buildDemoComputeHostOsAssessmentInputs
};
