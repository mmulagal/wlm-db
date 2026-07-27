import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressSync } from 'fflate';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useGetConnectorsMutation,
    useGetDiscoverInstanceResultMutation,
    useGetOneTimeWADDownloadScriptMutation,
    useGetOneTimeWADUploadScriptMutation,
    useGetOrganizationIdsMutation,
    useGetWorkSpaceIDMutation,
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery,
    useLazyGetAllOfflineOracleHostsAssessmentDataQuery,
    useLazyGetOfflineMssqlAssessmentDatabasesQuery,
    useLazyGetSubTaskListQuery,
    useListExistingHostsMutation,
    useUnmanageMssqlInstanceMutation,
    useUnmanageOracleInstanceMutation,
    useUnmanagePgsqlInstanceMutation
} from '../../../../utils/apiService';
import {
    getDeregisterContent,
    instanceExtraDataUpdate,
    manageActionCol,
    uniqueHostRow,
    updateInstanceStatus,
    hasFullPermission,
    isUnregisteredInventoryRow,
    getFsxLinkRequiredMessageKey,
    getRegistrationRequiresFullPermissionMessageKey
} from '../../InventoryUtilsV2';
import { isSmbProtocol } from '../../../../utils/utilityFunctions';
import {
    ACTION_CTA,
    DBType,
    INVENTORY_STATUS,
    JOB_MONITORING_STATUS,
    WLF_TABS
} from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import store from '../../../../store/store';

import {
    setInProgressInstances,
    setInventoryTableData,
    setRegisterHostType,
    setRegistrationWizardData,
    setSelectedFilterValue,
    setSelectedMultiDetectInstances,
    setSelectedRowsForBulkRegister,
    setTableManageColumnState,
    setWizardOperationType,
    incrementMssqlInstancesTabVisitCount
} from '../../../../store/workloadFactory/inventoryV2Slice';

import { updateOrgId } from '../../../../store/authSlice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    setGwPageLoadInstanceData,
    setLandingFrom,
    setOptimizingData
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import styles from '../InventoryTable.module.scss';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { useTable } from '../../../../common/Lib/Table/useTable';
import {
    upsertProtectionHosts,
    upsertInstanceProtectionBatch,
    setWorkSpaceData,
    setSelectedAgent
} from '../../../../store/workloadFactory/snapcenterSlice';
import {
    resetAgenticPreCheckData,
    resetEiData,
    setLogAnalyzerState
} from '../../../../store/workloadFactory/agenticAISlice';
import { useSnapCenterProtectionFlow } from '../../useSnapCenterProtectionFlow';
import { getInstanceTableColumns } from './InstanceTableColumns';
import { mssqlInstanceColumnFilterMap } from './MssqlInstanceColumnList';
import { oracleDatabaseColumnFilterMap } from './OracleDatabaseColumnsList';
import { pgsqlInstanceColumnFilterMap } from './PgsqlInstanceColumnList';
import { getInitialInstanceTableColState } from '../../../../utils/manageColumnUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';

import {
    getInstableTableTopMenuOptions,
    getInstanceTableMenuOptions,
    handleInstanceMenuSelection,
    inventoryBannerFilterUpdates,
    isInstanceActionDisabled,
    isRowSelectableForBulkRegister,
    getDisabledSelectionTooltip,
    shouldEnableHeaderCheckbox,
    MAX_BULK_REGISTER_SELECTION,
    isOracleDataGuard,
    refreshOfflineAssessmentData,
    refreshOfflineMssqlDatabasesData,
    refreshOfflineOracleAssessmentData,
    handleWadOptimizeAction,
    handleWadViewDatabasesAction,
    handleOracleWadOptimizeAction,
    autoSelectRegionInHeaderFilter
} from './InstanceTableHelper';

import IntroductionWADCard, { HIDE_WAD_CARD_KEY } from './IntroductionWADCard/IntroductionWADCard';
import OneTimeWADDialogContent from './OneTimeWADDialogContent/OneTimeWADDialogContent';

