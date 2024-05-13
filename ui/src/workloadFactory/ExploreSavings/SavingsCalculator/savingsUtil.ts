import { Dispatch } from 'redux';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    generateOptionType,
    removePasswordInConfig
} from '../../../utils/utilityFunctions';
import store from '../../../store/store';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { duplicateSaveCheck } from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsSaveConfigLoading, setSavedConfig } from '../../../store/mssql/msSqlActionSlice';
import {
    DB_DEPLOYMENT_MODEL,
    DB_EDITIONS,
    DB_VERSIONS,
    GIB_IN_BYTE,
    SQL_DEPLOYMENT_MODE,
    THROUGHPUT_LIST
} from '../../../utils/consts';

export const comparisonData = (calculatedResponse: any) => {
    return [
        {
            type: 'Capacity',
            fsx: `$${formatFractionalNumber(calculatedResponse?.fsx?.capacity, 2)}` || '$0',
            ebs: `$${formatFractionalNumber(calculatedResponse?.ebs?.capacity, 2)}` || '$0'
        },
        {
            type: 'IOPS',
            fsx: calculatedResponse?.fsx?.iops ? `$${formatFractionalNumber(calculatedResponse?.fsx?.iops, 2)}` : '$0',
            ebs: calculatedResponse?.ebs?.iops ? `$${formatFractionalNumber(calculatedResponse?.ebs?.iops, 2)}` : '$0'
        },
        {
            type: 'Throughput',
            fsx: calculatedResponse?.fsx?.throughput
                ? `$${formatFractionalNumber(calculatedResponse?.fsx?.throughput, 2)}`
                : '$0',
            ebs: calculatedResponse?.ebs?.throughput
                ? `$${formatFractionalNumber(calculatedResponse?.ebs?.throughput, 2)}`
                : '$0'
        },
        {
            type: 'Snapshots',
            fsx: calculatedResponse?.fsx?.snapshots
                ? `$${formatFractionalNumber(calculatedResponse?.fsx?.snapshots, 2)}`
                : '$0',
            ebs: calculatedResponse?.ebs?.snapshots
                ? `$${formatFractionalNumber(calculatedResponse?.ebs?.snapshots, 2)}`
                : '$0'
        },
        {
            type: 'Clone',
            fsx: calculatedResponse?.fsx?.clone
                ? `$${formatFractionalNumber(calculatedResponse?.fsx?.clone, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.clone
                ? `$${formatFractionalNumber(calculatedResponse?.ebs?.clone, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'Compute',
            fsx: calculatedResponse?.fsx?.compute
                ? `$${formatFractionalNumber(calculatedResponse?.fsx?.compute, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.compute
                ? `$${formatFractionalNumber(calculatedResponse?.ebs?.compute, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'SQL license',
            fsx: calculatedResponse?.fsx?.license
                ? `$${formatFractionalNumber(calculatedResponse?.fsx?.license, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.license
                ? `$${formatFractionalNumber(calculatedResponse?.ebs?.license, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'Total summary',
            fsx: calculatedResponse?.fsx?.total
                ? `$${Number(formatFractionalNumber(calculatedResponse?.fsx?.total, 2)).toLocaleString()}`
                : '$0',
            ebs: calculatedResponse?.ebs?.total
                ? `$${Number(formatFractionalNumber(calculatedResponse?.ebs?.total, 2)).toLocaleString()}`
                : '$0'
        }
    ];
};

export const calculatedFSXData = (fsxData: any) => {
    return [
        {
            label: 'Region',
            value: fsxData?.regionName || GENERAL.NOT_AVAILABLE,
            text: 'The AWS region that you selected.'
        },
        {
            label: 'Deployment type',
            value:
                fsxData?.deploymentType === 'Single'
                    ? 'Single Availability Zone'
                    : fsxData?.deploymentType === 'Multi'
                    ? 'Multi Availability Zone'
                    : fsxData?.deploymentType || GENERAL.NOT_AVAILABLE,
            text: `${fsxData?.deploymentType} Availability Zones are the equivalent availability for Amazon EBS.`
        },
        {
            label: 'Total storage capacity',
            value: fsxData?.totalStorageCapacity
                ? formatSizeOnePrecision(fsxData?.totalStorageCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: 'The number of volumes that you need multiplied by the selected volume size.'
        },

        {
            label: 'Percentage of data on SSD storage',
            value: fsxData?.percentageSsd
                ? formatFractionalNumber(fsxData?.percentageSsd, 2) + '%'
                : GENERAL.NOT_AVAILABLE,
            text: `The potential percentage of data stored on the SSD tier for a typical ${fsxData?.useCase} workload when using FSx for ONTAP data tiering capabilities.`
        },
        {
            label: 'Savings from compression and deduplication',
            value: fsxData?.savings ? formatFractionalNumber(fsxData?.savings, 2) + '%' : '0 %',
            text: `Potential storage savings for ${fsxData?.useCase} workload. Storage efficiency is based on a typical customer deployment.`
        },
        {
            label: 'Effective capacity',
            value: fsxData?.effectiveCapacity
                ? formatSizeOnePrecision(fsxData?.effectiveCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: `Cost reduction based on ${fsxData?.savings}% savings from the compression and deduplication features available with FSx for ONTAP.`
        },
        {
            label: 'SSD tier required capacity',
            value: fsxData?.ssdTierReqCapacity
                ? formatSizeOnePrecision(fsxData?.ssdTierReqCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: `Based on a typical ${fsxData?.useCase} workload, ${fsxData?.percentageSsd}% of the data is on the SSD tier.`
        },
        {
            label: 'Capacity pool tier required capacity',
            value: fsxData?.capacityPoolTier ? formatSizeOnePrecision(fsxData?.capacityPoolTier) : '0 TiB',
            text: `Based on a typical ${fsxData?.useCase} workload, ${
                100 - fsxData?.percentageSsd
            }% of the data is on the capacity pool tier.`
        },
        {
            label: 'Provisioned SSD IOPS',
            value: fsxData?.ssdIop ? fsxData?.ssdIop + ' IOPS' : GENERAL.NOT_AVAILABLE,
            text: 'For each GiB of SSD provisioned storage, Amazon FSx automatically provisions 3 SSD IOPS for the file system.'
        },
        {
            label: 'Throughput capacity',
            value: fsxData?.throughputCapacity ? `${fsxData?.throughputCapacity} MBps` : GENERAL.NOT_AVAILABLE,
            text: `Supported FSx for ONTAP throughput according to the consolidated EBS throughput required (${
                fsxData?.numberOfVolumes * fsxData?.throughput
            } Mbps).`
        },
        {
            label: 'Monthly snapshot capacity',
            value: fsxData?.monthlySnapshotCapacity
                ? formatSizeOnePrecision(fsxData?.monthlySnapshotCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: 'Cost reduction is based on FSx for ONTAP data tiering capability. 90% of snapshots data will be tiered to the capacity pool tier.'
        }
    ];
};

export const MSSQLServerInstance = (sqlData: any) => {
    return [
        {
            label: 'Database deployment mode',
            value: sqlData?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
            text:
                sqlData?.serverInstallationMode?.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                    ? 'The equivalent deployment mode of Always On Availability Group in EBS is Failover Cluster Instance in FSx for ONTAP'
                    : 'Database deployment mode selected based on the current EBS database deployment mode'
        },
        {
            label: 'Database edition',
            value: sqlData?.serverEdition || GENERAL.NOT_AVAILABLE,
            text:
                sqlData?.serverInstallationMode?.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                    ? 'Since source deployment mode suggested is  FCI the Enterprise replication feature is not relevant. Based on our analysis, SQL Enterprise features are not used as well, therefore we recommend using Standard edition.'
                    : 'Database edition selected based on the source SQL database edition'
        },
        {
            label: 'Database version',
            value: sqlData?.serverVersion || GENERAL.NOT_AVAILABLE,
            text: 'Database version selected based on your current EBS SQL server version'
        },
        {
            label: 'Database instance type',
            value: sqlData?.instanceType || GENERAL.NOT_AVAILABLE,
            text: 'Database instance type selected based on the source EC2 instance type'
        }
    ];
};

export const viewCalculation = (viewCalculation: any, selectedDeploymentModel: string) => {
    return {
        Ec2InstanceCalculation:
            selectedDeploymentModel === SQL_DEPLOYMENT_MODE.AOAG
                ? [
                      {
                          label: 'Microsoft SQL EC2 Instances calculation',
                          mainHeading: true
                      },
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine1 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
                      },
                      {
                          label: 'Machine 2 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 2 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[1].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine2 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[1].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[1].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
                      }
                  ]
                : [
                      {
                          label: 'Microsoft SQL EC2 Instances calculation',
                          mainHeading: true
                      },
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine1 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
                      }
                  ],
        FSxNCalculation: [
            {
                label: 'FSx for ONTAP calculation',
                mainHeading: true
            },
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.desiredStorageCapacity}`,
                text: `EBS capacity (${viewCalculation.fsxOntapCalculation.EBSCapacity}) x Number of volumes (${viewCalculation.fsxOntapCalculation.numberOfVolumes}) x 1024 `
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `${viewCalculation.fsxOntapCalculation.percentageOfDataOnSsdStorage}%`,
                text: ''
            },
            {
                label: 'Savings from compression & deduplication',
                value: `${viewCalculation.fsxOntapCalculation.savingsFromCompressionAndDeduplication}%`,
                text: ''
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication ',
                value: `${viewCalculation.fsxOntapCalculation.storageSavingsFromCompressionAndDeduplication}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapCalculation.desiredStorageCapacity}) x Savings from compression & deduplication (${viewCalculation.fsxOntapCalculation.savingsFromCompressionAndDeduplication}%)`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.fsxOntapCalculation.effectiveFsxnStorageCapacity}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapCalculation.desiredStorageCapacity})  - Storage savings from compression & deduplication (${viewCalculation.fsxOntapCalculation.storageSavingsFromCompressionAndDeduplication})`
            },
            {
                label: 'SSD storage GIB per month',
                value: `${viewCalculation.fsxOntapCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP (${viewCalculation.fsxOntapCalculation.effectiveFsxnStorageCapacity})  x Percentage of data on SSD storage (${viewCalculation.fsxOntapCalculation.percentageOfDataOnSsdStorage}%) `
            },
            {
                label: 'The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}`,
                text: ``
            },
            {
                label: 'SSD monthly cost ',
                value: `$${viewCalculation.fsxOntapCalculation.ssdMonthlyCost}`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) x SSD storage price ($${viewCalculation.fsxOntapCalculation.fsxnStoragePrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - SSD storage capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyCostForFSxSsd}`,
                text: ''
            },
            {
                label: 'Ratio after savings from compression & deduplication factor',
                value: `${viewCalculation.fsxOntapCalculation.ratioAfterSavings}%`,
                text: `${viewCalculation.fsxOntapCalculation.ratioAfterSavings}% - Savings from compression and deduplication (${viewCalculation.fsxOntapCalculation.savingsFromCompressionAndDeduplication}%)`
            },
            {
                label: 'Data on capacity pool storage factor',
                value: `${viewCalculation.fsxOntapCalculation.dataOnCapacityPoolStorageFactor}%`,
                text: `100% - Percentage of data on SSD storage (${viewCalculation.fsxOntapCalculation.percentageOfDataOnSsdStorage}%)`
            },
            {
                label: 'Capacity pool storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.capacityPoolStorage}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapCalculation.desiredStorageCapacity}) x Ratio after savings from compression & deduplication factor (${viewCalculation.fsxOntapCalculation.ratioAfterSavings}%) x Data on capacity pool storage factor (${viewCalculation.fsxOntapCalculation.dataOnCapacityPoolStorageFactor}%)`
            },
            {
                label: 'Capacity monthly cost',
                value: `$${viewCalculation.fsxOntapCalculation.capacityMonthlyCost}`,
                text: `Capacity pool storage capacity (${viewCalculation.fsxOntapCalculation.capacityPoolStorage}) x FSx for ONTAP capacity price ($${viewCalculation.fsxOntapCalculation.fsxnCapacityPrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Capacity pool storage capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyCostForCapacity}`,
                text: ` `
            },
            {
                label: 'Total storage charge (monthly)',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge}`,
                text: `Total monthly cost for FSx for NetApp ONTAP file server capacity pool storage capacity ($0) + Total monthly cost for FSx for NetApp ONTAP file server SSD storage capacity ($${viewCalculation.fsxOntapCalculation.totalMonthlyCostForFSxSsd})`
            },
            {
                label: 'Minimum number of file systems required for storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForStorage}`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) ÷ Max SSD tier size (${viewCalculation.fsxOntapCalculation.maxSSDTierSize}) `
            },
            {
                label: 'Minimum number of file systems required for throughput capacity',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForThroughputCapacity}`,
                text: `Suggested FSx for ONTAP throughput capacity (${viewCalculation.fsxOntapCalculation.suggestedFsxnThroughputCapacity}) ÷ max throughput (${viewCalculation.fsxOntapCalculation.maxThroughput} MB/s)`
            },
            {
                label: 'Minimum number of file systems required for SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForSsdIops}`,
                text: `Provisioned SSD (${viewCalculation.fsxOntapCalculation.provisionedSsdIops} IOPS) ÷ Maximum SSD (${viewCalculation.fsxOntapCalculation.maxSsdIops} IOPS)`
            },
            {
                label: 'Required number of FSx file systems - fractional',
                value: `${viewCalculation.fsxOntapCalculation.requiredNumOfFsxFractional}`,
                text: ``
            },
            {
                label: 'Required number of FSx file systems',
                value: `${viewCalculation.fsxOntapCalculation.requiredNumOfFsx}`,
                text: ``
            },
            {
                label: 'Minimum throughout capacity required',
                value: `${viewCalculation.fsxOntapCalculation.minThroughputCapacityRequired}`,
                text: `Required number of FSx file systems (${viewCalculation.fsxOntapCalculation.requiredNumOfFsx}) x Min throughput capacity (128 GiB)`
            },
            {
                label: 'Provisioned throughput capacity',
                value: `${viewCalculation.fsxOntapCalculation.provisionedThroughputCapacity}`,
                text: ``
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Throughput capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyFsxnThroughputCapacityCost}`,
                text: ` Provisioned throughput capacity (${viewCalculation.fsxOntapCalculation.provisionedThroughputCapacity})  x FSx for ONTAP throughput price ($${viewCalculation.fsxOntapCalculation.fsxnThroughputPrice})`
            },
            {
                label: 'Included SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.includedSsdIops} IOPS`,
                text: `The greater of SSD storage GIB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) x Included (3.3) IOPS per GIB `
            },
            {
                label: 'Additional SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.additionalSsdIops} IOPS`,
                text: `Provisioned SSD (${viewCalculation.fsxOntapCalculation.provisionedSsdIops} IOPS) - Included SSD (${viewCalculation.fsxOntapCalculation.includedIops} IOPS)`
            },
            {
                label: 'Billed additional SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.billedAdditionalSsdIops} IOPS`,
                text: ``
            },
            {
                label: 'Additional billed cost for SSD IOPS',
                value: `$${viewCalculation.fsxOntapCalculation.additionalBilledCostForSsdIops}`,
                text: `Billed additional SSD (${viewCalculation.fsxOntapCalculation.additionalSsdIops} IOPS) x FSx for ONTAP IOPS price ($0.02)`
            },
            {
                label: 'Total throughput and IOPS (monthly)',
                value: `$${viewCalculation.fsxOntapCalculation.totalThroughputAndIopsMonthly}`,
                text: `Additional billed cost for SSD IOPS ($${viewCalculation.fsxOntapCalculation.additionalBilledCostForSsdIops}) + Total monthly cost for FSx for NetApp ONTAP file server throughput capacity ($${viewCalculation.fsxOntapCalculation.totalMonthlyFsxnThroughputCapacityCost})`
            }
        ],
        SnapshotCalculation: [
            {
                label: 'Snapshot',
                mainHeading: true
            },
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity}`,
                text: ''
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.percentageOfDataOnSsdStorage}%`,
                text: ''
            },
            {
                label: 'Savings from compression & deduplication',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.savingsFromCompressionAndDeduplication}%`,
                text: ''
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication ',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.storageSavingsFromCompressionAndDeduplication}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity}) x Savings from compression & deduplication (${viewCalculation.fsxOntapSnapshotCalculation.savingsFromCompressionAndDeduplication}%)`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.effectiveFsxnStorageCapacity}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity})  - Storage savings from compression & deduplication (${viewCalculation.fsxOntapSnapshotCalculation.storageSavingsFromCompressionAndDeduplication})`
            },
            {
                label: 'SSD storage GIB per month',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP (${viewCalculation.fsxOntapSnapshotCalculation.effectiveFsxnStorageCapacity})  x Percentage of data on SSD storage (${viewCalculation.fsxOntapSnapshotCalculation.percentageOfDataOnSsdStorage}%) `
            },
            {
                label: 'SSD monthly cost ',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.ssdMonthlyCost}`,
                text: `SSD storage GiB per month (${viewCalculation.fsxOntapSnapshotCalculation.ssdStoragePerMonth}) x FSx for ONTAP SSD price ($${viewCalculation.fsxOntapSnapshotCalculation.fsxnSsdPrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - SSD storage capacity',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalMonthlyCostForFsxSsd}`,
                text: ''
            },
            {
                label: 'Ratio after savings from compression & deduplication factor',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.ratioAfterSavings}%`,
                text: `100% - Savings from compression and deduplication (${viewCalculation.fsxOntapSnapshotCalculation.savingsFromCompressionAndDeduplication}%)`
            },
            {
                label: 'Data on capacity pool storage factor',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.dataOnCapacityPoolStorageFactor}%`,
                text: `100% - Percentage of data on SSD storage (${viewCalculation.fsxOntapSnapshotCalculation.percentageOfDataOnSsdStorage}%)`
            },
            {
                label: 'Capacity pool storage capacity',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.capacityPoolStorage}`,
                text: `Desired storage capacity (${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity}) x Ratio after savings from compression & deduplication factor (${viewCalculation.fsxOntapSnapshotCalculation.ratioAfterSavings}%) x Data on capacity pool storage factor (${viewCalculation.fsxOntapSnapshotCalculation.dataOnCapacityPoolStorageFactor}%)`
            },
            {
                label: 'Capacity monthly cost',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.capacityMonthlyCost}`,
                text: `Capacity pool storage capacity (${viewCalculation.fsxOntapSnapshotCalculation.capacityPoolStorage}) x FSx for ONTAP capacity price ($${viewCalculation.fsxOntapSnapshotCalculation.fsxnCapacityPrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Capacity pool storage capacity',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalMonthlyCostForCapacity}`,
                text: ` `
            },
            {
                label: 'Total snapshot monthly cost',
                value: `$${viewCalculation.fsxSnapshotTotalCost}`,
                secondaryHeading: true,
                text: `Total monthly cost for FSx for NetApp ONTAP file server capacity pool storage capacity ($${viewCalculation.fsxOntapSnapshotCalculation.totalMonthlyCostForCapacity}) + Total monthly cost for FSx for NetApp ONTAP file server SSD storage capacity ($${viewCalculation.fsxOntapSnapshotCalculation.totalMonthlyCostForFsxSsd})`
            }
        ],
        cloneCalculation: [
            {
                label: 'Clone calculation',
                mainHeading: true
            },
            {
                label: 'Unit conversions'
            },
            {
                label: 'Clone frequency',
                value: `${viewCalculation.fsxCloneCalculation.cloneRefreshFrequency}`,
                text: ``
            },
            {
                label: 'Change rate between clones (%)',
                value: `${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}%`,
                text: `Monthly change rate (%) / Number of periods = 8%/30`
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxCloneCalculation.desiredStorageCapacity}`,
                text: `Number of cloned copies* (%change rate*total fsxN capacity*number of clones in a month)= 1*(${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}% *${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}*1024*30)`
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `${viewCalculation.fsxCloneCalculation.percentageOfDataOnSsdStorage}%`,
                text: ``
            },
            {
                label: 'Savings from compression & deduplication',
                value: `${viewCalculation.fsxCloneCalculation.savingsFromCompressionAndDeduplication}%`,
                text: ``
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication',
                value: `${viewCalculation.fsxCloneCalculation.storageSavingsFromCompressionAndDeduplication}`,
                text: `Desired storage capacity  x Savings from compression & deduplication = ${viewCalculation.fsxCloneCalculation.desiredStorageCapacity} x ${viewCalculation.fsxCloneCalculation.savingsFromCompressionAndDeduplication}% = 0GiB`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.fsxCloneCalculation.effectiveFsxnStorageCapacity}`,
                text: `Desired storage capacity  - Storage savings from compression & deduplication = ${viewCalculation.fsxCloneCalculation.desiredStorageCapacity} - ${viewCalculation.fsxCloneCalculation.storageSavingsFromCompressionAndDeduplication}`
            },
            {
                label: 'SSD storage GiB per month',
                value: `${viewCalculation.fsxCloneCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP x Percentage of data on SSD storage = 780 GiB x 100%`
            },
            {
                label: 'SSD monthly cost',
                value: `$${viewCalculation.fsxCloneCalculation.ssdMonthlyCost}`,
                text: `SSD storage GiB per month  x FSx for ONTAP SSD price = ${viewCalculation.fsxCloneCalculation.ssdStoragePerMonth} x $0.25`
            },
            {
                label: 'Total clone monthly cost',
                value: `$${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost}`,
                secondaryHeading: true,
                text: ``
            },
            {
                label: 'Total monthly cost',
                value: `$${viewCalculation.fsxTotalCost}`,
                text: `Total EC2 cost ($${
                    selectedDeploymentModel === SQL_DEPLOYMENT_MODE.AOAG
                        ? 2 * viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost
                        : viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost
                }) + Total throughput and IOPS cost ($${
                    viewCalculation.fsxOntapCalculation.totalThroughputAndIopsMonthly
                })  + Total Storage cost ($${
                    viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge
                }) + Total Clone cost ($${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost})`
            }
        ]
    };
};

