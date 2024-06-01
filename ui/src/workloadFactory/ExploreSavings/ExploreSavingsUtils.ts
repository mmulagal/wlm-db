import {
    setSelectedDeploymentModel,
    setSelectedHostDetails,
    setSelectedInstanceId,
    setSelectedServerName
} from '../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventorySlice';
import { GENERAL } from '../../utils/appConstants';
import { GIB_IN_BYTE, SQL_DEPLOYMENT_MODE, TIB_IN_BYTE, WLF_TABS } from '../../utils/consts';
import { formatFractionalNumber } from '../../utils/utilityFunctions';

export const onClickESHost = (dispatch: any, rowData: any, isDemoMode: any) => {
    const deploymentModel = (() => {
        return rowData?.sqlServerInstances?.[0]?.sqlServerDeploymentType?.toLowerCase();
    })();
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(setSelectedInstanceId(rowData?.id));
    dispatch(setSelectedDeploymentModel(deploymentModel));
    dispatch(setSelectedServerName(rowData.sqlServerInstances?.[0].sqlServerName || GENERAL.ES_SERVER_NAME));
    setESInstanceData(rowData, isDemoMode, deploymentModel, dispatch);
};

export const setESInstanceData = (data: any, isDemoMode: any, type: string, dispatch: any) => {
    if (isDemoMode) {
        let demoData = {};
        if (type === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            demoData = {
                ...data,
                topology: {
                    ...data?.topology,
                    ec2Details: [
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        }
                    ]
                },
                serverInstallationMode: GENERAL.STANDALONE,
                databaseServer: {
                    ...data?.databaseServer,
                    activeNode: 'SQLserver-Finance-01',
                    serverEdition: 'SQL Server Standard Edition'
                },
                databaseCount: 2,
                ebsResourceInfo: [
                    {
                        id: 'vol1',
                        size: 2 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 128
                    },
                    {
                        id: 'vol2',
                        size: 2 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 128
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: GENERAL.STANDALONE,
                    serverEdition: GENERAL.SQL_SERVER_STANDARD_EDITION,
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: ['m5.2xlarge']
                },
                storage: {
                    ebs: {
                        size: 4 * TIB_IN_BYTE
                    }
                }
            };
        } else {
            demoData = {
                ...data,
                topology: {
                    ...data?.topology,
                    ec2Details: [
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        },
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        }
                    ]
                },
                serverInstallationMode: GENERAL.AOAG,
                databaseServer: {
                    ...data?.databaseServer,
                    activeNode: 'SQLserver-PLM',
                    serverEdition: 'SQL Server Enterprise Edition'
                },
                databaseCount: 2,
                ebsResourceInfo: [
                    {
                        id: 'vol1',
                        size: 5 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 128
                    },
                    {
                        id: 'vol2',
                        size: 5 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 128
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: GENERAL.FAILOVER_CLUSTER_INSTANCES,
                    serverEdition: GENERAL.SQL_SERVER_STANDARD_EDITION,
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: ['m5.2xlarge']
                },
                storage: {
                    ebs: {
                        size: 10 * TIB_IN_BYTE
                    }
                }
            };
        }
        dispatch(setSelectedHostDetails(demoData));
    } else {
        dispatch(
            setSelectedHostDetails({
                ...data,
                recommendedInstance: {
                    serverInstallationMode: data?.serverInstallationMode,
                    serverEdition: data?.databaseServer?.serverEdition,
                    serverVersion: data?.databaseServer?.serverVersion,
                    instanceType: data?.topology?.ec2Details?.map((inst: any) => inst?.instanceType)
                }
            })
        );
    }
};

export const updateDemoEbsRows = (data: any) => {
    const updatedNonFsxnStorageList = data?.map((perRow: any) => {
        if (perRow?.sqlServerInstances?.[0]?.sqlServerNodes?.length <= 1) {
            return {
                ...perRow,
                sizeformat: '4 TiB',
                azType: 'Single AZ',
                sqlServerInstances: perRow?.sqlServerInstances?.map((perInst: any) => {
                    return {
                        ...perInst,
                        deploymentTypes: [
                            {
                                type: 'SINGLE_AZ_1',
                                zones: ['availability-zone-3']
                            }
                        ]
                    };
                })
            };
        } else if (perRow?.sqlServerInstances?.[0]?.sqlServerNodes) {
            return {
                ...perRow,
                sizeformat: '10 TiB',
                azType: 'Multi AZ',
                sqlServerInstances: perRow?.sqlServerInstances?.map((perInst: any) => {
                    return {
                        ...perInst,
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['availability-zone-3', 'availability-zone-2']
                            }
                        ]
                    };
                })
            };
        } else {
            return { ...perRow };
        }
    });
    return updatedNonFsxnStorageList;
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
                    computeHourlyPrice: formatPrice(computeDetails?.[0]?.computeHourlyPrice),
                    computeMonthlyPrice: formatPrice(computeDetails?.[0]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.[0]?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.[0]?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[0]?.hoursInAMonth)
                }
            ];
        } else {
            return [
                {
                    instanceType: computeDetails?.[0]?.instanceType || instanceTypelist?.[0] || GENERAL.NOT_AVAILABLE,
                    computeHourlyPrice: formatPrice(computeDetails?.[0]?.computeHourlyPrice),
                    computeMonthlyPrice: formatPrice(computeDetails?.[0]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.[0]?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.[0]?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[0]?.hoursInAMonth)
                },
                {
                    instanceType: computeDetails?.[1]?.instanceType || instanceTypelist?.[1] || GENERAL.NOT_AVAILABLE,
                    computeHourlyPrice: formatPrice(computeDetails?.[1]?.computeHourlyPrice),
                    computeMonthlyPrice: formatPrice(computeDetails?.[1]?.computeMonthlyPrice),
                    sqlEdition:
                        licenseDetails?.[1]?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.[1]?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[1]?.hoursInAMonth)
                }
            ];
        }
    })();
    return instanceCalculationData;
};

