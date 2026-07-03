import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import moment from 'moment';
import throat from 'throat';
import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import getLogger from '../../../utils/logger';
import { extractSqlInstanceName, IS_DEMO_FLOW, sleep, validateWithSchema } from '../../../utils/utils';
import {
    getInstanceInfo,
    getResources,
    updateDatabaseHostAssessmentData,
    updateDatabaseHostAssessmentResults,
    updateDatabaseInstanceAssessmentResults
} from '../../database/database-operations';
import {
    CloneAssessment,
    DatabaseInstance,
    DatabaseInstancesIncludingResource,
    DismissConfig,
    MappedOnTapVolumeResponse,
    MaxDOPAssesment,
    Metadata,
    ResourceAssessmentData,
    ResourceDetails,
    StorageAssessment,
    WorkloadInstance
} from '../../../utils/common-types';
import {
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    AuditStatus,
    HttpErrorCodes,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES,
    DatabaseTypes
} from '../../../utils/consts';
import {
    AssessmentCategories,
    AssessmentStatus,
    AssessmentTriggeredBy,
    MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP
} from '../../../utils/continous-optimization-consts';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { calculateComputeDrift, managedHostsComputeAssessment } from '../compute-assessment-operations';
import {
    calculateHostOsPatchDrift,
    fetchMssqlHostOsPatchWithMissingPatches,
    managedHostOsPatchAssessment
} from './hostOsPatch-assessment-operations';
import { calculateLicenseDrift, managedHostsLicenseAssessment } from './license-assessment-operations';
import {
    calculateMSSQLPatchDrift,
    fetchMssqlPatchWithMissingPatches,
    managedHostMSSQLPatchAssessment
} from './mssqlPatch-assessment-operations';
import { calculateRssConfigDrift, managedHostsRssConfigAssessment } from './rssConfig-assessment-operations';
import { assessMTUAlignment, calculateMTUAlignmentDrift } from './mtu-assessment-operations';
import { describeFSxStorageVirtualMachines } from '../../../lib/aws/fsx';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../../lib/database/database-instance-config';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { calculateCloneDrift, managedHostsCloneAssessment } from './clone-assessment-operations';
import { calculateMaxDOPDrift, managedHostsMaxDOPAssessment } from './maxdop-assessment-operations';
import {
    initiateCrossRegionResiliencyAssessment,
    initiateAWSBackupAssessment,
    getResilienceDriftAssessment,
    initiateInstanceLevelHighAvailabilityAssessment,
    initiateHostLevelHighAvailabilityAssessment
} from './resilience-assessment-operation';
import {
    calculateSnapCenterDrift,
    initiateSnapCenterAssessmentCollection,
    type MssqlSnapcenterAssessmentData,
    type MssqlSnapCenterRelevantVolumeIds
} from './snapcenter-assessment-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { getInstanceDetails } from '../../database-hosts-operations';
import {
    enrichWithGoldenConfig,
    getLatestInstanceAssessmentTime,
    mapAssessmentToV1,
    resolveAssessmentTypes,
    type MapAssessmentToV1Config
} from '../assessment-utils';
import {
    DriftAssessmentResponsePerHostType,
    DriftAssessmentResponsePerAccountV1Type,
    MssqlPatchScanFieldType,
    MssqlAssessmentResponse,
    MssqlAssessmentResponseType,
    MssqlAssessmentResponseV1Type,
    MssqlAssessmentResponseV1,
    MssqlAssessmentItemsResponseSchema
} from '../../../routes/types/mssql-continuous-optimisation.types';
import {
    type AssessmentItemType,
    type AssessmentErrorItemType
} from '../../../routes/types/continuous-optimization.types';
import { calculateStorageDrift, initiateStorageAssessmentCollection } from './storage-assessment-operations';
import { handleGetMssqlAssessmentForDemo } from '../../demo-operations';
import { listJobs } from '../../../lib/database/job';
import { filterExpiredDismissConfigs } from '../assessment-dismiss-operations';

const logger = getLogger();

// Categories to exclude from assessment response for AOAG deployment type
const AOAG_EXCLUDED_IDS = ['sql-license'];

// HA items to exclude for all AOAG deployments (sqlServer-service runs for both FCI and standalone AOAG)
const AOAG_EXCLUDED_HA_ITEMS: string[] = [];
// HA items to additionally exclude for standalone AOAG (shared-storage and drive-letter are FCI-specific checks)
const STANDALONE_AOAG_EXCLUDED_HA_ITEMS = ['shared-storage', 'drive-letter', 'cluster-quorum'];

const AOAG_EXCLUDED_STORAGE_VOLUME_CONFIG = ['snapshot-copy-reserve'];

/**
 * Filter flat assessment items for AOAG deployments.
 * Removes items not applicable to AOAG (excluded storage volume configs, excluded HA items,
 * and when `excludeCategories` is set, items whose category matches).
 */
function filterAoagItems(
    assessments: (AssessmentItemType | AssessmentErrorItemType)[],
    opts: { isStandaloneAoag: boolean; excludeCategories?: string[] }
): (AssessmentItemType | AssessmentErrorItemType)[] {
    const excludedHaItems = opts.isStandaloneAoag
        ? [...AOAG_EXCLUDED_HA_ITEMS, ...STANDALONE_AOAG_EXCLUDED_HA_ITEMS]
        : AOAG_EXCLUDED_HA_ITEMS;

    return assessments.filter(item => {
        if (
            item.type === 'storage' &&
            item.subType === 'configuration' &&
            AOAG_EXCLUDED_STORAGE_VOLUME_CONFIG.includes(item.id)
        ) {
            return false;
        }
        if (item.subType === 'highAvailability' && excludedHaItems.includes(item.id)) {
            return false;
        }
        if (
            opts.excludeCategories?.length &&
            item.type &&
            opts.excludeCategories.map(c => c.toLowerCase()).includes(item.type.toLowerCase())
        ) {
            return false;
        }
        return true;
    });
}

function hostLevelDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    metadata: Metadata,
    hostLevelAssessmentData: ResourceAssessmentData,
    fieldsValues: string[]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching host level drift data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fieldsValues
    });

    const assessmentFlags = {
        compute: fieldsValues?.includes(AssessmentCategories.COMPUTE.toLowerCase()),
        license: fieldsValues?.includes(AssessmentCategories.LICENSE.toLowerCase()),
        hostOsPatch: fieldsValues?.includes(AssessmentCategories.HOST_OS_PATCH.toLowerCase()),
        rssConfig: fieldsValues?.includes(AssessmentCategories.RSS_CONFIG.toLowerCase()),
        mtuAlignment: fieldsValues?.includes(AssessmentCategories.MTU_ALIGNMENT.toLowerCase()),
        mssqlPatch: fieldsValues?.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase())
    };

    return [
        ...(assessmentFlags.compute
            ? [
                  calculateComputeDrift(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      hostLevelAssessmentData
                  )
              ]
            : []),
        ...(assessmentFlags.license
            ? [
                  calculateLicenseDrift(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      hostLevelAssessmentData
                  )
              ]
            : []),
        ...(assessmentFlags.hostOsPatch
            ? [calculateHostOsPatchDrift(accountId, credentialsId, region, databaseHostId, hostLevelAssessmentData)]
            : []),
        ...(assessmentFlags.rssConfig
            ? [
                  calculateRssConfigDrift(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      metadata as Metadata,
                      hostLevelAssessmentData
                  )
              ]
            : []),
        ...(assessmentFlags.mtuAlignment
            ? [
                  calculateMTUAlignmentDrift(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      metadata as Metadata,
                      hostLevelAssessmentData
                  )
              ]
            : []),
        ...(assessmentFlags.mssqlPatch
            ? [calculateMSSQLPatchDrift(accountId, credentialsId, region, databaseHostId, hostLevelAssessmentData)]
            : [])
    ];
}

function getSnapCenterRelevantVolumeIds(
    instanceVolumeMapping?: MappedOnTapVolumeResponse[]
): MssqlSnapCenterRelevantVolumeIds {
    const volumeDBMap = Object.values(instanceVolumeMapping || []).flatMap(entry => entry?.volumeDBMap || []);

    const tempdbVolumeIds = [
        ...new Set(volumeDBMap.filter(v => v.databaseName === 'tempdb').map(v => v.ontapVolumeuuid))
    ];
    const tempdbVolumeIdSet = new Set(tempdbVolumeIds);
    const dataVolumeIds = [
        ...new Set(
            volumeDBMap
                .filter(v => !tempdbVolumeIdSet.has(v.ontapVolumeuuid) && !isEmpty(v.dataLunUuids))
                .map(v => v.ontapVolumeuuid)
        )
    ];

    return { dataVolumeIds, tempdbVolumeIds };
}

