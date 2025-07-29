import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import moment from 'moment';
import throat from 'throat';
import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import getLogger from '../../../utils/logger';
import { extractSqlInstanceName, isDemo } from '../../../utils/utils';
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
    DatabaseInstanceConfigurations,
    DatabaseInstanceDismissConfigs,
    DatabaseInstancesIncludingResource,
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
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES
} from '../../../utils/consts';
import {
    AssessmentCategories,
    AssessmentStatus,
    AssessmentTriggeredBy
} from '../../../utils/continous-optimization-consts';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { calculateComputeDrift, managedHostsComputeAssessment } from '../compute-assessment-operations';
import { calculateHostOsPatchDrift, managedHostOsPatchAssessment } from './hostOsPatch-assessment-operations';
import { calculateLicenseDrift, managedHostsLicenseAssessment } from './license-assessment-operations';
import { calculateMSSQLPatchDrift, managedHostMSSQLPatchAssessment } from './mssqlPatch-assessment-operations';
import { calculateRssConfigDrift, managedHostsRssConfigAssessment } from './rssConfig-assessment-operations';
import { describeFSxStorageVirtualMachines } from '../../../lib/aws/fsx';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../../lib/database/database-instance-config';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
import { registerJob, updateParentJobStatus } from '../../database/job-operations';
import { calculateCloneDrift, managedHostsCloneAssessment } from './clone-assessment-operations';
import { calculateMaxDOPDrift, managedHostsMaxDOPAssessment } from './maxdop-assessment-operations';
import {
    initiateCrossRegionResiliencyAssessment,
    initiateAWSBackupAssessment,
    getResilienceDriftAssessment,
    initiateInstanceLevelHighAvailabilityAssessment,
    initiateHostLevelHighAvailabilityAssessment
} from './resilience-assessment-operation';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { getInstanceDetails } from '../../database-hosts-operations';
import { checkAndUpdatePostponedEndTime, updateFieldsBasedOnDismissedConfigurations } from '../assessment-utils';
import { listResources } from '../../../lib/database/db';
import {
    ComputeDriftResponseType,
    LicenseDriftResponseType,
    HostOsPatchDriftResponseType,
    RssConfigDriftResponseType,
    MSSQLPatchDriftResponseType,
    DriftAssessmentResponseType,
    StorageParameterDriftResponseType,
    ParameterDriftResponseType,
    DriftAssessmentResponsePerHostType
} from '../../../routes/types/continuous-optimization.types';
import { calculateStorageDrift, initiateStorageAssessmentCollection } from './storage-assessment-operations';
import { handleGetAssessmentForDemo } from '../../demo-operations';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../../utils/database-consts';

const isDemoFlow = isDemo();
const logger = getLogger();

function hostLevelDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    metadata: Metadata,
    hostLevelAssessmentData: ResourceAssessmentData,
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

    const assessmentFlags = {
        compute: fieldsValues?.includes(AssessmentCategories.COMPUTE.toLowerCase()),
        license: fieldsValues?.includes(AssessmentCategories.LICENSE.toLowerCase()),
        hostOsPatch: fieldsValues?.includes(AssessmentCategories.HOST_OS_PATCH.toLowerCase()),
        rssConfig: fieldsValues?.includes(AssessmentCategories.RSS_CONFIG.toLowerCase()),
        mssqlPatch: fieldsValues?.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase()),
        highAvailability: fieldsValues?.includes(AssessmentCategories.HIGH_AVAILABILITY.toLowerCase())
    };

    const [
        computeAssessmentResponse,
        licenseAssessmentResponse,
        hostOsPatchAssessmentResponse,
        rssConfigResponse,
        mssqlPatchAssessmentResponse
    ] = [
        assessmentFlags.compute
            ? calculateComputeDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  hostLevelAssessmentData
              )
            : {},
        assessmentFlags.license
            ? calculateLicenseDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  hostLevelAssessmentData
              )
            : {},
        assessmentFlags.hostOsPatch
            ? calculateHostOsPatchDrift(accountId, credentialsId, region, databaseHostId, hostLevelAssessmentData)
            : {},
        assessmentFlags.rssConfig
            ? calculateRssConfigDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  metadata as Metadata,
                  hostLevelAssessmentData
              )
            : {},
        assessmentFlags.mssqlPatch
            ? calculateMSSQLPatchDrift(accountId, credentialsId, region, databaseHostId, hostLevelAssessmentData)
            : {}
    ];

    const result = {
        compute: !isEmpty(computeAssessmentResponse)
            ? (computeAssessmentResponse as ComputeDriftResponseType)
            : undefined,
        license: !isEmpty(licenseAssessmentResponse)
            ? (licenseAssessmentResponse as LicenseDriftResponseType)
            : undefined,
        hostOsPatch: !isEmpty(hostOsPatchAssessmentResponse)
            ? (hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType)
            : undefined,
        rssConfig: !isEmpty(rssConfigResponse) ? (rssConfigResponse as RssConfigDriftResponseType) : undefined,
        mssqlPatch: !isEmpty(mssqlPatchAssessmentResponse)
            ? (mssqlPatchAssessmentResponse as MSSQLPatchDriftResponseType)
            : undefined
    };

    return result;
}

