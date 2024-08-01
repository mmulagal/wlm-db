import store from '../../store/store';
import {
    setDisableState,
    setSavingsCalculatorFrom,
    setSelectedDeploymentModel,
    setSelectedHostDetails,
    setSelectedInstanceId,
    setSelectedServerName
} from '../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventorySlice';
import { GENERAL } from '../../utils/appConstants';
import { FSX_AZ_TYPE, GIB_IN_BYTE, SQL_DEPLOYMENT_MODE, WLF_TABS } from '../../utils/consts';
import {
    EBSCalculation,
    StorageSavingsInterface,
    ViewCalculationsInterface
} from '../../utils/types/exploreSavingsType';
import { formatFractionalNumber } from '../../utils/utilityFunctions';

export const onClickESHost = (dispatch: any, rowData: any) => {
    const deploymentModel = (() => {
        return rowData?.sqlServerInstances?.[0]?.sqlServerDeploymentType?.toLowerCase();
    })();
    dispatch(setSavingsCalculatorFrom('Auto'));
    dispatch(setDisableState(false));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(setSelectedInstanceId(rowData?.id));
    dispatch(setSelectedDeploymentModel(deploymentModel));
    dispatch(setSelectedServerName(rowData.sqlServerInstances?.[0].sqlServerName || GENERAL.ES_SERVER_NAME));
    setESInstanceData(rowData, dispatch);
};

export const handleManualTCO = (dispatch: any) => {
    dispatch(setSavingsCalculatorFrom('Manual'));
    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
};

export const handleManualTCOFSX = (dispatch: any) => {
    dispatch(setSavingsCalculatorFrom('Manual_FSX'));
    dispatch(setDisableState(false));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
};

export const setESInstanceData = (data: any, dispatch: any) => {
    let serverInstallationMode = data?.serverInstallationMode;
    if (data?.serverInstallationMode === GENERAL.AOAG) {
        serverInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    }
    dispatch(
        setSelectedHostDetails({
            ...data,
            recommendedInstance: {
                serverInstallationMode: serverInstallationMode,
                serverVersion:
                    data?.databaseServer?.serverVersion || data?.sqlServerInstances?.[0]?.databaseServer?.serverVersion
            }
        })
    );
};

export const formatCalcSize = (val: any) => {
    if (val) {
        return String(Number(val / GIB_IN_BYTE).toLocaleString()) + ' GiB';
    } else {
        return '0 GiB';
    }
};

export const formatPrice = (val: any) => {
    if (val || val === 0) {
        return '$' + Number(val).toLocaleString();
    } else {
        return GENERAL.NOT_AVAILABLE;
    }
};

export const formatNumbers = (val: any) => {
    if (val || val === 0) {
        return Number(val).toLocaleString();
    } else {
        return GENERAL.NOT_AVAILABLE;
    }
};

export const formatPercentage = (val: any) => {
    if (val || val === 0) {
        return Number(100 * val).toLocaleString();
    } else {
        return GENERAL.NOT_AVAILABLE;
    }
};

export const formatViewCalcInstance = (
    selectedDeploymentModel: any,
    selectedHostDetails: any,
    computeDetails: any,
    licenseDetails: any
) => {
    let instanceTypelist = [];
    if (selectedHostDetails?.clusterNodeDetails && selectedHostDetails?.clusterNodeDetails?.length === 2) {
        instanceTypelist = selectedHostDetails?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
    } else {
        instanceTypelist = selectedHostDetails?.topology?.ec2Details?.map((inst: any) => inst?.instanceType);
    }
    const instanceCalculationData = (() => {
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            return [
                {
                    instanceType: computeDetails?.[0]?.instanceType || instanceTypelist?.[0] || GENERAL.NOT_AVAILABLE,
                    computeHourlyPrice: formatPrice(computeDetails?.[0]?.price),
                    computeMonthlyPrice: formatPrice(computeDetails?.[0]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[0]?.hoursInMonth)
                }
            ];
        } else {
            return [
                {
                    instanceType: computeDetails?.[0]?.instanceType || instanceTypelist?.[0] || GENERAL.NOT_AVAILABLE,
                    computeHourlyPrice: formatPrice(computeDetails?.[0]?.price),
                    computeMonthlyPrice: formatPrice(computeDetails?.[0]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[0]?.hoursInMonth)
                },
                {
                    instanceType: computeDetails?.[1]?.instanceType || instanceTypelist?.[1] || GENERAL.NOT_AVAILABLE,
                    computeHourlyPrice: formatPrice(computeDetails?.[1]?.price),
                    computeMonthlyPrice: formatPrice(computeDetails?.[1]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[1]?.hoursInMonth)
                }
            ];
        }
    })();
    return instanceCalculationData;
};