async function fetchMssqlDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
): Promise<MssqlAssessmentResponseType> {
    logger.info('Fetching drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    const instanceDetail =
        databaseInstance ?? (await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId));

    const {
        database_instance_name: databaseInstanceName,
        fsxn_ids: fileSystemId,
        configurations: instanceConfigurations,
        database_deployment_type: databaseDeploymentType,
        resource: {
            configurations: hostConfigurations,
            metadata: resourceMetadata,
            assessment_data: hostLevelAssessmentData,
            resource_name: resourceName
        }
    } = instanceDetail as DatabaseInstance;

    // older dismissConfig was an Object so checking array
    const instanceDismissedConfigs = Array.isArray(instanceConfigurations)
        ? (instanceConfigurations as DismissConfig[])
        : [];
    const hostDismissedConfigs = Array.isArray(hostConfigurations) ? (hostConfigurations as DismissConfig[]) : [];
    const dismissedConfigs = filterExpiredDismissConfigs(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        instanceDismissedConfigs,
        hostDismissedConfigs,
        databaseInstanceId
    );
    const dismissedIds = new Set(dismissedConfigs.map(c => c.id));

    const isAoagDeployment = databaseDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT;
    const { categories: assessmentTypes } = resolveAssessmentTypes(
        DatabaseTypes.MS_SQL_SERVER,
        fields,
        { deploymentType: databaseDeploymentType },
        dismissedIds
    );

    const assessmentFlags = {
        storage: assessmentTypes.includes(AssessmentCategories.STORAGE),
        compute: assessmentTypes.includes(AssessmentCategories.COMPUTE),
        license: assessmentTypes.includes(AssessmentCategories.LICENSE),
        hostOsPatch: assessmentTypes.includes(AssessmentCategories.HOST_OS_PATCH),
        rssConfig: assessmentTypes.includes(AssessmentCategories.RSS_CONFIG),
        mtuAlignment: assessmentTypes.includes(AssessmentCategories.MTU_ALIGNMENT),
        maxDOP: assessmentTypes.includes(AssessmentCategories.MAXDOP),
        mssqlPatch: assessmentTypes.includes(AssessmentCategories.MSSQL_PATCH),
        resilience: [
            AssessmentCategories.SNAPSHOT_POLICY,
            AssessmentCategories.AWS_BACKUP,
            AssessmentCategories.CRR,
            AssessmentCategories.HIGH_AVAILABILITY
        ].some(category => assessmentTypes.includes(category)),
        snapcenterSnapshot: assessmentTypes.includes(AssessmentCategories.SNAPCENTER_SNAPSHOT),
        clone: assessmentTypes.includes(AssessmentCategories.CLONE)
    };

    const databaseInstanceConfigData = await listDatabaseInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceIds: [databaseInstanceId]
    });

    const assessmentDataMap = databaseInstanceConfigData.reduce(
        (acc: Record<string, unknown>, config: { config_data_type: string; config_data: unknown }) => {
            acc[config.config_data_type] = acc[config.config_data_type] || config.config_data;
            return acc;
        },
        {} as Record<string, unknown>
    );

    const storedAoagDetails = (hostLevelAssessmentData as ResourceAssessmentData)?.aoagDetails;

    const [storageAssessmentResponse, resilienceAssessmentResponse] = await Promise.all([
        assessmentFlags.storage
            ? calculateStorageDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.STORAGE] as StorageAssessment,
                  isAoagDeployment && storedAoagDetails?.databaseRoles
                      ? { databaseRoles: storedAoagDetails.databaseRoles }
                      : undefined
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([]),
        assessmentFlags.resilience
            ? getResilienceDriftAssessment(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  resourceName!,
                  databaseInstanceId,
                  assessmentTypes,
                  hostLevelAssessmentData as ResourceAssessmentData,
                  databaseInstanceConfigData
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([])
    ]);

    const [maxDOPResponse, cloneResponse, snapcenterDriftData, hostLevelData] = [
        assessmentFlags.maxDOP
            ? calculateMaxDOPDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.MAXDOP] as MaxDOPAssesment,
                  databaseInstanceName
              )
            : undefined,
        assessmentFlags.clone
            ? calculateCloneDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.CLONE] as CloneAssessment
              )
            : undefined,
        assessmentFlags.snapcenterSnapshot
            ? calculateSnapCenterDrift(
                  assessmentDataMap[AssessmentCategories.SNAPCENTER_SNAPSHOT] as
                      | MssqlSnapcenterAssessmentData
                      | undefined,
                  getSnapCenterRelevantVolumeIds(
                      assessmentDataMap[AssessmentCategories.MAPPED_ONTAP_VOLUMES] as
                          | MappedOnTapVolumeResponse[]
                          | undefined
                  )
              )
            : undefined,
        assessmentFlags.compute ||
        assessmentFlags.license ||
        assessmentFlags.hostOsPatch ||
        assessmentFlags.mssqlPatch ||
        assessmentFlags.rssConfig ||
        assessmentFlags.mtuAlignment
            ? hostLevelDriftData(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  resourceMetadata as Metadata,
                  hostLevelAssessmentData as ResourceAssessmentData,
                  assessmentTypes
              )
            : []
    ];

    const latestInstanceAssessmentTime = getLatestInstanceAssessmentTime(databaseInstanceConfigData).getTime();

    const baseDeploymentType = isAoagDeployment
        ? (hostLevelAssessmentData as ResourceAssessmentData)?.aoagDetails?.baseDeploymentType
        : undefined;
    const isStandaloneAoag = baseDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT;

    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    [storageAssessmentResponse, hostLevelData, resilienceAssessmentResponse].forEach(item => {
        if (!isEmpty(item) && item.length > 0) {
            assessments.push(...item);
        }
    });
    [maxDOPResponse, cloneResponse, snapcenterDriftData].forEach(item => {
        if (!isEmpty(item)) {
            assessments.push(item);
        }
    });

    // Apply AOAG-specific filtering on the flat array
    let filteredAssessments = isAoagDeployment
        ? filterAoagItems(assessments, { isStandaloneAoag: !!isStandaloneAoag })
        : assessments;

    // Demo overrides on flat array
    if (IS_DEMO_FLOW) {
        filteredAssessments = handleGetMssqlAssessmentForDemo(accountId, instanceDetail, filteredAssessments);
    }

    let lastAssessmentTimestamp: number | undefined;
    try {
        const latestHostTime = Number((hostLevelAssessmentData as ResourceAssessmentData).lastAssessedDate) || 0;
        lastAssessmentTimestamp = moment(Math.max(latestInstanceAssessmentTime, latestHostTime)).unix() * 1000;
    } catch {
        lastAssessmentTimestamp = undefined;
    }

    const assessmentResponse = {
        assessments: filteredAssessments,
        dismissedConfigurations: enrichWithGoldenConfig(dismissedConfigs, DatabaseTypes.MS_SQL_SERVER),
        metadata: {
            lastAssessmentTimestamp,
            fileSystemId,
            databaseInstanceName,
            ec2InstanceId: (resourceMetadata as Metadata)?.node1InstanceId,
            deploymentType: databaseDeploymentType,
            baseDeploymentType,
            replicaRole: isAoagDeployment
                ? (hostLevelAssessmentData as ResourceAssessmentData)?.aoagDetails?.replicaRole
                : undefined,
            databaseHostName: resourceName || '',
            storageEndpoint: undefined
        }
    };

    const { isValid, errors } = validateWithSchema(MssqlAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid MSSQL assessment response', { errors });
        return { assessments: [], dismissedConfigurations: [], metadata: {} };
    }

    return assessmentResponse;
}

// golden-config `id` -> v1 top-level response key
const SINGLE_ASSESSMENT_KEY_BY_ID: Record<string, string> = {
    'compute-rightsizing': 'compute',
    'mtu-alignment': 'mtuAlignment',
    'host-os-patch': 'hostOsPatch',
    'rss-config': 'rssConfig',
    'sql-license': 'license',
    maxdop: 'maxDOP',
    'mssql-patch': 'mssqlPatch',
    'snapshot-policy': 'snapshotPolicy',
    'snapcenter-snapshot': 'snapcenterSnapshot',
    'backup-configuration': 'awsBackup',
    crr: 'crr',
    'clone-management': 'clone'
};

// golden-config `configurationName` -> v1 dismissedConfigurations key
const DISMISS_SINGLE_KEY_BY_NAME: Record<string, string> = {
    'compute-rightsizing': 'compute',
    'sql-license': 'license',
    'host-os-patch': 'hostOsPatch',
    'rss-config': 'rssConfig',
    maxdop: 'maxDOP',
    'mssql-patch': 'mssqlPatch',
    crr: 'crr',
    'clone-management': 'clone',
    'snapshot-policy': 'snapshotPolicy',
    'snapcenter-snapshot': 'snapcenterSnapshot',
    'backup-configuration': 'awsBackup',
    'mtu-alignment': 'mtuAlignment'
};

// golden-config `id` -> v1 mapping config for MSSQL assessments
const MSSQL_V1_MAP_CONFIG: MapAssessmentToV1Config = {
    metadataSelector: metadata => ({ ...metadata }),
    storageConfigMap: MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    singleKeyById: SINGLE_ASSESSMENT_KEY_BY_ID,
    dismissSingleKeyByName: DISMISS_SINGLE_KEY_BY_NAME,
    supportsHighAvailability: true,
    storageExtraSelector: metadata => ({ fileSystems: metadata.fileSystemId ? [metadata.fileSystemId] : [] }),
    validate: response => validateWithSchema(MssqlAssessmentResponseV1, response),
    dbLabel: 'MSSQL'
};

