import { isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import {
    CloneAssessment,
    CloneDetail,
    InstancesResponse,
    VolumeDBMapEntry,
    VolumeRecord
} from '../../../utils/common-types';
import { getInstanceDetails, getInstanceOntapDetails } from '../../database-hosts-operations';
import {
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    GENERIC_ASSESSMENT_ERROR_MESSAGE,
    HttpErrorCodes,
    CLONE_AGE
} from '../../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { GET_SANDBOX_DETAILS } from '../../workloads/mssql/assessment-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { calculateDaysSince, sqlResponseParsing } from '../../../utils/utils';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { GET_SANDBOXES } from '../../workloads/mssql/queries';
import { getProperty, getSourceDetails } from '../../sandbox-operations';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

interface Sandbox {
    database_name: string;
    sandbox_properties: { name: string; value: string }[];
}

function calculateCloneDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneAssessmentData: CloneAssessment
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating Clone drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'clone-management');
    try {
        logger.debug('Persisted Clone configuration data from DB', cloneAssessmentData);

        if (isEmpty(cloneAssessmentData)) {
            const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CLONE);
            logger.error(errorMessage);
            return { ...goldenConfig, errorMessage };
        }
        const { cloneDetails, status, oldClones, oldCloneDetails, oldCloneDatabaseNames } =
            cloneAssessmentData as CloneAssessment;
        logger.debug('Clone assessment result', cloneDetails);

        return {
            ...goldenConfig,
            status: status as AssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            cloneDetails: cloneDetails?.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            totalObjectsAssessed: cloneDetails?.length ?? 0,
            totalObjectsInViolation: oldClones ?? oldCloneDatabaseNames?.length ?? 0,
            objectsInViolation: oldCloneDatabaseNames ?? [],
            oldCloneDetails: oldCloneDetails?.map(detail => ({
                ...detail,
                tag: detail.tag ?? undefined
            })),
            cloneDriftMessage: `${oldClones} out of ${cloneDetails?.length} clones are old and divergent`
        };
    } catch (error: any) {
        const errorMessage = `Error while calculating clone drift. ${error.message}`;
        logger.error({ errorMessage, error });
        return { ...goldenConfig, errorMessage };
    }
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
        name: 'Clone assessment',
        description: 'Clone assessment',
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

    if (!isEmpty(cloneAssessment)) {
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId as string,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.CLONE,
                config_data: cloneAssessment
            }
        ]);
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
        false,
        accountId,
        ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
        svmUuid,
        instanceOntapDetails,
        'clone.parent_volume.name,clone.is_flexclone,create_time'
    ) as Promise<InstancesResponse>;

    const callSsmExecutionResponse = callSsmExecution({
        credentialsId,
        region,
        commands: [ssmCommand],
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get sandbox Details for clone assessment',
        accountId,
        executionTimeout: ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
        shouldReadFromCloudWatchLogs: true
    });

    const [instanceVolumeMapping, response] = await Promise.all([getInstanceVolumeMapping, callSsmExecutionResponse]);

    const volumeMapping = instanceVolumeMapping[databaseInstanceName];
    logger.debug('Instance Volume Mapping', volumeMapping);
    logger.debug('Sandbox Response', response);

    if (isEmpty(volumeMapping)) {
        const errorMessage = `No ONTAP volumes found for the instance ${databaseInstanceName}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    const { volumeRecords, volumeDBMap } = volumeMapping;

    const filteredVolumeRecords = volumeRecords?.filter((record: VolumeRecord) => record.clone?.is_flexclone);

    const volumeUUIDMap = new Map<string, any>(); // Map to store volume UUIDs
    const databaseNameToVolumeUUIDMap = new Map<string, string[]>(); // Map to store database names
    const volumeUUIDToDatabaseNameMap = new Map<string, string[]>(); // Map to store volume UUIDs to database names

    filteredVolumeRecords.forEach((record: VolumeRecord) => {
        volumeUUIDMap.set(record.uuid, record);
    });

    volumeDBMap?.forEach((entry: VolumeDBMapEntry) => {
        const { databaseName, ontapVolumeuuid } = entry;
        if (!databaseNameToVolumeUUIDMap.has(databaseName)) {
            databaseNameToVolumeUUIDMap.set(databaseName, []);
        }
        databaseNameToVolumeUUIDMap.get(databaseName)?.push(ontapVolumeuuid);

        if (!volumeUUIDToDatabaseNameMap.has(ontapVolumeuuid)) {
            volumeUUIDToDatabaseNameMap.set(ontapVolumeuuid, []);
        }
        volumeUUIDToDatabaseNameMap.get(ontapVolumeuuid)?.push(databaseName);
    });
    // implementation with our wlmdb created sandbox
    const parsedResponse = sqlResponseParsing(response);
    const { cloneResponse } = parsedResponse;

    let sandboxListSSMResponse = [];
    try {
        sandboxListSSMResponse = JSON.parse(cloneResponse);
        if (!Array.isArray(sandboxListSSMResponse)) {
            throw new Error('Parsed cloneResponse is not an array');
        }
    } catch (error) {
        logger.error('Failed to parse cloneResponse or invalid format', { cloneResponse, error });
        sandboxListSSMResponse = []; // Default to an empty array if parsing fails
    }

    const sandboxInfo: CloneDetail[] = [];
    const oldCloneDetails: CloneDetail[] = []; // Array to store records older than 60 days
    const oldCloneDatabaseNames: string[] = []; // Array to store cloneDatabaseName strings for old clones
    let oldClones = 0;
    const processedSandboxNames = new Set<string>(); // Set to keep track of sandbox names already processed by netapp_wf

    sandboxListSSMResponse?.forEach((item: Sandbox) => {
        const sources = getSourceDetails(item);
        const { database_name: sandboxName } = item;
        processedSandboxNames.add(sandboxName);

        const [sourceDatabaseHostName, sourceDatabaseInstanceName, sourceDatabaseName] = sources;
        const databaseObject: CloneDetail = {
            cloneDatabaseName: sandboxName,
            databaseHostName: resourceName,
            databaseHostId: resourceId,
            databaseInstanceName,
            sourceDatabaseHostName,
            sourceDatabaseInstanceName,
            sourceDatabaseName,
            tag: getProperty(item, 'tag'),
            clonedVolumeDetails: []
        };

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

                const clonedVolumeInfo = {
                    sourceVolumeName: cloneParentVolumeName,
                    cloneVolumeName,
                    cloneVolumeUuid,
                    cloneVolumeCreateTime,
                    cloneDatabaseName: sandboxName,
                    cloneVolumeType: 'data',
                    isFlexClone
                };

                const cloneAge = calculateDaysSince(cloneVolumeCreateTime);

                databaseObject.clonedVolumeDetails?.push(clonedVolumeInfo);
                if (cloneAge !== undefined) {
                    databaseObject.cloneAge = cloneAge;
                }
            });
            const modifiedDatabaseObject = {
                ...databaseObject,
                clonedBy: 'netapp_wf'
            };
            if (databaseObject.cloneAge !== undefined && databaseObject.cloneAge > CLONE_AGE) {
                oldClones += 1;
                oldCloneDetails.push(modifiedDatabaseObject);
                oldCloneDatabaseNames.push(sandboxName);
            }
            sandboxInfo.push(modifiedDatabaseObject);
        }
    });

    const databaseMap = new Map<string, CloneDetail>(); // Map to store CloneDetail by cloneDatabaseName

    filteredVolumeRecords.forEach((record: VolumeRecord) => {
        const {
            uuid: cloneVolumeUuid,
            create_time: cloneVolumeCreateTime,
            name: cloneVolumeName,
            clone: { parent_volume: { name: cloneParentVolumeName = '' } = {} } = {}
        } = record;

        // Calculate the number of days since the volume was created
        const createdDate = cloneVolumeCreateTime ? new Date(cloneVolumeCreateTime) : new Date();
        const cloneAge = calculateDaysSince(createdDate);

        const clonedDatabaseNames = volumeUUIDToDatabaseNameMap.get(cloneVolumeUuid);

        clonedDatabaseNames?.forEach(clonedDatabaseName => {
            const clonedVolumeInfo = {
                sourceVolumeName: cloneParentVolumeName,
                cloneVolumeName,
                cloneVolumeUuid,
                cloneVolumeCreateTime,
                cloneDatabaseName: clonedDatabaseName
            };
            // Check if the sandboxName is already processed by netapp_wf
            if (!processedSandboxNames.has(clonedDatabaseName)) {
                // Check if the database already exists in the map
                if (databaseMap.has(clonedDatabaseName)) {
                    // Append the volume details to the existing record
                    const existingRecord = databaseMap.get(clonedDatabaseName)!;
                    existingRecord.clonedVolumeDetails?.push(clonedVolumeInfo);

                    // Update cloneAge if the new volume has a higher age
                    if (
                        cloneAge !== undefined &&
                        (existingRecord.cloneAge === undefined || cloneAge > existingRecord.cloneAge)
                    ) {
                        existingRecord.cloneAge = cloneAge;
                    }

                    // If the clone is old, ensure it's added to oldCloneDetails and oldCloneDatabaseNames
                    if (cloneAge > CLONE_AGE && !oldCloneDatabaseNames.includes(clonedDatabaseName)) {
                        oldClones += 1;
                        oldCloneDetails.push(existingRecord);
                        oldCloneDatabaseNames.push(clonedDatabaseName);
                    }
                } else {
                    // Create a new record for the database
                    const databaseObject: CloneDetail = {
                        cloneDatabaseName: clonedDatabaseName,
                        databaseHostName: resourceName,
                        databaseHostId: resourceId,
                        databaseInstanceName,
                        clonedBy: 'other',
                        cloneAge,
                        clonedVolumeDetails: [clonedVolumeInfo]
                    };

                    // Add to oldCloneDetails and oldCloneDatabaseNames if it's an old clone
                    if (cloneAge !== undefined && cloneAge > CLONE_AGE) {
                        oldClones += 1;
                        oldCloneDetails.push(databaseObject);
                        oldCloneDatabaseNames.push(clonedDatabaseName);
                    }
                    databaseMap.set(clonedDatabaseName, databaseObject);
                }
            }
        });
    });

    const otherClones = Array.from(databaseMap.values());

    const isOptimized = oldClones === 0;
    const optimizationStatus = isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

    return {
        cloneDetails: [...sandboxInfo, ...otherClones],
        status: optimizationStatus,
        oldClones,
        oldCloneDetails,
        oldCloneDatabaseNames
    };
}

export { managedHostsCloneAssessment, calculateCloneDrift, runCloneAssessment };