export const formatViewCalcRecommendedData = (data: ViewCalculationsInterface, selectedDeploymentModel: string) => {
    let result: ViewCalculationsInterface = {};
    if (data) {
        const state = store.getState();
        const recommendedTargetInstance = state.exploreSavings.recommendedTargetInstance;
        let recommendeRow: any = null;
        if (recommendedTargetInstance) {
            recommendeRow = data?.recommendedComputeCalculation?.recommendationOptions?.filter(
                perRow => perRow?.instanceType === recommendedTargetInstance
            );
        }
        if (recommendeRow && recommendeRow?.length) {
            result = {
                ...data,
                recommendedInstance:
                    selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                        ? [recommendeRow?.[0]]
                        : [recommendeRow?.[0], recommendeRow?.[0]]
            };
        } else {
            result = {
                ...data,
                recommendedInstance: data?.recommendedComputeCalculation?.machineDetails
            };
        }
    } else {
        result = data;
    }
    return result;
};

export const formatViewCalcData = (
    viewCalculations: ViewCalculationsInterface,
    selectedDeploymentModel: string,
    monthlyChangeRate: string
) => {
    let viewCalculationsResponse = formatViewCalcRecommendedData(viewCalculations, selectedDeploymentModel);
    let azType = '';
    if (viewCalculationsResponse?.single) {
        viewCalculationsResponse = {
            ...viewCalculationsResponse,
            fsxOntapCalculation: viewCalculationsResponse?.single?.fsxOntapCalculation,
            fsxOntapSnapshotCalculation: viewCalculationsResponse?.single?.fsxOntapSnapshotCalculation,
            fsxCloneCalculation: viewCalculationsResponse?.single?.fsxCloneCalculation
        };
        azType = FSX_AZ_TYPE.SINGLE;
    } else if (viewCalculationsResponse?.multi) {
        viewCalculationsResponse = {
            ...viewCalculationsResponse,
            fsxOntapCalculation: viewCalculationsResponse?.multi?.fsxOntapCalculation,
            fsxOntapSnapshotCalculation: viewCalculationsResponse?.multi?.fsxOntapSnapshotCalculation,
            fsxCloneCalculation: viewCalculationsResponse?.multi?.fsxCloneCalculation
        };
        azType = FSX_AZ_TYPE.MULTI;
    }

    const totalEbsCost = (ebsViewCalculationData: any) => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[0]?.computeMonthlyPrice || 0
            );
        } else {
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[0]?.computeMonthlyPrice || 0
            );
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[1]?.computeMonthlyPrice || 0
            );
        }
        cost += ebsViewCalculationData?.ebsSnapshotCalculation?.totalEbsSnapshotCostValue || 0;
        cost += ebsViewCalculationData?.ebsCloneCalculation?.totalCloneMonthlyCostValue || 0;

        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost || 0;
        return formatFractionalNumber(cost, 2);
    };

    const onlyEbsCost = (ebsViewCalculationData: any) => {
        let cost = 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost || 0;
        return formatFractionalNumber(cost, 2);
    };

    const totalEbsEc2MachineCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[0]?.computeMonthlyPrice || 0
            );
        } else {
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[0]?.computeMonthlyPrice || 0
            );
            cost += Number(
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails?.[1]?.computeMonthlyPrice || 0
            );
        }
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxEc2MachineCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.computeMonthlyPrice || 0);
        } else {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.computeMonthlyPrice || 0);
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[1]?.computeMonthlyPrice || 0);
        }
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.computeMonthlyPrice || 0);
        } else {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.computeMonthlyPrice || 0);
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[1]?.computeMonthlyPrice || 0);
        }
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge || 0);
        cost += Number(viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalSnapshotMonthlyCost || 0);
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxSnapshotCost = (() => {
        let cost = 0;
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForCapacity || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForFsxSsd || 0);
        return formatFractionalNumber(cost, 2);
    })();

    const totalAzCost = (() => {
        let cost = 0;
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge || 0);
        return formatFractionalNumber(cost, 2);
    })();

    const ebsViewCalculationData = getEbsViewCalculationData(viewCalculationsResponse);

    const result = {
        ...ebsViewCalculationData,
        ebsCalculation: {
            ...ebsViewCalculationData?.ebsCalculation,
            totalEbsThroughputCost: formatNumbers(ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost),
            totalEbsIopsCost: formatNumbers(ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost),
            totalEbsStorageCost: formatNumbers(ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost)
        },
        fsxInstanceCalculation: formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            viewCalculationsResponse?.recommendedInstance,
            viewCalculationsResponse?.recommendedLicenseCalculation
        ),
        ebsInstanceCalculation: formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            viewCalculationsResponse?.existingComputeCalculation?.machineDetails,
            viewCalculationsResponse?.existingLicenseCalculation
        ),
        fsxOntapCalculation: {
            numberOfVolumes: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.numberOfVolumes),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatPercentage(
                viewCalculationsResponse?.fsxOntapCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatPercentage(
                viewCalculationsResponse?.fsxOntapCalculation?.savingsFromCompressionAndDeduplication
            ),
            storageSavingsFromCompressionAndDeduplication: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.storageSavingsFromCompressionAndDeduplication
            ),
            effectiveFsxnStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.effectiveFsxnStorageCapacity
            ),
            ssdStoragePerMonth: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.ssdStoragePerMonth),
            greaterOfSsdAndMinAllowedSsd: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.greaterOfSsdAndMinAllowedSsd
            ),
            ssdMonthlyCost: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.ssdMonthlyCost),
            totalMonthlyCostForFSxSsd: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyCostForFSxSsd
            ),
            ratioAfterSavings: formatPercentage(viewCalculationsResponse?.fsxOntapCalculation?.ratioAfterSavings),
            dataOnCapacityPoolStorageFactor: formatPercentage(
                viewCalculationsResponse?.fsxOntapCalculation?.dataOnCapacityPoolStorageFactor
            ),
            capacityPoolStorage: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.capacityPoolStorage),
            capacityMonthlyCost: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.capacityMonthlyCost),
            totalMonthlyCostForCapacity: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyCostForCapacity
            ),
            totalMonthlyStorageCharge: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge
            ),
            minFileSystemsNumForStorage: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForStorage
            ),
            minFileSystemsNumForThroughputCapacity: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForThroughputCapacity
            ),
            minFileSystemsNumForSsdIops: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForSsdIops
            ),
            requiredNumOfFsxFractional: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsxFractional
            ),
            requiredNumOfFsx: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsx),
            minThroughputCapacityRequired:
                formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.minThroughputCapacityRequired) + ' MB/s',
            provisionedThroughputCapacity:
                formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.provisionedThroughputCapacity) + ' MB/s',
            totalMonthlyFsxnThroughputCapacityCost: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyFsxnThroughputCapacityCost
            ),
            includedSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.includedSsdIops),
            additionalSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.additionalSsdIops),
            billedAdditionalSsdIops: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.billedAdditionalSsdIops
            ),
            additionalBilledCostForSsdIops: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.additionalBilledCostForSsdIops
            ),
            totalThroughputAndIopsMonthly: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly
            ),
            ebsCapacity: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.ebsCapacity),
            fsxnStoragePrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnStoragePrice?.price),
            fsxnCapacityPrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnCapacityPrice?.price),
            fsxnIopsPrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnIopsPrice),
            maxSsdTierSize: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.maxSsdTierSize),
            suggestedFsxnThroughputCapacity: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.suggestedFsxnThroughputCapacity
            ),
            maxThroughput: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.maxThroughput),
            fsxnThroughputPrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnThroughputPrice),
            provisionedSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.provisionedSsdIops),
            includedIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.includedIops),
            maxSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.maxSsdIops)
        },
        fsxOntapSnapshotCalculation: {
            fsxnSsdPrice: formatNumbers(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.fsxnSsdPrice?.price),
            fsxnCapacityPrice: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.fsxnCapacityPrice?.price
            ),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatPercentage(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatPercentage(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.savingsFromCompressionAndDeduplication
            ),
            storageSavingsFromCompressionAndDeduplication: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.storageSavingsFromCompressionAndDeduplication
            ),
            effectiveFsxnStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.effectiveFsxnStorageCapacity
            ),
            ssdStoragePerMonth: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ssdStoragePerMonth
            ),
            ssdMonthlyCost: formatNumbers(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ssdMonthlyCost),
            totalSnapshotMonthlyCostForFsxSsd: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalSnapshotMonthlyCostForFsxSsd
            ),
            ratioAfterSavings: formatPercentage(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ratioAfterSavings
            ),
            dataOnCapacityPoolStorageFactor: formatPercentage(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.dataOnCapacityPoolStorageFactor
            ),
            capacityPoolStorage: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.capacityPoolStorage
            ),
            capacityMonthlyCost: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.capacityMonthlyCost
            ),
            totalMonthlyCostForCapacity: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForCapacity
            ),
            totalSnapshotMonthlyCost: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalSnapshotMonthlyCost
            )
        },
        fsxCloneCalculation: {
            clonedCopiesCount: formatNumbers(viewCalculationsResponse?.fsxCloneCalculation?.clonedCopiesCount),
            numberOfClonesInAMonth: formatNumbers(
                viewCalculationsResponse?.fsxCloneCalculation?.numberOfClonesInAMonth
            ),
            changeRateBetweenClones: formatNumbers(
                viewCalculationsResponse?.fsxCloneCalculation?.changeRateBetweenClones
            ),
            totalFsxnCapacity: formatCalcSize(viewCalculationsResponse?.fsxCloneCalculation?.totalFsxnCapacity),
            fsxnSsdPrice: formatNumbers(viewCalculationsResponse?.fsxCloneCalculation?.fsxnSsdPrice?.price),
            cloneRefreshFrequency: viewCalculationsResponse?.fsxCloneCalculation?.cloneRefreshFrequency,
            monthlyChangeRatePercentage: formatNumbers(
                viewCalculationsResponse?.fsxCloneCalculation?.monthlyChangeRatePercentage
            ),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatPercentage(
                viewCalculationsResponse?.fsxCloneCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatPercentage(
                viewCalculationsResponse?.fsxCloneCalculation?.savingsFromCompressionAndDeduplication
            ),
            storageSavingsFromCompressionAndDeduplication: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.storageSavingsFromCompressionAndDeduplication
            ),
            effectiveFsxnStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.effectiveFsxnStorageCapacity
            ),
            ssdStoragePerMonth: formatCalcSize(viewCalculationsResponse?.fsxCloneCalculation?.ssdStoragePerMonth),
            ssdMonthlyCost: formatNumbers(viewCalculationsResponse?.fsxCloneCalculation?.ssdMonthlyCost),
            totalCloneMonthlyCost: formatNumbers(viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost)
        },
        totalFsxEc2MachineCost: totalFsxEc2MachineCost,
        totalEBSEc2MachineCost: totalEbsEc2MachineCost,
        fsxTotalCost: totalFsxCost,
        ebsTotalCost: totalEbsCost(ebsViewCalculationData),
        ebsOnlyCost: onlyEbsCost(ebsViewCalculationData),
        fsxSnapshotTotalCost: totalFsxSnapshotCost,
        totalAzCost: totalAzCost,
        azType: azType,
        monthlyChangeRate: monthlyChangeRate
    };
    return result;
};

