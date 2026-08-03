import createError from 'http-errors';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, offline_assessment as OfflineAssessmentDBSchema } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import {
    bulkUpsertOfflineAssessments,
    getOfflineAssessment,
    listOfflineAssessments as dbListOfflineAssessments,
    removeOfflineAssessmentData,
    updateOfflineAssessmentResults,
    OfflineAssessmentRecord
} from '../../../lib/database/offline-assessment';
import {
    DataGuardDetailsType,
    OfflineAssessmentUploadResponseType
} from '../../../routes/types/offline-assessment.types';
import {
    type AssessmentItemType,
    type AssessmentErrorItemType
} from '../../../routes/types/continuous-optimization.types';
import {
    generateSqlResourceId,
    parseAssessmentFileContent,
    IS_DEMO_FLOW,
    validateWithSchema
} from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import { AWS_REGIONS, DatabaseTypes, HttpErrorCodes, RESOURCESTYPE, STORAGE_PROTOCOLS } from '../../../utils/consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getPaginatedDatabaseInstances } from '../../database/database-operations';
import { CloneAssessment, DatabaseInstance, OneTimeWADHeadroomData } from '../../../utils/common-types';
import {
    OracleMappedOntapVolumesResponse,
    OracleMappedOntapVolumeRecord,
    OracleSysFileTypes
} from '../../workloads/oracle/common-types';
import {
    calculateStorageDrift,
    volumeConfigData,
    volumeNfsConfigData,
    lunConfigData,
    blockDeviceConfig
} from './storage-assessment-operations';
import calculateOneTimeWADCloneDrift from '../clone-assessment-utils';
import { calculateComputeHostOsDrift } from './compute-assessment-operations';
import { calculateSnapCenterDrift, SnapcenterAssessmentData } from './snapcenter-assessment-operations';
import { getOntapVolumeIdsByFileType, ORACLE_V1_MAP_CONFIG } from './assessment-operations';
import {
    mapAssessmentToV1,
    resolveAssessmentTypes,
    GOLDEN_CONFIG_LOOKUP,
    OFFLINE_ASSESSMENT_SOURCE,
    mergeStorageDriftItemsById,
    filterToVolumeLunDriftItems,
    runScopedOntapSubAssessment
} from '../assessment-utils';
import { ISCIOSAssessment, NFSOSAssessment, StorageAssessment } from './common-types';
import { loadAndModifyDemoOracleISCSIData } from '../../demo-operations';
import {
    OracleAssessmentResponse,
    OracleAssessmentResponseType,
    OracleDriftAssessmentResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE } from '../one-time-assessment-consts';
import { calculateWADHeadroomDrift } from '../wad-headroom-utils';
import ORACLE_GOLDEN_CONFIG from './golden-config';

const logger = getLogger();

const ORACLE_VOLUME_LUN_DRIFT_IDS = new Set<string>([
    ...volumeConfigData.map(({ id }) => id),
    ...volumeNfsConfigData.map(({ id }) => id),
    ...lunConfigData.map(({ id }) => id),
    ...(blockDeviceConfig ? [blockDeviceConfig.id] : []),
    ...ORACLE_GOLDEN_CONFIG.filter(e => e.subType === 'layout').map(({ id }) => id)
]);

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
    pluggableDatabases?: Array<{
        pdbName: string;
        pdbId?: string;
        pdbStatus?: string;
        pdbSizeInBytes?: number;
        pdbCreationTime?: string;
        serviceName?: string;
    }>;
    isDataGuardDeployed?: boolean;
    dataguardDetails?: DataGuardDetailsType;
    clone?: CloneAssessment;
    snapcenter?: SnapcenterAssessmentData;
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
    pluggableDatabases?: Array<{
        pdbName: string;
        pdbId?: string;
        pdbStatus?: string;
        pdbSizeInBytes?: number;
        pdbCreationTime?: string | null;
        serviceName?: string | null;
    }>;
    isDataGuardDeployed?: boolean;
    dataguardDetails?: DataGuardDetailsType;
    clone?: CloneAssessment;
    snapcenter?: SnapcenterAssessmentData;
}

/** Top-level `rawdata` block from the uploaded assessment JSON — maps SID keys to per-instance data plus host-level details. */
interface OracleOfflineAssessmentRawData {
    hostLevelDetails?: Record<string, unknown>;
    instanceLevelDetails?: Record<string, OracleOfflineAssessmentInstanceData>;
    errors?: string[];
}

