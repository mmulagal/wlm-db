import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { CommandFilterKey } from '@aws-sdk/client-ssm';
import { getJobs, registerJob, updateJobDetails } from '../database/job-operations';
import { getServerNameWithHostname, getTimeDifferenceInMinutes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { buildEc2FsxRelationship } from '../cloud-manager/tagging-service-operations';
import { collectOntapAssessmentData, FsxStorageCollectionResult } from './ontap-proxy-collector';
import {
    AssessmentCategories,
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategoriesOracle,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    COMBINED_OPTIMIZE_DESCRIPTORS,
    CombinedOptimizeConfigName,
    isCombinedOptimizeConfig,
    mergeOptimizationTargets,
    OptimizeStorageConfigs,
    OptimizeStorageRequestParams
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import type {
    DatabaseInstance,
    HostOsPatchAssessmentObject,
    JobMetadata,
    Metadata,
    ResourceAssessmentData,
    ResourceDetails,
    DismissConfig,
    OneTimeWADHeadroomData
} from '../../utils/common-types';
import { OracleJobMetadata } from './oracle/consts';
import { OracleMappedOntapVolumeRecordType } from '../workloads/oracle/common-types';
import getMissingPermissionsList from '../aws/iam-operations';
import {
    DatabaseTypes,
    HttpErrorCodes,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    STORAGE_PROTOCOLS
} from '../../utils/consts';
import { getInstanceInfo, updateDatabaseHostAssessmentData } from '../database/database-operations';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { listSsmCommands } from '../../lib/aws/ssm';
import { listResources } from '../../lib/database/db';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';
import type {
    AssessmentItemType,
    AssessmentErrorItemType,
    AssessmentMetadataType,
    ConfigDetailType,
    DismissedConfigurationType,
    GenericViolationResponseType,
    ViolatedConfigType
} from '../../routes/types/continuous-optimization.types';
import { MSSQL_GOLDEN_CONFIG } from './mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from './oracle/golden-config';

const logger = getLogger();

const FSX_LINK_INACTIVE_HINT = 'Register the instance or verify that the FSx link is active.';

interface GoldenConfigComponent {
    parameter: string;
    value: string | number | boolean;
    // MSSQL combined entries set `source` to partition LUN vs Volume children at drift time.
    // Oracle combined entries are volume-only and use `name`/`objectType` instead.
    source?: 'lun' | 'volume';
    objectType?: string;
    name?: string;
}

interface GoldenConfigEntry {
    id: string;
    name: string;
    parameter?: string;
    type: string;
    subType: string;
    severity: string;
    recommendation: string;
    categories: AwsWellArchitecturedPillars[];
    resourceType?: string;
    focusWidgetName?: string;
    value?: string | number | boolean;
    recommended?: string;
    status?: string;
    applicableTo?: 'iscsi' | 'nfs' | 'asm';
    configLevel: 'host' | 'database';
    // Combined (aggregate) entries fan out into per-sub-parameter children at drift / optimize time.
    // MSSQL combined entry uses `parameter`/`value`/`source`; Oracle entries also carry `name`/`objectType`.
    components?: GoldenConfigComponent[];
    globalWadApplicable?: boolean;
    metadata?: {
        linkRequired?: boolean;
        schedulingSupported?: boolean;
        bulkFixSupported?: boolean;
    };
    disabled?: boolean;
}

interface UnOptimizedDiskGroups {
    diskGroupName: string;
    svmName?: string;
    svmId?: string;
    volumeNames?: string[];
    lunsToAdd: number;
    lunSerials?: string[];
    asmDisks?: string[];
    iscsiIp?: string;
}

interface ScopedOntapStorageResult<T> {
    ontapStorageAssessments?: T[];
    headroomData?: OneTimeWADHeadroomData;
    error?: string;
}

function getMatchingAssessmentStatus(finding: string) {
    logger.info('Getting matching assessment status for finding:', finding);
    switch (finding) {
        case 'NOT_OPTIMIZED':
            return AssessmentStatus.NOT_OPTIMIZED;
        case 'OVER_PROVISIONED':
            return AssessmentStatus.OVER_PROVISIONED;
        case 'UNDER_PROVISIONED':
            return AssessmentStatus.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        default:
            return AssessmentStatus.OPTIMIZED;
    }
}

async function handleOptimizeJobCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    serverNameWithHostName: string,
    jobType: string,
    jobName: string,
    jobDescription: string,
    parentJobId?: string,
    jobMetadata?: JobMetadata | OracleJobMetadata
) {
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        type: jobType,
        region,
        credentialsId,
        ...(parentJobId && { parentJobId })
    };
    const {
        items: [job]
    } = await getJobs(accountId, filterParams);

    if (job) {
        const timeDifferenceInMinutes = getTimeDifferenceInMinutes(job.startTime);
        if (timeDifferenceInMinutes <= 5) {
            throw createError(412, `A job is already in progress with ID: ${job.id}. Please wait for it to finish.`);
        }
    }

    // create the parent job for optimize operation
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId }),
        ...(jobMetadata && { metadata: jobMetadata })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}

