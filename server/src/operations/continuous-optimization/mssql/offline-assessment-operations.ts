import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, offline_assessment as OfflineAssessmentDBSchema } from '@prisma/client';
import {
    bulkUpsertOfflineAssessments,
    getOfflineAssessment,
    listOfflineAssessments as dbListOfflineAssessments,
    removeOfflineAssessmentData,
    updateOfflineAssessmentResults,
    OfflineAssessmentRecord
} from '../../../lib/database/offline-assessment';
import {
    runLayoutAssessment,
    getMultipathConfig,
    calculateRegistryStorageLayoutDrift,
    calculateRegistryMpioDrift,
    SqlInstanceAssessment,
    MultipathConfig
} from './ssm-doc-storage-assessment';
import {
    AssessmentItemType,
    AssessmentErrorItemType,
    GenericViolationResponseType
} from '../../../routes/types/continuous-optimization.types';
import { calculateStorageDrift } from './storage-assessment-operations';
import { calculateRssConfigDrift } from './rssConfig-assessment-operations';
import { calculateMaxDOPDrift } from './maxdop-assessment-operations';
import { calculateMTUAlignmentDrift } from './mtu-assessment-operations';
import calculateOneTimeWADCloneDrift from '../clone-assessment-utils';
import { getHighAvailabilityDriftData } from './resilience-assessment-operation';
import {
    generateSqlResourceId,
    calculateRecommendedMaxDOP,
    IS_DEMO_FLOW,
    parseAssessmentFileContent,
    validateWithSchema
} from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import {
    AWS_REGIONS,
    DatabaseTypes,
    HttpErrorCodes,
    MSSQL_DATABASE_TYPES,
    MSSQL_SYSTEM_DATABASES,
    RESOURCESTYPE
} from '../../../utils/consts';
import { AssessmentStatus, OptimizeStorageConfigs } from '../../../utils/continous-optimization-consts';
import {
    StorageAssessment,
    MaxDOPAssesment,
    ResourceAssessmentData,
    Metadata,
    HighAvailabilityAssessment,
    RssConfigAssesment,
    DatabaseInstance,
    CloneAssessment,
    VolumeRecord,
    VolumeDBMapEntry,
    LunRecord,
    MtuAlignmentAssessment
} from '../../../utils/common-types';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { loadAndModifyDemoFCIData } from '../../demo-operations';
import {
    MssqlAssessmentResponse,
    MssqlAssessmentResponseType,
    MssqlAssessmentResponseV1Type
} from '../../../routes/types/mssql-continuous-optimisation.types';
import { MSSQL_V1_MAP_CONFIG } from './assessment-operations';
import {
    mapAssessmentToV1,
    resolveAssessmentTypes,
    GOLDEN_CONFIG_LOOKUP,
    mssqlVolumeConfigData,
    mssqlLunConfigData
} from '../assessment-utils';
import { OfflineAssessmentListResponseType } from '../../../routes/types/offline-assessment.types';
import { ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE } from '../one-time-assessment-consts';
import { buildEc2FsxRelationship } from '../../cloud-manager/tagging-service-operations';
import { collectOntapAssessmentData } from '../ontap-proxy-collector';
import { OneTimeWADHeadroomData, calculateWADHeadroomDrift } from '../wad-headroom-utils';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

const VOLUME_LUN_DRIFT_IDS = new Set<string>([
    ...mssqlVolumeConfigData.map(({ id }) => id),
    ...mssqlLunConfigData.map(({ id }) => id),
    OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION,
    OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
]);

const OFFLINE_ASSESSMENT_SOURCE = {
    OFFLINE: 'offline',
    UNREGISTERED: 'unregistered'
} as const;

/**
 * Interface for database instance data from MSSQL offline assessment
 */
interface MSSQLDatabaseInstanceData {
    databaseInstanceId: string;
    windowsClusterNodes?: Array<{
        Node: string;
        State?: string;
        Address?: string;
        ec2InstanceId?: string;
    }>;
    deploymentType: 'FCI' | 'AOAG' | 'Standalone';
    baseDeploymentType?: 'FCI' | 'Standalone';
    isClustered: boolean;
    isHadrEnabled: boolean;
    windowsClusterName?: string | null;
    databaseVersion: string;
    databaseEdition: string;
    hostname: string;
    assessmentTimestamp: string;
    databaseInstanceName: string;
    ec2InstanceId?: string;
    availabilityGroups?: Array<{
        agName?: string;
        [key: string]: unknown;
    }>;
}

/**
 * Interface for host-level high availability data from offline assessment input
 */
interface OfflineAssessmentHostLevelHA {
    clusterQuorum?: {
        status: string;
        details: Record<string, unknown>;
        error?: string;
    };
    heartbeat?: {
        status: string;
        details: Record<string, unknown>;
        error?: string;
    };
    errors?: Record<string, unknown>;
}

/**
 * Interface for host-level details from offline assessment input
 */
interface OfflineAssessmentHostLevelDetails {
    rssConfig?: RssConfigAssesment;
    headroom?: OneTimeWADHeadroomData;
    highAvailability?: OfflineAssessmentHostLevelHA;
    mtuAlignment?: MtuAlignmentAssessment;
    errors?: Record<string, unknown>;
}

interface MSSQLOfflineMappedVolumes {
    volumes?: { records: VolumeRecord[] };
    volumeDBMap?: VolumeDBMapEntry[];
    luns?: LunRecord[];
}

/**
 * Per-volume snapshot-policy projection collected by the MSSQL WAD `snapshotPolicy` block.
 * Server-side `getSnapshotPolicyDriftData` consumes the same field shape via the storage
 * assessment volumes; this is a slimmer, drift-focused view emitted symmetrically to `clone`.
 */
interface MSSQLOfflineSnapshotPolicy {
    volumes?: Array<{
        name: string;
        uuid: string;
        'snapshot-policy'?: string;
        'most-recent-snapshot-timestamp'?: string;
    }>;
}

/**
 * Interface for instance-level details from offline assessment input
 */
