import { Dispatch } from 'redux';
import i18next from 'i18next';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import {
    formatFractionalNumber,
    formatFractionalNumberForCost,
    formatSizeTwoPrecision,
    generateOptionType,
    removePasswordInConfig,
    formatNumberWithCustomComma
} from '../../../utils/utilityFunctions';
import store from '../../../store/store';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { duplicateSaveCheck } from '../../../components/CreateMsSql/Configuration/LoadConfiguration';
import { setIsSaveConfigLoading, setSavedConfig } from '../../../store/mssql/msSqlActionSlice';
import {
    DATABASE_DEPLOYMENT_MODE,
    DB_DEPLOYMENT_MODEL,
    DB_EDITIONS,
    DB_VERSIONS,
    DBType,
    EBS_PROTECTED_OPTIONS,
    GIB_IN_BYTE,
    OS_VERSIONS_LIST,
    SAVINGS_CALC_MODE,
    SQL_DEPLOYMENT_MODE,
    TCO_CALCULATOR_MODE,
    TCO_MANUAL_DEPLOYMENT_TYPE,
    THROUGHPUT_LIST,
    TIB_IN_BYTE,
    WLF_TABS
} from '../../../utils/consts';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import {
    setOptimizedStorageSavingsResponse,
    setOptimizedViewCalculationResponse,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../ExploreSavingsUtils';
import { StorageSavingsInterface, ViewCalculationsInterface } from '../../../utils/types/exploreSavingsType';

export const getOracleLicenseCostValue = () => {
    const state = store.getState();
    const { savingsCalculatorFrom, onPremStorageAndComputeInfo, monthlyBYOLCost } = state.exploreSavings;
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;
    const isOracleEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    const isOracleManualEbs = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;

    if (isOracleManualEbs) return monthlyBYOLCost ? Number(monthlyBYOLCost) : 0;

    if ((!isOracleOnPrem && !isOracleEbs) || !onPremStorageAndComputeInfo) return 0;

    return Object.values(onPremStorageAndComputeInfo as Record<string, { monthlyOracleCost?: string | number }>).reduce(
        (total, entry) => {
            const cost = entry?.monthlyOracleCost;
            return total + (cost ? Number(cost) : 0);
        },
        0
    );
};

export const comparisonData = (calculatedResponse: any) => {
    const state = store.getState();
    const { recommendedTargetInstance, selectedHostDetails, savingsCalculatorFrom } = state.exploreSavings;
    const isOracle =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;
    const isArrayMode =
        (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
            isOracle) &&
        Array.isArray(calculatedResponse?.compute);

    const formatCost = (val: any) => (val ? `$${formatFractionalNumberForCost(val, 2)}` : '$0');

    const sumArrayField = (arr: any[], path: string) => {
        const total = arr.reduce((sum: number, item: any) => sum + Number(item?.existing?.[path] || 0), 0);
        return total > 0 ? formatCost(total) : '$0';
    };

    const checkBYOLTooltip = isOracle
        ? false
        : checkIfByolFieldRequired(selectedHostDetails, false, savingsCalculatorFrom);

    const licenseLabel = isOracle ? 'Oracle License' : 'SQL license';
    const licenseTooltip = isOracle
        ? ''
        : checkBYOLTooltip
        ? 'SQL license costs for SQL on FSx for ONTAP are based on the Standard SQL Server license-included AMIs. SQL license costs for SQL on Elastic Block Store are based on the Enterprise license with BYOL. According to our findings, the SQL license cost is optimal when using FSx for ONTAP.'
        : 'SQL license costs for SQL on FSx for ONTAP are based on the Standard SQL license while SQL license costs for SQL on Elastic Block Store are based on the Enterprise license. According to our findings, the SQL license cost is optimal when using FSx for ONTAP.';

    const oracleLicenseCostValue = getOracleLicenseCostValue();
    const oracleLicenseCost = isOracle ? formatCost(oracleLicenseCostValue) : null;

    return [
        {
            type: 'Capacity',
            fsx: formatCost(calculatedResponse?.fsx?.capacity),
            ebs: formatCost(calculatedResponse?.ebs?.capacity)
        },
        {
            type: 'IOPS',
            fsx: formatCost(calculatedResponse?.fsx?.iops),
            ebs: formatCost(calculatedResponse?.ebs?.iops)
        },
        {
            type: 'Throughput',
            fsx: formatCost(calculatedResponse?.fsx?.throughput),
            ebs: formatCost(calculatedResponse?.ebs?.throughput)
        },
        {
            type: 'Snapshots',
            fsx: formatCost(calculatedResponse?.fsx?.snapshots),
            ebs: formatCost(calculatedResponse?.ebs?.snapshots)
        },
        {
            type: 'Clones',
            fsx: formatCost(calculatedResponse?.fsx?.clones),
            ebs: formatCost(calculatedResponse?.ebs?.clones)
        },
        {
            type: 'Compute',
            isTooltip: recommendedTargetInstance ? GENERAL.COMPUTE_RECOMMENDED_TOOLTIP : '',
            fsx: formatCost(calculatedResponse?.recommendedInstance?.computeMonthlyPrice),
            ebs: isArrayMode
                ? sumArrayField(calculatedResponse.compute, 'computeMonthlyPrice')
                : formatCost(calculatedResponse?.compute?.existing?.computeMonthlyPrice)
        },
        {
            type: licenseLabel,
            isTooltip: licenseTooltip,
            fsx: isOracle
                ? oracleLicenseCost
                : formatCost(calculatedResponse?.recommendedInstance?.licenseMonthlyPrice),
            ebs: isOracle
                ? oracleLicenseCost
                : isArrayMode && Array.isArray(calculatedResponse?.license)
                ? sumArrayField(calculatedResponse.license, 'licenseMonthlyPrice')
                : formatCost(calculatedResponse?.license?.existing?.licenseMonthlyPrice)
        },
        {
            type: 'Total summary',
            fsx:
                isOracle && oracleLicenseCostValue
                    ? formatCost(
                          (Number(calculatedResponse?.totalSummary?.recommendedTotal) || 0) + oracleLicenseCostValue
                      )
                    : formatCost(calculatedResponse?.totalSummary?.recommendedTotal),
            ebs:
                isOracle && oracleLicenseCostValue
                    ? formatCost((Number(calculatedResponse?.totalSummary?.existing) || 0) + oracleLicenseCostValue)
                    : formatCost(calculatedResponse?.totalSummary?.existing)
        }
    ];
};

export const comparisonDataFsxw = (calculatedResponse: any) => {
    const state = store.getState();
    const { recommendedTargetInstance } = state.exploreSavings;
    return [
        {
            type: 'Capacity',
            fsx: calculatedResponse?.fsx?.capacity
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsx?.capacity, 2)}`
                : '$0',
            fsxw: calculatedResponse?.fsxw?.capacity
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsxw?.capacity, 2)}`
                : '$0'
        },
        {
            type: 'IOPS',
            fsx: calculatedResponse?.fsx?.iops
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsx?.iops, 2)}`
                : '$0',
            fsxw: calculatedResponse?.fsxw?.iops
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsxw?.iops, 2)}`
                : '$0'
        },
        {
            type: 'Throughput',
            fsx: calculatedResponse?.fsx?.throughput
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsx?.throughput, 2)}`
                : '$0',
            fsxw: calculatedResponse?.fsxw?.throughput
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsxw?.throughput, 2)}`
                : '$0'
        },
        {
            type: 'Snapshots',
            fsx: calculatedResponse?.fsx?.snapshots
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsx?.snapshots, 2)}`
                : '$0',
            fsxw: calculatedResponse?.fsxw?.snapshots
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsxw?.snapshots, 2)}`
                : '$0'
        },
        {
            type: 'Clones',
            fsx: calculatedResponse?.fsx?.clones
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsx?.clones, 2)}`
                : '$0',
            fsxw: calculatedResponse?.fsxw?.clones
                ? `$${formatFractionalNumberForCost(calculatedResponse?.fsxw?.clones, 2)}`
                : '$0'
        },
        {
            type: 'Compute',
            fsx: calculatedResponse?.recommendedInstance?.computeMonthlyPrice
                ? `$${formatFractionalNumberForCost(calculatedResponse?.recommendedInstance?.computeMonthlyPrice, 2)}`
                : '$0',
            fsxw: calculatedResponse?.compute?.existing?.computeMonthlyPrice
                ? `$${formatFractionalNumberForCost(calculatedResponse?.compute?.existing?.computeMonthlyPrice, 2)}`
                : '$0'
        },
        {
            type: 'SQL license',
            isTooltip:
                'SQL license costs for SQL on FSx for ONTAP are based on the Standard SQL license while SQL license costs for SQL on FSx for Windows are based on the Enterprise license. According to our findings, the SQL license cost is optimal when using FSx for ONTAP.',
            fsx: calculatedResponse?.recommendedInstance?.licenseMonthlyPrice
                ? `$${formatFractionalNumberForCost(calculatedResponse?.recommendedInstance?.licenseMonthlyPrice, 2)}`
                : '$0',
            fsxw: calculatedResponse?.license?.existing?.licenseMonthlyPrice
                ? `$${formatFractionalNumberForCost(calculatedResponse?.license?.existing?.licenseMonthlyPrice, 2)}`
                : '$0'
        },
        {
            type: 'Total summary',
            fsx: calculatedResponse?.totalSummary?.recommendedTotal
                ? `$${formatFractionalNumberForCost(calculatedResponse?.totalSummary?.recommendedTotal, 2)}`
                : '$0',
            fsxw: calculatedResponse?.totalSummary?.existing
                ? `$${formatFractionalNumberForCost(calculatedResponse?.totalSummary?.existing, 2)}`
                : '$0'
        }
    ];
};

export const calculatedFSXData = (
    fsxData: any,
    {
        storageType = '',
        selectedExploreSavingsTab,
        isOracleOnPrem,
        isOracleEbs
    }: {
        storageType?: string;
        selectedExploreSavingsTab?: string;
        isOracleOnPrem?: boolean;
        isOracleEbs?: boolean;
    } = {}
) => {
    const isOnPrem = selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES || isOracleOnPrem;
    const useCaseLabel = fsxData?.useCase || (isOracleOnPrem || isOracleEbs ? 'Oracle' : '');

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
            text: isOnPrem
                ? `${fsxData?.deploymentType} Availability Zone is the equivalent deployment type for your on-premises configuration.`
                : isOracleEbs
                ? `${fsxData?.deploymentType} Availability Zone is the equivalent deployment type for your source configuration.`
                : `${fsxData?.deploymentType} Availability Zone are the equivalent availability for Amazon ${storageType}.`
        },
        {
            label: 'Total storage capacity',
            value: fsxData?.totalStorageCapacity
                ? formatSizeTwoPrecision(fsxData?.totalStorageCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? 'According to on-premises total capacity of primary database volumes.'
                : isOracleEbs
                ? 'According to source total capacity of primary database volumes.'
                : `According to ${storageType} total capacity of primary database volumes.`
        },
        {
            label: 'Percentage of data on SSD storage',
            value: fsxData?.percentageSsd
                ? `${formatFractionalNumber(fsxData?.percentageSsd, 2)}%`
                : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? `The percentage of data stored on the SSD tier for a typical ${useCaseLabel} database workload when using FSx for ONTAP.`
                : `The potential percentage of data stored on the SSD tier for a typical ${useCaseLabel} workload when using FSx for ONTAP data tiering capabilities.`
        },
        {
            label: 'Savings from compression and deduplication',
            value: fsxData?.savings ? `${formatFractionalNumber(fsxData?.savings, 2)}%` : '0 %',
            text: `Potential storage savings for ${useCaseLabel} workload. Storage efficiency is based on a typical customer deployment.`
        },
        {
            label: 'Effective capacity',
            value: fsxData?.effectiveCapacity
                ? formatSizeTwoPrecision(fsxData?.effectiveCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? `Effective capacity reduces costs based on ${fsxData?.savings}% savings from the compression and deduplication features available with FSx for ONTAP.`
                : `Cost reduction based on ${fsxData?.savings}% savings from the compression and deduplication features available with FSx for ONTAP.`
        },
        {
            label: 'SSD tier required capacity',
            value: fsxData?.ssdTierReqCapacity
                ? formatSizeTwoPrecision(fsxData?.ssdTierReqCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: `Based on a typical ${useCaseLabel} workload, ${fsxData?.percentageSsd}% of the data is on the SSD tier.`
        },
        {
            label: 'Capacity pool tier required capacity',
            value: fsxData?.capacityPoolTier ? formatSizeTwoPrecision(fsxData?.capacityPoolTier) : '0 GiB',
            text: `Based on a typical ${useCaseLabel} workload, ${
                100 - (fsxData?.percentageSsd || 0)
            }% of the data is on the capacity pool tier.`
        },
        {
            label: 'Provisioned SSD IOPS',
            value: fsxData?.ssdIop ? Number(fsxData?.ssdIop).toLocaleString() : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? 'Based on your on-premises configuration.'
                : isOracleEbs
                ? 'Based on your source configuration.'
                : 'For each GiB of SSD provisioned storage, Amazon FSx automatically provisions 3 SSD IOPS for the file system.'
        },
        {
            label: 'Throughput capacity',
            value: fsxData?.throughputCapacity ? `${fsxData?.throughputCapacity} MBps` : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? 'Based on your on-premises configuration.'
                : isOracleEbs
                ? 'Based on your source configuration.'
                : `Supported FSx for ONTAP throughput according to the consolidated ${storageType} throughput required (${
                      fsxData?.numberOfVolumes * fsxData?.throughput
                  } Mbps).`
        },
        {
            label: 'Monthly snapshot capacity',
            value: fsxData?.monthlySnapshotCapacity
                ? formatSizeTwoPrecision(fsxData?.monthlySnapshotCapacity)
                : GENERAL.NOT_AVAILABLE,
            text: isOnPrem
                ? 'FSx for ONTAP data tiering reduces costs by tiering 90% of snapshot data to the capacity pool storage tier.'
                : 'Cost reduction is based on FSx for ONTAP data tiering capability. 90% of snapshots data will be tiered to the capacity pool tier.'
        }
    ];
};

export const MSSQLServerInstance = (sqlData: any, storageType: string) => [
    {
        label: 'Database deployment mode',
        value: sqlData?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
        text:
            sqlData?.serverInstallationMode?.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? `The equivalent deployment mode of ${sqlData?.actualServerInstallationMode} in ${storageType} is failover cluster instance in FSx for ONTAP`
                : `Database deployment mode selected based on the current ${storageType} database deployment mode`
    },
    {
        label: 'Database edition',
        value: sqlData?.serverEdition || GENERAL.NOT_AVAILABLE,
        text: 'Database edition selected based on the source SQL database edition'
    },
    {
        label: 'Database version',
        value: sqlData?.serverVersion || GENERAL.NOT_AVAILABLE,
        text: `Database version selected based on your current ${storageType} SQL server version`
    },
    {
        label: 'Database instance type',
        value: sqlData?.instanceType || GENERAL.NOT_AVAILABLE,
        text: 'Database instance type selected based on the EC2 instance type'
    }
];

export const MSSQLServerInstanceForOnPremise = (sqlData: any, storageType: string) => [
    {
        label: 'Database deployment mode',
        value: sqlData?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
        text:
            sqlData?.serverInstallationMode?.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? 'Failover cluster instance (FCI) is the equivalent deployment mode for FCI on-premises.'
                : `Database deployment mode selected based on the current ${storageType} database deployment mode`
    },
    {
        label: 'Database edition',
        value: sqlData?.serverEdition || GENERAL.NOT_AVAILABLE,
        text: sqlData?.editionUpgradeCheck
            ? sqlData?.serverInstallationMode?.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? 'Enterprise features are not in use. Failover cluster instance (FCI) is selected as the deployment mode because it doesn’t require an Enterprise license.'
                : 'Enterprise features are not in use. Standalone is selected as the deployment mode because it doesn’t require an Enterprise license.'
            : 'The selected database edition is based on the source on-premises SQL Server database.'
    },
    {
        label: 'Database version',
        value: sqlData?.serverVersion || GENERAL.NOT_AVAILABLE,
        text: 'Supported database version selected based on your on-premises SQL Server version.'
    },
    {
        label: 'Database instance type',
        value: sqlData?.instanceType || GENERAL.NOT_AVAILABLE,
        text: 'Database instance type selected based on the on-premises number of vCPUS, memory, and network configurations.'
    }
];

export const viewCalculation = (viewCalculation: any, selectedDeploymentModel: string) => {
    const state = store.getState();
    const { selectedManualDeploymentModel, savingsCalculatorFrom } = state.exploreSavings;
    let storageType = '';
    let deploymentModelValue = selectedDeploymentModel;
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
        storageType = GENERAL.FSX_FOR_WINDOWS;
        deploymentModelValue = selectedManualDeploymentModel?.value;
    } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS) {
        deploymentModelValue = selectedManualDeploymentModel?.value;
        storageType = GENERAL.EBS;
    } else if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
    ) {
        storageType = GENERAL.EBS;
    } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) {
        storageType = GENERAL.FSX_FOR_WINDOWS;
    }

    // Oracle mode detection for proper labels/fields
    const isOracleViewCalc =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;
    const editionLabel = isOracleViewCalc
        ? i18next.t('databases.explore-savings.database-edition-label')
        : i18next.t('databases.explore-savings.sql-edition-label');
    const licenseLabel = isOracleViewCalc
        ? i18next.t('databases.explore-savings.license-included-label')
        : i18next.t('databases.explore-savings.sql-license-included-label');
    const getEdition = (calc: any) => (isOracleViewCalc ? calc?.oracleEdition : calc?.sqlEdition);
    const getLicense = (calc: any) => (isOracleViewCalc ? calc?.oracleLicense : calc?.sqlLicense);
    const licenseTooltip = isOracleViewCalc
        ? i18next.t('databases.explore-savings.instance-hourly-price-tooltip')
        : i18next.t('databases.explore-savings.instance-hourly-price-with-sql-license-tooltip');
    const instanceTypeTooltip =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM || savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM
            ? i18next.t('databases.explore-savings.database-instance-type-onprem-tooltip')
            : '';

    // Check if we have bulk calculation data (multiple hosts)
    if (viewCalculation?.isBulkCalculation && viewCalculation?.hostCalculationData?.length > 0) {
        const hostCalculations = viewCalculation.hostCalculationData.map((hostData: any) => {
            const machineDetailsList: any[] = [];

            hostData?.fsxInstanceCalculation?.forEach((calculation: any, index: number) => {
                machineDetailsList.push(
                    { label: `Machine ${index + 1} specification` },
                    {
                        label: 'Instance type',
                        value: `${calculation?.instanceType}`,
                        text: instanceTypeTooltip
                    },
                    {
                        label: editionLabel,
                        value: `${getEdition(calculation)}`,
                        text: ''
                    },
                    {
                        label: licenseLabel,
                        value: `${getLicense(calculation)}`,
                        text: ''
                    },
                    { label: `Machine ${index + 1} pricing calculations` },
                    {
                        label: 'Instance hourly price',
                        value: `${calculation?.computeHourlyPrice}`,
                        text: licenseTooltip
                    },
                    {
                        label: `EC2 machine${index + 1} cost`,
                        value: `${calculation?.instanceMonthlyPrice}`,
                        text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
                    }
                );
            });

            // Calculate total cost for this host
            const hostTotalCost = hostData?.fsxInstanceCalculation?.reduce((total: number, calc: any) => {
                const price = calc?.instanceMonthlyPrice;
                const numericPrice =
                    typeof price === 'string' ? Number(price.replace('$', '').replace(',', '')) : Number(price) || 0;
                return total + numericPrice;
            }, 0);

            machineDetailsList.push({
                label: 'EC2 machines total cost',
                value: `$${formatNumberWithCustomComma(hostTotalCost)}`,
                text: ''
            });

            return {
                hostName: hostData.hostName,
                Ec2InstanceCalculation: machineDetailsList
            };
        });

        return {
            isBulkCalculation: true,
            hostCalculations,
            // Include FSx calculation data (shared across hosts)
            FSxNCalculation: viewCalculation.fsxOntapCalculation
                ? [
                      {
                          label: 'Unit conversions'
                      },
                      {
                          label: 'Desired storage capacity',
                          value: `${viewCalculation.fsxOntapCalculation.desiredStorageCapacity}`,
                          text: `Total required capacity according to ${storageType} storage capacity`
                      }
                      // Add more FSx calculation details as needed
                  ]
                : [],
            // Include snapshot calculation data (shared across hosts)
            SnapshotCalculation: viewCalculation.fsxOntapSnapshotCalculation
                ? [
                      {
                          label: 'Unit conversions'
                      },
                      {
                          label: 'Desired storage capacity',
                          value: `${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity}`,
                          text: `Monthly change rate (${viewCalculation.monthlyChangeRate}%) x FSx for ONTAP storage capacity (${viewCalculation.fsxOntapCalculation.desiredStorageCapacity})`
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
                          label: 'Total snapshot monthly cost',
                          value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCost}`,
                          text: ''
                      }
                  ]
                : [],
            // Include clone calculation data (shared across hosts)
            cloneCalculation: viewCalculation.fsxCloneCalculation
                ? [
                      {
                          label: 'Unit conversions'
                      },
                      {
                          label: 'Monthly change rate',
                          value: `${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}%`,
                          text: 'Based on user input'
                      },
                      {
                          label: 'Desired storage capacity',
                          value: `${viewCalculation.fsxCloneCalculation.desiredStorageCapacity}`,
                          text: `Number of cloned copies x (Monthly change rate x Total FSx for ONTAP capacity)= ${viewCalculation.fsxCloneCalculation.clonedCopiesCount} x (${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}% x ${viewCalculation.fsxCloneCalculation.totalFsxnCapacity})`
                      },
                      {
                          label: 'Total clone monthly cost',
                          value: `$${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost}`,
                          text: ''
                      }
                  ]
                : []
        };
    }

    // Original single host calculation logic
    const machineDetailsList = [];

    viewCalculation?.fsxInstanceCalculation?.forEach((calculation: any, index: number) => {
        machineDetailsList.push(
            { label: `Machine ${index + 1} specification` },
            {
                label: 'Instance type',
                value: `${calculation?.instanceType}`,
                text: instanceTypeTooltip
            },
            {
                label: editionLabel,
                value: `${getEdition(calculation)}`,
                text: ''
            },
            {
                label: licenseLabel,
                value: `${getLicense(calculation)}`,
                text: ''
            },
            { label: `Machine ${index + 1} pricing calculations` },
            {
                label: 'Instance hourly price',
                value: `${calculation?.computeHourlyPrice}`,
                text: licenseTooltip
            },
            {
                label: `EC2 machine${index + 1} cost`,
                value: `${calculation?.instanceMonthlyPrice}`,
                text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
            }
        );
    });

    machineDetailsList.push({
        label: 'EC2 machines total cost',
        value: `$${viewCalculation?.totalFsxEc2MachineCost}`,
        text: ''
    });

    return {
        Ec2InstanceCalculation:
            deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? machineDetailsList
                : [
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.fsxInstanceCalculation?.[0]?.instanceType}`,
                          text: instanceTypeTooltip
                      },
                      {
                          label: editionLabel,
                          value: `${getEdition(viewCalculation.fsxInstanceCalculation?.[0])}`,
                          text: ''
                      },
                      {
                          label: licenseLabel,
                          value: `${getLicense(viewCalculation.fsxInstanceCalculation?.[0])}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `${viewCalculation.fsxInstanceCalculation?.[0]?.computeHourlyPrice}`,
                          text: licenseTooltip
                      },
                      {
                          label: 'EC2 machine1 cost',
                          value: `${viewCalculation.fsxInstanceCalculation?.[0]?.instanceMonthlyPrice}`,
                          text: `Instance hourly price x number of hours in a month = ${viewCalculation.fsxInstanceCalculation?.[0]?.computeHourlyPrice} x ${viewCalculation.fsxInstanceCalculation?.[0]?.hoursInAMonth}`
                      },
                      {
                          label: 'EC2 machine total cost',
                          value: `${viewCalculation.fsxInstanceCalculation?.[0]?.instanceMonthlyPrice}`,
                          text: ''
                      }
                  ],
        FSxNCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.desiredStorageCapacity}`,
                text: `Total required capacity according to ${storageType} storage capacity`
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
                label: 'SSD storage GiB per month',
                value: `${viewCalculation.fsxOntapCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP (${viewCalculation.fsxOntapCalculation.effectiveFsxnStorageCapacity})  x Percentage of data on SSD storage (${viewCalculation.fsxOntapCalculation.percentageOfDataOnSsdStorage}%) `
            },
            {
                label: 'The greater of SSD storage GiB per month and the minimum allowed SSD storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}`,
                text: ''
            },
            {
                label: 'SSD monthly cost ',
                value: `$${viewCalculation.fsxOntapCalculation.ssdMonthlyCost}`,
                text: `The greater of SSD storage GiB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) x SSD storage price ($${viewCalculation.fsxOntapCalculation.fsxnStoragePrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - SSD storage capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyCostForFSxSsd}`,
                text: ''
            },
            {
                label: 'Ratio after savings from compression & deduplication tier',
                value: `${viewCalculation.fsxOntapCalculation.ratioAfterSavings}%`,
                text: `100% - Savings from compression and deduplication (${viewCalculation.fsxOntapCalculation.savingsFromCompressionAndDeduplication}%)`
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
                label: 'Total monthly cost for FSx for NetApp ONTAP file system - Capacity pool storage capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyCostForCapacity}`,
                text: ' '
            },
            {
                label: 'Total monthly storage cost',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge}`,
                text: `Total monthly cost for FSx for NetApp ONTAP file system capacity pool storage capacity ($${viewCalculation.fsxOntapCalculation.totalMonthlyCostForCapacity}) + Total monthly cost for FSx for NetApp ONTAP file system SSD storage capacity ($${viewCalculation.fsxOntapCalculation.totalMonthlyCostForFSxSsd})`
            },
            {
                label: 'Minimum number of file systems required for storage capacity',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForStorage} file system(s)`,
                text: `The greater of SSD storage GiB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) ÷ Max SSD tier size (${viewCalculation.fsxOntapCalculation.maxSsdTierSize}) `
            },
            {
                label: 'Minimum number of file systems required for throughput capacity',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForThroughputCapacity} file system(s)`,
                text: `Suggested FSx for ONTAP throughput capacity (${viewCalculation.fsxOntapCalculation.suggestedFsxnThroughputCapacity} MB/s) ÷ max throughput (${viewCalculation.fsxOntapCalculation.maxThroughput} MB/s)`
            },
            {
                label: 'Minimum number of file systems required for SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.minFileSystemsNumForSsdIops} file system(s)`,
                text: `Provisioned SSD (${viewCalculation.fsxOntapCalculation.provisionedSsdIops} IOPS) ÷ Maximum SSD (${viewCalculation.fsxOntapCalculation.maxSsdIops} IOPS)`
            },
            {
                label: 'Required number of FSx for ONTAP file systems - fractional',
                value: `${viewCalculation.fsxOntapCalculation.requiredNumOfFsxFractional} file system(s)`,
                text: ''
            },
            {
                label: 'Required number of FSx for ONTAP file systems',
                value: `${viewCalculation.fsxOntapCalculation.requiredNumOfFsx}`,
                text: ''
            },
            {
                label: 'Minimum throughput capacity required',
                value: `${viewCalculation.fsxOntapCalculation.minThroughputCapacityRequired}`,
                text: `Required number of FSx file systems (${viewCalculation.fsxOntapCalculation.requiredNumOfFsx}) x Min throughput capacity 128 MB/s)`
            },
            {
                label: 'Provisioned throughput capacity',
                value: `${viewCalculation.fsxOntapCalculation.provisionedThroughputCapacity}`,
                text: ''
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - Throughput capacity',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyFsxnThroughputCapacityCost}`,
                text: ` Provisioned throughput capacity (${viewCalculation.fsxOntapCalculation.provisionedThroughputCapacity})  x FSx for ONTAP throughput price ($${viewCalculation.fsxOntapCalculation.fsxnThroughputPrice})`
            },
            {
                label: 'Included SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.includedSsdIops} IOPS`,
                text: `The greater of SSD storage GiB per month and the minimum allowed SSD storage capacity (${viewCalculation.fsxOntapCalculation.greaterOfSsdAndMinAllowedSsd}) x Included (${viewCalculation.fsxOntapCalculation.includedIops}) IOPS per GiB `
            },
            {
                label: 'Additional SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.additionalSsdIops} IOPS`,
                text: `Provisioned SSD (${viewCalculation.fsxOntapCalculation.provisionedSsdIops} IOPS) - Included SSD (${viewCalculation.fsxOntapCalculation.includedSsdIops} IOPS)`
            },
            {
                label: 'Billed additional SSD IOPS',
                value: `${viewCalculation.fsxOntapCalculation.billedAdditionalSsdIops} IOPS`,
                text: ''
            },
            {
                label: 'Additional billed cost for SSD IOPS',
                value: `$${viewCalculation.fsxOntapCalculation.additionalBilledCostForSsdIops}`,
                text: `Billed additional SSD (${viewCalculation.fsxOntapCalculation.additionalSsdIops} IOPS) x FSx for ONTAP IOPS price ($${viewCalculation.fsxOntapCalculation.fsxnIopsPrice})`
            },
            {
                label: 'Total monthly throughput and IOPS',
                value: `$${viewCalculation.fsxOntapCalculation.totalThroughputAndIopsMonthly}`,
                text: `Additional billed cost for SSD IOPS ($${viewCalculation.fsxOntapCalculation.additionalBilledCostForSsdIops}) + Total monthly cost for FSx for NetApp ONTAP file server throughput capacity ($${viewCalculation.fsxOntapCalculation.totalMonthlyFsxnThroughputCapacityCost})`
            },
            {
                label: `${viewCalculation.type} availability zone total monthly cost`,
                value: `$${viewCalculation.totalAzCost}`,
                text: `Total monthly throughput and IOPS ($${viewCalculation.fsxOntapCalculation.totalThroughputAndIopsMonthly}) + Total monthly storage charge ($${viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge})`
            }
        ],
        SnapshotCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.desiredStorageCapacity}`,
                text: `Monthly change rate (${viewCalculation.monthlyChangeRate}%) x FSx for ONTAP storage capacity (${viewCalculation.fsxOntapCalculation.desiredStorageCapacity})`
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
                label: 'SSD storage GiB per month',
                value: `${viewCalculation.fsxOntapSnapshotCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP (${viewCalculation.fsxOntapSnapshotCalculation.effectiveFsxnStorageCapacity})  x Percentage of data on SSD storage (${viewCalculation.fsxOntapSnapshotCalculation.percentageOfDataOnSsdStorage}%) `
            },
            {
                label: 'SSD monthly cost ',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCostForFsxSsd}`,
                text: `SSD storage GiB per month (${viewCalculation.fsxOntapSnapshotCalculation.ssdStoragePerMonth}) x FSx for ONTAP SSD price ($${viewCalculation.fsxOntapSnapshotCalculation.fsxnSsdPrice})`
            },
            {
                label: 'Total monthly cost for FSx for NetApp ONTAP file server - SSD storage capacity',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCostForFsxSsd}`,
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
                text: ' '
            },
            {
                label: 'Total snapshot monthly cost',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCost}`,
                secondaryHeading: true,
                text: `Total monthly cost for FSx for NetApp ONTAP file server capacity pool storage capacity ($${viewCalculation.fsxOntapSnapshotCalculation.totalMonthlyCostForCapacity}) + Total monthly cost for FSx for NetApp ONTAP file server SSD storage capacity ($${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCostForFsxSsd})`
            }
        ],
        cloneCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Monthly change rate',
                value: `${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}%`,
                text: 'Based on user input'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxCloneCalculation.desiredStorageCapacity}`,
                text: `Number of cloned copies x (Monthly change rate x Total FSx for ONTAP capacity)= ${viewCalculation.fsxCloneCalculation.clonedCopiesCount} x (${viewCalculation.fsxCloneCalculation.monthlyChangeRatePercentage}% x ${viewCalculation.fsxCloneCalculation.totalFsxnCapacity})`
            },
            {
                label: 'Percentage of data on SSD storage',
                value: `${viewCalculation.fsxCloneCalculation.percentageOfDataOnSsdStorage}%`,
                text: ''
            },
            {
                label: 'Savings from compression & deduplication',
                value: `${viewCalculation.fsxCloneCalculation.savingsFromCompressionAndDeduplication}%`,
                text: `NetApp recommends ${viewCalculation.fsxCloneCalculation.savingsFromCompressionAndDeduplication}% savings from compression and deduplication based on a typical database workload.`
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings from compression & deduplication',
                value: `${viewCalculation.fsxCloneCalculation.storageSavingsFromCompressionAndDeduplication}`,
                text: `Desired storage capacity  x Savings from compression & deduplication = ${viewCalculation.fsxCloneCalculation.desiredStorageCapacity} x ${viewCalculation.fsxCloneCalculation.savingsFromCompressionAndDeduplication}%`
            },
            {
                label: 'Effective storage capacity for FSx for ONTAP',
                value: `${viewCalculation.fsxCloneCalculation.effectiveFsxnStorageCapacity}`,
                text: `Desired storage capacity  - Storage savings from compression & deduplication = ${viewCalculation.fsxCloneCalculation.desiredStorageCapacity} - ${viewCalculation.fsxCloneCalculation.storageSavingsFromCompressionAndDeduplication}`
            },
            {
                label: 'SSD storage per month',
                value: `${viewCalculation.fsxCloneCalculation.ssdStoragePerMonth}`,
                text: `Effective storage capacity for FSx for ONTAP x Percentage of data on SSD storage = ${viewCalculation.fsxCloneCalculation.effectiveFsxnStorageCapacity} x ${viewCalculation.fsxCloneCalculation.percentageOfDataOnSsdStorage}%`
            },
            {
                label: 'SSD monthly cost',
                value: `$${viewCalculation.fsxCloneCalculation.ssdMonthlyCost}`,
                text: `SSD storage GiB per month  x FSx for ONTAP SSD price = ${viewCalculation.fsxCloneCalculation.ssdStoragePerMonth} x $${viewCalculation.fsxCloneCalculation.fsxnSsdPrice}`
            },
            {
                label: 'Total clones monthly cost',
                value: `$${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost}`,
                secondaryHeading: true,
                text: ''
            }
        ],
        totalMonthlyCost: [
            {
                label: 'Total monthly EC2 machine cost',
                value: `$${viewCalculation.totalFsxEc2MachineCost}`,
                text: ''
            },
            {
                label: 'Total monthly storage cost',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge}`,
                text: 'Total all FSx for ONTAP storage costs'
            },
            {
                label: 'Total monthly iops cost',
                value: `$${viewCalculation.fsxOntapCalculation.additionalBilledCostForSsdIops}`,
                text: 'Total all FSx for ONTAP iops costs'
            },
            {
                label: 'Total monthly throughput cost',
                value: `$${viewCalculation.fsxOntapCalculation.totalMonthlyFsxnThroughputCapacityCost}`,
                text: 'Total all FSx for ONTAP througput costs'
            },
            {
                label: 'Total monthly snapshots cost',
                value: `$${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCost}`,
                text: ''
            },
            {
                label: 'Total monthly clones cost',
                value: `$${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost}`,
                text: ''
            },
            {
                label: 'Total monthly cost',
                value: `$${viewCalculation.fsxTotalCost}`,
                text: `Total EC2 cost ($${viewCalculation.totalFsxEc2MachineCost}) + Total Storage cost ($${viewCalculation.fsxOntapCalculation.totalMonthlyStorageCharge}) + Total throughput and IOPS cost ($${viewCalculation.fsxOntapCalculation.totalThroughputAndIopsMonthly}) + Total snapshots cost ($${viewCalculation.fsxOntapSnapshotCalculation.totalSnapshotMonthlyCost}) + Total Clone cost ($${viewCalculation.fsxCloneCalculation.totalCloneMonthlyCost})`
            }
        ]
    };
};

