import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import moment from 'moment';
import getLogger from '../utils/logger';
import { extractSqlInstanceName, isDemo, sqlResponseParsing } from '../utils/utils';
import { getFsxStorageDetails, getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/continuous-optimization-scripts';
import {
    CloneAssessment,
    DatabaseInstance,
    DatabaseInstanceConfigurations,
    DatabaseInstanceDismissConfigs,
    DatabaseInstanceMetadata,
    DatabaseInstancesIncludingResource,
    MappedOnTapVolumeResponse,
    MaxDOPAssesment,
    Metadata,
    ResourceDetails,
    StorageAssessment,
    WorkloadInstance,
    CloneDetail
} from '../utils/common-types';
import {
    AuditStatus,
    ASSESSMENT_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    RESOURCESTYPE,
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES,
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    WF_NOTIFICATION_PRIORITY,
    NOTIFICATION_TYPE,
    DatabaseTypes
} from '../utils/consts';
import { registerJob, updateJobDetails, updateParentJobStatus } from './database/job-operations';

import { listResources } from '../lib/database/db';
import { AssessmentCategories, AssessmentStatus, AssessmentTriggeredBy } from '../utils/continous-optimization-consts';
import {
    CloneDriftResponseType,
    ComputeDriftResponseType,
    DriftAssessmentResponseType,
    HostOsPatchDriftResponseType,
    LicenseDriftResponseType,
    MSSQLPatchDriftResponseType,
    ParameterDriftResponseType,
    RssConfigDriftResponseType,
    StorageParameterDriftResponseType
} from '../routes/types/continuous-optimization.types';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../lib/database/database-instance-config';
import {
    getInstanceInfo,
    getResources,
    listAllManagedInstances,
    updateInstanceMetadata,
    updateResourceMetaData
} from './database/database-operations';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    calculateLicenseDrift,
    managedHostsLicenseAssessment
} from './continuous-optimization/license-assessment-operations';
import {
    calculateComputeDrift,
    managedHostsComputeAssessment
} from './continuous-optimization/compute-assessment-operations';
import {
    calculateHostOsPatchDrift,
    managedHostOsPatchAssessment,
    updatePatchBaselineStatusForHost
} from './continuous-optimization/hostOsPatch-assessment-operations';
import { calculateStorageDrift } from './continuous-optimization/storage-assessment-operations';
import {
    calculateRssConfigDrift,
    managedHostsRssConfigAssessment
} from './continuous-optimization/rssConfig-assessment-operations';
import {
    calculateMaxDOPDrift,
    managedHostsMaxDOPAssessment
} from './continuous-optimization/maxdop-assessment-operations';
import {
    calculateMSSQLPatchDrift,
    managedHostMSSQLPatchAssessment
} from './continuous-optimization/mssqlPatch-assessment-operations';
import {
    getResilienceDriftAssessment,
    initiateCrossRegionResiliencyAssessment,
    collectSnapshotCopyData,
    initiateAWSBackupAssessment
} from './continuous-optimization/resilience-assessment-operation';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import {
    calculateCloneDrift,
    managedHostsCloneAssessment
} from './continuous-optimization/clone-assessment-operations';
import {
    checkAndUpdatePostponedEndTime,
    updateFieldsBasedOnDismissedConfigurations
} from './continuous-optimization/assessment-utils';
import prepareWFNotificationRequest from './wf-notification-operations';

const isDemoFlow = isDemo();
const logger = getLogger();

interface NotificationData {
    content: string;
    subject: string;
    resourceType: string;
    resourceId: string;
    priority: string;
    resourceName: string;
    notificationType: string;
}

interface InstanceAssessmentDetails {
    resourceId: string;
    databaseInstanceId: string;
    notOptimized: boolean;
    details?: any;
}

interface AccountAssessmentSummary {
    wellArchitectedCount: number;
    notOptimizedCount: number;
    instances: InstanceAssessmentDetails[];
}

async function updateAssesmentResultsInInstanceMetadata(managedInstance: DatabaseInstancesIncludingResource) {
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
    const [driftAssessmentData, instanceDetails] = await Promise.all([
        fetchDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            undefined,
            managedInstance
        ),
        managedInstance ?? getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId)
    ]);
    const { metadata } = instanceDetails as unknown as DatabaseInstance;

    (metadata as unknown as DatabaseInstanceMetadata).assessmentResults = driftAssessmentData;
    try {
        await updateInstanceMetadata(accountId, databaseInstanceId, metadata);
    } catch (error) {
        logger.error('Error while updating assessment results in instance metadata', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error
        });
    }
}

async function initiateHostLevelAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string,
    jobId: string,
    fields: string[],
    databaseInstanceId: string,
    sqlAuthEnabled: boolean
) {
    logger.info('Initiate compute/license/host-os-patch/rss/mssqlpatch assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName,
        jobId,
        fields,
        databaseInstanceId,
        sqlAuthEnabled
    });

    const {
        items: [resource]
    } = await getResources(accountId, databaseHostId, credentialsId, region, undefined, undefined, undefined, true);

    const {
        metadata,
        cloud_provider_account_id: awsAccountId,
        resource_id: resourceId,
        database_instances: managedInstances = []
    } = resource;
    const managedInstance = managedInstances.find(instance => instance.database_instance_id === databaseInstanceId);

    if (!managedInstance) {
        logger.error('Managed instance not found for the given databaseInstanceId', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            credentialsId,
            region
        });

        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            `Managed instance not found for the given databaseInstanceId ${databaseInstanceId}.`
        );
    }

    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { activeNodeInstanceId = '', instanceName } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceId,
        accountId
    });
    if (metadata && activeNodeInstanceId) {
        let licenseAssessment;
        let licenseErrorMessage;

        let computeAssessment;
        let computeErrorMessage;
        let hostOsPatchAssessment;
        let hostOsPatchErrorMessage;
        let rssConfigAssessment;
        let rssConfigErrorMessage;
        let mssqlPatchAssessment;
        let mssqlPatchErrorMessage;

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
                const existingAssessmentData = (metadata as unknown as Metadata).assessment;
                const { compute: { recommendationOptions: existingRecommendationOptions } = {} } =
                    existingAssessmentData || {};
                if (
                    existingRecommendationOptions &&
                    !isEmpty(existingRecommendationOptions) &&
                    recommendationOptions &&
                    !isEmpty(recommendationOptions)
                ) {
                    const existingRecommendationInstanceTypes = existingRecommendationOptions.map(
                        ({ instanceType }) => instanceType
                    );
                    const newRecommendationInstanceTypes = recommendationOptions.map(
                        ({ instanceType }) => instanceType
                    );
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
            mssqlPatchErrorMessage
        ].some(item => !isEmpty(item));

        if (hasAssessmentOrError) {
            const existingAssessmentData = (metadata as unknown as Metadata).assessment || {};

            (metadata as unknown as Metadata).assessment = {
                license: licenseAssessment || (!licenseErrorMessage ? existingAssessmentData?.license : undefined),
                compute: computeAssessment || (!computeErrorMessage ? existingAssessmentData?.compute : undefined),
                hostOsPatch:
                    hostOsPatchAssessment ||
                    (!hostOsPatchErrorMessage ? existingAssessmentData?.hostOsPatch : undefined),
                rssConfig:
                    rssConfigAssessment || (!rssConfigErrorMessage ? existingAssessmentData?.rssConfig : undefined),
                mssqlPatch:
                    mssqlPatchAssessment || (!mssqlPatchErrorMessage ? existingAssessmentData?.mssqlPatch : undefined),
                errors: {
                    license:
                        licenseErrorMessage ||
                        (!licenseAssessment ? existingAssessmentData?.errors?.license : undefined),
                    compute:
                        computeErrorMessage ||
                        (!computeAssessment ? existingAssessmentData?.errors?.compute : undefined),
                    hostOsPatch:
                        hostOsPatchErrorMessage ||
                        (!hostOsPatchAssessment ? existingAssessmentData?.errors?.hostOsPatch : undefined),
                    rssConfig:
                        rssConfigErrorMessage ||
                        (!rssConfigAssessment ? existingAssessmentData?.errors?.rssConfig : undefined),
                    mssqlPatch:
                        mssqlPatchErrorMessage ||
                        (!mssqlPatchAssessment ? existingAssessmentData?.errors?.mssqlPatch : undefined)
                },
                lastAssessedDate: new Date().getTime().toString()
            };

            const assessmentResults = await fetchDriftAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                'license,compute,host-os-patch,rss-config,mssql-patch',
                {
                    ...managedInstance,
                    resource
                }
            );
            (metadata as unknown as Metadata).assessmentResults = {
                license: assessmentResults.license || undefined,
                compute: assessmentResults.compute || undefined,
                hostOsPatch: assessmentResults.hostOsPatch || undefined,
                rssConfig: assessmentResults.rssConfig || undefined,
                mssqlPatch: assessmentResults.mssqlPatch || undefined
            };

            await updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }
        if (!isEmpty(hostOsPatchAssessment)) {
            updatePatchBaselineStatusForHost(accountId, databaseHostId, hostOsPatchAssessment);
        }
    } else {
        logger.error('No active node found for the resource', { accountId, databaseHostId, credentialsId, region });
    }
}

