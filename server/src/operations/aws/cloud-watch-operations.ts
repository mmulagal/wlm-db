import { Statistic, GetMetricStatisticsCommandInput } from '@aws-sdk/client-cloudwatch';
import ms from 'ms';
import getMetricStatistics from '../../lib/aws/cloud-watch';
import getLogger from '../../utils/logger';
import { describeFSx } from '../../lib/aws/fsx';

const logger = getLogger();

async function calculateFsxnStorageEfficiencyUsingCloudwatch(
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
        Period: 24 * 60 * 60, // 1 day
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
        Period: 24 * 60 * 60, // 1 day
        StartTime: new Date(Date.now() - ms('1d')),
        Statistics: ['Average'],
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
    let storageUsedAverage;
    if (storageUsedData.Datapoints) {
        [{ Average: storageUsedAverage }] = storageUsedData.Datapoints;
    } else {
        const errorMessage = 'Storage used data not found';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    if (storageEfficiencySavingsAverage !== undefined && storageUsedAverage !== undefined) {
        const totalLogicalDataStored = storageEfficiencySavingsAverage + storageUsedAverage; // includes both the data that's actually using physical storage space (storageUsedAverage) and the data that's been saved due to storage efficiency features (storageEfficiencySavingsAverage).
        const storageEfficiencySavingsPercentage =
            totalLogicalDataStored > 0 ? (storageEfficiencySavingsAverage / totalLogicalDataStored) * 100 : 0;

        return {
            totalSize: fsxnInfo?.FileSystems?.[0].StorageCapacity || 0,
            totalUsed: totalLogicalDataStored,
            totalSpaceSavings: storageEfficiencySavingsAverage,
            totalSpaceSavingsPercentage: storageEfficiencySavingsPercentage
        };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

async function calculateFsxwStorageEfficiencyUsingCloudwatch(
    region: string,
    credentialsId: string,
    fileSystemId: string
) {
    logger.info('Calculating storage efficiency for FSx for Windows:', { region, credentialsId, fileSystemId });

    // https://docs.aws.amazon.com/fsx/latest/WindowsGuide/fsx-windows-metrics.html

    const deduplicationSavedStorageAverageParams: GetMetricStatisticsCommandInput = {
        EndTime: new Date(),
        MetricName: 'DeduplicationSavedStorage',
        Namespace: 'AWS/FSx',
        Period: 24 * 60 * 60, // 1 day
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
        Period: 24 * 60 * 60, // 1 day
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
            totalSize: fsxwInfo?.FileSystems?.[0]?.StorageCapacity || 0,
            totalUsed: storageCapacityUtilizationAverage,
            totalSpaceSavings: deduplicationSavedStorageAverage,
            totalSpaceSavingsPercentage: storageSavingsPercentage
        };
    }
    const errorMessage = 'Storage efficiency savings average and used storage sum not found';
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

async function getEbsVolumeUtilization(region: string, credentialsId: string, ebsVolumeIds: string[] = []) {
    logger.debug('Get EBS volume utilization:', { region, credentialsId, ebsVolumeIds });
    const paramsEbsRead = {
        Namespace: 'AWS/EBS',
        MetricName: 'VolumeReadBytes',
        Dimensions: ebsVolumeIds.map(ebsVolumeId => ({ Name: 'VolumeId', Value: ebsVolumeId })),
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 6 * 60 * 60,
        Statistics: [Statistic.Sum]
    };
    const paramsEbsWrite = {
        Namespace: 'AWS/EBS',
        MetricName: 'VolumeWriteBytes',
        Dimensions: ebsVolumeIds.map(ebsVolumeId => ({ Name: 'VolumeId', Value: ebsVolumeId })),
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 6 * 60 * 60,
        Statistics: [Statistic.Sum]
    };

    const [{ Datapoints: dataEbsReadDatapoints }, { Datapoints: dataEbsWriteDatapoints }] = await Promise.all([
        getMetricStatistics(credentialsId, region, paramsEbsRead),
        getMetricStatistics(credentialsId, region, paramsEbsWrite)
    ]);

    let totalEbsRead = 0;
    let totalEbsWrite = 0;
    dataEbsReadDatapoints?.forEach(dataPoint => {
        totalEbsRead += dataPoint?.Sum || 0;
        return totalEbsRead;
    });
    dataEbsWriteDatapoints?.forEach(dataPoint => {
        totalEbsWrite += dataPoint?.Sum || 0;
        return totalEbsWrite;
    });
    const totalEbsThroughputGbps = totalEbsRead + totalEbsWrite / paramsEbsRead.Period / (1024 * 1024 * 1024); // These metrics are reported in bytes. Convert to Mib/sec

    return totalEbsThroughputGbps;
}

async function getInstanceUtilization(region: string, credentialsId: string, instanceIds: string[]) {
    logger.info('Calculating instance utilization:', { region, credentialsId, instanceIds });

    const paramsCpu = {
        Namespace: 'AWS/EC2',
        MetricName: 'CPUUtilization',
        Dimensions: instanceIds.map(instanceId => ({ Name: 'InstanceId', Value: instanceId })),
        StartTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 300,
        Statistics: [Statistic.Maximum]
    };
    const paramsNetworkIn = {
        Namespace: 'AWS/EC2',
        MetricName: 'NetworkIn',
        Dimensions: instanceIds.map(instanceId => ({ Name: 'InstanceId', Value: instanceId })),
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 300,
        Statistics: [Statistic.Average]
    };

    const paramsNetworkOut = {
        Namespace: 'AWS/EC2',
        MetricName: 'NetworkOut',
        Dimensions: instanceIds.map(instanceId => ({ Name: 'InstanceId', Value: instanceId })),
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 300,
        Statistics: [Statistic.Average]
    };

    const [{ Datapoints: cpuDatapoints }, { Datapoints: networkInDatapoints }, { Datapoints: networkOutDatapoints }] =
        await Promise.all([
            getMetricStatistics(credentialsId, region, paramsCpu),
            getMetricStatistics(credentialsId, region, paramsNetworkIn),
            getMetricStatistics(credentialsId, region, paramsNetworkOut)
        ]);

    const peakCpuUtilizationPercentage =
        cpuDatapoints?.reduce((acc, curr) => (curr.Maximum && curr.Maximum > acc ? curr.Maximum : acc), 0) || 0;
    const maxAverageBytesIn =
        networkInDatapoints?.reduce((acc, curr) => (curr.Average && curr.Average > acc ? curr.Average : acc), 0) || 0;
    const maxAverageBytesOut =
        networkOutDatapoints?.reduce((acc, curr) => (curr.Average && curr.Average > acc ? curr.Average : acc), 0) || 0;

    const averageNetworkBandwidthGbps =
        (maxAverageBytesIn + maxAverageBytesOut) / paramsNetworkIn.Period / (1024 * 1024 * 1024);

    return { peakCpuUtilizationPercentage, averageNetworkBandwidthGbps };
}

export {
    calculateFsxnStorageEfficiencyUsingCloudwatch,
    calculateFsxwStorageEfficiencyUsingCloudwatch,
    getInstanceUtilization,
    getEbsVolumeUtilization
};
