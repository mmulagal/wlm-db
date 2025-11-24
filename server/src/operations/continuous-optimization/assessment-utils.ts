import Ajv, { ValidateFunction } from 'ajv';
import { JOBSTATUS } from '@prisma/client';
import createError from 'http-errors';
import ms from 'ms';
import { GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import { getJobs, registerJob } from '../database/job-operations';
import {
    calculateFsxStorageCapacityForHeadroomOptimization,
    convertToBytes,
    getTimeDifferenceInMinutes
} from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    AssessmentCategoriesOracle,
    AssessmentStatus,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import type { JobMetadata } from '../../utils/common-types';
import { OracleJobMetadata } from './oracle/consts';
import getMissingPermissionsList from '../aws/iam-operations';
import { getFsxStorageDetails } from '../aws/fsx-operations';
import { RESOURCESTYPE } from '../../utils/consts';
import { getMetricStatistics } from '../../lib/aws/cloud-watch';

const logger = getLogger();

const ajv = new Ajv();
const validatorCache = new WeakMap<object, ValidateFunction>();

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
        typeFilter: jobType,
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

function validateAssessment(schema: object, assessmentData: unknown) {
    let validate = validatorCache.get(schema);

    if (!validate) {
        validate = ajv.compile(schema);
        validatorCache.set(schema, validate);
    }

    const isValid = validate(assessmentData);

    return {
        isValid,
        errors: validate.errors || []
    };
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

async function getHeadroomDrift(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    resourceType: RESOURCESTYPE.MSSQL | RESOURCESTYPE.ORACLE
) {
    logger.info('Getting headroom drift', { credentialsId, region, fileSystemId, resourceType });

    try {
        const { ssdStorageCapacityInBytes } = await getFsxStorageDetails(credentialsId, region, fileSystemId);

        const cwMetricsDataCollectionPeriodSeconds = 1 * 60 * 60; // 1 hour
        const cwMetricsDataCollectionPeriod = '1h'; // 1 hour

        let totalUsed = 0;
        const storageUsedParams: GetMetricStatisticsCommandInput = {
            EndTime: new Date(),
            MetricName: 'StorageUsed',
            Namespace: 'AWS/FSx',
            Period: cwMetricsDataCollectionPeriodSeconds,
            StartTime: new Date(Date.now() - ms(cwMetricsDataCollectionPeriod)),
            Statistics: ['Average'],
            Dimensions: [
                {
                    Name: 'StorageTier',
                    Value: 'SSD'
                },
                {
                    Name: 'FileSystemId',
                    Value: fileSystemId
                },
                {
                    Name: 'DataType',
                    Value: 'All'
                }
            ]
        };
        const storageUsedMetric = await getMetricStatistics(credentialsId, region, storageUsedParams);

        if (storageUsedMetric.Datapoints) {
            [{ Average: totalUsed }] = storageUsedMetric.Datapoints;
        } else {
            const errorMessage = 'Storage used data not found in CloudWatch metrics in last hour';
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        const headroomPercent = Math.ceil(((ssdStorageCapacityInBytes - totalUsed) / ssdStorageCapacityInBytes) * 100);
        const minSSdStorageCapacityInBytes = convertToBytes(1024, 'GiB');
        const minOptimizedHeadroomPercent = MIN_OPTIMIZED_HEADROOM_PERCENTAGE[resourceType];
        const status =
            headroomPercent < minOptimizedHeadroomPercent
                ? AssessmentStatus.UNDER_PROVISIONED
                : headroomPercent > 100 && ssdStorageCapacityInBytes > minSSdStorageCapacityInBytes! // if overprovisioned, consider optimized if fsxSSDCapacity is 1024 GiB which is the case of smaller databases
                ? AssessmentStatus.OVER_PROVISIONED
                : AssessmentStatus.OPTIMIZED;

        // Check for 'fsx:UpdateFileSystem' permissions
        let missingPermissions: string[] = [];
        let newFsxStorageCapacityGiB = 0;
        if (status !== AssessmentStatus.OPTIMIZED) {
            missingPermissions =
                (await checkForMissingOptimizePermissions(credentialsId, region, ['fsx:UpdateFileSystem'])) || [];
            newFsxStorageCapacityGiB = calculateFsxStorageCapacityForHeadroomOptimization(
                totalUsed,
                ssdStorageCapacityInBytes,
                resourceType
            );
        }

        return {
            status,
            headroomPercent,
            ssdStorageCapacityInBytes,
            totalUsed,
            missingPermissions,
            newFsxStorageCapacityGiB
        };
    } catch (error) {
        logger.error('Error fetching FSx storage details or CloudWatch metrics', {
            credentialsId,
            region,
            fileSystemId,
            resourceType,
            error
        });
        throw error;
    }
}

export {
    getMatchingAssessmentStatus,
    handleOptimizeJobCreation,
    hasNotOptimizedStatus,
    getLatestInstanceAssessmentTime,
    validateAssessment,
    UnOptimizedDiskGroups,
    checkForMissingOptimizePermissions,
    getHeadroomDrift
};

// Re-export type for external usage without creating a runtime export
export type { JobMetadata };