// Recursive function to check for any "not-optimized" status in the assessment results.
// It checks both arrays and objects, looking for the specific status in any nested structure.
// Returns true if any "not-optimized" status is found, otherwise false.
// This is used to determine if an instance has any assessment results that are not optimized.
function hasNotOptimizedStatus(obj: unknown): boolean {
    if (Array.isArray(obj)) {
        return obj.some(hasNotOptimizedStatus);
    }
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
        if (
            ('status' in obj && obj.status === AssessmentStatus.NOT_OPTIMIZED) ||
            ('errorMessage' in obj && !!obj.errorMessage)
        ) {
            return true;
        }
        return Object.values(obj).some(hasNotOptimizedStatus);
    }
    return false;
}

function getLatestInstanceAssessmentTime(
    databaseInstanceConfigData: { config_data_type: string; creation_time: Date }[]
) {
    return databaseInstanceConfigData
        .filter(config => config.config_data_type !== AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES)
        .reduce((latest, { creation_time: currentCreationTime }) => {
            const creationTime = new Date(currentCreationTime || 0);
            return creationTime > latest ? creationTime : latest;
        }, new Date(0));
}

async function checkForMissingOptimizePermissions(credentialsId: string, region: string, permissions: string[]) {
    logger.info('Checking for missing optimize permissions', { credentialsId, region, permissions });
    try {
        const missingPermissions: string[] = [];
        const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(
            credentialsId,
            region,
            permissions
        );
        const combinedDeniedPermissions = [...implicitlyDenied, ...explicitlyDenied];
        if (combinedDeniedPermissions.length > 0) {
            combinedDeniedPermissions.forEach(permission => {
                missingPermissions.push(`${permission.service}:${permission.action}`);
            });
        }
        return missingPermissions;
    } catch (error) {
        logger.error('Error while checking for missing optimize permissions', {
            credentialsId,
            region,
            permissions,
            error
        });
    }
}

async function activeSqlNodeDetails(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Getting active node details', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId
    });

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);

    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        fsx_svm_id: svmDetails,
        resource: resourceDetail,
        metadata: instanceMetadata,
        database_deployment_type: databaseDeploymentType
    } = instanceDetail as unknown as DatabaseInstance;

    const { metadata, resource_name: sqlServerName } = resourceDetail! as unknown as ResourceDetails;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        accountId,
        resourceType: databaseType as DatabaseTypes
    });
    logger.info('instancesDetails', { instanceIds: instancesDetails?.map(instance => instance?.instanceName) });
    const sqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to fix instance ${instanceName} in host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);

    return {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        sqlServerName,
        databaseType,
        svmDetails,
        awsAccountId: resourceDetail!.cloud_provider_account_id,
        serverNameWithHostName,
        instanceMetadata,
        databaseDeploymentType
    };
}

//  e.g., "NFSv3" -> 3, "NFSv4" -> 4, "3" -> 3, "4.0" -> 4, "4.1" -> 4.1
function normalizeNfsVersion(version: string | null): number | null {
    if (!version) {
        return null;
    }
    const cleaned = version.toLowerCase().replace(/nfsv?/i, '').trim();
    return parseFloat(cleaned);
}

async function checkIfPatchBaselineInProgress(
    credentialsId: string,
    region: string,
    instanceIds: string[]
): Promise<boolean> {
    logger.info('Checking if patch baseline is in progress', { credentialsId, region, instanceIds });

    for await (const instanceId of instanceIds) {
        const listPatchBaselineCommandParams = {
            InstanceId: instanceId,
            MaxResults: 50,
            Filters: [
                {
                    key: CommandFilterKey.DOCUMENT_NAME,
                    value: 'AWS-RunPatchBaseline'
                },
                {
                    key: CommandFilterKey.STATUS,
                    value: 'InProgress'
                }
            ]
        };

        const { Commands = [] } = await listSsmCommands(credentialsId, region, listPatchBaselineCommandParams);
        if (Commands.length > 0) {
            logger.warn('Patch baseline is already running on the instance', { instanceId, region, credentialsId });
            return true;
        }
    }
    return false;
}

