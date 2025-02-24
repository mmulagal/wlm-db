import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import Promise from 'bluebird';
import getLogger from '../utils/logger';
import { isDemo, sqlResponseParsing } from '../utils/utils';
import { getFsxStorageDetails, getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/continuous-optimization-scripts';
import {
    DatabaseInstance,
    databaseInstanceMetadata,
    DatabaseInstancesIncludingResource,
    Metadata,
    StorageAssessment,
    WorkloadInstance
} from '../utils/common-types';
import {
    AuditStatus,
    ASSESSMENT_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    RESOURCESTYPE,
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES
} from '../utils/consts';
import { registerJob, updateJobDetails, updateParentJobStatus } from './database/job-operations';

import {
    listAllManagedInstances,
    listDatabaseInstances,
    listResources,
    updateResourceMetaData
} from '../lib/database/db';
import { AssessmentCategories, AssessmentStatus, AssessmentTriggeredBy } from '../utils/continous-optimization-consts';
import {
    ComputeDriftResponseType,
    DriftAssessmentResponseType,
    HostOsPatchDriftResponseType,
    LicenseDriftResponseType,
    MSSQLPatchDriftResponseType,
    ParameterDriftResponseType,
    ResilienceDriftAssessmentResponseType,
    RssConfigDriftResponseType
} from '../routes/types/continuous-optimization.types';
import { getInstanceInfo } from './database/database-operations';
import { createDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
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
import { getResilienceDriftAssessment } from './continuous-optimization/resilience-assessment-operation';

const isDemoFlow = isDemo();
const logger = getLogger();

async function initiateComputeLicenseAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string,
    jobId: string,
    fields: string[],
    databaseInstanceId?: string
) {
    logger.info('Initiate compute/license/host-os-patch assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName,
        jobId,
        fields,
        databaseInstanceId
    });

    const [{ metadata, cloud_provider_account_id: awsAccountId, resource_id: resourceId }] = await listResources(
        accountId,
        databaseHostId,
        credentialsId,
        region
    );
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { activeNodeInstanceId = '' } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        resourceId,
        accountId
    );
    if (metadata && activeNodeInstanceId) {
        let licenseAssessment;
        let computeAssessment;
        let hostOsPatchAssessment;
        let rssConfigAssessment;
        let maxDOPAssessment;
        let mssqlPatchAssessment;

        if (fields?.includes(AssessmentCategories.LICENSE)) {
            licenseAssessment = await managedHostsLicenseAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                jobId
            );
        }
        if (fields?.includes(AssessmentCategories.COMPUTE)) {
            computeAssessment = await managedHostsComputeAssessment(
                accountId,
                credentialsId,
                region,
                awsAccountId!,
                activeNodeInstanceId,
                resourceName,
                jobId
            );
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
            hostOsPatchAssessment = await managedHostOsPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                activeNodeInstanceId,
                !!node2InstanceId, // assumption: if both node1 and node2 instance ids are present, then it is a cluster
                resourceName,
                jobId
            );
        }
        if (fields?.includes(AssessmentCategories.RSS_CONFIG)) {
            rssConfigAssessment = await managedHostsRssConfigAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                jobId
            );
        }
        if (fields?.includes(AssessmentCategories.MAXDOP)) {
            // This will run instance level maxDOP assessment
            maxDOPAssessment = await managedHostsMaxDOPAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                databaseHostId,
                databaseInstanceId as string,
                jobId
            );
            if (!isEmpty(maxDOPAssessment)) {
                await createDatabaseInstanceConfigData([
                    {
                        account_id: accountId,
                        credentials_id: credentialsId,
                        region,
                        resource_id: databaseHostId,
                        database_instance_id: databaseInstanceId as string,
                        creation_time: new Date(Date.now()),
                        config_data_type: AssessmentCategories.MAXDOP,
                        config_data: maxDOPAssessment
                    }
                ]);
            }
        }
        if (fields?.includes(AssessmentCategories.MSSQL_PATCH)) {
            const isCluster = Boolean(node2InstanceId && node2InstanceId.trim() !== '');

            mssqlPatchAssessment = await managedHostMSSQLPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                activeNodeInstanceId,
                isCluster, // assumption: if both node1 and node2 instance ids are present, then it is a cluster
                resourceName,
                jobId
            );
        }
        if (
            !isEmpty(licenseAssessment) ||
            !isEmpty(computeAssessment) ||
            !isEmpty(hostOsPatchAssessment) ||
            !isEmpty(rssConfigAssessment) ||
            !isEmpty(mssqlPatchAssessment)
        ) {
            (metadata as unknown as Metadata).assessment = {
                license: licenseAssessment || undefined,
                compute: computeAssessment || undefined,
                hostOsPatch: hostOsPatchAssessment || undefined,
                rssConfig: rssConfigAssessment || undefined,
                mssqlPatch: mssqlPatchAssessment || undefined,
                lastAssessedDate: new Date().getTime().toString()
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
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
    jobId: string,
    instanceRecord: WorkloadInstance,
    jobTriggers: STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES = STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
) {
    logger.info('Initiating storage assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        instanceRecord
    });

    const instanceVolumeMapping = (await getMappedOntapVolumes(
        credentialsId,
        region,
        instanceRecord.fsxFileSystem,
        false,
        instanceRecord.activeNodeInstanceid,
        [instanceRecord.name],
        instanceRecord.sqlAuthEnabled,
        true
    )) as MappedOnTapVolumeResponse[];

    if (isEmpty(instanceVolumeMapping)) {
        const errorMessage = `No ONTAP volumes found for the instance ${instanceRecord.name}.`;
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
        ASSESSMENT_SSM_EXECUTION_TIMEOUT
    );

    const parsedResponse = response ? sqlResponseParsing(response) : {};
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

    const resourceWithInstanceName = `${instanceRecord.resourceName}\\${instanceRecord.name}`;
    const { volumes, luns, os, layout, sizing } = parsedResponse as unknown as StorageAssessment;
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
            parentJobId: jobId
        });
        await registerJob(accountId, credentialsId, region, {
            name: 'Storage layout assessment',
            description: 'Storage layout assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(layout) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
            type: JOBTYPE.ASSESSMENT,
            parentJobId: jobId
        });
        await registerJob(accountId, credentialsId, region, {
            name: 'Storage sizing assessment',
            description: 'Storage sizing assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(sizing) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
            type: JOBTYPE.ASSESSMENT,
            parentJobId: jobId
        });
    }

    if (
        jobTriggers.valueOf() === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH.valueOf() ||
        jobTriggers === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY.valueOf()
    ) {
        await registerJob(accountId, credentialsId, region, {
            name: 'Resiliency assessment',
            description: 'Snapshot policy assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: configJobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId: jobId
        });
    }
}