async function fetchMssqlDriftAssessmentV1(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
): Promise<MssqlAssessmentResponseV1Type> {
    const v2Response = await fetchMssqlDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields,
        databaseInstance
    );
    // v1 schemas omit `id`/`categories`; Fastify's response serializer drops them from the payload.
    return mapAssessmentToV1(v2Response, MSSQL_V1_MAP_CONFIG) as unknown as MssqlAssessmentResponseV1Type;
}

async function fetchMssqlDriftAssessmentPerAccountV1(
    accountId: string,
    credentialsId: string,
    region: string,
    fields?: string,
    clientNextToken?: string,
    pageSize?: number
): Promise<DriftAssessmentResponsePerAccountV1Type> {
    const v2Result = await fetchMssqlDriftAssessmentPerAccount(
        accountId,
        credentialsId,
        region,
        fields,
        clientNextToken,
        pageSize
    );

    return {
        ...v2Result,
        assessmentsPerAccount: v2Result.assessmentsPerAccount.map(host => ({
            ...host,
            instancesAssessment: host.instancesAssessment.map(instance => ({
                ...instance,
                assessments: instance.assessments
                    ? (mapAssessmentToV1(
                          instance.assessments,
                          MSSQL_V1_MAP_CONFIG
                      ) as unknown as MssqlAssessmentResponseV1Type)
                    : undefined
            }))
        }))
    };
}

async function fetchMssqlDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    fields?: string,
    resourceDetail?: ResourceDetails
) {
    logger.info('Fetching drift assessment per host', { accountId, credentialsId, region, databaseHostId, fields });

    if (isEmpty(resourceDetail)) {
        const {
            items: [resource]
        } = await getResources({
            accountId,
            resourceId: databaseHostId,
            credentialsId,
            region,
            includeDatabaseInstances: true,
            allRecords: false,
            assessmentData: true
        });
        if (!resource) {
            const message = `No database host by id ${databaseHostId} for ${accountId} is found.`;
            logger.info(message);
            throw createError(HttpErrorCodes.NOT_FOUND, message);
        }
        resourceDetail = resource;
    }

    const {
        resource_name: databaseHostName = '',
        metadata,
        database_instances: instancesManaged = [],
        assessment_data: hostLevelAssessmentData
    } = resourceDetail;

    if (isEmpty(instancesManaged)) {
        const message = `No managed instances found for account ${accountId} and host ${databaseHostId}.`;
        logger.info(message);
        throw createError(HttpErrorCodes.NOT_FOUND, message);
    }
    const { categories: hostApplicableAssessmentCategories } = resolveAssessmentTypes(
        DatabaseTypes.MS_SQL_SERVER,
        fields,
        { deploymentType: '', storageProtocol: '', isAsmManaged: false, isDataGuardDeployed: false },
        new Set()
    );
    let hostLevelData: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    if (!isEmpty(hostApplicableAssessmentCategories)) {
        const [{ database_instance_id: databaseInstanceId }] = instancesManaged;
        hostLevelData = hostLevelDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            metadata as Metadata,
            hostLevelAssessmentData as ResourceAssessmentData,
            hostApplicableAssessmentCategories
        );
    }

    const { isValid, errors: validationErrors } = validateWithSchema(MssqlAssessmentItemsResponseSchema, hostLevelData);
    if (!isValid) {
        logger.error('Host level assessment validation failed for :', { databaseHostId, validationErrors });
        hostLevelData = [];
    }

    const driftAssessments = await Promise.all(
        instancesManaged.map(
            throat(3, async instance => {
                const {
                    database_instance_id: databaseInstanceId,
                    database_instance_name: databaseInstanceName,
                    database_deployment_type: deploymentType
                } = instance as {
                    database_instance_id: string;
                    database_instance_name: string;
                    database_deployment_type?: string;
                };

                try {
                    const instanceFieldsToQuery = [
                        AssessmentCategories.STORAGE,
                        AssessmentCategories.MAXDOP,
                        AssessmentCategories.SNAPSHOT_POLICY,
                        AssessmentCategories.SNAPCENTER_SNAPSHOT,
                        AssessmentCategories.AWS_BACKUP,
                        AssessmentCategories.CRR,
                        AssessmentCategories.CLONE,
                        AssessmentCategories.HIGH_AVAILABILITY
                    ];
                    const driftAssessment = await fetchMssqlDriftAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        instanceFieldsToQuery.join(','),
                        { ...instance, resource: resourceDetail } as DatabaseInstancesIncludingResource
                    );

                    // Apply AOAG exclusion to the shared host-level items if needed.
                    const filteredHostItems =
                        deploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
                            ? filterAoagItems(hostLevelData, {
                                  isStandaloneAoag: false,
                                  excludeCategories: AOAG_EXCLUDED_IDS
                              })
                            : hostLevelData;

                    return {
                        databaseInstanceId,
                        databaseInstanceName,
                        assessments: {
                            ...driftAssessment,
                            assessments: [...driftAssessment.assessments, ...filteredHostItems]
                        }
                    };
                } catch (error: any) {
                    logger.error(`Error while fetching drift assessment for ${databaseInstanceId}: ${error.message}`);
                    return { databaseInstanceId, databaseInstanceName, error: error.message };
                }
            })
        )
    );

    return {
        databaseHostId,
        databaseHostName: databaseHostName || '',
        instancesAssessment: driftAssessments
    };
}

