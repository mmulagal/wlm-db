import { BlueXPListeners, postBlueXPMessage } from '@netapp/design-system';
import { NavigateFunction } from 'react-router-dom';
import { Dispatch } from '@reduxjs/toolkit';
import { TFunction } from 'i18next';
import store from '../../store/store';
import {
    resetServerDetailsCredentials,
    setDisableState,
    setMonthlyChangeRate,
    setOnPremStorageAndComputeInfoFull,
    setSavingsCalculatorFrom,
    setSelectedEsPageInstance,
    setSelectedHostDetails,
    setSelectedOnPremHostDetails,
    setSelectedOnPremHostId,
    setSelectedServerName
} from '../../store/workloadFactory/exploreSavingsSlice';
import { setInventoryTableData, setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    AUTHENTICATION_TYPE,
    DETECT_HOST_VAR,
    FSX_AZ_TYPE,
    GIB_IN_BYTE,
    READINESS_TYPES,
    REQUIRED_SQL_PERMISSIONS,
    SAVINGS_CALC_MODE,
    SQL_DEPLOYMENT_MODE,
    WLF_TABS
} from '../../utils/consts';
import {
    EBSCalculation,
    StorageSavingsInterface,
    ViewCalculationsInterface
} from '../../utils/types/exploreSavingsType';
import {
    formatFractionalNumber,
    formatFractionalNumberForCost,
    formatNumberWithCustomComma
} from '../../utils/utilityFunctions';
import {
    resetDialogComponent,
    setActionsDisabled,
    setDialogErrorWithTooltip
} from '../../store/workloadFactory/dialogComponentSlice';
import { DiscoverHostInterface } from '../../utils/types/inventoryV2Types';
import { addNotification, NOTIFICATION_TYPES } from '../../store/notificationSlice';
import {
    resetBulkAuthCredentialsAndStatus,
    resetRowsRequiringAuthBulk,
    setBulkAuthStatus,
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOnPremBulk,
    setOnPremTCOAction,
    setTriggerBulkDataFetch
} from '../../store/workloadFactory/exploreSavingsBulkSlice';

export const onClickESHostOnPrem = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction
) => {
    if (navigate && isWorkloadFactory) {
        navigate('../databases/saving-calculator');
    }
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${
                isWorkloadFactory
                    ? './storage-saving-calculator?type=onprem&mode=auto'
                    : '../fsxdb/storage-saving-calculator?type=onprem&mode=auto'
            }`,
            replace: true
        }
    });
    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.ONPREM));

    // Set single host in bulk selection array to use accordion UI
    dispatch(setSelectedRowsForExploreSavingsOnPremBulk([rowData]));
    dispatch(setOnPremTCOAction(''));

    dispatch(setDisableState(true));
    dispatch(setMonthlyChangeRate(3));

    if (rowData?.sqlServerInstances?.length) {
        const storagePerfAndCompute: any = {};
        rowData?.sqlServerInstances?.map((instance: any) => {
            // Use same key format as bulk mode: resourceId_instanceName
            const uniqueKey = `${rowData.resourceId}_${instance?.sqlInstanceName}`;
            if (!storagePerfAndCompute?.[uniqueKey]) {
                storagePerfAndCompute[uniqueKey] = {};
            }
            storagePerfAndCompute[uniqueKey].totalStorage = formatFractionalNumber(
                Number(instance?.totalStorage || 0) / GIB_IN_BYTE,
                3
            );
            storagePerfAndCompute[uniqueKey].totalIops = formatFractionalNumber(instance?.totalIops, 3);
            storagePerfAndCompute[uniqueKey].totalThroughput = formatFractionalNumber(instance?.totalThroughput, 3);
            storagePerfAndCompute[uniqueKey].noOfVcpusInUse = instance?.noOfVcpusInUse;
            storagePerfAndCompute[uniqueKey].memory = formatFractionalNumber(
                Number(instance?.memory || 0) / GIB_IN_BYTE,
                3
            );
            storagePerfAndCompute[uniqueKey].sqlInstanceName = instance?.sqlInstanceName;
            storagePerfAndCompute[uniqueKey].sqlInstanceId = instance?.sqlInstanceId;
            storagePerfAndCompute[uniqueKey].networkPerformance = rowData?.sqlServerInstances?.[0]?.networkPerformance;
            storagePerfAndCompute[uniqueKey].hostResourceName = rowData?.resourceName; // Add host name for reference
        });
        dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));
    }

    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(
        setSelectedEsPageInstance({
            instanceId: '',
            credentialId: '',
            regionId: '',
            deploymentModel: rowData?.deploymentModel,
            serverName: rowData?.resourceName || GENERAL.ES_SERVER_NAME
        })
    );
    dispatch(setSelectedOnPremHostId(rowData?.resourceId));
    dispatch(setSelectedServerName(rowData?.resourceName || GENERAL.ES_SERVER_NAME));
    setESInstanceOnPremData(rowData, dispatch);
};

export const onClickESHost = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction,
    isBulk?: boolean,
    bulkServerName?: string
) => {
    const deploymentModel = (() => rowData?.sqlServerInstances?.[0]?.sqlServerDeploymentType?.toLowerCase())();

    if (rowData?.storageType === GENERAL.EBS) {
        if (navigate && isWorkloadFactory) {
            navigate('../databases/saving-calculator');
        }
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `${
                    isWorkloadFactory
                        ? './storage-saving-calculator?type=ebs&mode=auto'
                        : '../fsxdb/storage-saving-calculator?type=ebs&mode=auto'
                }`,
                replace: true
            }
        });
        // Only set bulk selection if this is NOT a bulk operation (to avoid overriding existing selection)
        if (!isBulk) {
            dispatch(setSelectedRowsForExploreSavingsEBSBulk([rowData]));
        }
        dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.AUTO_EBS));
    } else {
        if (navigate && isWorkloadFactory) {
            navigate('../databases/saving-calculator');
        }
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `${
                    isWorkloadFactory
                        ? './storage-saving-calculator?type=fsxw&mode=auto'
                        : '../fsxdb/storage-saving-calculator?type=fsxw&mode=auto'
                }`,
                replace: true
            }
        });
        dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.AUTO_FSXW));
    }

    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(
        setSelectedEsPageInstance({
            instanceId: rowData?.ec2InstanceId,
            credentialId: rowData?.credentialId,
            regionId: rowData?.regionId,
            deploymentModel,
            serverName: isBulk && bulkServerName ? bulkServerName : rowData?.name || GENERAL.ES_SERVER_NAME
        })
    );
    setESInstanceData(rowData, dispatch);
    // Trigger the data fetch after setting up the instance data
    dispatch(setTriggerBulkDataFetch(true));
};

export const handleManualTCOEBS = (dispatch: any, navigate: any, isWorkloadFactory: boolean) => {
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: `${
                    isWorkloadFactory
                        ? './storage-saving-calculator?type=ebs&mode=manual'
                        : '../fsxdb/storage-saving-calculator?type=ebs&mode=manual'
                }`,
                replace: true
            }
        });
    }

    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_EBS));
    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
};

export const handleManualTCOFSXW = (dispatch: any, navigate: any, isWorkloadFactory: boolean) => {
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${
                isWorkloadFactory
                    ? './storage-saving-calculator?type=fsxw&mode=manual'
                    : '../fsxdb/storage-saving-calculator?type=fsxw&mode=manual'
            }`,
            replace: true
        }
    });
    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_FSXW));
    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
};