interface OfflineAssessmentInstanceDetails {
    instanceDetails: MSSQLDatabaseInstanceData;
    mappedVolumes?: MSSQLOfflineMappedVolumes;
    assessment?: Record<string, unknown>;
    clone?: CloneAssessment;
    snapshotPolicy?: MSSQLOfflineSnapshotPolicy;
}

/**
 * Interface for offline assessment input rawdata structure
 */
interface OfflineAssessmentInputRawData {
    hostLevelDetails?: OfflineAssessmentHostLevelDetails;
    instanceLevelDetails?: Record<string, OfflineAssessmentInstanceDetails>;
}

/**
 * Interface for MSSQL offline assessment raw data
 */
interface MSSQLOfflineAssessmentRawData {
    instanceLevelAssessment?: MSSQLInstanceLevelAssessment;
    rssConfig?: ResourceAssessmentData;
    headroom?: OneTimeWADHeadroomData;
    hostLevelHighAvailability?: OfflineAssessmentHostLevelHA;
    mtuAlignment?: MtuAlignmentAssessment;
    clone?: CloneAssessment;
    snapshotPolicy?: MSSQLOfflineSnapshotPolicy;
    errors?: Record<string, unknown>;
}

/**
 * Interface for MSSQL instance-level assessment data
 */
interface MSSQLInstanceLevelAssessment {
    filesystemId?: string;
    errors?: Record<string, string | unknown>;
    volumes?: Array<{
        name: string;
        uuid: string;
        'thin-provision': boolean;
        'space-guarantee': string;
        'autosize-mode': string;
        'fractional-reserve': number;
        'snapshot-copy-reserve': number;
        'snapshot-autodelete': boolean;
        'snapshot-policy': string;
        'tiering-policy': string;
        'tiering-min-cooling-days'?: number;
        autosize: string;
    }>;
    sizing?: any;
    luns?: Array<{
        name: string;
        'os-type': string;
        'space-reservation-enabled': boolean;
        'space-allocation-allocated': boolean;
    }>;
    os?: any;
    layout?: any;
    maxDop?: MaxDOPAssesment;
    highAvailability?: HighAvailabilityAssessment;
}

interface MssqlUnregisteredAssessmentRawData {
    layoutAssessment?: Omit<SqlInstanceAssessment, 'mpio'>;
    mpioAssessment?: MultipathConfig;
    ontapStorageAssessments?: StorageAssessment[];
}

/**
 * Metadata for an unregistered-instance assessment record. `source: 'unregistered'` flags the
 * record as coming from this collection path (as opposed to a file-upload one-time WAD record).
 */
interface MssqlUnregisteredAssessmentMetadata {
    source: typeof OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED;
    databaseInstanceName: string;
    ec2InstanceId: string;
    assessmentTimestamp: string;
    [key: string]: unknown;
}

/**
 * Interface for MSSQL offline assessment metadata
 */
interface MSSQLOfflineAssessmentMetadataType {
    databaseType?: string;
    hostname: string;
    storageEndpoint: string;
    fsxId?: string;
    numberOfDatabaseInstances?: number;
    assessmentTimestamp: string;
    osVersion: string;
    scriptVersion?: string;
    deploymentType: 'FCI' | 'AOAG' | 'Standalone';
    baseDeploymentType?: 'FCI' | 'Standalone';
    databaseInstanceName: string;
    ec2InstanceId?: string;
    vmName?: string;
    virtualNetworkId?: string;
    virtualNetworkName?: string;
    region?: string;
    windowsClusterName?: string | null;
    windowsClusterNodes?: Array<{
        Node: string;
        State?: string;
        Address?: string;
        ec2InstanceId?: string;
    }>;
    fciName?: string;
    agName?: string;
}