export const viewCalculationForEBS = (viewCalculation: any, selectedDeploymentModel: string) => {
    const state = store.getState();
    const { selectedManualDeploymentModel, savingsCalculatorFrom } = state.exploreSavings;
    let deploymentModelValue = selectedDeploymentModel;
    if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
    ) {
        deploymentModelValue = selectedManualDeploymentModel?.value;
    }

    const isOracleEbsCalc =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;
    const ebsEditionLabel = isOracleEbsCalc
        ? i18next.t('databases.explore-savings.database-edition-label')
        : i18next.t('databases.explore-savings.sql-edition-label');
    const ebsLicenseLabel = isOracleEbsCalc
        ? i18next.t('databases.explore-savings.license-included-label')
        : i18next.t('databases.explore-savings.sql-license-included-label');
    const getEbsEdition = (calc: any) => (isOracleEbsCalc ? calc?.oracleEdition : calc?.sqlEdition);
    const getEbsLicense = (calc: any) => (isOracleEbsCalc ? calc?.oracleLicense : calc?.sqlLicense);
    const ebsLicenseTooltip = isOracleEbsCalc
        ? i18next.t('databases.explore-savings.instance-hourly-price-tooltip')
        : i18next.t('databases.explore-savings.instance-hourly-price-with-sql-license-tooltip');
    const ebsInstanceTypeTooltip =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM || savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM
            ? i18next.t('databases.explore-savings.database-instance-type-onprem-tooltip')
            : '';

    // Check if we have bulk calculation data (multiple hosts)
    if (viewCalculation?.isBulkCalculation && viewCalculation?.hostCalculationData?.length > 0) {
        const hostCalculations = viewCalculation.hostCalculationData.map((hostData: any) => {
            const machineDetailsList: any[] = [];

            hostData?.ebsInstanceCalculation?.forEach((calculation: any, index: number) => {
                machineDetailsList.push(
                    { label: `Machine ${index + 1} specification` },
                    {
                        label: 'Instance type',
                        value: `${calculation?.instanceType}`,
                        text: ebsInstanceTypeTooltip
                    },
                    {
                        label: ebsEditionLabel,
                        value: `${getEbsEdition(calculation)}`,
                        text: ''
                    },
                    {
                        label: ebsLicenseLabel,
                        value: `${getEbsLicense(calculation)}`,
                        text: ''
                    },
                    { label: `Machine ${index + 1} pricing calculations` },
                    {
                        label: 'Instance hourly price',
                        value: `${calculation?.computeHourlyPrice}`,
                        text: ebsLicenseTooltip
                    },
                    {
                        label: `EC2 machine${index + 1} cost`,
                        value: `${calculation?.instanceMonthlyPrice}`,
                        text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
                    }
                );
            });

            const hostTotalCost = hostData?.ebsInstanceCalculation?.reduce((total: number, calc: any) => {
                const price = calc?.instanceMonthlyPrice;
                const numericPrice =
                    typeof price === 'string' ? Number(price.replace('$', '').replace(',', '')) : Number(price) || 0;
                return total + numericPrice;
            }, 0);

            machineDetailsList.push({
                label: 'EC2 machines total cost',
                value: `$${formatNumberWithCustomComma(hostTotalCost)}`,
                text: ''
            });

            return {
                hostName: hostData.hostName,
                Ec2InstanceCalculation: machineDetailsList
            };
        });

        return {
            isBulkCalculation: true,
            hostCalculations
        };
    }

    const machineDetailsList = [];

    viewCalculation?.ebsInstanceCalculation?.forEach((calculation: any, index: number) => {
        machineDetailsList.push(
            { label: `Machine ${index + 1} specification` },
            {
                label: 'Instance type',
                value: `${calculation?.instanceType}`,
                text: ebsInstanceTypeTooltip
            },
            {
                label: ebsEditionLabel,
                value: `${getEbsEdition(calculation)}`,
                text: ''
            },
            {
                label: ebsLicenseLabel,
                value: `${getEbsLicense(calculation)}`,
                text: ''
            },
            { label: `Machine ${index + 1} pricing calculations` },
            {
                label: 'Instance hourly price',
                value: `${calculation?.computeHourlyPrice}`,
                text: ebsLicenseTooltip
            },
            {
                label: `EC2 machine${index + 1} cost`,
                value: `${calculation?.instanceMonthlyPrice}`,
                text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
            }
        );
    });

    machineDetailsList.push({
        label: 'Total EC2 machines cost',
        value: `$${viewCalculation?.totalEBSEc2MachineCost}`,
        text: ''
    });

    return {
        Ec2InstanceCalculation:
            deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? machineDetailsList
                : [
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0]?.instanceType}`,
                          text: ebsInstanceTypeTooltip
                      },
                      {
                          label: ebsEditionLabel,
                          value: `${getEbsEdition(viewCalculation.ebsInstanceCalculation?.[0])}`,
                          text: ''
                      },
                      {
                          label: ebsLicenseLabel,
                          value: `${getEbsLicense(viewCalculation.ebsInstanceCalculation?.[0])}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0]?.computeHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine total cost',
                          value: `${viewCalculation.ebsInstanceCalculation?.[0]?.instanceMonthlyPrice}`,
                          text: `Instance hourly price x number of hours in a month = ${viewCalculation.ebsInstanceCalculation?.[0]?.computeHourlyPrice} x ${viewCalculation.ebsInstanceCalculation?.[0]?.hoursInAMonth}`
                      }
                  ],
        EBSCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Storage amount per volume',
                value: `${viewCalculation.ebsCalculation.storageAmountPerVol}`,
                text: `Storage amount per volume (${viewCalculation.ebsCalculation.storageAmountPerVol})`
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Total instance hours',
                value: `${viewCalculation.ebsCalculation.totalInstanceHours}`,
                text: `Number of volumes (${viewCalculation.ebsCalculation.numberOfVolumes}) x Average duration each instance runs (${viewCalculation.ebsCalculation.hoursInAMonth} hours)`
            },
            {
                label: 'Instance months',
                value: `${viewCalculation.ebsCalculation.ebsInstanceMonth} months`,
                text: `Total instance hours (${viewCalculation.ebsCalculation.totalInstanceHours})  ÷ hours in a month (${viewCalculation.ebsCalculation.hoursInAMonth})`
            },
            {
                label: 'EBS storage cost',
                value: `$${viewCalculation.ebsCalculation.ebsStorageCost}`,
                text: `Storage amount per volume (${viewCalculation.ebsCalculation.storageAmountPerVol}) x instance months (${viewCalculation.ebsCalculation.ebsInstanceMonth} months) x EBS capacity price ($${viewCalculation.ebsCalculation.ebsCapacityPrice})`
            },
            {
                label: 'Billable IOPS',
                value: `${viewCalculation.ebsCalculation.billableIops} IOPS`,
                text: ''
            },
            {
                label: 'Total billable IOPS ',
                value: `${viewCalculation.ebsCalculation.totalBillableIops} IOPS`,
                text: ''
            },
            {
                label: 'EBS IOPS cost',
                value: `$${viewCalculation.ebsCalculation.ebsIopsCost}`,
                text: ''
            },
            {
                label: 'Billable MB/s',
                value: `${viewCalculation.ebsCalculation.billableMbps} MB/s`,
                text: ''
            },
            {
                label: 'Billable throughput (MB/s)',
                value: `${viewCalculation.ebsCalculation.billableThroughputMbps} MB/s`,
                text: ''
            },
            {
                label: 'Billable throughput (GB/s))',
                value: `${viewCalculation.ebsCalculation.billableThroughputGbps} GB/s`,
                text: `Billable throughput (${viewCalculation.ebsCalculation.billableThroughputMbps} MB/s) ÷ 1024`
            },
            {
                label: 'EBS throughput cost',
                value: `$${viewCalculation.ebsCalculation.ebsThroughputCost}`,
                text: ''
            }
        ],
        SnapshotCalculation: [
            {
                label: 'Total snapshots',
                value: `${viewCalculation.ebsSnapshotCalculation.totalSnapshots}`,
                text: 'Total Snapshots of primary database volume'
            },
            {
                label: 'Amount changed in GiB per snapshot',
                value: `${viewCalculation.ebsSnapshotCalculation.amountChangedPerSnapshot}`,
                text: `Σ[(Monthly change rate % / total snapshots) x Total storage of each EBS volume type]= ${
                    viewCalculation.ebsSnapshotCalculation.storageAmountPerMonthList
                        ?.map(
                            (storageAmount: string) =>
                                `(${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.totalSnapshots}) x ${storageAmount}`
                        )
                        .join(' + ') || ''
                }= ${viewCalculation.ebsSnapshotCalculation.amountChangedPerSnapshot}`
            },
            {
                label: 'Initial snapshot cost',
                value: `$${viewCalculation.ebsSnapshotCalculation.initialSnapshotCost}`,
                text: `Σ[Total size of each EBS volume type x EBS snapshots price per GiB]= (${
                    viewCalculation.ebsSnapshotCalculation.storageAmountPerMonthList
                        ?.map(
                            (storageAmount: string) =>
                                `${storageAmount} x $${viewCalculation.ebsSnapshotCalculation.ebsSnapshotPrice}`
                        )
                        .join(') + ') || ''
                }`
            },
            {
                label: 'Monthly cost of each snapshot',
                value: `$${viewCalculation.ebsSnapshotCalculation.monthlyCostPerSnapshot}`,
                text: `Amount changed in GiB per snapshot (${viewCalculation.ebsSnapshotCalculation.amountChangedPerSnapshot}) x EBS snapshot price ($${viewCalculation.ebsSnapshotCalculation.ebsSnapshotPrice})`
            },
            {
                label: 'Discount for partial storage month',
                value: `$${viewCalculation.ebsSnapshotCalculation.discountForPartialStorageMonth}`,
                text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
            },
            {
                label: 'Incremental snapshot cost',
                value: `$${viewCalculation.ebsSnapshotCalculation.incrementalSnapshotCost}`,
                text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.totalSnapshots})`
            },
            {
                label: 'Total snapshots cost',
                value: `$${viewCalculation.ebsSnapshotCalculation.totalEbsSnapshotCost}`,
                text: `Initial snapshots cost ($${viewCalculation.ebsSnapshotCalculation.initialSnapshotCost}) + Incremental snapshots cost ($${viewCalculation.ebsSnapshotCalculation.incrementalSnapshotCost})`
            }
        ],
        cloneCalculation: [
            {
                label: 'Number of Cloned copies',
                value: `${viewCalculation.ebsCloneCalculation.clonedCopiesCount}`,
                text: ''
            },
            {
                label: 'EBS storage cost for clone',
                value: `$${viewCalculation.ebsCloneCalculation.capacity}`,
                text: 'EBS storage cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'EBS iops cost for clone',
                value: `$${viewCalculation.ebsCloneCalculation.iops}`,
                text: 'EBS iops cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'EBS throughput cost for clone',
                value: `$${viewCalculation.ebsCloneCalculation.throughput}`,
                text: 'EBS throughput cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'Clones total monthly cost',
                value: `$${viewCalculation.ebsCloneCalculation.totalCloneMonthlyCost}`,
                text: `Number of Cloned copies (${viewCalculation.ebsCloneCalculation.clonedCopiesCount}) x (primary EBS storage cost ($${viewCalculation.ebsCloneCalculation.capacity}) + primary EBS iops cost ($${viewCalculation.ebsCloneCalculation.iops}) + primary EBS throughput cost ($${viewCalculation.ebsCloneCalculation.throughput}))`
            }
        ],
        totalMonthlyCost: [
            {
                label: 'Total monthly EC2 machine cost',
                value: `$${viewCalculation.totalEBSEc2MachineCost}`,
                text: ''
            },
            {
                label: 'Total monthly storage cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsStorageCost}`,
                text: 'Total storage cost across all volume disk types'
            },
            {
                label: 'Total monthly iops cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsIopsCost}`,
                text: 'Total iops cost across all volume disk types'
            },
            {
                label: 'Total monthly throughput cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsThroughputCost}`,
                text: 'Total throughput cost across all volume disk types'
            },
            {
                label: 'Total monthly snapshots cost',
                value: `$${viewCalculation.ebsSnapshotCalculation.totalEbsSnapshotCost}`,
                text: ''
            },
            {
                label: 'Total monthly clones cost',
                value: `$${viewCalculation.ebsCloneCalculation.totalCloneMonthlyCost}`,
                text: ''
            },
            {
                label: 'Total monthly cost',
                value: `$${viewCalculation.ebsTotalCost}`,
                text: `Total EC2 cost ($${viewCalculation.totalEBSEc2MachineCost}) + Total storage cost ($${viewCalculation.ebsCalculation.totalEbsStorageCost}) + Total throughput cost ($${viewCalculation.ebsCalculation.totalEbsThroughputCost}) + Total IOPS cost ($${viewCalculation.ebsCalculation.totalEbsIopsCost}) + Total snapshots cost ($${viewCalculation.ebsSnapshotCalculation.totalEbsSnapshotCost}) + Total Clone cost ($${viewCalculation.ebsCloneCalculation.totalCloneMonthlyCost})`
            }
        ],
        gp3VolumeType: viewCalculation?.ebsCalculation?.gp3
            ? [
                  {
                      label: 'Unit conversions'
                  },
                  {
                      label: 'Total storage amount',
                      value: `${viewCalculation.ebsCalculation.gp3.storageAmountPerVol}`,
                      text: 'Storage capacity per disk type in GiB'
                  },
                  {
                      label: 'Pricing calculations'
                  },
                  {
                      label: 'EBS storage cost',
                      value: `$${viewCalculation.ebsCalculation.gp3.ebsStorageCost}`,
                      text: `Total storage amount (${viewCalculation.ebsCalculation.gp3.storageAmountPerVol}) x EBS capacity price ($${viewCalculation.ebsCalculation.gp3.ebsCapacityPrice})`
                  },
                  {
                      label: 'Billable IOPS',
                      value: `${viewCalculation.ebsCalculation.gp3.billableIops} IOPS`,
                      text: ''
                  },
                  {
                      label: 'EBS IOPS cost',
                      value: `$${viewCalculation.ebsCalculation.gp3.ebsIopsCost}`,
                      text: ''
                  },
                  {
                      label: 'Billable throughout (MiB/s)',
                      value: `${viewCalculation.ebsCalculation.gp3.billableThroughputMbps} MiB/s`,
                      text: ''
                  },
                  {
                      label: 'Billable throughout (GiB/s)',
                      value: `${viewCalculation.ebsCalculation.gp3.billableThroughputGbps} GiB/s`,
                      text: `Billable throughput (${viewCalculation.ebsCalculation.gp3.billableThroughputMbps}  MiB/s)/1024`
                  },
                  {
                      label: 'EBS throughput cost',
                      value: `$${viewCalculation.ebsCalculation.gp3.ebsThroughputCost}`,
                      text: ''
                  }
              ]
            : [],
        io2VolumeType: viewCalculation?.ebsCalculation?.io2
            ? [
                  {
                      label: 'Unit conversions'
                  },
                  {
                      label: 'Total storage amount',
                      value: `${viewCalculation.ebsCalculation.io2.storageAmountPerVol}`,
                      text: 'Storage capacity per disk type in GiB'
                  },
                  {
                      label: 'Pricing calculations'
                  },
                  {
                      label: 'EBS storage cost',
                      value: `$${viewCalculation.ebsCalculation.io2.ebsStorageCost}`,
                      text: `Total storage amount (${viewCalculation.ebsCalculation.io2.storageAmountPerVol}) x EBS capacity price ($${viewCalculation.ebsCalculation.io2.ebsCapacityPrice})`
                  },
                  {
                      label: 'Billable IOPS',
                      value: `${viewCalculation.ebsCalculation.io2.billableIops} IOPS`,
                      text: ''
                  },
                  {
                      label: 'EBS IOPS cost',
                      value: `$${viewCalculation.ebsCalculation.io2.ebsIopsCost}`,
                      text: ''
                  }
              ]
            : [],
        io1VolumeType: viewCalculation?.ebsCalculation?.io1
            ? [
                  {
                      label: 'Unit conversions'
                  },
                  {
                      label: 'Total storage amount',
                      value: `${viewCalculation.ebsCalculation.io1.storageAmountPerVol}`,
                      text: 'Storage capacity per disk type in GiB'
                  },
                  {
                      label: 'Pricing calculations'
                  },
                  {
                      label: 'EBS storage cost',
                      value: `$${viewCalculation.ebsCalculation.io1.ebsStorageCost}`,
                      text: `Total storage amount (${viewCalculation.ebsCalculation.io1.storageAmountPerVol}) x EBS capacity price ($${viewCalculation.ebsCalculation.io1.ebsCapacityPrice})`
                  },
                  {
                      label: 'Billable IOPS',
                      value: `${viewCalculation.ebsCalculation.io1.billableIops} IOPS`,
                      text: ''
                  },
                  {
                      label: 'EBS IOPS cost',
                      value: `$${viewCalculation.ebsCalculation.io1.ebsIopsCost}`,
                      text: ''
                  }
              ]
            : [],
        gp2VolumeType: viewCalculation?.ebsCalculation?.gp2
            ? [
                  {
                      label: 'Unit conversions'
                  },
                  {
                      label: 'Total storage amount',
                      value: `${viewCalculation.ebsCalculation.gp2.storageAmountPerVol}`,
                      text: 'Storage capacity per disk type in GiB'
                  },
                  {
                      label: 'Pricing calculations'
                  },
                  {
                      label: 'EBS storage cost',
                      value: `$${viewCalculation.ebsCalculation.gp2.ebsStorageCost}`,
                      text: `Total storage amount (${viewCalculation.ebsCalculation.gp2.storageAmountPerVol}) x EBS capacity price ($${viewCalculation.ebsCalculation.gp2.ebsCapacityPrice})`
                  }
              ]
            : [],
        st1VolumeType: viewCalculation?.ebsCalculation?.st1
            ? [
                  {
                      label: 'Unit conversions'
                  },
                  {
                      label: 'Total storage amount',
                      value: `${viewCalculation.ebsCalculation.st1.storageAmountPerVol}`,
                      text: 'Storage capacity per disk type in GiB'
                  },
                  {
                      label: 'Pricing calculations'
                  },
                  {
                      label: 'EBS storage cost',
                      value: `$${viewCalculation.ebsCalculation.st1.ebsStorageCost}`,
                      text: `Total storage amount (${viewCalculation.ebsCalculation.st1.storageAmountPerVol}) x EBS capacity price ($${viewCalculation.ebsCalculation.st1.ebsCapacityPrice})`
                  }
              ]
            : [],
        ebsTotalCost: [
            {
                label: 'Total storage cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsStorageCost}`,
                text: `${viewCalculation.ebsCalculation.totalEbsStorageCostText}`
            },
            {
                label: 'Total IOPS cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsIopsCost}`,
                text: `${viewCalculation.ebsCalculation.totalEbsIopsCostText}`
            },
            {
                label: 'Total throughput cost',
                value: `$${viewCalculation.ebsCalculation.totalEbsThroughputCost}`,
                text: `${viewCalculation.ebsCalculation.totalEbsThroughputCostText}`
            },
            {
                label: 'EBS total cost',
                value: `$${viewCalculation.ebsOnlyCost}`,
                text: `Total storage cost ($${viewCalculation.ebsCalculation.totalEbsStorageCost}) + Total IOPS cost ($${viewCalculation.ebsCalculation.totalEbsIopsCost}) + Total throughput cost ($${viewCalculation.ebsCalculation.totalEbsThroughputCost})`
            }
        ],
        gp3SnapshotType: viewCalculation?.ebsSnapshotCalculation?.gp3?.totalEbsSnapshotCost
            ? [
                  {
                      label: 'Total snapshots',
                      value: `${viewCalculation.ebsSnapshotCalculation.gp3.totalSnapshots}`,
                      text: 'Total Snapshots of primary database volume'
                  },
                  {
                      label: 'Amount changed in GiB per snapshot',
                      value: `${viewCalculation.ebsSnapshotCalculation.gp3.amountChangedPerSnapshot}`,
                      text: `(Monthly change rate % / total snapshots) x Total storage = (${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.gp3.totalSnapshots}) x ${viewCalculation.ebsSnapshotCalculation.gp3.storageAmount}`
                  },
                  {
                      label: 'Initial snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp3.initialSnapshotCost}`,
                      text: `Total storage x EBS snapshots price per GiB = ${
                          viewCalculation.ebsSnapshotCalculation.gp3.storageAmount
                      } x $${viewCalculation.ebsSnapshotCalculation.gp3.ebsSnapshotPrice?.price || 0}`
                  },
                  {
                      label: 'Monthly cost of each snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp3.monthlyCostPerSnapshot}`,
                      text: `Amount changed in GiB per snapshot (${
                          viewCalculation.ebsSnapshotCalculation.gp3.amountChangedPerSnapshot
                      }) x EBS snapshot price ($${
                          viewCalculation.ebsSnapshotCalculation.gp3.ebsSnapshotPrice?.price || 0
                      })`
                  },
                  {
                      label: 'Discount for partial storage month',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp3.discountForPartialStorageMonth}`,
                      text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.gp3.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
                  },
                  {
                      label: 'Incremental snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp3.incrementalSnapshotCost}`,
                      text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.gp3.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.gp3.totalSnapshots})`
                  }
              ]
            : [],
        io2SnapshotType: viewCalculation?.ebsSnapshotCalculation?.io2?.totalEbsSnapshotCost
            ? [
                  {
                      label: 'Total snapshots',
                      value: `${viewCalculation.ebsSnapshotCalculation.io2.totalSnapshots}`,
                      text: 'Total Snapshots of primary database volume'
                  },
                  {
                      label: 'Amount changed in GiB per snapshot',
                      value: `${viewCalculation.ebsSnapshotCalculation.io2.amountChangedPerSnapshot}`,
                      text: `(Monthly change rate % / total snapshots) x Total storage = (${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.io2.totalSnapshots}) x ${viewCalculation.ebsSnapshotCalculation.io2.storageAmount}`
                  },
                  {
                      label: 'Initial snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io2.initialSnapshotCost}`,
                      text: `Total storage x EBS snapshots price per GiB = ${
                          viewCalculation.ebsSnapshotCalculation.io2.storageAmount
                      } x $${viewCalculation.ebsSnapshotCalculation.io2.ebsSnapshotPrice?.price || 0}`
                  },
                  {
                      label: 'Monthly cost of each snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io2.monthlyCostPerSnapshot}`,
                      text: `Amount changed in GiB per snapshot (${
                          viewCalculation.ebsSnapshotCalculation.io2.amountChangedPerSnapshot
                      }) x EBS snapshot price ($${
                          viewCalculation.ebsSnapshotCalculation.io2.ebsSnapshotPrice?.price || 0
                      })`
                  },
                  {
                      label: 'Discount for partial storage month',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io2.discountForPartialStorageMonth}`,
                      text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.io2.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
                  },
                  {
                      label: 'Incremental snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io2.incrementalSnapshotCost}`,
                      text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.io2.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.io2.totalSnapshots})`
                  }
              ]
            : [],
        io1SnapshotType: viewCalculation?.ebsSnapshotCalculation?.io1?.totalEbsSnapshotCost
            ? [
                  {
                      label: 'Total snapshots',
                      value: `${viewCalculation.ebsSnapshotCalculation.io1.totalSnapshots}`,
                      text: 'Total Snapshots of primary database volume'
                  },
                  {
                      label: 'Amount changed in GiB per snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io1.amountChangedPerSnapshot}`,
                      text: `(Monthly change rate % / total snapshots) x Total storage = (${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.io1.totalSnapshots}) x ${viewCalculation.ebsSnapshotCalculation.io1.storageAmount}`
                  },
                  {
                      label: 'Initial snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io1.initialSnapshotCost}`,
                      text: `Total storage x EBS snapshots price per GiB = ${
                          viewCalculation.ebsSnapshotCalculation.io1.storageAmount
                      } x $${viewCalculation.ebsSnapshotCalculation.io1.ebsSnapshotPrice?.price || 0}`
                  },
                  {
                      label: 'Monthly cost of each snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io1.monthlyCostPerSnapshot}`,
                      text: `Amount changed in GiB per snapshot (${
                          viewCalculation.ebsSnapshotCalculation.io1.amountChangedPerSnapshot
                      }) x EBS snapshot price ($${
                          viewCalculation.ebsSnapshotCalculation.io1.ebsSnapshotPrice?.price || 0
                      })`
                  },
                  {
                      label: 'Discount for partial storage month',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io1.discountForPartialStorageMonth}`,
                      text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.io1.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
                  },
                  {
                      label: 'Incremental snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.io1.incrementalSnapshotCost}`,
                      text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.io1.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.io1.totalSnapshots})`
                  }
              ]
            : [],
        gp2SnapshotType: viewCalculation?.ebsSnapshotCalculation?.gp2?.totalEbsSnapshotCost
            ? [
                  {
                      label: 'Total snapshots',
                      value: `${viewCalculation.ebsSnapshotCalculation.gp2.totalSnapshots}`,
                      text: 'Total Snapshots of primary database volume'
                  },
                  {
                      label: 'Amount changed in GiB per snapshot',
                      value: `${viewCalculation.ebsSnapshotCalculation.gp2.amountChangedPerSnapshot}`,
                      text: `(Monthly change rate % / total snapshots) x Total storage = (${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.gp2.totalSnapshots}) x ${viewCalculation.ebsSnapshotCalculation.gp2.storageAmount}`
                  },
                  {
                      label: 'Initial snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp2.initialSnapshotCost}`,
                      text: `Total storage x EBS snapshots price per GiB = ${
                          viewCalculation.ebsSnapshotCalculation.gp2.storageAmount
                      } x $${viewCalculation.ebsSnapshotCalculation.gp2.ebsSnapshotPrice?.price || 0}`
                  },
                  {
                      label: 'Monthly cost of each snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp2.monthlyCostPerSnapshot}`,
                      text: `Amount changed in GiB per snapshot (${
                          viewCalculation.ebsSnapshotCalculation.gp2.amountChangedPerSnapshot
                      }) x EBS snapshot price ($${
                          viewCalculation.ebsSnapshotCalculation.gp2.ebsSnapshotPrice?.price || 0
                      })`
                  },
                  {
                      label: 'Discount for partial storage month',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp2.discountForPartialStorageMonth}`,
                      text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.gp2.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
                  },
                  {
                      label: 'Incremental snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.gp2.incrementalSnapshotCost}`,
                      text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.gp2.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.gp2.totalSnapshots})`
                  }
              ]
            : [],
        st1SnapshotType: viewCalculation?.ebsSnapshotCalculation?.st1?.totalEbsSnapshotCost
            ? [
                  {
                      label: 'Total snapshots',
                      value: `${viewCalculation.ebsSnapshotCalculation.st1.totalSnapshots}`,
                      text: 'Total Snapshots of primary database volume'
                  },
                  {
                      label: 'Amount changed in GiB per snapshot',
                      value: `${viewCalculation.ebsSnapshotCalculation.st1.amountChangedPerSnapshot}`,
                      text: `(Monthly change rate % / total snapshots) x Total storage = (${viewCalculation.monthlyChangeRate}%/${viewCalculation.ebsSnapshotCalculation.st1.totalSnapshots}) x ${viewCalculation.ebsSnapshotCalculation.st1.storageAmount}`
                  },
                  {
                      label: 'Initial snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.st1.initialSnapshotCost}`,
                      text: `Total storage x EBS snapshots price per GiB = ${
                          viewCalculation.ebsSnapshotCalculation.st1.storageAmount
                      } x $${viewCalculation.ebsSnapshotCalculation.st1.ebsSnapshotPrice?.price || 0}`
                  },
                  {
                      label: 'Monthly cost of each snapshot',
                      value: `$${viewCalculation.ebsSnapshotCalculation.st1.monthlyCostPerSnapshot}`,
                      text: `Amount changed in GiB per snapshot (${
                          viewCalculation.ebsSnapshotCalculation.st1.amountChangedPerSnapshot
                      }) x EBS snapshot price ($${
                          viewCalculation.ebsSnapshotCalculation.st1.ebsSnapshotPrice?.price || 0
                      })`
                  },
                  {
                      label: 'Discount for partial storage month',
                      value: `$${viewCalculation.ebsSnapshotCalculation.st1.discountForPartialStorageMonth}`,
                      text: `Monthly cost of each snapshots ($${viewCalculation.ebsSnapshotCalculation.st1.monthlyCostPerSnapshot}) x Discount for partial storage month (50%)`
                  },
                  {
                      label: 'Incremental snapshot cost',
                      value: `$${viewCalculation.ebsSnapshotCalculation.st1.incrementalSnapshotCost}`,
                      text: `Discount for partial storage month ($${viewCalculation.ebsSnapshotCalculation.st1.discountForPartialStorageMonth}) x Total snapshots (${viewCalculation.ebsSnapshotCalculation.st1.totalSnapshots})`
                  }
              ]
            : [],
        snapshotsTotalCost: [
            {
                label: 'Total snapshots cost',
                value: `$${viewCalculation.ebsSnapshotCalculation?.totalEbsSnapshotCost}`,
                text: ''
            }
        ]
    };
};

