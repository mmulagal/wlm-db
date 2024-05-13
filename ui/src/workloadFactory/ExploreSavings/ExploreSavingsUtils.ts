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
        const nodes = rowData?.sqlServerInstances?.[0]?.sqlServerNodes;
        if (nodes && nodes.length > 1) {
            return SQL_DEPLOYMENT_MODE.AOAG;
        } else {
            return SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
        }
    })();
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(setSelectedInstanceId(rowData?.id));
    dispatch(setSelectedDeploymentModel(deploymentModel));
    dispatch(setSelectedServerName(rowData.sqlServerInstances?.[0].sqlServerName || 'Server name'));
    setESInstanceData(rowData, isDemoMode, deploymentModel, dispatch);
};

export const setESInstanceData = (data: any, isDemoMode: any, type: string, dispatch: any) => {
    if (isDemoMode) {
        let demoData = {};
        if (type === 'standalone') {
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
                serverInstallationMode: 'Standalone',
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
                        throughput: 64
                    },
                    {
                        id: 'vol2',
                        size: 2 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: 'Standalone',
                    serverEdition: 'SQL Server Standard Edition',
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: 'm5.2xlarge'
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
                serverInstallationMode: 'Always on availability group',
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
                        throughput: 64
                    },
                    {
                        id: 'vol2',
                        size: 5 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: 'Failover Cluster Instances',
                    serverEdition: 'SQL Server Standard Edition',
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: 'm5.2xlarge'
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

export const formatNumbers = (val: any) => {
    if (val || val === 0) {
        return Number(val).toLocaleString();
    } else {
        return GENERAL.NOT_AVAILABLE;
    }
};

export const formatViewCalcData = (
    viewCalculationsResponse: any,
    selectedDeploymentModel: string,
    selectedHostDetails: any
) => {
    const totalEbsCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.ebsInstanceCalculation?.[0]?.ec2MachineCost || 0;
        } else {
            cost += 2 * (viewCalculationsResponse?.ebsInstanceCalculation?.[0]?.ec2MachineCost || 0);
        }
        cost += viewCalculationsResponse?.ebsCalculation?.ebsSnapshotCost || 0;
        cost += viewCalculationsResponse?.ebsCloneCalculation?.cloneCost || 0;
        cost += viewCalculationsResponse?.ebsCalculation?.ebsIopsCost || 0;
        cost += viewCalculationsResponse?.ebsCalculation?.ebsStorageCost || 0;
        cost += viewCalculationsResponse?.ebsCloneCalculation?.cloneCost || 0;
        return formatFractionalNumber(cost, 2);
    })();

    const totalFsxCost = (() => {
        let cost = 0;
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += viewCalculationsResponse?.fsxInstanceCalculation?.[0]?.ec2MachineCost || 0;
        } else {
            cost += 2 * (viewCalculationsResponse?.fsxInstanceCalculation?.[0]?.ec2MachineCost || 0);
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
        // Not available values are still not available
        ebsInstanceCalculation: [
            {
                instanceType: selectedHostDetails?.recommendedInstance?.instanceType,
                instanceHourlyPrice: GENERAL.NOT_AVAILABLE,
                ec2MachineCost: GENERAL.NOT_AVAILABLE,
                sqlEdition: selectedHostDetails?.recommendedInstance?.serverEdition,
                sqlLicense: GENERAL.NOT_AVAILABLE
            }
        ],
        fsxInstanceCalculation: [
            {
                instanceType: selectedHostDetails?.recommendedInstance?.instanceType,
                instanceHourlyPrice: GENERAL.NOT_AVAILABLE,
                ec2MachineCost: GENERAL.NOT_AVAILABLE,
                sqlEdition: selectedHostDetails?.recommendedInstance?.serverEdition,
                sqlLicense: GENERAL.NOT_AVAILABLE
            }
        ],
        fsxOntapCalculation: {
            numberOfVolumes: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.numberOfVolumes),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatNumbers(
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
            ratioAfterSavings: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.ratioAfterSavings),
            dataOnCapacityPoolStorageFactor: formatNumbers(
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
            minThroughputCapacityRequired: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.minThroughputCapacityRequired
            ),
            provisionedThroughputCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.provisionedThroughputCapacity
            ),
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
            EBSCapacity: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.EBSCapacity),
            fsxnStoragePrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnStoragePrice?.price),
            fsxnCapacityPrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnCapacityPrice?.price),
            maxSsdTierSize: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.maxSsdTierSize),
            suggestedFsxnThroughputCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.suggestedFsxnThroughputCapacity
            ),
            maxThroughput: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.maxThroughput),
            fsxnThroughputPrice: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.fsxnThroughputPrice),
            provisionedSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.provisionedSsdIops),
            includedIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.includedIops),
            maxSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.maxSsdIops)
        },
        fsxOntapSnapshotCalculation: {
            fsxnSsdPrice: formatCalcSize(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.fsxnSsdPrice?.price),
            fsxnCapacityPrice: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.fsxnCapacityPrice?.price
            ),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatNumbers(
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
            totalMonthlyCostForFsxSsd: formatNumbers(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForFsxSsd
            ),
            ratioAfterSavings: formatNumbers(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ratioAfterSavings),
            dataOnCapacityPoolStorageFactor: formatNumbers(
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
            )
        },
        ebsCalculation: {
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
            totalSnapshots: formatNumbers(viewCalculationsResponse?.ebsCalculation?.totalSnapshots),
            initialSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.initialSnapshotCost),
            monthlyCostPerSnapshot: formatNumbers(viewCalculationsResponse?.ebsCalculation?.monthlyCostPerSnapshot),
            discountForPartialStorageMonth: formatNumbers(
                viewCalculationsResponse?.ebsCalculation?.discountForPartialStorageMonth
            ),
            incrementalSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.incrementalSnapshotCost),
            totalSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.totalSnapshotCost),
            totalEbsSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.totalEbsSnapshotCost),
            ebsSnapshotCost: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsSnapshotCost),
            instanceAvgDuration: formatNumbers(viewCalculationsResponse?.ebsCalculation?.instanceAvgDuration),
            ebsCapacityPrice: formatNumbers(viewCalculationsResponse?.ebsCalculation?.ebsCapacityPrice?.price),
            hoursInAMonth: formatNumbers(viewCalculationsResponse?.ebsCalculation?.hoursInAMonth)
        },
        fsxCloneCalculation: {
            cloneRefreshFrequency: viewCalculationsResponse?.fsxCloneCalculation?.cloneRefreshFrequency,
            monthlyChangeRatePercentage: formatNumbers(
                viewCalculationsResponse?.fsxCloneCalculation?.monthlyChangeRatePercentage
            ),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: formatNumbers(
                viewCalculationsResponse?.fsxCloneCalculation?.percentageOfDataOnSsdStorage
            ),
            savingsFromCompressionAndDeduplication: formatNumbers(
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
            numberOfClonedCopies: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.numberOfClonedCopies),
            cloneCost: formatNumbers(viewCalculationsResponse?.ebsCloneCalculation?.cloneCost)
        },
        fsxTotalCost: totalFsxCost,
        ebsTotalCost: totalEbsCost,
        fsxSnapshotTotalCost: totalFsxSnapshotCost
    };
    return result;
};