async function processOfflineAssessmentUpload(
    accountId: string,
    jobId: string,
    metadata: Partial<MSSQLOfflineAssessmentMetadataType>,
    rawdata: OfflineAssessmentInputRawData,
    credentialsId?: string,
    region?: string
) {
    const { hostLevelDetails, instanceLevelDetails } = rawdata;
    const {
        rssConfig,
        headroom,
        highAvailability: hostLevelHighAvailability,
        mtuAlignment,
        errors
    } = hostLevelDetails || {};
    const {
        databaseType,
        ec2InstanceId,
        hostname,
        storageEndpoint,
        fsxId,
        numberOfDatabaseInstances,
        assessmentTimestamp,
        osVersion,
        scriptVersion,
        vmName,
        virtualNetworkId,
        virtualNetworkName,
        fciName
    } = metadata;

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let errorMessage: string = '';
    const managedInstances: DatabaseInstance[] = (
        await getPaginatedDatabaseInstances(accountId, {
            selectKeys: ['account_id', 'resource_id', 'database_instance_id']
        })
    ).items;
    try {
        const records = await Promise.all(
            Object.entries(instanceLevelDetails || {})
                .filter(([, data]) => data.instanceDetails?.databaseInstanceId)
                .map(async ([instanceName, instanceData]) => {
                    const { instanceDetails, mappedVolumes, assessment, clone, snapshotPolicy } = instanceData;
                    const {
                        databaseInstanceId,
                        windowsClusterNodes,
                        deploymentType,
                        baseDeploymentType,
                        isClustered,
                        isHadrEnabled,
                        windowsClusterName,
                        databaseVersion,
                        databaseEdition,
                        availabilityGroups
                    } = instanceDetails;

                    const agName = availabilityGroups?.[0]?.agName;

                    // Determine if FCI nodes should be used for resource ID
                    // FCI: direct FCI deployment
                    // AOAG+FCI: AOAG deployment with FCI as the base deployment type
                    const isFciOrAoagFci =
                        deploymentType === 'FCI' || (deploymentType === 'AOAG' && baseDeploymentType === 'FCI');

                    let resourceId = generateSqlResourceId(ec2InstanceId!);
                    if (isFciOrAoagFci && windowsClusterNodes?.length === 2) {
                        const partnerNode = windowsClusterNodes.find(
                            n => n.ec2InstanceId && n.ec2InstanceId !== ec2InstanceId
                        );
                        if (partnerNode?.ec2InstanceId) {
                            resourceId = generateSqlResourceId(ec2InstanceId!, partnerNode.ec2InstanceId);
                        }
                    }

                    if (
                        managedInstances.some(
                            instance =>
                                instance.resource_id === resourceId &&
                                instance.database_instance_id === databaseInstanceId
                        )
                    ) {
                        errorMessage = `Offline assessment data upload failed. Database instance ${instanceName} is already managed.`;
                        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
                    }

                    const record: OfflineAssessmentRecord = {
                        accountId,
                        ...(credentialsId && { credentialsId }),
                        ...(region && { region }),
                        resourceId,
                        databaseInstanceId,
                        databaseType: DATABASE_TYPE.mssql,
                        rawdata: {
                            instanceLevelAssessment: assessment || {},
                            rssConfig: rssConfig || {},
                            headroom: headroom || {},
                            hostLevelHighAvailability: hostLevelHighAvailability || {},
                            ...(mtuAlignment && !isEmpty(mtuAlignment) && { mtuAlignment }),
                            ...(clone && !isEmpty(clone) && { clone }),
                            ...(snapshotPolicy && !isEmpty(snapshotPolicy) && { snapshotPolicy }),
                            errors: errors?.[instanceName] || errors || {}
                        },
                        mappedOntapVolumes: mappedVolumes || {},
                        metadata: {
                            source: OFFLINE_ASSESSMENT_SOURCE.OFFLINE,
                            databaseType,
                            databaseInstanceName: instanceName,
                            hostname,
                            storageEndpoint,
                            fsxId,
                            numberOfDatabaseInstances,
                            assessmentTimestamp,
                            osVersion,
                            ...(scriptVersion && { scriptVersion }),
                            vmName,
                            ec2InstanceId,
                            virtualNetworkId,
                            virtualNetworkName,
                            deploymentType,
                            baseDeploymentType,
                            isClustered,
                            isHadrEnabled,
                            windowsClusterName,
                            windowsClusterNodes,
                            databaseVersion,
                            databaseEdition,
                            ...(fciName && { fciName }),
                            ...(agName && { agName })
                        }
                    } as OfflineAssessmentRecord;

                    try {
                        const driftResult = await fetchMssqlOfflineAssessment(
                            accountId,
                            record.resourceId,
                            record.databaseInstanceId,
                            credentialsId,
                            region,
                            undefined,
                            {
                                rawdata: record.rawdata,
                                mapped_ontap_volumes: record.mappedOntapVolumes,
                                metadata: record.metadata,
                                created_time: new Date()
                            } as OfflineAssessmentDBSchema
                        );
                        if (!isEmpty(driftResult)) {
                            record.assessmentResults = driftResult;
                        }
                    } catch (err) {
                        logger.warn('Failed to compute drift during mssql offline assessment upload', {
                            accountId,
                            resourceId,
                            databaseInstanceId,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }

                    return record;
                })
        );

        await bulkUpsertOfflineAssessments(records);

        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error: unknown) {
        errorMessage = error instanceof Error ? error.message : 'Upload failed';
        jobStatus = JOBSTATUS.FAILED;
        logger.error('Failed to process offline assessment upload', { accountId, jobId, error: errorMessage });
    } finally {
        await updateJobDetails(accountId, jobId, { status: jobStatus, endTime: Date.now(), error: errorMessage });
    }
}

async function uploadMssqlOfflineAssessment(
    accountId: string,
    fileContent: string,
    fileName?: string,
    credentialsId?: string,
    region?: string
) {
    let assessmentData: { metadata?: Record<string, unknown>; rawdata?: Record<string, unknown> };

    if (IS_DEMO_FLOW) {
        try {
            assessmentData = loadAndModifyDemoFCIData();
        } catch (error) {
            logger.error('Failed to load demo standalone data template, falling back to user upload', {
                accountId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Fall back to user's uploaded data if demo template fails
            assessmentData = parseAssessmentFileContent(fileContent);
        }
    } else {
        // Parse user's uploaded file in non-demo mode
        assessmentData = parseAssessmentFileContent(fileContent);
    }

    const { metadata, rawdata } = assessmentData;
    if (!metadata || !rawdata) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid assessment data format: missing metadata or rawdata');
    }

    const {
        databaseType,
        ec2InstanceId,
        hostname,
        storageEndpoint,
        fsxId,
        numberOfDatabaseInstances,
        assessmentTimestamp,
        osVersion,
        vmName,
        virtualNetworkId,
        virtualNetworkName,
        region: metadataRegion,
        fciName
    } = metadata as unknown as MSSQLOfflineAssessmentMetadataType;

    const isMssql = databaseType
        ? databaseType.toLowerCase() === DATABASE_TYPE.mssql.toLowerCase()
        : osVersion.toLowerCase().includes('windows'); // For existing collected files since databaseType was not included then

    if (!isMssql) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'Please upload a Microsoft SQL Server Onetime assessment file. This file appears to be for a different database type.'
        );
    }

    if (!ec2InstanceId) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'EC2 instance ID is required in metadata');
    }

    const { hostLevelDetails, instanceLevelDetails } = rawdata as OfflineAssessmentInputRawData;

    if (!instanceLevelDetails || Object.keys(instanceLevelDetails).length === 0) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'At least one database instance is required');
    }

    const databaseInstanceName = Object.keys(instanceLevelDetails)[0];

    const { id: jobId } = await registerJob(accountId, credentialsId || '', metadataRegion || '', {
        name: `Microsoft SQL Server offline assessment data upload for ${hostname}/${databaseInstanceName}`,
        description: fileName
            ? `Upload from file: ${fileName} - Database instance: ${databaseInstanceName}`
            : `Upload offline assessment data - Database instance: ${databaseInstanceName}`,
        resourceName: `${hostname}/${databaseInstanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT
    });

    processOfflineAssessmentUpload(
        accountId,
        jobId,
        {
            databaseType,
            ec2InstanceId,
            hostname,
            storageEndpoint,
            fsxId,
            numberOfDatabaseInstances,
            assessmentTimestamp,
            osVersion,
            vmName,
            virtualNetworkId,
            virtualNetworkName,
            fciName
        },
        { hostLevelDetails, instanceLevelDetails },
        credentialsId,
        metadataRegion || region
    );

    return { jobId };
}

async function fetchMssqlOfflineAssessment(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    fields?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<MssqlAssessmentResponseType> {
    logger.info('Fetching MSSQL offline assessment', {
        accountId,
        resourceId,
        databaseInstanceId,
        fields,
        credentialsId,
        region
    });

    const record = isEmpty(databaseRecord)
        ? await getOfflineAssessment(accountId, resourceId, databaseInstanceId)
        : databaseRecord;

    if (!record) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `WAD assessment not found for resource ${resourceId} and instance ${databaseInstanceId}`
        );
    }

    if ((record.metadata as { source?: string })?.source === OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED) {
        return fetchMssqlAwsDocAssessment(accountId, resourceId, databaseInstanceId, credentialsId, region, record);
    }

    const rawdata = (record.rawdata as MSSQLOfflineAssessmentRawData) || {};
    const metadata = (record.metadata as unknown as MSSQLOfflineAssessmentMetadataType) || {};
    const {
        hostname,
        storageEndpoint,
        fsxId,
        assessmentTimestamp,
        databaseInstanceName,
        deploymentType,
        baseDeploymentType,
        ec2InstanceId,
        windowsClusterName,
        fciName
    } = metadata;
    const { instanceLevelAssessment, rssConfig, headroom, hostLevelHighAvailability, mtuAlignment, clone } = rawdata;
    const { maxDop, highAvailability } = (instanceLevelAssessment as MSSQLInstanceLevelAssessment) || {};

    let maxDopData: MaxDOPAssesment | undefined;
    if (maxDop) {
        const { status, current, vcpuCount } = maxDop as MaxDOPAssesment;
        const recommendedMaxDOP = calculateRecommendedMaxDOP(vcpuCount || 0);
        const currentStatus =
            status || current === recommendedMaxDOP ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

        maxDopData = {
            current,
            recommendedMaxDOP,
            status: currentStatus
        };
    }

    const assessmentMetadata = {
        hostname
    } as unknown as Metadata;

    // Check if we have any HA data (either host-level or instance-level)
    const hasHAData = !isEmpty(highAvailability) || !isEmpty(hostLevelHighAvailability);

    // Build resourceAssessmentData with highAvailability containing clusterQuorum and heartbeat from host-level
    const resourceAssessmentDataWithHA = {
        ...rssConfig,
        highAvailability: {
            clusterQuorum: hostLevelHighAvailability?.clusterQuorum,
            heartbeat: hostLevelHighAvailability?.heartbeat,
            ...(windowsClusterName && { windowsClusterName })
        }
    } as ResourceAssessmentData;

    const [storageWithEndpoint, haResult] = await Promise.all([
        !isEmpty(instanceLevelAssessment)
            ? calculateStorageDrift(
                  accountId,
                  '',
                  '',
                  resourceId,
                  databaseInstanceId,
                  instanceLevelAssessment as unknown as StorageAssessment
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([]),
        (deploymentType === 'FCI' || deploymentType === 'AOAG') && hasHAData
            ? getHighAvailabilityDriftData(
                  accountId,
                  '',
                  '',
                  resourceId,
                  hostname,
                  databaseInstanceId,
                  resourceAssessmentDataWithHA,
                  highAvailability as HighAvailabilityAssessment,
                  ec2InstanceId || ''
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([])
    ]);

    const rssConfigResponse = !isEmpty(rssConfig)
        ? calculateRssConfigDrift(accountId, '', '', resourceId, assessmentMetadata, {
              rssConfig
          } as ResourceAssessmentData)
        : undefined;

    const maxDOPResponse = !isEmpty(maxDopData)
        ? calculateMaxDOPDrift(accountId, '', '', resourceId, databaseInstanceId, maxDopData)
        : undefined;

    const mtuAlignmentResponse =
        ec2InstanceId && mtuAlignment && !isEmpty(mtuAlignment)
            ? calculateMTUAlignmentDrift(
                  accountId,
                  '',
                  '',
                  resourceId,
                  { node1InstanceId: ec2InstanceId },
                  { mtuAlignment }
              )
            : undefined;

    // For offline assessments, only include cluster-quorum and heartbeat settings.
    const highAvailabilityResponse = haResult.filter(
        item => item?.id === 'cluster-quorum' || item?.id === 'heartbeat-settings'
    );

    const fileSystemIdentifier = fsxId || storageEndpoint;

    logger.info('MSSQL one-time WAD: calculating headroom drift', { fileSystemIdentifier });
    const headroomItem =
        headroom && !isEmpty(headroom) && fileSystemIdentifier
            ? calculateWADHeadroomDrift(
                  fileSystemIdentifier,
                  headroom,
                  MSSQL_GOLDEN_CONFIG.find(e => e.id === 'headroom'),
                  RESOURCESTYPE.MSSQL
              )
            : undefined;
    logger.info('MSSQL one-time WAD: headroom drift calculated', {
        fileSystemIdentifier,
        hasHeadroomItem: !!headroomItem
    });

    const cloneDriftResponse =
        clone && !isEmpty(clone)
            ? calculateOneTimeWADCloneDrift(
                  accountId,
                  resourceId,
                  databaseInstanceId,
                  clone as CloneAssessment,
                  DATABASE_TYPE.mssql
              )
            : undefined;

    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    [storageWithEndpoint, highAvailabilityResponse].forEach(item => {
        if (!isEmpty(item) && item.length > 0) {
            assessments.push(...item);
        }
    });
    [headroomItem, rssConfigResponse, maxDOPResponse, cloneDriftResponse, mtuAlignmentResponse].forEach(item => {
        if (!isEmpty(item)) {
            assessments.push(item);
        }
    });

    const { configIds: eligibleConfigIds } = resolveAssessmentTypes(
        DatabaseTypes.MS_SQL_SERVER,
        undefined,
        { deploymentType },
        new Set()
    );
    const mssqlLookup = GOLDEN_CONFIG_LOOKUP[DatabaseTypes.MS_SQL_SERVER];
    const assessedIds = new Set(assessments.map(a => a.id));
    eligibleConfigIds
        .filter(id => !assessedIds.has(id))
        .forEach(id => {
            const entry = mssqlLookup.get(id);
            if (entry) {
                assessments.push({ ...entry, errorMessage: ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE });
            }
        });

    const assessmentResponse = {
        assessments,
        dismissedConfigurations: [],
        metadata: {
            lastAssessmentTimestamp: assessmentTimestamp
                ? new Date(assessmentTimestamp).getTime()
                : record.created_time.getTime(),
            storageEndpoint: fileSystemIdentifier,
            databaseInstanceName,
            ec2InstanceId,
            databaseHostName: fciName && fciName.trim() !== '' ? fciName : hostname,
            deploymentType,
            baseDeploymentType: baseDeploymentType ?? ''
        }
    };

    const { isValid, errors } = validateWithSchema(MssqlAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid MSSQL offline assessment response', { errors });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    // Persist computed results so future GETs are served from cache
    updateOfflineAssessmentResults(accountId, resourceId, databaseInstanceId, assessmentResponse).catch(err =>
        logger.warn('Failed to persist MSSQL offline assessment results', {
            accountId,
            resourceId,
            databaseInstanceId,
            error: err instanceof Error ? err.message : String(err)
        })
    );

    return assessmentResponse;
}

async function fetchMssqlAwsDocAssessment(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<MssqlAssessmentResponseType> {
    logger.info('Fetching MSSQL unregistered-instance assessment', {
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region
    });

    const record = isEmpty(databaseRecord)
        ? await getOfflineAssessment(accountId, resourceId, databaseInstanceId)
        : databaseRecord;

    if (!record) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `Assessment not found for resource ${resourceId} and instance ${databaseInstanceId}`
        );
    }

    const { layoutAssessment, mpioAssessment, ontapStorageAssessments } =
        (record.rawdata as MssqlUnregisteredAssessmentRawData) || {};
    const { databaseInstanceName, ec2InstanceId, assessmentTimestamp } =
        (record.metadata as unknown as MssqlUnregisteredAssessmentMetadata) || {};

    // The stored record carries the credentialsId/region used at collection time; fall back to
    // that when the caller doesn't supply them (e.g. a plain GET after the async collection job).
    const effectiveCredentialsId = credentialsId ?? record.credentials_id ?? undefined;
    const effectiveRegion = region ?? record.region ?? undefined;

    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    if (layoutAssessment) {
        assessments.push(
            ...calculateRegistryStorageLayoutDrift([layoutAssessment as unknown as SqlInstanceAssessment])
        );
    }
    if (mpioAssessment) {
        assessments.push(...calculateRegistryMpioDrift([{ mpio: mpioAssessment } as unknown as SqlInstanceAssessment]));
    }

    if (ontapStorageAssessments && ontapStorageAssessments.length > 0) {
        if (!effectiveCredentialsId || !effectiveRegion) {
            // Most volume/LUN drift is computed purely from the already-collected ontapStorageAssessments;
            logger.warn('Computing volume/LUN drift without credentialsId/region on unregistered instance', {
                accountId,
                resourceId,
                databaseInstanceId
            });
        }
        assessments.push(
            ...(await computeVolumeLunDrift(
                accountId,
                effectiveCredentialsId ?? '',
                effectiveRegion ?? '',
                resourceId,
                databaseInstanceId,
                ontapStorageAssessments
            ))
        );
    }

    const { configIds: eligibleConfigIds } = resolveAssessmentTypes(
        DatabaseTypes.MS_SQL_SERVER,
        undefined,
        {},
        new Set()
    );
    const mssqlLookup = GOLDEN_CONFIG_LOOKUP[DatabaseTypes.MS_SQL_SERVER];
    const assessedIds = new Set(assessments.map(a => a.id));
    eligibleConfigIds
        .filter(id => !assessedIds.has(id))
        .forEach(id => {
            const entry = mssqlLookup.get(id);
            if (entry) {
                assessments.push({ ...entry, errorMessage: ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE });
            }
        });

    const parsedAssessmentTimestamp = assessmentTimestamp ? new Date(assessmentTimestamp).getTime() : NaN;

    const assessmentResponse = {
        assessments,
        dismissedConfigurations: [],
        metadata: {
            lastAssessmentTimestamp: Number.isFinite(parsedAssessmentTimestamp)
                ? parsedAssessmentTimestamp
                : record.created_time.getTime(),
            databaseInstanceName,
            ec2InstanceId
        }
    };

    const { isValid, errors } = validateWithSchema(MssqlAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid MSSQL unregistered-instance assessment response', { errors });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    updateOfflineAssessmentResults(accountId, resourceId, databaseInstanceId, assessmentResponse).catch(err =>
        logger.warn('Failed to persist MSSQL unregistered-instance assessment results', {
            accountId,
            resourceId,
            databaseInstanceId,
            error: err
        })
    );

    return assessmentResponse;
}

async function collectScopedOntapStorageAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string
): Promise<StorageAssessment[] | undefined> {
    const relationship = await buildEc2FsxRelationship(accountId, credentialsId, region);
    const scopedEc2s = relationship.ec2s.filter(ec2 => ec2.instanceId === ec2InstanceId);
    if (scopedEc2s.length === 0) {
        return undefined;
    }

    const results = await collectOntapAssessmentData(accountId, { ec2s: scopedEc2s });
    const mssqlAssessments = results
        .filter(result => result.workloadType === DATABASE_TYPE.mssql)
        .map(result => result.storageAssessment as unknown as StorageAssessment);

    return mssqlAssessments.length > 0 ? mssqlAssessments : undefined;
}

function filterToVolumeLunDriftItems(
    items: (AssessmentItemType | AssessmentErrorItemType)[]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    return items.filter(item => VOLUME_LUN_DRIFT_IDS.has(item.id));
}

function dedupeViolationDetails(violationDetails: GenericViolationResponseType[]): GenericViolationResponseType[] {
    const seenKeys = new Set<string>();
    return violationDetails.filter(({ objectName, objectType, value }) => {
        const key = `${objectName}|${objectType}|${value}`;
        const isDuplicate = seenKeys.has(key);
        seenKeys.add(key);
        return !isDuplicate;
    });
}

function mergeStorageDriftItemsById(
    driftResultsPerFilesystem: (AssessmentItemType | AssessmentErrorItemType)[][]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    const entriesById = new Map<string, (AssessmentItemType | AssessmentErrorItemType)[]>();
    driftResultsPerFilesystem.flat().forEach(item => {
        entriesById.set(item.id, [...(entriesById.get(item.id) ?? []), item]);
    });

    return [...entriesById.values()].map(entries => {
        const successfulEntries = entries.filter((entry): entry is AssessmentItemType => !('errorMessage' in entry));
        if (successfulEntries.length === 0) {
            return entries[0];
        }
        return successfulEntries.reduce((merged, entry) => {
            const violationDetails = dedupeViolationDetails([
                ...(merged.violationDetails ?? []),
                ...(entry.violationDetails ?? [])
            ]);
            return {
                ...entry,
                status:
                    merged.status === AssessmentStatus.NOT_OPTIMIZED || entry.status === AssessmentStatus.NOT_OPTIMIZED
                        ? AssessmentStatus.NOT_OPTIMIZED
                        : AssessmentStatus.OPTIMIZED,
                objectsInViolation: [
                    ...new Set([...(merged.objectsInViolation ?? []), ...(entry.objectsInViolation ?? [])])
                ],
                violationDetails,
                totalObjectsAssessed: merged.totalObjectsAssessed + entry.totalObjectsAssessed,
                totalObjectsInViolation: violationDetails.length
            };
        });
    });
}

async function computeVolumeLunDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceId: string,
    ontapStorageAssessments: StorageAssessment[]
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    const perFilesystemDrift = await Promise.all(
        ontapStorageAssessments.map(storageAssessment =>
            calculateStorageDrift(accountId, credentialsId, region, resourceId, databaseInstanceId, storageAssessment)
        )
    );
    return filterToVolumeLunDriftItems(mergeStorageDriftItemsById(perFilesystemDrift));
}

async function runLayoutSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<Omit<SqlInstanceAssessment, 'mpio'> | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Registry storage layout assessment',
        description: `Registry-based storage layout assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    try {
        const result = await runLayoutAssessment(credentialsId, region, ec2InstanceId, instanceName, accountId);
        await updateJobDetails(accountId, subJobId, { status: JOBSTATUS.COMPLETED, endTime: Date.now() });
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Registry layout assessment failed';
        logger.error('Failed to run registry-based storage layout assessment for unregistered MSSQL instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            error
        });
        await updateJobDetails(accountId, subJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        return undefined;
    }
}

async function runMpioSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<MultipathConfig | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Registry MPIO assessment',
        description: `Registry-based MPIO assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    try {
        const result = await getMultipathConfig(credentialsId, region, ec2InstanceId, accountId);
        await updateJobDetails(accountId, subJobId, { status: JOBSTATUS.COMPLETED, endTime: Date.now() });
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Registry MPIO assessment failed';
        logger.error('Failed to run registry-based MPIO assessment for unregistered MSSQL instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            error
        });
        await updateJobDetails(accountId, subJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        return undefined;
    }
}

async function runOntapSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<StorageAssessment[] | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'ONTAP volume/LUN storage assessment',
        description: `ONTAP volume/LUN storage assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    try {
        const result = await collectScopedOntapStorageAssessment(accountId, credentialsId, region, ec2InstanceId);
        await updateJobDetails(accountId, subJobId, { status: JOBSTATUS.COMPLETED, endTime: Date.now() });
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'ONTAP storage assessment failed';
        logger.warn(
            'Failed to collect ONTAP storage assessment for unregistered instance; continuing with other findings',
            { accountId, credentialsId, region, ec2InstanceId, error: errorMessage }
        );
        await updateJobDetails(accountId, subJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        return undefined;
    }
}

async function processMssqlUnregisteredAssessment(
    accountId: string,
    jobId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string
) {
    let unexpectedError: string | undefined;
    try {
        const resourceId = ec2InstanceId;

        const [layoutAssessment, mpioAssessment, ontapStorageAssessments] = await Promise.all([
            runLayoutSubAssessment(accountId, credentialsId, region, ec2InstanceId, instanceName, jobId),
            runMpioSubAssessment(accountId, credentialsId, region, ec2InstanceId, instanceName, jobId),
            runOntapSubAssessment(accountId, credentialsId, region, ec2InstanceId, instanceName, jobId)
        ]);

        if (layoutAssessment || mpioAssessment || (ontapStorageAssessments && ontapStorageAssessments.length > 0)) {
            const rawdata: MssqlUnregisteredAssessmentRawData = {
                ...(layoutAssessment && { layoutAssessment }),
                ...(mpioAssessment && { mpioAssessment }),
                ...(ontapStorageAssessments ? { ontapStorageAssessments } : {})
            };
            const metadata: MssqlUnregisteredAssessmentMetadata = {
                source: OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED,
                databaseInstanceName: instanceName,
                ec2InstanceId,
                assessmentTimestamp: new Date().toISOString()
            };

            const assessmentResults = await fetchMssqlAwsDocAssessment(
                accountId,
                resourceId,
                instanceName,
                credentialsId,
                region,
                { rawdata, metadata, created_time: new Date() } as unknown as OfflineAssessmentDBSchema
            );

            await bulkUpsertOfflineAssessments([
                {
                    accountId,
                    credentialsId,
                    region,
                    resourceId,
                    databaseInstanceId: instanceName,
                    databaseType: DATABASE_TYPE.mssql,
                    rawdata,
                    metadata,
                    assessmentResults
                }
            ]);
        } else {
            unexpectedError =
                'No assessable data collected: instance is not clustered, has no MPIO configuration, ' +
                'and has no EC2-FSx relationship';
        }
    } catch (error: unknown) {
        unexpectedError = error instanceof Error ? error.message : 'Assessment failed';
        logger.error('Failed to process MSSQL unregistered-instance assessment', {
            accountId,
            jobId,
            ec2InstanceId,
            instanceName,
            error
        });
    } finally {
        if (unexpectedError) {
            // Something broke outside the 3 subjobs themselves (e.g. bulkUpsert failing) — force
            // FAILED rather than letting it be derived from (already-successful) subjob statuses.
            await updateJobDetails(accountId, jobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: unexpectedError
            }).catch(updateError =>
                logger.error('Failed to update job details for MSSQL unregistered-instance assessment', {
                    accountId,
                    jobId,
                    error: updateError
                })
            );
        } else {
            // Derive main job status from the 3 subjobs: COMPLETED if all succeeded, WARNING if
            // some failed, FAILED if all failed (existing updateParentJobStatus aggregation semantics).
            await updateParentJobStatus(accountId, jobId).catch(updateError =>
                logger.error('Failed to update parent job status for MSSQL unregistered-instance assessment', {
                    accountId,
                    jobId,
                    error: updateError
                })
            );
        }
    }
}

async function triggerMssqlUnregisteredAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string
) {
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL Server storage assessment for ${ec2InstanceId}/${instanceName}`,
        description: `One-time storage assessment for unregistered SQL Server instance ${instanceName} on ${ec2InstanceId}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT
    });

    processMssqlUnregisteredAssessment(accountId, jobId, credentialsId, region, ec2InstanceId, instanceName).catch(
        error =>
            logger.error('Unhandled error in MSSQL unregistered-instance assessment', {
                accountId,
                jobId,
                ec2InstanceId,
                instanceName,
                error
            })
    );

    return { jobId };
}

async function fetchMssqlOfflineAssessmentPerAccount(
    accountId: string,
    pageSize: number = 50,
    credentialsId?: string,
    region?: string,
    nextToken?: string
): Promise<OfflineAssessmentListResponseType> {
    logger.info('Listing MSSQL offline assessments', {
        accountId,
        credentialsId,
        region
    });

    const items = await dbListOfflineAssessments({
        accountId,
        credentialsId,
        region,
        databaseType: DATABASE_TYPE.mssql,
        pageSize,
        nextToken
    });

    if (isEmpty(items)) {
        logger.info(`No offline assessments found for account ${accountId}.`);
        return { items: [], count: 0 };
    }

    const fileUploadItems = items.filter(
        item => (item.metadata as { source?: string })?.source !== OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED
    );

    const assessmentItems = await Promise.all(
        fileUploadItems.map(
            throat(3, async item => {
                const {
                    resource_id: resourceId,
                    database_instance_id: databaseInstanceId,
                    metadata,
                    credentials_id: itemCredentialsId,
                    region: itemRegion
                } = item;
                const {
                    databaseInstanceName,
                    windowsClusterNodes,
                    vmName,
                    ec2InstanceId: vmInstanceId,
                    virtualNetworkId,
                    virtualNetworkName,
                    numberOfDatabaseInstances,
                    agName
                } = metadata as unknown as MSSQLOfflineAssessmentMetadataType;
                const clusterNodes = windowsClusterNodes?.map(node => ({
                    vmInstanceId: node.ec2InstanceId || '',
                    nodeName: node.Node,
                    nodeState: node.State
                }));

                const recordCredentialsId = itemCredentialsId || credentialsId || '';
                const recordRegion = itemRegion || region || '';
                const regionName = recordRegion && AWS_REGIONS.has(recordRegion) ? AWS_REGIONS.get(recordRegion) : '';
                const response = {
                    resourceId,
                    databaseInstanceId,
                    databaseInstanceName,
                    credentialsId: recordCredentialsId,
                    region: recordRegion,
                    regionName,
                    vmName,
                    vmInstanceId,
                    virtualNetworkId,
                    virtualNetworkName,
                    numberOfDatabaseInstances,
                    agName,
                    clusterNodes
                };

                try {
                    const assessments = await fetchMssqlOfflineAssessment(
                        accountId,
                        resourceId,
                        databaseInstanceId,
                        recordCredentialsId ?? undefined,
                        recordRegion ?? undefined,
                        undefined,
                        item
                    );
                    return { ...response, assessments };
                } catch (error: any) {
                    logger.error(`Error fetching MSSQL assessment for ${resourceId}/${databaseInstanceId}:`, error);
                    return { ...response, error: error.message || 'Failed to fetch assessment' };
                }
            })
        )
    );
    const responseNextToken = items.length >= pageSize ? items[items.length - 1]?.id : undefined;

    return {
        items: assessmentItems,
        count: assessmentItems.length,
        ...(responseNextToken && { nextToken: responseNextToken })
    };
}

