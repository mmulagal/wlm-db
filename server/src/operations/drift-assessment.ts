import { countBy, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import Promise from 'bluebird';
import { CpuVendorArchitecture } from '@aws-sdk/client-compute-optimizer';
import moment from 'moment';
import {
    ComputeDriftResponseType,
    DriftAssessmentResponseType,
    SizingViolationResponseType,
    StorageParameterDriftResponseType
} from '../routes/types/database-hosts.types';
import getLogger from '../utils/logger';
import { getEc2Arn, sqlResponseParsing } from '../utils/utils';
import { getFsxStorageCapacity, getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/drift-assessment-scripts';
import storageGoldenConfigData from './drift-assessment/golden-configs/storage';
import { CUSTOM_SSM_EXECUTION_TIMEOUT, HttpErrorCodes, RESOURCESTYPE } from '../utils/consts';
import { StorageAssessment, WorkloadInstance } from '../utils/common-types';
import { registerJob, updateJobDetails } from './database/job-operations';

import { listResources } from '../lib/database/db';
import { describeFSxVolumes } from '../lib/aws/fsx';
import { getEC2InstanceRecommendations } from '../lib/aws/compute-optimizer';
import { checkComputeOptimizerEnrollmentStatus } from './recommendation-operations';
import { translateFindingReasonCode } from './aws/compute-optimizer-operations';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../utils/continous-optimization-consts';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../lib/database/database-instance-config';

const logger = getLogger();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osConfigData = storageGoldenConfigData.configuration.os;
const layoutConfigData = storageGoldenConfigData.layout;
const sizingConfigData = storageGoldenConfigData.sizing;

interface DatabaseVolumeRecord {
    svm: string;
    volumeName: string;
    fileId?: number;
    lunSerialNumber: string;
    name: string;
    fileName: string;
    lunPath: string;
    volumeUuid: string;
    sizeInMb: number;
    fileType: number;
    logVolume?: string;
    logLunPath?: string;
    logFileName?: string;
    logSize?: number;
    logVolumeUuid?: string;
    databaseSizeInGb?: number;
    logSizeInMb?: number;
}

async function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('calculateStorageDrift', accountId, credentialsId, region, databaseHostId, databaseInstanceId);

    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );

    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const driftAssessmentData: StorageParameterDriftResponseType = {
        timestamp: moment(persistedConfigurationData.creation_time).unix() * 1000,
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
        if (key === 'user-database-layout') {
            const dataVolumes = value.data;
            const logVolumes = value.log;
            const reconstuctedValue = dataVolumes.filter((data: DatabaseVolumeRecord) =>
                logVolumes.forEach((log: DatabaseVolumeRecord) => {
                    if (data.name === log.name) {
                        data.logVolume = log.volumeName;
                        data.logLunPath = log.lunPath;
                        data.logFileName = log.fileName;
                        data.logSizeInMb = log.sizeInMb;
                        data.logVolumeUuid = log.volumeUuid;
                        data.databaseSizeInGb = Math.ceil((data.sizeInMb! + log.sizeInMb!) / 1024);
                    }
                })
            );

            // start user database layout assessment
            // each database is on separate data and log lun
            const databasesOnSameDataLogLun: DatabaseVolumeRecord[] = reconstuctedValue.filter(
                (data: DatabaseVolumeRecord) => data.lunPath === data.logLunPath
            );

            // each database is on separate data and log volume
            const databasesOnSameDataLogVolume: DatabaseVolumeRecord[] = reconstuctedValue.filter(
                (data: DatabaseVolumeRecord) => data.volumeUuid === data.logVolumeUuid
            );

            const databasesAbove500Gb: DatabaseVolumeRecord[] = reconstuctedValue.filter(
                (data: DatabaseVolumeRecord) => data.databaseSizeInGb! >= 500
            );

            const groupByDataVolume = countBy(databasesAbove500Gb, 'volumeUuid');
            const groupByLogVolume = countBy(databasesAbove500Gb, 'logVolumeUuid');
            const groupByDataLun = countBy(databasesAbove500Gb, 'lunPath');
            const groupByLogLun = countBy(databasesAbove500Gb, 'logLunPath');

            const databasesSharingDataVolumes = Object.values(groupByDataVolume).filter(count => count > 1);
            const databasesSharingLogVolumes = Object.values(groupByLogVolume).filter(count => count > 1);
            const databasesSharingDataLuns = Object.values(groupByDataLun).filter(count => count > 1);
            const databasesSharingLogLuns = Object.values(groupByLogLun).filter(count => count > 1);

            let recommended = '';
            let status = AssessmentStatus.OPTIMIZED;
            let recommendationString = '';
            let severity = 'critical';

            if (!isEmpty(databasesOnSameDataLogLun)) {
                recommended = 'separate-data-log-lun-per-database';
                status = AssessmentStatus.NOT_OPTIMIZED;
                severity = 'critical';
            } else if (!isEmpty(databasesOnSameDataLogVolume)) {
                recommended = 'separate-data-log-volume-per-database';
                status = AssessmentStatus.NOT_OPTIMIZED;
                severity = 'warning';
            } else if (databasesAbove500Gb.length > 1) {
                if (
                    !isEmpty(databasesSharingDataVolumes) ||
                    !isEmpty(databasesSharingLogVolumes) ||
                    !isEmpty(databasesSharingDataLuns) ||
                    !isEmpty(databasesSharingLogLuns)
                ) {
                    recommended = 'separate-data-log-lun-volume-for-large-database';
                    status = AssessmentStatus.NOT_OPTIMIZED;
                    severity = 'critical';
                    recommendationString =
                        'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
                }
            } else if (!isEmpty(databasesSharingDataLuns) || !isEmpty(databasesSharingLogLuns)) {
                recommended = 'separate-data-log-lun-for-large-database';
                status = AssessmentStatus.NOT_OPTIMIZED;
                severity = 'critical';
                recommendationString =
                    'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
            } else if (!isEmpty(databasesSharingDataVolumes) || !isEmpty(databasesSharingLogVolumes)) {
                recommended = 'separate-data-log-volume-for-large-database';
                status = AssessmentStatus.NOT_OPTIMIZED;
                severity = 'warning';
                recommendationString =
                    'Consolidate small-to-medium size databases that are less critical or have fewer I/O requirements to a single volume';
            }

            driftAssessmentData.layout.push({
                name: 'user-database-layout',
                recommended,
                status,
                severity,
                recommendation: recommendationString,
                tags: [
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ]
            });
        }
    });

    Object.entries(sizing).forEach(([key, value]) => {
        let goldenData = sizingConfigData.find(data => data.parameter === key);

        const overProvisionedDrives: SizingViolationResponseType[] = [];
        const underProvisionedDrives: SizingViolationResponseType[] = [];
        const ignoredDrives: SizingViolationResponseType[] = [];
        const optimisedDrives: SizingViolationResponseType[] = [];

        if (key === 'data-log-drive-details') {
            goldenData = sizingConfigData.find(data => data.parameter === 'log-drive-size');
        }
        if (key === 'data-tempdb-drive-details') {
            goldenData = sizingConfigData.find(data => data.parameter === 'tempdb-drive-size');
        }
        if (!isEmpty(goldenData)) {
            configCount += 1;
            let status = AssessmentStatus.NOT_OPTIMIZED;
            if (key === 'performance-tier') {
                status = value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            }
            if (key === 'data-log-drive-details') {
                const driveDetails = Array.isArray(value) ? value : [value];
                driveDetails.forEach((drive: { [x: string]: any }) => {
                    const { dataDriveLetter, logDriveLetter, dataDriveTotalSizeMB, logDriveTotalSizeMB } = drive;
                    if (!dataDriveLetter || !logDriveLetter || !dataDriveTotalSizeMB || !logDriveTotalSizeMB) {
                        ignoredDrives.push(drive as SizingViolationResponseType);
                    } else if (dataDriveLetter !== logDriveLetter) {
                        const logToDriveSizePercent = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
                        if (logToDriveSizePercent > 30) {
                            overProvisionedDrives.push(drive as SizingViolationResponseType);
                        } else if (logToDriveSizePercent < 20) {
                            underProvisionedDrives.push(drive as SizingViolationResponseType);
                        } else {
                            optimisedDrives.push(drive as SizingViolationResponseType);
                        }
                    } else {
                        ignoredDrives.push(drive as SizingViolationResponseType);
                    }
                });
                key = 'log-drive-size';
                status =
                    !isEmpty(overProvisionedDrives) || !isEmpty(underProvisionedDrives)
                        ? AssessmentStatus.NOT_OPTIMIZED
                        : isEmpty(optimisedDrives) && !isEmpty(ignoredDrives)
                        ? AssessmentStatus.NOT_APPLICABLE
                        : AssessmentStatus.OPTIMIZED;
            }
            if (key === 'data-tempdb-drive-details') {
                const defaultDataDrive = value.defaultDataDriveLetter;
                const { tempdbDriveLetter } = value;
                if (defaultDataDrive === tempdbDriveLetter) {
                    status = AssessmentStatus.NOT_APPLICABLE;
                } else {
                    const { defaultDataDriveSize } = value;
                    const { tempdbDriveTotalSizeMB } = value;
                    const tempdbPercent = Math.ceil((tempdbDriveTotalSizeMB / defaultDataDriveSize) * 100);
                    status =
                        tempdbPercent > 20
                            ? AssessmentStatus.OVER_PROVISIONED
                            : tempdbPercent < 10
                            ? AssessmentStatus.UNDER_PROVISIONED
                            : AssessmentStatus.OPTIMIZED;
                }
                key = 'tempdb-drive-size';
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
                tags: goldenData.tags,
                sizingViolations: { overProvisionedDrives, underProvisionedDrives, ignoredDrives }
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
        const headroomPercent = Math.ceil(
            ((ssdStorageCapacityInBytes - totalVolumeSizeInBytes) / ssdStorageCapacityInBytes) * 100
        );
        const goldenData = sizingConfigData.find(data => data.parameter === 'headroom');
        const status =
            headroomPercent < 35
                ? AssessmentStatus.UNDER_PROVISIONED
                : headroomPercent > 100 && storage && storage > 1024 // if overprovisioned, consider optimized if fsxSSDCapacity is 1024 GiB which is the case of smaller databases
                ? AssessmentStatus.OVER_PROVISIONED
                : AssessmentStatus.OPTIMIZED;
        configCount += 1;
        if (status === AssessmentStatus.OPTIMIZED) {
            optimizedCount += 1;
        }
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

async function calculateComputeDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating compute drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    try {
        const { activeNodeInstanceId, cloudProviderAccountId, resourceName } = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );
        const { finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
            (await initiateComputeAssessment(
                cloudProviderAccountId!,
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName!
            )) || {};

        let recommendationMessage =
            'Your current instance is being analyzed for rightsizing. Please check back later for recommendations.';
        let findingValue = AssessmentStatus.ANALYZING;
        let objectsInViolation: string[] = [];

        if (finding) {
            findingValue = getMatchingAssessmentStatus(finding);
            const underProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is under-provisioned. We recommend upgrading it to meet your workload demands. This will provide additional CPU, memory, and I/O capacity, ensuring better performance for your SQL Server DB.`;
            const overProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is over-provisioned. We recommend downgrading it to reduce costs. This instance type will still meet the performance needs of your SQL Server DB while saving on unnecessary expenses.`;

            if (findingValue.includes('provisioned')) {
                // under_provisioned or over_provisioned
                const genericRecommendationMessage =
                    'Click Optimize to view cost comparison between current and recommended instance types to understand potential savings.';
                recommendationMessage =
                    findingValue === AssessmentStatus.UNDER_PROVISIONED
                        ? underProvisionedRecommendationMessage
                        : overProvisionedRecommendationMessage;
                recommendationMessage += ` ${genericRecommendationMessage}`;
            }

            objectsInViolation = findingReasonCodes?.map(code => translateFindingReasonCode(code));
        }

        return {
            name: 'compute-rightsizing',
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            objectsInViolation,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            recommendationOptions
        };
    } catch (error: any) {
        errorMessage = `Error while calculating compute drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
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
        instanceRecord.sqlAuthEnabled,
        true
    )) as MappedOnTapVolumeResponse[]) || [{ volumeUuids: [], volumeDBMap: {}, lunNames: [], volumeLunMapping: {} }];

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

    const response = await callSsmExecution(
        credentialsId,
        region,
        command,
        instanceRecord.activeNodeInstanceid,
        accountId,
        false,
        CUSTOM_SSM_EXECUTION_TIMEOUT
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
}

async function initiateComputeAssessment(
    awsAccountId: string,
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string
) {
    logger.info('Initiate compute assessment', {
        awsAccountId,
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName
    });
    let errorMessage = '';

    // P.S: As per email thread "Proposal for Job Monitoring events", job creation here is likely not required.. Commenting out for now, will be added back if needed

    // let jobStatus: string = JOBSTATUS.COMPLETED;

    // const { id: jobId } = await registerJob(accountId, credentialsId, region, {
    //     name: 'Database host is being scanned for compute best practice misalignments.',
    //     description: 'Database host is being scanned for compute best practice misalignments.',
    //     resourceName: resourceName!,
    //     initiator: AssessmentTriggeredBy.USER,
    //     startTime: Date.now(),
    //     status: JOBSTATUS.IN_PROGRESS,
    //     type: JOBTYPE.ASSESSMENT
    // }); // just creating the job and not returning the jobId as we are not using it anywhere; the compute assessment job will be a part of jobs dashboard

    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);

        const resourceArn = getEc2Arn(awsAccountId, region, databaseHostId);
        const computeOptimizerInstanceRecommendations = await getEC2InstanceRecommendations(
            region,
            credentialsId,
            accountId,
            {
                instanceArns: [resourceArn],
                recommendationPreferences: {
                    cpuVendorArchitectures: [CpuVendorArchitecture.CURRENT] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
                }
            }
        );
        const {
            instanceRecommendations: [
                {
                    currentInstanceType = '',
                    finding = '',
                    findingReasonCodes = [],
                    recommendationOptions: coRecOptions = []
                } = {}
            ] = []
        } = computeOptimizerInstanceRecommendations || {};
        return {
            currentInstanceType,
            finding,
            findingReasonCodes,
            recommendationOptions: coRecOptions?.map(({ instanceType, rank, savingsOpportunity }) => ({
                instanceType,
                rank,
                savingsOpportunity
            }))
        };
    } catch (error: any) {
        errorMessage = `Failed to get compute optimizer recommendation options for the selected database host during Continuous Assessment. ${error.message}`;
        logger.error({ errorMessage, error });
        // jobStatus = JOBSTATUS.FAILED;
        throw Error(errorMessage);
    }
    // finally {
    //     await updateJobDetails(accountId, credentialsId, region, jobId, {
    //         error: errorMessage,
    //         description:
    //             'The selected daatabase host has been scanned for compute best practice misalignments. Review detailed findings and recommendations in <Instance optimization dashboard>.',
    //         status: jobStatus!,
    //         endTime: Date.now()
    //     });
    // }
}

async function driftAssessment(
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
        // https://jira.ngage.netapp.com/browse/DBS-4127 fix
        await Promise.map(
            databaseInstanceRecords,
            async databaseInstanceRecord => {
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
            },
            {
                concurrency: 1
            }
        );
    } catch (e: any) {
        logger.error(e);
        errorMessage = e.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        const instanceNames = databaseInstanceRecords.map(i => i.name);
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            error: errorMessage,
            description: `SQL Server instance(s) ${instanceNames.join(
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
                const { activeNodeInstanceId, newDatabaseInstanceDetails, cloudProviderAccountId } =
                    await getInstanceDetails(accountId, credentialsId, region, databaseHostId, databaseInstanceId);
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
                    fsxFileSystem: fileSystemId,
                    cloudProviderAccountId: cloudProviderAccountId || '',
                    resourceName: resourceName || ''
                };
                runningInstances.push(instanceRecord);
            })
        );
    } catch (error) {
        logger.error(`Error while fetching database instance details ${accountId}, ${databaseHostId}, ${error}`);
    }

    const instanceNames = runningInstances.map(i => i.name);
    if (!isEmpty(runningInstances)) {
        const jobString = `SQL Server instance(s) ${instanceNames.join(
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

        driftAssessment(accountId, credentialsId, region, job.id, databaseHostId, runningInstances, fields);

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
    const driftAssessmentData: DriftAssessmentResponseType = {};
    const shouldCalculateStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
    const shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());

    const [storageAssessmentResponse, computeAssessmentResponse] = await Promise.all([
        shouldCalculateStorageAssessment
            ? calculateStorageDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateComputeAssessment
            ? calculateComputeDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({})
    ]);

    if (!isEmpty(storageAssessmentResponse)) {
        driftAssessmentData.storage = storageAssessmentResponse;
    }

    if (!isEmpty(computeAssessmentResponse)) {
        driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
    }
    return driftAssessmentData;
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

export { triggerDriftAssessment, fetchDriftAssessment, driftAssessment, calculateStorageDrift };