export const viewCalculationForEBS = (viewCalculation: any, selectedDeploymentModel: string) => {
    return {
        Ec2InstanceCalculation:
            selectedDeploymentModel === SQL_DEPLOYMENT_MODE.AOAG
                ? [
                      {
                          label: 'Microsoft SQL EC2 instances calculation',
                          mainHeading: true
                      },
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine1 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
                      },
                      {
                          label: 'Machine 2 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[1].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 2 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[1].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine2 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[1].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[1].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
                      }
                  ]
                : [
                      {
                          label: 'Microsoft SQL EC2 instances calculation',
                          mainHeading: true
                      },
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0].sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine1 cost',
                          value: `$${viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost}`,
                          text: `Instance hourly price x number of hours in a month = $${viewCalculation.ebsInstanceCalculation?.[0].instanceHourlyPrice} x ${viewCalculation.ebsCalculation.hoursInAMonth}`
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
                value: `${viewCalculation.ebsCalculation.storageAmountPerVol}`,
                text: `Storage amount per volume (${viewCalculation.fsxOntapCalculation.EBSCapacity}) x 1024`
            },

            {
                label: 'Pricing calculations'
            },
            {
                label: 'Total instance hours',
                value: `${viewCalculation.ebsCalculation.totalInstanceHours}`,
                text: `Number of volumes (${viewCalculation.fsxOntapCalculation.numberOfVolumes}) x Average duration each instance runs (${viewCalculation.ebsCalculation.instanceAvgDuration} hours)`
            },
            {
                label: 'Instance months',
                value: `${viewCalculation.ebsCalculation.ebsInstanceMonth} months`,
                text: `Total instance hours (${viewCalculation.ebsCalculation.totalInstanceHours})  ÷ hours in a month (${viewCalculation.ebsCalculation.instanceAvgDuration})`
            },
            {
                label: 'EBS storage cost',
                value: `$${viewCalculation.ebsCalculation.ebsStorageCost}`,
                text: `Storage amount per volume (${viewCalculation.ebsCalculation.storageAmountPerVol}) x instance months (${viewCalculation.ebsCalculation.ebsInstanceMonth} months) x EBS capacity price ($${viewCalculation.ebsCalculation.ebsCapacityPrice})`
            },
            {
                label: 'Billable IOPS',
                value: `${viewCalculation.ebsCalculation.billableIops} IOPS`,
                text: ``
            },
            {
                label: 'Total billable IOPS ',
                value: `${viewCalculation.ebsCalculation.totalBillableIops} IOPS`,
                text: ``
            },
            {
                label: 'EBS IOPS cost',
                value: `$${viewCalculation.ebsCalculation.ebsIopsCost}`,
                text: ``
            },
            {
                label: 'Billable MB/s',
                value: `${viewCalculation.ebsCalculation.billableMbps} MB/s`,
                text: ``
            },
            {
                label: 'Billable throughput (MB/s)',
                value: `${viewCalculation.ebsCalculation.billableThroughputMbps} MB/s`,
                text: ``
            },
            {
                label: 'Billable throughput (GB/s))',
                value: `${viewCalculation.ebsCalculation.billableThroughputGbps} GB/s`,
                text: `Billable throughput (${viewCalculation.ebsCalculation.billableThroughputMbps} MB/s) ÷ 1024`
            },
            {
                label: 'EBS throughput cost',
                value: `$${viewCalculation.ebsCalculation.ebsThroughputCost}`,
                text: ``
            }
        ],
        SnapshotCalculation: [
            {
                label: 'Snapshot',
                mainHeading: true
            },
            {
                label: 'Total snapshots',
                value: `${viewCalculation.ebsCalculation.totalSnapshots}`,
                text: ''
            },
            {
                label: 'Initial snapshot cost',
                value: `$${viewCalculation.ebsCalculation.initialSnapshotCost}`,
                text: ''
            },
            {
                label: 'Monthly cost of each snapshot',
                value: `$${viewCalculation.ebsCalculation.monthlyCostPerSnapshot}`,
                text: ''
            },
            {
                label: 'Discount for partial storage month',
                value: `$${viewCalculation.ebsCalculation.discountForPartialStorageMonth}`,
                text: `Monthly cost of each snapshot ($${viewCalculation.ebsCalculation.monthlyCostPerSnapshot}) * Discount for partial storage month (50%)`
            },
            {
                label: 'Incremental snapshot cost',
                value: `$${viewCalculation.ebsCalculation.incrementalSnapshotCost}`,
                text: `(Monthly cost of each snapshot ($${viewCalculation.ebsCalculation.monthlyCostPerSnapshot}) - Discount for partial storage month ($${viewCalculation.ebsCalculation.discountForPartialStorageMonth})) * Total snapshots (${viewCalculation.ebsCalculation.totalSnapshots})`
            },
            {
                label: 'Total snapshot cost',
                value: `$${viewCalculation.ebsCalculation.totalSnapshotCost}`,
                text: `Initial snapshot cost ($${viewCalculation.ebsCalculation.initialSnapshotCost}) + Incremental snapshot cost ($${viewCalculation.ebsCalculation.incrementalSnapshotCost})`
            },
            {
                label: 'Total EBS snapshot cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsSnapshotCost}`,
                text: `Total snapshot cost ($${viewCalculation.ebsCalculation.totalSnapshotCost}) * Instance months (${viewCalculation.ebsCalculation.ebsInstanceMonth})`
            },
            {
                label: 'EBS snapshot cost',
                value: `$${viewCalculation.ebsCalculation.ebsSnapshotCost}`,
                text: ''
            }
        ],
        cloneCalculation: [
            {
                label: 'Clone calculation',
                mainHeading: true
            },
            {
                label: 'Number of Cloned copies',
                value: `${viewCalculation.ebsCloneCalculation.numberOfClonedCopies}`,
                text: ` `
            },
            {
                label: 'Clone cost',
                value: `$${viewCalculation.ebsCloneCalculation.cloneCost}`,
                text: `Number of Cloned copies *( EBS storage cost + EBS iops cost + EBS throughput cost )= ${viewCalculation.ebsCloneCalculation.numberOfClonedCopies} * $${viewCalculation.ebsCloneCalculation.cloneCost}`
            },
            {
                label: 'Amazon Elastic Block Storage (EBS) total cost (monthly)',
                value: `$${viewCalculation.ebsTotalCost}`,
                text: `Total EC2 cost ($${
                    selectedDeploymentModel === SQL_DEPLOYMENT_MODE.AOAG
                        ? 2 * viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost
                        : viewCalculation.ebsInstanceCalculation?.[0].ec2MachineCost
                }) + EBS snapshot cost ($${viewCalculation.ebsCalculation.ebsSnapshotCost}) + EBS throughput cost ($${
                    viewCalculation.ebsCalculation.ebsThroughputCost
                }) + EBS IOPS cost ($${viewCalculation.ebsCalculation.ebsIopsCost}) + EBS storage cost ($${
                    viewCalculation.ebsCalculation.ebsStorageCost
                }) + EBS clone cost ($${viewCalculation.ebsCloneCalculation.cloneCost})`
            }
        ]
    };
};