interface UserDatabaseLayoutEntry {
    lunPath: string;
    driveLetter?: string;
    databaseDetails?: Array<{ name: string; sizeInMb: number; collationName?: string }>;
}

interface UserDatabaseLayout {
    data?: UserDatabaseLayoutEntry[];
    log?: UserDatabaseLayoutEntry[];
    tempDb?: UserDatabaseLayoutEntry[];
}

type DbMapEntry = {
    totalSizeBytes: number;
    collationName?: string;
    dataLuns: { name: string; driveLetter?: string }[];
    logLuns: { name: string; driveLetter?: string }[];
};

function accumulateLunEntries(
    dbMap: Map<string, DbMapEntry>,
    entries: UserDatabaseLayoutEntry[],
    lunKey: 'dataLuns' | 'logLuns'
) {
    for (const entry of entries) {
        for (const db of entry.databaseDetails || []) {
            if (!dbMap.has(db.name)) {
                dbMap.set(db.name, { totalSizeBytes: 0, dataLuns: [], logLuns: [] });
            }
            const rec = dbMap.get(db.name)!;
            rec.totalSizeBytes += (db.sizeInMb || 0) * 1024 * 1024;
            if (!rec.collationName && db.collationName) {
                rec.collationName = db.collationName;
            }
            rec[lunKey].push({ name: entry.lunPath, driveLetter: entry.driveLetter });
        }
    }
}

