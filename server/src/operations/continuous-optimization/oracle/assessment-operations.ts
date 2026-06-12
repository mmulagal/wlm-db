import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import throat from 'throat';
import { isEmpty } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import getLogger from '../../../utils/logger';
import {
    getInstanceInfo,
    getResources,
    updateDatabaseInstanceAssessmentResults,
    updateDatabaseHostAssessmentData
} from '../../database/database-operations';
import {
    AWSBackupAssessment,
    CloneAssessment,
    CrrAssessment,
    DatabaseInstance,
    DatabaseInstanceConfigurations,
    DatabaseInstancesIncludingResource,
    Metadata,
    ResourceAssessmentData,
    ResourceDetails,
    WorkloadInstance
} from '../../../utils/common-types';
import { AuditStatus, HttpErrorCodes, RESOURCESTYPE, DatabaseTypes, STORAGE_PROTOCOLS } from '../../../utils/consts';
import { IS_DEMO_FLOW, sleep, validateWithSchema } from '../../../utils/utils';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy,
    ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP
} from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { getOracleDatabaseMappedVolumes } from '../../workloads/oracle/oracle-operations';
import { getSSMConnectionStatus } from '../../aws/ssm-operations';
import { initiateCrossRegionResiliencyAssessment, getCrrDriftData } from './resilience-assessment-operation';
import {
    OracleMappedOntapVolumeRecord,
    OracleMappedOntapVolumesResponse,
    OracleSysFileTypes,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';
import { listDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { calculateStorageDrift, initiateStorageAssessmentCollection } from './storage-assessment-operations';
import {
    calculateComputeHostOsDrift,
    initiateComputeHostLevelAssessmentCollection,
    initiateComputeInstanceLevelAssessmentCollection
} from './compute-assessment-operations';
import {
    calculateHostOsPatchDrift,
    fetchOracleHostOsPatchWithMissingPatches,
    managedHostOsPatchAssessment
} from './hostOsPatch-assessment-operations';
import {
    initiateOracleAWSBackupAssessment,
    getOracleAwsBackupDriftData
} from './resilience-awsBackup-assessment-operations';
import {
    calculateOracleSecurityPatchDrift,
    fetchOracleSecurityPatchWithMissingPatches,
    initiateOracleSecurityPatchAssessmentCollection
} from './security-patch-assessment-operations';
import {
    calculateSnapCenterDrift,
    initiateSnapCenterAssessmentCollection,
    SnapcenterAssessmentData
} from './snapcenter-assessment-operations';
import { calculateOracleCloneDrift, initiateOracleCloneAssessmentCollection } from './clone-assessment-operations';

import {
    DriftAssessmentResponsePerAccountType,
    DriftAssessmentResponsePerAccountV1Type,
    DriftAssessmentResponsePerHostType,
    OraclePatchScanFieldType,
    OracleSecurityPatchDriftResponseType,
    OracleAssessmentResponse,
    OracleAssessmentResponseType,
    OracleDriftAssessmentResponse,
    OracleDriftAssessmentResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import {
    type AssessmentItemType,
    type AssessmentErrorItemType
} from '../../../routes/types/continuous-optimization.types';
import { ORACLE_MAPPED_ONTAP_VOLUMES_DATA } from '../../../utils/demo-utils/demoMockdata';
import {
    buildDismissedConfigurations,
    getLatestInstanceAssessmentTime,
    isPdbGroupedVolumes,
    mapAssessmentToV1,
    type MapAssessmentToV1Config
} from '../assessment-utils';
import {
    updateFieldsBasedOnDismissedConfigurations,
    processDismissedConfigurations,
    mergeDismissConfigurations
} from '../assessment-dismiss-operations';
import { buildDemoComputeHostOsAssessmentInputs, handleGetOracleAssessmentForDemo } from '../../demo-operations';
import { StorageAssessment } from './common-types';
import { listJobs } from '../../../lib/database/job';

const logger = getLogger();

function getOntapVolumeIdsByFileType(
    instanceVolumeMapping: OracleMappedOntapVolumeRecord | undefined,
    fileTypes: OracleSysFileTypes[]
): Record<string, string[]> {
    const { ontapVolumes = {}, isCDB = false } = instanceVolumeMapping || {};
    const hasPdbGroupedVolumes = isPdbGroupedVolumes(isCDB, ontapVolumes);
    return Object.fromEntries(
        fileTypes.map(fileType => [
            fileType,
            [
                ...new Set(
                    hasPdbGroupedVolumes
                        ? Object.values(ontapVolumes).flatMap(pdb =>
                              ((pdb as Record<string, OracleVolumeRecord[]>)[fileType] || []).map(vol => vol.volumeId)
                          )
                        : ((ontapVolumes as Record<string, OracleVolumeRecord[]>)[fileType] || []).map(
                              vol => vol.volumeId
                          )
                )
            ]
        ])
    );
}

function hostLevelDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    _metadata: Metadata,
    hostLevelAssessmentData: ResourceAssessmentData,
    fieldsValues: string[]
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching host level drift data for Oracle', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fieldsValues
    });

    const assessmentFlags = {
        hostOsPatch: fieldsValues?.includes(AssessmentCategoriesOracle.HOST_OS_PATCH.toLowerCase())
    };

    return assessmentFlags.hostOsPatch
        ? [calculateHostOsPatchDrift(accountId, credentialsId, region, databaseHostId, hostLevelAssessmentData)]
        : [];
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
    logger.info('Initiate host level assessment data collection for Oracle', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName: databaseInstanceRecord.resourceName,
        jobId,
        fields,
        databaseInstanceId: databaseInstanceRecord.id
    });

    const { resourceName, databaseInstanceObject } = databaseInstanceRecord;
    const { resource } = databaseInstanceObject as DatabaseInstance;
    const { metadata, assessment_data: hostLevelAssessmentData } = resource;

    const { node1InstanceId: activeNodeInstanceId } = metadata as Metadata;

    if (!metadata || !activeNodeInstanceId) {
        const errorMessage = `Active node instance ID not found for Oracle database host ${databaseHostId}.`;
        logger.error(errorMessage, { accountId, databaseHostId, credentialsId, region });
        return;
    }

    let hostOsPatchAssessment;
    let hostOsPatchErrorMessage;
    let hostComputeData;

    const hostLevelTasks: Promise<void>[] = [];

    if (fields?.includes(AssessmentCategoriesOracle.HOST_OS_PATCH)) {
        hostLevelTasks.push(
            (async () => {
                ({ hostOsPatchAssessment, errorMessage: hostOsPatchErrorMessage } =
                    (await managedHostOsPatchAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        activeNodeInstanceId,
                        resourceName,
                        jobId
                    )) || {});
            })()
        );
    }

    if (fields?.includes(AssessmentCategoriesOracle.COMPUTE)) {
        hostLevelTasks.push(
            (async () => {
                ({ hostOsData: hostComputeData } = await initiateComputeHostLevelAssessmentCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    jobId,
                    activeNodeInstanceId,
                    resourceName
                ));
            })()
        );
    }

    await Promise.all(hostLevelTasks);

    const existingAssessmentData = hostLevelAssessmentData as ResourceAssessmentData;

    const thpData = hostComputeData?.['transparent-hugepages'] as Record<string, unknown> | undefined;
    const tcpData = hostComputeData?.['tcp-advanced-options'] as Record<string, unknown> | undefined;
    const hasComputeHostOsUpdate = Boolean(thpData || tcpData);
    const mergedComputeHostOs = hasComputeHostOsUpdate
        ? {
              ...(existingAssessmentData?.computeHostOs ?? {}),
              ...(thpData && { transparentHugepages: thpData }),
              ...(tcpData && { tcpAdvancedOptions: tcpData })
          }
        : existingAssessmentData?.computeHostOs;

    const updatedAssessmentData = {
        ...existingAssessmentData,
        hostOsPatch:
            hostOsPatchAssessment || (!hostOsPatchErrorMessage ? existingAssessmentData?.hostOsPatch : undefined),
        computeHostOs: mergedComputeHostOs,
        errors: {
            ...existingAssessmentData?.errors,
            hostOsPatch:
                hostOsPatchErrorMessage ||
                (!hostOsPatchAssessment ? existingAssessmentData?.errors?.hostOsPatch : undefined)
        },
        lastAssessedDate: new Date().getTime().toString()
    };

    await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, updatedAssessmentData);
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
        name: databaseInstanceName,
        resourceName,
        fsxFileSystem,
        databaseInstanceObject: { resource: resourceDetail } = {}
    } = databaseInstanceRecord;

    logger.info('Initiate instance level oracle assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        fields,
        databaseInstanceId,
        fsxFileSystem
    });
    // Note- Need to check if structure of getmappedvolumes can be simplified
    let instanceVolumeMapping: OracleMappedOntapVolumeRecord;
    try {
        const response = (await getOracleDatabaseMappedVolumes(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            resourceDetail
        )) as Map<string, Map<string, OracleMappedOntapVolumesResponse>>;

        const allInstanceVolumeMappings =
            (response.get(databaseInstanceName)?.get(fsxFileSystem)?.volumeMappings as Record<
                string,
                OracleMappedOntapVolumeRecord
            >[]) || [];

        const protocol = response.get(databaseInstanceName)?.get(fsxFileSystem)?.protocol;
        const isASMManaged = response.get(databaseInstanceName)?.get(fsxFileSystem)?.isASMManaged;

        if (IS_DEMO_FLOW) {
            const mappedOntapVolumes = ORACLE_MAPPED_ONTAP_VOLUMES_DATA(
                fsxFileSystem,
                protocol!,
                databaseInstanceId,
                true
            ) as unknown as Map<string, OracleMappedOntapVolumesResponse>;
            instanceVolumeMapping =
                Object.values(mappedOntapVolumes)
                    .flatMap(volumeResponse => volumeResponse.volumeMappings || [])
                    .flatMap(volumeMapping => Object.values(volumeMapping))
                    .find(mapping => Object.keys(mapping as object).length > 0) || {};
        } else {
            instanceVolumeMapping =
                allInstanceVolumeMappings.find(mapping => mapping[databaseInstanceName])?.[databaseInstanceName] || {};
        }
        const { ontapVolumes = {}, isCDB = false, error: mappedVolumeError } = instanceVolumeMapping || {};
        const extractVolumeData = (
            volumes: Record<string, OracleVolumeRecord[]> | Record<string, Record<string, OracleVolumeRecord[]>>,
            storageProtocol: string
        ) =>
            Object.values(volumes).flatMap(pdb =>
                Object.values(pdb).flatMap(volumeGroup =>
                    Array.isArray(volumeGroup)
                        ? volumeGroup.map(vol => ({
                              id: vol.volumeId,
                              name: vol.volumeName,
                              diskGroup: vol?.diskGroup ?? null,
                              svmId: vol.svmId,
                              svmName: vol.svmName,
                              junctionPath: vol.junctionPath,
                              lunPath: vol.lunPath,
                              ...(storageProtocol === 'iSCSI' && {
                                  lunId: vol.lunId,
                                  lunName: vol.lunName
                              })
                          }))
                        : []
                )
            );

        const hasPdbGroupedVolumes = isPdbGroupedVolumes(isCDB, ontapVolumes);

        const volumeData = hasPdbGroupedVolumes
            ? extractVolumeData(ontapVolumes, protocol!)
            : Object.values(ontapVolumes).flatMap(volumes =>
                  volumes.map((vol: any) => ({
                      id: vol.volumeId,
                      name: vol.volumeName,
                      diskGroup: vol?.diskGroup ?? null,
                      svmId: vol.svmId,
                      svmName: vol.svmName,
                      junctionPath: vol.junctionPath,
                      lunPath: vol.lunPath,
                      ...(protocol === 'iSCSI' && {
                          lunId: vol.lunId,
                          lunName: vol.lunName
                      })
                  }))
              );

        const redoVolumeNames: string[] = hasPdbGroupedVolumes
            ? Object.values(ontapVolumes).flatMap(pdb =>
                  ((pdb as Record<string, OracleVolumeRecord[]>)[OracleSysFileTypes.REDO_LOGS] || []).map(
                      vol => vol.volumeName
                  )
              )
            : ((ontapVolumes as Record<string, OracleVolumeRecord[]>)[OracleSysFileTypes.REDO_LOGS] || []).map(
                  vol => vol.volumeName
              );

        const nonRedoVolumeNames = new Set<string>(
            hasPdbGroupedVolumes
                ? Object.values(ontapVolumes).flatMap(pdb =>
                      Object.entries(pdb as Record<string, OracleVolumeRecord[]>)
                          .filter(([fileType]) => fileType !== OracleSysFileTypes.REDO_LOGS)
                          .flatMap(([, volumes]) => volumes.map(vol => vol.volumeName))
                  )
                : Object.entries(ontapVolumes as Record<string, OracleVolumeRecord[]>)
                      .filter(([fileType]) => fileType !== OracleSysFileTypes.REDO_LOGS)
                      .flatMap(([, volumes]) => volumes.map(vol => vol.volumeName))
        );
        const redoOnlyVolumeNames = redoVolumeNames.filter(name => !nonRedoVolumeNames.has(name));

        databaseInstanceRecord.svmOntapUuid = [...new Set(volumeData.map(vol => vol.svmId))].filter(Boolean);
        databaseInstanceRecord.svmOntapName = [...new Set(volumeData.map(vol => vol.svmName))].filter(Boolean);
        const uniqueVolumesById = new Map<string, { name: string; junctionPath?: string; lunPath?: string }>();
        volumeData.forEach(({ id, name, junctionPath, lunPath }) => {
            if (!isEmpty(id) && !isEmpty(name) && !uniqueVolumesById.has(id)) {
                uniqueVolumesById.set(id, { name, junctionPath, lunPath });
            }
        });
        databaseInstanceRecord.mappedVolumesUuids = [...uniqueVolumesById.keys()];
        databaseInstanceRecord.mappedVolumeNames = [...uniqueVolumesById.values()].map(v => v.name);
        databaseInstanceRecord.mappedVolumeJunctionPaths = [...uniqueVolumesById.values()].map(
            v => v.junctionPath ?? ''
        );
        databaseInstanceRecord.mappedVolumeLunPaths = [...uniqueVolumesById.values()].map(v => v.lunPath ?? '');
        databaseInstanceRecord.mappedVolumeError = mappedVolumeError;
        databaseInstanceRecord.mappedDiskGroups = [...new Set(volumeData.map(vol => vol.diskGroup).filter(dg => !!dg))];
        databaseInstanceRecord.storageProtocol = protocol;
        databaseInstanceRecord.redoVolumeNames = [...new Set(redoOnlyVolumeNames)];

        if (mappedVolumeError) {
            logger.error('Oracle mapped volume discovery returned an instance-level error', {
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                mappedVolumeError
            });
        }

        if (protocol === 'iSCSI') {
            databaseInstanceRecord.mappedLunUuids = [...new Set(volumeData.map(volume => volume.lunId))];
            databaseInstanceRecord.mappedLunNames = [...new Set(volumeData.map(volume => volume.lunName))];
            databaseInstanceRecord.mappedDiskGroups = [
                ...new Set(volumeData.map(volume => volume.diskGroup).filter(dg => !!dg))
            ];
        }
        databaseInstanceRecord.isASMManaged = isASMManaged;
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error while fetching mapped ontap volumes data', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            errorMessage
        });
    }

    const instanceDetailsForJob = JSON.stringify({
        hostName: resourceName,
        resourceId: databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        sqlServerDeploymentType: RESOURCESTYPE.ORACLE
    });

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = `Oracle assessment for database ${resourceWithInstanceName}`;
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
        [AssessmentCategoriesOracle.STORAGE]: async () =>
            initiateStorageAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            ),
        [AssessmentCategoriesOracle.COMPUTE]: async () =>
            initiateComputeInstanceLevelAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            ),
        [AssessmentCategoriesOracle.AWS_BACKUP]: async () =>
            initiateOracleAWSBackupAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            ),
        [AssessmentCategoriesOracle.CRR]: async () =>
            initiateCrossRegionResiliencyAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            ),
        [AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT]: async () =>
            initiateSnapCenterAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            ),
        [AssessmentCategoriesOracle.CLONE]: async () =>
            initiateOracleCloneAssessmentCollection(
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

async function triggerOracleAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields: string[],
    isOnDemandAssessment = false,
    initiatedBy = AssessmentTriggeredBy.SYSTEM,
    options: { skipHostLevel?: boolean; skipInstanceLevel?: boolean } = {}
) {
    const { skipHostLevel = false, skipInstanceLevel = false } = options;
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId,
        database_instance_name: databaseInstanceName,
        fsx_svm_id: fsxSvmId,
        fsxn_ids: fsxFileSystem,
        storage_protocol: storageProtocol,
        resource = {}
    } = managedInstance;

    logger.info('Triggering drift assessment for oracle managed instance', {
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
    let shouldUpdateAssessmentResults = true;

    try {
        const {
            resource_name: resourceName,
            cloud_provider_account_id: cloudProviderAccountId,
            metadata,
            configurations: hostConfigurations
        } = resource as ResourceDetails;

        const { node1InstanceId: activeNodeInstanceId } = metadata as Metadata;
        if (activeNodeInstanceId) {
            const connectionStatus = await getSSMConnectionStatus(
                credentialsId,
                region,
                activeNodeInstanceId,
                accountId
            );
            if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
                shouldUpdateAssessmentResults = false;
                logger.info('Skipping Oracle scheduled assessment because host is offline', {
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    activeNodeInstanceId,
                    ssmStatus: connectionStatus.Status
                });
                throw createError(HttpErrorCodes.VALIDATION_ERROR, 'Oracle host is offline');
            }
        }

        const { configurations: instanceConfigurations } = managedInstance;

        const instanceDismissedConfigs = (instanceConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;
        const hostDismissedConfigs = (hostConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;

        // Process dismissed configurations using common method
        const finalDismissedConfigurations = await processDismissedConfigurations(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceDismissedConfigs,
            hostDismissedConfigs,
            databaseInstanceId
        );

        if (!isEmpty(finalDismissedConfigurations)) {
            fields = updateFieldsBasedOnDismissedConfigurations(
                fields,
                finalDismissedConfigurations,
                DatabaseTypes.ORACLE,
                storageProtocol ?? STORAGE_PROTOCOLS.ISCSI
            );
        }

        const effectiveProtocol = storageProtocol ?? STORAGE_PROTOCOLS.ISCSI;
        if (effectiveProtocol !== STORAGE_PROTOCOLS.ISCSI) {
            fields = fields.filter(field => field.toLowerCase() !== AssessmentCategoriesOracle.COMPUTE.toLowerCase());
        }

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: databaseInstanceName,
            type: RESOURCESTYPE.ORACLE,
            region,
            sqlAuthEnabled: false,
            activeNodeInstanceid: activeNodeInstanceId!,
            fsxFileSystem: fsxFileSystem!,
            cloudProviderAccountId: cloudProviderAccountId || '',
            resourceName: resourceName || '',
            svmId: (fsxSvmId as Record<string, string>)[fsxFileSystem!] || '',
            databaseInstanceObject: managedInstance,
            storageProtocol: storageProtocol ?? STORAGE_PROTOCOLS.ISCSI
        };

        const shouldRunInstanceLevelAssessment =
            !skipInstanceLevel &&
            fields.some(field =>
                [
                    AssessmentCategoriesOracle.STORAGE,
                    AssessmentCategoriesOracle.COMPUTE,
                    AssessmentCategoriesOracle.AWS_BACKUP,
                    AssessmentCategoriesOracle.CRR,
                    AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT,
                    AssessmentCategoriesOracle.CLONE
                ].includes(field.toLowerCase() as AssessmentCategoriesOracle)
            );

        const shouldRunHostLevelAssessment =
            !skipHostLevel &&
            fields.some(field =>
                [AssessmentCategoriesOracle.HOST_OS_PATCH, AssessmentCategoriesOracle.COMPUTE].includes(
                    field.toLowerCase() as AssessmentCategoriesOracle
                )
            );

        const shouldRunOracleSecurityPatchAssessment =
            !skipInstanceLevel &&
            fields.some(field =>
                [AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH].includes(
                    field.toLowerCase() as AssessmentCategoriesOracle
                )
            );

        // Run host-level and instance-level assessments concurrently
        const assessmentPromises: Promise<void>[] = [];

        if (shouldRunHostLevelAssessment) {
            assessmentPromises.push(
                initiateHostLevelAssessmentDataCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    instanceRecord,
                    parentJobId,
                    fields
                )
            );
        }

        if (shouldRunInstanceLevelAssessment) {
            assessmentPromises.push(
                initiateInstanceLevelAssessmentDataCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    instanceRecord,
                    parentJobId,
                    fields
                )
            );
        }

        if (shouldRunOracleSecurityPatchAssessment) {
            assessmentPromises.push(
                initiateOracleSecurityPatchAssessmentCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    instanceRecord,
                    parentJobId
                )
            );
        }

        await Promise.all(assessmentPromises);
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
            await updateParentJobStatus(accountId, parentJobId, false, errorMessage);
            if (initiatedBy === AssessmentTriggeredBy.USER) {
                updateLongRunningAuditGroup(
                    jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED
                );
            }
        }
        if (shouldUpdateAssessmentResults) {
            await updateAssessmentResultsInInstanceMetadata(managedInstance);
        }
    }
}