export const viewCalculationForFsxw = (viewCalculation: any, selectedDeploymentModel: string) => {
    const state = store.getState();
    const { selectedManualDeploymentModel, savingsCalculatorFrom } = state.exploreSavings;
    let deploymentModelValue = selectedDeploymentModel;

    if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
    ) {
        deploymentModelValue = selectedManualDeploymentModel?.value;
    }

    const machineDetailsList = [];

    viewCalculation?.fsxwInstanceCalculation?.forEach((calculation: any, index: number) => {
        machineDetailsList.push(
            { label: `Machine ${index + 1} specification` },
            {
                label: 'Instance type',
                value: `${calculation?.instanceType}`,
                text: ''
            },
            {
                label: 'SQL edition',
                value: `${calculation?.sqlEdition}`,
                text: ''
            },
            {
                label: 'SQL license included',
                value: `${calculation?.sqlLicense}`,
                text: ''
            },
            { label: `Machine ${index + 1} pricing calculations` },
            {
                label: 'Instance hourly price',
                value: `${calculation?.computeHourlyPrice}`,
                text: 'Instance hourly price with SQL license included'
            },
            {
                label: `EC2 machine${index + 1} cost`,
                value: `${calculation?.instanceMonthlyPrice}`,
                text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
            }
        );
    });

    machineDetailsList.push({
        label: 'Total EC2 machines cost',
        value: `$${viewCalculation?.totalFsxwEc2MachineCost}`,
        text: ''
    });

    return {
        Ec2InstanceCalculation:
            deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                ? machineDetailsList
                : [
                      {
                          label: 'Machine 1 specification'
                      },
                      {
                          label: 'Instance type',
                          value: `${viewCalculation.fsxwInstanceCalculation?.[0]?.instanceType}`,
                          text: ''
                      },
                      {
                          label: 'SQL edition',
                          value: `${viewCalculation.fsxwInstanceCalculation?.[0]?.sqlEdition}`,
                          text: ''
                      },
                      {
                          label: 'SQL license included',
                          value: `${viewCalculation.fsxwInstanceCalculation?.[0]?.sqlLicense}`,
                          text: ''
                      },
                      {
                          label: 'Machine 1 pricing calculations'
                      },
                      {
                          label: 'Instance hourly price',
                          value: `${viewCalculation.fsxwInstanceCalculation?.[0]?.computeHourlyPrice}`,
                          text: ''
                      },
                      {
                          label: 'EC2 machine total cost',
                          value: `${viewCalculation.fsxwInstanceCalculation?.[0]?.instanceMonthlyPrice}`,
                          text: `Instance hourly price x number of hours in a month = ${viewCalculation.fsxwInstanceCalculation?.[0]?.computeHourlyPrice} x ${viewCalculation.fsxwInstanceCalculation?.[0]?.hoursInAMonth}`
                      }
                  ],
        FSxWCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired storage capacity',
                value: `${viewCalculation.fsxwCalculation.desiredStorageCapacity}`,
                text: ''
            },
            {
                label: 'Deduplication savings',
                value: `${viewCalculation.fsxwCalculation.deduplicationSavings}%`,
                text: ''
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage savings',
                value: `${viewCalculation.fsxwCalculation.storageSavings}`,
                text: `Desired storage capacity x Deduplication savings = ${viewCalculation.fsxwCalculation.desiredStorageCapacity} x ${viewCalculation.fsxwCalculation.deduplicationSavings}%`
            },
            {
                label: 'Effective provisioned storage capacity',
                value: `${viewCalculation.fsxwCalculation.provisionedStorageCapacity} GiB`,
                text: `Desired storage capacity - Storage savings =  ${viewCalculation.fsxwCalculation.desiredStorageCapacity} - ${viewCalculation.fsxwCalculation.storageSavings}`
            },
            {
                label: 'Monthly cost for storage capacity',
                value: `$${viewCalculation.fsxwCalculation.monthlyCostForStorageCapacity}`,
                text: `Effective provisioned storage capacity for FSx for Windows File Server x FSx for Windows File Server SSD Price = ${viewCalculation.fsxwCalculation.provisionedStorageCapacity} x $${viewCalculation.fsxwCalculation.fsxwSsdPrice}`
            },
            {
                label: 'Total default provisioned IOPS',
                value: `${viewCalculation.fsxwCalculation.totalDefaultProvisionedIops} IOPS`,
                text: ''
            },
            {
                label: 'Additional user-provisioned IOPS',
                value: `${viewCalculation.fsxwCalculation.additionalUserProvisionedIops} IOPS`,
                text: ''
            },
            {
                label: 'Billed IOPS',
                value: `${viewCalculation.fsxwCalculation.billedIops} IOPS`,
                text: ''
            },
            {
                label: 'Total monthly cost for provisioned SSD IOPS',
                value: `$${viewCalculation.fsxwCalculation.totalMonthlyCostForProvisionedSsdIops}`,
                text: `Billed x FSx for Windows File Server IOPS price = ${viewCalculation.fsxwCalculation.billedIops} IOPS x $${viewCalculation.fsxwCalculation.fsxwIopsPrice}`
            },
            {
                label: 'Number of file systems required for storage capacity',
                value: `${viewCalculation.fsxwCalculation.numberOfFileSystemsRequiredForStorageCapacity} file system(s)`,
                text: `Effective provisioned storage capacity for FSx for Windows File Server  ÷ FSx for Windows File Server maximum capacity  = ${viewCalculation.fsxwCalculation.provisionedStorageCapacity} GiB ÷ ${viewCalculation.fsxwCalculation.fsxwMaxCapacity}`
            },
            {
                label: 'Number of file systems required for throughput capacity',
                value: `${viewCalculation.fsxwCalculation.numberOfFileSystemsRequiredForThroughputCapacity} file system(s)`,
                text: `FSx for Windows File Server throughput ÷ FSx for Windows File Server max throughput = ${viewCalculation.fsxwCalculation.throughput} MB/s ÷ ${viewCalculation.fsxwCalculation.fsxwMaxThroughput} MB/s`
            },
            {
                label: 'Required fractional number of file systems',
                value: `${viewCalculation.fsxwCalculation.requiredFractionalFileSystems} file system(s)`,
                text: ''
            },
            {
                label: 'Required whole number of file systems',
                value: `${viewCalculation.fsxwCalculation.requiredFileSystems} file system(s)`,
                text: ' '
            },
            {
                label: 'Minimum throughput capacity required',
                value: `${viewCalculation.fsxwCalculation.minThroughputCapacityRequired} MB/s`,
                text: `Calculating the minimum throughput capacity needed to provision file systems x FSx for Windows File Server minimum throughput = ${viewCalculation.fsxwCalculation.requiredFileSystems} file systems x ${viewCalculation.fsxwCalculation.fsxwMinThroughput} MB/s`
            },
            {
                label: 'Provisioned throughput capacity',
                value: `${viewCalculation.fsxwCalculation.provisionedThroughputCapacity} MB/s`,
                text: 'Calculated as the greater of desired aggregate throughput and the minimum throughput capacity required'
            },
            {
                label: 'Total monthly cost for throughput capacity',
                value: `$${viewCalculation.fsxwCalculation.totalMonthlyCostForThroughputCapacity}`,
                text: `Provisioned throughput capacity, calculated as the greater of desired aggregate throughput and the minimum throughput capacity required x FSx for Windows File Server throughput price = ${viewCalculation.fsxwCalculation.provisionedThroughputCapacity} MB/s x $${viewCalculation.fsxwCalculation.fsxwThroughputPrice}`
            },
            {
                label: `${viewCalculation.type} Availability Zone total monthly cost`,
                value: `$${viewCalculation.fsxwCalculation.totalMonthlyCost}`,
                text: `Total monthly cost for FSx for Windows File Server storage capacity  + Total monthly cost for FSx for Windows File Server Provisioned SSD IOPS + Total monthly cost for FSx for Windows File Server throughput capacity = $${viewCalculation.fsxwCalculation.monthlyCostForStorageCapacity} + $${viewCalculation.fsxwCalculation.totalMonthlyCostForProvisionedSsdIops} + $${viewCalculation.fsxwCalculation.totalMonthlyCostForThroughputCapacity}`
            }
        ],
        ShadowCopyCalculation: [
            {
                label: 'Unit conversions'
            },
            {
                label: 'Desired shadow copy storage capacity',
                value: `${viewCalculation.fsxwSnapshotCalculation.desiredSnapshotStorageCapacity}`,
                text: `Monthly change rate(${viewCalculation.monthlyChangeRate}%) x Total storage capacity (${viewCalculation.fsxwCalculation.desiredStorageCapacity})`
            },
            {
                label: 'Deduplication savings',
                value: `${viewCalculation.fsxwCalculation.deduplicationSavings}%`,
                text: ''
            },
            {
                label: 'Pricing calculations'
            },
            {
                label: 'Storage saving',
                value: `${viewCalculation.fsxwSnapshotCalculation.storageSavingSnapshot}`,
                text: `Desired shadow copy storage capacity x Deduplication savings = ${viewCalculation.fsxwSnapshotCalculation.desiredSnapshotStorageCapacity} x ${viewCalculation.fsxwCalculation.deduplicationSavings}%`
            },
            {
                label: 'Effective provisioned storage capacity for FSx for Windows File Server',
                value: `${viewCalculation.fsxwSnapshotCalculation.provisionedStorageCapacityForFsxwSnapshot}`,
                text: `Desired shadow copy storage capacity - Storage saving = ${viewCalculation.fsxwSnapshotCalculation.desiredSnapshotStorageCapacity} - ${viewCalculation.fsxwSnapshotCalculation.storageSavingSnapshot}`
            },
            {
                label: 'Shadow copies total monthly cost',
                value: `$${viewCalculation.fsxwSnapshotCalculation.totalMonthlyCostForFsxwSnapshotStorageCapacity}`,
                text: `Effective provisioned storage capacity for FSx for Windows File Server  x FSx for Windows File Server SSD price = ${viewCalculation.fsxwSnapshotCalculation.provisionedStorageCapacityForFsxwSnapshot} x $${viewCalculation.fsxwCalculation.fsxwSsdPrice}`
            }
        ],
        cloneCalculation: [
            {
                label: 'Number of Cloned copies',
                value: `${viewCalculation.fsxwCloneCalculation.clonedCopiesCount}`,
                text: ''
            },
            {
                label: 'FSx for Windows File Server storage cost for clone',
                value: `$${viewCalculation.fsxwCloneCalculation.capacity}`,
                text: 'FSx for Windows File Server storage cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'FSx for Windows File Server IOPS cost for clone',
                value: `$${viewCalculation.fsxwCloneCalculation.iops}`,
                text: 'FSx for Windows File Server IOPS cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'FSx for Windows File Server throughput cost for clone',
                value: `$${viewCalculation.fsxwCloneCalculation.throughput}`,
                text: 'FSx for Windows File Server throughput cost of primary dbs volumes not including replica dbs volumes'
            },
            {
                label: 'Clones total monthly cost',
                value: `$${viewCalculation.fsxwCloneCalculation.totalCloneMonthlyCost}`,
                text: `Number of Cloned copies (${viewCalculation.fsxwCloneCalculation.clonedCopiesCount}) x (FSx for Windows File Server storage cost ($${viewCalculation.fsxwCloneCalculation.capacity}) + FSx for Windows File Server IOPS cost ($${viewCalculation.fsxwCloneCalculation.iops}) + FSx for Windows File Server throughput cost ($${viewCalculation.fsxwCloneCalculation.throughput}))`
            }
        ],
        totalMonthlyCost: [
            {
                label: 'Total monthly EC2 machine cost',
                value: `$${viewCalculation.totalFsxwEc2MachineCost}`,
                text: ''
            },
            {
                label: 'Total monthly storage cost',
                value: `$${viewCalculation.fsxwCalculation.monthlyCostForStorageCapacity}`,
                text: ''
            },
            {
                label: 'Total monthly IOPS cost',
                value: `$${viewCalculation.fsxwCalculation.totalMonthlyCostForProvisionedSsdIops}`,
                text: ''
            },
            {
                label: 'Total monthly throughput cost',
                value: `$${viewCalculation.fsxwCalculation.totalMonthlyCostForThroughputCapacity}`,
                text: ''
            },
            {
                label: 'Total monthly shadow cost',
                value: `$${viewCalculation.fsxwSnapshotCalculation.totalMonthlyCostForFsxwSnapshotStorageCapacity}`,
                text: ''
            },
            {
                label: 'Total monthly clones cost',
                value: `$${viewCalculation.fsxwCloneCalculation.totalCloneMonthlyCost}`,
                text: ''
            },
            {
                label: 'Total monthly cost',
                value: `$${viewCalculation.fsxwTotalCost}`,
                text: `Total EC2 cost ($${viewCalculation.totalFsxwEc2MachineCost}) + Total storage cost ($${viewCalculation.fsxwCalculation.monthlyCostForStorageCapacity}) + Total IOPS cost ($${viewCalculation.fsxwCalculation.totalMonthlyCostForProvisionedSsdIops}) + Total throughput cost ($${viewCalculation.fsxwCalculation.totalMonthlyCostForThroughputCapacity}) + Total shadow cost ($${viewCalculation.fsxwSnapshotCalculation.totalMonthlyCostForFsxwSnapshotStorageCapacity}) + Total clones cost ($${viewCalculation.fsxwCloneCalculation.totalCloneMonthlyCost})`
            }
        ]
    };
};