async function updatePatchBaselineStatusForHost(
    accountId: string,
    databaseHostId: string,
    hostOsPatchAssessment?: HostOsPatchAssessmentObject[]
): Promise<void> {
    if (isEmpty(hostOsPatchAssessment)) {
        return;
    }

    const resources =
        (await listResources({
            accountId,
            resourceId: databaseHostId,
            selectKeys: [...new Set([...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data'])]
        })) || [];

    if (!isEmpty(resources)) {
        await Promise.all(
            resources.map(async ({ credentials_id: credentialsId, assessment_data: assessmentData }) => {
                const existingAssessmentData = assessmentData as ResourceAssessmentData;
                const newAssessmentData = {
                    ...existingAssessmentData,
                    hostOsPatch: hostOsPatchAssessment,
                    lastAssessedDate: new Date().getTime().toString()
                };
                await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
            })
        );
    }
}

/**
 * Determines if ontapVolumes uses PDB-grouped structure (pdbName -> fileType -> volumes[])
 * vs flat structure (fileType -> volumes[]).
 * CDB instances without pdbMountDetails will have isCDB=true but flat ontapVolumes.
 */
function isPdbGroupedVolumes(isCDB: boolean, ontapVolumes: OracleMappedOntapVolumeRecordType['ontapVolumes']): boolean {
    const values = Object.values(ontapVolumes || {});
    return isCDB && values.length > 0 && !Array.isArray(values[0]);
}

// Built once at module load; covers both MSSQL and Oracle configs.
const GOLDEN_CONFIG_LOOKUP = {
    [DatabaseTypes.MS_SQL_SERVER]: new Map(MSSQL_GOLDEN_CONFIG.map(entry => [entry.id, entry])),
    [DatabaseTypes.ORACLE]: new Map(ORACLE_GOLDEN_CONFIG.map(entry => [entry.id, entry]))
};

// MSSQL storage golden-config entries, bucketed by resource type; consumed by the storage assessment/drift flow.
const mssqlVolumeConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        e.resourceType === ASSESSMENT_RESOURCE_TYPE.VOLUME &&
        e.id !== OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION
);
const mssqlLunConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e => e.type === 'storage' && e.subType === 'configuration' && e.resourceType === ASSESSMENT_RESOURCE_TYPE.LUN
);
const mssqlOsConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        e.resourceType !== ASSESSMENT_RESOURCE_TYPE.VOLUME &&
        e.resourceType !== ASSESSMENT_RESOURCE_TYPE.LUN &&
        e.id !== OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
);
const mssqlLayoutConfigData = MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'layout');
const mssqlSizingConfigData = MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'sizing');

/** Flags an offline_assessment record as either a file-upload WAD or a background-collected unregistered-instance assessment. */
const OFFLINE_ASSESSMENT_SOURCE = {
    OFFLINE: 'offline',
    UNREGISTERED: 'unregistered'
} as const;

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
    logger.info('Merging per-filesystem storage drift items by id', {
        filesystemCount: driftResultsPerFilesystem.length,
        ids: [...entriesById.keys()]
    });

    const mergedItems = [...entriesById.values()].map(entries => {
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
    logger.info('Merged per-filesystem storage drift items', { mergedItemCount: mergedItems.length });
    return mergedItems;
}

function filterToVolumeLunDriftItems(
    items: (AssessmentItemType | AssessmentErrorItemType)[],
    driftIds: Set<string>
): (AssessmentItemType | AssessmentErrorItemType)[] {
    return items.filter(item => driftIds.has(item.id));
}

async function collectScopedOntapAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    workloadType: DATABASE_TYPE
): Promise<FsxStorageCollectionResult[]> {
    logger.info('Collecting scoped ONTAP assessment', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        workloadType
    });

    const relationship = await buildEc2FsxRelationship(accountId, credentialsId, region);
    const scopedEc2s = relationship.ec2s.filter(ec2 => ec2.instanceId === ec2InstanceId);
    if (scopedEc2s.length === 0) {
        logger.warn('No tagged ONTAP volume relationship found for scoped assessment', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            workloadType
        });
        throw new Error(`No ONTAP volumes found for this instance. ${FSX_LINK_INACTIVE_HINT}`);
    }

    const results = await collectOntapAssessmentData(accountId, credentialsId, { ec2s: scopedEc2s });
    return results.filter(result => result.workloadType === workloadType);
}