async function driftAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    fields?: string
) {
    logger.info('Drift assessment data collection', {
        accountId,
        credentialsId,
        region,
        jobId,
        databaseHostId,
        databaseInstanceRecord,
        fields
    });

    let shouldRunStorageAssessment = false;
    let shouldRunComputeAssessment = false;
    let shouldRunLicenseAssessment = false;
    let shouldRunHostOsPatchAssessment = false;
    let shouldRunRssConfigAssessment = false;
    let shouldRunMAXDOPAssessment = false;
    let shouldRunMSSQLPatchAssessment = false;
    let shouldRunResilienceAssessment = false;
    let fieldsValues: string | string[] = [];
    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
        shouldRunStorageAssessment =
            fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase()) ||
            fieldsValues?.includes(AssessmentCategories.RESILIENCY.toLocaleLowerCase()); // Resilience.snapshot-policy is calculated as part of storage assessment;
        shouldRunComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());
        shouldRunLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLocaleLowerCase());
        shouldRunHostOsPatchAssessment = fieldsValues?.includes(AssessmentCategories.HOST_OS_PATCH.toLocaleLowerCase());
        shouldRunRssConfigAssessment = fieldsValues?.includes(AssessmentCategories.RSS_CONFIG.toLocaleLowerCase());
        shouldRunMAXDOPAssessment = fieldsValues?.includes(AssessmentCategories.MAXDOP.toLocaleLowerCase());
        shouldRunMSSQLPatchAssessment = fieldsValues?.includes(AssessmentCategories.MSSQL_PATCH.toLocaleLowerCase());
        shouldRunResilienceAssessment = fieldsValues?.includes(AssessmentCategories.RESILIENCY.toLocaleLowerCase());
    } else {
        fieldsValues = Object.values(AssessmentCategories).map(category => category.toLowerCase());
        shouldRunStorageAssessment = true;
        shouldRunComputeAssessment = true;
        shouldRunLicenseAssessment = true;
        shouldRunHostOsPatchAssessment = true;
        shouldRunRssConfigAssessment = true;
        shouldRunMAXDOPAssessment = true;
        shouldRunMSSQLPatchAssessment = true;
        shouldRunResilienceAssessment = true;
    }

    if (shouldRunStorageAssessment || shouldRunResilienceAssessment) {
        await initiateStorageAssessmentCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            jobId,
            databaseInstanceRecord,
            !shouldRunResilienceAssessment
                ? STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.STORAGE
                : shouldRunStorageAssessment
                ? STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
                : STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY
        );
    }

    if (
        shouldRunComputeAssessment ||
        shouldRunLicenseAssessment ||
        shouldRunHostOsPatchAssessment ||
        shouldRunRssConfigAssessment ||
        shouldRunMAXDOPAssessment ||
        shouldRunMSSQLPatchAssessment
    ) {
        await initiateComputeLicenseAssessmentCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceRecord.resourceName,
            jobId,
            fieldsValues,
            databaseInstanceRecord.id
        );
    }
}

