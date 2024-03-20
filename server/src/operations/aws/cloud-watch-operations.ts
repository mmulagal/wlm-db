import { GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import ms from 'ms';
import getMetricStatistics from '../../lib/aws/cloud-watch';
import getLogger from '../../utils/logger';
import { describeFSx } from '../../lib/aws/fsx';

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
    const [fsxnInfo, storageEfficiencySavingsData, storageUsedData] = await Promise.all([
        describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId!] }),
        getMetricStatistics(credentialsId, region, storageEfficiencyParams),
        getMetricStatistics(credentialsId, region, storageUsedParams)
    ]);

    let storageEfficiencySavingsAverage;
    if (storageEfficiencySavingsData.Datapoints?.length) {
        [{ Average: storageEfficiencySavingsAverage }] = storageEfficiencySavingsData.Datapoints;
    } else {
        const errorMessage = 'Storage efficiency savings data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
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

        return {
            totalSize: fsxnInfo?.FileSystems?.[0].StorageCapacity || 0,
            totalUsed: storageUsedSum,
            totalSpaceSavings: storageEfficiencySavingsAverage,
            totalSpaceSavingsPercentage: storageEfficiencySavingsPercentage
        };
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
    const [fsxwInfo, deduplicationSavedStorageAverageData, storageCapacityUtilizationData] = await Promise.all([
        describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId!] }),
        getMetricStatistics(credentialsId, region, deduplicationSavedStorageAverageParams),
        getMetricStatistics(credentialsId, region, storageCapacityUtilizationParams)
    ]);

    let deduplicationSavedStorageAverage;
    if (deduplicationSavedStorageAverageData.Datapoints?.length) {
        [{ Average: deduplicationSavedStorageAverage }] = deduplicationSavedStorageAverageData.Datapoints;
    } else {
        const errorMessage = 'Deduplication storage savings data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

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

        return {
            totalSize: fsxwInfo?.FileSystems?.[0].StorageCapacity || 0,
            totalUsed: storageCapacityUtilizationAverage,
            totalSpaceSavings: deduplicationSavedStorageAverage,
            totalSpaceSavingsPercentage: storageSavingsPercentage
        };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

export { calculateFsxnStorageEfficiency, calculateFsxwStorageEfficiency };