function buildAssessmentJobDescriptionWithDashboardLink(
    descriptionPrefix: string,
    ec2InstanceId: string,
    instanceName: string,
    sqlServerDeploymentType: string,
    isUnregistered = false
): string {
    const instanceDetailsForJob = JSON.stringify({
        hostName: ec2InstanceId,
        resourceId: ec2InstanceId,
        databaseInstanceId: instanceName,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType,
        ...(isUnregistered && { isUnregistered: true })
    });

    return `${descriptionPrefix}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
}

async function runScopedOntapSubAssessment<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string,
    workloadType: DATABASE_TYPE,
    workloadLabel: string
): Promise<ScopedOntapStorageResult<T>> {
    const sqlServerDeploymentType = workloadType === DATABASE_TYPE.oracle ? RESOURCESTYPE.ORACLE : RESOURCESTYPE.MSSQL;
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'ONTAP volume/LUN storage assessment',
        description: buildAssessmentJobDescriptionWithDashboardLink(
            `ONTAP volume/LUN storage assessment for ${ec2InstanceId}/${instanceName}`,
            ec2InstanceId,
            instanceName,
            sqlServerDeploymentType,
            true
        ),
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    try {
        const results = await collectScopedOntapAssessment(
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            workloadType
        );
        const ontapStorageAssessments = results.map(result => result.storageAssessment as unknown as T);

        if (ontapStorageAssessments.length === 0) {
            status = JOBSTATUS.FAILED;
            errorMessage = `No ONTAP volumes found for this instance: no ${workloadLabel} workload tag detected`;
            logger.warn('No tagged ONTAP volumes found for unregistered instance', {
                accountId,
                credentialsId,
                region,
                ec2InstanceId,
                instanceName,
                workloadType,
                errorMessage
            });
            return { error: errorMessage };
        }

        logger.info('Collected scoped ONTAP assessment for unregistered instance', {
            accountId,
            region,
            ec2InstanceId,
            instanceName,
            workloadType,
            filesystemCount: ontapStorageAssessments.length
        });
        return { ontapStorageAssessments, headroomData: results[0]?.headroomData };
    } catch (error) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : 'ONTAP storage assessment failed';
        logger.warn(
            `Failed to collect ONTAP storage assessment for unregistered ${workloadLabel} instance; continuing with other findings`,
            { accountId, credentialsId, region, ec2InstanceId, error: errorMessage }
        );
        return { error: errorMessage };
    } finally {
        await updateJobDetails(accountId, subJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

function getGoldenConfigEntryById(configData: GoldenConfigEntry[], id: string): GoldenConfigEntry {
    const entry = configData.find(data => data.id === id);
    if (!entry) {
        const errorMessage = `Golden config entry with id "${id}" was not found. It may have been renamed or removed.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return entry;
}

function enrichWithGoldenConfig(entries: DismissConfig[], databaseType: DatabaseTypes): DismissedConfigurationType[] {
    const lookup = GOLDEN_CONFIG_LOOKUP[databaseType as keyof typeof GOLDEN_CONFIG_LOOKUP];
    return entries.map(entry => {
        const match = lookup?.get(entry.id);
        return {
            id: match?.id ?? entry.id,
            configurationName: match?.id ?? entry.id,
            configState: entry.configState,
            startTime: entry.startTime,
            endTime: entry.endTime,
            name: match?.name ?? entry.id,
            type: match?.type ?? '',
            subType: match?.subType,
            severity: match?.severity ?? '',
            recommendation: match?.recommendation ?? '',
            categories: match?.categories ?? []
        };
    });
}

interface MapAssessmentToV1Config {
    /**
     * Selects and shapes the metadata fields that become the v1 top-level response properties.
     * DB-specific: MSSQL spreads all metadata fields; Oracle picks a specific subset.
     */
    metadataSelector: (metadata: AssessmentMetadataType) => Record<string, unknown>;
    /** Lookup map that classifies storage assessment ids into luns vs os buckets. */
    storageConfigMap: { luns: string[]; os: string[] };
    /**
     * Optional id-based sizing/layout classification (in addition to subType checks).
     * Used by Oracle; omit for MSSQL.
     */
    storageSizingLayoutMap?: { sizing: string[]; layout: string[] };
    /** Maps assessment `id` to the v1 top-level response key for single-item areas. */
    singleKeyById: Record<string, string>;
    /** Maps dismissed `configurationName` to the v1 dismissedConfigurations key. */
    dismissSingleKeyByName: Record<string, string>;
    /** When true, collects a `highAvailability` bucket. Currently only MSSQL. */
    supportsHighAvailability?: boolean;
    /**
     * Returns extra fields merged into the `storage` object (e.g., MSSQL `fileSystems`).
     * Evaluated lazily from metadata so configs remain static constants.
     */
    storageExtraSelector?: (metadata: AssessmentMetadataType) => Record<string, unknown>;
    /** Validates the assembled v1 response; returns `{ isValid, errors }`. */
    validate: (response: unknown) => { isValid: boolean; errors: unknown };
    /** Database label used in validation error log messages (e.g., 'MSSQL', 'Oracle'). */
    dbLabel: string;
}

/**
 * Maps a v2 flat assessment response back into the nested v1 shape.
 *
 * v2 renamed `name`→`id` and `tags`→`categories`, flattened storage sub-groups into a single
 * `assessments[]`, and lifted identity/timing fields into `metadata`. This function reverses all of
 * those changes in a DB-agnostic way; DB-specific behaviour is supplied via `config`.
 *
 * Returns `{}` when schema validation fails.
 */
