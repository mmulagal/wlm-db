import { isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import {
    CloneAssesment,
    CloneDetail,
    InstancesResponse,
    VolumeDBMapEntry,
    VolumeRecord
} from '../../utils/common-types';
import { getInstanceDetails, getInstanceOntapDetails } from '../database-hosts-operations';
import { ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT, HttpErrorCodes } from '../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { GET_SANDBOX_DETAILS } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { calculateDaysSince, sqlResponseParsing } from '../../utils/utils';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import { GET_SANDBOXES } from '../workloads/mssql/queries';
import { getProperty, getSourceDetails } from '../sandbox-operations';
import { getMappedOntapVolumes } from '../aws/fsx-operations';

const logger = getLogger();

interface SandboxObject {
    sandbox_properties: { name: string; value: string }[];
}

type sandboxType = SandboxObject & { database_name: string };

async function calculateCloneDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating Clone drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });
    let errorMessage = '';
    try {
        const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            AssessmentCategories.CLONE
        );

        logger.debug('Persisted Clone configuration data from DB', persistedConfigurationData);
        const clones = persistedConfigurationData?.config_data as unknown as CloneAssesment;

        let cloneAssessment;

        if (!isEmpty(clones)) {
            cloneAssessment = clones as CloneAssesment;
        } else {
            const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );

            const instanceOntapDetails = await getInstanceOntapDetails(
                newDatabaseInstanceDetails,
                credentialsId,
                region
            );
            logger.info(instanceOntapDetails);

            const {
                database_instance_name: instanceName,
                sqlAuthEnabled,
                database_instance_id: instanceId,
                resource: { resource_id: resourceId, resource_name: resourceName }
            } = newDatabaseInstanceDetails;

            if (!activeNodeInstanceId) {
                logger.error('Active node instance id not found');
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Active node instance id not found');
            }

            cloneAssessment = await runCloneAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                instanceName,
                instanceId,
                resourceId,
                resourceName as string,
                instanceOntapDetails,
                sqlAuthEnabled
            );
            logger.debug('Clone assessment result while calculating', cloneAssessment);

            await createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: databaseHostId,
                    database_instance_id: databaseInstanceId,
                    creation_time: new Date(Date.now()),
                    config_data_type: AssessmentCategories.CLONE,
                    config_data: cloneAssessment
                }
            ]);
        }

        const { cloneDetails, status, oldClones } = cloneAssessment as CloneAssesment;
        logger.info(cloneDetails);
        const recommendationMessage =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? 'Old and divergent clones can incur significant costs. Consider deleting or refreshing these clones to optimize your storage expenses.'
                : 'All clones are proper and up-to-date with the source.';

        const CloneResponse = {
            name: 'Clone Management',
            status: status as AssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.COST_EFFICIENCY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.SQL_INSTANCE, // Database check it
            cloneInInstances: cloneDetails,
            impactedDatabases: `${oldClones} out of ${cloneDetails?.length} clones are old and divergent`
        };
        return CloneResponse;
    } catch (error: any) {
        errorMessage = `Error while calculating clone drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function managedHostsCloneAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId?: string
) {
    logger.info('Managed hosts Clone assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        resourceName,
        databaseHostId,
        databaseInstanceId,
        parentJobId
    });

    const { id: cloneAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server Clone assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server Clone assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let cloneAssessment;
    let jobStatus;
    let errorMessage;
    try {
        const { newDatabaseInstanceDetails } = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );

        const instanceOntapDetails = await getInstanceOntapDetails(newDatabaseInstanceDetails, credentialsId, region);
        logger.info(instanceOntapDetails);

        const {
            database_instance_name: instanceName,
            sqlAuthEnabled,
            database_instance_id: instanceId,
            resource: { resource_id: resourceId, resource_name: dbResourceName }
        } = newDatabaseInstanceDetails;

        cloneAssessment = await runCloneAssessment(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            instanceName,
            instanceId,
            resourceId,
            dbResourceName as string,
            instanceOntapDetails,
            sqlAuthEnabled
        );
    } catch (error) {
        errorMessage = `Error while performing clone assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, cloneAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return cloneAssessment;
}