export const getEbsViewCalculationData = (viewCalculationsResponse: ViewCalculationsInterface) => {
    let ebsSnapshotCalculation = {
        amountChangedPerSnapshot: 0,
        storageAmount: 0,
        storageAmountPerMonth: 0,
        monthlyCostOfSnapshots: 0,
        ebsInstanceMonth: 0,
        totalSnapshots: 0,
        initialSnapshotCost: 0,
        monthlyCostPerSnapshot: 0,
        discountForPartialStorageMonth: 0,
        incrementalSnapshotCost: 0,
        totalSnapshotCost: 0,
        totalEbsSnapshotCost: 0,
        ebsSnapshotCost: 0,
        ebsSnapshotPrice: 0
    };
    let ebsCloneCalculation = {
        clonedCopiesCount: 0,
        capacity: 0,
        iops: 0,
        throughput: 0,
        totalCloneMonthlyCost: 0
    };
    Object.keys(viewCalculationsResponse?.ebsSnapshotCalculation || {}).map((key: string) => {
        ebsSnapshotCalculation = {
            amountChangedPerSnapshot:
                ebsSnapshotCalculation.amountChangedPerSnapshot +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.amountChangedPerSnapshot,
            storageAmountPerMonth:
                ebsSnapshotCalculation.storageAmountPerMonth +
                (viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.storageAmount || 0) /
                    (viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsInstanceMonth || 0),
            storageAmount:
                ebsSnapshotCalculation.storageAmount +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.storageAmount,
            monthlyCostOfSnapshots:
                ebsSnapshotCalculation.monthlyCostOfSnapshots +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.monthlyCostOfSnapshots,
            ebsInstanceMonth:
                ebsSnapshotCalculation.ebsInstanceMonth +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsInstanceMonth || 0,
            totalSnapshots:
                ebsSnapshotCalculation.totalSnapshots +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.totalSnapshots || 0,
            initialSnapshotCost:
                ebsSnapshotCalculation.initialSnapshotCost +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.initialSnapshotCost || 0,
            monthlyCostPerSnapshot:
                ebsSnapshotCalculation.monthlyCostPerSnapshot +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.monthlyCostPerSnapshot || 0,
            discountForPartialStorageMonth:
                ebsSnapshotCalculation.discountForPartialStorageMonth +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.discountForPartialStorageMonth || 0,
            incrementalSnapshotCost:
                ebsSnapshotCalculation.incrementalSnapshotCost +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.incrementalSnapshotCost || 0,
            totalSnapshotCost:
                ebsSnapshotCalculation.totalSnapshotCost +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.totalSnapshotCost || 0,
            totalEbsSnapshotCost:
                ebsSnapshotCalculation.totalEbsSnapshotCost +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.totalEbsSnapshotCost || 0,
            ebsSnapshotCost:
                ebsSnapshotCalculation.ebsSnapshotCost +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsSnapshotCost || 0,
            ebsSnapshotPrice:
                ebsSnapshotCalculation.ebsSnapshotPrice +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsSnapshotPrice?.price || 0
        };
    });

    Object.keys(viewCalculationsResponse?.ebsCloneCalculation || {}).map((key: string) => {
        ebsCloneCalculation = {
            clonedCopiesCount: viewCalculationsResponse?.ebsCloneCalculation?.[key]?.clonedCopiesCount,
            capacity: ebsCloneCalculation.capacity + viewCalculationsResponse?.ebsCloneCalculation?.[key]?.capacity,
            iops: ebsCloneCalculation.iops + viewCalculationsResponse?.ebsCloneCalculation?.[key]?.iops,
            throughput:
                ebsCloneCalculation.throughput + viewCalculationsResponse?.ebsCloneCalculation?.[key]?.throughput,
            totalCloneMonthlyCost:
                ebsCloneCalculation.totalCloneMonthlyCost +
                viewCalculationsResponse?.ebsCloneCalculation?.[key]?.totalCloneMonthlyCost
        };
    });

    return {
        ebsCalculation: EbsCalculationUpdates(viewCalculationsResponse?.ebsCalculation || {}),
        ebsSnapshotCalculation: {
            amountChangedPerSnapshot: formatCalcSize(ebsSnapshotCalculation?.amountChangedPerSnapshot),
            storageAmountPerMonth: formatCalcSize(ebsSnapshotCalculation?.storageAmountPerMonth),
            storageAmount: formatCalcSize(ebsSnapshotCalculation?.storageAmount),
            monthlyCostOfSnapshots: formatNumbers(ebsSnapshotCalculation?.monthlyCostOfSnapshots),
            ebsInstanceMonth: formatNumbers(ebsSnapshotCalculation?.ebsInstanceMonth),
            totalSnapshots: formatNumbers(ebsSnapshotCalculation?.totalSnapshots),
            initialSnapshotCost: formatNumbers(ebsSnapshotCalculation?.initialSnapshotCost),
            monthlyCostPerSnapshot: formatNumbers(ebsSnapshotCalculation?.monthlyCostPerSnapshot),
            discountForPartialStorageMonth: formatNumbers(ebsSnapshotCalculation?.discountForPartialStorageMonth),
            incrementalSnapshotCost: formatNumbers(ebsSnapshotCalculation?.incrementalSnapshotCost),
            totalSnapshotCost: formatNumbers(ebsSnapshotCalculation?.totalSnapshotCost),
            totalEbsSnapshotCost: formatNumbers(ebsSnapshotCalculation?.totalEbsSnapshotCost),
            ebsSnapshotCost: formatNumbers(ebsSnapshotCalculation?.ebsSnapshotCost),
            ebsSnapshotPrice: formatNumbers(ebsSnapshotCalculation?.ebsSnapshotPrice),
            totalEbsSnapshotCostValue: ebsSnapshotCalculation?.ebsSnapshotCost
        },
        ebsCloneCalculation: {
            clonedCopiesCount: formatNumbers(ebsCloneCalculation?.clonedCopiesCount),
            capacity: formatNumbers(ebsCloneCalculation?.capacity),
            iops: formatNumbers(ebsCloneCalculation?.iops),
            throughput: formatNumbers(ebsCloneCalculation?.throughput),
            totalCloneMonthlyCost: formatNumbers(ebsCloneCalculation?.totalCloneMonthlyCost),
            totalCloneMonthlyCostValue: ebsCloneCalculation?.totalCloneMonthlyCost
        }
    };
};

