import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { DriftAssessmentResponseType, StorageParameterDriftResponseType } from '../routes/types/database-hosts.types';
import getLogger from '../utils/logger';
import { sqlResponseParsing } from '../utils/utils';
import { getFsxStorageCapacity, getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/drift-assessment-scripts';
import storageGoldenConfigData from './drift-assessment/golden-configs/storage';
import { AssessmentCategories, AssessmentStatus, HttpErrorCodes, RESOURCESTYPE } from '../utils/consts';
import { StorageAssessment, WorkloadInstance } from '../utils/common-types';
import { registerJob, updateJobDetails } from './database/job-operations';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../lib/database/database-instance-config';
import { listResources } from '../lib/database/db';
import { describeFSxVolumes } from '../lib/aws/fsx';

const logger = getLogger();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osConfigData = storageGoldenConfigData.configuration.os;
const layoutConfigData = storageGoldenConfigData.layout;
const sizingConfigData = storageGoldenConfigData.sizing;

async function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('calculateStorageDrift', accountId, credentialsId, region, databaseHostId);

    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );

    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found for ${databaseHostId}, ${databaseInstanceId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const driftAssessmentData: StorageParameterDriftResponseType = {
        timestamp: persistedConfigurationData.creation_time.toDateString(),
        optimisedCount: { total: 0, optimised: 0 },
        configuration: { volumes: [], luns: [], os: [] },
        sizing: [],
        layout: []
    };

    const { config_data: configData } = persistedConfigurationData;
    const { volumes, luns, os, layout, sizing, filesystemId } = configData as unknown as StorageAssessment;
    let configCount = 0;
    let optimizedCount = 0;

    volumeConfigData.forEach(config => {
        configCount += 1;
        let status = AssessmentStatus.OPTIMIZED;
        const objectsInViolation: string[] = [];
        volumes.forEach(volume => {
            let objectName = '';
            Object.entries(volume).forEach(([key, value]) => {
                objectName = key === 'name' ? value : objectName;
                if (key === config.parameter) {
                    status = config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : status;
                    if (status === AssessmentStatus.NOT_OPTIMIZED) {
                        objectsInViolation.push(objectName!);
                    }
                }
            });
        });
        if (status === AssessmentStatus.OPTIMIZED) {
            optimizedCount += 1;
        }
        driftAssessmentData.configuration.volumes.push({
            name: config.parameter,
            recommended: config.value.toString(),
            status,
            objectsInViolation,
            severity: config.severity,
            recommendation: config.recommendation,
            tags: config.tags
        });
    });

    lunConfigData.forEach(config => {
        configCount += 1;
        let status = AssessmentStatus.OPTIMIZED;
        const objectsInViolation: string[] = [];
        luns.forEach(lun => {
            let objectName = '';
            Object.entries(lun).forEach(([key, value]) => {
                objectName = key === 'name' ? value : objectName;
                if (key === config.parameter) {
                    status = config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : status;

                    if (status === AssessmentStatus.NOT_OPTIMIZED) {
                        objectsInViolation.push(objectName!);
                    }
                }
            });
        });
        if (status === AssessmentStatus.OPTIMIZED) {
            optimizedCount += 1;
        }
        driftAssessmentData.configuration.luns.push({
            name: config.parameter,
            recommended: config.value.toString(),
            status,
            objectsInViolation,
            severity: config.severity,
            recommendation: config.recommendation,
            tags: config.tags
        });
    });

    Object.entries(os).forEach(([key, value]) => {
        const goldenData = osConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            configCount += 1;
            const status = goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            if (status === AssessmentStatus.OPTIMIZED) {
                optimizedCount += 1;
            }
            driftAssessmentData.configuration.os.push({
                name: key,
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags
            });
        }
    });

    Object.entries(layout).forEach(([key, value]) => {
        const goldenData = layoutConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            configCount += 1;
            const status = goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            if (status === AssessmentStatus.OPTIMIZED) {
                optimizedCount += 1;
            }
            driftAssessmentData.layout.push({
                name: key,
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags
            });
        }
    });

    Object.entries(sizing).forEach(([key, value]) => {
        const goldenData = sizingConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            configCount += 1;
            let status = AssessmentStatus.NOT_OPTIMIZED;
            if (key === 'performance-tier') {
                status = value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            }
            if (key === 'log-drive-size') {
                const sizePercent = Number(value);
                status =
                    sizePercent <= 30 || sizePercent >= 20
                        ? AssessmentStatus.OPTIMIZED
                        : sizePercent > 30
                        ? AssessmentStatus.OVER_PROVISIONED
                        : AssessmentStatus.UNDER_PROVISIONED;
            }
            if (key === 'tempdb-drive-size') {
                const sizePercent = Number(value);
                status =
                    sizePercent <= 20 || sizePercent >= 10
                        ? AssessmentStatus.OPTIMIZED
                        : sizePercent > 20
                        ? AssessmentStatus.OVER_PROVISIONED
                        : AssessmentStatus.UNDER_PROVISIONED;
            }
            if (status === AssessmentStatus.OPTIMIZED) {
                optimizedCount += 1;
            }
            driftAssessmentData.sizing.push({
                name: key,
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags
            });
        }
    });

    const [fsxSSDCapacity, { Volumes }] = await Promise.all([
        getFsxStorageCapacity(credentialsId, region, filesystemId),
        describeFSxVolumes(credentialsId, region, filesystemId)
    ]);

    const { storage } = fsxSSDCapacity ?? {};
    const ssdStorageCapacityInBytes = storage ? storage * 1024 * 1024 * 1024 : 0;

    const totalVolumeSizeInBytes = Volumes?.reduce((total, curr) => {
        const amount = curr.OntapConfiguration?.SizeInBytes || 0;
        return total + amount;
    }, 0);

    try {
        const headroomPercent =
            ((ssdStorageCapacityInBytes - totalVolumeSizeInBytes) / ssdStorageCapacityInBytes) * 100;
        const goldenData = sizingConfigData.find(data => data.parameter === 'headroom');
        const sizePercent = Number(headroomPercent);
        const status =
            sizePercent <= 100 || sizePercent >= 35
                ? AssessmentStatus.OPTIMIZED
                : sizePercent > 30
                ? AssessmentStatus.OVER_PROVISIONED
                : AssessmentStatus.UNDER_PROVISIONED;
        driftAssessmentData.sizing.push({
            name: 'headroom',
            recommended: goldenData!.value.toString(),
            status,
            severity: goldenData!.severity,
            recommendation: goldenData!.recommendation,
            tags: goldenData!.tags
        });
    } catch (e: any) {
        logger.error(
            `Error while calculating headroom details for ${databaseHostId}, ${databaseInstanceId}, ${filesystemId}.`
        );
    }

    driftAssessmentData.optimisedCount.total = configCount;
    driftAssessmentData.optimisedCount.optimised = optimizedCount;

    return driftAssessmentData;
}
async function initiateStorageAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    jobId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info(
        'initiateStorageAssessmentCollection',
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        instanceRecord
    );

    const instanceVolumeMapping = ((await getMappedOntapVolumes(
        credentialsId,
        region,
        instanceRecord.fsxFileSystem,
        false,
        instanceRecord.activeNodeInstanceid,
        [instanceRecord.name],
        instanceRecord.sqlAuthEnabled
    )) as MappedOnTapVolumeResponse[]) || [{ volumeUuids: [], volumeDBMap: {}, lunNames: [] }];

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

    const command = STORAGE_CONFIGURATION_ASSESSMENT(instanceRecord);

    const response = await callSsmExecution(credentialsId, region, [command], instanceRecord.activeNodeInstanceid);

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
}

