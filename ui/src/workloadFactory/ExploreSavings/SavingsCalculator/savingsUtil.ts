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

export const viewCalculation = (viewCalculation: any) => {
    return {
        Ec2InstanceCalculation: [
            {
                label: 'MsSQL Ec2 Instances calculation',
                mainHeading: true
            },
            {
                label: 'Machine 1 specification'
            },
            {
                label: 'Instance type',
                value: `${viewCalculation.Ec2InstanceCalculation.instanceType}`,
                text: ''
            },
            {
                label: 'Machine 1 pricing calculations'
            },
            {
                label: 'Instance hourly price',
                value: `${viewCalculation.Ec2InstanceCalculation.instanceHourlyPrice}`,
                text: ''
            },
            {
                label: 'Ec2 machine1 cost',
                value: `${viewCalculation.Ec2InstanceCalculation.ec2MachineCost}`,
                text: `Instance hourly price x number of hours in a month = ${viewCalculation.Ec2InstanceCalculation.instanceHourlyPrice} $ x 730`
            }
        ],
        FSxNCalculation: [
            {
                label: 'FSxN calculation',
                mainHeading: true
            },
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.FSxNCalculation.storageCapacity}`,
                text: `EBS capacity ${viewCalculation.FSxNCalculation.ebsCapacity} TiB x Number of volumes ${viewCalculation.FSxNCalculation.volumes} x 1024 `
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `${viewCalculation.FSxNCalculation.ssdStorage}%`,
                text: ''
            },
            {
                label: 'Savings from compression & deduplication',
                value: `${viewCalculation.FSxNCalculation.deduplication}%`,
                text: ''
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication ',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.deduplication} GiB`,
                text: `Desired storage capacity x Savings from compression & deduplication (xx%)`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.storageCapacity} GiB`,
                text: `Desired storage capacity  - Storage savings from compression & deduplication`
            },
            {
                label: 'SSD storage GIB per month',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.ssdStorage} GiB`,
                text: `Effective storage capacity for FSx for ONTAP  x Percentage of data on SSD storage `
            },
            {
                label: 'The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.minSSDStorage} GiB`,
                text: ``
            },
            {
                label: 'SSD monthly cost ',
                value: `$ ${viewCalculation.FSxNCalculation.priceCalculation.ssdMonthlyCost}`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity x SSD storage price `
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - SSD storage capacity',
                value: `$ ${viewCalculation.FSxNCalculation.priceCalculation.totalMonthlyCostStorageCapacity}`,
                text: `$ ${viewCalculation.FSxNCalculation.priceCalculation.totalMonthlyCostStorageCapacity} `
            },
            {
                label: 'Ratio after savings from compression & deduplication factor',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.deduplicationFactor}%`,
                text: `$ ${viewCalculation.FSxNCalculation.priceCalculation.deduplicationFactor} `
            },
            {
                label: 'Data on capacity pool storage factor',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.storageFactor}%`,
                text: `100% - Percentage of data on SSD storage`
            },
            {
                label: 'Capacity pool storage capacity',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.storageCapacity} GiB`,
                text: `Desired storage capacity x Ratio after savings from compression & deduplication factor x Data on capacity pool storage factor `
            },
            {
                label: 'Capacity pool storage capacity',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.capacityMonthlyCost}`,
                text: `Desired storage capacity x Ratio after savings from compression & deduplication factor x Data on capacity pool storage factor `
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Capacity pool storage capacity',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.capacityPoolStorageCapacity}`,
                text: ` `
            },
            {
                label: 'Total storage charge (monthly)',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.totalStorageCharge}`,
                text: `Total monthly cost for FSx for NetApp ONTAP file server capacity pool storage capacity`
            },
            {
                label: 'Minimum number of file systems required for storage capacity',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.minFileSystem}`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity ÷ Max SSD tier size 192 TiB`
            },
            {
                label: 'Minimum number of file systems required for throughout capacity',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.throughputCapacity}`,
                text: `Suggested FSx for ONTAP throughout capacity ÷ max throughput MB/s`
            },
            {
                label: 'Minimum number of file systems required for SSD IOPS',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.sddIOPS}`,
                text: `Provisioned SSD IOPS ÷ Maximum SSD IOPS`
            },
            {
                label: 'Required number of FSx file systems - fractional',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.fractional}`,
                text: ``
            },
            {
                label: 'Required number of FSx file systems',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.fileSystems}`,
                text: ``
            },
            {
                label: 'Minimum throughout capacity required',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.capacityRequired}`,
                text: `Required number of FSx file systems x Min throughput capacity GiB `
            },
            {
                label: 'Provisioned throughput capacity',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.provisionedThroughputCapacity} GiB`,
                text: ``
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Throughput capacity',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.totalMonthlyCostThroughputCapacity}`,
                text: ` Provisioned throughput capacity  x FSx for ONTAP throughput price`
            },
            {
                label: 'Included SSD IOPS',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.includedSSDIOPS}`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity x Included IOPS÷GIB `
            },
            {
                label: 'Additional SSD IOPS',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.additionalSSDIOPS}`,
                text: `Provisioned SSD IOPS - Included SSD IOPS`
            },
            {
                label: 'Billed additional SSD IOPS',
                value: `${viewCalculation.FSxNCalculation.priceCalculation.billedSSD}`,
                text: ``
            },
            {
                label: 'Additional billed cost for SSD IOPS',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.additionalBilledCost}`,
                text: `Billed additional SSD IOPS x FSx for ONTAP IOPS price`
            },
            {
                label: 'Total throughput and IOPS (monthly)',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.totalThroughputIOPS}`,
                text: `Additional billed cost for SSD IOPS + Total monthly cost for FSx for NetApp ONTAP file server throughput capacity `
            },
            {
                label: 'Total monthly cost',
                value: `$(${viewCalculation.FSxNCalculation.priceCalculation.totalMonthlyCost})`,
                text: `Total throughput and IOPS (monthly) + total storage charge (monthly) `
            }
        ]
    };
};

export const viewCalculationForEBS = (viewCalculation: any) => {
    return {
        Ec2InstanceCalculation: [
            {
                label: 'MsSQL Ec2 Instances calculation',
                mainHeading: true
            },
            {
                label: 'Machine 1 specification'
            },
            {
                label: 'Instance type',
                value: `${viewCalculation.Ec2InstanceCalculation.instanceType}`,
                text: ''
            },
            {
                label: 'Machine 1 pricing calculations'
            },
            {
                label: 'Instance hourly price',
                value: `${viewCalculation.Ec2InstanceCalculation.instanceHourlyPrice}`,
                text: ''
            },
            {
                label: 'Ec2 machine1 cost',
                value: `${viewCalculation.Ec2InstanceCalculation.ec2MachineCost}`,
                text: `Instance hourly price x number of hours in a month = ${viewCalculation.Ec2InstanceCalculation.instanceHourlyPrice} $ x 730`
            }
        ],
        EBSCalculation: [
            {
                label: 'EBS calculation',
                mainHeading: true
            },
            {
                label: 'Unit conversions'
            },
            {
                label: 'Storage amount per volume',
                value: `${viewCalculation.EBSCalculation.storageCapacity}`,
                text: `Storage amount per volume x 1024`
            },

            {
                label: 'Pricing calculations'
            },
            {
                label: 'Total instance hours',
                value: `${viewCalculation.EBSCalculation.priceCalculation.totalInstanceHour}`,
                text: `Number of volumes x Average duration each instance runs ${viewCalculation.EBSCalculation.priceCalculation.totalInstanceHour} hours`
            },
            {
                label: 'Instance months',
                value: `${viewCalculation.EBSCalculation.priceCalculation.instanceMonth} month`,
                text: `Total instance hours  ÷ hours in a month`
            },
            {
                label: 'EBS storage cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.ebsStorageCost}`,
                text: `Storage amount per volume x instance months x EBS capacity price ${viewCalculation.EBSCalculation.priceCalculation.ebsStorageCost}`
            },
            {
                label: 'Billable IOPS',
                value: `${viewCalculation.EBSCalculation.priceCalculation.billableIOPS} IOPS`,
                text: ``
            },
            {
                label: 'Total billable IOPS ',
                value: `$ ${viewCalculation.EBSCalculation.priceCalculation.totalBillableIOPS}`,
                text: ``
            },
            {
                label: 'EBS IOPS cost',
                value: `$ ${viewCalculation.EBSCalculation.priceCalculation.ebsIOPSCost}`,
                text: ``
            },
            {
                label: 'Billable MB/s',
                value: `${viewCalculation.EBSCalculation.priceCalculation.billableMbps} MB/s`,
                text: ``
            },
            {
                label: 'Billable throughput (MB/s)',
                value: `${viewCalculation.EBSCalculation.priceCalculation.billableThroughputMbps} MB/s`,
                text: ``
            },
            {
                label: 'Billable throughput (GB/s))',
                value: `${viewCalculation.EBSCalculation.priceCalculation.billableThroughputGbps} GB/s`,
                text: `Billable throughput (MB/s) ÷ 1024`
            },
            {
                label: 'EBS throughput cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.ebsThroughCost}`,
                text: ``
            },
            {
                label: 'Total snapshots',
                value: `${viewCalculation.EBSCalculation.priceCalculation.totalSnapshots}`,
                text: ` `
            },
            {
                label: 'Initial snapshot cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.initialSnapshotCost}`,
                text: ``
            },
            {
                label: 'Monthly cost of each snapshot',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.monthlyCostOFEachSnapshot}`,
                text: ``
            },
            {
                label: 'Discount for partial storage month',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.discountForPartialStorage}`,
                text: `Monthly cost of each snapshot x discount for partial storage month (xxx)%`
            },
            {
                label: 'Incremental snapshot cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.incrementSnapshotCost}`,
                text: `(Monthly cost of each snapshot - discount for partial storage month) x Total snapshots `
            },
            {
                label: 'Total snapshot cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.totalSnapshotCost}`,
                text: `Initial snapshot cost + Incremental snapshot cost `
            },
            {
                label: 'Total EBS snapshot cost',
                value: `${viewCalculation.EBSCalculation.priceCalculation.totalEBSSnapshotCost}`,
                text: `Total snapshot cost  x instance months`
            },
            {
                label: 'EBS snapshot cost',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.ebsSnapshotCost}`,
                text: ``
            },
            {
                label: 'Amazon Elastic Block Storage (EBS) total cost (monthly)',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.amazonElasticBlock}`,
                text: `EBS snapshot cost + EBS throughput cost + EBS IOPS cost + EBS storage cost `
            }
        ]
    };
};