async function onDemandTriggerOracleDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    initiatedBy: AssessmentTriggeredBy,
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
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const instanceDetailsForJob = JSON.stringify({
            hostName: resourceName,
            resourceId: databaseHostId,
            databaseInstanceId,
            databaseInstanceName: instanceName,
            sqlServerDeploymentType: RESOURCESTYPE.ORACLE
        });
        const jobName = `Oracle assessment for database ${savedInstanceName}`;
        const jobDescription = `${jobName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
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
            : Object.values(AssessmentCategoriesOracle).map(category => category.toLowerCase());
        // Fire-and-forget: HTTP on-demand only registers the child job; callers that need completion (e.g.
        // `triggerOracleAssessmentAfterOptimization`) poll sub-jobs under the parent optimize job.
        triggerOracleAssessment(managedInstance, jobId, fieldsValues, true, initiatedBy).catch(error => {
            logger.error('Background Oracle assessment failed', {
                accountId,
                databaseHostId,
                databaseInstanceId,
                error
            });
        });

        return { jobId };
    } catch (error: any) {
        const errorMessage = `Error while triggering drift assessment for account ${accountId}, host ${databaseHostId}, instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMessage);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function triggerOracleAssessmentAfterOptimization(
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

    await onDemandTriggerOracleDriftAssessment(
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

async function fetchOracleDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
): Promise<OracleAssessmentResponseType> {
    logger.info('Fetching oracle drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    const instanceDetail =
        databaseInstance ?? (await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId));

    let {
        database_instance_name: databaseInstanceName,
        fsxn_ids: fileSystemId,
        configurations: instanceConfigurations,
        database_deployment_type: databaseDeploymentType,
        storage_protocol: storageProtocol,
        resource: {
            configurations: hostConfigurations,
            metadata: resourceMetadata,
            resource_name: databaseHostName,
            assessment_data: hostLevelAssessmentData
        }
    } = instanceDetail as DatabaseInstance;

    const instanceDismissedConfigs = (instanceConfigurations as DatabaseInstanceConfigurations)
        ?.dismissedConfigurations;
    const hostDismissedConfigs = (hostConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations;

    const { node1InstanceId } = resourceMetadata as Metadata;

    let fieldsValues =
        fields?.toLowerCase().replace(/\s+/g, '').split(',') ||
        Object.values(AssessmentCategoriesOracle).map(category => category.toLowerCase());

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

    const latestInstanceAssessmentTime = getLatestInstanceAssessmentTime(databaseInstanceConfigData);
    const mappedOntapVolumes = assessmentDataMap[AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES] as Record<
        string,
        OracleMappedOntapVolumesResponse
    >;

    storageProtocol = storageProtocol || (mappedOntapVolumes ? mappedOntapVolumes[fileSystemId]?.protocol : '');
    const isASMManaged = mappedOntapVolumes ? mappedOntapVolumes[fileSystemId]?.isASMManaged : false;

    const dismissedConfigurations = mergeDismissConfigurations(instanceDismissedConfigs, hostDismissedConfigs);

    if (!isEmpty(dismissedConfigurations)) {
        fieldsValues = updateFieldsBasedOnDismissedConfigurations(
            fieldsValues,
            dismissedConfigurations,
            DatabaseTypes.ORACLE,
            storageProtocol ?? STORAGE_PROTOCOLS.ISCSI,
            isASMManaged
        );
    }

    const effectiveProtocol = storageProtocol ?? STORAGE_PROTOCOLS.ISCSI;
    if (effectiveProtocol !== STORAGE_PROTOCOLS.ISCSI) {
        fieldsValues = fieldsValues.filter(
            field => field.toLowerCase() !== AssessmentCategoriesOracle.COMPUTE.toLowerCase()
        );
    }

    const assessmentFlags = {
        storage: fieldsValues.includes(AssessmentCategoriesOracle.STORAGE.toLowerCase()),
        compute: fieldsValues.includes(AssessmentCategoriesOracle.COMPUTE.toLowerCase()),
        hostOsPatch: fieldsValues.includes(AssessmentCategoriesOracle.HOST_OS_PATCH.toLowerCase()),
        awsBackup: fieldsValues.includes(AssessmentCategoriesOracle.AWS_BACKUP.toLowerCase()),
        crr: fieldsValues.includes(AssessmentCategoriesOracle.CRR.toLowerCase()),
        snapcenterSnapshot: fieldsValues.includes(AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT.toLowerCase()),
        oracleSecurityPatch: fieldsValues.includes(AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH.toLowerCase()),
        clone: fieldsValues.includes(AssessmentCategoriesOracle.CLONE.toLowerCase())
    };
    const demoComputeInputs =
        IS_DEMO_FLOW && assessmentFlags.compute && storageProtocol === STORAGE_PROTOCOLS.ISCSI
            ? buildDemoComputeHostOsAssessmentInputs(resourceMetadata as Metadata)
            : undefined;

    const awsBackupAssessmentData = assessmentDataMap[AssessmentCategories.AWS_BACKUP] as
        | AWSBackupAssessment
        | undefined;

    const crrAssessmentData = assessmentDataMap[AssessmentCategoriesOracle.CRR] as unknown as CrrAssessment;

    const volumeMappings = mappedOntapVolumes?.[fileSystemId]?.volumeMappings || [];
    const instanceVolumeMapping = volumeMappings.find(
        (m: Record<string, OracleMappedOntapVolumeRecord>) => m[databaseInstanceName]
    )?.[databaseInstanceName];
    const volumeIdsByFileType = getOntapVolumeIdsByFileType(instanceVolumeMapping, [
        OracleSysFileTypes.DATA_FILES,
        OracleSysFileTypes.CONTROL_FILES,
        OracleSysFileTypes.ARCHIVE_LOGS,
        OracleSysFileTypes.TEMP_FILES,
        OracleSysFileTypes.FRA
    ]);
    const dataFileVolumeIds = volumeIdsByFileType[OracleSysFileTypes.DATA_FILES] ?? [];
    const controlFileVolumeIds = volumeIdsByFileType[OracleSysFileTypes.CONTROL_FILES] ?? [];
    const archiveLogVolumeIds = volumeIdsByFileType[OracleSysFileTypes.ARCHIVE_LOGS] ?? [];

    const nonControlFileVolumeIds = new Set([
        ...dataFileVolumeIds,
        ...archiveLogVolumeIds,
        ...(volumeIdsByFileType[OracleSysFileTypes.TEMP_FILES] ?? []),
        ...(volumeIdsByFileType[OracleSysFileTypes.FRA] ?? [])
    ]);
    const controlFileOnlyVolumeIds = controlFileVolumeIds.filter(id => !nonControlFileVolumeIds.has(id));

    const [
        storageDriftData,
        hostLevelData,
        awsBackupDriftData,
        crrData,
        snapcenterDriftData,
        oracleSecurityPatchData,
        cloneDriftData,
        hostLevelComputeDriftData
    ] = await Promise.all([
        assessmentFlags.storage
            ? calculateStorageDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  node1InstanceId,
                  databaseInstanceId,
                  databaseInstanceName,
                  databaseDeploymentType || '',
                  fileSystemId,
                  mappedOntapVolumes,
                  assessmentDataMap[AssessmentCategoriesOracle.STORAGE] as StorageAssessment
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([]),
        assessmentFlags.hostOsPatch
            ? Promise.resolve(
                  hostLevelDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      resourceMetadata as Metadata,
                      hostLevelAssessmentData as ResourceAssessmentData,
                      fieldsValues
                  )
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([]),
        assessmentFlags.awsBackup && awsBackupAssessmentData
            ? Promise.resolve(
                  getOracleAwsBackupDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      awsBackupAssessmentData
                  )
              )
            : Promise.resolve(undefined),
        assessmentFlags.crr
            ? Promise.resolve(
                  getCrrDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      crrAssessmentData,
                      controlFileVolumeIds,
                      controlFileOnlyVolumeIds
                  )
              )
            : Promise.resolve(undefined),
        assessmentFlags.snapcenterSnapshot
            ? Promise.resolve(
                  calculateSnapCenterDrift(
                      assessmentDataMap[AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT] as SnapcenterAssessmentData,
                      { dataFileVolumeIds, controlFileVolumeIds, archiveLogVolumeIds }
                  )
              )
            : Promise.resolve(undefined),
        assessmentFlags.oracleSecurityPatch
            ? Promise.resolve(
                  calculateOracleSecurityPatchDrift(
                      assessmentDataMap[
                          AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH
                      ] as OracleSecurityPatchDriftResponseType
                  )
              )
            : Promise.resolve(undefined),
        assessmentFlags.clone
            ? Promise.resolve(
                  calculateOracleCloneDrift(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      assessmentDataMap[AssessmentCategoriesOracle.CLONE] as CloneAssessment
                  )
              )
            : Promise.resolve(undefined),
        assessmentFlags.compute && storageProtocol === STORAGE_PROTOCOLS.ISCSI
            ? Promise.resolve(
                  calculateComputeHostOsDrift(
                      node1InstanceId,
                      databaseInstanceName,
                      demoComputeInputs?.computeHostOs ??
                          (hostLevelAssessmentData as ResourceAssessmentData)?.computeHostOs,
                      demoComputeInputs?.oracleParamsConfigData ?? assessmentDataMap[AssessmentCategoriesOracle.COMPUTE]
                  )
              )
            : Promise.resolve<(AssessmentItemType | AssessmentErrorItemType)[]>([])
    ]);

    // Append all assessments together.
    const assessments: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    [storageDriftData, hostLevelComputeDriftData, hostLevelData].forEach(item => {
        if (!isEmpty(item) && item.length > 0) {
            assessments.push(...item);
        }
    });
    [awsBackupDriftData, crrData, snapcenterDriftData, oracleSecurityPatchData, cloneDriftData].forEach(item => {
        if (!isEmpty(item)) {
            assessments.push(item);
        }
    });

    // Demo overrides on flat array
    const finalAssessments = IS_DEMO_FLOW
        ? handleGetOracleAssessmentForDemo(accountId, instanceDetail, assessments)
        : assessments;

    const assessmentResponse = {
        assessments: finalAssessments,
        dismissedConfigurations: buildDismissedConfigurations(dismissedConfigurations, DatabaseTypes.ORACLE),
        metadata: {
            lastAssessmentTimestamp:
                latestInstanceAssessmentTime instanceof Date
                    ? new Date(latestInstanceAssessmentTime).valueOf()
                    : undefined,
            fileSystemId,
            databaseInstanceName,
            ec2InstanceId: node1InstanceId,
            deploymentType: databaseDeploymentType,
            databaseHostName: databaseHostName || '',
            storageProtocol,
            isASMManaged
        }
    };

    const { isValid, errors } = validateWithSchema(OracleAssessmentResponse, assessmentResponse);
    if (!isValid) {
        logger.error('Invalid Oracle assessment response', { errors });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Invalid Oracle assessment response');
    }

    return assessmentResponse;
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

    const driftAssessmentData = await fetchOracleDriftAssessment(
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

async function fetchOracleDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceDetail?: ResourceDetails
) {
    logger.info('Fetching oracle drift assessment per host', { accountId, credentialsId, region, databaseHostId });

    if (!resourceDetail) {
        const { items: [resource] = [] } = await getResources({
            accountId,
            resourceId: databaseHostId,
            credentialsId,
            region,
            resourceType: RESOURCESTYPE.ORACLE,
            includeDatabaseInstances: true,
            allRecords: false,
            assessmentData: true
        });

        if (!resource) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No oracle database host by id ${databaseHostId} for ${accountId} is found.`
            );
        }
        resourceDetail = resource;
    }

    const { resource_name: databaseHostName = '', database_instances: instancesManaged = [] } = resourceDetail;

    if (isEmpty(instancesManaged)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No managed oracle databases found for account ${accountId} and host ${databaseHostId}.`
        );
    }

    const assessmentFields = [
        AssessmentCategoriesOracle.STORAGE,
        AssessmentCategoriesOracle.COMPUTE,
        AssessmentCategoriesOracle.HOST_OS_PATCH,
        AssessmentCategoriesOracle.AWS_BACKUP,
        AssessmentCategoriesOracle.CRR,
        AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT,
        AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
        AssessmentCategoriesOracle.CLONE
    ].join(',');

    const driftAssessments = await Promise.all(
        instancesManaged.map(
            throat(3, async instance => {
                const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                    instance;
                try {
                    const driftAssessment = await fetchOracleDriftAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        assessmentFields,
                        { ...instance, resource: resourceDetail } as DatabaseInstancesIncludingResource
                    );
                    return { databaseInstanceId, databaseInstanceName, assessments: driftAssessment };
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    logger.error(
                        `Error while fetching oracle drift assessment for ${databaseInstanceId}: ${errorMessage}`
                    );
                    return { databaseInstanceId, databaseInstanceName, error: errorMessage };
                }
            })
        )
    );

    return {
        databaseHostId,
        databaseHostName,
        instancesAssessment: driftAssessments
    } as DriftAssessmentResponsePerHostType;
}

