import { GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import ms from 'ms';
import getMetricStatistics from '../../lib/aws/cloud-watch';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function calculateFsxnStorageEfficiency(region: string, credentialsId: string, fileSystemId: string) {
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

    if (storageEfficiencySavingsAverage !== undefined && storageUsedSum !== undefined) {
        const totalLogicalDataStored = storageEfficiencySavingsAverage + storageUsedSum; // includes both the data that's actually using physical storage space (storageUsedSum) and the data that's been saved due to storage efficiency features (storageEfficiencySavingsAverage).
        const storageEfficiencySavingsPercentage =
            totalLogicalDataStored > 0 ? (storageEfficiencySavingsAverage / totalLogicalDataStored) * 100 : 0;

        return { storageEfficiencySavingsAverage, storageEfficiencySavingsPercentage };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

async function calculateFsxwStorageEfficiency(region: string, credentialsId: string, fileSystemId: string) {
    logger.info('Calculating storage efficiency for FSx for Windows:', { region, credentialsId, fileSystemId });

    // https://docs.aws.amazon.com/fsx/latest/WindowsGuide/fsx-windows-metrics.html

    const deduplicationSavedStorageAverageParams: GetMetricStatisticsCommandInput = {
        EndTime: new Date(),
        MetricName: 'DeduplicationSavedStorage',
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
    const deduplicationSavedStorageAverageData = await getMetricStatistics(
        credentialsId,
        region,
        deduplicationSavedStorageAverageParams
    );

    let deduplicationSavedStorageAverage;
    if (deduplicationSavedStorageAverageData.Datapoints?.length) {
        [{ Average: deduplicationSavedStorageAverage }] = deduplicationSavedStorageAverageData.Datapoints;
    } else {
        const errorMessage = 'Deduplication storage savings data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
    const storageCapacityUtilizationParams: GetMetricStatisticsCommandInput = {
        EndTime: new Date(),
        MetricName: 'StorageCapacityUtilization',
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
    const storageCapacityUtilizationData = await getMetricStatistics(
        credentialsId,
        region,
        storageCapacityUtilizationParams
    );
    let storageCapacityUtilizationAverage;
    if (storageCapacityUtilizationData.Datapoints) {
        [{ Average: storageCapacityUtilizationAverage }] = storageCapacityUtilizationData.Datapoints;
    } else {
        const errorMessage = 'Storage used data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
    if (deduplicationSavedStorageAverage !== undefined && storageCapacityUtilizationAverage !== undefined) {
        const totalLogicalDataStored = (deduplicationSavedStorageAverage * 100) / storageCapacityUtilizationAverage;
        /*

        The storageCapacityUtilizationAverage metric represents the percentage of the total storage capacity that is currently in use. It's a value between 0 and 100. if the data were 100 then the storage capacity utilization is storageCapacityUtilizationAverage. what would be the value if the saved storage is deduplicationSavedStorageAverage ?

        100 -> storageCapacityUtilizationAverage
        ?   -> deduplicationSavedStorageAverage

        100 * deduplicationSavedStorageAverage = storageCapacityUtilizationAverage * ?
        ? = (100 * deduplicationSavedStorageAverage) / storageCapacityUtilizationAverage
        totalLogicalDataStored = (100 * deduplicationSavedStorageAverage) / storageCapacityUtilizationAverage;

        */

        const storageSavingsPercentage =
            totalLogicalDataStored > 0 ? (deduplicationSavedStorageAverage / totalLogicalDataStored) * 100 : 0;
        return { deduplicationSavedStorageAverage, storageSavingsPercentage };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

export { calculateFsxnStorageEfficiency, calculateFsxwStorageEfficiency };