function mapOfflineAssessmentRecord(record: OfflineAssessmentDBSchema) {
    const { instanceLevelAssessment = {} } = (record.rawdata as MSSQLOfflineAssessmentRawData) || {};
    const { databaseInstanceName, fsxId, storageEndpoint, deploymentType, baseDeploymentType, agName, hostname } =
        (record.metadata as unknown as MSSQLOfflineAssessmentMetadataType) || {};

    const fileSystemId =
        (instanceLevelAssessment as MSSQLInstanceLevelAssessment).filesystemId || fsxId || storageEndpoint;
    const { data = [], log = [] } = ((instanceLevelAssessment as MSSQLInstanceLevelAssessment).layout?.[
        'user-database-layout'
    ] ?? {}) as UserDatabaseLayout;

    const dbMap = new Map<string, DbMapEntry>();
    accumulateLunEntries(dbMap, data, 'dataLuns');
    accumulateLunEntries(dbMap, log, 'logLuns');

    const databases = Array.from(dbMap.entries()).map(
        ([name, { totalSizeBytes, collationName, dataLuns, logLuns }]) => ({
            name,
            type: MSSQL_SYSTEM_DATABASES.includes(name.toLowerCase())
                ? MSSQL_DATABASE_TYPES.SYSTEM
                : MSSQL_DATABASE_TYPES.USER,
            size: totalSizeBytes,
            collation: collationName || '',
            luns: { dataFiles: dataLuns, logFiles: logLuns }
        })
    );

    return {
        resourceId: record.resource_id,
        databaseInstanceId: record.database_instance_id,
        databases,
        count: databases.length,
        ...(databaseInstanceName && { databaseInstanceName }),
        ...(fileSystemId && { fileSystemId }),
        ...(hostname && { hostname }),
        ...(deploymentType && { deploymentType }),
        ...(baseDeploymentType && { baseDeploymentType }),
        ...(agName && { agName })
    };
}

