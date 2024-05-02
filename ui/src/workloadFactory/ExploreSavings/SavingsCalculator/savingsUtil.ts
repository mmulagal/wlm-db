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
            fsx: `$ ${formatFractionalNumber(calculatedResponse?.fsx?.capacity, 2)}` || '$ 0',
            ebs: `$ ${formatFractionalNumber(calculatedResponse?.ebs?.capacity, 2)}` || '$ 0'
        },
        {
            type: 'IOPS',
            fsx: calculatedResponse?.fsx?.iops
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.iops, 2)}`
                : '$ 0',
            ebs: calculatedResponse?.ebs?.iops ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.iops, 2)}` : '$ 0'
        },
        {
            type: 'Throughput',
            fsx: calculatedResponse?.fsx?.throughput
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.throughput, 2)}`
                : '$ 0',
            ebs: calculatedResponse?.ebs?.throughput
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.throughput, 2)}`
                : '$ 0'
        },
        {
            type: 'Snapshots',
            fsx: calculatedResponse?.fsx?.snapshots
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.snapshots, 2)}`
                : '$ 0',
            ebs: calculatedResponse?.ebs?.snapshots
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.snapshots, 2)}`
                : '$ 0'
        },
        {
            type: 'Clone',
            fsx: calculatedResponse?.fsx?.clone
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.clone, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.clone
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.clone, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'Compute',
            fsx: calculatedResponse?.fsx?.compute
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.compute, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.compute
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.compute, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'SQL license',
            fsx: calculatedResponse?.fsx?.license
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.license, 2)}`
                : GENERAL.NOT_AVAILABLE,
            ebs: calculatedResponse?.ebs?.license
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.license, 2)}`
                : GENERAL.NOT_AVAILABLE
        },
        {
            type: 'Total summary',
            fsx: calculatedResponse?.fsx?.total
                ? `$ ${formatFractionalNumber(calculatedResponse?.fsx?.total, 2)}`
                : '$ 0',
            ebs: calculatedResponse?.ebs?.total
                ? `$ ${formatFractionalNumber(calculatedResponse?.ebs?.total, 2)}`
                : '$ 0'
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
                    : fsxData?.deploymentType || GENERAL.NOT_AVAILABLE,
            text: `A ${fsxData?.deploymentType} Availability Zone is the equivalent availability for Amazon EBS.`
        },
        {
            label: 'Total storage capacity',
            value: fsxData?.totalStorageCapacity
                ? formatSizeOnePrecision(fsxData?.totalStorageCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: 'The number of volumes that you need times the selected volume size.'
        },

        {
            label: 'Percentage of data on SSD storage',
            value: fsxData?.percentageSsd
                ? formatFractionalNumber(fsxData?.percentageSsd, 2) + '%'
                : GENERAL.NOT_AVAILABLE,
            text: `The potential percentage of data stored on the SSD tier for a typical ${fsxData?.useCase} workload when using FSx for ONTAP data tiering capabilities.`
        },
        {
            label: 'Savings from compression + deduplication',
            value: fsxData?.savings ? formatFractionalNumber(fsxData?.savings, 2) + '%' : GENERAL.NOT_AVAILABLE,
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
            value: fsxData?.capacityPoolTier
                ? formatSizeOnePrecision(fsxData?.capacityPoolTier)
                : GENERAL.NOT_AVAILABLE,
            text: `Based on a typical ${fsxData?.useCase} workload, ${
                100 - fsxData?.percentageSsd
            }% of the data is on the capacity pool tier.`
        },
        {
            label: 'Provisioned SSD IOPS',
            value: fsxData?.ssdIop || GENERAL.NOT_AVAILABLE,
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
            text: 'Based on source deployment mode of Always On Availability Group, the equivalent deployment mode on FsxN is Failover cluster instance'
        },
        {
            label: 'Database edition',
            value: sqlData?.serverEdition || GENERAL.NOT_AVAILABLE,
            text: 'Since source deployment mode suggested is  FCI the Enterprise replication feature is not relevant. Based on our analysis, SQL Enterprise features are not used as well, therefore we recommend using Standard edition.'
        },
        {
            label: 'Database version',
            value: sqlData?.serverVersion || GENERAL.NOT_AVAILABLE,
            text: 'Based on the source SQL server version'
        },
        {
            label: 'DB Instance type',
            value: sqlData?.instanceType || GENERAL.NOT_AVAILABLE,
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
                label: 'Capacity monthly cost',
                value: `$${viewCalculation.FSxNCalculation.priceCalculation.capacityMonthlyCost}`,
                text: `Capacity pool storage capacity x FSx for ONTAP capacity price  `
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
                value: `$(${viewCalculation.cloneCalculation.unitConversion.cloneFrequency})`,
                text: ``
            },
            {
                label: 'change rate between clones (%)',
                value: `$${viewCalculation.cloneCalculation.unitConversion.cloneRateChange}%`,
                text: `monthly change rate (%) / number of periods = 3%/30`
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.cloneCalculation.unitConversion.desiredStorageCapacity}GiB`,
                text: `number of cloned copies* (%change rate*total fsxN capacity*number of clones in a month)= 3*(0.1% *2*1024*30)`
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `$${viewCalculation.cloneCalculation.unitConversion.ssdStorage}%`,
                text: ``
            },
            {
                label: 'Savings from compression & deduplication',
                value: `$${viewCalculation.cloneCalculation.unitConversion.savingsDeduplication}%`,
                text: ``
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication',
                value: `${viewCalculation.cloneCalculation.priceCalculation.storageSavingsDeduplication} GiB`,
                text: `Desired storage capacity  x Savings from compression & deduplication = 184GiB x 0% = 0GiB`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.cloneCalculation.priceCalculation.effectiveStorageCapacity} GiB`,
                text: `Desired storage capacity  - Storage savings from compression & deduplication = 184GiB-0Gib`
            },
            {
                label: 'SSD storage GiB per month',
                value: `${viewCalculation.cloneCalculation.priceCalculation.ssdStorage} GiB`,
                text: `Effective storage capacity for FSx for ONTAP (3,000 GiB) x Percentage of data on SSD storage = 184GiBx 100%`
            },
            {
                label: 'SSD monthly cost',
                value: `${viewCalculation.cloneCalculation.priceCalculation.ssdMonthlyCost}$`,
                text: `SSD storage GiB per month  x FSx for ONTAP SSD price = 184GiB x 0.14$`
            },
            {
                label: 'Total clone monthly cost',
                value: `${viewCalculation.cloneCalculation.priceCalculation.totalMonthlyCloneCost}$`,
                secondaryHeading: true,
                text: ``
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
                label: 'SQL edition',
                value: `${viewCalculation.Ec2InstanceCalculation.sqlEdition}`,
                text: ''
            },
            {
                label: 'SQL license included',
                value: `${viewCalculation.Ec2InstanceCalculation.sqlLicense}`,
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
            }
        ],
        cloneCalculation: [
            {
                label: 'Clone calculation',
                mainHeading: true
            },
            {
                label: 'Number of Cloned copies',
                value: `${viewCalculation.cloneCalculation.numberOfClonedCopies}`,
                text: ` `
            },
            {
                label: 'Clone cost',
                value: `$${viewCalculation.cloneCalculation.cloneCost}`,
                text: `number of Cloned copies *( ebs storage cost + ebs iops cost + ebs throughput cost )= 3 * 300$`
            },
            {
                label: 'Amazon Elastic Block Storage (EBS) total cost (monthly)',
                value: `$${viewCalculation.EBSCalculation.priceCalculation.amazonElasticBlock}`,
                text: `EBS snapshot cost + EBS throughput cost + EBS IOPS cost + EBS storage cost `
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