export const setRecommendedConfig = (msSqlInstance: any, fsxData: any) => {
    const state = store.getState();
    const initialStateForm = state.mssqlForm;
    const onPremSelectedRegion = state.exploreSavings.selectedOnPremRegion;
    let result = { ...initialStateForm, selectConfig: SELECT_CONFIG.STANDARD_CREATE };

    // mssql instance data
    if (msSqlInstance) {
        // setting instance type
        if (msSqlInstance?.instanceType) {
            const value = msSqlInstance?.instanceType?.toLowerCase();
            const data = { instanceType: msSqlInstance?.instanceType?.toLowerCase() };
            const option = generateOptionType(value, value, '', false, '', data);
            result = { ...result, instanceType: option };
        }
        // OS version
        if (msSqlInstance?.windowsServer) {
            const osVersionOption = OS_VERSIONS_LIST?.filter(perRow =>
                msSqlInstance?.windowsServer.includes(perRow?.value)
            );
            if (osVersionOption && osVersionOption?.length > 0) {
                result = {
                    ...result,
                    operatingSystem: {
                        label: osVersionOption[0].label,
                        value: osVersionOption[0].value
                    }
                };
            }
        } else {
            result = {
                ...result,
                operatingSystem: {
                    label: GENERAL.WIN_SERVER_2019,
                    value: GENERAL.WIN_SERVER_2019_VERSION
                }
            };
        }
        // database version
        if (msSqlInstance?.serverVersion) {
            const dbVersionOption = DB_VERSIONS?.filter(perRow => msSqlInstance?.serverVersion.includes(perRow?.value));
            if (dbVersionOption?.length) {
                const option = generateOptionType(dbVersionOption[0].value, dbVersionOption[0].label, '', false, '');
                result = { ...result, dbVersion: option };
            }
        }
        // database Edition
        if (msSqlInstance?.serverEdition) {
            const dbEditionOption = DB_EDITIONS?.filter(perRow => msSqlInstance?.serverEdition.includes(perRow?.value));
            if (dbEditionOption && dbEditionOption.length > 0) {
                result = { ...result, dbEdition: dbEditionOption[0] };
            } else if (!dbEditionOption || dbEditionOption.length === 0) {
                if (msSqlInstance?.serverEdition?.toLowerCase().includes('express')) {
                    result = {
                        ...result,
                        dbEdition: {
                            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
                            value: GENERAL.SQL_SERVER_STANDARD
                        }
                    };
                } else if (msSqlInstance?.serverEdition?.toLowerCase().includes('developer')) {
                    result = {
                        ...result,
                        dbEdition: {
                            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
                            value: GENERAL.SQL_SERVER_STANDARD
                        }
                    };
                }
            }
        }
        // Deployment Model
        if (msSqlInstance?.serverInstallationMode) {
            let type = msSqlInstance.serverInstallationMode.toLowerCase();
            if (type !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                type = SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE;
            }
            const dbDeploymentModel = DB_DEPLOYMENT_MODEL?.filter(perRow => type === perRow?.value);
            if (dbDeploymentModel?.length) {
                result = { ...result, dbDeploymentModel: dbDeploymentModel[0] };
            }
        }
    }

    // fsxn data
    if (fsxData) {
        // Throughput
        if (fsxData?.throughputCapacity) {
            const throughput = THROUGHPUT_LIST?.filter(perRow => perRow?.value === fsxData?.throughputCapacity);
            if (throughput?.length) {
                const option = generateOptionType(throughput[0]?.label, throughput[0]?.label, '', false, '');
                result = { ...result, throughput: option };
            }
        }
        // Capacity
        if (fsxData?.fsxBreakdown?.fsxDataLunSize) {
            let size = fsxData?.fsxBreakdown?.fsxDataLunSize / GIB_IN_BYTE || 0;
            if (size < 120) {
                size = 120;
            }
            const unitOption = generateOptionType('GiB', 'GiB', '', false, '');
            const capacityValue = formatFractionalNumber(size, 0) || 0;
            result = {
                ...result,
                storageCapacity: {
                    capacity: capacityValue,
                    unit: unitOption
                }
            };
            // IOPS
            if (fsxData?.ssdIop && fsxData?.ssdIop >= Number(capacityValue) * 3) {
                result = {
                    ...result,
                    provisionedIOPS: {
                        provisionedType: GENERAL.USER_PROVISIONED,
                        IOPSValue: fsxData?.ssdIop
                    }
                };
            } else {
                result = {
                    ...result,
                    provisionedIOPS: {
                        provisionedType: GENERAL.AUTOMATIC,
                        IOPSValue: ''
                    }
                };
            }
        }
    }

    // OnPrem Region
    if (onPremSelectedRegion) {
        result = {
            ...result,
            regionAndVpc: {
                ...result.regionAndVpc,
                selectedRegion: onPremSelectedRegion
            }
        };
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
    fsxData: any,
    configRefetch: any
) => {
    const state = store.getState();
    const { saveConfigName } = state.exploreSavings;
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
        saveConfigData({ payload })
            .then((data: any) => {
                if (!data?.error) {
                    dispatch(setSavedConfig(state.mssqlForm));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS
                        })
                    );
                    configRefetch();
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

export const mergeAoagVolumesList = (listA: any[], listB: any[]) => {
    const mergedMap = new Map();
    const addToMap = (list: any[]) => {
        list.forEach(item => {
            if (mergedMap.has(item.id)) {
                mergedMap.set(item.id, { ...mergedMap.get(item.id), ...item });
            } else {
                mergedMap.set(item.id, item);
            }
        });
    };
    if (listA) {
        addToMap(listA);
    }
    if (listB) {
        addToMap(listB);
    }
    return Array.from(mergedMap.values());
};

export const allPropertiesHaveValues = (obj: any) => {
    for (const key in obj) {
        if (obj[key] === null || obj[key] === undefined || obj[key] === '' || parseInt(obj[key]) === 0) {
            return 0;
        }
    }
    return 1;
};

export const calculateTotalVolumes = (
    io1Complete: number,
    io2Complete: number,
    gp2Complete: number,
    gp3Complete: number,
    st1Complete: number,
    manualTCOVolumeTypes: any
) =>
    Number(io1Complete ? manualTCOVolumeTypes?.io1?.manualTCONumberOfVolumes : 0) +
    Number(io2Complete ? manualTCOVolumeTypes?.io2?.manualTCONumberOfVolumes : 0) +
    Number(gp2Complete ? manualTCOVolumeTypes?.gp2?.manualTCONumberOfVolumes : 0) +
    Number(gp3Complete ? manualTCOVolumeTypes?.gp3?.manualTCONumberOfVolumes : 0) +
    Number(st1Complete ? manualTCOVolumeTypes?.st1?.manualTCONumberOfVolumes : 0);

const byteConversion = (gib: number) => gib * 1024 ** 3;

export const checkForIO1Valid = (data: any) => {
    const volIops = Number(data?.manualTCOProvisionedIOPS);
    const volStorageSaving = Number(data?.manualTCOStorageAmount);
    const volData = Number(data?.manualTCONumberOfVolumes);
    if (volIops < 100 || volIops > 64000 || volStorageSaving > 16384 || volData > 1000000000) {
        return false;
    }
    return true;
};

export const checkForIO2Valid = (data: any) => {
    const volIops = Number(data?.manualTCOProvisionedIOPS);
    const volStorageSaving = Number(data?.manualTCOStorageAmount);
    const volData = Number(data?.manualTCONumberOfVolumes);
    if (volIops < 100 || volIops > 256000 || volStorageSaving < 4 || volStorageSaving > 16384 || volData > 1000000000) {
        return false;
    }
    return true;
};

export const gp2Valid = (data: any) => {
    const volStorageSaving = Number(data?.manualTCOStorageAmount);
    const volData = Number(data?.manualTCONumberOfVolumes);
    if (volStorageSaving === 0 || volStorageSaving > 16384 || volData > 1000000000) {
        return false;
    }
    return true;
};

export const checkForGp3Valid = (data: any) => {
    const volIops = Number(data?.manualTCOProvisionedIOPS);
    const volStorageSaving = Number(data?.manualTCOStorageAmount);
    const volThroughput = Number(data?.manualTCOThroughput);
    const volData = Number(data?.manualTCONumberOfVolumes);
    if (
        volIops < 3000 ||
        volIops > 16000 ||
        volStorageSaving > 16384 ||
        volThroughput < 125 ||
        volThroughput > 1000 ||
        volData > 1000000000
    ) {
        return false;
    }
    return true;
};

export const checkForSt1Valid = (data: any) => {
    const volData = Number(data?.manualTCONumberOfVolumes);
    const volStorageSaving = Number(data?.manualTCOStorageAmount);
    if (volStorageSaving < 125 || volStorageSaving > 16384 || volData > 1000000000) {
        return false;
    }
    return true;
};

const generateVolumesData = (manualTCOVolumeTypes: any) => {
    const arr = [];
    const io1Complete = allPropertiesHaveValues({
        manualTCONumberOfVolumes: manualTCOVolumeTypes?.io1?.manualTCONumberOfVolumes,
        manualTCOStorageAmount: manualTCOVolumeTypes?.io1?.manualTCOStorageAmount,
        manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io1?.manualTCOProvisionedIOPS
    });
    const io2Complete = allPropertiesHaveValues({
        manualTCONumberOfVolumes: manualTCOVolumeTypes?.io2?.manualTCONumberOfVolumes,
        manualTCOStorageAmount: manualTCOVolumeTypes?.io2?.manualTCOStorageAmount,
        manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io2?.manualTCOProvisionedIOPS
    });
    const gp2Complete = allPropertiesHaveValues({
        manualTCONumberOfVolumes: manualTCOVolumeTypes?.gp2?.manualTCONumberOfVolumes,
        manualTCOStorageAmount: manualTCOVolumeTypes?.gp2?.manualTCOStorageAmount
    });
    const gp3Complete = allPropertiesHaveValues(manualTCOVolumeTypes?.gp3);
    const st1Complete = allPropertiesHaveValues({
        manualTCONumberOfVolumes: manualTCOVolumeTypes?.st1?.manualTCONumberOfVolumes,
        manualTCOStorageAmount: manualTCOVolumeTypes?.st1?.manualTCOStorageAmount
    });
    if (st1Complete && checkForSt1Valid(manualTCOVolumeTypes?.st1)) {
        arr.push({
            volumeType: 'st1',
            volumeNumber: +manualTCOVolumeTypes?.st1?.manualTCONumberOfVolumes,
            storageAmount: byteConversion(+manualTCOVolumeTypes?.st1?.manualTCOStorageAmount)
        });
    }
    if (gp3Complete && checkForGp3Valid(manualTCOVolumeTypes?.gp3)) {
        arr.push({
            volumeType: 'gp3',
            volumeNumber: +manualTCOVolumeTypes?.gp3?.manualTCONumberOfVolumes,
            storageAmount: byteConversion(+manualTCOVolumeTypes?.gp3?.manualTCOStorageAmount),
            volumeIops: +manualTCOVolumeTypes?.gp3?.manualTCOProvisionedIOPS,
            throughput: +manualTCOVolumeTypes?.gp3?.manualTCOThroughput
        });
    }
    if (gp2Complete && gp2Valid(manualTCOVolumeTypes?.gp2)) {
        arr.push({
            volumeType: 'gp2',
            volumeNumber: +manualTCOVolumeTypes?.gp2?.manualTCONumberOfVolumes,
            storageAmount: byteConversion(+manualTCOVolumeTypes?.gp2?.manualTCOStorageAmount)
        });
    }
    if (io2Complete && checkForIO2Valid(manualTCOVolumeTypes?.io2)) {
        arr.push({
            volumeType: 'io2',
            volumeNumber: +manualTCOVolumeTypes?.io2?.manualTCONumberOfVolumes,
            storageAmount: byteConversion(+manualTCOVolumeTypes?.io2?.manualTCOStorageAmount),
            volumeIops: +manualTCOVolumeTypes?.io2?.manualTCOProvisionedIOPS
        });
    }
    if (io1Complete && checkForIO1Valid(manualTCOVolumeTypes?.io1)) {
        arr.push({
            volumeType: 'io1',
            volumeNumber: +manualTCOVolumeTypes?.io1?.manualTCONumberOfVolumes,
            storageAmount: byteConversion(+manualTCOVolumeTypes?.io1?.manualTCOStorageAmount),
            volumeIops: +manualTCOVolumeTypes?.io1?.manualTCOProvisionedIOPS
        });
    }
    return arr;
};

const generateFsxwData = (state: any) => {
    const {
        selectedManualDeploymentType,
        selectedManualStorageType,
        manualStorageCapacity,
        selectedManualStorageCapacityUnit,
        selectedManualFSXIOPS,
        selectedManualFSXThroughput
    } = state.exploreSavings;

    let deploymentType = '';
    if (selectedManualDeploymentType?.value === TCO_MANUAL_DEPLOYMENT_TYPE.SINGLE) {
        deploymentType = 'Single';
    } else if (selectedManualDeploymentType?.value === TCO_MANUAL_DEPLOYMENT_TYPE.MULTI) {
        deploymentType = 'Multi';
    }
    let storageCapacity = manualStorageCapacity;
    if (selectedManualStorageCapacityUnit?.value === 'GiB') {
        storageCapacity = manualStorageCapacity * GIB_IN_BYTE;
    } else if (selectedManualStorageCapacityUnit?.value === 'TiB') {
        storageCapacity = manualStorageCapacity * TIB_IN_BYTE;
    }

    const result = {
        deploymentType,
        storageVolumeType: selectedManualStorageType?.value,
        storageAmount: storageCapacity,
        volumeIops: selectedManualFSXIOPS,
        throughput: selectedManualFSXThroughput
    };
    return result;
};

const createInstances = (state: any) => {
    const instanceArr = [];
    const {
        selectedManualDeploymentModel,
        selectedManualServerEdition,
        selectedManualInstanceType,
        selectedSecondaryManualInstanceType,
        manualMonthlyDescription,
        manualSecondaryMachineDescription,
        manualTCOVolumeTypes,
        secondaryVolumeFilledStatus,
        manualTCOVolumeTypes2,
        savingsCalculatorFrom
    } = state.exploreSavings;

    let firstInstance: any = {
        ec2InstanceDescription: manualMonthlyDescription || null,
        ec2InstanceType: selectedManualInstanceType?.value,
        isPrimary: true
    };

    if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
    ) {
        firstInstance = {
            ...firstInstance,
            volumes: generateVolumesData(manualTCOVolumeTypes)
        };
    } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
        firstInstance = {
            ...firstInstance,
            fsxw: generateFsxwData(state)
        };
    }
    instanceArr.push(firstInstance);

    if (
        (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS) &&
        selectedManualDeploymentModel?.label !== DATABASE_DEPLOYMENT_MODE.STANDALONE &&
        secondaryVolumeFilledStatus
    ) {
        instanceArr.push({
            ec2InstanceDescription: manualSecondaryMachineDescription || null,
            ec2InstanceType: selectedSecondaryManualInstanceType?.value,
            isPrimary: false,
            volumes: generateVolumesData(manualTCOVolumeTypes2)
        });
    }

    return instanceArr;
};