async function initiateStorageAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[],
    jobTriggers: STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES = STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
) {
    logger.info('Initiating storage assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        instanceRecord
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    let snapshotPolicyAssessmentJobId = '';

    const { resourceName, name: databaseInstanceName } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    try {
        if (isEmpty(instanceVolumeMapping)) {
            errorMessage = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        const volumeRecords =
            Object.values(instanceVolumeMapping)
                ?.map(i => i?.volumeRecords)
                .flat() || [];
        instanceRecord.mappedVolumesUuids = volumeRecords.map(volume => volume.uuid as string);
        instanceRecord.mappedVolumeNames = volumeRecords.map(volume => volume.name as string);

        instanceRecord.mappedLunNames =
            Object.values(instanceVolumeMapping)
                ?.map(i => i.lunNames)
                .flat() || [];

        const command = [STORAGE_CONFIGURATION_ASSESSMENT(instanceRecord)];
        const ssmComment = 'Get Storage Configuration Assessment';

        const response = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            ssmComment,
            accountId,
            false,
            ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            true
        );

        const parsedResponse = response ? sqlResponseParsing(response) : {};
        const { volumes, luns, os, layout, sizing } = parsedResponse as unknown as StorageAssessment;
        if (!isDemo()) {
            // add snapshot copy details to volumes
            parsedResponse.volumes = await collectSnapshotCopyData(accountId, credentialsId, instanceRecord, volumes);
        }
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: instanceRecord.id,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.STORAGE,
                config_data: parsedResponse
            }
        ]);

        const configJobStatus = isDemo()
            ? JOBSTATUS.COMPLETED
            : isEmpty(volumes) && isEmpty(luns) && isEmpty(os)
            ? JOBSTATUS.FAILED
            : !isEmpty(volumes) && !isEmpty(luns) && !isEmpty(os)
            ? JOBSTATUS.COMPLETED
            : JOBSTATUS.WARNING;
        if (
            jobTriggers.valueOf() === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH.valueOf() ||
            jobTriggers === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.STORAGE.valueOf()
        ) {
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage configuration assessment',
                description: 'Storage configuration assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: configJobStatus,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage layout assessment',
                description: 'Storage layout assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(layout) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage sizing assessment',
                description: 'Storage sizing assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(sizing) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
        }

        if (
            jobTriggers.valueOf() === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH.valueOf() ||
            jobTriggers === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY.valueOf()
        ) {
            ({ id: snapshotPolicyAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
                name: 'Snapshot policy assessment ',
                description: 'Snapshot policy assessment ',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: configJobStatus,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            }));
        }
    } catch (error) {
        logger.error('Error while initiating storage assessment collection', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceRecord,
            error
        });
        errorMessage = `Error while initiating storage assessment collection. ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessage
        });
        if (snapshotPolicyAssessmentJobId) {
            await updateJobDetails(accountId, snapshotPolicyAssessmentJobId, {
                endTime: Date.now(),
                status: jobStatus,
                error: errorMessage
            });
        }
    }
}

async function driftAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    fields?: string,
    dismissedConfigurations?: DatabaseInstanceDismissConfigs
) {
    logger.info('Drift assessment data collection', {
        accountId,
        credentialsId,
        region,
        jobId,
        databaseHostId,
        databaseInstanceRecord,
        fields,
        dismissedConfigurations
    });

    let fieldsValues = fields
        ? fields.toLowerCase().replace(/\s+/g, '').split(',')
        : Object.values(AssessmentCategories).map(category => category.toLowerCase());

    if (!isEmpty(dismissedConfigurations)) {
        fieldsValues = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);
    }

    const shouldRunStorageAssessment = fieldsValues.includes(AssessmentCategories.STORAGE.toLowerCase());
    const shouldRunComputeAssessment = fieldsValues.includes(AssessmentCategories.COMPUTE.toLowerCase());
    const shouldRunLicenseAssessment = fieldsValues.includes(AssessmentCategories.LICENSE.toLowerCase());
    const shouldRunHostOsPatchAssessment = fieldsValues.includes(AssessmentCategories.HOST_OS_PATCH.toLowerCase());
    const shouldRunRssConfigAssessment = fieldsValues.includes(AssessmentCategories.RSS_CONFIG.toLowerCase());
    const shouldRunMAXDOPAssessment = fieldsValues.includes(AssessmentCategories.MAXDOP.toLowerCase());
    const shouldRunMSSQLPatchAssessment = fieldsValues.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase());
    const shouldRunSnapshotPolicyAssessment = fieldsValues.includes(AssessmentCategories.SNAPSHOT_POLICY.toLowerCase());
    const shouldRunAwsBackupAssessment = fieldsValues.includes(AssessmentCategories.AWS_BACKUP.toLowerCase());
    const shouldRunCrrAssessment = fieldsValues.includes(AssessmentCategories.CRR.toLowerCase());
    const shouldRunCloneAssessment = fieldsValues.includes(AssessmentCategories.CLONE.toLowerCase());

    const shouldRunInstanceLevelAssessment =
        shouldRunStorageAssessment ||
        shouldRunSnapshotPolicyAssessment ||
        shouldRunCrrAssessment ||
        shouldRunAwsBackupAssessment ||
        shouldRunCloneAssessment ||
        shouldRunMAXDOPAssessment;
    const shouldRunHostLevelAssessment =
        shouldRunComputeAssessment ||
        shouldRunLicenseAssessment ||
        shouldRunHostOsPatchAssessment ||
        shouldRunRssConfigAssessment ||
        shouldRunMSSQLPatchAssessment;

    if (shouldRunInstanceLevelAssessment) {
        const { StorageVirtualMachines: svms = [] } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            [databaseInstanceRecord.fsxFileSystem],
            { useCache: true }
        );

        databaseInstanceRecord.svmOntapUuid = svms.find(svm =>
            isDemoFlow ? svm : svm?.StorageVirtualMachineId === databaseInstanceRecord.svmId
        )?.UUID;

        const instanceVolumeMapping = (await getMappedOntapVolumes(
            credentialsId,
            region,
            databaseInstanceRecord.fsxFileSystem,
            false,
            databaseInstanceRecord.activeNodeInstanceid,
            [databaseInstanceRecord.name],
            databaseInstanceRecord.sqlAuthEnabled,
            true,
            accountId,
            ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
            databaseInstanceRecord.svmOntapUuid
        )) as MappedOnTapVolumeResponse[];

        try {
            await createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: databaseHostId,
                    database_instance_id: databaseInstanceRecord.id,
                    creation_time: new Date(Date.now()),
                    config_data_type: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
                    config_data: instanceVolumeMapping
                }
            ]);
        } catch (error) {
            const databaseInstanceId = databaseInstanceRecord.id;
            logger.error('Error while persisting mapped ontap volumes data', {
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                error
            });
        }

        const { resourceName, name: databaseInstanceName, id: databaseInstanceId } = databaseInstanceRecord;
        const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
        const instanceDetailsForJob = JSON.stringify({
            hostName: resourceName,
            resourceId: databaseHostId,
            databaseInstanceId,
            databaseInstanceName,
            sqlServerDeploymentType: RESOURCESTYPE.MSSQL
        });

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

        await initiateStorageAssessmentCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceLevelAssessmentJobId,
            databaseInstanceRecord,
            instanceVolumeMapping,
            !shouldRunSnapshotPolicyAssessment
                ? STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.STORAGE
                : shouldRunStorageAssessment
                ? STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
                : STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY
        );

        if (shouldRunCrrAssessment) {
            await initiateCrossRegionResiliencyAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord,
                instanceVolumeMapping
            );
        }
        if (shouldRunAwsBackupAssessment) {
            await initiateAWSBackupAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord,
                instanceVolumeMapping
            );
        }
        if (shouldRunCloneAssessment) {
            await managedHostsCloneAssessment(
                accountId,
                credentialsId,
                region,
                databaseInstanceRecord.activeNodeInstanceid,
                databaseInstanceRecord.resourceName,
                databaseHostId,
                databaseInstanceId,
                instanceLevelAssessmentJobId
            );
        }
        if (shouldRunMAXDOPAssessment) {
            await managedHostsMaxDOPAssessment(
                accountId,
                credentialsId,
                region,
                databaseInstanceRecord.activeNodeInstanceid,
                databaseInstanceRecord.resourceName,
                databaseHostId,
                databaseInstanceId,
                instanceLevelAssessmentJobId
            );
        }
    }

    if (shouldRunHostLevelAssessment) {
        await initiateHostLevelAssessmentDataCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceRecord.resourceName,
            jobId,
            fieldsValues,
            databaseInstanceRecord.id,
            databaseInstanceRecord.sqlAuthEnabled
        );
    }
}

async function triggerAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields?: string
) {
    let errorMessage = '';
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId,
        resource
    } = managedInstance;

    logger.info('Triggering drift assessment ', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        parentJobId,
        fields
    });

    let activeNodeInstanceId;
    let newDatabaseInstanceDetails;
    let cloudProviderAccountId;
    let instanceDetails;
    let dismissedConfigurations;
    let updatedDismissedInstanceConfigurations;
    let updatedDismissedHostConfigurations;

    try {
        instanceDetails = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            undefined,
            managedInstance
        );

        activeNodeInstanceId = instanceDetails.activeNodeInstanceId;
        newDatabaseInstanceDetails = instanceDetails.newDatabaseInstanceDetails;
        cloudProviderAccountId = instanceDetails.cloudProviderAccountId;
        const { configurations: instanceConfigurations, resource: resourceDetail } =
            newDatabaseInstanceDetails as unknown as DatabaseInstance;
        const { configurations: hostConfigurations } = resourceDetail as unknown as ResourceDetails;
        const dismissedInstanceConfigurations = (instanceConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;
        if (dismissedInstanceConfigurations) {
            updatedDismissedInstanceConfigurations = await checkAndUpdatePostponedEndTime(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                dismissedInstanceConfigurations,
                databaseInstanceId
            );
        }
        const dismissedHostConfigurations = (hostConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;
        if (dismissedHostConfigurations) {
            updatedDismissedHostConfigurations = await checkAndUpdatePostponedEndTime(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                dismissedHostConfigurations
            );
        }
        dismissedConfigurations = {
            ...updatedDismissedInstanceConfigurations,
            ...updatedDismissedHostConfigurations
        };
    } catch (error) {
        errorMessage = `Error while fetching instance details: ${accountId} ${databaseInstanceId}. Error: ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    try {
        const {
            database_instance_name: savedInstanceName,
            fsxn_ids: fileSystemId,
            sqlAuthEnabled
        } = newDatabaseInstanceDetails || {};

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: savedInstanceName!,
            type: RESOURCESTYPE.MSSQL,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            activeNodeInstanceid: activeNodeInstanceId!,
            fsxFileSystem: fileSystemId!,
            cloudProviderAccountId: cloudProviderAccountId || '',
            resourceName: resource.resource_name || '',
            svmId:
                (instanceDetails?.newDatabaseInstanceDetails?.fsx_svm_id as Record<string, string>)[fileSystemId!] || ''
        };
        await driftAssessmentDataCollection(
            accountId,
            credentialsId,
            region,
            parentJobId,
            databaseHostId,
            instanceRecord,
            fields,
            dismissedConfigurations || {}
        );
    } catch (error: any) {
        logger.error(error);
        errorMessage = error.message || 'Internal Server Error';
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function triggerDriftAssessmentDataCollection(initiatedBy: string, fields?: string) {
    logger.info('Trigger drift assessment per account', { initiatedBy });

    const allManagedInstances = (await listAllManagedInstances(undefined, {
        databaseType: DatabaseTypes.MS_SQL_SERVER
    })) as DatabaseInstancesIncludingResource[];

    if (isEmpty(allManagedInstances)) {
        logger.info('No successfully managed database instances found.');
        return;
    }

    // group managed instances by account_id
    const managedInstancesGroupedByAccountId: { [key: string]: DatabaseInstancesIncludingResource[] } =
        allManagedInstances.reduce((acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
            const key = `${managedInstance.account_id}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(managedInstance);
            return acc;
        }, {} as { [key: string]: DatabaseInstancesIncludingResource[] });

    await Promise.all(
        Object.entries(managedInstancesGroupedByAccountId).map(
            throat(1, async ([accountId, managedInstances]) => {
                if (isEmpty(managedInstances)) {
                    const errorMessage = `No managed instances found for account ${accountId}.`;
                    logger.info(errorMessage);
                } else {
                    const jobDescription = `Assess online SQL Server instances out of ${managedInstances.length} registered instances in your account ${accountId} for best practice misalignments.`;
                    const { id: parentJobId } = await registerJob(accountId, '', '', {
                        name: jobDescription,
                        description: jobDescription,
                        resourceName: accountId,
                        initiator: initiatedBy.toLocaleUpperCase(),
                        startTime: Date.now(),
                        status: JOBSTATUS.IN_PROGRESS,
                        type: JOBTYPE.ASSESSMENT
                    });
                    const assessmentErrors: unknown[] = [];
                    let parentJobError = '';
                    try {
                        await Promise.all(
                            managedInstances.map(
                                throat(1, async managedInstance => {
                                    try {
                                        const {
                                            configurations: instanceConfigurations,
                                            resource,
                                            credentials_id: credentialsId,
                                            region,
                                            resource_id: resourceId,
                                            database_instance_id: databaseInstanceId
                                        } = managedInstance;
                                        const instanceConfiguration = (
                                            instanceConfigurations as unknown as DatabaseInstanceConfigurations
                                        )?.dismissedConfigurations;
                                        const hostDismissedConfigurations = (
                                            resource?.configurations as unknown as DatabaseInstanceConfigurations
                                        )?.dismissedConfigurations;
                                        try {
                                            await checkAndUpdatePostponedEndTime(
                                                accountId,
                                                credentialsId,
                                                region,
                                                resourceId,
                                                instanceConfiguration,
                                                databaseInstanceId
                                            );
                                        } catch (error) {
                                            logger.error('Error while updating instance postponed end time', {
                                                accountId,
                                                credentialsId,
                                                region,
                                                resourceId,
                                                databaseInstanceId,
                                                error
                                            });
                                        }

                                        try {
                                            await checkAndUpdatePostponedEndTime(
                                                accountId,
                                                credentialsId,
                                                region,
                                                resourceId,
                                                hostDismissedConfigurations
                                            );
                                        } catch (error) {
                                            logger.error('Error while updating instance postponed end time', {
                                                accountId,
                                                credentialsId,
                                                region,
                                                resourceId,
                                                error
                                            });
                                        }

                                        await triggerAssessment(managedInstance, parentJobId, fields);
                                    } catch (error) {
                                        assessmentErrors.push(error);
                                    }
                                })
                            )
                        );

                        if (assessmentErrors.length === managedInstances.length) {
                            const errorMessage = `No registered instances are online and running in account ${accountId}.`;
                            logger.info(errorMessage);
                            await updateJobDetails(accountId, parentJobId, {
                                status: JOBSTATUS.WARNING,
                                error: errorMessage,
                                endTime: Date.now()
                            });
                        } else {
                            // Proceeding with compute and license assessment at host level
                            const uniqueResMap = new Map(
                                managedInstances.map(({ resource, ...databaseInstanceDetails }) => [
                                    `${resource.account_id} + ${resource.credentials_id} + ${resource.id}`,
                                    { resource, databaseInstanceDetails } // Separate keys for resource and databaseInstanceDetails
                                ])
                            ); // create a map with unique resources; key being (accountId,credsId,resourceId unique combination) and value being actual resource
                            const uniqueResources = Array.from(uniqueResMap.values()); // getting all the unique resources from the map

                            await Promise.all(
                                uniqueResources.map(async ({ resource, databaseInstanceDetails }) => {
                                    const {
                                        account_id: wfAccountId,
                                        credentials_id: credentialsId,
                                        region,
                                        resource_id: databaseHostId,
                                        resource_name: resourceName
                                    } = resource;
                                    const { database_instance_id: databaseInstanceId } = databaseInstanceDetails;

                                    // require to get the sqlAuthEnabled flag for mssql patch assessment
                                    const { newDatabaseInstanceDetails } = await getInstanceDetails(
                                        accountId,
                                        credentialsId,
                                        region as string,
                                        databaseHostId,
                                        databaseInstanceId,
                                        resource,
                                        databaseInstanceDetails as unknown as DatabaseInstance
                                    );
                                    const { sqlAuthEnabled } = (newDatabaseInstanceDetails || {}) as DatabaseInstance;

                                    await initiateHostLevelAssessmentDataCollection(
                                        wfAccountId,
                                        credentialsId,
                                        region!,
                                        databaseHostId,
                                        resourceName!,
                                        parentJobId,
                                        [
                                            AssessmentCategories.LICENSE,
                                            AssessmentCategories.COMPUTE,
                                            AssessmentCategories.HOST_OS_PATCH,
                                            AssessmentCategories.RSS_CONFIG,
                                            AssessmentCategories.MSSQL_PATCH
                                        ],
                                        databaseInstanceId,
                                        sqlAuthEnabled as boolean
                                    );
                                })
                            );
                        }
                    } catch (error: any) {
                        logger.info('Error while triggering drift assessment for account', { accountId, error });
                        parentJobError = error.message;
                    } finally {
                        await updateParentJobStatus(accountId, parentJobId, false, parentJobError);
                        // Lets update assessment result in instance metadata
                        // Host level assessments are run for all the instances in the account. So we will update the results from one of the instance
                        await Promise.all(
                            managedInstances.map(async managedInstance => {
                                await updateAssesmentResultsInInstanceMetadata(managedInstance);
                            })
                        );
                    }
                }
            })
        )
    );
}

async function hostLevelDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    metadata: Metadata,
    fieldsValues: string[]
) {
    logger.info('Fetching host level drift data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fieldsValues
    });

    let shouldCalculateComputeAssessment = false;
    let shouldCalculateLicenseAssessment = false;
    let shouldCalculateHostOsPatchAssessment = false;
    let shouldCalculateRssConfigAssessment = false;
    let shouldCalculateMSSQLPatchAssessment = false;

    shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLowerCase());
    shouldCalculateLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLowerCase());
    shouldCalculateHostOsPatchAssessment = fieldsValues?.includes(AssessmentCategories.HOST_OS_PATCH.toLowerCase());
    shouldCalculateRssConfigAssessment = fieldsValues?.includes(AssessmentCategories.RSS_CONFIG.toLowerCase());
    shouldCalculateMSSQLPatchAssessment = fieldsValues?.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase());

    const [
        computeAssessmentResponse,
        licenseAssessmentResponse,
        hostOsPatchAssessmentResponse,
        rssConfigResponse,
        mssqlPatchAssessmentResponse
    ] = await Promise.all([
        shouldCalculateComputeAssessment
            ? calculateComputeDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  metadata as unknown as Metadata
              )
            : Promise.resolve({}),
        shouldCalculateLicenseAssessment
            ? calculateLicenseDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  metadata as unknown as Metadata
              )
            : Promise.resolve({}),
        shouldCalculateHostOsPatchAssessment
            ? calculateHostOsPatchDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  metadata as unknown as Metadata
              )
            : Promise.resolve({}),
        shouldCalculateRssConfigAssessment
            ? calculateRssConfigDrift(accountId, credentialsId, region, databaseHostId, metadata as unknown as Metadata)
            : Promise.resolve({}),
        shouldCalculateMSSQLPatchAssessment
            ? calculateMSSQLPatchDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  metadata as unknown as Metadata
              )
            : Promise.resolve({})
    ]);

    return {
        computeAssessmentResponse: computeAssessmentResponse as ComputeDriftResponseType,
        licenseAssessmentResponse: licenseAssessmentResponse as LicenseDriftResponseType,
        hostOsPatchAssessmentResponse: hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType,
        rssConfigResponse: rssConfigResponse as RssConfigDriftResponseType,
        mssqlPatchAssessmentResponse: mssqlPatchAssessmentResponse as MSSQLPatchDriftResponseType
    };
}

async function fetchDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
) {
    logger.info('Fetching drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    let dismissedConfigurations;
    const instanceDetail =
        databaseInstance ?? (await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId));

    let {
        database_instance_name: databaseInstanceName,
        fsxn_ids: fileSystemId,
        configurations: instanceConfigurations,
        resource: { configurations: hostConfigurations, metadata: resourceMetadata }
    } = instanceDetail as unknown as DatabaseInstance;

    if (isDemoFlow) {
        const [resource] = await listResources(accountId, databaseHostId, credentialsId, region);
        ({ configurations: hostConfigurations } = resource as unknown as ResourceDetails);
    }

    if (!isEmpty(instanceConfigurations) || !isEmpty(hostConfigurations)) {
        dismissedConfigurations = {
            ...(instanceConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations,
            ...(hostConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations
        };
    }
    // prismock does not support proper mapping of resource and database instance, hence calling resource listing again to fetch the configurations

    let fieldsValues = fields
        ? fields.toLowerCase().replace(/\s+/g, '').split(',')
        : Object.values(AssessmentCategories).map(category => category.toLowerCase());

    if (!isEmpty(dismissedConfigurations)) {
        fieldsValues = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);
    }

    const shouldCalculateStorageAssessment = fieldsValues.includes(AssessmentCategories.STORAGE.toLowerCase());
    const shouldCalculateComputeAssessment = fieldsValues.includes(AssessmentCategories.COMPUTE.toLowerCase());
    const shouldCalculateLicenseAssessment = fieldsValues.includes(AssessmentCategories.LICENSE.toLowerCase());
    const shouldCalculateHostOsPatchAssessment = fieldsValues.includes(
        AssessmentCategories.HOST_OS_PATCH.toLowerCase()
    );
    const shouldCalculateRssConfigAssessment = fieldsValues.includes(AssessmentCategories.RSS_CONFIG.toLowerCase());
    const shouldCalculateMaxDOPAssessment = fieldsValues.includes(AssessmentCategories.MAXDOP.toLowerCase());
    const shouldCalculateMSSQLPatchAssessment = fieldsValues.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase());
    const shouldCalculateResilienceAssessment =
        fieldsValues.includes(AssessmentCategories.SNAPSHOT_POLICY.toLowerCase()) ||
        fieldsValues.includes(AssessmentCategories.AWS_BACKUP.toLowerCase()) ||
        fieldsValues.includes(AssessmentCategories.CRR.toLowerCase());
    const shouldCalculateCloneAssessment = fieldsValues.includes(AssessmentCategories.CLONE.toLowerCase());

    let driftAssessmentData: DriftAssessmentResponseType = {};

    const databaseInstanceConfigData = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    );
    // filter out the config data which is not required for assessment and listDatabaseInstanceConfigData returns in descending order of creation time
    const assessmentDataMap = databaseInstanceConfigData.reduce((acc, config) => {
        if (!acc[config.config_data_type]) {
            acc[config.config_data_type] = config.config_data;
        }
        return acc;
    }, {} as Record<string, unknown>);

    const storageAssessmentData = assessmentDataMap[AssessmentCategories.STORAGE];
    const maxDOPAssessmentData = assessmentDataMap[AssessmentCategories.MAXDOP];
    const cloneAssessmentData = assessmentDataMap[AssessmentCategories.CLONE];

    const [
        storageAssessmentResponse,
        maxDOPResponse,
        cloneResponse,
        {
            computeAssessmentResponse,
            licenseAssessmentResponse,
            hostOsPatchAssessmentResponse,
            rssConfigResponse,
            mssqlPatchAssessmentResponse
        },
        resilienceAssessmentResponse
    ] = await Promise.all([
        shouldCalculateStorageAssessment
            ? calculateStorageDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  storageAssessmentData as unknown as StorageAssessment
              )
            : Promise.resolve({} as StorageParameterDriftResponseType),
        shouldCalculateMaxDOPAssessment
            ? calculateMaxDOPDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  maxDOPAssessmentData as unknown as MaxDOPAssesment
              )
            : Promise.resolve({}),
        shouldCalculateCloneAssessment
            ? calculateCloneDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  cloneAssessmentData as unknown as CloneAssessment
              )
            : Promise.resolve({} as CloneDriftResponseType),
        shouldCalculateComputeAssessment ||
        shouldCalculateLicenseAssessment ||
        shouldCalculateHostOsPatchAssessment ||
        shouldCalculateRssConfigAssessment ||
        shouldCalculateMSSQLPatchAssessment
            ? hostLevelDriftData(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  resourceMetadata as unknown as Metadata,
                  fieldsValues
              )
            : Promise.resolve({
                  computeAssessmentResponse: {} as ComputeDriftResponseType,
                  licenseAssessmentResponse: {} as LicenseDriftResponseType,
                  hostOsPatchAssessmentResponse: {} as HostOsPatchDriftResponseType,
                  rssConfigResponse: {} as RssConfigDriftResponseType,
                  mssqlPatchAssessmentResponse: {} as MSSQLPatchDriftResponseType
              }),
        shouldCalculateResilienceAssessment
            ? getResilienceDriftAssessment(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  fieldsValues,
                  databaseInstanceConfigData
              )
            : Promise.resolve({})
    ]);

    if (!isEmpty(storageAssessmentResponse) && !('errorMessage' in storageAssessmentResponse)) {
        if (isDemoFlow) {
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;
            const storageConfigsOptimized =
                (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
            const osConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.OS || [];
            const sizingConfigsOptimized =
                (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.SIZING || [];

            if (storageConfigsOptimized.length > 0) {
                const optimizeConfig = (configArray: ParameterDriftResponseType[], optimizedConfigs: string[]) =>
                    configArray.map(config => {
                        if (optimizedConfigs.includes(config.name)) {
                            config.status = AssessmentStatus.OPTIMIZED;
                            config.objectsInViolation = [];
                        }
                        return config;
                    });

                storageAssessmentResponse.configuration.volumes = optimizeConfig(
                    storageAssessmentResponse.configuration.volumes as ParameterDriftResponseType[],
                    storageConfigsOptimized
                );

                storageAssessmentResponse.configuration.luns = optimizeConfig(
                    storageAssessmentResponse.configuration.luns as ParameterDriftResponseType[],
                    storageConfigsOptimized
                );
            }
            if (osConfigsOptimized.length > 0) {
                storageAssessmentResponse.configuration.os = storageAssessmentResponse.configuration.os.map(
                    osConfig => {
                        const os = osConfig as ParameterDriftResponseType;
                        if (osConfigsOptimized.includes(os.name)) {
                            os.status = AssessmentStatus.OPTIMIZED;
                        }
                        return os;
                    }
                );
            }
            if (sizingConfigsOptimized.length > 0) {
                storageAssessmentResponse.sizing = storageAssessmentResponse.sizing.map(sizingConfig => {
                    const sizing = sizingConfig as ParameterDriftResponseType;
                    if (sizingConfigsOptimized.includes(sizing.name)) {
                        sizing.status = AssessmentStatus.OPTIMIZED;
                        sizing.objectsInViolation = [];
                        sizing.totalObjectsInViolation = 0;
                    }
                    return sizing;
                });
            }
        }

        driftAssessmentData.storage = storageAssessmentResponse;
    }

    if (!isEmpty(computeAssessmentResponse)) {
        driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
        if (isDemoFlow) {
            const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId)) || [];
            const computeConfigsOptimized = (metadata as unknown as Metadata).isComputeOptimized;
            if (computeConfigsOptimized) {
                computeAssessmentResponse.status = AssessmentStatus.OPTIMIZED;
                computeAssessmentResponse.recommendation = 'Optimized instance for your workload.';
                driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
            }
        }
    }

    if (!isEmpty(licenseAssessmentResponse)) {
        driftAssessmentData.license = licenseAssessmentResponse as LicenseDriftResponseType;
        if (isDemoFlow) {
            const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId)) || [];
            const licenseConfigsOptimized = (metadata as unknown as Metadata).isLicenseOptimized;
            if (licenseConfigsOptimized) {
                licenseAssessmentResponse.status = AssessmentStatus.OPTIMIZED;
                licenseAssessmentResponse.recommendation = 'Your current SQL license is optimized for your workload.';
                driftAssessmentData.license = licenseAssessmentResponse as LicenseDriftResponseType;
            }
        }
    }

    if (!isEmpty(hostOsPatchAssessmentResponse)) {
        driftAssessmentData.hostOsPatch = hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType;
        if (isDemoFlow) {
            const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId)) || [];
            const hostOsPatchOptimized = (metadata as unknown as Metadata).isHostOsPatchOptimized;
            if (hostOsPatchOptimized) {
                hostOsPatchAssessmentResponse.status = AssessmentStatus.OPTIMIZED;
                hostOsPatchAssessmentResponse.recommendation =
                    'Your current windows host is optimized with security best practices.';
                driftAssessmentData.hostOsPatch = hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType;
            }
        }
    }

    if (!isEmpty(rssConfigResponse)) {
        driftAssessmentData.rssConfig = rssConfigResponse as RssConfigDriftResponseType;
    }

    if (!isEmpty(maxDOPResponse)) {
        driftAssessmentData.maxDOP = maxDOPResponse as ParameterDriftResponseType; // check this type
    }

    if (!isEmpty(mssqlPatchAssessmentResponse)) {
        driftAssessmentData.mssqlPatch = mssqlPatchAssessmentResponse as MSSQLPatchDriftResponseType;
    }

    if (!isEmpty(resilienceAssessmentResponse)) {
        driftAssessmentData = { ...driftAssessmentData, ...resilienceAssessmentResponse };
    }

    if (!isEmpty(cloneResponse) && !('errorMessage' in cloneResponse)) {
        if (isDemoFlow) {
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;
            const { oldCloneDetails = [], cloneDetails = [] } = cloneResponse;
            const cloneConfigsOptimized = (instanceMetadata as DatabaseInstanceMetadata)?.configsOptimized?.CLONE || [];

            if (cloneConfigsOptimized.length > 0) {
                // Destructure cloneDatabaseName from each optimized config
                const cloneDatabaseNamesToRemove = new Set(
                    (cloneConfigsOptimized as CloneDetail[]).map(({ cloneDatabaseName }) => cloneDatabaseName)
                );

                // Filter out optimized clones from oldCloneDetails
                const filteredOldCloneDetails = oldCloneDetails.filter(
                    ({ cloneDatabaseName }) => !cloneDatabaseNamesToRemove.has(cloneDatabaseName)
                );

                const totalObjectsInViolation = filteredOldCloneDetails.length;
                const objectsInViolation = filteredOldCloneDetails.map(
                    ({ cloneDatabaseName }) => cloneDatabaseName as string
                );
                const status =
                    totalObjectsInViolation === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
                const cloneDriftMessage = `${filteredOldCloneDetails.length} out of ${cloneDetails.length} clones are old and divergent`;

                cloneResponse.oldCloneDetails = filteredOldCloneDetails;
                cloneResponse.totalObjectsInViolation = totalObjectsInViolation;
                cloneResponse.status = status;
                cloneResponse.objectsInViolation = objectsInViolation;
                cloneResponse.cloneDriftMessage = cloneDriftMessage;
            }
        }
        driftAssessmentData.clone = cloneResponse as CloneDriftResponseType;
    }

    if (!isEmpty(dismissedConfigurations)) {
        driftAssessmentData.dismissedConfigurations = dismissedConfigurations;
    }
    // Get last assessed timestamp
    try {
        const [{ creation_time: latestInstanceLevelAssessedTime = 0 } = {}] = databaseInstanceConfigData;
        const { assessment: { lastAssessedDate: latestHostLevelAssessedTime } = {} } =
            resourceMetadata as unknown as Metadata;
        const latestAssessmentTimestamp = Math.max(
            latestInstanceLevelAssessedTime ? latestInstanceLevelAssessedTime.getTime() : 0,
            latestHostLevelAssessedTime ? Number(latestHostLevelAssessedTime) : 0
        );
        driftAssessmentData.lastAssessmentTimestamp = moment(Number(latestAssessmentTimestamp)).unix() * 1000;
    } catch (error) {
        logger.error('Error while fetching last assessment timestamp:', error);
    }

    driftAssessmentData.fileSystemId = fileSystemId;
    driftAssessmentData.databaseInstanceName = databaseInstanceName;
    driftAssessmentData.ec2InstanceId = (resourceMetadata as unknown as Metadata)?.node1InstanceId;
    return driftAssessmentData;
}

async function fetchDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    fields?: string,
    resourceDetail?: ResourceDetails
) {
    logger.info('Fetching drift assessment per host', { accountId, credentialsId, region, databaseHostId, fields });

    if (isEmpty(resourceDetail)) {
        ({
            items: [resourceDetail]
        } = await getResources(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            undefined,
            undefined,
            undefined,
            true
        ));
    }
    if (isEmpty(resourceDetail)) {
        const infoMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    const instancesManaged = resourceDetail?.database_instances || [];
    logger.debug('Instances managed:', instancesManaged);

    if (isEmpty(instancesManaged)) {
        const infoMessage = `No managed instances found for account ${accountId} and host ${databaseHostId}.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    let { resource_name: databaseHostName, metadata } = resourceDetail;
    databaseHostName ||= '';

    const driftAssessments: Array<{
        databaseInstanceId: string;
        databaseInstanceName: string;
        assessments?: DriftAssessmentResponseType;
        error?: string;
    }> = [];

    const fieldsList = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');

    let computeAssessmentResponse: ComputeDriftResponseType;
    let licenseAssessmentResponse: LicenseDriftResponseType;
    let hostOsPatchAssessmentResponse: HostOsPatchDriftResponseType;
    let hostRssConfigAssessmentResponse: RssConfigDriftResponseType;
    let mssqlPatchAssessmentResponse: MSSQLPatchDriftResponseType;

    const isHostLevelMetrics =
        isEmpty(fieldsList) ||
        fieldsList?.includes(AssessmentCategories.COMPUTE) ||
        fieldsList?.includes(AssessmentCategories.LICENSE) ||
        fieldsList?.includes(AssessmentCategories.HOST_OS_PATCH) ||
        fieldsList?.includes(AssessmentCategories.RSS_CONFIG) ||
        fieldsList?.includes(AssessmentCategories.MSSQL_PATCH); // if fields are not provided or if any of the fields are provided then fetch respective fields or all fields metrics
    if (isHostLevelMetrics) {
        let hostFieldsToQuery = [];
        if (isEmpty(fieldsList)) {
            hostFieldsToQuery = [
                AssessmentCategories.COMPUTE,
                AssessmentCategories.LICENSE,
                AssessmentCategories.HOST_OS_PATCH,
                AssessmentCategories.RSS_CONFIG,
                AssessmentCategories.MSSQL_PATCH
            ];
        } else {
            if (fieldsList?.includes(AssessmentCategories.COMPUTE)) {
                hostFieldsToQuery.push(AssessmentCategories.COMPUTE);
            }
            if (fieldsList?.includes(AssessmentCategories.LICENSE)) {
                hostFieldsToQuery.push(AssessmentCategories.LICENSE);
            }
            if (fieldsList?.includes(AssessmentCategories.HOST_OS_PATCH)) {
                hostFieldsToQuery.push(AssessmentCategories.HOST_OS_PATCH);
            }
            if (fieldsList?.includes(AssessmentCategories.RSS_CONFIG)) {
                hostFieldsToQuery.push(AssessmentCategories.RSS_CONFIG);
            }
            if (fieldsList?.includes(AssessmentCategories.MSSQL_PATCH)) {
                hostFieldsToQuery.push(AssessmentCategories.MSSQL_PATCH);
            }
        }

        const [{ database_instance_id: databaseInstanceId }] = instancesManaged; // get the first instance id to fetch the host level metrics as the host level metrics are same for all the instances
        const hostLevelData = await hostLevelDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            metadata as unknown as Metadata,
            hostFieldsToQuery
        );
        computeAssessmentResponse = hostLevelData.computeAssessmentResponse as ComputeDriftResponseType;
        licenseAssessmentResponse = hostLevelData.licenseAssessmentResponse as LicenseDriftResponseType;
        hostOsPatchAssessmentResponse = hostLevelData.hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType;
        hostRssConfigAssessmentResponse = hostLevelData.rssConfigResponse as RssConfigDriftResponseType;
        mssqlPatchAssessmentResponse = hostLevelData.mssqlPatchAssessmentResponse as MSSQLPatchDriftResponseType;
    }
    await Promise.all(
        instancesManaged.map(
            throat(3, async managedInstance => {
                const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                    managedInstance;

                try {
                    // For instance level assessments
                    const instanceFieldsToQuery = [
                        AssessmentCategories.STORAGE,
                        AssessmentCategories.MAXDOP,
                        AssessmentCategories.SNAPSHOT_POLICY,
                        AssessmentCategories.AWS_BACKUP,
                        AssessmentCategories.CRR,
                        AssessmentCategories.CLONE
                    ];

                    const driftAssessment = await fetchDriftAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        instanceFieldsToQuery.join(','),
                        { ...managedInstance, resource: resourceDetail } as DatabaseInstancesIncludingResource
                    );

                    if (isHostLevelMetrics) {
                        if (!isEmpty(computeAssessmentResponse)) {
                            driftAssessment.compute = computeAssessmentResponse;
                        }
                        if (!isEmpty(licenseAssessmentResponse)) {
                            driftAssessment.license = licenseAssessmentResponse;
                        }
                        if (!isEmpty(hostOsPatchAssessmentResponse)) {
                            driftAssessment.hostOsPatch = hostOsPatchAssessmentResponse;
                        }
                        if (!isEmpty(hostRssConfigAssessmentResponse)) {
                            driftAssessment.rssConfig = hostRssConfigAssessmentResponse;
                        }
                        if (!isEmpty(mssqlPatchAssessmentResponse)) {
                            driftAssessment.mssqlPatch = mssqlPatchAssessmentResponse;
                        }
                    }

                    driftAssessments.push({
                        databaseInstanceId,
                        databaseInstanceName,
                        assessments: driftAssessment
                    });
                } catch (error: any) {
                    const errorMessage = `Error while fetching drift assessment for ${databaseInstanceId}. Error: ${error.message}`;
                    logger.error(errorMessage);
                    driftAssessments.push({ databaseInstanceId, databaseInstanceName, error: errorMessage });
                }
            })
        )
    );

    return {
        databaseHostId,
        databaseHostName,
        instancesAssessment: driftAssessments
    };
}

async function handleAssessment(
    accountId: string,
    managedInstance: DatabaseInstancesIncludingResource,
    masterAssessmentJobId: string,
    initiatedBy: string,
    fields?: string
) {
    let jobStatus = '';
    try {
        await triggerAssessment(managedInstance, masterAssessmentJobId, fields);
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        logger.error(`Error while fetching database instance details ${accountId}, ${error}`);
    } finally {
        jobStatus = jobStatus || JOBSTATUS.COMPLETED;
        // If the masterAssessmentJobId failed, we don't want to overwrite the master assessment status
        await updateParentJobStatus(accountId, masterAssessmentJobId);
        // Lets update assessment result in instance metadata
        await updateAssesmentResultsInInstanceMetadata(managedInstance);
    }
    if (initiatedBy === AssessmentTriggeredBy.USER) {
        const auditStatus = jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED;
        updateLongRunningAuditGroup(auditStatus);
    }
}

async function onDemandTriggerDriftAssessmentDataCollection(
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
        const savedInstanceName = `${resourceName}\\${instanceName}`;
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
        // Call the async function without awaiting it
        handleAssessment(accountId, managedInstance, jobId, initiatedBy, fields);

        return { jobId };
    } catch (error: any) {
        const errorMessage = `Error while triggering drift assessment for account ${accountId}, host ${databaseHostId}, instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMessage);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function fetchDriftAssessmentPerAccount(
    accountId: string,
    credentialsId: string,
    region: string,
    fields?: string,
    nextToken?: string,
    pageSize?: number
) {
    logger.info('Fetching drift assessment per account', {
        accountId,
        credentialsId,
        region,
        fields,
        nextToken,
        pageSize
    });

    pageSize = pageSize || 50;

    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        undefined,
        pageSize,
        nextToken,
        true
    );
    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId} in region ${region}.`);
        return { count: 0, assessmentsPerAccount: [], nextToken: '' };
    }
    const driftAssessmentPerAccount: Array<{
        databaseHostId: string;
        databaseHostName: string;
        instancesAssessment: Array<{
            databaseInstanceId: string;
            databaseInstanceName: string;
            assessments?: DriftAssessmentResponseType;
            error?: string;
        }>;
    }> = [];
    await Promise.all(
        resourceDetails.map(
            throat(3, async resourceDetail => {
                const { resource_id: databaseHostId } = resourceDetail;
                try {
                    const drifAssessmentPerHost = await fetchDriftAssessmentPerHost(
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
        nextToken: resourceDetails?.length === pageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
}

// Recursive function to check for any "not-optimized" status in the assessment results.
// It checks both arrays and objects, looking for the specific status in any nested structure.
// Returns true if any "not-optimized" status is found, otherwise false.
// This is used to determine if an instance has any assessment results that are not optimized.
function hasNotOptimizedStatus(obj: any): boolean {
    if (Array.isArray(obj)) {
        return obj.some(hasNotOptimizedStatus);
    }
    if (obj && typeof obj === 'object') {
        if (obj.status === AssessmentStatus.NOT_OPTIMIZED) {
            return true;
        }
        return Object.values(obj).some(hasNotOptimizedStatus);
    }
    return false;
}

/**
 * Processes well-architected assessment notifications for all managed Microsoft SQL Server instances.
 *
 * Logic Overview:
 * 1. Fetch all managed MSSQL database instances.
 * 2. Group instances by their account ID.
 * 3. For each account:
 *    a. Check if the account has any active notification channels (using getChannels).
 *    b. If no active channel or error, skip processing for that account.
 *    c. If active, process each managed instance in parallel (throttled to 3 at a time):
 *       - Analyze the assessment results for each instance to determine if it is "well-architected" or "not optimized".
 *       - Build an account-level summary (wellArchitectedCount, notOptimizedCount, and instance details).
 * 4. After all accounts are processed, build notification messages for each instance in each account,
 *    including subject and body with summary counts.
 * 5. Send notifications for all instances, throttled to 3 concurrent sends at a time, with error handling for each send.
 *
 * Performance & Reliability:
 * - Uses throttling (via throat) to avoid overloading downstream APIs.
 * - Handles errors gracefully at each step, so one account or notification failure does not affect others.
 * - Skips accounts with no managed instances or no active notification channels.
 * - Splits logic into small, maintainable functions for clarity.
 */

async function processWellArchitectedAssessmentNotifications(initiatedBy: string) {
    logger.info('Processing well-architected assessment notifications', { initiatedBy });

    // Hash map to store per-account assessment summary
    const accountAssessmentMap: Record<string, AccountAssessmentSummary> = {};

    try {
        const allManagedInstances = (await listAllManagedInstances(undefined, {
            databaseType: DatabaseTypes.MS_SQL_SERVER
        })) as DatabaseInstancesIncludingResource[];
        if (isEmpty(allManagedInstances)) {
            logger.info('No successfully managed database instances found.');
            return;
        }

        // Group managed instances by account_id
        const managedInstancesGroupedByAccountId = allManagedInstances.reduce(
            (acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
                const key = `${managedInstance.account_id}`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(managedInstance);
                return acc;
            },
            {}
        );

        // Process all accounts in parallel (with concurrency limit) only for the accounts that have active notification channels
        await Promise.all(
            Object.entries(managedInstancesGroupedByAccountId).map(
                throat(3, async ([accountId, managedInstances]) => {
                    try {
                        const summary = await processAccountInstances(accountId, managedInstances);
                        if (summary) {
                            accountAssessmentMap[accountId] = summary;
                        }
                    } catch (err) {
                        logger.error(`Skipping account ${accountId} due to error processing instances.`, err);
                    }
                })
            )
        );

        // Send notifications after processing all instances
        await buildAndSendNotifications(accountAssessmentMap);
    } catch (error) {
        logger.error('Error processing well-architected assessment notifications:', error);
    }
}

// Standalone function to process all managed instances for an account and return the summary
async function processAccountInstances(
    accountId: string,
    managedInstances: DatabaseInstancesIncludingResource[]
): Promise<AccountAssessmentSummary | undefined> {
    if (isEmpty(managedInstances)) {
        logger.info(`No managed instances found for account ${accountId}.`);
        return undefined;
    }

    const summary: AccountAssessmentSummary = {
        wellArchitectedCount: 0,
        notOptimizedCount: 0,
        instances: []
    };

    await Promise.all(
        managedInstances.map(
            throat(3, async managedInstance => {
                try {
                    const {
                        resource_id: resourceId,
                        database_instance_id: databaseInstanceId,
                        metadata
                    } = managedInstance;
                    let assessmentResults: any | undefined;
                    if (
                        metadata &&
                        typeof metadata === 'object' &&
                        !Array.isArray(metadata) &&
                        'assessmentResults' in metadata
                    ) {
                        assessmentResults = (metadata as { assessmentResults?: any }).assessmentResults;
                    }
                    if (!assessmentResults) {
                        return;
                    }

                    const notOptimized = hasNotOptimizedStatus(assessmentResults);

                    summary.instances.push({
                        resourceId,
                        databaseInstanceId,
                        notOptimized
                        // details: assessmentResults // can have this later on for future references
                    });

                    if (notOptimized) {
                        summary.notOptimizedCount += 1;
                    } else {
                        summary.wellArchitectedCount += 1;
                    }
                } catch (error) {
                    logger.error(`Error processing managed instance ${managedInstance?.resource_id}:`, error);
                }
            })
        )
    );

    return summary;
}

// Helper to build notification data for all accounts and instances
function buildNotificationsToSend(
    accountAssessmentMap: Record<string, AccountAssessmentSummary>
): Array<{ accountId: string; notificationData: NotificationData }> {
    const notificationsToSend: Array<{ accountId: string; notificationData: NotificationData }> = [];

    for (const [accountId, summary] of Object.entries(accountAssessmentMap)) {
        const { wellArchitectedCount, notOptimizedCount } = summary;
        const total = wellArchitectedCount + notOptimizedCount;
        const subject = `${notOptimizedCount}/${total} instances in your account aren’t well-architected`;
        const body = `All Microsoft SQL Server instances in your account ${accountId} have been analyzed for well-architected issues. Well-architected instances: ${wellArchitectedCount}, Not optimized instances: ${notOptimizedCount}. Review well-architected status findings and recommendations in the Databases inventory from the Workload Factory console.`;

        notificationsToSend.push({
            accountId,
            notificationData: {
                content: body,
                subject,
                resourceType: 'Microsoft SQL Server instance',
                resourceId: accountId,
                priority: WF_NOTIFICATION_PRIORITY.WF_RECOMMENDATION,
                resourceName: accountId,
                notificationType: NOTIFICATION_TYPE.WELL_ARCHITECTED
            }
        });
    }

    return notificationsToSend;
}

async function buildAndSendNotifications(accountAssessmentMap: Record<string, AccountAssessmentSummary>) {
    const notificationsToSend = buildNotificationsToSend(accountAssessmentMap);

    await Promise.all(
        notificationsToSend.map(
            throat(3, async ({ accountId, notificationData }) => {
                try {
                    await prepareWFNotificationRequest(accountId, notificationData);
                } catch (error) {
                    logger.error(
                        `Failed to send notification for account ${accountId}, instance ${notificationData.resourceId}:`,
                        error
                    );
                }
            })
        )
    );
}

export {
    triggerDriftAssessmentDataCollection,
    fetchDriftAssessment,
    driftAssessmentDataCollection,
    getFsxStorageDetails,
    onDemandTriggerDriftAssessmentDataCollection,
    fetchDriftAssessmentPerHost,
    calculateComputeDrift,
    fetchDriftAssessmentPerAccount,
    initiateStorageAssessmentCollection,
    processWellArchitectedAssessmentNotifications
};