function mapAssessmentToV1(
    v2Response: {
        assessments: (AssessmentItemType | AssessmentErrorItemType)[];
        dismissedConfigurations: DismissedConfigurationType[];
        metadata: AssessmentMetadataType;
    },
    config: MapAssessmentToV1Config
): Record<string, unknown> {
    const { assessments, dismissedConfigurations, metadata } = v2Response;
    const {
        metadataSelector,
        storageConfigMap,
        storageSizingLayoutMap,
        singleKeyById,
        dismissSingleKeyByName,
        supportsHighAvailability = false,
        storageExtraSelector,
        validate,
        dbLabel
    } = config;

    const response: Record<string, unknown> = { ...metadataSelector(metadata) };
    const storageConfiguration: { volumes: unknown[]; luns: unknown[]; os: unknown[] } = {
        volumes: [],
        luns: [],
        os: []
    };
    const storageSizing: unknown[] = [];
    const storageLayout: unknown[] = [];
    const highAvailability: unknown[] = [];
    let hasStorage = false;

    for (const item of assessments) {
        const { id, type, subType } = item;
        // v1 keys the item by `name` (v2 renamed it to `id`) and exposes the pillars as `tags` (v2 `categories`).
        // Fastify's response serializer will exclude `id` and `categories` based on the schema definition.
        const v1Item = { ...item, name: item.id, tags: item.categories };

        if (type === 'storage') {
            hasStorage = true;
            if (subType === 'sizing' || storageSizingLayoutMap?.sizing.includes(id)) {
                storageSizing.push(v1Item);
            } else if (subType === 'layout' || storageSizingLayoutMap?.layout.includes(id)) {
                storageLayout.push(v1Item);
            } else if (storageConfigMap.luns.includes(id)) {
                storageConfiguration.luns.push(v1Item);
            } else if (storageConfigMap.os.includes(id)) {
                storageConfiguration.os.push(v1Item);
            } else {
                storageConfiguration.volumes.push(v1Item);
            }
        } else if (supportsHighAvailability && subType === 'highAvailability') {
            highAvailability.push(v1Item);
        } else {
            const responseKey = singleKeyById[id];
            if (responseKey) {
                response[responseKey] = v1Item;
            }
        }
    }

    if (hasStorage) {
        response.storage = {
            configuration: storageConfiguration,
            sizing: storageSizing,
            layout: storageLayout,
            ...storageExtraSelector?.(metadata)
        };
    }
    if (supportsHighAvailability && !isEmpty(highAvailability)) {
        response.highAvailability = highAvailability;
    }

    // v2 flattened dismissed configurations into an array; rebuild the keyed v1 object.
    if (!isEmpty(dismissedConfigurations)) {
        const dismissed: Record<string, unknown> = {};
        const dismissConfiguration: Record<string, unknown[]> = { volumes: [], luns: [], os: [] };
        const dismissSizing: unknown[] = [];
        const dismissLayout: unknown[] = [];
        const dismissHighAvailability: unknown[] = [];
        let hasDismissStorage = false;

        for (const entry of dismissedConfigurations) {
            const { configurationName, configState, startTime, endTime, type, subType } = entry;
            // v2 enriches each dismissed entry with golden-config static props; v1 keeps only the dismiss fields.
            const dismissItem = { configurationName, configState, startTime, endTime };
            if (type === 'storage') {
                hasDismissStorage = true;
                if (subType === 'sizing' || storageSizingLayoutMap?.sizing.includes(configurationName)) {
                    dismissSizing.push(dismissItem);
                } else if (subType === 'layout' || storageSizingLayoutMap?.layout.includes(configurationName)) {
                    dismissLayout.push(dismissItem);
                } else if (storageConfigMap.luns.includes(configurationName)) {
                    dismissConfiguration.luns.push(dismissItem);
                } else if (storageConfigMap.os.includes(configurationName)) {
                    dismissConfiguration.os.push(dismissItem);
                } else {
                    dismissConfiguration.volumes.push(dismissItem);
                }
            } else if (supportsHighAvailability && subType === 'highAvailability') {
                dismissHighAvailability.push(dismissItem);
            } else {
                const dismissKey = dismissSingleKeyByName[configurationName];
                if (dismissKey) {
                    dismissed[dismissKey] = dismissItem;
                }
            }
        }

        if (hasDismissStorage) {
            dismissed.storage = {
                configuration: dismissConfiguration,
                sizing: dismissSizing,
                layout: dismissLayout
            };
        }
        if (supportsHighAvailability && !isEmpty(dismissHighAvailability)) {
            dismissed.highAvailability = dismissHighAvailability;
        }
        response.dismissedConfigurations = dismissed;
    }

    const { isValid, errors } = validate(response);
    if (!isValid) {
        logger.error(`Invalid ${dbLabel} assessment V1 response`, { errors });
        return {};
    }
    return response;
}

function shouldKeepGoldenConfigEntries(
    entries: GoldenConfigEntry[],
    isIscsi: boolean,
    isAsmManaged: boolean | undefined,
    dismissedIds: Set<string>
): boolean {
    if (!entries.length) {
        return true;
    }
    return (
        (isIscsi || !entries.every(e => e.applicableTo === 'iscsi')) &&
        (isAsmManaged !== false || !entries.every(e => e.applicableTo === 'asm')) &&
        (dismissedIds.size === 0 || entries.some(e => !dismissedIds.has(e.id)))
    );
}

