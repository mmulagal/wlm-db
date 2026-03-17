import createError from 'http-errors';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, offline_assessment as OfflineAssessmentDBSchema } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import {
    bulkUpsertOfflineAssessments,
    getOfflineAssessment,
    listOfflineAssessments as dbListOfflineAssessments,
    removeOfflineAssessmentData,
    OfflineAssessmentRecord
} from '../../../lib/database/offline-assessment';
import { OfflineAssessmentUploadResponseType } from '../../../routes/types/offline-assessment.types';
import {
    OracleDriftAssessmentResponse,
    OracleDriftAssessmentResponseType,
    StorageParameterDriftResponseType,
    GenericParameterDriftResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import {
    generateSqlResourceId,
    parseAssessmentFileContent,
    calculateFsxStorageCapacityForHeadroomOptimization,
    IS_DEMO_FLOW,
    validateWithSchema
} from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import { AWS_REGIONS, HttpErrorCodes, RESOURCESTYPE } from '../../../utils/consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { DatabaseInstance } from '../../../utils/common-types';
import { OracleMappedOntapVolumesResponse } from '../../workloads/oracle/common-types';
import { calculateStorageDrift } from './storage-assessment-operations';
import { ISCIOSAssessment, NFSOSAssessment, StorageAssessment } from './common-types';
import { AssessmentStatus, MIN_OPTIMIZED_HEADROOM_PERCENTAGE } from '../../../utils/continous-optimization-consts';
import GOLDEN_CONFIG from './golden-config';
import { loadAndModifyDemoOracleISCSIData } from '../../demo-operations';

const logger = getLogger();

/** Top-level `metadata` block from the one-time WAD assessment JSON produced by the Oracle Python script. */
interface OracleOfflineAssessmentMetadataType {
    hostname: string;
    storageEndpoint: string;
    fsxId?: string;
    numberOfDatabaseInstances?: number;
    assessmentTimestamp: string;
    osVersion: string;
    ec2InstanceId?: string;
    vmName?: string;
    virtualNetworkId?: string;
    virtualNetworkName?: string;
    vmPlatform?: string;
    region?: string;
    oracleSid?: string;
    oracleHome?: string;
    deploymentType?: string;
    pdbCount?: number;
    scriptVersion?: string;
    databaseType?: string;
    databaseInstanceName?: string;
    databaseVersion?: string;
    isCDB?: boolean;
}

/** Flattened per-instance rawdata persisted in the DB — distinct from the upload shape; stores a single instance's storage + OS assessment. */
interface OracleStoredRawData {
    instanceLevelAssessment?: Record<string, unknown>;
    hostLevelDetails?: Record<string, unknown>;
    os?: ISCIOSAssessment | NFSOSAssessment;
    errors?: string[];
    pluggableDatabases?: Array<{ pdbName: string; pdbId?: string; pdbStatus?: string }>;
    isDataGuardDeployed?: boolean;
    dataguardDetails?: Record<string, unknown>;
}

/** Oracle instance-level metadata (version, home, SID, CDB flag) nested inside each entry of `instanceLevelDetails`. */
interface OracleInstanceDetails {
    databaseVersion?: string;
    databaseName?: string;
    oracleHome?: string;
    deploymentType?: string;
    sid?: string;
    isCDB?: boolean;
    pdbCount?: number;
    error?: string;
    [key: string]: unknown;
}

/** Single Oracle instance entry from the uploaded JSON's `rawdata.instanceLevelDetails` map (keyed by SID). */
interface OracleOfflineAssessmentInstanceData {
    instanceDetails?: OracleInstanceDetails;
    mappedOntapVolumes?: OracleMappedOntapVolumesResponse;
    storage?: StorageAssessment;
    os?: ISCIOSAssessment | NFSOSAssessment;
    pluggableDatabases?: Array<{ pdbName: string; pdbId?: string; pdbStatus?: string }>;
    isDataGuardDeployed?: boolean;
    dataguardDetails?: Record<string, unknown>;
}

/** Top-level `rawdata` block from the uploaded assessment JSON — maps SID keys to per-instance data plus host-level details. */
interface OracleOfflineAssessmentRawData {
    hostLevelDetails?: Record<string, unknown>;
    instanceLevelDetails?: Record<string, OracleOfflineAssessmentInstanceData>;
    errors?: string[];
}

/** FSx aggregate headroom metrics from `hostLevelDetails.headroom`, used to compute storage over/under-provisioning drift. */
interface OneTimeWADHeadroomData {
    ssdStorageCapacityInBytes?: number;
    storageUsedInBytes?: number;
    storageAvailableInBytes?: number;
    headroomPercent?: number;
    aggregateCount?: number;
}

function calculateOracleOneTimeWADHeadroomDrift(fsxFileSystemId: string, headroomData: OneTimeWADHeadroomData) {
    const { ssdStorageCapacityInBytes, storageUsedInBytes, headroomPercent } = headroomData;

    const headroomGoldenConfig = GOLDEN_CONFIG.sizing.find(data => data.parameter === 'headroom');
    if (!headroomGoldenConfig) {
        logger.warn('Headroom golden config not found');
        return undefined;
    }

    if (!ssdStorageCapacityInBytes || headroomPercent === undefined) {
        logger.warn('Headroom data not available in one-time WAD assessment');
        return undefined;
    }

    const minOptimizedHeadroomPercent = MIN_OPTIMIZED_HEADROOM_PERCENTAGE.ORACLE;
    const minSsdStorageCapacityInBytes = 1024 * 1024 * 1024 * 1024;

    let status: AssessmentStatus;
    if (headroomPercent < minOptimizedHeadroomPercent) {
        status = AssessmentStatus.UNDER_PROVISIONED;
    } else if (headroomPercent > 50 && ssdStorageCapacityInBytes > minSsdStorageCapacityInBytes) {
        status = AssessmentStatus.OVER_PROVISIONED;
    } else {
        status = AssessmentStatus.OPTIMIZED;
    }

    let recommendedSizeInGib = 0;
    if (status !== AssessmentStatus.OPTIMIZED && storageUsedInBytes) {
        recommendedSizeInGib = calculateFsxStorageCapacityForHeadroomOptimization(
            storageUsedInBytes,
            ssdStorageCapacityInBytes,
            RESOURCESTYPE.ORACLE
        );
    }

    return {
        ...headroomGoldenConfig,
        status,
        current: `${headroomPercent}%`,
        recommended: `${minOptimizedHeadroomPercent}%`,
        recommendedSizeInGib,
        totalObjectsAssessed: 1,
        totalObjectsInViolation: status !== AssessmentStatus.OPTIMIZED ? 1 : 0,
        objectsInViolation: status !== AssessmentStatus.OPTIMIZED ? [fsxFileSystemId] : []
    };
}

async function processOracleOfflineAssessmentUpload(
    accountId: string,
    jobId: string,
    metadata: Partial<OracleOfflineAssessmentMetadataType>,
    rawdata: OracleOfflineAssessmentRawData,
    credentialsId?: string,
    region?: string
) {
    const { instanceLevelDetails, hostLevelDetails } = rawdata;
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
        vmPlatform,
        oracleHome,
        deploymentType
    } = metadata;

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let errorMessage: string = '';

    try {
        const managedInstances: DatabaseInstance[] = (
            await getPaginatedDatabaseInstances(accountId, {
                selectKeys: ['account_id', 'resource_id', 'database_instance_id']
            })
        ).items;

        const records = Object.entries(instanceLevelDetails || {}).map(([instanceName, instanceData]) => {
            const {
                instanceDetails,
                mappedOntapVolumes,
                storage,
                os,
                pluggableDatabases,
                isDataGuardDeployed,
                dataguardDetails
            } = instanceData;

            const databaseInstanceId = instanceDetails?.sid || instanceName;
            const resourceId = generateSqlResourceId(ec2InstanceId!);

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
                databaseType: DATABASE_TYPE.oracle,
                rawdata: {
                    instanceLevelAssessment: storage || {},
                    hostLevelDetails: hostLevelDetails || {},
                    os: os || {},
                    errors: rawdata.errors || [],
                    pluggableDatabases: pluggableDatabases || [],
                    isDataGuardDeployed: isDataGuardDeployed || false,
                    dataguardDetails: dataguardDetails || {}
                },
                mappedOntapVolumes: mappedOntapVolumes || {},
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
                    vmPlatform,
                    deploymentType: instanceDetails?.deploymentType || deploymentType,
                    oracleHome: instanceDetails?.oracleHome || oracleHome,
                    databaseVersion: instanceDetails?.databaseVersion,
                    isCDB: instanceDetails?.isCDB,
                    pdbCount: instanceDetails?.pdbCount
                }
            } as OfflineAssessmentRecord;
        });

        if (records.length === 0) {
            throw createError(HttpErrorCodes.BAD_REQUEST, 'No valid Oracle instances found in assessment data');
        }

        await bulkUpsertOfflineAssessments(records);

        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error: unknown) {
        errorMessage = error instanceof Error ? error.message : 'Upload failed';
        jobStatus = JOBSTATUS.FAILED;
        logger.error('Failed to process Oracle offline assessment upload', { accountId, jobId, error: errorMessage });
    } finally {
        await updateJobDetails(accountId, jobId, { status: jobStatus, endTime: Date.now(), error: errorMessage });
    }
}