export const EbsCalculationUpdates = (data: { [key: string]: EBSCalculation }) => {
    let result: any = {};
    let totalEbsThroughputCost = 0;
    let totalEbsIopsCost = 0;
    let totalEbsStorageCost = 0;
    let throughPutTextList: any = [];
    let iopsTextList: any = [];
    let storageTextList: any = [];
    Object.keys(data).map((key: string) => {
        totalEbsThroughputCost += Number(data[key]?.ebsThroughputCost);
        totalEbsIopsCost += Number(data[key]?.ebsIopsCost);
        totalEbsStorageCost += Number(data[key]?.ebsStorageCost);
        throughPutTextList.push(key + ' throughput cost');
        iopsTextList.push(key + ' IOPS cost');
        storageTextList.push(key + ' storage cost');
        result[key] = {
            numberOfVolumes: formatNumbers(data[key]?.numberOfVolumes),
            storageAmountPerVol: formatCalcSize(data[key]?.storageAmountPerVol),
            totalInstanceHours: formatNumbers(data[key]?.totalInstanceHours),
            ebsInstanceMonth: formatNumbers(data[key]?.ebsInstanceMonth),
            ebsStorageCost: formatNumbers(data[key]?.ebsStorageCost),
            billableIops: formatNumbers(data[key]?.billableIops),
            totalBillableIops: formatNumbers(data[key]?.totalBillableIops),
            ebsIopsCost: formatNumbers(data[key]?.ebsIopsCost),
            billableMbps: formatNumbers(data[key]?.billableMbps),
            billableThroughputMbps: formatNumbers(data[key]?.billableThroughputMbps),
            billableThroughputGbps: formatNumbers(data[key]?.billableThroughputGbps),
            ebsThroughputCost: formatNumbers(data[key]?.ebsThroughputCost),
            ebsTotalCostMonthly: formatNumbers(data[key]?.ebsTotalCostMonthly),
            instanceAvgDuration: formatNumbers(data[key]?.instanceAvgDuration),
            ebsCapacityPrice: formatNumbers(data[key]?.ebsCapacityPrice?.price),
            hoursInAMonth: formatNumbers(data[key]?.hoursInAMonth)
        };
    });

    result['totalEbsThroughputCost'] = totalEbsThroughputCost;
    result['totalEbsIopsCost'] = totalEbsIopsCost;
    result['totalEbsStorageCost'] = totalEbsStorageCost;
    result['totalEbsThroughputCostText'] = throughPutTextList.join(' + ');
    result['totalEbsIopsCostText'] = iopsTextList.join(' + ');
    result['totalEbsStorageCostText'] = storageTextList.join(' + ');
    return result;
};