async function triggerAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields?: string,
    skipInstanceLevelJobCreation: boolean = false
) {
    logger.info('Triggering drift assessment ', { managedInstance, parentJobId, fields });

    let jobStatus: string = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId,
        database_instance_name: databaseInstanceName,
        resource
    } = managedInstance;

    const { resource_name: resourceName } = resource;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const instanceDetailsForJob = JSON.stringify({
        hostName: resourceName,
        resourceId: databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    });

    let activeNodeInstanceId;
    let newDatabaseInstanceDetails;
    let cloudProviderAccountId;

    try {
        const instanceDetails = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );

        activeNodeInstanceId = instanceDetails.activeNodeInstanceId;
        newDatabaseInstanceDetails = instanceDetails.newDatabaseInstanceDetails;
        cloudProviderAccountId = instanceDetails.cloudProviderAccountId;
    } catch (error) {
        errorMessage = `Error while fetching instance details: ${accountId} ${databaseInstanceId}. Error: ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    const jobName = `Microsoft SQL Server storage assessment for instance ${resourceWithInstanceName}`;
    const jobDescription = `${jobName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
    if (!skipInstanceLevelJobCreation) {
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: jobName,
            description: jobDescription,
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        parentJobId = jobId;
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
            resourceName: resource.resource_name || ''
        };
        await driftAssessmentDataCollection(
            accountId,
            credentialsId,
            region,
            parentJobId,
            databaseHostId,
            instanceRecord,
            fields
        );
    } catch (error: any) {
        logger.error(error);
        errorMessage = error.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            error: errorMessage,
            status: jobStatus,
            endTime: Date.now()
        });
    }
}