const setSQLServerEdition = (value: string) => {
    switch (value) {
        case 'SQL server Enterprise':
            return 'Enterprise Edition';
        case 'SQL server Standard':
            return 'Standard Edition';
        case 'SQL server Web':
            return 'Web Edition';
        case 'SQL server Developer':
            return 'Developer Edition';
    }
};

const deploymentTypeSelection = (value: string, savingsCalculatorFrom: string | null, engineType: string) => {
    if (value !== DATABASE_DEPLOYMENT_MODE.STANDALONE) {
        if (engineType === DBType.ORACLE) {
            return DATABASE_DEPLOYMENT_MODE.DATAGUARD;
        }
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
            return SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE_CAPS;
        }
        return DATABASE_DEPLOYMENT_MODE.AOAG_CAPS;
    }
    return value;
};

export const generateManualStorageSavingsPayload = () => {
    const state = store.getState();
    const {
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedSnapshotFrequency,
        monthlyBYOLCost,
        selectedManualServerEdition,
        savingsCalculatorFrom
    } = state.exploreSavings;
    const payloadObj: any = {};

    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS) {
        // Oracle manual EBS payload
        payloadObj.oracleDeploymentType = deploymentTypeSelection(
            selectedManualDeploymentModel?.value,
            savingsCalculatorFrom,
            DBType.ORACLE
        );
        payloadObj.clonedCopiesCount = Number(numberOfClonedCopies);
        payloadObj.snapshotFrequency = selectedSnapshotFrequency?.value;
        payloadObj.monthlyChangeRatePercentage = Number(monthlyChangeRate);
        payloadObj.ec2Instances = createInstances(state);
    } else {
        // MSSQL manual EBS/FSXW payload
        payloadObj.sqlServerDeploymentType = deploymentTypeSelection(
            selectedManualDeploymentModel?.value,
            savingsCalculatorFrom,
            DBType.MSSQL
        );
        payloadObj.clonedCopiesCount = Number(numberOfClonedCopies);
        payloadObj.snapshotFrequency = selectedSnapshotFrequency?.value;
        payloadObj.monthlyChangeRatePercentage = Number(monthlyChangeRate);
        if (monthlyBYOLCost) {
            payloadObj.monthlySqlByolCost = Number(monthlyBYOLCost);
        }
        payloadObj.sqlServerEdition = setSQLServerEdition(selectedManualServerEdition?.value);
        payloadObj.ec2Instances = createInstances(state);
    }
    return payloadObj;
};