export const formatStorageSavingsRecommendedData = (data: StorageSavingsInterface) => {
    let result: StorageSavingsInterface = {};
    if (data) {
        const state = store.getState();
        const recommendedTargetInstance = state.exploreSavings.recommendedTargetInstance;
        let recommendeRow: any = null;
        if (recommendedTargetInstance) {
            recommendeRow = data?.compute?.recommended?.recommendationOptions?.filter(
                perRow => perRow?.instanceType === recommendedTargetInstance
            );
        }
        if (recommendeRow && recommendeRow?.length) {
            let recommendedTotal =
                Number(data?.totalSummary?.recommended || 0) -
                Number(data?.compute?.recommended?.machineDetails?.[0]?.computeMonthlyPrice || 0) -
                Number(data?.compute?.recommended?.machineDetails?.[0]?.licenseMonthlyPrice || 0) +
                Number(recommendeRow?.[0]?.computeMonthlyPrice || 0) +
                Number(recommendeRow?.[0]?.licenseMonthlyPrice || 0);
            result = {
                ...data,
                recommendedInstance: recommendeRow?.[0],
                totalSummary: {
                    ...data?.totalSummary,
                    recommendedTotal: recommendedTotal
                }
            };
        } else {
            result = {
                ...data,
                recommendedInstance: data?.compute?.recommended?.machineDetails?.[0],
                totalSummary: {
                    ...data?.totalSummary,
                    recommendedTotal: data?.totalSummary?.recommended
                }
            };
        }
    } else {
        result = data;
    }
    return result;
};

export const generateLabel2ForInstanceType = (options: any, option: any, existingTypeObj: any) => {
    if (option === existingTypeObj?.instanceType) {
        return 'Current instance type';
    } else {
        const selectedOption = options.find((item: any) => item.instanceType === option);
        if (selectedOption?.computeMonthlyPrice) {
            const existingComputePrice: number = existingTypeObj?.computeMonthlyPrice
                ? parseFloat(existingTypeObj?.computeMonthlyPrice?.toString())
                : 0;
            const computeCostSavingPercent =
                existingComputePrice && selectedOption?.computeMonthlyPrice
                    ? Math.round(
                          (100 * (existingComputePrice - selectedOption?.computeMonthlyPrice)) / existingComputePrice
                      )
                    : 0;
            const label2 = computeCostSavingPercent ? `Saves up to ${computeCostSavingPercent}% in compute costs` : '';
            return label2;
        }
        return '';
    }
};
