import { GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import ms from 'ms';
import getMetricStatistics from '../../lib/aws/cloud-watch';
import getLogger from '../../utils/logger';

const logger = getLogger();

export default async function calculateFsxStorageEfficiency(
    region: string,
    credentialsId: string,
    fileSystemId: string
) {
    logger.info('Calculating storage efficiency for FSx for NetApp ONTAP:', { region, credentialsId, fileSystemId });

    // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/file-system-metrics.html#fsxn-storage-volume-metrics

    /* To calculate storage efficiency savings as a percentage of all data stored, over a one minute period, divide StorageEfficiencySavings by the sum of StorageEfficiencySavings and the StorageUsed file system metric, using the Sum statistic for StorageUsed. */

    const storageEfficiencyParams: GetMetricStatisticsCommandInput = {
        EndTime: new Date(),
        MetricName: 'StorageEfficiencySavings',
        Namespace: 'AWS/FSx',
        Period: 60, // 1 minute
        StartTime: new Date(Date.now() - ms('1d')),
        Statistics: ['Average'],
        Dimensions: [
            {
                Name: 'FileSystemId',
                Value: fileSystemId
            }
        ]
    };
    const storageEfficiencySavingsData = await getMetricStatistics(credentialsId, region, storageEfficiencyParams);

    let storageEfficiencySavingsAverage;
    if (storageEfficiencySavingsData.Datapoints?.length) {
        [{ Average: storageEfficiencySavingsAverage }] = storageEfficiencySavingsData.Datapoints;
    } else {
        const errorMessage = 'Storage efficiency savings data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
    const storageUsedParams: GetMetricStatisticsCommandInput = {
        EndTime: new Date(),
        MetricName: 'StorageUsed',
        Namespace: 'AWS/FSx',
        Period: 60, // 1 minute
        StartTime: new Date(Date.now() - ms('1d')),
        Statistics: ['Sum'],
        Dimensions: [
            {
                Name: 'FileSystemId',
                Value: fileSystemId
            }
        ]
    };
    const storageUsedData = await getMetricStatistics(credentialsId, region, storageUsedParams);

    let storageUsedSum;
    if (storageUsedData.Datapoints) {
        [{ Sum: storageUsedSum }] = storageUsedData.Datapoints;
    } else {
        const errorMessage = 'Storage used data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    if (storageEfficiencySavingsAverage && storageUsedSum) {
        const totalLogicalDataStored = storageEfficiencySavingsAverage + storageUsedSum; // includes both the data that's actually using physical storage space (storageUsedSum) and the data that's been saved due to storage efficiency features (storageEfficiencySavingsAverage).
        const storageEfficiencySavingsPercentage = (storageEfficiencySavingsAverage / totalLogicalDataStored) * 100;

        return { storageEfficiencySavingsAverage, storageEfficiencySavingsPercentage };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}
