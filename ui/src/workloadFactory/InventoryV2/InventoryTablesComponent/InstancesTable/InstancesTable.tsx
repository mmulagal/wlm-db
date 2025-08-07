import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useAddHostJobScMutation,
    useAddHostScMutation,
    useAssignRBACPrivilegesMutation,
    useConfigureDirectoryMutation,
    useDeleteHostScMutation,
    useDiscoverExistingFsxNMutation,
    useGenerateCredentialIDMutation,
    useGetConnectorsMutation,
    useGetDiscoverHostResultMutation,
    useGetFsxDetailsMutation,
    useGetRBACPrivilegesMutation,
    useGetWorkSpaceIDMutation,
    useListAllDirectoriesMutation,
    useListExistingHostsMutation,
    useUnmanageMssqlInstanceMutation,
    useUnmanageOracleInstanceMutation,
    useUnmanagePgsqlInstanceMutation
} from '../../../../utils/apiService';
import {
    addHostHandlerSc,
    getDeregisterContent,
    getOptimizationStatusData,
    manageActionCol,
    uniqueHostRow,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import { bxpRedirect, getFilterOptions, isSmbProtocol } from '../../../../utils/utilityFunctions';
import {
    ACTION_CTA,
    DBType,
    DETECT_HOST_VAR,
    FROM_DIALOG,
    INVENTORY_STATUS,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import store from '../../../../store/store';
import {
    setBreadCrumbSelectedFrom,
    setInProgressInstances,
    setInventoryTableData,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab,
    setSelectedMultiDetectInstances,
    setTableManageColumnState,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../../store/authSlice';
import styles from '../InventoryTable.module.scss';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { useTable } from '../../../../common/Lib/Table/useTable';
import NoAgentDialog from '../ProtectionDialogs/NoAgentDialog';
import SingleAgentDialog from '../ProtectionDialogs/SingleAgentDialog';
import FetchingDialog from '../ProtectionDialogs/FetchingDIalog';
import { cancelProtectionForRow } from '../../../../store/workloadFactory/snapcenterSlice';
import { resetEiData } from '../../../../store/workloadFactory/agenticAISlice';
import { setActionsDisabled } from '../../../../store/workloadFactory/dialogComponentSlice';
import { handleProtectionUtil } from '../../AddHostUtils';
import { getInstanceTableColumns } from './InstanceTableColumns';
import { mssqlInstanceColumnFilterMap } from './MssqlInstanceColumnList';
import { oracleDatabaseColumnFilterMap } from './OracleDatabaseColumnsList';
import { pgsqlInstanceColumnFilterMap } from './PgsqlInstanceColumnList';
import { getInitialInstanceTableColState } from '../../../../utils/manageColumnUtils';

const InstancesTable = () => {
    const { t } = useTranslation();

    const { instanceTableRows, tableManageColumnState } = useAppSelector(state => state.inventoryV2);

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const {
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        selectedHostType,
        selectedInventoryTab,
        selectedFilterValue
    } = useAppSelector(state => state.inventoryV2);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const [loading, setLoading] = useState(false);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [unmanageApiPgsql] = useUnmanagePgsqlInstanceMutation();
    const [unmanageApiOracle] = useUnmanageOracleInstanceMutation();
    const [getConnector] = useGetConnectorsMutation();
    const [getFsxDetails] = useGetFsxDetailsMutation();
    const [discoverExistingFsxN] = useDiscoverExistingFsxNMutation();
    const [getWorkSpaceID] = useGetWorkSpaceIDMutation();
    const [getRBACPrivileges] = useGetRBACPrivilegesMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [assignRBACPrivileges] = useAssignRBACPrivilegesMutation();
    const [generateCredentialID] = useGenerateCredentialIDMutation();
    const [addHostScApi] = useAddHostScMutation();
    const [addHostJobScApi] = useAddHostJobScMutation();
    const [deleteHostSc] = useDeleteHostScMutation();
    const [configureDirectory] = useConfigureDirectoryMutation();
    const [listAllDirectories] = useListAllDirectoriesMutation();
    const [getDiscoverHostResult] = useGetDiscoverHostResultMutation();

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading ||
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

        let resourceId = '';
        if (targettedDbInstance?.resourceId) {
            resourceId = targettedDbInstance?.resourceId;
        } else {
            resourceId = targettedHost?.resourceId;
        }

        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.name,
                resourceId,
                instanceId: targettedDbInstance?.databaseInstanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType
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
    };

    // Snapcenter Protection code starts

    const fetchDialog = (key: string) => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header')}
                content={<FetchingDialog />}
                primaryButton={t('databases.inventory.redirect')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    dispatch(cancelProtectionForRow(key));
                    closeDialog();
                }}
                callback={() => {}}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.LOADER}
            />
        );
    };

    const handleProtection = async (rowData: any) => {
        await handleProtectionUtil(rowData, {
            dispatch,
            fetchDialog,
            showSingleAgentDialog,
            showNoAgentDialog,
            closeDialog,
            listExistingHosts,
            getWorkSpaceID,
            getConnector,
            getFsxDetails,
            discoverExistingFsxN,
            assignRBACPrivileges,
            getRBACPrivileges
        });
    };

    const showNoAgentDialog = () => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header')}
                content={<NoAgentDialog />}
                primaryButton={t('databases.inventory.redirect')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    bxpRedirect(isWorkloadFactory);
                }}
                customClass={styles.protectionDialog}
            />
        );
    };

    const showSingleAgentDialog = (connectors?: any, hostExists?: boolean, rowData?: any) => {
        const state = store.getState();
        const dialogKeyValue = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
        const protectionState = state.snapCenter.protectionProcessState[dialogKeyValue];
        if (protectionState?.step1Status === 'running' || protectionState?.step2Status === 'running') {
            dispatch(setActionsDisabled(true));
        } else {
            dispatch(setActionsDisabled(false));
        }

        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <DsTypography variant="Regular_14">{t('databases.inventory.protect-header')}</DsTypography>
                        {!hostExists && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-1-out-of')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={<SingleAgentDialog agents={connectors} hostExists={hostExists} dialogKey={dialogKeyValue} />}
                primaryButton={hostExists ? t('databases.inventory.redirect') : t('databases.inventory.start')}
                secondaryButton={t('databases.inventory.cancel')}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    if (hostExists) {
                        bxpRedirect(isWorkloadFactory);
                    } else {
                        addHostHandlerSc(
                            rowData,
                            dispatch,
                            generateCredentialID,
                            addHostScApi,
                            addHostJobScApi,
                            t,
                            deleteHostSc,
                            listAllDirectories,
                            configureDirectory,
                            getDiscoverHostResult
                        );
                    }
                }}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.SINGLE_AGENT}
            />
        );
    };

    const disableManageCheck = (rowData: any) => {
        let errorMessage = '';
        let isDisabled = false;
        if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
            isDisabled = true;
            errorMessage = GENERAL.NON_MSSQL_BULK_CTA;
        } else if (rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
            isDisabled = true;
            errorMessage = 'The instance is already managed by Workload Factory.';
        } else if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
            isDisabled = true;
            errorMessage = 'The instance is not authenticated.';
        } else if (rowData?.serverInstallationMode === GENERAL.AOAG) {
            isDisabled = true;
            errorMessage = GENERAL.AOAG_MANAGE_DISABLE;
        } else if (rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP && !rowData?.fsxId) {
            isDisabled = true;
            errorMessage = GENERAL.FSXN_MANAGE_SUPPORTED;
        } else if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
            isDisabled = true;
            errorMessage = GENERAL.HOST_DOWN;
        } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
            isDisabled = true;
            errorMessage = GENERAL.SSM_DOWN;
        } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
            isDisabled = true;
            errorMessage = GENERAL.SQL_SERVER_INSTANCE_DOWN;
        }
        return { isDisabled, errorMessage };
    };

    const setStatusForFilter = (rowData?: any) => {
        if (
            rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
        ) {
            return INVENTORY_STATUS.ONLINE;
        }
        if (rowData?.status === INVENTORY_STATUS.STOPPED || rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) {
            return INVENTORY_STATUS.OFFLINE;
        }
        return rowData?.status;
    };

    const updatedTableData = useMemo(
        () =>
            instanceTableRows?.map((row: any) => {
                const { isDisabled, errorMessage } = disableManageCheck(row);
                const optimizationData = getOptimizationStatusData(row, t);
                let optimizationStatus;
                let optimizationDisableMsg;
                let optimizationIsDisabled;
                if (
                    typeof optimizationData === 'object' &&
                    optimizationData !== null &&
                    'displayValue' in optimizationData
                ) {
                    optimizationStatus = optimizationData.displayValue;
                    optimizationDisableMsg = optimizationData.disableMsg;
                    optimizationIsDisabled = optimizationData.isDisabled;
                } else {
                    optimizationStatus = optimizationData;
                    optimizationDisableMsg = '';
                    optimizationIsDisabled = false;
                }
                return {
                    ...row,
                    statusAccessor: setStatusForFilter(row),
                    optimizationStatus,
                    optimizationDisableMsg,
                    cellProps: {
                        ...row.cellProps,
                        isDisabled,
                        selectionProps: {
                            title: errorMessage,
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    }
                };
            }),
        [instanceTableRows]
    );

    const isUnregisteredRows = useMemo(
        () =>
            instanceTableRows?.some((row: any) => {
                const { colText, disableMsg } = manageActionCol(t, row);
                return colText === ACTION_CTA.MANAGE_INSTANCES && disableMsg === '';
            }),
        [instanceTableRows]
    );

    const getTableColDefsPerEngineType = () => getInstanceTableColumns({ t, updatedTableData, selectedHostType });

    const tableProps = useTable({
        isSorting: false,
        columns: getTableColDefsPerEngineType(),
        rows: updatedTableData,
        pageSize: 50,
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialInstanceTableColState(selectedHostType)).filter(
                ([_, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                const menu = [];
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
                    disableMessage = GENERAL.SQL_SERVER_INSTANCE_DOWN;
                    disableOption = true;
                }

                if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                    if (rowData.hostType === DBType.ORACLE || rowData.hostType === DBType.POSTGRESQL) {
                        menu.push({
                            id: 'unManage',
                            displayName: 'Deregister'
                        });
                    } else if (rowData.hostType === DBType.MSSQL) {
                        menu.push(
                            {
                                id: 'optimize',
                                displayName: t('databases.well-architect.well-architect-state'),
                                disabled: disableOption,
                                infoText: disableMessage
                            },
                            {
                                id: 'investigateErrors',
                                displayName: 'Investigate errors',
                                disabled: disableOption,
                                infoText: disableMessage
                            },
                            {
                                id: 'viewInstance',
                                displayName: 'Manage instance',
                                disabled: disableOption,
                                infoText: disableMessage,
                                subMenu: [
                                    {
                                        id: 'viewInstance',
                                        displayName: 'Instance dashboard',
                                        disabled: disableOption,
                                        infoText: disableMessage
                                    },
                                    {
                                        id: 'viewDatabases',
                                        displayName: 'View databases',
                                        disabled: disableOption,
                                        infoText: disableMessage
                                    },

                                    {
                                        id: 'createUserDb',
                                        displayName: 'Create database',
                                        disabled: disableOption || disableCreateDb,
                                        infoText: disableMessage || disableCreateDbMsg
                                    },
                                    {
                                        id: 'createSandbox',
                                        displayName: 'Create sandbox',
                                        disabled: disableOption,
                                        infoText: disableMessage
                                    }
                                ]
                            },
                            {
                                id: 'protect',
                                displayName: 'Protect',
                                disabled: disableOption || !rowData?.fsxId || !rowData?.hostRow?.nodeIpAddress,
                                infoText: disableMessage
                            },

                            {
                                id: 'unManage',
                                displayName: 'Deregister'
                            }
                        );
                    }
                }

                let disableMsg = '';
                let width = '';
                let height = '';
                const disableMenu = () => {
                    if (
                        rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                        rowData.statusColText === INVENTORY_STATUS.UNDETECTED
                    ) {
                        return true;
                    }

                    // if (rowData?.loading) {
                    //     disableMsg = GENERAL.INVENTORY_LOADING_DISABLED;
                    //     width = '170px';
                    //     height = '33px';
                    //     return true;
                    // }
                    if (
                        rowData?.status === INVENTORY_STATUS.OFFLINE &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.HOST_DOWN;
                        width = '120px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.ssmState === INVENTORY_STATUS.OFFLINE &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.SSM_DOWN;
                        width = '250px';
                        height = '50px';
                        return true;
                    }
                    if (
                        rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.SQL_SERVER_INSTANCE_DOWN;
                        width = '220px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.detectOption === DETECT_HOST_VAR.DISABLE ||
                        rowData?.detectOption === DETECT_HOST_VAR.HIDE
                    ) {
                        disableMsg = rowData?.detectOptionDisableMsg;
                        width = '250px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
                        rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP &&
                        !rowData?.fsxId
                    ) {
                        disableMsg = GENERAL.FSXN_MANAGE_SUPPORTED;
                        width = '340px';
                        height = '50px';
                        return true;
                    }
                    if (
                        rowData?.serverInstallationMode === GENERAL.AOAG &&
                        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED
                    ) {
                        disableMsg = GENERAL.AOAG_MANAGE_DISABLE;
                        width = '320px';
                        height = '50px';
                        return true;
                    }
                    return false;
                };

                return (
                    <div className={styles.jobMenuPopover}>
                        {disableMenu() ? (
                            <TooltipComponent placement="bottom" title={disableMsg} width={width} height={height}>
                                <div className={styles.menuPointerDisabled}>
                                    <span className={styles.menuPointer}>...</span>
                                </div>
                            </TooltipComponent>
                        ) : (
                            <MenuPopover
                                isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
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

                                        // Protect POC code
                                        if (menuId === 'protect') {
                                            handleProtection(rowData);
                                        }

                                        if (menuId === 'optimize') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );

                                            dispatch(
                                                setSelectedWellArchitectTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
                                            optimizeAction(rowData);
                                        }

                                        if (menuId === 'investigateErrors') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION)
                                            );
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );
                                            optimizeAction(rowData);
                                        }

                                        if (menuId === 'viewInstance') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );
                                            optimizeAction(rowData);
                                        }
                                        if (menuId === 'viewDatabases') {
                                            dispatch(setSelectedInventoryTab('Databases'));
                                            dispatch(
                                                setSelectedFilterValue({
                                                    flag: true,
                                                    value: {
                                                        hostName: rowData?.name,
                                                        instanceName: rowData?.databaseInstanceName,
                                                        credentialName: rowData?.credentialName,
                                                        regionName: rowData?.regionName
                                                    },
                                                    filterType: 'multi'
                                                })
                                            );
                                        }
                                        if (menuId === 'createUserDb') {
                                            dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                            dispatch(updateResourceId(rowData?.resourceId));
                                            dispatch(
                                                setCdbPageData({
                                                    dbHostName: rowData?.name,
                                                    instanceId: rowData?.databaseInstanceId,
                                                    instanceName: rowData?.databaseInstanceName,
                                                    cdbCredId: rowData?.credentialId,
                                                    cdbRegionId: rowData?.regionId
                                                })
                                            );
                                            navigate('../create-new-user');
                                        }
                                        if (menuId === 'createSandbox') {
                                            dispatch(
                                                setSelectedSandboxHeaderValue({
                                                    credId: rowData?.credentialId,
                                                    regionId: rowData?.regionId
                                                })
                                            );
                                            dispatch(
                                                setSelectedCsData({
                                                    host: rowData?.name,
                                                    instance: rowData?.databaseInstanceName,
                                                    database: null
                                                })
                                            );
                                            navigate('../create-new-sandbox');
                                        }
                                        if (menuId === 'unManage') {
                                            handleDialog(rowData);
                                        }
                                    }
                                }}
                                CustomMenu={undefined}
                                disabledText={undefined}
                            />
                        )}
                    </div>
                );
            }
        }
    });

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, instanceTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

    const handleManageBulk = () => {
        dispatch(setSelectedMultiDetectInstances([]));
        dispatch(setWizardOperationType('bulk'));
        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={`${styles.table} ${styles.leftBorder}`}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Instances"
                    singularTitle="Instance"
                    exportToCsvOptions={{ fileName: `InstanceTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        <div className={styles.manageInstanceButton}>
                            {!loading && !isUnregisteredRows ? (
                                <Popover
                                    isAppendedToBody
                                    children={t('databases.register-flow.register-bulk-disable-tooltip')}
                                    trigger="hover"
                                    container={
                                        <DsButton isThin isDisabled>
                                            {t('databases.register-flow.register-multiple-instances')}
                                        </DsButton>
                                    }
                                />
                            ) : (
                                <DsButton
                                    isThin
                                    onClick={() => handleManageBulk()}
                                    isDisabled={loading || !isUnregisteredRows}
                                >
                                    {t('databases.register-flow.register-multiple-instances')}
                                </DsButton>
                            )}
                        </div>
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
