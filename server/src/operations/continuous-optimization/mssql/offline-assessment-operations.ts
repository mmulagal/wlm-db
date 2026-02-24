import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, offline_assessment as OfflineAssessmentDBSchema } from '@prisma/client';
import {
    bulkUpsertOfflineAssessments,
    getOfflineAssessment,
    listOfflineAssessments as dbListOfflineAssessments,
    removeOfflineAssessmentData,
    OfflineAssessmentRecord
} from '../../../lib/database/offline-assessment';
import {
    MSSQLDriftAssessmentResponseType,
    RssConfigDriftResponseType,
    ParameterDriftResponseType,
    MSSQLDriftAssessmentResponse
} from '../../../routes/types/mssql-continuous-optimisation.types';
import { OfflineAssessmentListResponseType } from '../../../routes/types/offline-assessment.types';
import { calculateStorageDrift } from './storage-assessment-operations';
import { calculateRssConfigDrift } from './rssConfig-assessment-operations';
import { calculateMaxDOPDrift } from './maxdop-assessment-operations';
import { getHighAvailabilityDriftData } from './resilience-assessment-operation';
import { generateSqlResourceId, calculateRecommendedMaxDOP } from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import { HttpErrorCodes, AWS_REGIONS } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE
} from '../../../utils/continous-optimization-consts';
import {
    StorageAssessment,
    MaxDOPAssesment,
    ResourceAssessmentData,
    Metadata,
    HighAvailabilityAssessment,
    RssConfigAssesment,
    DatabaseInstance
} from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import GOLDEN_CONFIG from './golden-config';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { validateAssessment } from '../assessment-utils';

const logger = getLogger();

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
}

interface OneTimeWADHeadroomData {
    ssdStorageCapacityInBytes?: number;
    storageUsedInBytes?: number;
    storageAvailableInBytes?: number;
    headroomPercent?: number;
    aggregateCount?: number;
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
    errors?: Record<string, unknown>;
}

/**
 * Interface for instance-level details from offline assessment input
 */