export const checkIfByolFieldRequired = (
    selectedHostDetails: any,
    isByolField: boolean,
    savingsCalculatorFrom: string | null
) => {
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
        return false;
    }
    const serverEdition: any = [];
    selectedHostDetails?.sqlServerInstances?.map((perRow: any) => {
        if (perRow?.databaseServer?.serverEdition && !serverEdition.includes(perRow?.databaseServer?.serverEdition)) {
            serverEdition.push(perRow?.databaseServer?.serverEdition);
        }
    });
    const sqlEdition = serverEdition.join(',').toLowerCase();
    const licenseIncluded = selectedHostDetails?.sqlLicenseIncluded;
    // BYOL field should be disabled for sql edition (evaluation/express/developer) and if sql license included is true
    if (
        licenseIncluded ||
        sqlEdition.includes('evaluation') ||
        sqlEdition.includes('express') ||
        sqlEdition.includes('developer')
    ) {
        return false;
    }
    if (licenseIncluded !== undefined && !licenseIncluded) {
        return true;
    }
    return isByolField;
};

/**
 * This function will check if TCO selected host has protection data or not.
 * @param data
 * @returns Protected/Unprotected/Unknown
 */
export const checkIfEbsProtected = (selectedHostDetailsD?: any, perfMssqlInstancesDataD?: any) => {
    const state = store.getState();
    let selectedHostDetails = selectedHostDetailsD;
    let perfMssqlInstancesData = perfMssqlInstancesDataD;
    if (!selectedHostDetails) {
        selectedHostDetails = state.exploreSavings.selectedHostDetails;
    }
    if (!perfMssqlInstancesData) {
        perfMssqlInstancesData = state.inventoryV2.perfMssqlInstancesData;
    }
    if (selectedHostDetails?.sqlServerInstances?.length > 0) {
        let unprotected: boolean = false;
        let protectedVal: boolean = false;
        selectedHostDetails?.sqlServerInstances?.map((perRow: any) => {
            if (perRow?.protection) {
                if (perRow?.protection?.isAwsBackupEnabled?.ebs) {
                    protectedVal = true;
                } else {
                    unprotected = true;
                }
            }
        });

        if (protectedVal) {
            return EBS_PROTECTED_OPTIONS.PROTECTED;
        }
        if (unprotected) {
            return EBS_PROTECTED_OPTIONS.UNPROTECTED;
        }
        if (
            !selectedHostDetails?.loading &&
            perfMssqlInstancesData?.[
                uniqueHostRow(selectedHostDetails?.id, selectedHostDetails?.credentialId, selectedHostDetails?.regionId)
            ] &&
            !perfMssqlInstancesData?.[
                uniqueHostRow(selectedHostDetails?.id, selectedHostDetails?.credentialId, selectedHostDetails?.regionId)
            ]?.loading
        ) {
            return EBS_PROTECTED_OPTIONS.UNKNOWN;
        }
    }
    return '';
};