async function fetchMssqlDriftAssessmentPerAccount(
    accountId: string,
    credentialsId: string,
    region: string,
    fields?: string,
    clientNextToken?: string,
    pageSize?: number
) {
    logger.info('Fetching drift assessment per account', {
        accountId,
        credentialsId,
        region,
        fields,
        clientNextToken,
        pageSize
    });

    pageSize = pageSize || 50;

    const { items: resourceDetails = [], nextToken } = await getResources({
        accountId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        pageSize,
        nextToken: clientNextToken,
        includeDatabaseInstances: true
    });
    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId} in region ${region}.`);
        return { count: 0, assessmentsPerAccount: [], nextToken: '' };
    }
    const driftAssessmentPerAccount: Array<DriftAssessmentResponsePerHostType> = [];
    await Promise.all(
        resourceDetails.map(
            throat(3, async resourceDetail => {
                const { resource_id: databaseHostId } = resourceDetail;
                try {
                    const drifAssessmentPerHost: DriftAssessmentResponsePerHostType =
                        await fetchMssqlDriftAssessmentPerHost(
                            accountId,
                            credentialsId,
                            region,
                            databaseHostId,
                            fields,
                            resourceDetail
                        );
                    driftAssessmentPerAccount.push(drifAssessmentPerHost);
                } catch (error) {
                    logger.error(
                        `Error while fetching drift assessment per host ${accountId}, ${databaseHostId}, ${error}`
                    );
                }
            })
        )
    );

    return {
        count: driftAssessmentPerAccount.length,
        assessmentsPerAccount: driftAssessmentPerAccount,
        nextToken
    };
}

async function initiateHostLevelAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    jobId: string,
    fields: string[]
) {
    logger.info('Initiate host level assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName: databaseInstanceRecord.resourceName,
        jobId,
        fields,
        databaseInstanceId: databaseInstanceRecord.id,
        sqlAuthEnabled: databaseInstanceRecord.sqlAuthEnabled
    });

    const { id: databaseInstanceId, resourceName, sqlAuthEnabled, databaseInstanceObject } = databaseInstanceRecord;
    const { resource, database_deployment_type: deploymentType } = databaseInstanceObject as DatabaseInstance;
    const {
        metadata,
        cloud_provider_account_id: awsAccountId,
        resource_id: resourceId,
        assessment_data: hostLevelAssessmentData
    } = resource;

    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { activeNodeInstanceId = '', instanceName } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceId,
        accountId
    });
    if (!metadata || !activeNodeInstanceId) {
        const errorMessage = `Active node instance ID not found for database host ${databaseHostId} and instance ${databaseInstanceId}.`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, credentialsId, region });
    }

    let licenseAssessment;
    let licenseErrorMessage;

    let computeAssessment;
    let computeErrorMessage;
    let hostOsPatchAssessment;
    let hostOsPatchErrorMessage;
    let rssConfigAssessment;
    let rssConfigErrorMessage;
    let mtuAlignmentAssessment;
    let mtuAlignmentErrorMessage;
    let mssqlPatchAssessment;
    let mssqlPatchErrorMessage;
    let highAvailabilityAssessment;

    if (fields?.includes(AssessmentCategories.LICENSE)) {
        ({ licenseAssessment, errorMessage: licenseErrorMessage } =
            (await managedHostsLicenseAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                jobId
            )) || {});
    }
    if (fields?.includes(AssessmentCategories.COMPUTE)) {
        ({ computeAssessment, errorMessage: computeErrorMessage } =
            (await managedHostsComputeAssessment(
                accountId,
                credentialsId,
                region,
                awsAccountId!,
                activeNodeInstanceId,
                resourceName,
                jobId
            )) || {});
        if (computeAssessment) {
            // If all the existing recommendation options match the recommended recommendation options, then the finding should be OPTIMIZED.
            let { finding, findingReasonCodes, recommendationOptions } = computeAssessment || {};
            const existingAssessmentData = hostLevelAssessmentData as ResourceAssessmentData;
            const existingRecommendationOptions = existingAssessmentData?.compute?.recommendationOptions;
            if (
                existingRecommendationOptions &&
                !isEmpty(existingRecommendationOptions) &&
                recommendationOptions &&
                !isEmpty(recommendationOptions)
            ) {
                const existingRecommendationInstanceTypes = existingRecommendationOptions.map(
                    ({ instanceType }) => instanceType
                );
                const newRecommendationInstanceTypes = recommendationOptions.map(({ instanceType }) => instanceType);
                if (
                    existingRecommendationInstanceTypes.every(instanceType =>
                        newRecommendationInstanceTypes.includes(instanceType)
                    )
                ) {
                    finding = AssessmentStatus.OPTIMIZED;
                    findingReasonCodes = [];
                }

                computeAssessment = {
                    ...computeAssessment,
                    finding,
                    findingReasonCodes
                };
            }
        } else {
            logger.warn('No compute assessment data found');
        }
    }
    if (fields?.includes(AssessmentCategories.HOST_OS_PATCH)) {
        ({ hostOsPatchAssessment, errorMessage: hostOsPatchErrorMessage } =
            (await managedHostOsPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                activeNodeInstanceId,
                !!node2InstanceId, // assumption: if both node1 and node2 instance ids are present, then it is a cluster
                resourceName,
                jobId
            )) || {});
    }
    if (fields?.includes(AssessmentCategories.RSS_CONFIG)) {
        ({ rssConfigAssessment, errorMessage: rssConfigErrorMessage } =
            (await managedHostsRssConfigAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                jobId,
                metadata as unknown as Metadata
            )) || {});
    }
    if (fields?.includes(AssessmentCategories.MTU_ALIGNMENT)) {
        ({ mtuAlignmentAssessment, errorMessage: mtuAlignmentErrorMessage } =
            (await assessMTUAlignment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                activeNodeInstanceId,
                databaseInstanceId,
                jobId,
                metadata as unknown as Metadata,
                resourceName
            )) || {});
    }
    if (fields?.includes(AssessmentCategories.MSSQL_PATCH)) {
        const isCluster = Boolean(node2InstanceId && node2InstanceId.trim() !== '');
        const sqlInstanceName = extractSqlInstanceName(instanceName);
        ({ patchAssessment: mssqlPatchAssessment, errorMessage: mssqlPatchErrorMessage } =
            (await managedHostMSSQLPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                activeNodeInstanceId,
                isCluster, // assumption: if both node1 and node2 instance ids are present, then it is a cluster
                resourceName,
                sqlAuthEnabled,
                sqlInstanceName,
                jobId
            )) || {});
    }
    let aoagDetails;
    if (fields?.includes(AssessmentCategories.HIGH_AVAILABILITY)) {
        const haResult = await initiateHostLevelHighAvailabilityAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceRecord,
            jobId,
            metadata as Metadata,
            deploymentType
        );
        if (haResult) {
            const { clusterQuorum, heartbeat } = haResult;
            highAvailabilityAssessment = { clusterQuorum, heartbeat };
            if ('aoagDetails' in haResult) {
                aoagDetails = haResult.aoagDetails;
            }
        }
    }
    const hasAssessmentOrError = [
        licenseAssessment,
        licenseErrorMessage,
        computeAssessment,
        computeErrorMessage,
        hostOsPatchAssessment,
        hostOsPatchErrorMessage,
        rssConfigAssessment,
        rssConfigErrorMessage,
        mssqlPatchAssessment,
        mssqlPatchErrorMessage,
        highAvailabilityAssessment,
        mtuAlignmentAssessment,
        mtuAlignmentErrorMessage
    ].some(item => !isEmpty(item));

    if (hasAssessmentOrError) {
        const existingAssessmentData = hostLevelAssessmentData as ResourceAssessmentData;

        const updatedAssessmentData = {
            license: licenseAssessment || (!licenseErrorMessage ? existingAssessmentData?.license : undefined),
            compute: computeAssessment || (!computeErrorMessage ? existingAssessmentData?.compute : undefined),
            hostOsPatch:
                hostOsPatchAssessment || (!hostOsPatchErrorMessage ? existingAssessmentData?.hostOsPatch : undefined),
            rssConfig: rssConfigAssessment || (!rssConfigErrorMessage ? existingAssessmentData?.rssConfig : undefined),
            mtuAlignment:
                mtuAlignmentAssessment ||
                (!mtuAlignmentErrorMessage ? existingAssessmentData?.mtuAlignment : undefined),
            mssqlPatch:
                mssqlPatchAssessment || (!mssqlPatchErrorMessage ? existingAssessmentData?.mssqlPatch : undefined),
            highAvailability: highAvailabilityAssessment ?? existingAssessmentData?.highAvailability,
            aoagDetails: aoagDetails ?? existingAssessmentData?.aoagDetails,
            errors: {
                license:
                    licenseErrorMessage || (!licenseAssessment ? existingAssessmentData?.errors?.license : undefined),
                compute:
                    computeErrorMessage || (!computeAssessment ? existingAssessmentData?.errors?.compute : undefined),
                hostOsPatch:
                    hostOsPatchErrorMessage ||
                    (!hostOsPatchAssessment ? existingAssessmentData?.errors?.hostOsPatch : undefined),
                rssConfig:
                    rssConfigErrorMessage ||
                    (!rssConfigAssessment ? existingAssessmentData?.errors?.rssConfig : undefined),
                mtuAlignment:
                    mtuAlignmentErrorMessage ||
                    (!mtuAlignmentAssessment ? existingAssessmentData?.errors?.mtuAlignment : undefined),
                mssqlPatch:
                    mssqlPatchErrorMessage ||
                    (!mssqlPatchAssessment ? existingAssessmentData?.errors?.mssqlPatch : undefined)
            },
            lastAssessedDate: new Date().getTime().toString()
        };

        await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, updatedAssessmentData);

        const assessmentResults = await fetchMssqlDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            'license,compute,host-os-patch,rss-config,mssql-patch,high-availability,mtu-alignment',
            { ...(databaseInstanceObject as DatabaseInstance), resource }
        );
        if (!IS_DEMO_FLOW) {
            await updateDatabaseHostAssessmentResults(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                assessmentResults
            );
        }
    }
}

async function initiateInstanceLevelAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    jobId: string,
    fields: string[]
) {
    const {
        id: databaseInstanceId,
        activeNodeInstanceid,
        fsxFileSystem,
        resourceName,
        name: databaseInstanceName,
        sqlAuthEnabled
    } = databaseInstanceRecord;

    logger.info('Initiate instance level assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        fields,
        databaseInstanceId
    });

    const { StorageVirtualMachines: svms = [] } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        [fsxFileSystem],
        { useCache: true }
    );

    databaseInstanceRecord.svmOntapUuid = svms.find(svm =>
        IS_DEMO_FLOW ? svm : svm?.StorageVirtualMachineId === databaseInstanceRecord.svmId
    )?.UUID;

    let instanceVolumeMapping: MappedOnTapVolumeResponse[] = [];
    try {
        instanceVolumeMapping = (await getMappedOntapVolumes(
            credentialsId,
            region,
            fsxFileSystem,
            false,
            activeNodeInstanceid,
            [databaseInstanceName],
            sqlAuthEnabled,
            true,
            accountId,
            ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
            databaseInstanceRecord.svmOntapUuid
        )) as MappedOnTapVolumeResponse[];

        const volumeRecords = Object.values(instanceVolumeMapping).flatMap(i => i?.volumeRecords || []);
        const lunRecords = Object.values(instanceVolumeMapping).flatMap(i => i?.lunRecords || []);
        databaseInstanceRecord.mappedVolumesUuids = volumeRecords.map(volume => volume.uuid as string);
        databaseInstanceRecord.mappedVolumeNames = volumeRecords.map(volume => volume.name as string);

        const lunNames =
            lunRecords?.flatMap(lun => lun.name) ||
            Object.values(instanceVolumeMapping)?.flatMap(i => i.lunNames) ||
            [];
        databaseInstanceRecord.mappedLunNames = compact(lunNames);

        const lunUuids = !isEmpty(lunRecords) ? lunRecords?.map(lun => lun.uuid) : [];
        databaseInstanceRecord.mappedLunUuids = compact(lunUuids);

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(),
                last_updated: new Date(),
                config_data_type: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
                config_data: instanceVolumeMapping
            }
        ]);
    } catch (error) {
        logger.error('Error while persisting mapped ontap volumes data', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: databaseInstanceRecord.id,
            error
        });
    }

    const instanceDetailsForJob = JSON.stringify({
        hostName: resourceName,
        resourceId: databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    });

    const resourceWithInstanceName = IS_DEMO_FLOW
        ? `${databaseInstanceRecord.resourceName}\\${databaseInstanceRecord.name.replace(
              databaseInstanceRecord.resourceName,
              ''
          )}`
        : `${databaseInstanceRecord.resourceName}\\${databaseInstanceRecord.name}`;
    const jobName = `Microsoft SQL Server assessment for instance ${resourceWithInstanceName}`;
    const jobDescription = `${jobName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;

    const { id: instanceLevelAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });

    const assessmentHandlers = {
        [AssessmentCategories.STORAGE]: async () =>
            initiateStorageAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord,
                fields.includes(AssessmentCategories.SNAPSHOT_POLICY)
                    ? STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
                    : STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.STORAGE
            ),
        [AssessmentCategories.SNAPSHOT_POLICY]: async () => {
            if (!fields.includes(AssessmentCategories.STORAGE)) {
                await initiateStorageAssessmentCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    instanceLevelAssessmentJobId,
                    databaseInstanceRecord,
                    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY
                );
            }
        },
        [AssessmentCategories.CRR]: async () =>
            initiateCrossRegionResiliencyAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord,
                instanceVolumeMapping
            ),
        [AssessmentCategories.AWS_BACKUP]: async () =>
            initiateAWSBackupAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord,
                instanceVolumeMapping
            ),
        [AssessmentCategories.CLONE]: async () =>
            managedHostsCloneAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceid,
                resourceName,
                databaseHostId,
                databaseInstanceId,
                instanceLevelAssessmentJobId
            ),
        [AssessmentCategories.MAXDOP]: async () =>
            managedHostsMaxDOPAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceid,
                resourceName,
                databaseHostId,
                databaseInstanceId,
                instanceLevelAssessmentJobId
            ),
        [AssessmentCategories.HIGH_AVAILABILITY]: async () =>
            initiateInstanceLevelHighAvailabilityAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceRecord,
                instanceLevelAssessmentJobId
            ),
        [AssessmentCategories.SNAPCENTER_SNAPSHOT]: async () =>
            initiateSnapCenterAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            )
    };

    await Promise.allSettled(
        fields.map(async field => {
            const handler = assessmentHandlers[field as keyof typeof assessmentHandlers];
            if (handler) {
                await handler();
            }
        })
    );

    await updateParentJobStatus(accountId, instanceLevelAssessmentJobId);
}