async function triggerDriftAssessmentDataCollection(initiatedBy: string, fields?: string) {
    logger.info('Trigger drift assessment per account', { initiatedBy });

    const allManagedInstances = (await listAllManagedInstances()) as DatabaseInstancesIncludingResource[];
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
        Object.entries(managedInstancesGroupedByAccountId).map(async ([accountId, managedInstances]) => {
            if (isEmpty(managedInstances)) {
                const errorMessage = `No managed instances found for account ${accountId}.`;
                logger.info(errorMessage);
            } else {
                const jobDescription = `Assess online SQL Server instances out of ${managedInstances.length} managed instances in your account ${accountId} for best practice misalignments.`;
                let parentJobStatus = '';
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
                try {
                    await Promise.all(
                        managedInstances.map(
                            async managedInstance => {
                                try {
                                    await triggerAssessment(managedInstance, parentJobId, fields);
                                } catch (error) {
                                    assessmentErrors.push(error);
                                }
                            },
                            {
                                concurrency: 1
                            }
                        )
                    );

                    if (assessmentErrors.length === managedInstances.length) {
                        const errorMessage = `No managed instance is up and running in account ${accountId}.`;
                        logger.info(errorMessage);
                        await updateJobDetails(accountId, parentJobId, {
                            status: JOBSTATUS.WARNING,
                            error: errorMessage,
                            endTime: Date.now()
                        });
                    } else {
                        // Proceeding with compute and license assessment at host level
                        const uniqueResMap = new Map(
                            managedInstances.map(({ resource }) => [
                                `${resource.account_id} + ${resource.credentials_id} + ${resource.id}`,
                                resource
                            ])
                        ); // create a map with unique resources; key being (accountId,credsId,resourceId unique combination) and value being actual resource
                        const uniqueResources = Array.from(uniqueResMap.values()); // getting all the unique resources from the map

                        await Promise.all(
                            uniqueResources.map(
                                async ({
                                    account_id: wfAccountId,
                                    credentials_id: credentialsId,
                                    region,
                                    resource_id: databaseHostId,
                                    resource_name: resourceName
                                }) => {
                                    await initiateComputeLicenseAssessmentCollection(
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
                                        ]
                                    );
                                }
                            )
                        );
                    }
                } catch (error: any) {
                    logger.info('Error while triggering drift assessment for account', { accountId, error });
                    parentJobStatus = JOBSTATUS.FAILED;
                    await updateJobDetails(accountId, parentJobId, {
                        status: parentJobStatus,
                        error: error.message,
                        endTime: Date.now()
                    });
                } finally {
                    if (parentJobStatus !== JOBSTATUS.FAILED) {
                        await updateParentJobStatus(accountId, parentJobId);
                    }
                }
            }
        })
    );
}

async function hostLevelDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetching host level drift data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    let shouldCalculateComputeAssessment = false;
    let shouldCalculateLicenseAssessment = false;
    let shouldCalculateHostOsPatchAssessment = false;
    let shouldCalculateRssConfigAssessment = false;
    let shouldCalculateMSSQLPatchAssessment = false;

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        const fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
        shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());
        shouldCalculateLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLocaleLowerCase());
        shouldCalculateHostOsPatchAssessment = fieldsValues?.includes(
            AssessmentCategories.HOST_OS_PATCH.toLocaleLowerCase()
        );
        shouldCalculateRssConfigAssessment = fieldsValues?.includes(
            AssessmentCategories.RSS_CONFIG.toLocaleLowerCase()
        );
        shouldCalculateMSSQLPatchAssessment = fieldsValues?.includes(
            AssessmentCategories.MSSQL_PATCH.toLocaleLowerCase()
        );
    } else {
        shouldCalculateComputeAssessment = true;
        shouldCalculateLicenseAssessment = true;
        shouldCalculateHostOsPatchAssessment = true;
        shouldCalculateRssConfigAssessment = true;
        shouldCalculateMSSQLPatchAssessment = true;
    }

    const [
        computeAssessmentResponse,
        licenseAssessmentResponse,
        hostOsPatchAssessmentResponse,
        rssConfigResponse,
        mssqlPatchAssessmentResponse
    ] = await Promise.all([
        shouldCalculateComputeAssessment
            ? calculateComputeDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateLicenseAssessment
            ? calculateLicenseDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateHostOsPatchAssessment
            ? calculateHostOsPatchDrift(accountId, credentialsId, region, databaseHostId)
            : Promise.resolve({}),
        shouldCalculateRssConfigAssessment
            ? calculateRssConfigDrift(accountId, credentialsId, region, databaseHostId)
            : Promise.resolve({}),
        shouldCalculateMSSQLPatchAssessment
            ? calculateMSSQLPatchDrift(accountId, credentialsId, region, databaseHostId)
            : Promise.resolve({})
    ]);

    return {
        computeAssessmentResponse,
        licenseAssessmentResponse,
        hostOsPatchAssessmentResponse,
        rssConfigResponse,
        mssqlPatchAssessmentResponse
    };
}