async function listMssqlOfflineAssessmentDatabasesPerAccount(
    accountId: string,
    options: {
        pageSize?: number;
        credentialsId?: string;
        region?: string;
        nextToken?: string;
    } = {}
) {
    const { pageSize = 50, credentialsId, region, nextToken } = options;

    logger.info('Listing MSSQL offline assessment databases', {
        accountId,
        credentialsId,
        region,
        pageSize,
        nextToken
    });

    const records = await dbListOfflineAssessments({
        accountId,
        credentialsId,
        region,
        databaseType: DATABASE_TYPE.mssql,
        pageSize,
        nextToken
    });

    if (isEmpty(records)) {
        logger.info(`No one-time assessment found for account ${accountId}.`);
        return { items: [], count: 0 };
    }

    // Exclude AWS-doc/unregistered-instance rows, same as fetchMssqlOfflineAssessmentPerAccount.
    const items = records
        .filter(record => (record.metadata as { source?: string })?.source !== OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED)
        .map(mapOfflineAssessmentRecord);
    const responseNextToken = records.length >= pageSize ? records[records.length - 1]?.id : undefined;

    return {
        items,
        count: items.length,
        ...(responseNextToken && { nextToken: responseNextToken })
    };
}

async function listMssqlOfflineAssessmentDatabases(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    options: {
        credentialsId?: string;
        region?: string;
    } = {}
) {
    const { credentialsId, region } = options;

    logger.info('Getting MSSQL offline assessment databases for instance', {
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region
    });

    const [records] = await dbListOfflineAssessments({
        accountId,
        credentialsId,
        region,
        databaseType: DATABASE_TYPE.mssql,
        resourceId,
        databaseInstanceId
    });

    if (isEmpty(records)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `One-time assessment not found for resource ${resourceId} and instance ${databaseInstanceId}`
        );
    }

    return mapOfflineAssessmentRecord(records);
}