async function fetchOracleDriftAssessmentPerAccount(
    accountId: string,
    credentialsId: string,
    region: string,
    clientNextToken?: string,
    pageSize?: number
) {
    logger.info('Fetching oracle drift assessment per account', {
        accountId,
        credentialsId,
        region,
        clientNextToken,
        pageSize
    });

    const { items: resourceDetails = [], nextToken } = await getResources({
        accountId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.ORACLE,
        pageSize: pageSize || 50,
        nextToken: clientNextToken,
        includeDatabaseInstances: true,
        assessmentData: true
    });
    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId} in region ${region}.`);
        return { count: 0, assessmentsPerAccount: [], nextToken: '' };
    }

    const driftAssessmentPerAccount = await Promise.all(
        resourceDetails.map(
            throat(3, async resourceDetail => {
                const { resource_id: databaseHostId } = resourceDetail;
                try {
                    return await fetchOracleDriftAssessmentPerHost(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        resourceDetail
                    );
                } catch (error) {
                    logger.error(
                        `Error while fetching drift assessment per host ${accountId}, ${databaseHostId}, ${error}`
                    );
                }
            })
        )
    );

    const filteredAssessments = driftAssessmentPerAccount.filter(Boolean);

    return {
        count: filteredAssessments.length,
        assessmentsPerAccount: filteredAssessments,
        nextToken
    } as DriftAssessmentResponsePerAccountType;
}

async function fetchOraclePatchScan(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    field: OraclePatchScanFieldType
) {
    logger.info('Running Oracle patch scan', {
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
        database_instance_name: databaseInstanceName,
        resource: { metadata: resourceMetadata }
    } = instanceDetail;
    const { node1InstanceId: ec2InstanceId } = resourceMetadata as Metadata;

    switch (field) {
        case AssessmentCategoriesOracle.HOST_OS_PATCH:
            return fetchOracleHostOsPatchWithMissingPatches(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                ec2InstanceId
            );
        case AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH:
            return fetchOracleSecurityPatchWithMissingPatches(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                databaseInstanceName,
                ec2InstanceId
            );
        default: {
            const errorMessage = `Unsupported patch-scan field: ${field as string}`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, field });
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }
}

// golden-config `id` -> v1 top-level response key (single-item areas)
const ORACLE_SINGLE_ASSESSMENT_KEY_BY_ID: Record<string, string> = {
    'transparent-hugepages': 'transparentHugepages',
    'tcp-advanced-options': 'tcpAdvancedOptions',
    'filesystems-io-options': 'filesystemsIoOptions',
    'multiblock-readcount': 'multiblockReadcount',
    'host-os-patch': 'hostOsPatch',
    'oracle-security-patch': 'oracleSecurityPatch',
    'snapcenter-snapshot': 'snapcenterSnapshot',
    crr: 'crr',
    'backup-configuration': 'awsBackup',
    'clone-management': 'clone'
};

// golden-config `configurationName` -> v1 dismissedConfigurations key (single-item areas)
const ORACLE_DISMISS_SINGLE_KEY_BY_NAME: Record<string, string> = {
    'transparent-hugepages': 'transparentHugepages',
    'tcp-advanced-options': 'tcpAdvancedOptions',
    'filesystems-io-options': 'filesystemsIoOptions',
    'multiblock-readcount': 'multiblockReadcount',
    'host-os-patch': 'hostOsPatch',
    'oracle-security-patch': 'oracleSecurityPatch',
    'snapcenter-snapshot': 'snapcenterSnapshot',
    crr: 'crr',
    'backup-configuration': 'awsBackup',
    'clone-management': 'clone'
};

// golden-config `id` -> v1 mapping config for Oracle assessments
const ORACLE_V1_MAP_CONFIG: MapAssessmentToV1Config = {
    metadataSelector: metadata => ({
        lastAssessmentTimestamp: metadata.lastAssessmentTimestamp,
        fileSystemId: metadata.fileSystemId,
        ec2InstanceId: metadata.ec2InstanceId,
        ec2InstanceName: metadata.ec2InstanceName,
        databaseInstanceName: metadata.databaseInstanceName,
        deploymentType: metadata.deploymentType,
        storageProtocol: metadata.storageProtocol,
        isASMManaged: metadata.isASMManaged,
        databaseHostName: metadata.databaseHostName
    }),
    storageConfigMap: ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    storageSizingLayoutMap: ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP,
    singleKeyById: ORACLE_SINGLE_ASSESSMENT_KEY_BY_ID,
    dismissSingleKeyByName: ORACLE_DISMISS_SINGLE_KEY_BY_NAME,
    validate: response => validateWithSchema(OracleDriftAssessmentResponse, response),
    dbLabel: 'Oracle'
};

async function fetchOracleDriftAssessmentV1(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
): Promise<OracleDriftAssessmentResponseType> {
    const v2Response = await fetchOracleDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields,
        databaseInstance
    );
    // v1 schemas omit `id`/`categories`; Fastify's response serializer drops them from the payload.
    return mapAssessmentToV1(v2Response, ORACLE_V1_MAP_CONFIG) as unknown as OracleDriftAssessmentResponseType;
}

async function fetchOracleDriftAssessmentPerAccountV1(
    accountId: string,
    credentialsId: string,
    region: string,
    clientNextToken?: string,
    pageSize?: number
): Promise<DriftAssessmentResponsePerAccountV1Type> {
    const v2Result = await fetchOracleDriftAssessmentPerAccount(
        accountId,
        credentialsId,
        region,
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
                          ORACLE_V1_MAP_CONFIG
                      ) as unknown as OracleDriftAssessmentResponseType)
                    : undefined
            }))
        }))
    };
}

export {
    triggerOracleAssessment,
    onDemandTriggerOracleDriftAssessment,
    fetchOracleDriftAssessment,
    fetchOracleDriftAssessmentV1,
    fetchOracleDriftAssessmentPerHost,
    fetchOracleDriftAssessmentPerAccount,
    fetchOracleDriftAssessmentPerAccountV1,
    fetchOraclePatchScan,
    initiateInstanceLevelAssessmentDataCollection,
    triggerOracleAssessmentAfterOptimization,
    getOntapVolumeIdsByFileType,
    ORACLE_V1_MAP_CONFIG
};