async function fetchMssqlDriftAssessment(
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

    const dismissedConfigurations = {
        ...(instanceConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations,
        ...(hostConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations
    };

    let fieldsValues = (
        fields?.toLowerCase().replace(/\s+/g, '').split(',') ||
        Object.values(AssessmentCategories).map(category => category.toLowerCase())
    ).filter(
        field =>
            !(
                databaseDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT &&
                field === AssessmentCategories.HIGH_AVAILABILITY.toLowerCase()
            )
    );

    if (!isEmpty(dismissedConfigurations)) {
        fieldsValues = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);
    }

    const assessmentFlags = {
        storage: fieldsValues.includes(AssessmentCategories.STORAGE.toLowerCase()),
        compute: fieldsValues.includes(AssessmentCategories.COMPUTE.toLowerCase()),
        license: fieldsValues.includes(AssessmentCategories.LICENSE.toLowerCase()),
        hostOsPatch: fieldsValues.includes(AssessmentCategories.HOST_OS_PATCH.toLowerCase()),
        rssConfig: fieldsValues.includes(AssessmentCategories.RSS_CONFIG.toLowerCase()),
        maxDOP: fieldsValues.includes(AssessmentCategories.MAXDOP.toLowerCase()),
        mssqlPatch: fieldsValues.includes(AssessmentCategories.MSSQL_PATCH.toLowerCase()),
        resilience: [
            AssessmentCategories.SNAPSHOT_POLICY,
            AssessmentCategories.AWS_BACKUP,
            AssessmentCategories.CRR,
            AssessmentCategories.HIGH_AVAILABILITY
        ].some(category => fieldsValues.includes(category.toLowerCase())),
        clone: fieldsValues.includes(AssessmentCategories.CLONE.toLowerCase())
    };

    const databaseInstanceConfigData = await listDatabaseInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId
    });

    const assessmentDataMap = databaseInstanceConfigData.reduce(
        (acc: Record<string, unknown>, config: { config_data_type: string; config_data: unknown }) => {
            acc[config.config_data_type] = acc[config.config_data_type] || config.config_data;
            return acc;
        },
        {} as Record<string, unknown>
    );

    const [storageAssessmentResponse, resilienceAssessmentResponse] = await Promise.all([
        assessmentFlags.storage
            ? calculateStorageDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.STORAGE] as StorageAssessment
              )
            : Promise.resolve({}),
        assessmentFlags.resilience
            ? getResilienceDriftAssessment(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  resourceName!,
                  databaseInstanceId,
                  databaseInstanceName,
                  fieldsValues,
                  hostLevelAssessmentData as ResourceAssessmentData,
                  databaseInstanceConfigData
              )
            : Promise.resolve({})
    ]);

    const [maxDOPResponse, cloneResponse, hostLevelData] = [
        assessmentFlags.maxDOP
            ? calculateMaxDOPDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.MAXDOP] as MaxDOPAssesment
              )
            : {},
        assessmentFlags.clone
            ? calculateCloneDrift(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  assessmentDataMap[AssessmentCategories.CLONE] as CloneAssessment
              )
            : {},
        assessmentFlags.compute ||
        assessmentFlags.license ||
        assessmentFlags.hostOsPatch ||
        assessmentFlags.mssqlPatch ||
        assessmentFlags.rssConfig
            ? hostLevelDriftData(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostId,
                  databaseInstanceId,
                  resourceMetadata as Metadata,
                  hostLevelAssessmentData as ResourceAssessmentData,
                  fieldsValues
              )
            : {}
    ];

    let driftAssessmentData: DriftAssessmentResponseType = {
        storage: !isEmpty(storageAssessmentResponse)
            ? (storageAssessmentResponse as StorageParameterDriftResponseType)
            : undefined,
        maxDOP: !isEmpty(maxDOPResponse) ? (maxDOPResponse as ParameterDriftResponseType) : undefined,
        clone: !isEmpty(cloneResponse) ? (cloneResponse as ParameterDriftResponseType) : undefined,
        ...(!isEmpty(hostLevelData) ? hostLevelData : undefined),
        ...resilienceAssessmentResponse,
        dismissedConfigurations,
        lastAssessmentTimestamp: (() => {
            try {
                const latestInstanceTime = databaseInstanceConfigData[0]?.creation_time?.getTime() || 0;
                const latestHostTime =
                    Number((hostLevelAssessmentData as ResourceAssessmentData).lastAssessedDate) || 0;
                return moment(Math.max(latestInstanceTime, latestHostTime)).unix() * 1000;
            } catch {
                return undefined;
            }
        })(),
        fileSystemId,
        databaseInstanceName,
        ec2InstanceId: (resourceMetadata as Metadata)?.node1InstanceId,
        deploymentType: databaseDeploymentType
    };

    if (isDemoFlow) {
        driftAssessmentData = handleGetAssessmentForDemo(accountId, instanceDetail, driftAssessmentData);
    }

    return driftAssessmentData;
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

    const fieldsList = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    const hostFieldsToQuery = isEmpty(fieldsList)
        ? Object.values(AssessmentCategories).filter(category => category !== AssessmentCategories.STORAGE)
        : (fieldsList ?? []).filter(field =>
              Object.values(AssessmentCategories).includes(field as AssessmentCategories)
          );

    let hostLevelData = {};
    if (!isEmpty(hostFieldsToQuery)) {
        const [{ database_instance_id: databaseInstanceId }] = instancesManaged;
        hostLevelData = hostLevelDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            metadata as Metadata,
            hostLevelAssessmentData as ResourceAssessmentData,
            hostFieldsToQuery
        );
    }

    const driftAssessments = await Promise.all(
        instancesManaged.map(
            throat(3, async instance => {
                const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                    instance;

                try {
                    const instanceFieldsToQuery = [
                        AssessmentCategories.STORAGE,
                        AssessmentCategories.MAXDOP,
                        AssessmentCategories.SNAPSHOT_POLICY,
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
                    return {
                        databaseInstanceId,
                        databaseInstanceName,
                        assessments: { ...driftAssessment, ...hostLevelData }
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

    const resourceDetails = await listResources({
        accountId,
        credentialIds: credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        pageSize,
        nextToken,
        includeDatabaseInstances: true,
        selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data', 'configurations']
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
        nextToken: resourceDetails?.length === pageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
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
    const { resource } = databaseInstanceObject as DatabaseInstance;
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
    if (fields?.includes(AssessmentCategories.HIGH_AVAILABILITY)) {
        const { clusterQuorum, heartbeat } =
            (await initiateHostLevelHighAvailabilityAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceRecord,
                jobId
            )) || {};
        highAvailabilityAssessment = { clusterQuorum, heartbeat };
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
        highAvailabilityAssessment
    ].some(item => !isEmpty(item));

    if (hasAssessmentOrError) {
        const existingAssessmentData = hostLevelAssessmentData as ResourceAssessmentData;

        const updatedAssessmentData = {
            license: licenseAssessment || (!licenseErrorMessage ? existingAssessmentData?.license : undefined),
            compute: computeAssessment || (!computeErrorMessage ? existingAssessmentData?.compute : undefined),
            hostOsPatch:
                hostOsPatchAssessment || (!hostOsPatchErrorMessage ? existingAssessmentData?.hostOsPatch : undefined),
            rssConfig: rssConfigAssessment || (!rssConfigErrorMessage ? existingAssessmentData?.rssConfig : undefined),
            mssqlPatch:
                mssqlPatchAssessment || (!mssqlPatchErrorMessage ? existingAssessmentData?.mssqlPatch : undefined),
            highAvailability: highAvailabilityAssessment,
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
            'license,compute,host-os-patch,rss-config,mssql-patch,high-availability',
            { ...(databaseInstanceObject as DatabaseInstance), resource }
        );

        await updateDatabaseHostAssessmentResults(accountId, credentialsId, region, databaseHostId, {
            license: assessmentResults.license,
            compute: assessmentResults.compute,
            hostOsPatch: assessmentResults.hostOsPatch,
            rssConfig: assessmentResults.rssConfig,
            mssqlPatch: assessmentResults.mssqlPatch,
            highAvailability: assessmentResults.highAvailability
        });
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
        isDemoFlow ? svm : svm?.StorageVirtualMachineId === databaseInstanceRecord.svmId
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

    const resourceWithInstanceName = `${databaseInstanceRecord.resourceName}\\${databaseInstanceRecord.name}`;
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

    logger.info('Triggering drift assessment', {
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

        const { dismissedInstanceConfigurations, dismissedHostConfigurations } = await checkAndUpdatePostponedEndTime(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            {
                instance: (instanceConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations,
                host: (hostConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations
            },
            databaseInstanceId
        );

        const dismissedConfigurations: DatabaseInstanceDismissConfigs = {
            ...dismissedInstanceConfigurations,
            ...dismissedHostConfigurations
        };

        const {
            database_instance_name: savedInstanceName,
            fsxn_ids: fileSystemId,
            fsx_svm_id: fsxSvmId,
            sqlAuthEnabled,
            database_deployment_type: deploymentType
        } = newDatabaseInstanceDetails;

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

        if (!isEmpty(dismissedConfigurations)) {
            fields = updateFieldsBasedOnDismissedConfigurations(fields, dismissedConfigurations);
        }

        if (
            deploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT &&
            fields.includes(AssessmentCategories.HIGH_AVAILABILITY)
        ) {
            logger.warn('High availabilty assessment is not supported on standalone instance.', {
                accountId,
                credentialsId,
                databaseHostId,
                databaseInstanceId
            });
            fields = fields.filter(e => e !== AssessmentCategories.HIGH_AVAILABILITY);
        }

        const shouldRunInstanceLevelAssessment = fields.some(field =>
            [
                AssessmentCategories.STORAGE,
                AssessmentCategories.SNAPSHOT_POLICY,
                AssessmentCategories.CRR,
                AssessmentCategories.AWS_BACKUP,
                AssessmentCategories.CLONE,
                AssessmentCategories.MAXDOP,
                AssessmentCategories.HIGH_AVAILABILITY
            ].includes(field.toLowerCase() as AssessmentCategories)
        );

        const shouldRunHostLevelAssessment = fields.some(field =>
            [
                AssessmentCategories.COMPUTE,
                AssessmentCategories.LICENSE,
                AssessmentCategories.HOST_OS_PATCH,
                AssessmentCategories.RSS_CONFIG,
                AssessmentCategories.MSSQL_PATCH,
                AssessmentCategories.HIGH_AVAILABILITY
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
        await updateAssessmentResultsInInstanceMetadata(managedInstance);
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
            driftAssessmentData
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

export {
    triggerMssqlAssessment,
    onDemandTriggerMssqlDriftAssessment,
    fetchMssqlDriftAssessment,
    fetchMssqlDriftAssessmentPerHost,
    fetchMssqlDriftAssessmentPerAccount,
    updateAssessmentResultsInInstanceMetadata
};