export const prepareViewCalcData = (
    apiResponse: ViewCalculationsInterface,
    dispatch: any,
    selectedDeploymentModel: string,
    monthlyChangeRate: string,
    selectedCalculatorMode?: string
) => {
    const formattedData = formatViewCalcData(apiResponse, selectedDeploymentModel, monthlyChangeRate);
    if (apiResponse?.fsxOptimizedSingle) {
        let optimizedViewData = {
            ...apiResponse
        };
        if (apiResponse?.single) {
            optimizedViewData = {
                ...optimizedViewData,
                single: apiResponse?.fsxOptimizedSingle
            };
        } else {
            optimizedViewData = {
                ...optimizedViewData,
                multi: apiResponse?.fsxOptimizedSingle
            };
        }
        const optimizedFormattedData = formatViewCalcData(
            optimizedViewData,
            selectedDeploymentModel,
            monthlyChangeRate
        );
        dispatch(
            setOptimizedViewCalculationResponse({
                standard: formattedData,
                optimized: optimizedFormattedData
            })
        );
        const isStandard = selectedCalculatorMode === TCO_CALCULATOR_MODE.STANDARD;
        dispatch(setViewCalculationsResponse(isStandard ? formattedData : optimizedFormattedData));
    } else {
        dispatch(setViewCalculationsResponse(formattedData));
    }
};

