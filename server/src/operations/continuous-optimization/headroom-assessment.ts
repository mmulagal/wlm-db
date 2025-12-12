import ms from 'ms';
import { GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { describeFSx, updateFsxCapacity } from '../../lib/aws/fsx';
import { AuditStatus, RESOURCESTYPE } from '../../utils/consts';
import { AssessmentStatus, MIN_OPTIMIZED_HEADROOM_PERCENTAGE } from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { calculateFsxStorageCapacityForHeadroomOptimization, convertToBytes } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { updateJobDetails } from '../database/job-operations';
import { handleOptimizeJobCreation, checkForMissingOptimizePermissions } from './assessment-utils';
import { getMetricStatistics } from '../../lib/aws/cloud-watch';
import { getFsxStorageDetails } from '../aws/fsx-operations';

const logger = getLogger();

async function getHeadroomDrift(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    resourceType: RESOURCESTYPE.MSSQL | RESOURCESTYPE.ORACLE
) {
    logger.info('Getting headroom drift', { credentialsId, region, fileSystemId, resourceType });

    try {
        const { ssdStorageCapacityInBytes } = await getFsxStorageDetails(credentialsId, region, fileSystemId, {
            useCache: false
        });

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
                : headroomPercent > 50 && ssdStorageCapacityInBytes > minSSdStorageCapacityInBytes! // if overprovisioned, consider optimized if fsxSSDCapacity is 1024 GiB which is the case of smaller databases
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

async function headroomOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    parentJobId: string,
    serverNameWithHostName: string,
    resourceType: RESOURCESTYPE.MSSQL | RESOURCESTYPE.ORACLE
) {
    logger.info('Optimizing FSx for NetApp ONTAP headroom ', { accountId, credentialsId, region, fileSystemId });
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        'Increasing FSx capacity for optimized NetApp ONTAP headroom',
        'Increasing FSx capacity for optimized NetApp ONTAP headroom',
        parentJobId
    );

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage;
    try {
        const { headroomPercent, ssdStorageCapacityInBytes, totalUsed } = await getHeadroomDrift(
            credentialsId,
            region,
            fileSystemId,
            resourceType
        );

        const minOptimizedHeadroomPercent = MIN_OPTIMIZED_HEADROOM_PERCENTAGE[resourceType];
        if (headroomPercent < minOptimizedHeadroomPercent) {
            logger.info(`Under provisioned: Headroom is less than ${minOptimizedHeadroomPercent}%`);

            const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] }, undefined, {
                useCache: true
            });
            const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
            const existingFsxStorageCapacityGiB = fileSystem?.StorageCapacity;
            const newFsxStorageCapacityGiB = calculateFsxStorageCapacityForHeadroomOptimization(
                totalUsed,
                ssdStorageCapacityInBytes,
                resourceType
            );
            if (existingFsxStorageCapacityGiB && existingFsxStorageCapacityGiB < newFsxStorageCapacityGiB) {
                await updateFsxCapacity(credentialsId, region, accountId, fileSystemId, newFsxStorageCapacityGiB);
            } else {
                jobStatus = JOBSTATUS.WARNING;
                errorMessage =
                    'Headroom configuration changed since the last assessment and meets best practices. No action required.';
            }
        } else {
            jobStatus = JOBSTATUS.WARNING;
            errorMessage = `Headroom is more than ${minOptimizedHeadroomPercent}%, no action required`;
        }
    } catch (error) {
        errorMessage = `Error while fixing headroom sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobStatus === JOBSTATUS.COMPLETED ? '' : errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

export { headroomOptimization, getHeadroomDrift };
