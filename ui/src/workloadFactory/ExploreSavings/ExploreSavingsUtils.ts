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
            numberOfVolumes: Number(viewCalculationsResponse?.fsxOntapCalculation?.numberOfVolumes).toLocaleString(),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.percentageOfDataOnSsdStorage
            ).toLocaleString(),
            savingsFromCompressionAndDeduplication: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.savingsFromCompressionAndDeduplication
            ).toLocaleString(),
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
            ssdMonthlyCost: Number(viewCalculationsResponse?.fsxOntapCalculation?.ssdMonthlyCost).toLocaleString(),
            totalMonthlyCostForFSxSsd: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyCostForFSxSsd
            ).toLocaleString(),
            ratioAfterSavings: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.ratioAfterSavings
            ).toLocaleString(),
            dataOnCapacityPoolStorageFactor: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.dataOnCapacityPoolStorageFactor
            ).toLocaleString(),
            capacityPoolStorage: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.capacityPoolStorage),
            capacityMonthlyCost: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.capacityMonthlyCost
            ).toLocaleString(),
            totalMonthlyCostForCapacity: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyCostForCapacity
            ).toLocaleString(),
            totalMonthlyStorageCharge: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge
            ).toLocaleString(),
            minFileSystemsNumForStorage: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForStorage
            ).toLocaleString(),
            minFileSystemsNumForThroughputCapacity: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForThroughputCapacity
            ).toLocaleString(),
            minFileSystemsNumForSsdIops: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.minFileSystemsNumForThroughputCapacity
            ).toLocaleString(),
            requiredNumOfFsxFractional: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsxFractional
            ).toLocaleString(),
            requiredNumOfFsx: Number(viewCalculationsResponse?.fsxOntapCalculation?.requiredNumOfFsx).toLocaleString(),
            minThroughputCapacityRequired: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.minThroughputCapacityRequired
            ),
            provisionedThroughputCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.provisionedThroughputCapacity
            ),
            totalMonthlyFsxnThroughputCapacityCost: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyFsxnThroughputCapacityCost
            ).toLocaleString(),
            includedSsdIops: Number(viewCalculationsResponse?.fsxOntapCalculation?.includedSsdIops).toLocaleString(),
            additionalSsdIops: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.additionalSsdIops
            ).toLocaleString(),
            billedAdditionalSsdIops: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.billedAdditionalSsdIops
            ).toLocaleString(),
            additionalBilledCostForSsdIops: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.additionalBilledCostForSsdIops
            ).toLocaleString(),
            totalThroughputAndIopsMonthly: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly
            ).toLocaleString(),
            EBSCapacity: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.EBSCapacity),
            fsxnStoragePrice: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.fsxnStoragePrice?.price
            ).toLocaleString(),
            fsxnCapacityPrice: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.fsxnCapacityPrice?.price
            ).toLocaleString(),
            maxSSDTierSize: formatCalcSize(viewCalculationsResponse?.fsxOntapCalculation?.maxSSDTierSize),
            suggestedFsxnThroughputCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapCalculation?.suggestedFsxnThroughputCapacity
            ),
            maxThroughput: Number(viewCalculationsResponse?.fsxOntapCalculation?.maxThroughput).toLocaleString(),
            fsxnThroughputPrice: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.fsxnThroughputPrice
            ).toLocaleString(),
            provisionedSsdIops: Number(
                viewCalculationsResponse?.fsxOntapCalculation?.provisionedSsdIops
            ).toLocaleString(),
            includedIops: Number(viewCalculationsResponse?.fsxOntapCalculation?.includedIops).toLocaleString(),
            maxSsdIops: Number(viewCalculationsResponse?.fsxOntapCalculation?.maxSsdIops).toLocaleString()
        },
        fsxOntapSnapshotCalculation: {
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.percentageOfDataOnSsdStorage
            ).toLocaleString(),
            savingsFromCompressionAndDeduplication: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.savingsFromCompressionAndDeduplication
            ).toLocaleString(),
            storageSavingsFromCompressionAndDeduplication: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.storageSavingsFromCompressionAndDeduplication
            ),
            effectiveFsxnStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.effectiveFsxnStorageCapacity
            ),
            ssdStoragePerMonth: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ssdStoragePerMonth
            ),
            ssdMonthlyCost: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ssdMonthlyCost
            ).toLocaleString(),
            totalMonthlyCostForFsxSsd: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForFsxSsd
            ).toLocaleString(),
            ratioAfterSavings: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.ratioAfterSavings
            ).toLocaleString(),
            dataOnCapacityPoolStorageFactor: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.dataOnCapacityPoolStorageFactor
            ).toLocaleString(),
            capacityPoolStorage: formatCalcSize(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.capacityPoolStorage
            ),
            capacityMonthlyCost: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.capacityMonthlyCost
            ).toLocaleString(),
            totalMonthlyCostForCapacity: Number(
                viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForCapacity
            ).toLocaleString()
        },
        ebsCalculation: {
            storageAmountPerVol: formatCalcSize(viewCalculationsResponse?.ebsCalculation?.storageAmountPerVol),
            totalInstanceHours: Number(viewCalculationsResponse?.ebsCalculation?.totalInstanceHours).toLocaleString(),
            ebsInstanceMonth: Number(viewCalculationsResponse?.ebsCalculation?.ebsInstanceMonth).toLocaleString(),
            ebsStorageCost: Number(viewCalculationsResponse?.ebsCalculation?.ebsStorageCost).toLocaleString(),
            billableIops: Number(viewCalculationsResponse?.ebsCalculation?.billableIops).toLocaleString(),
            totalBillableIops: Number(viewCalculationsResponse?.ebsCalculation?.totalBillableIops).toLocaleString(),
            ebsIopsCost: Number(viewCalculationsResponse?.ebsCalculation?.ebsIopsCost).toLocaleString(),
            billableMbps: Number(viewCalculationsResponse?.ebsCalculation?.billableMbps).toLocaleString(),
            billableThroughputMbps: Number(
                viewCalculationsResponse?.ebsCalculation?.billableThroughputMbps
            ).toLocaleString(),
            billableThroughputGbps: Number(
                viewCalculationsResponse?.ebsCalculation?.billableThroughputGbps
            ).toLocaleString(),
            ebsThroughputCost: Number(viewCalculationsResponse?.ebsCalculation?.ebsThroughputCost).toLocaleString(),
            totalSnapshots: Number(viewCalculationsResponse?.ebsCalculation?.totalSnapshots).toLocaleString(),
            initialSnapshotCost: Number(viewCalculationsResponse?.ebsCalculation?.initialSnapshotCost).toLocaleString(),
            monthlyCostPerSnapshot: Number(
                viewCalculationsResponse?.ebsCalculation?.monthlyCostPerSnapshot
            ).toLocaleString(),
            discountForPartialStorageMonth: Number(
                viewCalculationsResponse?.ebsCalculation?.discountForPartialStorageMonth
            ).toLocaleString(),
            incrementalSnapshotCost: Number(
                viewCalculationsResponse?.ebsCalculation?.incrementalSnapshotCost
            ).toLocaleString(),
            totalSnapshotCost: Number(viewCalculationsResponse?.ebsCalculation?.totalSnapshotCost).toLocaleString(),
            totalEbsSnapshotCost: Number(
                viewCalculationsResponse?.ebsCalculation?.totalEbsSnapshotCost
            ).toLocaleString(),
            ebsSnapshotCost: Number(viewCalculationsResponse?.ebsCalculation?.ebsSnapshotCost).toLocaleString(),
            instanceAvgDuration: Number(viewCalculationsResponse?.ebsCalculation?.instanceAvgDuration).toLocaleString(),
            ebsCapacityPrice: Number(
                viewCalculationsResponse?.ebsCalculation?.ebsCapacityPrice?.price
            ).toLocaleString(),
            hoursInAMonth: Number(viewCalculationsResponse?.ebsCalculation?.hoursInAMonth).toLocaleString()
        },
        fsxCloneCalculation: {
            cloneRefreshFrequency: viewCalculationsResponse?.fsxCloneCalculation?.cloneRefreshFrequency,
            monthlyChangeRatePercentage: Number(
                viewCalculationsResponse?.fsxCloneCalculation?.monthlyChangeRatePercentage
            ).toLocaleString(),
            desiredStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.desiredStorageCapacity
            ),
            percentageOfDataOnSsdStorage: Number(
                viewCalculationsResponse?.fsxCloneCalculation?.percentageOfDataOnSsdStorage
            ).toLocaleString(),
            savingsFromCompressionAndDeduplication: Number(
                viewCalculationsResponse?.fsxCloneCalculation?.savingsFromCompressionAndDeduplication
            ).toLocaleString(),
            storageSavingsFromCompressionAndDeduplication: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.storageSavingsFromCompressionAndDeduplication
            ),
            effectiveFsxnStorageCapacity: formatCalcSize(
                viewCalculationsResponse?.fsxCloneCalculation?.effectiveFsxnStorageCapacity
            ),
            ssdStoragePerMonth: formatCalcSize(viewCalculationsResponse?.fsxCloneCalculation?.ssdStoragePerMonth),
            ssdMonthlyCost: Number(viewCalculationsResponse?.fsxCloneCalculation?.ssdMonthlyCost).toLocaleString(),
            totalCloneMonthlyCost: Number(
                viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost
            ).toLocaleString()
        },
        ebsCloneCalculation: {
            numberOfClonedCopies: Number(
                viewCalculationsResponse?.ebsCloneCalculation?.numberOfClonedCopies
            ).toLocaleString(),
            cloneCost: Number(viewCalculationsResponse?.ebsCloneCalculation?.cloneCost).toLocaleString()
        },
        fsxTotalCost: totalFsxCost,
        ebsTotalCost: totalEbsCost,
        fsxSnapshotTotalCost: totalFsxSnapshotCost
    };
    return result;
};