const InstancesTable = () => {
    const { t } = useTranslation();

    const { instanceTableRows, tableManageColumnState, selectedRowsForBulkRegister, mssqlInstancesTabVisitCount } =
        useAppSelector(state => state.inventoryV2);

    const buttonRef: any = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_WAD_CARD_VISITS = 3;
    const shouldShowWADCard =
        mssqlInstancesTabVisitCount < MAX_WAD_CARD_VISITS && localStorage.getItem(HIDE_WAD_CARD_KEY) !== 'true';
    // Card should only be shown for the first 3 visits to MSSQL instances tab
    const [isCardOpen, setIsCardOpen] = useState(shouldShowWADCard);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const {
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        selectedHostType,
        selectedInventoryTab,
        selectedFilterValue
    } = useAppSelector(state => state.inventoryV2);
    const { multiDataLoading, regionMapping, headerSelectedMultiRegion, headerSelectedMultiRegionIdsList, getRegions } =
        useAppSelector(state => state.headers);
    const { instanceProtection } = useAppSelector(state => state.snapCenter);
    const orgId = useAppSelector(state => state.auth?.orgId);
    const {
        notRegisteredSQLView,
        notActiveSQLInstancesView,
        notActiveOracleDatabasesView,
        notRegisteredOracleDatabasesView,
        notOptimizedSQLInstancesView,
        notOptimizedOracleDatabaseView
    } = useAppSelector(state => state.inventoryBannerSlice);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const [loading, setLoading] = useState(false);

    const menuOpenedRowDetail: any = useRef(null);
    const inventoryTableRef = useRef<HTMLDivElement>(null);
    const hasShownDataGuardNotification = useRef(false);
    const { setDialog, closeDialog } = useDialog();
    const { startProtection: handleProtection, startEditProtection: handleEditProtection } =
        useSnapCenterProtectionFlow(setDialog, closeDialog, { dialogType: 'instance' });
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [unmanageApiPgsql] = useUnmanagePgsqlInstanceMutation();
    const [unmanageApiOracle] = useUnmanageOracleInstanceMutation();
    const [getConnector] = useGetConnectorsMutation();
    const [getWorkSpaceID] = useGetWorkSpaceIDMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [getDiscoverInstanceResult] = useGetDiscoverInstanceResultMutation();
    const [getOrganizationIds] = useGetOrganizationIdsMutation();
    const [getOneTimeWADDownloadScript] = useGetOneTimeWADDownloadScriptMutation();
    const [getOneTimeWADUploadScript] = useGetOneTimeWADUploadScriptMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [getAllOfflineAssessmentAPI] = useLazyGetAllOfflineMssqlHostsAssessmentDataQuery();
    const [getAllOfflineOracleAssessmentAPI] = useLazyGetAllOfflineOracleHostsAssessmentDataQuery();
    const [getOfflineMssqlDatabasesAPI] = useLazyGetOfflineMssqlAssessmentDatabasesQuery();

    const { title, exportToCsvFileName, buttonText } = getInstableTableTopMenuOptions(selectedHostType, t);

    // Track visits to MSSQL instances tab and control WAD card visibility
    const hasIncrementedVisit = useRef(false);
    useEffect(() => {
        if (selectedHostType === DBType.MSSQL && !hasIncrementedVisit.current) {
            hasIncrementedVisit.current = true;
            dispatch(incrementMssqlInstancesTabVisitCount());
            // Update card visibility based on the NEW count (after increment)
            setIsCardOpen(
                mssqlInstancesTabVisitCount < MAX_WAD_CARD_VISITS && localStorage.getItem(HIDE_WAD_CARD_KEY) !== 'true'
            );
        }
    }, [selectedHostType, dispatch, mssqlInstancesTabVisitCount]);

    // Reset increment tracking when switching away from MSSQL
    useEffect(() => {
        if (selectedHostType !== DBType.MSSQL) {
            hasIncrementedVisit.current = false;
        }
    }, [selectedHostType]);

    // Prefetch SnapCenter hosts and instances to decide Protect/Edit Protection
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const aiAnalysisEnabled = useAppSelector(state => state.auth.aiAnalysisEnabled);
    const protectionPrefetchRun = useRef(false);
    useEffect(() => {
        if (protectionPrefetchRun.current || isDemoMode || isGovAccount) return;
        protectionPrefetchRun.current = true;

        (async () => {
            try {
                let organizationId: string = orgId || '';
                if (isWorkloadFactory && !organizationId) {
                    const orgRes: any = await getOrganizationIds({ selfErrorHandling: true });
                    const resolved = orgRes?.data?.items?.find(
                        (i: any) => i?.legacyId === store.getState().auth.accountId
                    )?.ownerOrganizationId;
                    if (resolved) {
                        organizationId = resolved;
                        dispatch(updateOrgId(resolved));
                    } else {
                        return;
                    }
                }
                const hostsRes: any = await listExistingHosts({ accountID: organizationId, selfErrorHandling: true });
                const hosts: any[] = hostsRes?.data?.hosts || [];
                if (hosts.length) {
                    dispatch(upsertProtectionHosts(hosts));
                }

                const [workSpaceRes, connectorsRes] = await Promise.all([
                    getWorkSpaceID({ accountID: organizationId, selfErrorHandling: true }),
                    getConnector({ accountID: organizationId, selfErrorHandling: true })
                ]);
                const workspaceItem = workSpaceRes?.data?.items?.[0];
                const workspaceID = workspaceItem?.id;
                if (workspaceItem) {
                    dispatch(setWorkSpaceData(workspaceItem));
                }
                const occms: any[] = connectorsRes?.data?.occms || [];
                const activeAws = occms.find((o: any) => o?.agent?.status === 'active' && o?.agent?.provider === 'aws');
                const agentID = activeAws?.agent?.agentId;
                if (agentID) {
                    dispatch(setSelectedAgent([{ id: agentID }]));
                }

                if (!workspaceID || !agentID || !hosts.length) return;

                const hostNames = hosts.map(h => h?.name).filter(Boolean);
                await Promise.allSettled(
                    hostNames.map(name =>
                        getDiscoverInstanceResult({
                            accountID: organizationId,
                            name,
                            agentID,
                            workspaceID,
                            selfErrorHandling: true
                        })
                            .then((instRes: any) => {
                                const instances: any[] = instRes?.data?.instances || [];
                                if (!instances.length) return;
                                const items = instances.map((it: any) => ({
                                    host: it?.host,
                                    hostName: it?.host,
                                    name: it?.name,
                                    instance: it?.name,
                                    instanceName: it?.name,
                                    status: it?.status,
                                    id: it?.id,
                                    policies: it?.policies || []
                                }));
                                dispatch(upsertInstanceProtectionBatch({ items }));
                            })
                            .catch(() => undefined)
                    )
                );
            } catch (e) {
                // No need to handle error
            }
        })();
    }, [
        orgId,
        listExistingHosts,
        getWorkSpaceID,
        getConnector,
        getDiscoverInstanceResult,
        isWorkloadFactory,
        getOrganizationIds,
        dispatch,
        isDemoMode,
        isGovAccount
    ]);

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading ||
                fsxCredentialStatusLoadingOracle ||
                pgsqlDatabaseHostsLoading ||
                pgsqlFullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        isDiscoverInProgress,
        fullHostDataLoading,
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        pgsqlDatabaseHostsLoading,
        pgsqlFullHostDataLoading,
        multiDataLoading
    ]);

    const getColumnFilterMap = () => {
        switch (selectedHostType) {
            case DBType.MSSQL:
                return mssqlInstanceColumnFilterMap;
            case DBType.POSTGRESQL:
                return pgsqlInstanceColumnFilterMap;
            case DBType.ORACLE:
                return oracleDatabaseColumnFilterMap;
            default:
                return mssqlInstanceColumnFilterMap;
        }
    };
    const getInitialFilter = () => {
        if (selectedInventoryTab === 'Instances' && selectedFilterValue?.flag === true) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            const filterMap = getColumnFilterMap();
            return {
                textFilter: '',
                count: 3,
                columns: {
                    [filterMap.hostName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.credentialName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.regionName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.regionName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        }
        return undefined;
    };

    const getUnmanageApiByHostType = (
        hostType: string,
        apis: {
            mssql: Function;
            pgsql: Function;
            oracle: Function;
        }
    ) => {
        switch (hostType) {
            case DBType.MSSQL:
                return apis.mssql;
            case DBType.POSTGRESQL:
                return apis.pgsql;
            case DBType.ORACLE:
                return apis.oracle;
            default:
                return null;
        }
    };

    const handleDeRegister = (rowData: any) => {
        const updatedState = store.getState();
        const { inProgressInstances: inProgressInstancesL, inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData.resourceId, rowData?.credentialId, rowData?.regionId)] ||
            inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData?.credentialId, rowData?.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        const inProgressId = uniqueHostRow(
            `${rowData?.ec2InstanceId}_${rowData?.databaseInstanceName}`,
            rowData?.credentialId,
            rowData?.regionId
        );
        dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstancesL), inProgressId])));
        const unmanageApiFn = getUnmanageApiByHostType(rowData.hostType, {
            mssql: unmanageApi,
            pgsql: unmanageApiPgsql,
            oracle: unmanageApiOracle
        });

        if (!unmanageApiFn) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: `Unsupported database type for deregister: ${rowData.hostType}`
                })
            );
            return;
        }
        unmanageApiFn({
            credentialsId: targettedHost?.credentialId,
            regionId: targettedHost?.regionId,
            resourceId: targettedHost?.resourceId,
            dbInstanceId: targettedDbInstance?.databaseInstanceId
        }).then((res: any) => {
            const updatedStateA = store.getState();
            const inProgressInstancesA = updatedStateA?.inventoryV2.inProgressInstances;
            const updatedInProgressInstances = new Set([...inProgressInstancesA]);
            updatedInProgressInstances.delete(inProgressId);
            dispatch(setInProgressInstances(updatedInProgressInstances));
            if (res?.data?.items) {
                if (res?.data?.items?.[0]?.errorMessage) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: GENERAL.UNMANAGE_INSTANCE_FAILED_MSG(rowData?.databaseInstanceName),
                            additionalText: res?.data?.items?.[0]?.errorMessage
                        })
                    );
                } else {
                    const updatedInventoryTableData = updateInstanceStatus('unmanage', rowData, rowData);
                    dispatch(setInventoryTableData(updatedInventoryTableData));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: GENERAL.UNMANAGE_INSTANCE_SUCCESS_MSG(rowData?.databaseInstanceName)
                        })
                    );
                }
            }
        });
    };

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header="Deregister instance"
                content={
                    <>
                        <DsTypography variant="Regular_14">
                            {t('databases.deregister-flow.content-part1')} {getDeregisterContent(rowData, t)}?{' '}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginTop: '24px', width: '700px' }}>
                            {t('databases.deregister-flow.content-part2')}
                        </DsTypography>
                    </>
                }
                primaryButton="Deregister"
                secondaryButton="Close"
                callback={() => handleDeRegister(rowData)}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData.resourceId, rowData.credentialId, rowData.regionId)] ||
            inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData.credentialId, rowData.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));

        const isUnregisteredFlow = isUnregisteredInventoryRow(rowData, targettedDbInstance);

        let resourceId = '';
        if (isUnregisteredFlow) {
            resourceId = rowData?.ec2InstanceId || targettedHost?.ec2InstanceId || targettedHost?.resourceId;
        } else if (targettedDbInstance?.resourceId) {
            resourceId = targettedDbInstance?.resourceId;
        } else {
            resourceId = targettedHost?.resourceId;
        }

        const instanceId = isUnregisteredFlow
            ? targettedDbInstance?.databaseInstanceName
            : targettedDbInstance?.databaseInstanceId;

        dispatch(setOptimizingData({}));

        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.name,
                resourceId,
                instanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType,
                isWad: !!rowData?.isWad && !isUnregisteredFlow,
                isUnregistered: isUnregisteredFlow
            })
        );

        // For overview and database
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setSelectedHostname(rowData?.name));
        dispatch(
            setSelectedResourcePageHostData({
                resourceId,
                databaseInstanceId: targettedDbInstance?.databaseInstanceId,
                databaseInstanceName: targettedDbInstance?.databaseInstanceName,
                credentialId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId
            })
        );
        dispatch(resetEiData({}));
        dispatch(setLogAnalyzerState(rowData?.logAnalyzer?.status));
    };

    // For Oracle: Check if there are any registerable rows (used for the Register button in TableTopBar)
    const isUnregisteredRows = useMemo(
        () =>
            selectedHostType === DBType.ORACLE &&
            instanceTableRows?.some((row: any) => {
                const { colText, disableMsg } = manageActionCol(t, selectedHostType, row);
                return colText === ACTION_CTA.REGISTER_DATABASE && disableMsg === '';
            }),
        [instanceTableRows, selectedHostType, t]
    );

    // For Oracle: Navigate to bulk registration wizard
    const handleManageBulk = () => {
        dispatch(setSelectedMultiDetectInstances([]));
        dispatch(setWizardOperationType('bulk'));
        dispatch(setRegisterHostType(selectedHostType));
        dispatch(resetAgenticPreCheckData());
        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    // For Oracle: Tooltip content when Register button is disabled
    const getPopoverContent = () => t('databases.register-flow.register-bulk-disable-tooltip-oracle');

    const updatedTableData = useMemo(
        () =>
            instanceTableRows?.map((row: any) => {
                const processedRow = instanceExtraDataUpdate(row, t, instanceProtection, isDemoMode);
                // Pass selectedRowsForBulkRegister to enable Oracle Standalone/Data Guard selection logic
                const isSelectable = isRowSelectableForBulkRegister(
                    processedRow,
                    selectedHostType,
                    t,
                    selectedRowsForBulkRegister
                );
                let tooltipMsg = !isSelectable
                    ? getDisabledSelectionTooltip(processedRow, selectedHostType, t, selectedRowsForBulkRegister)
                    : '';

                // Check if this row is disabled due to max selection limit
                // Use selectedRowsForBulkRegister directly (like ExploreSavingsTableV2)
                const isRowSelected = selectedRowsForBulkRegister.some(
                    (selectedRow: any) => String(selectedRow.id) === String(processedRow.id)
                );
                const limitReached = selectedRowsForBulkRegister.length >= MAX_BULK_REGISTER_SELECTION;
                const isDisabledByMaxLimit = limitReached && !isRowSelected && isSelectable;

                if (isDisabledByMaxLimit) {
                    tooltipMsg = t('databases.bulk-register.max-selection-reached', {
                        max: MAX_BULK_REGISTER_SELECTION
                    });
                }

                const isDisabled = !isSelectable || isDisabledByMaxLimit;

                // Only create new object if cellProps actually changed - prevents useTable reset
                const currentIsDisabled = processedRow.cellProps?.isDisabled;
                const currentTooltip = processedRow.cellProps?.selectionProps?.title;

                if (currentIsDisabled === isDisabled && currentTooltip === tooltipMsg) {
                    // Return same object reference if nothing changed
                    return processedRow;
                }

                // Add cellProps for selection control
                return {
                    ...processedRow,
                    cellProps: {
                        ...processedRow.cellProps,
                        isDisabled,
                        selectionProps: {
                            title: tooltipMsg
                        }
                    }
                };
            }),
        [instanceTableRows, instanceProtection, isDemoMode, selectedHostType, selectedRowsForBulkRegister]
    );

    // Check if bulk action is visible (used for disabling row actions)
    const isBulkActionVisible =
        (selectedHostType === DBType.MSSQL || selectedHostType === DBType.ORACLE) &&
        selectedRowsForBulkRegister.length > 0;

    const getTableColDefsPerEngineType = () =>
        getInstanceTableColumns({ t, updatedTableData, selectedHostType, isBulkSelectionActive: isBulkActionVisible });

    // Check if max selection limit reached
    const isMaxSelectionReached = useMemo(
        () => selectedRowsForBulkRegister.length >= MAX_BULK_REGISTER_SELECTION,
        [selectedRowsForBulkRegister]
    );

    // State for header checkbox - will be updated based on filtered rows
    const [headerCheckboxEnabled, setHeaderCheckboxEnabled] = useState(false);
    const [headerCheckboxTooltip, setHeaderCheckboxTooltip] = useState(
        selectedHostType === DBType.ORACLE
            ? t('databases.bulk-register.select-header-disabled-oracle')
            : t('databases.bulk-register.select-header-disabled')
    );

    const tableProps = useTable({
        isSorting: false,
        selectionType: selectedHostType === DBType.MSSQL || selectedHostType === DBType.ORACLE ? 'multiple' : 'none',
        columns: getTableColDefsPerEngineType(),
        rows: updatedTableData,
        pageSize: 50,
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        defaultSelectedRows: [],
        selectAllProps: {
            isDisabled: !headerCheckboxEnabled || isMaxSelectionReached || loading,
            title: headerCheckboxTooltip
        },
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialInstanceTableColState(selectedHostType)).filter(
                ([_, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            width: '62px',
            renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
                const menu = [];
                let isBedRockAvailable = true;
                const currentRowState = rowsState[rowData.id];
                if (
                    regionMapping &&
                    rowData?.regionId &&
                    regionMapping.hasOwnProperty(rowData?.regionId) &&
                    regionMapping[rowData?.regionId]?.hasOwnProperty('bedrockAvailable') &&
                    !regionMapping[rowData?.regionId]?.bedrockAvailable
                ) {
                    isBedRockAvailable = false;
                }
                let disableOption = false;
                let disableMessage = '';
                const disableCreateDb = isSmbProtocol(rowData?.storage?.fsxn?.protocol);
                const disableCreateDbMsg = disableCreateDb ? GENERAL.SMB_PROTOCOL_DISABLED : '';
                if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
                    disableMessage = GENERAL.HOST_DOWN;
                    disableOption = true;
                } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
                    disableMessage = GENERAL.SSM_DOWN;
                    disableOption = true;
                } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
                    disableMessage =
                        selectedHostType === DBType.ORACLE
                            ? t('databases.register-flow.oracle-server-instance-down')
                            : t('databases.register-flow.sql-server-instance-down');
                    disableOption = true;
                }

                if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                    menu.push(
                        ...getInstanceTableMenuOptions(
                            rowData,
                            t,
                            disableOption,
                            disableMessage,
                            disableCreateDb,
                            disableCreateDbMsg,
                            isBedRockAvailable,
                            isGovAccount,
                            aiAnalysisEnabled
                        )
                    );
                }

                // For WAD (offline assessment) MSSQL rows, add Well-Architected and View databases options
                const isWadMssqlRow = rowData?.isWad && selectedHostType === DBType.MSSQL;
                if (isWadMssqlRow) {
                    menu.push(
                        {
                            id: 'mssql-optimize-wad',
                            displayName: t('databases.instance-table.menu-options.well-architected')
                        },
                        {
                            id: 'mssql-viewDatabases',
                            displayName: t('databases.instance-table.menu-options.view-databases')
                        }
                    );
                }

                // For WAD (offline assessment) Oracle rows, add Well-Architected option only
                const isWadOracleRow = rowData?.isWad && selectedHostType === DBType.ORACLE;
                if (isWadOracleRow) {
                    menu.push({
                        id: 'oracle-optimize-wad',
                        displayName: t('databases.instance-table.menu-options.well-architected')
                    });
                }

                // For NOT_REGISTERED or UNDETECTED instances (discovered but not yet registered), add Register option
                // Exclude WAD (offline assessment) rows as they are not discovered instances
                const isNotRegistered =
                    (rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                        rowData.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                    !rowData?.isWad;

                if (isNotRegistered) {
                    // Use manageActionCol to check for storage and other standard checks (same as old column implementation)
                    const { disableMsg } = manageActionCol(t, selectedHostType, rowData);

                    // Additionally check for new FSx link and permission requirements
                    const fsxLinkMissing = rowData?.hostManageReadiness?.fsxLinkExists === false;
                    const lacksPermission = !hasFullPermission(rowData?.hostManageReadiness);

                    // Combine checks: disabled if manageActionCol says so OR if FSx link missing OR lacks permission
                    const isDisabled = !!disableMsg || fsxLinkMissing || lacksPermission;

                    let tooltipMsg = disableMsg || '';
                    if (lacksPermission) {
                        tooltipMsg = t(getRegistrationRequiresFullPermissionMessageKey(selectedHostType));
                    } else if (fsxLinkMissing) {
                        tooltipMsg = t(getFsxLinkRequiredMessageKey(selectedHostType));
                    }

                    menu.push({
                        id: 'register-instance',
                        displayName: t('databases.register-flow.register'),
                        disabled: isDisabled,
                        infoText: tooltipMsg || undefined
                    });
                }

                // Use shared utility for disabling logic
                const disableResult = isInstanceActionDisabled(rowData, selectedHostType, t);
                // For menu, also disable if status is unmanaged/in-progress or bulk selection is active
                // Exception: WAD MSSQL and Oracle rows, and UNMANAGED/UNDETECTED rows (for Register option) should have the menu enabled
                const isWadRow = isWadMssqlRow || isWadOracleRow;
                const shouldDisableMenu =
                    !isWadRow &&
                    !isNotRegistered &&
                    (isBulkActionVisible ||
                        rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                        rowData.statusColText === INVENTORY_STATUS.IN_PROGRESS ||
                        disableResult.isDisabled);
                const width = disableResult.tooltipWidth || '';
                const height = disableResult.tooltipHeight || '';

                return (
                    <div className={styles.lastContainer}>
                        <div className={styles.jobMenuPopover} style={{ marginLeft: '-12px' }}>
                            {shouldDisableMenu ? (
                                <TooltipComponent
                                    placement="bottom"
                                    title={disableResult.disableMsg}
                                    width={width}
                                    height={height}
                                >
                                    <div className={styles.menuPointerDisabled}>
                                        <span className={styles.menuPointer}>...</span>
                                    </div>
                                </TooltipComponent>
                            ) : (
                                <MenuPopover
                                    isMenuOpen={
                                        menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id
                                    }
                                    menuItems={[...menu]}
                                    toggleMenu={(toggleType: string, menuId: string) => {
                                        if (toggleType === 'close') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(null);
                                        } else if (toggleType === 'open') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(rowData.id);
                                            menuOpenedRowDetail.current = rowData.id;
                                        } else if (toggleType === 'selectedOption') {
                                            menuOpenedRowDetail.current = null;
                                            setOpenedRow(null);
                                            // Handle WAD optimize action separately
                                            if (menuId === 'mssql-optimize-wad') {
                                                handleWadOptimizeAction(rowData, dispatch);
                                            } else if (
                                                menuId === 'mssql-viewDatabases' &&
                                                rowData?.isWad &&
                                                selectedHostType === DBType.MSSQL
                                            ) {
                                                handleWadViewDatabasesAction(rowData, dispatch);
                                            } else if (menuId === 'oracle-optimize-wad') {
                                                handleOracleWadOptimizeAction(rowData, dispatch);
                                            } else if (menuId === 'register-instance') {
                                                // Handle Register action for NOT_REGISTERED/UNDETECTED instances
                                                // Navigate to register-bulk-wizard (single instance registration)
                                                // Format the instance data the same way as bulk registration
                                                const transformedInstance = [
                                                    {
                                                        id: rowData.id,
                                                        label: `${rowData.databaseInstanceName}, ${rowData.name}`,
                                                        value: rowData.name,
                                                        data: rowData,
                                                        authorized: rowData?.authorized ?? false,
                                                        manageReadiness: rowData.manageReadiness
                                                    }
                                                ];

                                                // Set the selected instances for the wizard using combined action
                                                dispatch(
                                                    setRegistrationWizardData({
                                                        selectedInstances: transformedInstance,
                                                        registerHostType: selectedHostType,
                                                        wizardOperationType: 'single',
                                                        manageSingleInstanceData: rowData
                                                    })
                                                );
                                                dispatch(resetAgenticPreCheckData());

                                                if (isWorkloadFactory) {
                                                    navigate('../register-bulk-wizard');
                                                } else {
                                                    navigate('../fsxdb/register-bulk-wizard');
                                                }
                                            } else {
                                                handleInstanceMenuSelection({
                                                    menuId,
                                                    rowData,
                                                    dispatch,
                                                    navigate,
                                                    handleProtection,
                                                    handleDialog,
                                                    optimizeAction,
                                                    handleEditProtection
                                                });
                                            }
                                        }
                                    }}
                                    CustomMenu={undefined}
                                    disabledText={undefined}
                                />
                            )}
                        </div>
                    </div>
                );
            }
        }
    });

    // Update header checkbox state based on filtered/visible rows
    const filteredRowsCount = tableProps.organizedRows?.length ?? 0;
    const filterCount = tableProps.filterState?.count ?? 0;
    const textFilter = tableProps.filterState?.textFilter ?? '';

    useEffect(() => {
        if (loading) {
            setHeaderCheckboxEnabled(false);
            setHeaderCheckboxTooltip(
                selectedHostType === DBType.ORACLE
                    ? t('databases.bulk-register.select-header-disabled-oracle')
                    : t('databases.bulk-register.select-header-disabled')
            );
            return;
        }

        // Compute header state based on visible/filtered rows
        const visibleRows = tableProps.organizedRows || [];
        // Pass selectedRowsForBulkRegister for Oracle Standalone/Data Guard selection rules
        const newState = shouldEnableHeaderCheckbox(visibleRows, selectedHostType, t, selectedRowsForBulkRegister);

        // Update enabled state
        setHeaderCheckboxEnabled(newState.isEnabled);

        // Compute tooltip
        if (!newState.isEnabled) {
            setHeaderCheckboxTooltip(newState.disableReason);
        } else if (selectedRowsForBulkRegister.length >= MAX_BULK_REGISTER_SELECTION) {
            setHeaderCheckboxTooltip(
                t('databases.bulk-register.max-selection-reached', { max: MAX_BULK_REGISTER_SELECTION })
            );
        } else {
            setHeaderCheckboxTooltip('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredRowsCount, filterCount, textFilter, selectedHostType, selectedRowsForBulkRegister.length]);

    // Handle banner filter views when instances table is already open
    useEffect(() => {
        inventoryBannerFilterUpdates(
            tableProps,
            notRegisteredSQLView,
            notActiveSQLInstancesView,
            notActiveOracleDatabasesView,
            notOptimizedSQLInstancesView,
            notRegisteredOracleDatabasesView,
            notOptimizedOracleDatabaseView,
            updatedTableData,
            selectedHostType,
            dispatch
        );
    }, [
        notRegisteredSQLView,
        notActiveSQLInstancesView,
        notActiveOracleDatabasesView,
        notOptimizedSQLInstancesView,
        notRegisteredOracleDatabasesView,
        notOptimizedOracleDatabaseView,
        tableProps.updateFilterState,
        tableProps.resetFilters,
        selectedHostType,
        updatedTableData
    ]);

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, instanceTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

    // Sync table selection state to Redux for bulk register
    useEffect(() => {
        if (selectedHostType !== DBType.MSSQL && selectedHostType !== DBType.ORACLE) {
            // Clear selection when switching away from MSSQL/Oracle
            if (selectedRowsForBulkRegister.length > 0) {
                dispatch(setSelectedRowsForBulkRegister([]));
            }
            // Reset the notification flag when switching away from Oracle
            hasShownDataGuardNotification.current = false;
            return;
        }

        const selectedRowIds = Object.keys(tableProps.selectionState?.rows || {}).filter(
            key => tableProps.selectionState?.rows[key]
        );

        // Limit selection to MAX_BULK_REGISTER_SELECTION
        const limitedSelectedIds = selectedRowIds.slice(0, MAX_BULK_REGISTER_SELECTION);

        if (limitedSelectedIds.length > 0) {
            // Use instanceTableRows directly to avoid circular dependency with updatedTableData
            const selectedRows = instanceTableRows?.filter((row: any) => limitedSelectedIds.includes(String(row.id)));

            // Check if this is the first Data Guard selection for Oracle
            if (selectedHostType === DBType.ORACLE && selectedRows && selectedRows.length > 0) {
                const hadDataGuardBefore = selectedRowsForBulkRegister.some(row => isOracleDataGuard(row));
                const hasDataGuardNow = selectedRows.some((row: any) => isOracleDataGuard(row));

                // Show notification only on first Data Guard selection (transition from no Data Guard to having Data Guard)
                if (!hadDataGuardBefore && hasDataGuardNow && !hasShownDataGuardNotification.current) {
                    hasShownDataGuardNotification.current = true;
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.INFO,
                            message: t('databases.bulk-register.dataguard-selection-info')
                        })
                    );
                }
            }

            dispatch(setSelectedRowsForBulkRegister(selectedRows || []));
        } else {
            dispatch(setSelectedRowsForBulkRegister([]));
            // Reset the notification flag when selection is cleared
            hasShownDataGuardNotification.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState, selectedHostType, instanceTableRows]);

    // Clear selection when host type changes
    useEffect(() => {
        if (selectedRowsForBulkRegister.length > 0) {
            dispatch(setSelectedRowsForBulkRegister([]));
        }
        // Reset Data Guard notification flag when host type changes
        hasShownDataGuardNotification.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedHostType]);

    /**
     * Handler for bulk register action from the BulkActionContainer
     * Uses the selected rows from table checkboxes to navigate to bulk wizard
     */
    const handleBulkRegisterAction = () => {
        if (selectedRowsForBulkRegister.length === 0) return;

        // Transform rows to the expected BulkDetectedInstance format
        // The wizard expects items with a .data property containing the row data
        const transformedInstances = selectedRowsForBulkRegister.map((row: any) => {
            const isAuthorized = row?.authorized ?? false;
            return {
                id: row.id,
                label: `${row.databaseInstanceName}, ${row.name}`,
                value: row.name,
                data: row, // Wrap the row data under .data property
                authorized: isAuthorized,
                manageReadiness: row.manageReadiness
            };
        });

        // Set the selected instances for the bulk wizard using combined action
        dispatch(
            setRegistrationWizardData({
                selectedInstances: transformedInstances,
                registerHostType: selectedHostType,
                wizardOperationType: 'bulk'
            })
        );
        dispatch(resetAgenticPreCheckData());

        // Clear the table selection after navigating
        dispatch(setSelectedRowsForBulkRegister([]));

        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    const openWADDialog = () => {
        setDialog(
            <DialogComponent
                header={
                    selectedHostType === DBType.MSSQL
                        ? t('databases.inventory.one-time-wad-dialog-heading-final')
                        : t('databases.inventory.one-time-wad-dialog-heading-oracle')
                }
                content={<OneTimeWADDialogContent />}
                secondaryButton={GENERAL.CLOSE}
                closeCallback={() => {}}
                hidePrimaryButton
                customClass="oneTimeWADDialog"
            />
        );
    };

    const downloadWADScript = async () => {
        try {
            const response: any = await getOneTimeWADDownloadScript({
                type: selectedHostType === DBType.MSSQL ? 'mssql' : 'oracle'
            });

            if (response?.data?.blob) {
                const { blob, fileName } = response.data;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.INFO,
                        message: t('databases.inventory.one-time-wad-download-success')
                    })
                );
            }
        } catch (error) {
            console.error('Error downloading WAD script:', error);
        }
    };

    const handleFileInputClick = () => {
        fileInputRef.current?.click();
    };

    const uploadWADScript = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        // Validate the file type (ensure it's JSON)
        if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json') && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.inventory.invalid-file-type')
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }

        // Validate the file size (should be <= 2 MB)
        const maxSizeInMB = 2;
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024; // 2 MB in bytes
        if (selectedFile.size > maxSizeInBytes && !isDemoMode) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message:
                        t('databases.inventory.file-size-exceeds', { max: maxSizeInMB }) +
                        t('databases.inventory.please-upload-smaller-file')
                })
            );
            event.target.value = ''; // Clear the file input
            return;
        }
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: t('databases.inventory.one-time-wad-upload-inprogress')
            })
        );
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                // Parse the JSON data
                const jsonString = e.target?.result as string;

                // Encode JSON to Base64
                const base64Encoded = btoa(jsonString);

                // Convert Base64 string to Uint8Array
                const base64Bytes = new TextEncoder().encode(base64Encoded);

                // Compress the Base64 data using fflate
                const compressedData = compressSync(base64Bytes);

                // Convert the compressed data to Base64 (process in chunks to avoid call stack overflow)
                let binaryString = '';
                const chunkSize = 8192;
                for (let i = 0; i < compressedData.length; i += chunkSize) {
                    binaryString += String.fromCharCode(...compressedData.subarray(i, i + chunkSize));
                }
                const compressedBase64 = btoa(binaryString);

                if (compressedBase64) {
                    const result = await getOneTimeWADUploadScript({
                        type: selectedHostType === DBType.MSSQL ? 'mssql' : 'oracle',
                        payload: {
                            fileContent: compressedBase64,
                            fileName: selectedFile.name
                        }
                    });

                    if (result && !result?.error) {
                        const jobInterval = setInterval(() => {
                            getJobDetailApi({ id: result.data.jobId }).then((jobRes: any) => {
                                const status = jobRes?.data?.status;

                                if (status === JOB_MONITORING_STATUS.COMPLETED) {
                                    dispatch(clearNotifications());

                                    const resourceName = jobRes?.data?.resourceName || '';
                                    const regionCode = jobRes?.data?.region?.code || '';
                                    const regionNameFromResponse = jobRes?.data?.region?.name || '';
                                    // Get region name from response or fallback to regionMapping
                                    const regionName =
                                        regionNameFromResponse ||
                                        (regionCode && regionMapping?.[regionCode]?.regionName) ||
                                        '';
                                    let message = t('databases.inventory.one-time-wad-upload-success');

                                    if (resourceName) {
                                        // Manually construct message to avoid HTML entity encoding from i18next interpolation
                                        if (regionName) {
                                            const template = t(
                                                'databases.inventory.one-time-wad-upload-success-with-resource-region'
                                            );
                                            message = template
                                                .replace('{{resourceName}}', resourceName)
                                                .replace('{{regionName}}', regionName);
                                        } else {
                                            const template = t(
                                                'databases.inventory.one-time-wad-upload-success-with-resource'
                                            );
                                            message = template.replace('{{resourceName}}', resourceName);
                                        }
                                    }

                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                                            message
                                        })
                                    );

                                    // Auto-select region in header filter if not already selected
                                    autoSelectRegionInHeaderFilter(
                                        regionCode,
                                        headerSelectedMultiRegionIdsList,
                                        getRegions,
                                        headerSelectedMultiRegion,
                                        dispatch
                                    );

                                    clearInterval(jobInterval);
                                    // Refresh offline assessment data after successful upload based on host type
                                    if (selectedHostType === DBType.ORACLE) {
                                        refreshOfflineOracleAssessmentData(
                                            getAllOfflineOracleAssessmentAPI,
                                            dispatch,
                                            [],
                                            null
                                        );
                                    } else {
                                        refreshOfflineAssessmentData(getAllOfflineAssessmentAPI, dispatch, [], null);
                                        // Also refresh the offline MSSQL databases so the Databases tab
                                        // picks up the newly uploaded WAD databases without a page reload.
                                        refreshOfflineMssqlDatabasesData(
                                            getOfflineMssqlDatabasesAPI,
                                            dispatch,
                                            [],
                                            null
                                        );
                                    }
                                } else if (status === JOB_MONITORING_STATUS.FAILED) {
                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.ERROR,
                                            message: jobRes?.data?.error || 'Error uploading file.'
                                        })
                                    );
                                    clearInterval(jobInterval);
                                }
                            });
                        }, 5000);
                    }
                }
            } catch (error) {
                console.error('Error uploading WAD script:', error);
            }
        };

        // Start reading the file - this triggers the onload callback
        reader.readAsText(selectedFile);

        // Reset the input immediately so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={styles.inventoryTable} ref={inventoryTableRef}>
            <div
                className={`${styles.table} ${styles.leftBorder} ${
                    isBulkActionVisible ? styles.bulkActionVisible : ''
                }`}
            >
                {/* Show BulkActionContainer above the table when rows are selected */}
                {isBulkActionVisible && (
                    <BulkActionContainer
                        action={t(
                            selectedHostType === DBType.ORACLE
                                ? selectedRowsForBulkRegister.length === 1
                                    ? 'databases.bulk-register.register-selected-database'
                                    : 'databases.bulk-register.register-selected-databases'
                                : selectedRowsForBulkRegister.length === 1
                                ? 'databases.bulk-register.register-selected-instance'
                                : 'databases.bulk-register.register-selected-instances',
                            { count: selectedRowsForBulkRegister.length }
                        )}
                        onClick={handleBulkRegisterAction}
                    />
                )}
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={title}
                    singularTitle={title}
                    className={styles.topBarInstanceStyle}
                    {...(selectedHostType === DBType.POSTGRESQL && {
                        exportToCsvOptions: { fileName: exportToCsvFileName }
                    })}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        <>
                            {selectedHostType !== DBType.POSTGRESQL && (
                                <div>
                                    <DsButton
                                        ref={buttonRef}
                                        children={t('databases.inventory.one-time-assessment')}
                                        variant="Default"
                                        dropDown={{
                                            trigger: 'click',
                                            autoPosition: true,
                                            items: [
                                                {
                                                    id: 'wlm-db-learn-assessment-mssql',
                                                    label: t('databases.inventory.learn-about-assessment'),
                                                    onClick: () => {
                                                        openWADDialog();
                                                    }
                                                },
                                                {
                                                    id: 'wlm-db-download-script-mssql',
                                                    label: t('databases.inventory.download-script'),
                                                    isDisabled: false,
                                                    onClick: () => {
                                                        downloadWADScript();
                                                    }
                                                },
                                                {
                                                    id: 'wlm-db-upload-results-mssql',
                                                    label: t('databases.inventory.upload-results'),
                                                    isDisabled: false,
                                                    onClick: handleFileInputClick
                                                }
                                            ]
                                        }}
                                    />

                                    {isCardOpen && (
                                        <IntroductionWADCard buttonRef={buttonRef} setIsCardOpen={setIsCardOpen} />
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        onChange={uploadWADScript}
                                    />
                                </div>
                            )}
                        </>
                    }
                />
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
};

export default InstancesTable;