export const formatViewCalcData = (viewCalculationsResponse: any, selectedDeploymentModel: string) => {
    const totalEbsCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.existingComputeCalculation?.[0]?.computeMonthlyPrice || 0;
        } else {
            cost += viewCalculationsResponse?.existingComputeCalculation?.[0]?.computeMonthlyPrice || 0;
            cost += viewCalculationsResponse?.existingComputeCalculation?.[1]?.computeMonthlyPrice || 0;
        }
        cost += viewCalculationsResponse?.ebsCalculation?.ebsSnapshotCost || 0;
        cost += viewCalculationsResponse.ebsCalculation.ebsThroughputCost || 0;
        cost += viewCalculationsResponse?.ebsCalculation?.ebsIopsCost || 0;
        cost += viewCalculationsResponse?.ebsCalculation?.ebsStorageCost || 0;
        cost += viewCalculationsResponse?.ebsCloneCalculation?.totalCloneMonthlyCost || 0;
        return formatFractionalNumber(cost, 2);
    })();

    const totalEbsEc2MachineCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.existingComputeCalculation?.[0]?.computeMonthlyPrice || 0;
        } else {
            cost += viewCalculationsResponse?.existingComputeCalculation?.[0]?.computeMonthlyPrice || 0;
            cost += viewCalculationsResponse?.existingComputeCalculation?.[1]?.computeMonthlyPrice || 0;
        }
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxEc2MachineCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[0]?.computeMonthlyPrice || 0;
        } else {
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[0]?.computeMonthlyPrice || 0;
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[1]?.computeMonthlyPrice || 0;
        }
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[0]?.computeMonthlyPrice || 0;
        } else {
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[0]?.computeMonthlyPrice || 0;
            cost += viewCalculationsResponse?.recommendedComputeCalculation?.[1]?.computeMonthlyPrice || 0;
        }
        cost += viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly || 0;
        cost += viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge || 0;
        cost += viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost || 0;
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxSnapshotCost = (() => {
        let cost = 0;
        cost += viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForCapacity || 0;
        cost += viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForFsxSsd || 0;
        return formatFractionalNumber(cost, 2);
    })();

    const result = {
        fsxInstanceCalculation: formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            viewCalculationsResponse?.recommendedComputeCalculation,
            viewCalculationsResponse?.recommendedLicenseCalculation
        ),
        ebsInstanceCalculation: formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            viewCalculationsResponse?.existingComputeCalculation,
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
        ebsCalculation: {
            numberOfVolumes: formatNumbers(viewCalculationsResponse?.ebsCalculation?.numberOfVolumes),
            storageAmountPerVol: formatCalcSize(viewCalculationsResponse?.ebsCalculation?.storageAmountPerVol),
            totalInstanceHours: formatNumbers(viewCalculationsResponse?.ebsCalculation?.totalInstanceHours),
            ebsInstanceMonth: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsInstanceMonth),
            ebsStorageCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsStorageCost),
            billableIops: formatNumbers(viewCalculationsResponse?.ebsCalculation?.billableIops),
            totalBillableIops: formatNumbers(viewCalculationsResponse?.ebsCalculation?.totalBillableIops),
            ebsIopsCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsIopsCost),
            billableMbps: formatNumbers(viewCalculationsResponse?.ebsCalculation?.billableMbps),
            billableThroughputMbps: formatNumbers(viewCalculationsResponse?.ebsCalculation?.billableThroughputMbps),
            billableThroughputGbps: formatNumbers(viewCalculationsResponse?.ebsCalculation?.billableThroughputGbps),
            ebsThroughputCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsThroughputCost),
            ebsTotalCostMonthly: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsTotalCostMonthly),
            instanceAvgDuration: formatNumbers(viewCalculationsResponse?.ebsCalculation?.instanceAvgDuration),
            ebsCapacityPrice: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsCapacityPrice?.price),
            hoursInAMonth: formatNumbers(viewCalculationsResponse?.ebsCalculation?.hoursInAMonth)
        },
        ebsSnapshotCalculation: {
            ebsInstanceMonth: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.ebsInstanceMonth),
            totalSnapshots: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.totalSnapshots),
            initialSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.initialSnapshotCost),
            monthlyCostPerSnapshot: formatNumbers(
                viewCalculationsResponse?.ebsSnapshotCalculation?.monthlyCostPerSnapshot
            ),
            discountForPartialStorageMonth: formatNumbers(
                viewCalculationsResponse?.ebsSnapshotCalculation?.discountForPartialStorageMonth
            ),
            incrementalSnapshotCost: formatNumbers(
                viewCalculationsResponse?.ebsSnapshotCalculation?.incrementalSnapshotCost
            ),
            totalSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.totalSnapshotCost),
            totalEbsSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.totalEbsSnapshotCost),
            ebsSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsSnapshotCalculation?.ebsSnapshotCost)
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
        ebsCloneCalculation: {
            clonedCopiesCount: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.clonedCopiesCount),
            capacity: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.capacity),
            iops: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.iops),
            throughput: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.throughput),
            totalCloneMonthlyCost: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.totalCloneMonthlyCost)
        },
        totalFsxEc2MachineCost: totalFsxEc2MachineCost,
        totalEBSEc2MachineCost: totalEbsEc2MachineCost,
        fsxTotalCost: totalFsxCost,
        ebsTotalCost: totalEbsCost,
        fsxSnapshotTotalCost: totalFsxSnapshotCost
    };
    return result;
};