async function driftAssesment(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    databaseHostId: string,
    databaseInstanceRecords: WorkloadInstance[],
    fields?: string
) {
    logger.info(
        'Trigger drift assessment',
        accountId,
        credentialsId,
        region,
        jobId,
        databaseHostId,
        databaseInstanceRecords,
        fields
    );

    let errorMessage;
    let jobStatus: string = JOBSTATUS.COMPLETED;

    let fieldsValues: Array<string> = [AssessmentCategories.STORAGE];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldRunStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());

    try {
        await Promise.all(
            databaseInstanceRecords.map(async databaseInstanceRecord => {
                if (shouldRunStorageAssessment) {
                    await initiateStorageAssessmentCollection(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        jobId,
                        databaseInstanceRecord
                    );
                }
            })
        );
    } catch (e: any) {
        logger.error(e);
        errorMessage = e.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        const instanceNames = databaseInstanceRecords.map(i => i.name);
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            error: errorMessage,
            description: `The selected SQL Server instance(s) ${instanceNames.join(
                ','
            )} has been scanned for best practice misalignments. Review detailed findings and recommendations in <Instance optimization dashboard>.`,
            status: jobStatus!,
            endTime: Date.now()
        });
    }
}
async function triggerDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceIds: string[],
    initiatedBy: string,
    fields?: string
) {
    logger.info(
        'Trigger drift assessment',
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceIds,
        initiatedBy,
        fields
    );

    const runningInstances: WorkloadInstance[] = [];

    const [resourceDetail] = await listResources(accountId, databaseHostId, credentialsId, region);
    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const resourceName = resourceDetail.resource_name!;
    try {
        await Promise.all(
            databaseInstanceIds.map(async databaseInstanceId => {
                const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId
                );
                const {
                    database_instance_name: savedInstanceName,
                    fsxn_ids: fileSystemId,
                    sqlAuthEnabled
                } = newDatabaseInstanceDetails;

                const instanceRecord: WorkloadInstance = {
                    id: databaseInstanceId,
                    name: savedInstanceName,
                    type: RESOURCESTYPE.MSSQL,
                    region,
                    sqlAuthEnabled: sqlAuthEnabled || false,
                    activeNodeInstanceid: activeNodeInstanceId,
                    fsxFileSystem: fileSystemId
                };
                runningInstances.push(instanceRecord);
            })
        );
    } catch (error) {
        logger.error(`Error while fetching database instance details ${accountId}, ${databaseHostId}, ${error}`);
    }

    const instanceNames = runningInstances.map(i => i.name);
    if (!isEmpty(runningInstances)) {
        const jobString = `The selected SQL Server instance(s) ${instanceNames.join(
            ','
        )} is/are being scanned for best practice misalignments.`;
        const job = await registerJob(accountId, credentialsId, region, {
            name: jobString,
            description: jobString,
            resourceName: resourceName!,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT
        });

        driftAssesment(accountId, credentialsId, region, job.id, databaseHostId, runningInstances, fields);

        return { jobId: job.id };
    }
    throw createError(
        HttpErrorCodes.NOT_FOUND,
        `Aborting assessment as no instances found running for ${accountId}, ${databaseHostId}.`
    );
}

async function fetchDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetch drift assessment', accountId, credentialsId, region, databaseHostId, databaseInstanceId, fields);

    let fieldsValues: Array<string> = [AssessmentCategories.STORAGE];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }
    const driftAssesmentData: DriftAssessmentResponseType = {};
    const shouldCalculateStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
    if (shouldCalculateStorageAssessment) {
        driftAssesmentData.storage = await calculateStorageDrift(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );
    }
    return driftAssesmentData;
}

export { triggerDriftAssessment, fetchDriftAssessment };