async function fetchDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetching drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    let shouldCalculateStorageAssessment = false;
    let shouldCalculateComputeAssessment = false;
    let shouldCalculateLicenseAssessment = false;
    let shouldCalculateHostOsPatchAssessment = false;
    let shouldCalculateRssConfigAssessment = false;
    let shouldCalculateMaxDOPAssessment = false;
    let shouldCalculateMSSQLPatchAssessment = false;
    let shouldCalculateResilienceAssessment = false;

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        const fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');

        shouldCalculateStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
        shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());
        shouldCalculateLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLocaleLowerCase());
        shouldCalculateHostOsPatchAssessment = fieldsValues?.includes(
            AssessmentCategories.HOST_OS_PATCH.toLocaleLowerCase()
        );
        shouldCalculateRssConfigAssessment = fieldsValues?.includes(
            AssessmentCategories.RSS_CONFIG.toLocaleLowerCase()
        );
        shouldCalculateMaxDOPAssessment = fieldsValues?.includes(AssessmentCategories.MAXDOP.toLocaleLowerCase());
        shouldCalculateMSSQLPatchAssessment = fieldsValues?.includes(
            AssessmentCategories.MSSQL_PATCH.toLocaleLowerCase()
        );
        shouldCalculateResilienceAssessment = fieldsValues?.includes(
            AssessmentCategories.RESILIENCY.toLocaleLowerCase()
        );
    } else {
        shouldCalculateStorageAssessment = true;
        shouldCalculateComputeAssessment = true;
        shouldCalculateLicenseAssessment = true;
        shouldCalculateHostOsPatchAssessment = true;
        shouldCalculateRssConfigAssessment = true;
        shouldCalculateMaxDOPAssessment = true;
        shouldCalculateMSSQLPatchAssessment = true;
        shouldCalculateResilienceAssessment = true;
    }
    const driftAssessmentData: DriftAssessmentResponseType = {};

    const [
        storageAssessmentResponse,
        maxDOPResponse,
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
            ? calculateStorageDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateMaxDOPAssessment
            ? calculateMaxDOPDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateComputeAssessment ||
        shouldCalculateLicenseAssessment ||
        shouldCalculateHostOsPatchAssessment ||
        shouldCalculateRssConfigAssessment ||
        shouldCalculateMSSQLPatchAssessment
            ? hostLevelDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId, fields)
            : Promise.resolve({}),
        shouldCalculateResilienceAssessment
            ? getResilienceDriftAssessment(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({})
    ]);

    if (!isEmpty(storageAssessmentResponse)) {
        if (isDemoFlow) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;
            const storageConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
            const osConfigsOptimized = (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.OS || [];
            const sizingConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.SIZING || [];

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
                computeAssessmentResponse.recommendation = 'Your current instance is optimized for your workload.';
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
        driftAssessmentData.resiliency = resilienceAssessmentResponse as ResilienceDriftAssessmentResponseType;
    }

    return driftAssessmentData;
}

