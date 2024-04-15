export const comparisonData = (calculatedResponse: any) => {
    return [
        {
            type: 'Capacity',
            fsx: calculatedResponse?.fsx?.capacity,
            ebs: calculatedResponse?.ebs?.capacity
        },
        {
            type: 'IOPS',
            fsx: calculatedResponse?.fsx?.iops,
            ebs: calculatedResponse?.ebs?.iops
        },
        {
            type: 'Throughput',
            fsx: calculatedResponse?.fsx?.throughput,
            ebs: calculatedResponse?.ebs?.throughput
        },
        {
            type: 'Snapshots',
            fsx: calculatedResponse?.fsx?.snapshots,
            ebs: calculatedResponse?.ebs?.snapshots
        },
        {
            type: 'Clone',
            fsx: calculatedResponse?.fsx?.clone,
            ebs: calculatedResponse?.ebs?.clone
        },
        {
            type: 'Compute',
            fsx: calculatedResponse?.fsx?.compute,
            ebs: calculatedResponse?.ebs?.compute
        },
        {
            type: 'SQL license',
            fsx: calculatedResponse?.fsx?.license,
            ebs: calculatedResponse?.ebs?.license
        },
        {
            type: 'Total summary',
            fsx: calculatedResponse?.fsx?.total,
            ebs: calculatedResponse?.ebs?.total
        }
    ];
};

export const calculatedFSXData = (fsxData: any) => {
    return [
        {
            label: 'Region',
            value: fsxData.regionName,
            text: 'The AWS region that you selected.'
        },
        {
            label: 'Deployment type',
            value: fsxData.deploymentType === 'Single' ? 'Single Availability Zone' : fsxData.deploymentType,
            text: `A ${fsxData.deploymentType} Availability Zone is the equivalent availability for Amazon EBS.`
        },
        {
            label: 'Total storage capacity',
            value: `${fsxData.totalStorageCapacity} TiB`,
            text: 'The number of volumes that you need times the selected volume size.'
        },

        {
            label: 'Percentage of data on SSD storage',
            value: fsxData.precentageSSD + '%',
            text: `The potential percentage of data stored on the SSD tier for a typical ${fsxData.useCase} workload when using FSx for ONTAP data tiering capabilities.`
        },
        {
            label: 'Savings from compression + deduplication',
            value: fsxData.savings + '%',
            text: `Potential storage savings for ${fsxData.useCase} workload. Storage efficiency is based on a typical customer deployment.`
        },
        {
            label: 'Effective capacity',
            value: `${fsxData.effectiveCapacity.toFixed(2)} TiB`,
            text: `Cost reduction based on ${fsxData.savings}% savings from the compression and deduplication features available with FSx for ONTAP.`
        },
        {
            label: 'SSD tier required capacity',
            value: `${fsxData.ssdTierReqCapacity.toFixed(2)} TiB`,
            text: `Based on a typical ${fsxData.useCase} workload, ${fsxData.precentageSSD}% of the data is on the SSD tier.`
        },
        {
            label: 'Capacity pool tier required capacity',
            value: `${fsxData.capacityPoolTier.toFixed(2)} TiB`,
            text: `Based on a typical ${fsxData.useCase} workload, ${
                100 - fsxData.precentageSSD
            }% of the data is on the capacity pool tier.`
        },
        {
            label: 'Provisioned SSD IOPS',
            value: fsxData.ssdIop,
            text: 'For each GiB of SSD provisioned storage, Amazon FSx automatically provisions 3 SSD IOPS for the file system.'
        },
        {
            label: 'Throughput capacity',
            value: `${fsxData.throughputCapacity} MBps`,
            text: `Supported FSx for ONTAP throughput according to the consolidated EBS throughput required (${
                fsxData.numberOfVolumes * fsxData.throughput
            } Mbps).`
        },
        {
            label: 'Monthly snapshot capacity',
            value: `${fsxData.monthlySnapshotCapacity} GiB`,
            text: 'Cost reduction is based on FSx for ONTAP data tiering capability. 90% of snapshots data will be tiered to the capacity pool tier.'
        }
    ];
};

export const MSSQLServerInstance = (sqlData: any) => {
    return [
        {
            label: 'Database deployment mode',
            value: `${sqlData.deploymentMode}`,
            text: 'Based on source deployment mode of Always On Availability Group, the equivalent deployment mode on FsxN is Failover cluster instance'
        },
        {
            label: 'Database edition',
            value: `${sqlData.edition}`,
            text: 'Complete'
        },
        {
            label: 'Database version',
            value: `${sqlData.serverType}`,
            text: 'Based on the source SQL server version'
        },
        {
            label: 'DB Instance type',
            value: `${sqlData.instance}`,
            text: 'Based on the source Ec2 instance type'
        }
    ];
};