async function triggerMssqlAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields: string[],
    isOnDemandAssessment = false,
    initiatedBy = AssessmentTriggeredBy.SYSTEM
) {
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId
    } = managedInstance;

    logger.info('Triggering drift assessment for MSSQL managed instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        parentJobId,
        fields
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const { resource } = managedInstance;
    try {
        const instanceDetails = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            resource,
            managedInstance
        );

        const { activeNodeInstanceId, newDatabaseInstanceDetails, cloudProviderAccountId } = instanceDetails;

        const { configurations: instanceConfigurations, resource: resourceDetail } =
            newDatabaseInstanceDetails as DatabaseInstance;
        const { configurations: hostConfigurations, resource_name: resourceName } = resourceDetail as ResourceDetails;
        // older dismissConfig was an Object so checking array
        const instanceDismissedConfigs = Array.isArray(instanceConfigurations)
            ? (instanceConfigurations as DismissConfig[])
            : [];
        const hostDismissedConfigs = Array.isArray(hostConfigurations) ? (hostConfigurations as DismissConfig[]) : [];

        const dismissedIds = new Set(
            filterExpiredDismissConfigs(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceDismissedConfigs,
                hostDismissedConfigs,
                databaseInstanceId
            ).map(c => c.id)
        );

        const {
            database_instance_name: savedInstanceName,
            fsxn_ids: fileSystemId,
            fsx_svm_id: fsxSvmId,
            sqlAuthEnabled,
            database_deployment_type: deploymentType
        } = newDatabaseInstanceDetails;

        fields = resolveAssessmentTypes(
            DatabaseTypes.MS_SQL_SERVER,
            fields,
            { deploymentType },
            dismissedIds
        ).categories;

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: savedInstanceName!,
            type: RESOURCESTYPE.MSSQL,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            activeNodeInstanceid: activeNodeInstanceId!,
            fsxFileSystem: fileSystemId!,
            cloudProviderAccountId: cloudProviderAccountId || '',
            resourceName: resourceName || '',
            svmId: (fsxSvmId as Record<string, string>)[fileSystemId!] || '',
            databaseInstanceObject: newDatabaseInstanceDetails
        };

        const shouldRunInstanceLevelAssessment = fields.some(field =>
            [
                AssessmentCategories.STORAGE,
                AssessmentCategories.SNAPSHOT_POLICY,
                AssessmentCategories.CRR,
                AssessmentCategories.AWS_BACKUP,
                AssessmentCategories.CLONE,
                AssessmentCategories.MAXDOP,
                AssessmentCategories.HIGH_AVAILABILITY,
                AssessmentCategories.SNAPCENTER_SNAPSHOT
            ].includes(field.toLowerCase() as AssessmentCategories)
        );

        const shouldRunHostLevelAssessment = fields.some(field =>
            [
                AssessmentCategories.COMPUTE,
                AssessmentCategories.LICENSE,
                AssessmentCategories.HOST_OS_PATCH,
                AssessmentCategories.RSS_CONFIG,
                AssessmentCategories.MSSQL_PATCH,
                AssessmentCategories.HIGH_AVAILABILITY,
                AssessmentCategories.MTU_ALIGNMENT
            ].includes(field.toLowerCase() as AssessmentCategories)
        );

        await Promise.all([
            shouldRunInstanceLevelAssessment
                ? initiateInstanceLevelAssessmentDataCollection(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      instanceRecord,
                      parentJobId,
                      fields
                  )
                : Promise.resolve(),
            shouldRunHostLevelAssessment
                ? initiateHostLevelAssessmentDataCollection(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      instanceRecord,
                      parentJobId,
                      fields
                  )
                : Promise.resolve()
        ]);
    } catch (error: any) {
        logger.error(error);
        errorMessage = error.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
        if (!isOnDemandAssessment) {
            // If this is not an on-demand assessment, we throw the error to be handled by the caller
            throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
    } finally {
        if (isOnDemandAssessment) {
            await updateParentJobStatus(accountId, parentJobId);
            if (initiatedBy === AssessmentTriggeredBy.USER) {
                updateLongRunningAuditGroup(
                    jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED
                );
            }
        }
        if (!IS_DEMO_FLOW) {
            await updateAssessmentResultsInInstanceMetadata(managedInstance);
        }
    }
}

async function onDemandTriggerMssqlDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    initiatedBy: string,
    fields?: string,
    parentJobId?: string
) {
    logger.info('On-demand trigger drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseHostId,
        initiatedBy,
        fields,
        parentJobId
    });
    try {
        const managedInstance = (await getInstanceInfo(
            accountId,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            region
        )) as DatabaseInstancesIncludingResource;

        const {
            resource: { resource_name: resourceName },
            database_instance_name: instanceName
        } = managedInstance;
        const savedInstanceName = IS_DEMO_FLOW
            ? `${resourceName}\\${instanceName.replace(resourceName!, '')}`
            : `${resourceName}\\${instanceName}`;
        const jobName = `Microsoft SQL Server assessment for instance ${savedInstanceName}`;
        const jobDescription = `${jobName}`;
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: jobName,
            description: jobDescription,
            resourceName: savedInstanceName!,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        await updateLongRunningAuditGroup(undefined, undefined, savedInstanceName);
        const fieldsValues = fields
            ? fields.toLowerCase().replace(/\s+/g, '').split(',')
            : Object.values(AssessmentCategories).map(category => category.toLowerCase());
        // Call the async function without awaiting it
        triggerMssqlAssessment(managedInstance, jobId, fieldsValues, true, AssessmentTriggeredBy.USER);

        return { jobId };
    } catch (error: any) {
        const errorMessage = `Error while triggering drift assessment for account ${accountId}, host ${databaseHostId}, instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMessage);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function triggerMssqlAssessmentAfterOptimization(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    serverNameWithHostName: string,
    parentJobId: string,
    instanceToAssess: { id: string },
    fields?: string
) {
    logger.info('Triggering assessment after optimization', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        instanceId: instanceToAssess?.id,
        fields
    });

    await onDemandTriggerMssqlDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        instanceToAssess.id,
        AssessmentTriggeredBy.SYSTEM,
        fields || '',
        parentJobId
    );

    let masterJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    if (!IS_DEMO_FLOW) {
        let retries = 10;
        while (retries > 0) {
            retries -= 1;
            // eslint-disable-next-line no-await-in-loop
            const allSubJobs = await listJobs(accountId, '', '', parentJobId);
            masterJobStatus = allSubJobs.some(job => job.status === JOBSTATUS.IN_PROGRESS)
                ? JOBSTATUS.IN_PROGRESS
                : allSubJobs.every(job => job.status === JOBSTATUS.FAILED)
                ? JOBSTATUS.FAILED
                : allSubJobs.every(job => job.status === JOBSTATUS.COMPLETED)
                ? JOBSTATUS.COMPLETED
                : allSubJobs.some(job => job.status === JOBSTATUS.FAILED || job.status === JOBSTATUS.WARNING)
                ? JOBSTATUS.WARNING
                : JOBSTATUS.IN_PROGRESS;
            if (masterJobStatus !== JOBSTATUS.IN_PROGRESS || retries === 0) {
                errorMessage = allSubJobs.find(job => job.status === JOBSTATUS.FAILED)?.error || '';
                break;
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep(30000);
        }
    }

    await updateJobDetails(accountId, parentJobId, {
        status: masterJobStatus,
        endTime: Date.now(),
        error: errorMessage
    });

    updateLongRunningAuditGroup(AuditStatus.SUCCESS);
}

async function updateAssessmentResultsInInstanceMetadata(managedInstance: DatabaseInstancesIncludingResource) {
    const {
        account_id: accountId,
        region,
        credentials_id: credentialsId,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId
    } = managedInstance;
    logger.info('Update assessment results in instance metadata', {
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });
    const driftAssessmentData = await fetchMssqlDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        undefined,
        managedInstance as unknown as DatabaseInstance
    );

    try {
        await updateDatabaseInstanceAssessmentResults(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            driftAssessmentData,
            managedInstance.metadata
        );
    } catch (error) {
        logger.error('Error while updating assessment results in instance table', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error
        });
    }
}

async function fetchMssqlPatchScan(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    field: MssqlPatchScanFieldType
) {
    logger.info('Running MSSQL patch scan', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        field
    });

    const instanceDetail = (await getInstanceInfo(
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    )) as DatabaseInstance;
    const {
        database_instance_name: dbInstanceName,
        sqlAuthEnabled = false,
        resource: { metadata: resourceMetadata, assessment_data: hostLevelAssessmentData }
    } = instanceDetail;

    const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;
    const isPartOfCluster = !!node2InstanceId;

    switch (field) {
        case AssessmentCategories.HOST_OS_PATCH:
            return fetchMssqlHostOsPatchWithMissingPatches(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                node1InstanceId,
                isPartOfCluster
            );
        case AssessmentCategories.MSSQL_PATCH:
            return fetchMssqlPatchWithMissingPatches(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                dbInstanceName,
                sqlAuthEnabled,
                node1InstanceId,
                node2InstanceId,
                hostLevelAssessmentData as ResourceAssessmentData | undefined
            );
        default: {
            const errorMessage = `Unsupported patch-scan field: ${field as string}`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, field });
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }
}

export {
    triggerMssqlAssessment,
    onDemandTriggerMssqlDriftAssessment,
    fetchMssqlDriftAssessment,
    fetchMssqlDriftAssessmentV1,
    fetchMssqlDriftAssessmentPerHost,
    fetchMssqlDriftAssessmentPerAccount,
    fetchMssqlDriftAssessmentPerAccountV1,
    fetchMssqlPatchScan,
    updateAssessmentResultsInInstanceMetadata,
    triggerMssqlAssessmentAfterOptimization,
    MSSQL_V1_MAP_CONFIG
};