async function uploadOracleOfflineAssessment(
    accountId: string,
    fileContent: string,
    fileName?: string,
    credentialsId?: string,
    region?: string
): Promise<OfflineAssessmentUploadResponseType> {
    let assessmentData: { metadata?: Record<string, unknown>; rawdata?: Record<string, unknown> };

    if (IS_DEMO_FLOW) {
        assessmentData = loadAndModifyDemoOracleISCSIData() as {
            metadata?: Record<string, unknown>;
            rawdata?: Record<string, unknown>;
        };
    } else {
        // Parse user's uploaded file in non-demo mode
        assessmentData = parseAssessmentFileContent(fileContent);
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
        vmPlatform,
        oracleSid,
        oracleHome,
        deploymentType,
        pdbCount,
        region: metadataRegion
    } = metadata as unknown as OracleOfflineAssessmentMetadataType;

    if (!ec2InstanceId) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'EC2 instance ID is required in metadata');
    }

    const { instanceLevelDetails } = rawdata as OracleOfflineAssessmentRawData;

    if (isEmpty(instanceLevelDetails)) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'At least one Oracle database instance is required');
    }

    const [databaseInstanceName] = Object.keys(instanceLevelDetails);
    logger.info('Uploading Oracle offline assessment', {
        accountId,
        fileName,
        hostname,
        oracleSid: oracleSid || databaseInstanceName,
        ec2InstanceId
    });

    const { id: jobId } = await registerJob(accountId, '', metadataRegion || '', {
        name: `Oracle offline assessment data upload for ${hostname}/${databaseInstanceName}`,
        description: fileName
            ? `Upload from file: ${fileName} - Oracle SID: ${databaseInstanceName}`
            : `Upload offline assessment data - Oracle SID: ${databaseInstanceName}`,
        resourceName: `${hostname}/${databaseInstanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT
    });

    processOracleOfflineAssessmentUpload(
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
            virtualNetworkName,
            vmPlatform,
            oracleSid,
            oracleHome,
            deploymentType,
            pdbCount
        },
        rawdata as OracleOfflineAssessmentRawData,
        credentialsId,
        metadataRegion || region
    ).catch(async error => {
        logger.error('Unhandled error in processOracleOfflineAssessmentUpload', {
            accountId,
            jobId,
            error: error instanceof Error ? error.message : String(error)
        });
    });

    return { jobId };
}

async function fetchOracleOfflineAssessment(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    fields?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<OracleDriftAssessmentResponseType> {
    logger.info('Fetching Oracle offline assessment', {
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

    const rawdata = (record.rawdata as OracleStoredRawData) || {};
    const metadata = (record.metadata as unknown as OracleOfflineAssessmentMetadataType) || {};
    const mappedOntapVolumesData = (record.mapped_ontap_volumes as OracleMappedOntapVolumesResponse) || {};

    const {
        hostname,
        storageEndpoint,
        fsxId,
        assessmentTimestamp,
        databaseInstanceName,
        deploymentType,
        ec2InstanceId
    } = metadata;

    const skipHeadroom = true;
    const { instanceLevelAssessment, os } = rawdata;
    const fileSystemIdentifier = fsxId || storageEndpoint || '';

    const instanceAssessment = (instanceLevelAssessment || {}) as Record<string, unknown>;
    const storageAssessmentData = {
        ...instanceAssessment,
        ...(os && { os })
    } as unknown as StorageAssessment;

    const mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse> = {
        [fileSystemIdentifier]: mappedOntapVolumesData
    };

    let storageAssessmentResponse = await calculateStorageDrift(
        accountId,
        credentialsId || '',
        region || '',
        resourceId,
        ec2InstanceId || '',
        databaseInstanceId,
        databaseInstanceName || databaseInstanceId,
        deploymentType || '',
        fileSystemIdentifier,
        mappedOntapVolumes,
        storageAssessmentData,
        skipHeadroom
    );

    const { headroom } = rawdata.hostLevelDetails || {};

    if (!isEmpty(headroom)) {
        const headroomDrift = calculateOracleOneTimeWADHeadroomDrift(
            fileSystemIdentifier,
            headroom as OneTimeWADHeadroomData
        ) as GenericParameterDriftResponseType;
        if (headroomDrift) {
            if (!storageAssessmentResponse) {
                const fallbackStorage: StorageParameterDriftResponseType = {
                    configuration: { volumes: [], luns: [], os: [] },
                    sizing: [headroomDrift],
                    layout: []
                };
                storageAssessmentResponse = fallbackStorage;
            } else {
                const existingSizing =
                    'sizing' in storageAssessmentResponse && storageAssessmentResponse.sizing
                        ? storageAssessmentResponse.sizing
                        : [];
                storageAssessmentResponse = {
                    ...storageAssessmentResponse,
                    sizing: [...existingSizing, headroomDrift]
                };
            }
        }
    }

    const driftAssessmentData: OracleDriftAssessmentResponseType = {
        storage: !isEmpty(storageAssessmentResponse)
            ? (storageAssessmentResponse as StorageParameterDriftResponseType)
            : undefined,
        lastAssessmentTimestamp: assessmentTimestamp
            ? new Date(assessmentTimestamp).getTime()
            : record.created_time.getTime(),
        fileSystemId: fileSystemIdentifier,
        databaseInstanceName,
        ec2InstanceId,
        databaseHostName: hostname || '',
        deploymentType,
        storageProtocol: mappedOntapVolumesData.protocol,
        isASMManaged: mappedOntapVolumesData.isASMManaged
    };

    const { isValid, errors: validationErrors } = validateWithSchema(
        OracleDriftAssessmentResponse,
        driftAssessmentData
    );
    if (!isValid) {
        logger.error('Oracle offline assessment data validation failed', {
            accountId,
            resourceId,
            databaseInstanceId,
            validationErrors
        });
        return {} as OracleDriftAssessmentResponseType;
    }

    return driftAssessmentData;
}

async function fetchOracleOfflineAssessmentPerAccount(
    accountId: string,
    pageSize: number = 50,
    credentialsId?: string,
    region?: string,
    nextToken?: string
) {
    logger.info('Listing Oracle offline assessments', {
        accountId,
        credentialsId,
        region
    });

    const items = await dbListOfflineAssessments({
        accountId,
        credentialsId,
        region,
        databaseType: DATABASE_TYPE.oracle,
        pageSize,
        nextToken
    });

    if (isEmpty(items)) {
        logger.info(`No Oracle offline assessments found for account ${accountId}.`);
        return { items: [], count: 0 };
    }

    const assessmentItems = await Promise.all(
        items.map(
            throat(3, async item => {
                const {
                    resource_id: resourceId,
                    database_instance_id: databaseInstanceId,
                    metadata,
                    rawdata: itemRawdata,
                    credentials_id: itemCredentialsId,
                    region: itemRegion
                } = item;
                const {
                    databaseInstanceName,
                    vmName,
                    ec2InstanceId: vmInstanceId,
                    virtualNetworkId,
                    virtualNetworkName,
                    numberOfDatabaseInstances,
                    vmPlatform
                } = (metadata as unknown as OracleOfflineAssessmentMetadataType) || {};

                const storedRawdata = (itemRawdata as OracleStoredRawData) || {};
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
                    vmPlatform,
                    pluggableDatabases: storedRawdata.pluggableDatabases || [],
                    isDataGuardDeployed: storedRawdata.isDataGuardDeployed || false,
                    dataguardDetails: storedRawdata.dataguardDetails || {}
                };

                try {
                    const assessments = await fetchOracleOfflineAssessment(
                        accountId,
                        resourceId,
                        databaseInstanceId,
                        recordCredentialsId ?? undefined,
                        recordRegion ?? undefined,
                        undefined,
                        item
                    );
                    return { ...response, assessments };
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assessment';
                    logger.error(`Error fetching Oracle assessment for ${resourceId}/${databaseInstanceId}:`, {
                        error: errorMessage
                    });
                    return { ...response, error: errorMessage };
                }
            })
        )
    );

    const responseNextToken = items.length >= pageSize ? items[items.length - 1]?.id?.toString() : undefined;

    return {
        items: assessmentItems,
        count: assessmentItems.length,
        ...(responseNextToken && { nextToken: responseNextToken })
    };
}

async function deleteOracleOfflineAssessmentRecord(accountId: string, databaseHostIds: string) {
    logger.info('Deleting Oracle offline assessment record', { accountId, databaseHostIds });

    const resourcesIdList = databaseHostIds.split(',').filter(Boolean);
    try {
        const response = await removeOfflineAssessmentData(accountId, resourcesIdList, DATABASE_TYPE.oracle);
        if (response.count === 0) {
            logger.error('No Oracle offline assessment found to delete', { accountId, databaseHostIds });
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `Offline assessment id ${databaseHostIds} not found for account ${accountId}`
            );
        }
        return response;
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            'status' in error &&
            (error as { status: number }).status === HttpErrorCodes.NOT_FOUND
        ) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error deleting Oracle offline assessment', { error: errorMessage });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error deleting Oracle offline assessment: ${errorMessage}`
        );
    }
}

export {
    uploadOracleOfflineAssessment,
    fetchOracleOfflineAssessment,
    fetchOracleOfflineAssessmentPerAccount,
    deleteOracleOfflineAssessmentRecord
};
