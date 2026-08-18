import { BlueXPListeners, postBlueXPMessage } from '@netapp/design-system';
import { NavigateFunction } from 'react-router-dom';
import { Dispatch } from '@reduxjs/toolkit';
import i18next, { TFunction } from 'i18next';
import store, { AppDispatch } from '../../store/store';
import {
    resetServerDetailsCredentials,
    setDisableState,
    setOnPremStorageAndComputeInfoFull,
    setSavingsCalculatorFrom,
    setSelectedCloneRefresh,
    setSelectedEsPageInstance,
    setInstanceDataUpdatedTrigger,
    setSelectedHostDetails,
    setSelectedOnPremHostDetails,
    setSelectedOnPremHostId,
    setSelectedServerName,
    setSelectedSnapshotFrequency
} from '../../store/workloadFactory/exploreSavingsSlice';
import { setInventoryTableData, setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import { GENERAL } from '../../utils/appConstants';
import {
    AUTHENTICATION_TYPE,
    DBType,
    DETECT_HOST_VAR,
    FSX_AZ_TYPE,
    GIB_IN_BYTE,
    READINESS_TYPES,
    REQUIRED_SQL_PERMISSIONS,
    DATABASE_DEPLOYMENT_MODE,
    SAVINGS_CALC_MODE,
    SNAPSHOT_FREQUENCY,
    SQL_DEPLOYMENT_MODE,
    STORAGE_TYPES,
    WLF_TABS
} from '../../utils/consts';
import { isAuthRequiredForInstance } from '../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/DetectInstanceStep/DetectContent/DetectContentHelper';
import { getExploreSavingsEc2InstanceId } from '../InventoryV2/InventoryUtilsV2';
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
import { DiscoverHostInterface, HostManageReadiness } from '../../utils/types/inventoryV2Types';
import { addNotification, NOTIFICATION_TYPES } from '../../store/notificationSlice';
import {
    addPartialDataBannerAuthedHostKeys,
    resetBulkAuthCredentialsAndStatus,
    resetRowsRequiringAuthBulk,
    setBulkAuthStatus,
    setRowsRequiringAuthBulk,
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk,
    setTriggerBulkDataFetch
} from '../../store/workloadFactory/exploreSavingsBulkSlice';

const dispatchCommonOnPremActions = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    urlType: string,
    savingsCalcMode: string,
    defaultServerName: string,
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
                    ? `./storage-saving-calculator?type=${urlType}&mode=auto`
                    : `../fsxdb/storage-saving-calculator?type=${urlType}&mode=auto`
            }`,
            replace: true
        }
    });
    dispatch(setSavingsCalculatorFrom(savingsCalcMode));
    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(
        setSelectedEsPageInstance({
            instanceId: '',
            credentialId: '',
            regionId: '',
            deploymentModel: rowData?.deploymentModel,
            serverName: rowData?.resourceName || defaultServerName
        })
    );
    dispatch(setSelectedOnPremHostId(rowData?.resourceId));
    dispatch(setSelectedServerName(rowData?.resourceName || defaultServerName));
};

const buildStoragePerfAndCompute = (
    dispatch: any,
    hosts: any | any[],
    getHostItems: (host: any) => any[],
    getItemFields: (host: any, item: any) => { uniqueName: string; extraFields: Record<string, any> }
) => {
    const hostsArray = Array.isArray(hosts) ? hosts : [hosts];
    const storagePerfAndCompute: any = {};
    hostsArray.forEach((host: any) => {
        const items = getHostItems(host);
        if (!items?.length) return;
        items.forEach((item: any) => {
            const { uniqueName, extraFields } = getItemFields(host, item);
            const uniqueKey = `${host.resourceId}_${uniqueName}`;
            storagePerfAndCompute[uniqueKey] = {
                totalStorage: formatFractionalNumber(Number(item?.totalStorage || 0) / GIB_IN_BYTE, 3),
                totalIops: formatFractionalNumber(item?.totalIops, 3),
                totalThroughput: formatFractionalNumber(item?.totalThroughput, 3),
                memory: formatFractionalNumber(Number(item?.memory || 0) / GIB_IN_BYTE, 3),
                hostResourceName: host?.resourceName,
                ...extraFields
            };
        });
    });
    dispatch(setOnPremStorageAndComputeInfoFull(storagePerfAndCompute));
};

export const onClickESHostOracleOnPrem = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction
) => {
    dispatchCommonOnPremActions(
        dispatch,
        rowData,
        isWorkloadFactory,
        'oracle-onprem',
        SAVINGS_CALC_MODE.ORACLE_ONPREM,
        'Oracle Host',
        navigate
    );

    dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk([rowData]));

    buildStoragePerfAndCompute(
        dispatch,
        rowData,
        (host: any) => host?.oracleDatabases,
        (host: any, db: any) => ({
            uniqueName: db.databaseName,
            extraFields: {
                noOfVcpusInUse: db?.vCPUs || 0,
                databaseName: db?.databaseName,
                databaseId: db?.databaseId,
                networkPerformance: host?.networkPerformance || 'upTo10',
                monthlyOracleCost: db?.monthlyOracleCost || ''
            }
        })
    );

    dispatch(
        setSelectedOnPremHostDetails({
            ...rowData,
            totalInstance: rowData?.databaseNameList?.length || 0,
            recommendedInstance: {
                serverInstallationMode: rowData?.deploymentModel,
                serverVersion: 'Oracle'
            }
        })
    );
};

export const onClickESHostOracleOnPremBulk = (
    dispatch: any,
    selectedHosts: any[],
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction
) => {
    const firstHost = selectedHosts[0];

    dispatchCommonOnPremActions(
        dispatch,
        firstHost,
        isWorkloadFactory,
        'oracle-onprem',
        SAVINGS_CALC_MODE.ORACLE_ONPREM,
        'Oracle Hosts',
        navigate
    );

    // Store Oracle bulk selection
    dispatch(setSelectedRowsForExploreSavingsOracleOnPremBulk(selectedHosts));

    // Build storage/compute data from ALL selected hosts
    buildStoragePerfAndCompute(
        dispatch,
        selectedHosts,
        (host: any) => host?.oracleDatabases,
        (host: any, db: any) => ({
            uniqueName: db.databaseName,
            extraFields: {
                noOfVcpusInUse: db?.vCPUs || 0,
                databaseName: db?.databaseName,
                databaseId: db?.databaseId,
                networkPerformance: host?.networkPerformance || 'upTo10',
                monthlyOracleCost: db?.monthlyOracleCost || ''
            }
        })
    );

    dispatch(setSelectedOnPremHostId(firstHost?.resourceId));
    dispatch(
        setSelectedServerName(
            selectedHosts.length > 1 ? `${selectedHosts.length} hosts selected` : firstHost?.resourceName
        )
    );
    dispatch(
        setSelectedEsPageInstance({
            instanceId: '',
            credentialId: '',
            regionId: '',
            deploymentModel: firstHost?.deploymentModel,
            serverName: selectedHosts.length > 1 ? `${selectedHosts.length} hosts selected` : firstHost?.resourceName
        })
    );
    dispatch(
        setSelectedOnPremHostDetails({
            ...firstHost,
            totalInstance: firstHost?.databaseNameList?.length || 0,
            recommendedInstance: {
                serverInstallationMode: firstHost?.deploymentModel,
                serverVersion: 'Oracle'
            }
        })
    );
};

export const onClickESHostOracleEbs = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction,
    isBulk?: boolean,
    bulkServerName?: string
) => {
    const deploymentModel = rowData?.oracleServerDeploymentType || 'Standalone';

    if (navigate && isWorkloadFactory) {
        navigate('../databases/saving-calculator');
    }
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: `${
                isWorkloadFactory
                    ? './storage-saving-calculator?type=oracle-ebs&mode=auto'
                    : '../fsxdb/storage-saving-calculator?type=oracle-ebs&mode=auto'
            }`,
            replace: true
        }
    });

    // Only set bulk selection if this is NOT a bulk operation
    if (!isBulk) {
        dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk([rowData]));
    }

    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.ORACLE_AUTO_EBS));
    dispatch(setDisableState(true));
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));

    dispatch(
        setSelectedEsPageInstance({
            instanceId: rowData?.ec2InstanceId || rowData?.ec2Details?.[0]?.id,
            credentialId: rowData?.credentialId,
            regionId: rowData?.regionId,
            deploymentModel,
            serverName: bulkServerName || rowData?.name || rowData?.ec2InstanceName
        })
    );

    setESInstanceData(rowData, dispatch);

    dispatch(setTriggerBulkDataFetch(true));
    dispatch(setSelectedServerName(bulkServerName || rowData?.name || rowData?.ec2InstanceName));
};

export const onClickESHostOnPrem = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction
) => {
    dispatchCommonOnPremActions(
        dispatch,
        rowData,
        isWorkloadFactory,
        'onprem',
        SAVINGS_CALC_MODE.ONPREM,
        GENERAL.ES_SERVER_NAME,
        navigate
    );

    // Set single host in bulk selection array to use accordion UI
    dispatch(setSelectedRowsForExploreSavingsOnPremBulk([rowData]));

    buildStoragePerfAndCompute(
        dispatch,
        rowData,
        (host: any) => host?.sqlServerInstances,
        (_host: any, instance: any) => ({
            uniqueName: instance?.sqlInstanceName,
            extraFields: {
                noOfVcpusInUse: instance?.noOfVcpusInUse,
                sqlInstanceName: instance?.sqlInstanceName,
                sqlInstanceId: instance?.sqlInstanceId,
                networkPerformance: instance?.networkPerformance
            }
        })
    );

    setESInstanceOnPremData(rowData, dispatch);
};

const isExploreSavingsAoagHostMode = (mode?: string): boolean => {
    const normalized = mode?.toLowerCase().trim() ?? '';
    return normalized === SQL_DEPLOYMENT_MODE.AOAG || normalized === DATABASE_DEPLOYMENT_MODE.AOAG.toLowerCase();
};

/** True when any discovered SQL instance on the host is AOAG (including mixed Standalone + AOAG). */
export const hasExploreSavingsAoagDeployment = (rowData: any): boolean => {
    if (
        rowData?.sqlServerInstances?.some(
            (item: any) => item?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
        )
    ) {
        return true;
    }
    if (rowData?.serverAllInstallationMode?.some((mode: string) => isExploreSavingsAoagHostMode(mode))) {
        return true;
    }
    return isExploreSavingsAoagHostMode(rowData?.serverInstallationMode);
};

/** AOAG hosts with a two-node cluster use dual-node TCO pricing in Explore Savings. */
export const isExploreSavingsAoagHost = (rowData: any): boolean => {
    if (!hasExploreSavingsAoagDeployment(rowData)) {
        return false;
    }
    const clusterNodeCount = rowData?.clusterNodeDetails?.length;
    if (clusterNodeCount != null && clusterNodeCount > 0) {
        return clusterNodeCount === 2;
    }
    return rowData?.ec2Details?.length === 2;
};

/** Per-instance deployment label — mirrors Inventory instance/host AOAG formatting. */
const formatExploreSavingsSqlDeployment = (val: any, t: TFunction): string => {
    const deploymentType = val?.sqlServerDeploymentType || '';
    if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
        return t('databases.general.failover-cluster-instances');
    }
    if (
        deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
        val?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
    ) {
        return `(${t('databases.general.aoag')}) ${t('databases.general.failover-cluster-instances')}`;
    }
    if (
        deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG &&
        val?.aoagDetails?.baseDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
    ) {
        return `(${t('databases.general.aoag')}) ${t('databases.general.standalone')}`;
    }
    if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
        return t('databases.general.aoag');
    }
    if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        return t('databases.general.standalone');
    }
    if (deploymentType.toLowerCase() === SQL_DEPLOYMENT_MODE.HA) {
        return t('databases.general.high-availability');
    }
    return deploymentType;
};

/** ES table deployment label; mixed Standalone + AOAG shows "(AOAG) Standalone" like Inventory. */
export const getExploreSavingsDeploymentDisplay = (rowData: any, t: TFunction = i18next.t): string => {
    const instances = rowData?.sqlServerInstances;
    if (instances?.length) {
        const aoagInstance = instances.find(
            (val: any) => val?.sqlServerDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG
        );
        if (aoagInstance) {
            return formatExploreSavingsSqlDeployment(aoagInstance, t);
        }
        return formatExploreSavingsSqlDeployment(instances[0], t);
    }
    return rowData?.serverInstallationMode || '';
};

/** Deployment model passed to TCO APIs; AOAG wins over first-instance Standalone on mixed hosts. */
export const getExploreSavingsDeploymentModel = (rowData: any): string => {
    if (hasExploreSavingsAoagDeployment(rowData)) {
        return SQL_DEPLOYMENT_MODE.AOAG;
    }
    const firstInstanceType = rowData?.sqlServerInstances?.[0]?.sqlServerDeploymentType;
    if (firstInstanceType) {
        return firstInstanceType.toLowerCase();
    }
    const hostMode = rowData?.serverInstallationMode;
    if (hostMode) {
        return hostMode.toLowerCase();
    }
    return SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
};

export const onClickESHost = (
    dispatch: any,
    rowData: any,
    isWorkloadFactory: boolean,
    navigate?: NavigateFunction,
    isBulk?: boolean,
    bulkServerName?: string
) => {
    const deploymentModel = getExploreSavingsDeploymentModel(rowData);

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

export const handleManualTCOOracleEBS = (dispatch: AppDispatch, isWorkloadFactory: boolean) => {
    if (isWorkloadFactory) {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: './storage-saving-calculator?type=ebs&mode=oracle-manual',
                replace: true
            }
        });
    }

    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS));
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

export const onClickESHostOnPremBulk = (
    dispatch: any,
    selectedHosts: any[],
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

    dispatch(setDisableState(true));

    // Combine storage and compute info from ALL selected hosts
    buildStoragePerfAndCompute(
        dispatch,
        selectedHosts,
        (host: any) => host?.sqlServerInstances,
        (_host: any, instance: any) => ({
            uniqueName: instance?.sqlInstanceName,
            extraFields: {
                noOfVcpusInUse: instance?.noOfVcpusInUse,
                sqlInstanceName: instance?.sqlInstanceName,
                sqlInstanceId: instance?.sqlInstanceId,
                networkPerformance: instance?.networkPerformance
            }
        })
    );

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

export const handleDeleteOnPremTco = ({
    deleteOnPremTco,
    rowData,
    currentData,
    setDataAction,
    dispatch,
    type,
    successMessage,
    errorMessage
}: {
    deleteOnPremTco: any;
    rowData: any;
    currentData: any[];
    setDataAction: any;
    dispatch: Dispatch;
    type?: string;
    successMessage: string;
    errorMessage: string;
}) => {
    const params: any = { resourceId: rowData.resourceId };
    if (type) {
        params.type = type;
    }
    deleteOnPremTco(params)
        .then((res: any) => {
            if (res && res?.data?.count === 1) {
                const updatedData = currentData.filter((item: any) => item.uniqueId !== rowData.uniqueId);
                dispatch(setDataAction(updatedData));
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: successMessage
                    })
                );
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: res?.error?.message || res?.data?.message
                    })
                );
            }
        })
        .catch((err: any) => {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: err || errorMessage
                })
            );
        });
};

export const setESInstanceData = (data: any, dispatch: any) => {
    const esDeploymentModel = getExploreSavingsDeploymentModel(data);
    let serverInstallationMode = data?.serverInstallationMode;
    if (esDeploymentModel === SQL_DEPLOYMENT_MODE.AOAG) {
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
    const { savingsCalculatorFrom, selectedOnPremHostDetails } = store.getState().exploreSavings;
    const isOracle =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;

    let instanceTypelist: any = [];
    if (selectedHostDetails?.clusterNodeDetails && selectedHostDetails?.clusterNodeDetails?.length === 2) {
        instanceTypelist = selectedHostDetails?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
    } else {
        instanceTypelist = selectedHostDetails?.topology?.ec2Details?.map((inst: any) => inst?.instanceType);
    }

    const buildInstanceEntry = (detail: any, index: number) => {
        const base: any = {
            instanceType: detail?.instanceType || instanceTypelist?.[index] || GENERAL.NOT_AVAILABLE,
            computeHourlyPrice: `$${formatNumbers(detail?.price)}`,
            computeMonthlyPrice: `$${formatNumbers(detail?.computeMonthlyPrice)}`,
            instanceMonthlyPrice: `$${formatNumberWithCustomComma(detail?.instanceMonthlyPrice)}`,
            hoursInAMonth: formatNumbers(detail?.hoursInMonth)
        };

        if (isOracle) {
            base.oracleEdition =
                licenseDetails?.oracleEdition ||
                selectedHostDetails?.oracleEdition ||
                selectedHostDetails?.databaseInstancesSummary?.[0]?.databaseServer?.serverEdition ||
                selectedOnPremHostDetails?.oracleEdition ||
                licenseDetails?.sqlServerEdition ||
                store.getState().exploreSavings.selectedManualServerEdition?.value ||
                GENERAL.NOT_AVAILABLE;
            base.oracleLicense = licenseDetails?.licenseIncluded ? 'Yes' : 'No';
        } else {
            base.sqlEdition =
                licenseDetails?.sqlServerEdition ||
                selectedHostDetails?.databaseServer?.serverEdition ||
                GENERAL.NOT_AVAILABLE;
            base.sqlLicense = licenseDetails?.licenseIncluded ? 'Yes' : 'No';
        }

        return base;
    };

    const instanceCalculationData = (() => {
        if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            return [buildInstanceEntry(computeDetails?.[0], 0)];
        }
        const detailsList: any = [];
        computeDetails?.forEach((detail: any, index: number) => {
            detailsList.push(buildInstanceEntry(detail, index));
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
            // Use recommendationOptions if available, otherwise fall back to machineDetails
            const recommendationOptions = data?.recommendedComputeCalculation?.recommendationOptions;
            const machineDetails = data?.recommendedComputeCalculation?.machineDetails;

            if (recommendationOptions && recommendationOptions.length > 0) {
                result = {
                    ...data,
                    recommendedInstance:
                        selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                            ? [recommendationOptions[0]]
                            : [recommendationOptions[0], recommendationOptions[0]]
                };
            } else {
                // Fall back to machineDetails
                result = {
                    ...data,
                    recommendedInstance: machineDetails
                };
            }
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
    const {
        selectedRowsForExploreSavingsEBSBulk,
        selectedRowsForExploreSavingsOnPremBulk,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedRowsForExploreSavingsOracleEbsBulk
    } = state.exploreSavingsBulk;

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

        // Find the compute and license data by matching hostname (EBS) or resourceName (ONPREM)
        const recommendedCompute = recommendedComputeArray?.find(
            (item: any) => item.hostname === hostName || item.resourceName === hostName
        );
        const recommendedLicense = recommendedLicenseArray?.find(
            (item: any) => item.hostname === hostName || item.resourceName === hostName
        );
        const existingCompute = existingComputeArray?.find(
            (item: any) => item.hostname === hostName || item.resourceName === hostName
        );
        const existingLicense = existingLicenseArray?.find(
            (item: any) => item.hostname === hostName || item.resourceName === hostName
        );

        const hostDeploymentType = recommendedCompute?.deploymentType || existingCompute?.deploymentType;

        // Find the matching bulk host to pass oracleEdition for View Calculations
        const bulkHost =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
                ? selectedRowsForExploreSavingsOracleEbsBulk?.find((h: any) => h.name === hostName)
                : savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM
                ? selectedRowsForExploreSavingsOracleOnPremBulk?.find((h: any) => h.resourceName === hostName)
                : savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                ? selectedRowsForExploreSavingsEBSBulk?.find((h: any) => h.name === hostName)
                : {};

        // For MSSQL AUTO_EBS bulk path, apply the user's dropdown selection (recommendedTargetInstance).
        // When no explicit selection exists, fall back to recommendationOptions[0] (the dropdown default)
        // to stay consistent with what the EBS page cost breakdown shows.
        const { recommendedTargetInstance } = store.getState().exploreSavings;
        const recommendationOptions = recommendedCompute?.recommendationOptions;
        const effectiveRecommendationOption =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                ? recommendationOptions?.find((opt: any) => opt.instanceType === recommendedTargetInstance) ||
                  recommendationOptions?.[0]
                : null;

        let fsxMachineDetailsToUse = recommendedCompute?.machineDetails;
        if (effectiveRecommendationOption) {
            const isSingleInstance = hostDeploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
            fsxMachineDetailsToUse = isSingleInstance
                ? [effectiveRecommendationOption]
                : [effectiveRecommendationOption, effectiveRecommendationOption];
        }

        const fsxMachineData = formatViewCalcInstance(
            hostDeploymentType,
            bulkHost || {},
            fsxMachineDetailsToUse,
            recommendedLicense
        );

        const ebsMachineData = formatViewCalcInstance(
            hostDeploymentType,
            bulkHost || {},
            existingCompute?.machineDetails,
            existingLicense
        );

        // Create formatted calculation arrays similar to what viewCalculation functions produce
        const createFormattedCalculation = (machineData: any[]) => {
            const machineDetailsList: any[] = [];
            const isOracle =
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS;
            const instanceTypeLabel = isOracle
                ? i18next.t('databases.explore-savings.oracle-database-type')
                : i18next.t('databases.explore-savings.sql-instance-type');
            const editionLabel = isOracle
                ? i18next.t('databases.explore-savings.oracle-edition')
                : i18next.t('databases.explore-savings.sql-edition');
            const licenseLabel = isOracle
                ? i18next.t('databases.explore-savings.oracle-license-included')
                : i18next.t('databases.explore-savings.sql-license-included');
            const licenseTooltip = isOracle ? '' : i18next.t('databases.explore-savings.sql-license-tooltip');

            machineData?.forEach((calculation: any, index: number) => {
                machineDetailsList.push(
                    { label: `Machine ${index + 1} specification` },
                    {
                        label: instanceTypeLabel,
                        value: calculation?.instanceType,
                        text: ''
                    },
                    {
                        label: editionLabel,
                        value: isOracle ? calculation?.oracleEdition : calculation?.sqlEdition,
                        text: ''
                    },
                    {
                        label: licenseLabel,
                        value: isOracle ? calculation?.oracleLicense : calculation?.sqlLicense,
                        text: ''
                    },
                    { label: `Machine ${index + 1} pricing calculations` },
                    {
                        label: 'Instance hourly price',
                        value: calculation?.computeHourlyPrice,
                        text: licenseTooltip
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
            deploymentType: hostDeploymentType,
            fsxInstanceCalculation: createFormattedCalculation(fsxMachineData),
            ebsInstanceCalculation: createFormattedCalculation(ebsMachineData),
            recommendedCompute,
            recommendedLicense,
            existingCompute,
            existingLicense
        };
    };

    // Create host-specific data for bulk calculations
    const hostCalculationData = (() => {
        if (!isBulkCalculation) return [];

        // For Oracle on-prem, use Oracle bulk selection or single host fallback
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            if (selectedRowsForExploreSavingsOracleOnPremBulk?.length > 1) {
                return selectedRowsForExploreSavingsOracleOnPremBulk
                    .map((host: any) => createHostInstanceCalculationData(host.resourceName))
                    .filter(Boolean);
            }
            const { selectedOnPremHostDetails } = state.exploreSavings;
            if (selectedOnPremHostDetails?.resourceName) {
                const hostData = createHostInstanceCalculationData(selectedOnPremHostDetails.resourceName);
                return hostData ? [hostData] : [];
            }
            return [];
        }

        // For Oracle EBS, use Oracle EBS bulk selection
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) {
            return selectedRowsForExploreSavingsOracleEbsBulk
                .map((host: any) => createHostInstanceCalculationData(host.name))
                .filter(Boolean);
        }

        // For MSSQL ONPREM, use selectedRowsForExploreSavingsOnPremBulk
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            return selectedRowsForExploreSavingsOnPremBulk
                .map((host: any) => createHostInstanceCalculationData(host.resourceName))
                .filter(Boolean);
        }

        // For AUTO_EBS, use selectedRowsForExploreSavingsEBSBulk
        return selectedRowsForExploreSavingsEBSBulk
            .map((host: any) => createHostInstanceCalculationData(host.name))
            .filter(Boolean);
    })();

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
            const { recommendedTargetInstance } = state.exploreSavings;
            recommendedComputeArray?.forEach((compute: any) => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
                    const effectiveRecommendationOption =
                        compute?.recommendationOptions?.find(
                            (opt: any) => opt.instanceType === recommendedTargetInstance
                        ) || compute?.recommendationOptions?.[0];
                    if (effectiveRecommendationOption) {
                        const isSingle =
                            compute?.deploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                        cost += Number(effectiveRecommendationOption?.instanceMonthlyPrice || 0) * (isSingle ? 1 : 2);
                    } else {
                        compute?.machineDetails?.forEach((instance: any) => {
                            cost += Number(instance?.instanceMonthlyPrice || 0);
                        });
                    }
                } else {
                    compute?.machineDetails?.forEach((instance: any) => {
                        cost += Number(instance?.instanceMonthlyPrice || 0);
                    });
                }
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
            const { recommendedTargetInstance } = state.exploreSavings;
            recommendedComputeArray?.forEach((compute: any) => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
                    const effectiveRecommendationOption =
                        compute?.recommendationOptions?.find(
                            (opt: any) => opt.instanceType === recommendedTargetInstance
                        ) || compute?.recommendationOptions?.[0];
                    if (effectiveRecommendationOption) {
                        const isSingle =
                            compute?.deploymentType?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                        cost += Number(effectiveRecommendationOption?.instanceMonthlyPrice || 0) * (isSingle ? 1 : 2);
                    } else {
                        compute?.machineDetails?.forEach((instance: any) => {
                            cost += Number(instance?.instanceMonthlyPrice || 0);
                        });
                    }
                } else {
                    compute?.machineDetails?.forEach((instance: any) => {
                        cost += Number(instance?.instanceMonthlyPrice || 0);
                    });
                }
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
    let ebsSnapshotCalculation: {
        amountChangedPerSnapshot: number;
        storageAmount: number;
        storageAmountPerMonth: number;
        storageAmountPerMonthList: string[];
        monthlyCostOfSnapshots: number;
        ebsInstanceMonth: number;
        totalSnapshots: number;
        initialSnapshotCost: number;
        monthlyCostPerSnapshot: number;
        discountForPartialStorageMonth: number;
        incrementalSnapshotCost: number;
        totalSnapshotCost: number;
        totalEbsSnapshotCost: number;
        ebsSnapshotCost: number;
        ebsSnapshotPrice: number;
    } = {
        amountChangedPerSnapshot: 0,
        storageAmount: 0,
        storageAmountPerMonth: 0,
        storageAmountPerMonthList: [],
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
        const volumeStorageAmount = viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.storageAmount || 0;
        ebsSnapshotCalculation = {
            amountChangedPerSnapshot:
                ebsSnapshotCalculation.amountChangedPerSnapshot +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.amountChangedPerSnapshot,
            storageAmountPerMonth: ebsSnapshotCalculation.storageAmountPerMonth + volumeStorageAmount,
            storageAmountPerMonthList: [
                ...ebsSnapshotCalculation.storageAmountPerMonthList,
                formatCalcSize(volumeStorageAmount)
            ],
            storageAmount:
                ebsSnapshotCalculation.storageAmount +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.storageAmount,
            monthlyCostOfSnapshots:
                ebsSnapshotCalculation.monthlyCostOfSnapshots +
                viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.monthlyCostOfSnapshots,
            ebsInstanceMonth:
                ebsSnapshotCalculation.ebsInstanceMonth +
                    viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsInstanceMonth || 0,
            totalSnapshots: viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.totalSnapshots || 0,
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
            ebsSnapshotPrice: viewCalculationsResponse?.ebsSnapshotCalculation?.[key]?.ebsSnapshotPrice?.price || 0
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

    // Build per-volume snapshot data
    const perVolumeSnapshotData: any = {};
    Object.keys(viewCalculationsResponse?.ebsSnapshotCalculation || {}).forEach((key: string) => {
        const volumeData = viewCalculationsResponse?.ebsSnapshotCalculation?.[key];
        if (volumeData?.totalEbsSnapshotCost) {
            perVolumeSnapshotData[key] = {
                storageAmount: formatCalcSize(volumeData?.storageAmount),
                numberOfVolumes: formatNumbers(volumeData?.numberOfVolumes),
                ebsSnapshotPrice: volumeData?.ebsSnapshotPrice,
                amountChangedPerSnapshot: formatCalcSize(volumeData?.amountChangedPerSnapshot),
                monthlyCostOfSnapshots: formatNumbers(volumeData?.monthlyCostOfSnapshots),
                monthlyChangeRatePercentage: volumeData?.monthlyChangeRatePercentage,
                ebsInstanceMonth: formatNumbers(volumeData?.ebsInstanceMonth),
                totalSnapshots: formatNumbers(volumeData?.totalSnapshots),
                initialSnapshotCost: formatNumbers(volumeData?.initialSnapshotCost),
                monthlyCostPerSnapshot: formatNumbers(volumeData?.monthlyCostPerSnapshot),
                discountForPartialStorageMonth: formatNumbers(volumeData?.discountForPartialStorageMonth),
                incrementalSnapshotCost: formatNumbers(volumeData?.incrementalSnapshotCost),
                totalSnapshotCost: formatNumbers(volumeData?.totalSnapshotCost),
                totalEbsSnapshotCost: formatNumbers(volumeData?.totalEbsSnapshotCost),
                ebsSnapshotCost: formatNumbers(volumeData?.ebsSnapshotCost)
            };
        }
    });

    return {
        ebsCalculation: EbsCalculationUpdates(viewCalculationsResponse?.ebsCalculation || {}),
        ebsSnapshotCalculation: {
            amountChangedPerSnapshot: formatCalcSize(ebsSnapshotCalculation?.amountChangedPerSnapshot),
            storageAmountPerMonth: formatCalcSize(ebsSnapshotCalculation?.storageAmountPerMonth),
            storageAmountPerMonthList: ebsSnapshotCalculation?.storageAmountPerMonthList,
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
            totalEbsSnapshotCostValue: ebsSnapshotCalculation?.ebsSnapshotCost,
            // Per-volume snapshot data
            ...perVolumeSnapshotData
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

        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM
        ) {
            // Handle ONPREM/ORACLE_ONPREM mode with array format for compute and license (similar to EBS bulk)
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
        } else if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
        ) {
            // Handle AUTO_EBS and ORACLE_AUTO_EBS mode with array format for compute and license
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

                // Update compute array to have the selected instanceType
                const updatedComputeArray = computeArray.map((computeObj: any) => ({
                    ...computeObj,
                    recommended: {
                        ...computeObj.recommended,
                        instanceType: recommendedTargetInstance
                    }
                }));

                result = {
                    ...data,
                    compute: updatedComputeArray as any,
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
                // Use recommendationOptions for correct pricing
                let totalRecommendedComputePrice = 0;
                let totalRecommendedLicensePrice = 0;

                computeArray.forEach((computeObj: any) => {
                    const isAOAG = deploymentModelValue.toLowerCase() !== SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE;
                    const multiplier = isAOAG ? 2 : 1;

                    const recommendationOptions = computeObj?.recommended?.recommendationOptions;
                    // Use recommendationOptions[0] if available, otherwise fall back to recommended compute price
                    const computePrice =
                        recommendationOptions?.length > 0
                            ? Number(recommendationOptions[0]?.computeMonthlyPrice || 0)
                            : Number(computeObj?.recommended?.computeMonthlyPrice || 0);
                    totalRecommendedComputePrice += computePrice * multiplier;
                });

                licenseArray.forEach((licenseObj: any) => {
                    totalRecommendedLicensePrice += Number(licenseObj?.recommended?.licenseMonthlyPrice || 0);
                });

                // Get instance data from recommendationOptions if available, otherwise from machineDetails
                const firstComputeRecommendationOptions = computeArray[0]?.recommended?.recommendationOptions;
                const baseInstanceData =
                    firstComputeRecommendationOptions?.length > 0
                        ? firstComputeRecommendationOptions[0]
                        : computeArray[0]?.recommended?.machineDetails?.[0] || {};

                result = {
                    ...data,
                    recommendedInstance: {
                        ...baseInstanceData,
                        licenseMonthlyPrice: totalRecommendedLicensePrice,
                        computeMonthlyPrice: totalRecommendedComputePrice
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

const getRegisterItemForAuthRow = (result: any, row: any) => {
    const ec2InstanceId = getExploreSavingsEc2InstanceId(row);
    return result?.data?.items?.find(
        (item: any) =>
            item.ec2InstanceId === ec2InstanceId &&
            item.region === row?.regionId &&
            item.credentialsId === row?.credentialId
    );
};

const isRegisterItemAuthSuccess = (registerItem: any): boolean => {
    if (!registerItem?.registerDetails?.length) {
        return false;
    }
    if (isMissingSqlPermissions(registerItem.registerDetails)) {
        return false;
    }
    return !registerItem.registerDetails.some((detail: any) => detail?.databaseServerError || detail?.fsxnError);
};

const buildMssqlBannerAuthPayloadItems = (
    rowsToAuthenticate: any[],
    selectedExploreSavingsTabFileSystemType: string,
    selectedAuthenticationType: string | null,
    userName: string,
    password: string,
    ssmParameterArn: string,
    isGovAccount: boolean,
    includeAllInstancesForRow: (row: any) => boolean = () => false
) =>
    rowsToAuthenticate
        .map((row: any) => {
            const includeAllInstances = includeAllInstancesForRow(row);
            const credentialList: any[] = [];

            row?.sqlServerInstances?.forEach((instance: any) => {
                const needsAuth =
                    includeAllInstances ||
                    isAuthRequiredForInstance(instance, DBType.MSSQL) ||
                    isMissingSqlPermissions([instance]);

                if (!needsAuth) {
                    return;
                }

                // When not registering every instance, skip ones explicitly tied to another storage tab
                if (
                    !includeAllInstances &&
                    instance?.fileSystemType &&
                    instance.fileSystemType !== selectedExploreSavingsTabFileSystemType
                ) {
                    return;
                }

                const resourceType =
                    selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                        ? DETECT_HOST_VAR.MSSQL
                        : DETECT_HOST_VAR.WINDOWS;

                if (isGovAccount) {
                    credentialList.push({
                        resourceId: instance?.databaseInstanceName,
                        resourceType,
                        ssmParameterArn
                    });
                } else {
                    credentialList.push({
                        resourceId: instance?.databaseInstanceName,
                        resourceType,
                        username: userName,
                        password
                    });
                }
            });

            if (credentialList.length === 0) {
                return null;
            }

            return {
                credentials: credentialList,
                checkManageReadiness: true,
                ec2InstanceId: getExploreSavingsEc2InstanceId(row),
                region: row?.regionId,
                credentialsId: row?.credentialId
            };
        })
        .filter(Boolean);

const exploreSavingsHostKey = (row: any): string =>
    `${getExploreSavingsEc2InstanceId(row)}_${row?.credentialId}_${row?.regionId}`;

const closePartialDataBannerAuthDialog = (dispatch: Dispatch, closeDialogCallback: () => void) => {
    dispatch(resetDialogComponent());
    dispatch(resetServerDetailsCredentials());
    dispatch(resetBulkAuthCredentialsAndStatus());
    closeDialogCallback();
};

const refreshExploreSavingsAfterBannerAuth = (dispatch: Dispatch, successfulRows: any[]) => {
    if (successfulRows.length === 0) {
        return;
    }

    dispatch(setInstanceDataUpdatedTrigger(exploreSavingsHostKey(successfulRows[0])));
    dispatch(setTriggerBulkDataFetch(true));
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
    isFromAddHosts: boolean = false,
    authOptions?: { isOracle?: boolean; fromPartialDataBanner?: boolean; rowsToAuthenticate?: any[] }
) => {
    try {
        dispatch(setActionsDisabled(true));
        const state = store.getState();
        const {
            selectedAuthenticationType,
            serverDetails: { userName, password, ssmParameterArn }
        } = state.exploreSavings;
        const { isGovAccount } = state.auth;
        const { selectedRowsForExploreSavingsEBSBulk, bulkAuthCredentials, rowsRequiringAuthBulk } =
            state.exploreSavingsBulk;

        if (authOptions?.fromPartialDataBanner) {
            // Partial-data banner path: single-cred AuthDialog, not bulk-per-host AuthBulkDialog.
            const isOracle = !!authOptions?.isOracle;
            // Banner may pass multiple hosts; fall back to the row that opened the dialog.
            const rowsToAuthenticate =
                authOptions.rowsToAuthenticate && authOptions.rowsToAuthenticate.length > 0
                    ? authOptions.rowsToAuthenticate
                    : [rowData];
            // ssmDoc-only hosts need every instance registered; other hosts only send instances that need auth.
            const includeAllInstancesForBannerRow = (row: any) => shouldIncludeAllInstancesForBannerRow(row, isOracle);
            // Build per-host bulk-register payload; Oracle and MSSQL use different instance/credential shapes.
            const payloadItems = isOracle
                ? rowsToAuthenticate
                      .map((row: any) => {
                          const credentialList = buildOracleCredentialListForRow(
                              row,
                              userName,
                              password,
                              ssmParameterArn,
                              isGovAccount,
                              includeAllInstancesForBannerRow(row)
                          );
                          if (credentialList.length === 0) {
                              return null;
                          }
                          return {
                              credentials: credentialList,
                              checkManageReadiness: true,
                              ec2InstanceId: getExploreSavingsEc2InstanceId(row),
                              region: row?.regionId,
                              credentialsId: row?.credentialId
                          };
                      })
                      .filter(Boolean)
                : buildMssqlBannerAuthPayloadItems(
                      rowsToAuthenticate,
                      selectedExploreSavingsTabFileSystemType,
                      selectedAuthenticationType,
                      userName,
                      password,
                      ssmParameterArn,
                      isGovAccount,
                      includeAllInstancesForBannerRow
                  );

            if (payloadItems.length === 0) {
                dispatch(
                    setDialogErrorWithTooltip({
                        showDialogError: true,
                        errorMessage: t('databases.explore-savings.authentication-failed'),
                        showTooltipInfo: true,
                        tooltipText: t('databases.general.action-required')
                    })
                );
                return;
            }

            const result = await registerResourceCredBulk({ payload: { items: payloadItems } });
            if (result && !result?.error && result?.data) {
                const successfulRows: any[] = [];
                const failedRows: any[] = [];

                // Match each submitted host to its register response item by ec2/region/credential.
                rowsToAuthenticate.forEach((row: any) => {
                    const registerItem = getRegisterItemForAuthRow(result, row);

                    if (isRegisterItemAuthSuccess(registerItem)) {
                        updateInventoryTable(
                            row,
                            selectedExploreSavingsTabFileSystemType,
                            dispatch,
                            { data: { items: [registerItem] } },
                            isOracle
                        );
                        successfulRows.push(row);
                    } else {
                        failedRows.push(row);
                    }
                });

                // Re-fetch instance data + TCO for hosts that cleared auth (MSSQL or Oracle API components pick this up).
                if (successfulRows.length > 0) {
                    refreshExploreSavingsAfterBannerAuth(dispatch, successfulRows);
                }

                if (failedRows.length === 0) {
                    dispatch(addPartialDataBannerAuthedHostKeys(successfulRows.map(exploreSavingsHostKey)));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message:
                                rowsToAuthenticate.length > 1
                                    ? t('databases.explore-savings.partial-data-banner-auth-success-multiple', {
                                          count: rowsToAuthenticate.length
                                      })
                                    : t('databases.explore-savings.partial-data-banner-auth-success-single', {
                                          hostName: rowData?.name
                                      })
                        })
                    );
                    dispatch(resetRowsRequiringAuthBulk());
                    closePartialDataBannerAuthDialog(dispatch, closeDialogCallback);
                    return;
                }

                // Partial success: remember failed hosts so retry can target only those.
                dispatch(addPartialDataBannerAuthedHostKeys(successfulRows.map(exploreSavingsHostKey)));
                dispatch(setRowsRequiringAuthBulk(failedRows));

                if (successfulRows.length > 0) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: t('databases.explore-savings.partial-data-banner-auth-partial-success', {
                                authenticated: successfulRows.length,
                                total: rowsToAuthenticate.length
                            })
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: t('databases.explore-savings.authentication-failed')
                        })
                    );
                }

                closePartialDataBannerAuthDialog(dispatch, closeDialogCallback);
                return;
            }
            // Bulk register API failed entirely — surface server message in the dialog.
            dispatch(
                setDialogErrorWithTooltip({
                    showDialogError: true,
                    errorMessage: t('databases.explore-savings.authentication-failed'),
                    showTooltipInfo: true,
                    // @ts-ignore
                    tooltipText: result?.error?.data?.message || t('databases.explore-savings.authentication-failed')
                })
            );

            return;
        }

        // Determine if this is a bulk operation
        const isBulkOperation =
            !authOptions?.fromPartialDataBanner &&
            selectedRowsForExploreSavingsEBSBulk &&
            selectedRowsForExploreSavingsEBSBulk.length > 0;

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
                const credentialList: any[] = [];

                const hostCredentials = bulkAuthCredentials[row.name];

                row?.sqlServerInstances?.forEach((instance: any) => {
                    if (instance?.fileSystemType === selectedExploreSavingsTabFileSystemType) {
                        const resourceType =
                            selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                ? DETECT_HOST_VAR.MSSQL
                                : DETECT_HOST_VAR.WINDOWS;

                        if (isGovAccount) {
                            credentialList.push({
                                resourceId: instance?.databaseInstanceName,
                                resourceType,
                                ssmParameterArn: hostCredentials?.ssmParameterArn || ''
                            });
                        } else {
                            credentialList.push({
                                resourceId: instance?.databaseInstanceName,
                                resourceType,
                                username: hostCredentials?.userName || '',
                                password: hostCredentials?.password || ''
                            });
                        }
                    }
                });

                if (credentialList.length > 0) {
                    payloadItems.push({
                        credentials: credentialList,
                        checkManageReadiness: true,
                        ec2InstanceId: getExploreSavingsEc2InstanceId(row),
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
                    const registerItem = getRegisterItemForAuthRow(result, row);

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

            const credentialList: any[] = [];

            matchedInstances?.forEach((instance: any) => {
                const resourceType =
                    selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                        ? DETECT_HOST_VAR.MSSQL
                        : DETECT_HOST_VAR.WINDOWS;

                if (isGovAccount) {
                    credentialList.push({
                        resourceId: instance?.databaseInstanceName,
                        resourceType,
                        ssmParameterArn
                    });
                } else {
                    credentialList.push({
                        resourceId: instance?.databaseInstanceName,
                        resourceType,
                        username: userName,
                        password
                    });
                }
            });
            const credList = {
                credentials: credentialList,
                checkManageReadiness: true
            };

            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId: getExploreSavingsEc2InstanceId(rowData),
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
                    if (!authOptions?.fromPartialDataBanner) {
                        onClickESHost(dispatch, rowData, isWorkloadFactory, navigate);
                    }
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
    result: any,
    isOracle = false
) => {
    const state = store.getState();
    const { inventoryTableData } = state.inventoryV2;
    const { selectedAuthenticationType } = state.exploreSavings;
    const updatedInventoryTableData: Record<string, DiscoverHostInterface> = {
        ...inventoryTableData
    } as Record<string, DiscoverHostInterface>;

    if (isOracle) {
        const registerDetails = result?.data?.items?.[0]?.registerDetails || [];
        updatedInventoryTableData[rowData.id] = {
            ...(updatedInventoryTableData[rowData.id] as DiscoverHostInterface),
            isDetected: true,
            databaseInstanceDetails:
                updatedInventoryTableData[rowData.id]?.databaseInstanceDetails?.map(instance => {
                    const instanceId = getOracleInstanceId(instance);
                    const registerDetail = registerDetails.find(
                        (detail: any) => detail?.databaseInstanceName === instanceId
                    );

                    return {
                        ...instance,
                        oracleServerAuthentication: true,
                        asmAuthentication:
                            instance?.isInstanceStorageAsmManaged === true ? true : instance?.asmAuthentication,
                        manageReadiness: registerDetail?.manageReadiness || (instance as any)?.manageReadiness
                    };
                }) ?? []
        };
        dispatch(setInventoryTableData(updatedInventoryTableData));
        return;
    }

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
    if (!rowData?.isDetected) {
        return true;
    }

    const instances = rowData.sqlServerInstances || [];
    if (instances.length === 0) {
        return false;
    }

    return instances.some(
        (instance: any) => isAuthRequiredForInstance(instance, DBType.MSSQL) || isMissingSqlPermissions([instance])
    );
};

// For bulk actions: evaluate an array of rowData and return an array of rows that require auth
export const shouldAuthDialogOpenBulk = (rows: any[] = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.filter(row => shouldAuthDialogOpen(row));
};

const getOracleDatabaseInstancesFromRow = (rowData: any): any[] => rowData?.databaseInstanceDetails || [];

const getOracleInstanceId = (instance: any): string => instance?.databaseInstanceName || instance?.instanceName || '';

const buildOracleCredentialListForRow = (
    row: any,
    userName: string,
    password: string,
    ssmParameterArn: string,
    isGovAccount: boolean,
    includeAllInstances = false
): any[] => {
    const credentialList: any[] = [];

    getOracleDatabaseInstancesFromRow(row).forEach((instance: any) => {
        const instanceId = getOracleInstanceId(instance);
        if (!instanceId) {
            return;
        }

        const needsAuth =
            includeAllInstances ||
            isAuthRequiredForInstance(instance, DBType.ORACLE) ||
            isMissingSqlPermissions([instance]);

        if (!needsAuth) {
            return;
        }

        credentialList.push(
            isGovAccount
                ? { resourceId: instanceId, resourceType: DETECT_HOST_VAR.ORACLE, ssmParameterArn }
                : { resourceId: instanceId, resourceType: DETECT_HOST_VAR.ORACLE, username: userName, password }
        );
    });

    return credentialList;
};

export const shouldAuthDialogOpenOracle = (rowData: any) => {
    if (!rowData?.isDetected) {
        return true;
    }

    const instances = getOracleDatabaseInstancesFromRow(rowData);
    if (instances.length === 0) {
        return false;
    }

    return instances.some(
        (instance: any) => isAuthRequiredForInstance(instance, DBType.ORACLE) || isMissingSqlPermissions([instance])
    );
};

export const shouldAuthDialogOpenForExploreSavings = (rowData: any, isOracle = false) =>
    isOracle ? shouldAuthDialogOpenOracle(rowData) : shouldAuthDialogOpen(rowData);

export const shouldAuthDialogOpenBulkForExploreSavings = (rows: any[] = [], isOracle = false) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.filter(row => shouldAuthDialogOpenForExploreSavings(row, isOracle));
};

const hasPartialExploreSavingsPermission = (hostManageReadiness?: HostManageReadiness): boolean =>
    canEnableExploreSavingsWithoutRegistration(hostManageReadiness) &&
    hostManageReadiness?.extensiveRunPermission !== true;

const shouldIncludeAllInstancesForBannerRow = (row: any, isOracle: boolean): boolean =>
    hasPartialExploreSavingsPermission(row?.hostManageReadiness) &&
    !(isOracle ? shouldAuthDialogOpenOracle(row) : shouldAuthDialogOpen(row));

const needsExploreSavingsAuthFromBanner = (host: any, savingsCalculatorFrom?: string | null): boolean => {
    const authedKeys = store.getState().exploreSavingsBulk.partialDataBannerAuthedHostKeys || [];
    if (authedKeys.includes(exploreSavingsHostKey(host))) {
        return false;
    }
    if (hasPartialExploreSavingsPermission(host?.hostManageReadiness)) {
        return true;
    }
    const isOracle = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    return isOracle ? shouldAuthDialogOpenOracle(host) : shouldAuthDialogOpen(host);
};

export const getPartialDataBannerAuthHosts = (hosts: any[] = [], savingsCalculatorFrom?: string | null): any[] => {
    if (!Array.isArray(hosts) || hosts.length === 0) {
        return [];
    }
    return hosts.filter(host => needsExploreSavingsAuthFromBanner(host, savingsCalculatorFrom));
};

/** Auto TCO modes that may show the partial-data banner (MSSQL EBS, FSx for Windows, Oracle EBS). */
export const isFsxOntapExploreSavingsMode = (savingsCalculatorFrom?: string | null): boolean =>
    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
    savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;

export const canEnableExploreSavingsWithoutRegistration = (hostManageReadiness?: HostManageReadiness): boolean =>
    hostManageReadiness?.extensiveRunPermission === true || hostManageReadiness?.canReadAWSSSMDocuments === true;

export const getExploreSavingsFileSystemType = (savingsCalculatorFrom?: string | null): string =>
    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ? STORAGE_TYPES.FSX_FOR_WINDOWS : DETECT_HOST_VAR.EBS;

export const getExploreSavingsSelectedHostsForPartialData = ({
    savingsCalculatorFrom,
    selectedRowsForExploreSavingsEBSBulk,
    selectedRowsForExploreSavingsOracleEbsBulk,
    selectedHostDetails
}: {
    savingsCalculatorFrom?: string | null;
    selectedRowsForExploreSavingsEBSBulk?: any[];
    selectedRowsForExploreSavingsOracleEbsBulk?: any[];
    selectedHostDetails?: any;
}): any[] => {
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) {
        return selectedRowsForExploreSavingsOracleEbsBulk || [];
    }
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
        return selectedRowsForExploreSavingsEBSBulk || [];
    }
    if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) {
        return selectedHostDetails ? [selectedHostDetails] : [];
    }
    return [];
};

export const shouldShowExploreSavingsPartialDataBanner = (
    hosts: any[],
    savingsCalculatorFrom?: string | null
): boolean => {
    if (!isFsxOntapExploreSavingsMode(savingsCalculatorFrom) || hosts.length === 0) {
        return false;
    }
    return hosts.some(host => needsExploreSavingsAuthFromBanner(host, savingsCalculatorFrom));
};

export const shouldShowExploreSavingsAuthLink = (hosts: any[], savingsCalculatorFrom?: string | null): boolean => {
    if (!isFsxOntapExploreSavingsMode(savingsCalculatorFrom) || hosts.length === 0) {
        return false;
    }
    return hosts.some(host => needsExploreSavingsAuthFromBanner(host, savingsCalculatorFrom));
};