interface OfflineAssessmentInstanceDetails {
    instanceDetails: MSSQLDatabaseInstanceData;
    mappedVolumes?: Record<string, unknown>;
    assessment?: Record<string, unknown>;
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

/**
 * Interface for MSSQL offline assessment metadata
 */
interface MSSQLOfflineAssessmentMetadataType {
    hostname: string;
    storageEndpoint: string;
    fsxId?: string;
    numberOfDatabaseInstances?: number;
    assessmentTimestamp: string;
    osVersion: string;
    deploymentType: 'FCI' | 'AOAG' | 'Standalone';
    baseDeploymentType?: 'FCI' | 'Standalone';
    databaseInstanceName: string;
    ec2InstanceId?: string;
    vmName?: string;
    virtualNetworkId?: string;
    virtualNetworkName?: string;
    region?: string;
    windowsClusterNodes?: Array<{
        Node: string;
        State?: string;
        Address?: string;
        ec2InstanceId?: string;
    }>;
}

/**
 * Calculate headroom drift assessment for one-time WAD using ONTAP aggregate data
 * This is a separate function from getHeadroomDrift which uses CloudWatch metrics
 *
 * @param headroomData - Headroom data collected from ONTAP REST API aggregates endpoint
 * @returns Headroom assessment result compatible with storage sizing drift response
 */
function calculateOneTimeWADHeadroomDrift(headroomData: OneTimeWADHeadroomData) {
    const { ssdStorageCapacityInBytes, storageUsedInBytes, headroomPercent } = headroomData;

    // Get headroom golden config using dot operator
    const headroomGoldenConfig = GOLDEN_CONFIG.sizing.find(data => data.parameter === 'headroom');
    if (!headroomGoldenConfig) {
        logger.warn('Headroom golden config not found');
        return undefined;
    }

    if (!ssdStorageCapacityInBytes || headroomPercent === undefined) {
        logger.warn('Headroom data not available in one-time WAD assessment');
        return undefined;
    }

    const minOptimizedHeadroomPercent = MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL;
    const minSsdStorageCapacityInBytes = 1024 * 1024 * 1024 * 1024; // 1 TiB in bytes

    let status: AssessmentStatus;
    if (headroomPercent < minOptimizedHeadroomPercent) {
        status = AssessmentStatus.UNDER_PROVISIONED;
    } else if (headroomPercent > 50 && ssdStorageCapacityInBytes > minSsdStorageCapacityInBytes) {
        // Over-provisioned only if capacity is > 1 TiB (smaller databases are considered optimized)
        status = AssessmentStatus.OVER_PROVISIONED;
    } else {
        status = AssessmentStatus.OPTIMIZED;
    }

    let recommendedSizeInGib = 0;
    if (status !== AssessmentStatus.OPTIMIZED && storageUsedInBytes) {
        // Target headroom: MIN_OPTIMIZED_HEADROOM_PERCENTAGE + 1% buffer
        const targetHeadroomPercent = minOptimizedHeadroomPercent + 1;
        const targetUsagePercent = (100 - targetHeadroomPercent) / 100;
        const recommendedSizeInBytes = storageUsedInBytes / targetUsagePercent;
        recommendedSizeInGib = Math.ceil(recommendedSizeInBytes / (1024 * 1024 * 1024));
    }

    return {
        name: 'headroom',
        recommended: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL}%`,
        status,
        severity: headroomGoldenConfig.severity,
        recommendation: headroomGoldenConfig.recommendation,
        tags: headroomGoldenConfig.tags,
        current: `${headroomPercent}%`,
        recommendedSizeInGib,
        totalObjectsAssessed: 1,
        totalObjectsInViolation: status !== AssessmentStatus.OPTIMIZED ? 1 : 0,
        resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM
    };
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
    const { rssConfig, headroom, highAvailability: hostLevelHighAvailability, errors } = hostLevelDetails || {};
    const {
        ec2InstanceId,
        hostname,
        storageEndpoint,
        fsxId,
        numberOfDatabaseInstances,
        assessmentTimestamp,
        osVersion,
        vmName,
        virtualNetworkId,
        virtualNetworkName
    } = metadata;

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let errorMessage: string = '';
    const managedInstances: DatabaseInstance[] = (
        await getPaginatedDatabaseInstances(accountId, { selectKeys: ['resource_id', 'database_instance_id'] })
    ).items;
    try {
        const records = Object.entries(instanceLevelDetails || {})
            .filter(([, data]) => data.instanceDetails?.databaseInstanceId)
            .map(([instanceName, instanceData]) => {
                const { instanceDetails, mappedVolumes, assessment } = instanceData;
                const {
                    databaseInstanceId,
                    windowsClusterNodes,
                    deploymentType,
                    baseDeploymentType,
                    isClustered,
                    isHadrEnabled,
                    windowsClusterName,
                    databaseVersion,
                    databaseEdition
                } = instanceDetails;

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
                            instance.resource_id === resourceId && instance.database_instance_id === databaseInstanceId
                    )
                ) {
                    errorMessage = `Offline assessment data upload failed. Database instance ${instanceName} is already managed.`;
                    throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
                }

                return {
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
                        errors: errors?.[instanceName] || errors || {}
                    },
                    mappedOntapVolumes: mappedVolumes || {},
                    metadata: {
                        databaseInstanceName: instanceName,
                        hostname,
                        storageEndpoint,
                        fsxId,
                        numberOfDatabaseInstances,
                        assessmentTimestamp,
                        osVersion,
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
                        databaseEdition
                    }
                } as OfflineAssessmentRecord;
            });

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
    try {
        assessmentData = JSON.parse(fileContent);
    } catch {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid JSON file format');
    }

    const { metadata, rawdata } = assessmentData;
    if (!metadata || !rawdata) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid assessment data format: missing metadata or rawdata');
    }

    const {
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
        region: metadataRegion
    } = metadata as unknown as MSSQLOfflineAssessmentMetadataType;

    if (!ec2InstanceId) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'EC2 instance ID is required in metadata');
    }

    const { hostLevelDetails, instanceLevelDetails } = rawdata as OfflineAssessmentInputRawData;

    if (!instanceLevelDetails || Object.keys(instanceLevelDetails).length === 0) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'At least one database instance is required');
    }

    const databaseInstanceName = Object.keys(instanceLevelDetails)[0];

    const { id: jobId } = await registerJob(accountId, '', '', {
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
            ec2InstanceId,
            hostname,
            storageEndpoint,
            fsxId,
            numberOfDatabaseInstances,
            assessmentTimestamp,
            osVersion,
            vmName,
            virtualNetworkId,
            virtualNetworkName
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
): Promise<MSSQLDriftAssessmentResponseType> {
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
        ec2InstanceId
    } = metadata;
    const { instanceLevelAssessment, rssConfig, headroom, hostLevelHighAvailability } = rawdata;
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
            heartbeat: hostLevelHighAvailability?.heartbeat
        }
    } as ResourceAssessmentData;

    const [storageAssessmentResponse, haResult] = await Promise.all([
        !isEmpty(instanceLevelAssessment)
            ? calculateStorageDrift(
                  accountId,
                  '',
                  '',
                  resourceId,
                  databaseInstanceId,
                  instanceLevelAssessment as unknown as StorageAssessment
              )
            : Promise.resolve(undefined),
        (deploymentType === 'FCI' || (deploymentType === 'AOAG' && baseDeploymentType === 'FCI')) && hasHAData
            ? getHighAvailabilityDriftData(
                  accountId,
                  '',
                  '',
                  resourceId,
                  hostname,
                  databaseInstanceId,
                  resourceAssessmentDataWithHA,
                  highAvailability as HighAvailabilityAssessment
              )
            : Promise.resolve(undefined)
    ]);

    const rssConfigResponse = !isEmpty(rssConfig)
        ? calculateRssConfigDrift(accountId, '', '', resourceId, assessmentMetadata, {
              rssConfig
          } as ResourceAssessmentData)
        : undefined;

    const maxDOPResponse = !isEmpty(maxDopData)
        ? calculateMaxDOPDrift(accountId, '', '', resourceId, databaseInstanceId, maxDopData)
        : undefined;

    // For offline assessments, only include cluster-quorum and heartbeat settings
    // Filter out shared-storage, drive-letter, and sqlServer-service
    const highAvailabilityResponse = Array.isArray(haResult)
        ? haResult.filter((item: any) => item?.name === 'cluster-quorum' || item?.name === 'heartbeat-settings')
        : undefined;

    // Add fsxId to storage.fileSystems for offline assessments
    // and add headroom assessment to sizing if available
    const fileSystemIdentifier = fsxId || storageEndpoint;
    let storageWithEndpoint = storageAssessmentResponse;
    if (storageAssessmentResponse && fileSystemIdentifier) {
        storageWithEndpoint = { ...storageAssessmentResponse, fileSystems: [fileSystemIdentifier] };
    }

    // Add headroom assessment to storage sizing if headroom data is available
    if (headroom && !isEmpty(headroom)) {
        const headroomDrift = calculateOneTimeWADHeadroomDrift(headroom);
        if (headroomDrift) {
            if (storageWithEndpoint && 'sizing' in storageWithEndpoint && storageWithEndpoint.sizing) {
                // Append headroom to existing sizing array
                storageWithEndpoint = {
                    ...storageWithEndpoint,
                    sizing: [...storageWithEndpoint.sizing, headroomDrift as any]
                };
            } else if (!storageWithEndpoint) {
                // Create minimal storage response with just headroom when no storage assessment exists
                storageWithEndpoint = {
                    configuration: { volumes: [], luns: [], os: [] },
                    sizing: [headroomDrift as any],
                    layout: [],
                    fileSystems: fileSystemIdentifier ? [fileSystemIdentifier] : []
                } as any;
            }
        }
    }

    const driftAssessmentData: MSSQLDriftAssessmentResponseType = {
        storage: storageWithEndpoint,
        rssConfig: rssConfigResponse as RssConfigDriftResponseType | undefined,
        maxDOP: maxDOPResponse as ParameterDriftResponseType | undefined,
        highAvailability: highAvailabilityResponse,
        lastAssessmentTimestamp: assessmentTimestamp
            ? new Date(assessmentTimestamp).getTime()
            : record.created_time.getTime(),
        storageEndpoint: fileSystemIdentifier,
        databaseInstanceName,
        ec2InstanceId,
        databaseHostName: hostname,
        deploymentType,
        baseDeploymentType: baseDeploymentType ?? ''
    };

    const { isValid, errors: validationErrors } = validateAssessment(MSSQLDriftAssessmentResponse, driftAssessmentData);
    if (!isValid) {
        logger.error('Offline assessment data validation failed', {
            accountId,
            resourceId,
            databaseInstanceId,
            validationErrors
        });
        return {} as MSSQLDriftAssessmentResponseType;
    }

    return driftAssessmentData;
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

    const assessmentItems = await Promise.all(
        items.map(
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
                    numberOfDatabaseInstances
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

export {
    uploadMssqlOfflineAssessment,
    fetchMssqlOfflineAssessment,
    fetchMssqlOfflineAssessmentPerAccount,
    deleteOfflineAssessmentRecord
};
