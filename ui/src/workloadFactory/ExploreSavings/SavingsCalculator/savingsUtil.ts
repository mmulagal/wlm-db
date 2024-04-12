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