async function fetchDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    fields?: string
) {
    logger.info('Fetching drift assessment per host', { accountId, credentialsId, region, databaseHostId, fields });

    const [resourceDetail] = await listResources(accountId, databaseHostId, credentialsId, region);

    if (isEmpty(resourceDetail)) {
        const infoMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    const instancesManaged = await listDatabaseInstances(accountId, {
        resourceId: databaseHostId,
        credentialsId,
        region
    });
    logger.debug('Instances managed:', instancesManaged);

    if (isEmpty(instancesManaged)) {
        const infoMessage = `No managed instances found for account ${accountId} and host ${databaseHostId}.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    let { resource_name: databaseHostName } = resourceDetail;
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
            hostFieldsToQuery.join(',')
        );
        computeAssessmentResponse = hostLevelData.computeAssessmentResponse as ComputeDriftResponseType;
        licenseAssessmentResponse = hostLevelData.licenseAssessmentResponse as LicenseDriftResponseType;
        hostOsPatchAssessmentResponse = hostLevelData.hostOsPatchAssessmentResponse as HostOsPatchDriftResponseType;
        hostRssConfigAssessmentResponse = hostLevelData.rssConfigResponse as RssConfigDriftResponseType;
        mssqlPatchAssessmentResponse = hostLevelData.mssqlPatchAssessmentResponse as MSSQLPatchDriftResponseType;
    }
    await Promise.all(
        instancesManaged.map(async managedInstance => {
            const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                managedInstance;

            try {
                const instanceFieldsToQuery = [AssessmentCategories.STORAGE, AssessmentCategories.MAXDOP];

                const driftAssessment = await fetchDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    instanceFieldsToQuery.join(',')
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
        await triggerAssessment(managedInstance, masterAssessmentJobId, fields, true);
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        await updateJobDetails(accountId, masterAssessmentJobId, {
            status: jobStatus,
            endTime: Date.now()
        });
        logger.error(`Error while fetching database instance details ${accountId}, ${error}`);
    } finally {
        jobStatus = jobStatus || JOBSTATUS.COMPLETED;
        if (jobStatus !== JOBSTATUS.FAILED) {
            // If the masterAssessmentJobId failed, we don't want to overwrite the master assessment status
            await updateParentJobStatus(accountId, masterAssessmentJobId);
        }
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

    const [managedInstance] = (await listDatabaseInstances(accountId, {
        credentialsId,
        region,
        resourceId: databaseHostId,
        sqlInstanceId: databaseInstanceId
    })) as DatabaseInstancesIncludingResource[];
    if (isEmpty(managedInstance)) {
        const errorMessage = `No managed database instance by account ${accountId}, credentials ${credentialsId}, database host ${databaseHostId}, database instance ${databaseInstanceId} found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    const {
        resource: { resource_name: resourceName },
        database_instance_name: instanceName
    } = managedInstance;
    try {
        const instanceDetailsForJob = JSON.stringify({
            hostName: resourceName,
            resourceId: databaseHostId,
            databaseInstanceId,
            databaseInstanceName: instanceName,
            sqlServerDeploymentType: RESOURCESTYPE.MSSQL
        });
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const jobName = `Microsoft SQL Server storage assessment for instance ${savedInstanceName}`;
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
        // Call the async function without awaiting it
        handleAssessment(accountId, managedInstance, jobId, initiatedBy, fields);

        return { jobId };
    } catch (error) {
        logger.error(`Error while fetching database instance details ${accountId}, ${databaseHostId}, ${error}`);
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
    logger.info('Fetching drift assessment per host', {
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
        nextToken
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
        resourceDetails.map(async resourceDetail => {
            const { resource_id: databaseHostId } = resourceDetail;
            try {
                const drifAssessmentPerHost = await fetchDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    fields
                );
                driftAssessmentPerAccount.push(drifAssessmentPerHost);
            } catch (error) {
                logger.error(
                    `Error while fetching drift assessment per host ${accountId}, ${databaseHostId}, ${error}`
                );
            }
        })
    );

    return {
        count: driftAssessmentPerAccount.length,
        assessmentsPerAccount: driftAssessmentPerAccount,
        nextToken: resourceDetails?.length === pageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
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
    initiateStorageAssessmentCollection
};