export const prepareStorageSavingsData = (
    apiResponse: StorageSavingsInterface,
    dispatch: any,
    selectedCalculatorMode?: string
) => {
    const formattedData = formatStorageSavingsRecommendedData(apiResponse);
    if (apiResponse?.fsxOptimized) {
        const recommendedDiff = Number(apiResponse?.fsx?.total) - Number(apiResponse?.fsxOptimized?.total);
        let optimizedStorageData = {
            ...apiResponse,
            fsx: apiResponse?.fsxOptimized,
            totalSummary: {
                ...apiResponse?.totalSummary,
                recommended:
                    apiResponse?.totalSummary?.optimized ||
                    Number(apiResponse?.totalSummary?.recommended) - recommendedDiff
            }
        };
        if (apiResponse?.single) {
            optimizedStorageData = {
                ...optimizedStorageData,
                single: apiResponse?.fsxOptimizedSingle
            };
        } else {
            optimizedStorageData = {
                ...optimizedStorageData,
                multi: apiResponse?.fsxOptimizedSingle
            };
        }
        const optimizedFormattedData = formatStorageSavingsRecommendedData(optimizedStorageData);
        dispatch(
            setOptimizedStorageSavingsResponse({
                standard: formattedData,
                optimized: optimizedFormattedData
            })
        );
        const isStandard = selectedCalculatorMode === TCO_CALCULATOR_MODE.STANDARD;
        dispatch(setStorageSavingsResponse(isStandard ? formattedData : optimizedFormattedData));
    } else {
        dispatch(setStorageSavingsResponse(formattedData));
    }
};