interface OracleUnregisteredAssessmentRawData {
    ontapStorageAssessments?: StorageAssessment[];
    headroomData?: OneTimeWADHeadroomData;
}

interface OracleUnregisteredAssessmentMetadata {
    source: typeof OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED;
    databaseInstanceName: string;
    ec2InstanceId: string;
    assessmentTimestamp: string;
    [key: string]: unknown;
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
        region: metadataRegion,
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

        const records = await Promise.all(
            Object.entries(instanceLevelDetails || {}).map(async ([instanceName, instanceData]) => {
                const {
                    instanceDetails,
                    mappedOntapVolumes,
                    storage,
                    os,
                    pluggableDatabases,
                    isDataGuardDeployed,
                    dataguardDetails,
                    clone,
                    snapcenter
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

                const record: OfflineAssessmentRecord = {
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
                        dataguardDetails: dataguardDetails || {},
                        ...(clone && !isEmpty(clone) && { clone }),
                        ...(snapcenter && !isEmpty(snapcenter) && { snapcenter })
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
                        region: metadataRegion || region,
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

                try {
                    const driftResult = await fetchOracleOfflineAssessment(
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
                    logger.warn('Failed to compute drift during Oracle offline assessment upload', {
                        accountId,
                        resourceId,
                        databaseInstanceId,
                        error: err instanceof Error ? err.message : String(err)
                    });
                }

                return record;
            })
        );

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
        vmPlatform,
        oracleSid,
        oracleHome,
        deploymentType,
        pdbCount,
        region: metadataRegion
    } = metadata as unknown as OracleOfflineAssessmentMetadataType;

    if (!databaseType || databaseType.toLowerCase() !== DATABASE_TYPE.oracle.toLowerCase()) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'Please upload an Oracle Onetime assessment file. This file appears to be for a different database type.'
        );
    }

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
            region: metadataRegion,
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
): Promise<OracleAssessmentResponseType> {
    logger.info('Fetching Oracle offline assessment', {
        accountId,
        resourceId,
        databaseInstanceId,
        fields,
        credentialsId,
        region
    });

    const record = isEmpty(databaseRecord)
        ? await getOfflineAssessment(accountId, resourceId, databaseInstanceId, region, credentialsId)
        : databaseRecord;

    if (!record) {
        logger.info('No offline assessment record found, returning empty result', {
            accountId,
            resourceId,
            databaseInstanceId
        });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    if ((record.metadata as { source?: string })?.source === OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED) {
        return fetchOracleUnregisteredInstanceAssessment(
            accountId,
            resourceId,
            databaseInstanceId,
            credentialsId,
            region,
            record
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
    const { instanceLevelAssessment, os, clone: cloneAssessmentData, snapcenter: snapcenterAssessmentData } = rawdata;
    const fileSystemIdentifier = fsxId || storageEndpoint || '';

    const instanceAssessment = (instanceLevelAssessment || {}) as Record<string, unknown>;
    const storageAssessmentData = {
        ...instanceAssessment,
        ...(os && { os })
    } as unknown as StorageAssessment;

    const mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse> = {
        [fileSystemIdentifier]: mappedOntapVolumesData
    };

    const storageAssessmentResponse = await calculateStorageDrift(
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
    logger.info('Oracle one-time WAD: calculating headroom drift', { fileSystemIdentifier });
    const headroomDrift =
        !isEmpty(headroom) && fileSystemIdentifier
            ? calculateWADHeadroomDrift(
                  fileSystemIdentifier,
                  headroom as OneTimeWADHeadroomData,
                  ORACLE_GOLDEN_CONFIG.find(e => e.id === 'headroom'),
                  RESOURCESTYPE.ORACLE
              )
            : undefined;
    logger.info('Oracle one-time WAD: headroom drift calculated', {
        fileSystemIdentifier,
        hasHeadroomDrift: !!headroomDrift
    });

    const cloneDriftResponse = !isEmpty(cloneAssessmentData)
        ? calculateOneTimeWADCloneDrift(
              accountId,
              resourceId,
              databaseInstanceId,
              cloneAssessmentData as CloneAssessment,
              DATABASE_TYPE.oracle
          )
        : undefined;

    const { protocol, isASMManaged, volumeMappings } = mappedOntapVolumesData;

    let snapcenterDriftResponse: AssessmentItemType | AssessmentErrorItemType | undefined;
    if (!isEmpty(snapcenterAssessmentData)) {
        const volumeMaps = volumeMappings || [];
        const instanceVolumeMapping = volumeMaps.find(
            (m: Record<string, OracleMappedOntapVolumeRecord>) => m[databaseInstanceName || databaseInstanceId]
        )?.[databaseInstanceName || databaseInstanceId];
        const volumeIdsByFileType = getOntapVolumeIdsByFileType(instanceVolumeMapping, [
            OracleSysFileTypes.DATA_FILES,
            OracleSysFileTypes.CONTROL_FILES,
            OracleSysFileTypes.ARCHIVE_LOGS
        ]);
        snapcenterDriftResponse = calculateSnapCenterDrift(snapcenterAssessmentData as SnapcenterAssessmentData, {
            dataFileVolumeIds: volumeIdsByFileType[OracleSysFileTypes.DATA_FILES] ?? [],
            controlFileVolumeIds: volumeIdsByFileType[OracleSysFileTypes.CONTROL_FILES] ?? [],
            archiveLogVolumeIds: volumeIdsByFileType[OracleSysFileTypes.ARCHIVE_LOGS] ?? []
        });
    }

    const iscsiOs = protocol === STORAGE_PROTOCOLS.ISCSI ? os : undefined;
    const computeHostOsDriftData =
        protocol === STORAGE_PROTOCOLS.ISCSI && !isEmpty(os)
            ? calculateComputeHostOsDrift(
                  ec2InstanceId || '',
                  databaseInstanceName || databaseInstanceId,
                  iscsiOs && {
                      transparentHugepages: (iscsiOs as ISCIOSAssessment)?.['transparent-hugepages'] ?? undefined,
                      tcpAdvancedOptions: (iscsiOs as ISCIOSAssessment)?.['tcp-advanced-options'] ?? undefined
                  },
                  { os }
              )
            : [];

    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    [storageAssessmentResponse, computeHostOsDriftData].forEach(item => {
        if (!isEmpty(item) && item.length > 0) {
            assessments.push(...item);
        }
    });
    [headroomDrift, cloneDriftResponse, snapcenterDriftResponse].forEach(item => {
        if (!isEmpty(item)) {
            assessments.push(item);
        }
    });

    const { configIds: eligibleConfigIds } = resolveAssessmentTypes(
        DatabaseTypes.ORACLE,
        undefined,
        { storageProtocol: protocol, isAsmManaged: isASMManaged ?? undefined },
        new Set()
    );
    const oracleLookup = GOLDEN_CONFIG_LOOKUP[DatabaseTypes.ORACLE];
    const assessedIds = new Set(assessments.map(a => a.id));
    eligibleConfigIds
        .filter(id => !assessedIds.has(id))
        .forEach(id => {
            const entry = oracleLookup.get(id);
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
            fileSystemId: fileSystemIdentifier,
            databaseInstanceName,
            ec2InstanceId,
            databaseHostName: hostname || '',
            deploymentType,
            storageProtocol: protocol,
            isASMManaged,
            source: OFFLINE_ASSESSMENT_SOURCE.OFFLINE
        }
    };

    updateOfflineAssessmentResults(accountId, resourceId, databaseInstanceId, assessmentResponse).catch(err =>
        logger.warn('Failed to persist Oracle offline assessment results', {
            accountId,
            resourceId,
            databaseInstanceId,
            error: err instanceof Error ? err.message : String(err)
        })
    );

    const { isValid, errors } = validateWithSchema(OracleAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid Oracle offline assessment response', { errors });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    return assessmentResponse;
}

async function fetchOracleUnregisteredInstanceAssessment(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<OracleAssessmentResponseType> {
    logger.info('Fetching Oracle unregistered-instance assessment', {
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region
    });

    const record = isEmpty(databaseRecord)
        ? await getOfflineAssessment(accountId, resourceId, databaseInstanceId, region, credentialsId)
        : databaseRecord;

    if (!record) {
        logger.info('No offline assessment record found', {
            accountId,
            resourceId,
            databaseInstanceId
        });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    const { ontapStorageAssessments, headroomData } = (record.rawdata as OracleUnregisteredAssessmentRawData) || {};
    const { databaseInstanceName, ec2InstanceId, assessmentTimestamp } =
        (record.metadata as unknown as OracleUnregisteredAssessmentMetadata) || {};

    const { credentials_id: recordCredentialsId, region: recordRegion } = record;
    const effectiveCredentialsId = credentialsId ?? recordCredentialsId ?? undefined;
    const effectiveRegion = region ?? recordRegion ?? undefined;

    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    if (ontapStorageAssessments && ontapStorageAssessments.length > 0) {
        if (!effectiveCredentialsId || !effectiveRegion) {
            logger.warn('Computing volume/LUN drift without credentialsId/region on unregistered Oracle instance', {
                accountId,
                resourceId,
                databaseInstanceId
            });
        }
        assessments.push(
            ...(await computeOracleVolumeLunDrift(
                accountId,
                effectiveCredentialsId ?? '',
                effectiveRegion ?? '',
                resourceId,
                ec2InstanceId ?? '',
                databaseInstanceId,
                ontapStorageAssessments
            ))
        );
    }

    const filesystemId = ontapStorageAssessments?.[0]?.volumes?.filesystemId;
    if (headroomData && filesystemId) {
        const headroomItem = calculateWADHeadroomDrift(
            filesystemId,
            headroomData,
            ORACLE_GOLDEN_CONFIG.find(e => e.id === 'headroom'),
            RESOURCESTYPE.ORACLE
        );
        if (headroomItem) {
            assessments.push(headroomItem);
        }
    }

    const { protocol: storageProtocol, isASMManaged: isAsmManaged = false } =
        (filesystemId ? ontapStorageAssessments?.[0]?.mappedOntapVolumes?.[filesystemId] : undefined) ?? {};
    const { configIds: eligibleConfigIds } = resolveAssessmentTypes(
        DatabaseTypes.ORACLE,
        undefined,
        { storageProtocol, isAsmManaged },
        new Set()
    );
    const oracleLookup = GOLDEN_CONFIG_LOOKUP[DatabaseTypes.ORACLE];
    const assessedIds = new Set(assessments.map(a => a.id));
    eligibleConfigIds
        .filter(id => !assessedIds.has(id))
        .forEach(id => {
            const entry = oracleLookup.get(id);
            if (!entry) {
                return;
            }
            // `resolveAssessmentTypes`'s STORAGE category lumps all storage golden-config entries
            // into one mixed-protocol bucket, so its applicableTo exclusion never fires here; this
            // scoped ONTAP-only collector can never determine ASM (always false) and knows the
            // protocol, so drop those entries outright instead of showing them as not-applicable.
            if (entry.applicableTo === 'asm' && !isAsmManaged) {
                return;
            }
            if (entry.applicableTo === 'iscsi' && storageProtocol && storageProtocol !== STORAGE_PROTOCOLS.ISCSI) {
                return;
            }
            assessments.push({ ...entry, errorMessage: ONE_TIME_WAD_NOT_APPLICABLE_MESSAGE });
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
            ec2InstanceId,
            source: OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED,
            // Not stored on the record; UI filters by these, so surface the values used to fetch it.
            ...(effectiveCredentialsId && { credentialsId: effectiveCredentialsId }),
            ...(effectiveRegion && { region: effectiveRegion })
        }
    };

    const { isValid, errors } = validateWithSchema(OracleAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid Oracle unregistered-instance assessment response', {
            accountId,
            resourceId,
            databaseInstanceId,
            errors
        });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    updateOfflineAssessmentResults(accountId, resourceId, databaseInstanceId, assessmentResponse).catch(err =>
        logger.warn('Failed to persist Oracle unregistered-instance assessment results', {
            accountId,
            resourceId,
            databaseInstanceId,
            error: err
        })
    );

    return assessmentResponse;
}

async function computeOracleVolumeLunDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    ec2InstanceId: string,
    databaseInstanceId: string,
    ontapStorageAssessments: StorageAssessment[]
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    logger.info('Computing Oracle volume/LUN drift for unregistered instance', {
        accountId,
        resourceId,
        ec2InstanceId,
        databaseInstanceId
    });
    const perFilesystemDrift = await Promise.all(
        ontapStorageAssessments.map(storageAssessment =>
            calculateStorageDrift(
                accountId,
                credentialsId,
                region,
                resourceId,
                ec2InstanceId,
                databaseInstanceId,
                '',
                '',
                storageAssessment.volumes.filesystemId,
                storageAssessment.mappedOntapVolumes ?? {},
                storageAssessment,
                true,
                true
            )
        )
    );
    return filterToVolumeLunDriftItems(mergeStorageDriftItemsById(perFilesystemDrift), ORACLE_VOLUME_LUN_DRIFT_IDS);
}

async function processOracleUnregisteredAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
) {
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    try {
        const resourceId = ec2InstanceId;

        const ontapStorageResult = await runScopedOntapSubAssessment<StorageAssessment>(
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            jobId,
            DATABASE_TYPE.oracle,
            'Oracle'
        );
        const { ontapStorageAssessments, headroomData } = ontapStorageResult ?? {};

        if (ontapStorageAssessments && ontapStorageAssessments.length > 0) {
            const rawdata: OracleUnregisteredAssessmentRawData = {
                ontapStorageAssessments,
                ...(headroomData && { headroomData })
            };
            const metadata: OracleUnregisteredAssessmentMetadata = {
                source: OFFLINE_ASSESSMENT_SOURCE.UNREGISTERED,
                databaseInstanceName: instanceName,
                ec2InstanceId,
                assessmentTimestamp: new Date().toISOString()
            };

            const assessmentResults = await fetchOracleUnregisteredInstanceAssessment(
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
                    databaseType: DATABASE_TYPE.oracle,
                    rawdata,
                    metadata,
                    assessmentResults
                }
            ]);
        } else {
            status = JOBSTATUS.FAILED;
            errorMessage =
                'No assessable data collected: ONTAP volume/LUN assessment returned no data for this instance';
        }
    } catch (error: unknown) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : 'Assessment failed';
        logger.error('Failed to process Oracle unregistered-instance assessment', {
            accountId,
            jobId,
            ec2InstanceId,
            instanceName,
            error
        });
    } finally {
        await updateJobDetails(accountId, jobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        }).catch(updateError =>
            logger.error('Failed to update job details for Oracle unregistered-instance assessment', {
                accountId,
                jobId,
                error: updateError
            })
        );
    }
}

async function triggerOracleUnregisteredAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string
) {
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Oracle storage assessment for ${ec2InstanceId}/${instanceName}`,
        description: `One-time storage assessment for unregistered Oracle instance ${instanceName} on ${ec2InstanceId}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT
    });
    logger.info('Initiating Oracle unregistered-instance assessment', {
        accountId,
        jobId,
        ec2InstanceId,
        instanceName
    });

    processOracleUnregisteredAssessment(accountId, credentialsId, region, ec2InstanceId, instanceName, jobId).catch(
        error =>
            logger.error('Unhandled error in Oracle unregistered-instance assessment', {
                accountId,
                jobId,
                ec2InstanceId,
                instanceName,
                error
            })
    );

    return { jobId };
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
                    vmPlatform,
                    isCDB
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
                    tenancyType: isCDB ? 'multi_tenant' : 'single_tenant',
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

async function fetchOracleOfflineAssessmentV1(
    accountId: string,
    resourceId: string,
    databaseInstanceId: string,
    credentialsId?: string,
    region?: string,
    fields?: string,
    databaseRecord?: OfflineAssessmentDBSchema
): Promise<OracleDriftAssessmentResponseType> {
    const v2Response = await fetchOracleOfflineAssessment(
        accountId,
        resourceId,
        databaseInstanceId,
        credentialsId,
        region,
        fields,
        databaseRecord
    );
    // v1 schemas omit `id`/`categories`; Fastify's response serializer drops them from the payload.
    return mapAssessmentToV1(v2Response, ORACLE_V1_MAP_CONFIG) as unknown as OracleDriftAssessmentResponseType;
}

async function fetchOracleOfflineAssessmentPerAccountV1(
    accountId: string,
    pageSize?: number,
    credentialsId?: string,
    region?: string,
    nextToken?: string
) {
    const v2Result = await fetchOracleOfflineAssessmentPerAccount(
        accountId,
        pageSize,
        credentialsId,
        region,
        nextToken
    );

    return {
        ...v2Result,
        items: v2Result.items.map(item => {
            const rawAssessments = (item as Record<string, unknown>).assessments;
            return {
                ...item,
                assessments: rawAssessments
                    ? (mapAssessmentToV1(
                          rawAssessments as OracleAssessmentResponseType,
                          ORACLE_V1_MAP_CONFIG
                      ) as unknown as OracleDriftAssessmentResponseType)
                    : undefined
            };
        })
    };
}

export {
    uploadOracleOfflineAssessment,
    fetchOracleOfflineAssessment,
    fetchOracleOfflineAssessmentV1,
    fetchOracleOfflineAssessmentPerAccount,
    fetchOracleOfflineAssessmentPerAccountV1,
    deleteOracleOfflineAssessmentRecord,
    fetchOracleUnregisteredInstanceAssessment,
    triggerOracleUnregisteredAssessment
};