export const setESInstanceOnPremData = (data: any, dispatch: any) => {
    let serverInstallationMode = data?.deploymentModel;
    if (data?.deploymentModel === GENERAL.AOAG) {
        serverInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    }

    dispatch(
        setSelectedOnPremHostDetails({
            ...data,
            totalInstance: data?.sqlServerInstances?.length || 0,
            recommendedInstance: {
                serverInstallationMode,
                serverVersion: data?.sqlServerInstances?.[0]?.sqlVersion
            }
        })
    );
};

export const onClickESHostOnPremBulk = (dispatch: any, selectedHosts: any[], isWorkloadFactory: boolean) => {
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${
                isWorkloadFactory
                    ? './storage-saving-calculator?type=onprem&mode=auto'
                    : '../fsxdb/storage-saving-calculator?type=onprem&mode=auto'
            }`,
            replace: true
        }
    });
    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.ONPREM));

    dispatch(setDisableState(true));
    dispatch(setMonthlyChangeRate(3));

    // Combine storage and compute info from ALL selected hosts
    const storagePerfAndCompute: any = {};
    selectedHosts.forEach((rowData: any) => {
        if (rowData?.sqlServerInstances?.length) {
            rowData.sqlServerInstances.forEach((instance: any) => {
                // Use a unique key combining host resourceId and instance name to avoid conflicts
                const uniqueKey = `${rowData.resourceId}_${instance.sqlInstanceName}`;
                if (!storagePerfAndCompute[uniqueKey]) {
                    storagePerfAndCompute[uniqueKey] = {};
                }
                storagePerfAndCompute[uniqueKey].totalStorage = formatFractionalNumber(
                    Number(instance?.totalStorage || 0) / GIB_IN_BYTE,
                    3
                );
                storagePerfAndCompute[uniqueKey].totalIops = formatFractionalNumber(instance?.totalIops, 3);
                storagePerfAndCompute[uniqueKey].totalThroughput = formatFractionalNumber(instance?.totalThroughput, 3);
                storagePerfAndCompute[uniqueKey].noOfVcpusInUse = instance?.noOfVcpusInUse;
                storagePerfAndCompute[uniqueKey].memory = formatFractionalNumber(
                    Number(instance?.memory || 0) / GIB_IN_BYTE,
                    3
                );
                storagePerfAndCompute[uniqueKey].sqlInstanceName = instance?.sqlInstanceName;
                storagePerfAndCompute[uniqueKey].sqlInstanceId = instance?.sqlInstanceId;
                storagePerfAndCompute[uniqueKey].networkPerformance = instance?.networkPerformance;
                storagePerfAndCompute[uniqueKey].hostResourceName = rowData?.resourceName; // Add host name for reference
            });
        }
    });
    dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));

    // Use first host for basic navigation setup
    const firstHost = selectedHosts[0];

    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(
        setSelectedEsPageInstance({
            instanceId: '',
            credentialId: '',
            regionId: '',
            deploymentModel: firstHost?.deploymentModel,
            serverName: `${selectedHosts.length} hosts selected`
        })
    );
    dispatch(setSelectedOnPremHostId(firstHost?.resourceId));
    dispatch(setSelectedServerName(`${selectedHosts.length} hosts selected`));
    setESInstanceOnPremData(firstHost, dispatch);
};

export const setESInstanceData = (data: any, dispatch: any) => {
    let serverInstallationMode = data?.serverInstallationMode;
    if (data?.serverInstallationMode === GENERAL.AOAG) {
        serverInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
    }

    let serverVersion = '';
    for (const instance of data?.sqlServerInstances || []) {
        if (instance?.databaseServer?.serverVersion) {
            serverVersion = instance.databaseServer.serverVersion;
            break;
        }
    }
    dispatch(
        setSelectedHostDetails({
            ...data,
            recommendedInstance: {
                serverInstallationMode,
                serverVersion: data?.databaseServer?.serverVersion || serverVersion
            }
        })
    );
};

export const formatCalcSize = (val: any) => {
    if (val) {
        return `${String(Number(val / GIB_IN_BYTE).toLocaleString())} GiB`;
    }
    return '0 GiB';
};

export const formatNumbers = (val: any) => {
    if (val || val === 0) {
        return Number(val).toLocaleString();
    }
    return GENERAL.NOT_AVAILABLE;
};

export const formatPercentage = (val: any) => {
    if (val || val === 0) {
        return Number(100 * val).toLocaleString();
    }
    return GENERAL.NOT_AVAILABLE;
};

export const formatViewCalcInstance = (
    selectedDeploymentModel: any,
    selectedHostDetails: any,
    computeDetails: any,
    licenseDetails: any
) => {
    let instanceTypelist: any = [];
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
                    computeHourlyPrice: `$${formatNumbers(computeDetails?.[0]?.price)}`,
                    computeMonthlyPrice: `$${formatNumbers(computeDetails?.[0]?.computeMonthlyPrice)}`,
                    instanceMonthlyPrice: `$${formatNumberWithCustomComma(computeDetails?.[0]?.instanceMonthlyPrice)}`,
                    sqlEdition:
                        licenseDetails?.sqlServerEdition ||
                        selectedHostDetails?.databaseServer?.serverEdition ||
                        GENERAL.NOT_AVAILABLE,
                    sqlLicense: licenseDetails?.licenseIncluded ? 'Yes' : 'No',
                    hoursInAMonth: formatNumbers(computeDetails?.[0]?.hoursInMonth)
                }
            ];
        }
        const detailsList: any = [];
        computeDetails?.forEach((detail: any, index: number) => {
            detailsList.push({
                instanceType: detail?.instanceType || instanceTypelist?.[index] || GENERAL.NOT_AVAILABLE,
                computeHourlyPrice: `$${formatNumbers(detail?.price)}`,
                computeMonthlyPrice: `$${formatNumbers(detail?.computeMonthlyPrice)}`,
                instanceMonthlyPrice: `$${formatNumberWithCustomComma(detail?.instanceMonthlyPrice)}`,
                sqlEdition:
                    licenseDetails?.sqlServerEdition ||
                    selectedHostDetails?.databaseServer?.serverEdition ||
                    GENERAL.NOT_AVAILABLE,
                sqlLicense: licenseDetails?.licenseIncluded ? 'Yes' : 'No',
                hoursInAMonth: formatNumbers(detail?.hoursInMonth)
            });
        });
        return detailsList;
    })();
    return instanceCalculationData;
};

export const formatViewCalcRecommendedData = (data: ViewCalculationsInterface, selectedDeploymentModel: string) => {
    let result: ViewCalculationsInterface = {};
    if (data) {
        const state = store.getState();
        const { recommendedTargetInstance } = state.exploreSavings;
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
    const state = store.getState();
    const { savingsCalculatorFrom } = state.exploreSavings;
    const { selectedRowsForExploreSavingsEBSBulk, selectedRowsForExploreSavingsOnPremBulk } = state.exploreSavingsBulk;

    // Check if we're dealing with bulk calculations (arrays) vs single calculations (objects)
    const isBulkCalculation = Array.isArray(viewCalculations.recommendedComputeCalculation);

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

    // Helper function to create host-specific instance calculation data
    const createHostInstanceCalculationData = (hostName: string) => {
        if (!isBulkCalculation) return null;

        const recommendedComputeArray: any = viewCalculationsResponse?.recommendedComputeCalculation;
        const recommendedLicenseArray: any = viewCalculationsResponse?.recommendedLicenseCalculation;
        const existingComputeArray: any = viewCalculationsResponse?.existingComputeCalculation;
        const existingLicenseArray: any = viewCalculationsResponse?.existingLicenseCalculation;

        // Find the compute and license data by matching hostname
        const recommendedCompute = recommendedComputeArray?.find((item: any) => item.hostname === hostName);
        const recommendedLicense = recommendedLicenseArray?.find((item: any) => item.hostname === hostName);
        const existingCompute = existingComputeArray?.find((item: any) => item.hostname === hostName);
        const existingLicense = existingLicenseArray?.find((item: any) => item.hostname === hostName);

        // Get the raw machine data from formatViewCalcInstance
        const fsxMachineData = formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            recommendedCompute?.machineDetails,
            recommendedLicense
        );

        const ebsMachineData = formatViewCalcInstance(
            selectedDeploymentModel,
            {},
            existingCompute?.machineDetails,
            existingLicense
        );

        // Create formatted calculation arrays similar to what viewCalculation functions produce
        const createFormattedCalculation = (machineData: any[], licenseData: any, computeData: any) => {
            const machineDetailsList: any[] = [];

            machineData?.forEach((calculation: any, index: number) => {
                machineDetailsList.push(
                    { label: `Machine ${index + 1} specification` },
                    {
                        label: 'Instance type',
                        value: calculation?.instanceType,
                        text: ''
                    },
                    {
                        label: 'SQL edition',
                        value: calculation?.sqlEdition,
                        text: ''
                    },
                    {
                        label: 'SQL license included',
                        value: calculation?.sqlLicense,
                        text: ''
                    },
                    { label: `Machine ${index + 1} pricing calculations` },
                    {
                        label: 'Instance hourly price',
                        value: calculation?.computeHourlyPrice,
                        text: 'Instance hourly price with SQL license included'
                    },
                    {
                        label: `EC2 machine${index + 1} cost`,
                        value: calculation?.instanceMonthlyPrice,
                        text: `Instance hourly price x number of hours in a month = ${calculation?.computeHourlyPrice} x ${calculation?.hoursInAMonth}`
                    }
                );
            });

            // Calculate total cost for all machines for this host
            const totalCost =
                machineData?.reduce((total: number, calc: any) => {
                    const price = calc?.instanceMonthlyPrice;
                    const numericPrice =
                        typeof price === 'string'
                            ? Number(price.replace('$', '').replace(',', ''))
                            : Number(price) || 0;
                    return total + numericPrice;
                }, 0) || 0;

            machineDetailsList.push({
                label: 'EC2 machines total cost',
                value: `$${formatNumberWithCustomComma(totalCost)}`,
                text: ''
            });

            return machineDetailsList;
        };

        return {
            hostName,
            fsxInstanceCalculation: createFormattedCalculation(fsxMachineData, recommendedLicense, recommendedCompute),
            ebsInstanceCalculation: createFormattedCalculation(ebsMachineData, existingLicense, existingCompute),
            recommendedCompute,
            recommendedLicense,
            existingCompute,
            existingLicense
        };
    };

    // Create host-specific data for bulk calculations
    const hostCalculationData = isBulkCalculation
        ? (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
              ? selectedRowsForExploreSavingsOnPremBulk
              : selectedRowsForExploreSavingsEBSBulk
          )
              .map((host: any) => {
                  // For EBS, host is an object with .name property
                  // For on-prem, host is an object with .resourceName property
                  const hostName = savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ? host.resourceName : host.name;
                  return createHostInstanceCalculationData(hostName);
              })
              .filter(Boolean)
        : [];

    const totalEbsCost = (ebsViewCalculationData: any) => {
        let cost = 0;
        if (isBulkCalculation) {
            // For bulk calculations, sum costs from all hosts
            const existingComputeArray: any = viewCalculationsResponse?.existingComputeCalculation;
            existingComputeArray.forEach((compute: any) => {
                compute?.machineDetails?.forEach((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            });
        } else {
            const existingCompute: any = viewCalculationsResponse?.existingComputeCalculation;
            if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                cost += Number(existingCompute?.machineDetails?.[0]?.instanceMonthlyPrice || 0);
            } else {
                existingCompute?.machineDetails?.map((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            }
        }
        cost += ebsViewCalculationData?.ebsSnapshotCalculation?.totalEbsSnapshotCostValue || 0;
        cost += ebsViewCalculationData?.ebsCloneCalculation?.totalCloneMonthlyCostValue || 0;

        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost || 0;
        return formatFractionalNumberForCost(cost, 2);
    };

    const totalFsxwCost = () => {
        let cost = 0;
        if (isBulkCalculation) {
            // For bulk calculations, sum costs from all hosts
            const existingComputeArray: any = viewCalculationsResponse?.existingComputeCalculation;
            existingComputeArray?.forEach((compute: any) => {
                compute?.machineDetails?.forEach((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            });
        } else {
            const existingCompute = viewCalculationsResponse?.existingComputeCalculation as any;
            if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                cost += Number(existingCompute?.machineDetails?.[0]?.instanceMonthlyPrice || 0);
            } else {
                existingCompute?.machineDetails?.map((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            }
        }
        cost += Number(viewCalculationsResponse?.fsxwCloneCalculation?.totalCloneMonthlyCost || 0);
        cost += Number(
            viewCalculationsResponse?.fsxwSnapshotCalculation?.totalMonthlyCostForFsxwSnapshotStorageCapacity || 0
        );
        cost += Number(viewCalculationsResponse?.fsxwCalculation?.totalMonthlyCost || 0);
        return formatFractionalNumberForCost(cost, 2);
    };

    const onlyEbsCost = (ebsViewCalculationData: any) => {
        let cost = 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost || 0;
        cost += ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost || 0;
        return formatFractionalNumberForCost(cost, 2);
    };

    const totalExistingEc2MachineCost = (() => {
        let cost = 0;
        if (isBulkCalculation) {
            // For bulk calculations, sum costs from all hosts
            const existingComputeArray: any = viewCalculationsResponse?.existingComputeCalculation;
            existingComputeArray?.forEach((compute: any) => {
                compute?.machineDetails?.forEach((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            });
        } else {
            const existingCompute = viewCalculationsResponse?.existingComputeCalculation as any;
            if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                cost += Number(existingCompute?.machineDetails?.[0]?.instanceMonthlyPrice || 0);
            } else {
                existingCompute?.machineDetails?.map((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            }
        }
        return formatFractionalNumberForCost(cost, 2);
    })();

    const totalFsxEc2MachineCost = (() => {
        let cost = 0;
        if (isBulkCalculation) {
            // For bulk calculations, sum costs from all hosts
            const recommendedComputeArray: any = viewCalculationsResponse?.recommendedComputeCalculation;
            recommendedComputeArray?.forEach((compute: any) => {
                compute?.machineDetails?.forEach((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            });
        } else if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.instanceMonthlyPrice || 0);
        } else {
            viewCalculationsResponse?.recommendedInstance?.map((instance: any) => {
                cost += Number(instance?.instanceMonthlyPrice || 0);
            });
        }
        return formatFractionalNumberForCost(cost, 2);
    })();

    const totalFsxCost = (() => {
        let cost = 0;
        if (isBulkCalculation) {
            // For bulk calculations, sum costs from all hosts
            const recommendedComputeArray: any = viewCalculationsResponse?.recommendedComputeCalculation;
            recommendedComputeArray?.forEach((compute: any) => {
                compute?.machineDetails?.forEach((instance: any) => {
                    cost += Number(instance?.instanceMonthlyPrice || 0);
                });
            });
        } else if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            cost += Number(viewCalculationsResponse?.recommendedInstance?.[0]?.instanceMonthlyPrice || 0);
        } else {
            viewCalculationsResponse?.recommendedInstance?.map((instance: any) => {
                cost += Number(instance?.instanceMonthlyPrice || 0);
            });
        }
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge || 0);
        cost += Number(viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalSnapshotMonthlyCost || 0);
        return formatFractionalNumberForCost(cost, 2);
    })();

    const totalFsxSnapshotCost = (() => {
        let cost = 0;
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForCapacity || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapSnapshotCalculation?.totalMonthlyCostForFsxSsd || 0);
        return formatFractionalNumberForCost(cost, 2);
    })();

    const totalAzCost = (() => {
        let cost = 0;
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalThroughputAndIopsMonthly || 0);
        cost += Number(viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge || 0);
        return formatFractionalNumberForCost(cost, 2);
    })();

    let result: any = {
        fsxInstanceCalculation: isBulkCalculation
            ? hostCalculationData.map((host: any) => ({
                  hostName: host.hostName,
                  hostIndex: host.hostIndex,
                  fsxInstanceCalculation: host.fsxInstanceCalculation,
                  recommendedCompute: host.recommendedCompute,
                  recommendedLicense: host.recommendedLicense,
                  existingCompute: host.existingCompute,
                  existingLicense: host.existingLicense
              }))
            : formatViewCalcInstance(
                  selectedDeploymentModel,
                  {},
                  viewCalculationsResponse?.recommendedInstance,
                  viewCalculationsResponse?.recommendedLicenseCalculation
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
            totalMonthlyStorageCharge: `${formatNumberWithCustomComma(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyStorageCharge
            )}`,
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
            minThroughputCapacityRequired: `${formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.minThroughputCapacityRequired
            )} MB/s`,
            provisionedThroughputCapacity: `${formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.provisionedThroughputCapacity
            )} MB/s`,
            totalMonthlyFsxnThroughputCapacityCost: formatNumberWithCustomComma(
                viewCalculationsResponse?.fsxOntapCalculation?.totalMonthlyFsxnThroughputCapacityCost
            ),
            includedSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.includedSsdIops),
            additionalSsdIops: formatNumbers(viewCalculationsResponse?.fsxOntapCalculation?.additionalSsdIops),
            billedAdditionalSsdIops: formatNumbers(
                viewCalculationsResponse?.fsxOntapCalculation?.billedAdditionalSsdIops
            ),
            additionalBilledCostForSsdIops: formatNumberWithCustomComma(
                viewCalculationsResponse?.fsxOntapCalculation?.additionalBilledCostForSsdIops
            ),
            totalThroughputAndIopsMonthly: formatNumberWithCustomComma(
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
            totalSnapshotMonthlyCost: formatNumberWithCustomComma(
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
            totalCloneMonthlyCost: formatNumberWithCustomComma(
                viewCalculationsResponse?.fsxCloneCalculation?.totalCloneMonthlyCost
            )
        },
        totalFsxEc2MachineCost,
        fsxTotalCost: totalFsxCost,
        fsxSnapshotTotalCost: totalFsxSnapshotCost,
        totalAzCost,
        azType,
        monthlyChangeRate
    };

    if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
    ) {
        result = {
            ...result,
            fsxwInstanceCalculation: formatViewCalcInstance(
                selectedDeploymentModel,
                {},
                viewCalculationsResponse?.existingComputeCalculation?.machineDetails,
                viewCalculationsResponse?.existingLicenseCalculation
            ),
            fsxwCloneCalculation: {
                clonedCopiesCount: formatNumbers(viewCalculationsResponse?.fsxwCloneCalculation?.clonedCopiesCount),
                capacity: formatNumbers(viewCalculationsResponse?.fsxwCloneCalculation?.capacity),
                iops: formatNumbers(viewCalculationsResponse?.fsxwCloneCalculation?.iops),
                throughput: formatNumbers(viewCalculationsResponse?.fsxwCloneCalculation?.throughput),
                totalCloneMonthlyCost: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwCloneCalculation?.totalCloneMonthlyCost
                )
            },
            fsxwSnapshotCalculation: {
                desiredSnapshotStorageCapacity: formatCalcSize(
                    viewCalculationsResponse?.fsxwSnapshotCalculation?.desiredSnapshotStorageCapacity
                ),
                storageSavingSnapshot: formatCalcSize(
                    viewCalculationsResponse?.fsxwSnapshotCalculation?.storageSavingSnapshot
                ),
                provisionedStorageCapacityForFsxwSnapshot: formatCalcSize(
                    viewCalculationsResponse?.fsxwSnapshotCalculation?.provisionedStorageCapacityForFsxwSnapshot
                ),
                totalMonthlyCostForFsxwSnapshotStorageCapacity: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwSnapshotCalculation?.totalMonthlyCostForFsxwSnapshotStorageCapacity
                )
            },
            fsxwCalculation: {
                deduplicationSavings: formatPercentage(viewCalculationsResponse?.fsxwCalculation?.deduplicationSavings),
                fsxwSsdPrice: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.fsxwSsdPrice?.price),
                totalMonthlyCost: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwCalculation?.totalMonthlyCost
                ),
                desiredStorageCapacity: formatCalcSize(
                    viewCalculationsResponse?.fsxwCalculation?.desiredStorageCapacity
                ),
                storageSavings: formatCalcSize(viewCalculationsResponse?.fsxwCalculation?.storageSavings),
                provisionedStorageCapacity: viewCalculationsResponse?.fsxwCalculation?.provisionedStorageCapacity,
                monthlyCostForStorageCapacity: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwCalculation?.monthlyCostForStorageCapacity
                ),
                totalDefaultProvisionedIops: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.totalDefaultProvisionedIops
                ),
                additionalUserProvisionedIops: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.additionalUserProvisionedIops
                ),
                sumOfDefaultAndAdditionalProvisionedIops: formatNumbers(
                    Number(viewCalculationsResponse?.fsxwCalculation?.totalDefaultProvisionedIops || 0) +
                        Number(viewCalculationsResponse?.fsxwCalculation?.additionalUserProvisionedIops || 0)
                ),
                billedIops: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.billedIops),
                totalMonthlyCostForProvisionedSsdIops: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwCalculation?.totalMonthlyCostForProvisionedSsdIops
                ),
                fsxwIopsPrice: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.fsxwIopsPrice),
                numberOfFileSystemsRequiredForStorageCapacity: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.numberOfFileSystemsRequiredForStorageCapacity
                ),
                fsxwMaxCapacity: formatCalcSize(viewCalculationsResponse?.fsxwCalculation?.fsxwMaxCapacity),
                numberOfFileSystemsRequiredForThroughputCapacity: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.numberOfFileSystemsRequiredForThroughputCapacity
                ),
                throughput: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.throughput),
                fsxwMaxThroughput: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.fsxwMaxThroughput),
                requiredFractionalFileSystems: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.requiredFractionalFileSystems
                ),
                requiredFileSystems: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.requiredFileSystems),
                fsxwMinThroughput: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.fsxwMinThroughput),
                minThroughputCapacityRequired: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.minThroughputCapacityRequired
                ),
                provisionedThroughputCapacity: formatNumbers(
                    viewCalculationsResponse?.fsxwCalculation?.provisionedThroughputCapacity
                ),
                fsxwThroughputPrice: formatNumbers(viewCalculationsResponse?.fsxwCalculation?.fsxwThroughputPrice),
                totalMonthlyCostForThroughputCapacity: formatNumberWithCustomComma(
                    viewCalculationsResponse?.fsxwCalculation?.totalMonthlyCostForThroughputCapacity
                )
            },
            totalFsxwEc2MachineCost: totalExistingEc2MachineCost,
            fsxwTotalCost: totalFsxwCost()
        };
    } else {
        const ebsViewCalculationData = getEbsViewCalculationData(viewCalculationsResponse);
        result = {
            ...result,
            ...ebsViewCalculationData,
            ebsCalculation: {
                ...ebsViewCalculationData?.ebsCalculation,
                totalEbsThroughputCost: formatNumberWithCustomComma(
                    ebsViewCalculationData?.ebsCalculation?.totalEbsThroughputCost
                ),
                totalEbsIopsCost: formatNumberWithCustomComma(ebsViewCalculationData?.ebsCalculation?.totalEbsIopsCost),
                totalEbsStorageCost: formatNumberWithCustomComma(
                    ebsViewCalculationData?.ebsCalculation?.totalEbsStorageCost
                )
            },
            ebsInstanceCalculation: isBulkCalculation
                ? hostCalculationData.map((host: any) => ({
                      hostName: host.hostName,
                      hostIndex: host.hostIndex,
                      ebsInstanceCalculation: host.ebsInstanceCalculation,
                      recommendedCompute: host.recommendedCompute,
                      recommendedLicense: host.recommendedLicense,
                      existingCompute: host.existingCompute,
                      existingLicense: host.existingLicense
                  }))
                : formatViewCalcInstance(
                      selectedDeploymentModel,
                      {},
                      (viewCalculationsResponse?.existingComputeCalculation as any)?.machineDetails,
                      viewCalculationsResponse?.existingLicenseCalculation
                  ),
            totalEBSEc2MachineCost: totalExistingEc2MachineCost,
            ebsTotalCost: totalEbsCost(ebsViewCalculationData),
            ebsOnlyCost: onlyEbsCost(ebsViewCalculationData)
        };
    }

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
            totalSnapshotCost: formatNumberWithCustomComma(ebsSnapshotCalculation?.totalSnapshotCost),
            totalEbsSnapshotCost: formatNumbers(ebsSnapshotCalculation?.totalEbsSnapshotCost),
            ebsSnapshotCost: formatNumberWithCustomComma(ebsSnapshotCalculation?.ebsSnapshotCost),
            ebsSnapshotPrice: formatNumbers(ebsSnapshotCalculation?.ebsSnapshotPrice),
            totalEbsSnapshotCostValue: ebsSnapshotCalculation?.ebsSnapshotCost
        },
        ebsCloneCalculation: {
            clonedCopiesCount: formatNumbers(ebsCloneCalculation?.clonedCopiesCount),
            capacity: formatNumbers(ebsCloneCalculation?.capacity),
            iops: formatNumbers(ebsCloneCalculation?.iops),
            throughput: formatNumbers(ebsCloneCalculation?.throughput),
            totalCloneMonthlyCost: formatNumberWithCustomComma(ebsCloneCalculation?.totalCloneMonthlyCost),
            totalCloneMonthlyCostValue: ebsCloneCalculation?.totalCloneMonthlyCost
        }
    };
};

export const EbsCalculationUpdates = (data: { [key: string]: EBSCalculation }) => {
    const result: any = {};
    let totalEbsThroughputCost = 0;
    let totalEbsIopsCost = 0;
    let totalEbsStorageCost = 0;
    const throughPutTextList: any = [];
    const iopsTextList: any = [];
    const storageTextList: any = [];
    Object.keys(data).map((key: string) => {
        totalEbsThroughputCost += Number(data[key]?.ebsThroughputCost);
        totalEbsIopsCost += Number(data[key]?.ebsIopsCost);
        totalEbsStorageCost += Number(data[key]?.ebsStorageCost);
        throughPutTextList.push(`${key} throughput cost`);
        iopsTextList.push(`${key} IOPS cost`);
        storageTextList.push(`${key} storage cost`);
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

    result.totalEbsThroughputCost = totalEbsThroughputCost;
    result.totalEbsIopsCost = totalEbsIopsCost;
    result.totalEbsStorageCost = totalEbsStorageCost;
    result.totalEbsThroughputCostText = throughPutTextList.join(' + ');
    result.totalEbsIopsCostText = iopsTextList.join(' + ');
    result.totalEbsStorageCostText = storageTextList.join(' + ');
    return result;
};

export const formatStorageSavingsRecommendedData = (data: StorageSavingsInterface) => {
    let result: StorageSavingsInterface = {};
    if (data) {
        const state = store.getState();
        const {
            recommendedTargetInstance,
            selectedManualDeploymentModel,
            selectedDeploymentModel,
            savingsCalculatorFrom
        } = state.exploreSavings;
        let deploymentModelValue = selectedDeploymentModel;
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
        ) {
            deploymentModelValue = selectedManualDeploymentModel?.value;
        }

        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            // Handle ONPREM mode with array format for compute and license (similar to EBS bulk)
            const computeArray = Array.isArray(data?.compute) ? data.compute : [data?.compute].filter(Boolean);
            const licenseArray = Array.isArray(data?.license) ? data.license : [data?.license].filter(Boolean);

            // Calculate total costs by summing all objects in arrays using reduce
            const totalComputePrice = computeArray.reduce(
                (total: number, computeObj: any) => total + Number(computeObj?.recommended?.computeMonthlyPrice || 0),
                0
            );

            const totalLicensePrice = licenseArray.reduce(
                (total: number, licenseObj: any) => total + Number(licenseObj?.recommended?.licenseMonthlyPrice || 0),
                0
            );

            result = {
                ...data,
                recommendedInstance: {
                    ...computeArray[0]?.recommended?.machineDetails?.[0],
                    licenseMonthlyPrice: totalLicensePrice,
                    computeMonthlyPrice: totalComputePrice
                },
                totalSummary: {
                    ...data?.totalSummary,
                    recommendedTotal: Number(data?.totalSummary?.recommended || 0)
                }
            };
        } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            // Handle AUTO_EBS mode with array format for compute and license
            const computeArray = Array.isArray(data?.compute) ? data.compute : [data?.compute].filter(Boolean);
            const licenseArray = Array.isArray(data?.license) ? data.license : [data?.license].filter(Boolean);

            // Check if all compute objects have recommendationOptions
            const hasRecommendationOptions = computeArray.every(
                (computeObj: any) =>
                    computeObj?.recommended?.recommendationOptions &&
                    computeObj.recommended.recommendationOptions.length > 0
            );

            if (recommendedTargetInstance && computeArray.length > 0 && hasRecommendationOptions) {
                // Calculate total costs for all compute and license objects
                let totalExistingComputePrice = 0;
                let totalExistingLicensePrice = 0;
                let totalRecommendedComputePrice = 0;
                let totalRecommendedLicensePrice = 0;

                // Sum up existing costs from all compute objects
                computeArray.forEach((computeObj: any) => {
                    const isAOAG = deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                    const multiplier = isAOAG ? 2 : 1;

                    totalExistingComputePrice +=
                        Number(computeObj?.recommended?.machineDetails?.[0]?.computeMonthlyPrice || 0) * multiplier;
                });

                // Sum up existing license costs
                licenseArray.forEach((licenseObj: any) => {
                    const isAOAG = deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                    const multiplier = isAOAG ? 2 : 1;

                    totalExistingLicensePrice += Number(licenseObj?.recommended?.licenseMonthlyPrice || 0) * multiplier;
                });

                // Calculate recommended costs for each compute object individually
                computeArray.forEach((computeObj: any) => {
                    const isAOAG = deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                    const multiplier = isAOAG ? 2 : 1;

                    // Get recommendeRow from each compute object's recommendationOptions
                    const recommendeRow = computeObj?.recommended?.recommendationOptions?.filter(
                        (perRow: any) => perRow?.instanceType === recommendedTargetInstance
                    );

                    if (recommendeRow && recommendeRow?.length > 0) {
                        totalRecommendedComputePrice += Number(recommendeRow[0]?.computeMonthlyPrice || 0) * multiplier;
                    }
                });

                // Calculate recommended costs for each license object individually
                licenseArray.forEach((licenseObj: any) => {
                    const isAOAG = deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                    const multiplier = isAOAG ? 2 : 1;

                    // For license, we need to find the corresponding recommendeRow based on the target instance
                    // Since license objects might not have recommendationOptions, we'll use the first compute's recommendeRow for license pricing
                    const firstComputeRecommendeRow = computeArray[0]?.recommended?.recommendationOptions?.filter(
                        (perRow: any) => perRow?.instanceType === recommendedTargetInstance
                    );

                    if (firstComputeRecommendeRow && firstComputeRecommendeRow?.length > 0) {
                        totalRecommendedLicensePrice +=
                            Number(firstComputeRecommendeRow[0]?.licenseMonthlyPrice || 0) * multiplier;
                    }
                });

                const recommendedTotal =
                    Number(data?.totalSummary?.recommended || 0) -
                    totalExistingComputePrice -
                    totalExistingLicensePrice +
                    totalRecommendedComputePrice +
                    totalRecommendedLicensePrice;

                // Get the first compute object's recommendeRow for the recommendedInstance structure
                const firstComputeRecommendeRow = computeArray[0]?.recommended?.recommendationOptions?.filter(
                    (perRow: any) => perRow?.instanceType === recommendedTargetInstance
                );

                result = {
                    ...data,
                    recommendedInstance: {
                        ...firstComputeRecommendeRow?.[0],
                        licenseMonthlyPrice: totalRecommendedLicensePrice,
                        computeMonthlyPrice: totalRecommendedComputePrice
                    },
                    totalSummary: {
                        ...data?.totalSummary,
                        recommendedTotal
                    }
                };
            } else {
                // Fallback for AUTO_EBS when no recommended instance is selected
                let totalExistingComputePrice = 0;
                let totalExistingLicensePrice = 0;

                computeArray.forEach((computeObj: any) => {
                    totalExistingComputePrice += Number(computeObj?.existing?.computeMonthlyPrice || 0);
                });

                licenseArray.forEach((licenseObj: any) => {
                    totalExistingLicensePrice += Number(licenseObj?.recommended?.licenseMonthlyPrice || 0);
                });

                result = {
                    ...data,
                    recommendedInstance: {
                        ...computeArray[0]?.recommended?.machineDetails?.[0],
                        licenseMonthlyPrice: totalExistingLicensePrice,
                        computeMonthlyPrice: totalExistingComputePrice
                    },
                    totalSummary: {
                        ...data?.totalSummary,
                        recommendedTotal: Number(data?.totalSummary?.recommended || 0)
                    }
                };
            }
        } else {
            // Handle non-AUTO_EBS modes (original logic for single object format)
            let recommendeRow: any = null;
            if (recommendedTargetInstance) {
                recommendeRow = data?.compute?.recommended?.recommendationOptions?.filter(
                    perRow => perRow?.instanceType === recommendedTargetInstance
                );
            }
            if (recommendeRow && recommendeRow?.length) {
                // For standalone compute and license cost is added only 1 time
                if (deploymentModelValue.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                    const recommendedTotal =
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
                            recommendedTotal
                        }
                    };
                } else {
                    // For AOAG compute and license cost is added 2 times for each node
                    const recommendedTotal =
                        Number(data?.totalSummary?.recommended || 0) -
                        Number(data?.compute?.recommended?.machineDetails?.[0]?.computeMonthlyPrice || 0) * 2 -
                        Number(data?.compute?.recommended?.machineDetails?.[0]?.licenseMonthlyPrice || 0) * 2 +
                        Number(recommendeRow?.[0]?.computeMonthlyPrice || 0) * 2 +
                        Number(recommendeRow?.[0]?.licenseMonthlyPrice || 0) * 2;
                    result = {
                        ...data,
                        recommendedInstance: {
                            ...recommendeRow?.[0],
                            licenseMonthlyPrice: (recommendeRow?.[0]?.licenseMonthlyPrice || 0) * 2,
                            computeMonthlyPrice: (recommendeRow?.[0]?.computeMonthlyPrice || 0) * 2
                        },
                        totalSummary: {
                            ...data?.totalSummary,
                            recommendedTotal
                        }
                    };
                }
            } else if (data?.license?.existing?.sqlServerEdition === data?.license?.recommended?.sqlServerEdition) {
                result = {
                    ...data,
                    recommendedInstance: {
                        ...data?.compute?.recommended?.machineDetails?.[0],
                        licenseMonthlyPrice: data?.license?.existing?.licenseMonthlyPrice,
                        computeMonthlyPrice: data?.compute?.existing?.computeMonthlyPrice
                    },
                    totalSummary: {
                        ...data?.totalSummary,
                        recommendedTotal:
                            Number(data?.totalSummary?.recommended || 0) -
                            Number(data?.compute?.recommended?.computeMonthlyPrice || 0) -
                            Number(data?.license?.recommended?.licenseMonthlyPrice || 0) +
                            Number(data?.compute?.existing?.computeMonthlyPrice || 0) +
                            Number(data?.license?.existing?.licenseMonthlyPrice || 0)
                    }
                };
            } else {
                result = {
                    ...data,
                    recommendedInstance: {
                        ...data?.compute?.recommended?.machineDetails?.[0],
                        licenseMonthlyPrice: data?.license?.recommended?.licenseMonthlyPrice,
                        computeMonthlyPrice: data?.compute?.existing?.computeMonthlyPrice
                    },
                    totalSummary: {
                        ...data?.totalSummary,
                        recommendedTotal:
                            Number(data?.totalSummary?.recommended || 0) -
                            Number(data?.compute?.recommended?.computeMonthlyPrice || 0) +
                            Number(data?.compute?.existing?.computeMonthlyPrice || 0)
                    }
                };
            }
        }
    } else {
        result = data;
    }
    return result;
};

export const generateLabel2ForInstanceType = (options: any, option: any, existingTypeObj: any) => {
    if (option === existingTypeObj?.instanceType) {
        return 'Current instance type';
    }
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
};

export const handleAuthenticate = async (
    rowData: any,
    dispatch: Dispatch,
    selectedExploreSavingsTabFileSystemType: string,
    isWorkloadFactory: boolean,
    navigate: NavigateFunction,
    closeDialogCallback: () => void,
    t: TFunction,
    registerResourceCredBulk: (args: any) => Promise<any>,
    isFromAddHosts: boolean = false
) => {
    try {
        dispatch(setActionsDisabled(true));
        const state = store.getState();
        const {
            selectedAuthenticationType,
            serverDetails: { userName, password }
        } = state.exploreSavings;
        const { selectedRowsForExploreSavingsEBSBulk, bulkAuthCredentials, rowsRequiringAuthBulk } =
            state.exploreSavingsBulk;

        // Determine if this is a bulk operation
        const isBulkOperation = selectedRowsForExploreSavingsEBSBulk && selectedRowsForExploreSavingsEBSBulk.length > 0;

        if (isBulkOperation) {
            // Bulk authentication flow
            const rowsToAuthenticate =
                rowsRequiringAuthBulk?.length > 0 ? rowsRequiringAuthBulk : selectedRowsForExploreSavingsEBSBulk;

            // Initialize status to 'in-progress' for all rows
            const initialStatus: any = {};
            rowsToAuthenticate.forEach((row: any) => {
                initialStatus[row.name] = 'in-progress';
            });
            dispatch(setBulkAuthStatus(initialStatus));

            // Create payload for bulk authentication
            const payloadItems: any[] = [];

            rowsToAuthenticate.forEach((row: any) => {
                const credentialList: {
                    resourceId: string;
                    resourceType: string;
                    username: string;
                    password: string;
                }[] = [];

                const hostCredentials = bulkAuthCredentials[row.name];
                const credUserName = hostCredentials?.userName || '';
                const credPassword = hostCredentials?.password || '';

                // Only create credentials for instances in this specific host that match the fileSystemType
                row?.sqlServerInstances?.forEach((instance: any) => {
                    if (instance?.fileSystemType === selectedExploreSavingsTabFileSystemType) {
                        credentialList.push({
                            resourceId: instance?.databaseInstanceName,
                            resourceType:
                                selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                    ? DETECT_HOST_VAR.MSSQL
                                    : DETECT_HOST_VAR.WINDOWS,
                            username: credUserName,
                            password: credPassword
                        });
                    }
                });

                if (credentialList.length > 0) {
                    payloadItems.push({
                        credentials: credentialList,
                        checkManageReadiness: true,
                        ec2InstanceId: row?.ec2InstanceId,
                        region: row?.regionId,
                        credentialsId: row?.credentialId
                    });
                }
            });

            const payload = { items: payloadItems };
            const result = await registerResourceCredBulk({ payload });

            if (result && !result?.error && result?.data) {
                const updatedStatus: any = {};
                let allSuccess = true;
                let anySuccess = false;

                rowsToAuthenticate.forEach((row: any) => {
                    const registerItem = result?.data?.items?.find(
                        (item: any) =>
                            item.ec2InstanceId === row?.ec2InstanceId &&
                            item.region === row?.regionId &&
                            item.credentialsId === row?.credentialId
                    );

                    const registerItemExists = registerItem && registerItem?.registerDetails?.length > 0;

                    if (registerItemExists && isMissingSqlPermissions(registerItem?.registerDetails)) {
                        updatedStatus[row.name] = 'failure';
                        allSuccess = false;
                    } else if (registerItemExists) {
                        // Check all registerDetails for any errors
                        let hasErrors = false;
                        const errors: string[] = [];

                        registerItem.registerDetails.forEach((detail: any) => {
                            if (detail?.databaseServerError) {
                                errors.push(detail.databaseServerError);
                                hasErrors = true;
                            }
                            if (detail?.fsxnError) {
                                errors.push(detail.fsxnError);
                                hasErrors = true;
                            }
                        });

                        if (!hasErrors) {
                            updatedStatus[row.name] = 'success';
                            anySuccess = true;
                            // Update inventory table for successful authentication
                            updateInventoryTable(row, selectedExploreSavingsTabFileSystemType, dispatch, result);
                        } else {
                            updatedStatus[row.name] = 'failure';
                            allSuccess = false;
                        }
                    } else {
                        updatedStatus[row.name] = 'failure';
                        allSuccess = false;
                    }
                });

                dispatch(setBulkAuthStatus(updatedStatus));

                if (allSuccess) {
                    // All authentications successful
                    if (isFromAddHosts) {
                        // If from add hosts, add the successfully authenticated hosts to the selection
                        const currentSelection = selectedRowsForExploreSavingsEBSBulk;
                        const existingIds = new Set(currentSelection.map((row: any) => row.id));
                        const newHosts = rowsToAuthenticate.filter((row: any) => !existingIds.has(row.id));
                        const updatedSelection = [...currentSelection, ...newHosts];

                        dispatch(setSelectedRowsForExploreSavingsEBSBulk(updatedSelection));
                        // Trigger data fetch after adding authenticated hosts
                        dispatch(setTriggerBulkDataFetch(true));
                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: `Authenticated for ${rowsToAuthenticate.length} database hosts was successful.\nYou can now explore potential savings.`
                            })
                        );
                        dispatch(resetDialogComponent());
                        dispatch(resetBulkAuthCredentialsAndStatus());
                        dispatch(resetRowsRequiringAuthBulk());
                        closeDialogCallback();
                    } else {
                        // Navigate to savings page
                        const firstHost = selectedRowsForExploreSavingsEBSBulk[0];
                        const bulkServerName = `${selectedRowsForExploreSavingsEBSBulk.length} hosts selected`;
                        onClickESHost(dispatch, firstHost, isWorkloadFactory, navigate, true, bulkServerName);

                        dispatch(
                            addNotification({
                                notificationType: NOTIFICATION_TYPES.SUCCESS,
                                message: `Authenticated for ${selectedRowsForExploreSavingsEBSBulk.length} database hosts was successful.\nYou can now explore potential savings.`
                            })
                        );
                        dispatch(resetDialogComponent());
                        dispatch(resetBulkAuthCredentialsAndStatus());
                        closeDialogCallback();
                    }
                } else if (anySuccess) {
                    // Some hosts authenticated successfully, some failed
                    const failedRows = rowsToAuthenticate.filter((row: any) => updatedStatus[row.name] === 'failure');

                    dispatch(
                        setDialogErrorWithTooltip({
                            showDialogError: true,
                            errorMessage: `${t('databases.explore-savings.authentication-failed-bulk-content1')} ${
                                failedRows.length
                            } ${t('databases.explore-savings.authentication-failed-bulk-content2')}`,
                            showTooltipInfo: true,
                            tooltipText: `${t('databases.explore-savings.authentication-failed-bulk-content1')} ${
                                failedRows.length
                            } ${t('databases.explore-savings.authentication-failed-bulk-content2')} ${t(
                                'databases.explore-savings.authentication-failed-bulk-tooltip'
                            )}`
                        })
                    );
                } else {
                    // All failed
                    dispatch(
                        setDialogErrorWithTooltip({
                            showDialogError: true,
                            errorMessage: `${t('databases.explore-savings.authentication-failed-bulk-content1')} ${
                                rowsToAuthenticate.length
                            } ${t('databases.explore-savings.authentication-failed-bulk-content2')}`,
                            showTooltipInfo: true,
                            tooltipText: `${t('databases.explore-savings.authentication-failed-bulk-content1')} ${
                                rowsToAuthenticate.length
                            } ${t('databases.explore-savings.authentication-failed-bulk-content2')} ${t(
                                'databases.explore-savings.authentication-failed-bulk-tooltip'
                            )}`
                        })
                    );
                }
            } else {
                // API error
                const failedStatus: any = {};
                rowsToAuthenticate.forEach((row: any) => {
                    failedStatus[row.name] = 'failure';
                });
                dispatch(setBulkAuthStatus(failedStatus));

                dispatch(
                    setDialogErrorWithTooltip({
                        showDialogError: true,
                        errorMessage: t('databases.explore-savings.authentication-failed'),
                        showTooltipInfo: true,
                        tooltipText:
                            // @ts-ignore
                            result?.error?.data?.message || t('databases.explore-savings.authentication-failed')
                    })
                );
            }
        } else {
            // Single host authentication flow
            // Get all the SQL Server instances that match the selected file system type
            const matchedInstances = rowData?.sqlServerInstances?.filter(
                (instance: any) => instance?.fileSystemType === selectedExploreSavingsTabFileSystemType
            );

            const credentialList: {
                resourceId: string;
                resourceType: string;
                username: string;
                password: string;
            }[] = [];

            matchedInstances?.forEach((instance: any) => {
                credentialList.push({
                    resourceId: instance?.databaseInstanceName,
                    resourceType:
                        selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                            ? DETECT_HOST_VAR.MSSQL
                            : DETECT_HOST_VAR.WINDOWS,
                    username: userName,
                    password
                });
            });
            const credList = {
                credentials: credentialList,
                checkManageReadiness: true
            };

            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: rowData?.ec2InstanceId,
                        region: rowData?.regionId,
                        credentialsId: rowData?.credentialId
                    }
                ]
            };

            const result = await registerResourceCredBulk({ payload });
            if (result && !result?.error && result?.data) {
                const registerItemExists = result?.data?.items?.length > 0;
                if (registerItemExists && isMissingSqlPermissions(result?.data?.items?.[0]?.registerDetails)) {
                    dispatch(
                        setDialogErrorWithTooltip({
                            showDialogError: true,
                            errorMessage: t('databases.explore-savings.authentication-failed'),
                            showTooltipInfo: true,
                            tooltipText: t('databases.explore-savings.missing-sql-permissions')
                        })
                    );
                } else if (
                    registerItemExists &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError
                ) {
                    updateInventoryTable(rowData, selectedExploreSavingsTabFileSystemType, dispatch, result);
                    // Navigate to the Explore Savings page
                    onClickESHost(dispatch, rowData, isWorkloadFactory, navigate);
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: `Authenticated database host ${rowData?.name}.\nYou can now explore potential savings.`
                        })
                    );
                    dispatch(resetDialogComponent());
                    dispatch(resetServerDetailsCredentials());
                    closeDialogCallback();
                } else {
                    dispatch(
                        setDialogErrorWithTooltip({
                            showDialogError: true,
                            errorMessage: t('databases.explore-savings.authentication-failed'),
                            showTooltipInfo: true,
                            tooltipText:
                                result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError ||
                                result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError ||
                                t('databases.explore-savings.authentication-failed')
                        })
                    );
                }
            } else {
                dispatch(
                    setDialogErrorWithTooltip({
                        showDialogError: true,
                        errorMessage: t('databases.explore-savings.authentication-failed'),
                        showTooltipInfo: true,
                        tooltipText:
                            // @ts-ignore
                            result?.error?.data?.message || t('databases.explore-savings.authentication-failed')
                    })
                );
            }
        }
    } catch (error) {
        dispatch(
            setDialogErrorWithTooltip({
                showDialogError: true,
                errorMessage: t('databases.explore-savings.authentication-failed'),
                showTooltipInfo: true,
                // @ts-ignore
                tooltipText: error || t('databases.explore-savings.authentication-failed')
            })
        );
    } finally {
        dispatch(setActionsDisabled(false));
    }
};

const updateInventoryTable = (
    rowData: any,
    selectedExploreSavingsTabFileSystemType: string,
    dispatch: Dispatch,
    result: any
) => {
    const state = store.getState();
    const { inventoryTableData } = state.inventoryV2;
    const { selectedAuthenticationType } = state.exploreSavings;
    // Clone the inventoryTableData
    const updatedInventoryTableData: Record<string, DiscoverHostInterface> = {
        ...inventoryTableData
    } as Record<string, DiscoverHostInterface>;

    // Clone the sqlServerInstances array and update the correct instance
    updatedInventoryTableData[rowData.id] = {
        ...(updatedInventoryTableData[rowData.id] as DiscoverHostInterface),
        isDetected: true,
        sqlServerInstances:
            updatedInventoryTableData[rowData.id]?.sqlServerInstances?.map(instance =>
                // @ts-ignore
                instance?.fileSystemType === selectedExploreSavingsTabFileSystemType
                    ? {
                          ...instance,
                          sqlServerAuthentication:
                              selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                  ? true
                                  : instance.sqlServerAuthentication,
                          windowsDomainUserAuthentication:
                              selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                                  ? true
                                  : instance.windowsDomainUserAuthentication,
                          manageReadiness:
                              result?.data?.items?.[0]?.registerDetails?.[0]?.manageReadiness ||
                              instance?.manageReadiness
                      }
                    : instance
            ) ?? []
    };

    // Dispatch the updated inventory table data to the store
    dispatch(setInventoryTableData(updatedInventoryTableData));
};

export const isMissingSqlPermissions = (sqlServerInstances: any) =>
    // If any instance is missing any of the required permissions, open dialog
    sqlServerInstances?.some((instance: any) => {
        const readiness = instance?.manageReadiness;
        if (!readiness) return false;
        // Check all readiness types
        return READINESS_TYPES.some(type => {
            const missing = readiness[type]?.missingSqlPermissions || [];
            // If any required permission is missing, return true
            return REQUIRED_SQL_PERMISSIONS.some(perm => missing.includes(perm));
        });
    });

export const shouldAuthDialogOpen = (rowData: any) => {
    if (rowData?.isDetected) {
        // Check all sqlServerInstances for missing permissions in manageReadiness
        return isMissingSqlPermissions(rowData.sqlServerInstances || []);
    }
    // If not detected, open dialog
    return true;
};

// For bulk actions: evaluate an array of rowData and return an array of rows that require auth
export const shouldAuthDialogOpenBulk = (rows: any[] = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.filter(row => shouldAuthDialogOpen(row));
};