function isApplicableToStorageProtocol(
    entry: GoldenConfigEntry,
    protocol: string | undefined,
    isAsmManaged: boolean | undefined
): boolean {
    if (entry.applicableTo === 'iscsi') {
        return protocol === STORAGE_PROTOCOLS.ISCSI;
    }
    if (entry.applicableTo === 'nfs') {
        return protocol === STORAGE_PROTOCOLS.NFS;
    }
    if (entry.applicableTo === 'asm') {
        return !!isAsmManaged;
    }
    return true;
}

function resolveAssessmentTypes(
    databaseType: DatabaseTypes,
    fields: string | string[] | undefined,
    context: {
        deploymentType?: string;
        storageProtocol?: string;
        isAsmManaged?: boolean;
        isDataGuardDeployed?: boolean;
    },
    dismissedIds: Set<string>
): { categories: string[]; configIds: string[] } {
    const parsed = Array.isArray(fields) ? fields : fields?.toLowerCase().replace(/\s+/g, '').split(',');
    const requested =
        parsed ??
        (databaseType === DatabaseTypes.MS_SQL_SERVER
            ? Object.values(AssessmentCategories)
            : Object.values(AssessmentCategoriesOracle));

    const goldenConfig = databaseType === DatabaseTypes.MS_SQL_SERVER ? MSSQL_GOLDEN_CONFIG : ORACLE_GOLDEN_CONFIG;
    const { deploymentType, storageProtocol, isAsmManaged } = context;
    const isIscsi = (storageProtocol ?? STORAGE_PROTOCOLS.ISCSI) === STORAGE_PROTOCOLS.ISCSI;

    const resolved = requested
        .map(category => {
            switch (category) {
                case AssessmentCategories.LICENSE: {
                    if (deploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
                        return { category, entries: [], keep: false };
                    }
                    const entries = goldenConfig.filter(e => e.id === 'sql-license');
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
                case AssessmentCategories.HIGH_AVAILABILITY: {
                    if (deploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
                        return { category, entries: [], keep: false };
                    }
                    const entries = goldenConfig.filter(e => e.subType === 'highAvailability');
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
                case AssessmentCategories.AWS_BACKUP: {
                    const entries = goldenConfig.filter(e => e.id === 'backup-configuration');
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
                case AssessmentCategories.CLONE: {
                    const entries = goldenConfig.filter(e => e.id === 'clone-management');
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
                case AssessmentCategories.STORAGE: {
                    const entries = goldenConfig.filter(e => e.type === 'storage');
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
                case AssessmentCategories.COMPUTE: {
                    return { category, entries: goldenConfig.filter(e => e.id === 'compute-rightsizing'), keep: true };
                }
                default: {
                    const entries = goldenConfig.filter(e => e.id === category);
                    return {
                        category,
                        entries,
                        keep: shouldKeepGoldenConfigEntries(entries, isIscsi, isAsmManaged, dismissedIds)
                    };
                }
            }
        })
        .filter(({ keep }) => keep);

    return {
        categories: resolved.map(({ category }) => category),
        configIds: [...new Set(resolved.flatMap(({ entries }) => entries.map(e => e.id)))]
    };
}

/** Minimal drift payload used when expanding combined optimize targets. */
interface CombinedDriftEntry {
    id?: string;
    violationDetails?: GenericViolationResponseType[];
}

/** Type guard for combined-entry violation rows that carry per-sub-parameter `violatedConfigs`. */
function isCombinedViolationDetail(value: unknown): value is GenericViolationResponseType {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const row = value as Record<string, unknown>;
    if (typeof row.objectName !== 'string' || row.objectName.length === 0) {
        return false;
    }
    if (!Array.isArray(row.violatedConfigs) || row.violatedConfigs.length === 0) {
        return false;
    }
    return row.violatedConfigs.every(
        config =>
            config &&
            typeof config === 'object' &&
            typeof (config as Record<string, unknown>).id === 'string' &&
            ((config as Record<string, unknown>).id as string).length > 0
    );
}

// Numeric golden-config comparisons treat null/undefined/'' as absent, not zero.
function isMissingGoldenConfigValue(val: unknown): boolean {
    return val === null || val === undefined || val === '';
}

/**
 * Coerces an assessed value to a canonical string for golden-config drift comparison.
 * Coercion follows the expected value's type (`template`): booleans accept true/'true',
 * numbers are normalized via Number(), strings use String(val ?? '').
 */
function normalizeForGoldenConfigCompare(val: unknown, template: unknown): string {
    if (typeof template === 'boolean') {
        return String(val === true || val === 'true' || String(val).toLowerCase() === 'true');
    }
    if (typeof template === 'number') {
        if (isMissingGoldenConfigValue(val)) {
            return '';
        }
        const num = Number(val);
        return Number.isNaN(num) ? String(val) : String(num);
    }
    return String(val ?? '');
}

function buildCombinedAssessmentDetails(
    objects: Array<Record<string, unknown>>,
    components: ReadonlyArray<{ parameter: string; value: unknown; name?: string }>,
    violatedObjectNames: string[]
) {
    return objects.map(obj => ({
        id: String(obj.uuid ?? obj.name),
        name: String(obj.name),
        metadata: {
            components: components.map(c => ({
                parameter: c.name ?? c.parameter,
                current: String(obj[c.parameter]),
                recommended: String(c.value),
                status: violatedObjectNames.includes(String(obj.name))
                    ? AssessmentStatus.NOT_OPTIMIZED
                    : AssessmentStatus.OPTIMIZED
            }))
        },
        ...(obj.svmName !== undefined && { svmName: String(obj.svmName) }),
        status: violatedObjectNames.includes(String(obj.name))
            ? AssessmentStatus.NOT_OPTIMIZED
            : AssessmentStatus.OPTIMIZED
    }));
}

/**
 * Assembles a volume-only combined drift entry (e.g. tiering-tco-optimization) by evaluating
 * each volume against all golden-config components via buildViolationRow.
 */
function buildVolumeCombinedEntry(
    config: GoldenConfigEntry,
    volumes: Array<Record<string, unknown>>
): AssessmentItemType {
    const components = config.components ?? [];
    if (!components.length) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${config.id} golden config is missing components`);
    }

    const violationDetails: GenericViolationResponseType[] = [];
    volumes.forEach(volume => {
        const row = buildViolationRow(volume, ASSESSMENT_RESOURCE_TYPE.VOLUME, components);
        if (row) {
            violationDetails.push(row);
        }
    });

    const objectsInViolation = violationDetails.map(row => row.objectName);
    const assessmentDetails = buildCombinedAssessmentDetails(volumes, components, objectsInViolation);
    return {
        ...config,
        recommended: '',
        status: objectsInViolation.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation,
        totalObjectsAssessed: volumes.length,
        totalObjectsInViolation: objectsInViolation.length,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        violationDetails,
        assessmentDetails,
        configDetails: components.map((component: GoldenConfigComponent) => ({
            id: component.name ?? component.parameter,
            recommended: String(component.value),
            objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
        }))
    } as AssessmentItemType;
}

/**
 * Builds one combined-entry violation row for a volume or LUN.
 * Compares each component sub-parameter with type-normalized golden-config values; skips unnamed objects.
 */
function buildViolationRow(
    obj: Record<string, unknown>,
    objectType: typeof ASSESSMENT_RESOURCE_TYPE.VOLUME | typeof ASSESSMENT_RESOURCE_TYPE.LUN,
    components: ReadonlyArray<{ parameter: string; value: unknown; name?: string }>
): GenericViolationResponseType | undefined {
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
        return undefined;
    }
    const violatedConfigs: ViolatedConfigType[] = components
        .filter(
            component =>
                normalizeForGoldenConfigCompare(obj[component.parameter], component.value) !==
                normalizeForGoldenConfigCompare(component.value, component.value)
        )
        .map(component => ({
            id: component.name ?? component.parameter,
            current: String(obj[component.parameter] ?? '')
        }));
    if (violatedConfigs.length === 0) {
        return undefined;
    }
    return {
        objectName: obj.name,
        value: '',
        objectType,
        violatedConfigs
    };
}

/**
 * Assembles the `block-device-space-management` combined drift entry by evaluating every LUN and
 * volume independently against their respective golden-config sub-parameters.
 */
function buildBlockDeviceSpaceManagementEntry(
    config: GoldenConfigEntry,
    luns: Array<Record<string, unknown>>,
    volumes: Array<Record<string, unknown>>
): AssessmentItemType {
    const { components } = config;
    if (!components?.length) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'block-device-space-management golden config is missing components'
        );
    }

    const componentObjectType = (source: 'lun' | 'volume' | undefined) =>
        source === 'lun' ? ASSESSMENT_RESOURCE_TYPE.LUN : ASSESSMENT_RESOURCE_TYPE.VOLUME;

    const configDetails: ConfigDetailType[] = components.map((component: GoldenConfigComponent) => ({
        id: component.name ?? component.parameter,
        recommended: String(component.value),
        objectType: componentObjectType(component.source)
    }));
    const lunComponents = components.filter((component: GoldenConfigComponent) => component.source === 'lun');
    const volumeComponents = components.filter((component: GoldenConfigComponent) => component.source === 'volume');

    const violationDetails: GenericViolationResponseType[] = [];

    luns.forEach(lun => {
        const row = buildViolationRow(lun, ASSESSMENT_RESOURCE_TYPE.LUN, lunComponents);
        if (row) {
            violationDetails.push(row);
        }
    });
    volumes.forEach(volume => {
        const row = buildViolationRow(volume, ASSESSMENT_RESOURCE_TYPE.VOLUME, volumeComponents);
        if (row) {
            violationDetails.push(row);
        }
    });

    const objectsInViolation = violationDetails.map(row => row.objectName);
    const assessmentDetails = [
        ...buildCombinedAssessmentDetails(luns, lunComponents, objectsInViolation),
        ...buildCombinedAssessmentDetails(volumes, volumeComponents, objectsInViolation)
    ];
    return {
        ...config,
        recommended: '',
        status: objectsInViolation.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation,
        totalObjectsAssessed: luns.length + volumes.length,
        totalObjectsInViolation: objectsInViolation.length,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME_OR_LUN,
        violationDetails,
        assessmentDetails,
        configDetails
    } as AssessmentItemType;
}

// Maps each violated object in a combined drift entry to the sub-parameters it violates,
// filtered to `validSubParams` (the descriptor's `configKey` set).
function buildViolatedSubParamsByObject(
    combinedEntry: CombinedDriftEntry,
    validSubParams: ReadonlySet<string>
): Map<string, string[]> {
    const violatedSubParamsByObject = new Map<string, string[]>();
    combinedEntry.violationDetails?.forEach(violation => {
        const { objectName, violatedConfigs } = violation;
        if (!objectName || !violatedConfigs?.length) {
            return;
        }
        const subParamNames = violatedConfigs
            .map(({ id }) => id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0 && validSubParams.has(id));
        if (subParamNames.length === 0) {
            return;
        }
        violatedSubParamsByObject.set(objectName, subParamNames);
    });
    return violatedSubParamsByObject;
}

/**
 * Replaces each combined target with synthetic per-sub-parameter targets that carry only objects
 * flagged by `combinedDriftEntries[*].violatedConfigs[*]`. Non-combined targets pass through unchanged.
 */
function expandCombinedTargets(
    optimizationTargets: OptimizeStorageRequestParams[],
    combinedDriftEntries: ReadonlyArray<CombinedDriftEntry>
): OptimizeStorageRequestParams[] {
    if (!optimizationTargets.some(target => isCombinedOptimizeConfig(target.configurationName))) {
        return optimizationTargets;
    }

    const expanded: OptimizeStorageRequestParams[] = [];
    optimizationTargets.forEach(target => {
        if (!isCombinedOptimizeConfig(target.configurationName)) {
            expanded.push(target);
            return;
        }
        const combinedName = target.configurationName as CombinedOptimizeConfigName;
        const descriptor = COMBINED_OPTIMIZE_DESCRIPTORS[combinedName];
        const validSubParams = new Set<string>(descriptor.components.map(component => component.configKey));

        const combinedEntry = combinedDriftEntries.find(entry => entry.id === combinedName);
        if (!combinedEntry?.violationDetails) {
            return;
        }

        const violatedSubParamsByObject = buildViolatedSubParamsByObject(combinedEntry, validSubParams);

        const perTargetSynthetics = new Map<string, Set<string>>();
        target.objectsToOptimize.forEach(objectName => {
            const violatedSubParams = violatedSubParamsByObject.get(objectName);
            if (!violatedSubParams) {
                return;
            }
            violatedSubParams.forEach(subParam => {
                const bucket = perTargetSynthetics.get(subParam) ?? new Set<string>();
                bucket.add(objectName);
                perTargetSynthetics.set(subParam, bucket);
            });
        });
        descriptor.components.forEach(({ configKey }) => {
            const objects = perTargetSynthetics.get(configKey);
            if (!objects?.size) {
                return;
            }
            expanded.push({ configurationName: configKey, objectsToOptimize: [...objects] });
        });
    });

    return mergeOptimizationTargets(expanded);
}

export {
    buildBlockDeviceSpaceManagementEntry,
    buildVolumeCombinedEntry,
    expandCombinedTargets,
    isCombinedViolationDetail,
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    hasNotOptimizedStatus,
    getLatestInstanceAssessmentTime,
    checkForMissingOptimizePermissions,
    activeSqlNodeDetails,
    normalizeNfsVersion,
    checkIfPatchBaselineInProgress,
    updatePatchBaselineStatusForHost,
    isPdbGroupedVolumes,
    enrichWithGoldenConfig,
    mapAssessmentToV1,
    resolveAssessmentTypes,
    GOLDEN_CONFIG_LOOKUP,
    mssqlVolumeConfigData,
    mssqlLunConfigData,
    mssqlOsConfigData,
    mssqlLayoutConfigData,
    mssqlSizingConfigData,
    getGoldenConfigEntryById,
    OFFLINE_ASSESSMENT_SOURCE,
    dedupeViolationDetails,
    mergeStorageDriftItemsById,
    filterToVolumeLunDriftItems,
    collectScopedOntapAssessment,
    runScopedOntapSubAssessment,
    FSX_LINK_INACTIVE_HINT,
    buildAssessmentJobDescriptionWithDashboardLink,
    isApplicableToStorageProtocol
};

export type {
    GoldenConfigEntry,
    GoldenConfigComponent,
    MapAssessmentToV1Config,
    UnOptimizedDiskGroups,
    ScopedOntapStorageResult
};