export const setRecommendedConfig = (msSqlInstance: any, fsxData: any) => {
    const state = store.getState();
    const initialStateForm = state.mssqlForm;
    let result = { ...initialStateForm, selectConfig: SELECT_CONFIG.STANDARD_CREATE };

    // mssql instance data
    if (msSqlInstance) {
        // setting instance type
        if (msSqlInstance?.instanceType) {
            const value = msSqlInstance?.instanceType?.[0].toLowerCase();
            const data = { instanceType: msSqlInstance?.instanceType?.[0].toLowerCase() };
            const option = generateOptionType(value, value, '', false, '', data);
            result = { ...result, instanceType: option };
        }
        // database version
        if (msSqlInstance?.serverVersion) {
            const dbVersionOption = DB_VERSIONS?.filter(perRow => msSqlInstance?.serverVersion.includes(perRow?.value));
            if (dbVersionOption) {
                const option = generateOptionType(dbVersionOption[0].value, dbVersionOption[0].label, '', false, '');
                result = { ...result, dbVersion: option };
            }
        }
        // database Edition
        if (msSqlInstance?.serverEdition) {
            const dbEditionOption = DB_EDITIONS?.filter(perRow => msSqlInstance?.serverEdition.includes(perRow?.value));
            if (dbEditionOption) {
                result = { ...result, dbEdition: dbEditionOption[0] };
            }
        }
        // Deployment Model
        if (msSqlInstance?.serverInstallationMode) {
            let type = msSqlInstance.serverInstallationMode.toLowerCase();
            if (type !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                type = SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE;
            }
            const dbDeploymentModel = DB_DEPLOYMENT_MODEL?.filter(perRow => type === perRow?.value);
            if (dbDeploymentModel) {
                result = { ...result, dbDeploymentModel: dbDeploymentModel[0] };
            }
        }
    }

    // fsxn data
    if (fsxData) {
        // IOPS
        if (fsxData?.ssdIop) {
            result = {
                ...result,
                provisionedIOPS: {
                    provisionedType: GENERAL.USER_PROVISIONED,
                    IOPSValue: fsxData?.ssdIop
                }
            };
        }
        // Throughput
        if (fsxData?.throughputCapacity) {
            const throughput = THROUGHPUT_LIST?.filter(perRow => perRow?.value === fsxData?.throughputCapacity);
            if (throughput) {
                const option = generateOptionType(throughput[0]?.label, throughput[0]?.label, '', false, '');
                result = { ...result, throughput: option };
            }
        }
        // Capacity
        if (fsxData?.totalStorageCapacity) {
            let size = fsxData?.totalStorageCapacity ? fsxData?.totalStorageCapacity / GIB_IN_BYTE : 0;
            const unitOption = generateOptionType('GiB', 'GiB', '', false, '');
            result = {
                ...result,
                storageCapacity: {
                    capacity: formatFractionalNumber(size, 2),
                    unit: unitOption
                }
            };
        }
    }

    return result;
};

/*
On click of save config it will call API to store config data.
*/
export const ExploreSaveConfiguration = (
    dispatch: Dispatch,
    saveConfigData: any,
    closeDialog: any,
    msSqlInstance: any,
    fsxData: any
) => {
    const state = store.getState();
    const saveConfigName = state.exploreSavings.saveConfigName;
    const existingSavedConfig = state.msSqlAction.savedConfig;
    const payload = {
        name: saveConfigName,
        data: removePasswordInConfig(setRecommendedConfig(msSqlInstance, fsxData))
    };
    const isDuplicate = duplicateSaveCheck(state.mssqlForm, existingSavedConfig);
    if (isDuplicate) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: SELECT_CONFIG.DUPLICATE_SAVED_CONFIG
            })
        );
        closeDialog();
    } else {
        dispatch(setIsSaveConfigLoading(true));
        saveConfigData({ payload: payload })
            .then((data: any) => {
                if (!data?.error) {
                    dispatch(setSavedConfig(state.mssqlForm));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS
                        })
                    );
                }
                closeDialog();
                dispatch(setIsSaveConfigLoading(false));
            })
            .catch((error: any) => {
                dispatch(setIsSaveConfigLoading(false));
                closeDialog();
            });
    }
    return '';
};