async function deleteOfflineAssessmentRecord(
    accountId: string,
    databaseHostIds: string,
    databaseType: DATABASE_TYPE = DATABASE_TYPE.mssql
) {
    logger.info('Delete offline assessment record', { accountId, databaseHostIds });

    const resourcesIdList = databaseHostIds.split(',').filter(Boolean);
    try {
        const response = await removeOfflineAssessmentData(accountId, resourcesIdList, databaseType);
        if (response.count === 0) {
            logger.error('No offline assessment found to delete', { accountId, databaseHostIds });
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `Offline assessment id ${databaseHostIds} not found for account ${accountId}`
            );
        }
        return response;
    } catch (error: any) {
        if (error.status === HttpErrorCodes.NOT_FOUND) {
            throw createError(error);
        }
        logger.error('Error deleting offline assessment', { error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error deleting offline assessment ${error}`);
    }
}

async function fetchMssqlOfflineAssessmentV1(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    fields?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<MssqlAssessmentResponseV1Type> {
    const v2Response = await fetchMssqlOfflineAssessment(
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region,
        fields,
        databaseRecord
    );
    // v1 schemas omit `id`/`categories`; Fastify's response serializer drops them from the payload.
    return mapAssessmentToV1(v2Response, MSSQL_V1_MAP_CONFIG) as unknown as MssqlAssessmentResponseV1Type;
}

async function fetchMssqlOfflineAssessmentPerAccountV1(
    accountId: string,
    pageSize?: number,
    credentialsId?: string,
    region?: string,
    nextToken?: string
) {
    const v2Result = await fetchMssqlOfflineAssessmentPerAccount(accountId, pageSize, credentialsId, region, nextToken);

    return {
        ...v2Result,
        items: v2Result.items.map(item => ({
            ...item,
            assessments: item.assessments
                ? (mapAssessmentToV1(item.assessments, MSSQL_V1_MAP_CONFIG) as unknown as MssqlAssessmentResponseV1Type)
                : undefined
        }))
    };
}

export {
    uploadMssqlOfflineAssessment,
    fetchMssqlOfflineAssessment,
    fetchMssqlOfflineAssessmentV1,
    fetchMssqlOfflineAssessmentPerAccount,
    fetchMssqlOfflineAssessmentPerAccountV1,
    listMssqlOfflineAssessmentDatabasesPerAccount,
    listMssqlOfflineAssessmentDatabases,
    deleteOfflineAssessmentRecord,
    fetchMssqlAwsDocAssessment,
    triggerMssqlUnregisteredAssessment
};