async function runCloneAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstanceName: string,
    instanceId: string,
    resourceId: string,
    resourceName: string,
    instanceOntapDetails: Record<string, { fsxId: string; svmUuid: string | undefined }>,
    sqlAuthEnabled?: boolean
) {
    logger.info('Running Clone assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        databaseInstanceName,
        instanceId,
        resourceId,
        resourceName,
        instanceOntapDetails,
        sqlAuthEnabled
    });

    const { fsxId, svmUuid } = instanceOntapDetails[databaseInstanceName];
    const ssmCommand = GET_SANDBOX_DETAILS(databaseInstanceName, sqlAuthEnabled as boolean, GET_SANDBOXES);

    const getInstanceVolumeMapping = getMappedOntapVolumes(
        credentialsId,
        region,
        fsxId,
        false,
        activeNodeInstanceId,
        [databaseInstanceName],
        sqlAuthEnabled,
        true,
        accountId,
        ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
        svmUuid,
        instanceOntapDetails,
        'clone.parent_volume.name,clone.is_flexclone,create_time'
    ) as Promise<InstancesResponse>;

    const callSsmExecutionResponse = callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        activeNodeInstanceId,
        'Get sandbox Details for clone assessment'
    );

    const [instanceVolumeMapping, response] = await Promise.all([getInstanceVolumeMapping, callSsmExecutionResponse]);

    const volumeMapping = instanceVolumeMapping[databaseInstanceName];
    logger.info('Instance Volume Mapping', volumeMapping);
    logger.info('Response', response);

    if (isEmpty(volumeMapping)) {
        const errorMessage = `No ONTAP volumes found for the instance ${databaseInstanceName}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    const { volumeRecords, volumeDBMap } = volumeMapping;

    const filteredVolumeRecords = volumeRecords?.filter((record: VolumeRecord) => record.clone?.is_flexclone);

    const volumeUUIDMap = new Map<string, any>(); // Map to store volume UUIDs
    const databaseNameToVolumeUUIDMap = new Map<string, string[]>(); // Map to store database names
    const volumeUUIDToDatabaseNameMap = new Map<string, string>(); // Map to store volume UUIDs to database names

    filteredVolumeRecords.forEach((record: VolumeRecord) => {
        volumeUUIDMap.set(record.uuid, record);
    });

    volumeDBMap?.forEach((entry: VolumeDBMapEntry) => {
        const { databaseName, ontapVolumeuuid } = entry;
        if (!databaseNameToVolumeUUIDMap.has(databaseName)) {
            databaseNameToVolumeUUIDMap.set(databaseName, []);
        }
        databaseNameToVolumeUUIDMap.get(databaseName)?.push(ontapVolumeuuid);
        volumeUUIDToDatabaseNameMap.set(ontapVolumeuuid, databaseName);
    });

    // implementation with our wlmdb created sandbox
    const parsedResponse = sqlResponseParsing(response);
    const { cloneResponse } = parsedResponse;

    const modifiedResponse = JSON.parse(cloneResponse);

    const sandboxInfo: CloneDetail[] = [];
    let oldClones = 0;
    const processedSandboxNames = new Set<string>(); // Set to keep track of sandbox names already processed by netapp_wf

    modifiedResponse?.forEach((item: sandboxType) => {
        const sources = getSourceDetails(item);
        const { database_name: sandboxName } = item;
        processedSandboxNames.add(sandboxName);

        const volumeUUIDs = databaseNameToVolumeUUIDMap.get(sandboxName);
        if (!volumeUUIDs) {
            logger.error(`No volume found for database name: ${sandboxName}`);
        } else {
            volumeUUIDs.forEach(volumeUUID => {
                const volumeDetails = volumeUUIDMap.get(volumeUUID);
                if (!volumeDetails) {
                    logger.error(`No volume details found for volume UUID: ${volumeUUID}`);
                    return;
                }

                const {
                    uuid: cloneVolumeUuid,
                    create_time: cloneVolumeCreateTime,
                    name: cloneVolumeName,
                    clone: {
                        is_flexclone: isFlexClone,
                        parent_volume: { name: cloneParentVolumeName }
                    }
                } = volumeDetails;
                const clonedVolumeDetails = {
                    cloneVolumeName,
                    cloneVolumeUuid,
                    cloneVolumeCreateTime,
                    cloneParentVolumeName,
                    cloneDatabaseName: sandboxName,
                    isFlexClone,
                    cloneName: cloneVolumeName
                };

                // Calculate the number of days since the volume was created
                const cloneAge = calculateDaysSince(cloneVolumeCreateTime);
                if (cloneAge > 60) {
                    oldClones += 1;
                }

                const databaseObject = {
                    sandboxName,
                    databaseHostName: resourceName,
                    databaseHostId: resourceId,
                    databaseInstanceName,
                    sourceDatabaseHostName: sources[0],
                    sourceDatabaseInstanceName: sources[1],
                    sourceDatabaseName: sources[2],
                    tag: getProperty(item, 'tag'),
                    ...clonedVolumeDetails,
                    cloneAge,
                    clonedBy: 'netapp_wf'
                };
                sandboxInfo.push(databaseObject);
            });
        }
    });

    filteredVolumeRecords.forEach((record: VolumeRecord) => {
        const { uuid: cloneVolumeUuid, create_time: cloneVolumeCreateTime, name: cloneVolumeName, clone } = record;

        const cloneParentVolumeName = clone?.parent_volume?.name ?? '';

        // Calculate the number of days since the volume was created
        const createdDate = cloneVolumeCreateTime ? new Date(cloneVolumeCreateTime) : new Date();
        const cloneAge = calculateDaysSince(createdDate);
        if (cloneAge > 60) {
            oldClones += 1;
        }

        const clonedDatabaseName = volumeUUIDToDatabaseNameMap.get(cloneVolumeUuid) || 'unknown';

        // Check if the sandboxName is already processed by netapp_wf
        if (!processedSandboxNames.has(clonedDatabaseName)) {
            const databaseObject = {
                sandboxName: clonedDatabaseName,
                databaseHostName: resourceName,
                databaseHostId: resourceId,
                databaseInstanceName,
                clonedBy: 'other',
                cloneAge,
                cloneVolumeName,
                cloneVolumeUuid,
                cloneVolumeCreateTime,
                cloneParentVolumeName,
                cloneName: cloneVolumeName
            };

            sandboxInfo.push(databaseObject);
        }
    });

    const isOptimized = oldClones === 0;
    const optimizationStatus = isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

    return {
        cloneDetails: sandboxInfo,
        status: optimizationStatus,
        oldClones
    };
}

export { managedHostsCloneAssessment, calculateCloneDrift, runCloneAssessment };
