import { DsTypography, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DBType, FROM_DIALOG, INVENTORY_STATUS } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedFilterValue, setTableManageColumnState } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { bxpRedirect } from '../../../../utils/utilityFunctions';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { handleProtectionUtil } from '../../AddHostUtils';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import NoAgentDialog from '../ProtectionDialogs/NoAgentDialog';
import store from '../../../../store/store';
import { setActionsDisabled } from '../../../../store/workloadFactory/dialogComponentSlice';
import SingleAgentDialog from '../ProtectionDialogs/SingleAgentDialog';
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
    useListExistingHostsMutation
} from '../../../../utils/apiService';
import FetchingDialog from '../ProtectionDialogs/FetchingDIalog';
import { cancelProtectionForRow } from '../../../../store/workloadFactory/snapcenterSlice';
import { addHostHandlerSc } from '../../InventoryUtilsV2';
import { getDatabaseTableColumns } from './DatabaseTableColumns';
import { mssqlPgsqlDatabaseColumnFilterMap } from './MssqlPgsqlDatabaseTableColumns';
import { oraclePDBColumnFilterMap } from './OraclePDBTableColumns';
import { getInitialDatabaseTableColState } from '../../../../utils/manageColumnUtils';

const DatabasesTable = () => {
    const { t } = useTranslation();
    const { selectedInventoryTab, selectedFilterValue, selectedHostType, databaseTableRows, tableManageColumnState } =
        useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqldatabaseHostsLoading, fullHostDataLoading: pgsqlfullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { multiDataLoading } = useAppSelector(state => state.headers);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const navigate = useNavigate();

    // Protection api's
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

    // Function to check if protect option should be disabled
    const isProtectDisabled = (rowData: any): boolean =>
        rowData?.hostType !== GENERAL.MICROSOFT_SQL_SERVER_TYPE ||
        !rowData?.instanceRow?.fsxId ||
        !rowData?.hostRow?.nodeIpAddress ||
        rowData?.status !== 'ONLINE';

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                fullHostDataLoading ||
                pgsqldatabaseHostsLoading ||
                pgsqlfullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        fullHostDataLoading,
        pgsqldatabaseHostsLoading,
        pgsqlfullHostDataLoading,
        multiDataLoading
    ]);

    const getColumnFilterMap = () => {
        switch (selectedHostType) {
            case DBType.MSSQL:
            case DBType.POSTGRESQL:
                return mssqlPgsqlDatabaseColumnFilterMap;
            case DBType.ORACLE:
                return oraclePDBColumnFilterMap;
            default:
                return mssqlPgsqlDatabaseColumnFilterMap;
        }
    };

    const getInitialFilter = () => {
        const filterMap = getColumnFilterMap();
        if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'single'
        ) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
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
        if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'multi'
        ) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            return {
                textFilter: '',
                count: 4,
                columns: {
                    [filterMap.hostName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.instanceName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.instanceName]: true
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

    // handle protection logic

    const fetchDialog = (key: string) => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header-database')}
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
                header={t('databases.inventory.protect-header-database')}
                content={<NoAgentDialog dialogType="database" />}
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
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.protect-header-database')}
                        </DsTypography>
                        {!hostExists && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-1-out-of')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={
                    <SingleAgentDialog
                        agents={connectors}
                        hostExists={hostExists}
                        dialogKey={dialogKeyValue}
                        dialogType="database"
                    />
                }
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

    const getTableColDefsPerEngineType = () => getDatabaseTableColumns({ t, databaseTableRows, selectedHostType });

    const tableProps = useTable({
        isSorting: false,
        columns: getTableColDefsPerEngineType(),
        rows: databaseTableRows,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        // @ts-ignore
        initialFilterState: getInitialFilter(),
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialDatabaseTableColState(selectedHostType) ?? {}).filter(
                ([, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                let disableOption = false;
                let disableMessage = '';

                if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
                    disableOption = true;
                    disableMessage = GENERAL.COMING_SOON;
                } else if (rowData?.type === GENERAL.SYSTEM_DATABASE) {
                    disableOption = true;
                    disableMessage = 'Create sandbox option is not available for system database.';
                }
                const menu = [
                    {
                        id: 'createSandbox',
                        displayName: 'Create sandbox',
                        disabled: disableOption,
                        infoText: disableMessage
                    },
                    {
                        id: 'protect',
                        displayName: 'Protect',
                        disabled: isProtectDisabled(rowData)
                    }
                ];
                return (
                    <div className={styles.jobMenuPopover}>
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

                                    if (menuId === 'createSandbox') {
                                        dispatch(
                                            setSelectedSandboxHeaderValue({
                                                credId: rowData?.credentialId,
                                                regionId: rowData?.regionId
                                            })
                                        );
                                        dispatch(
                                            setSelectedCsData({
                                                host: rowData?.hostName,
                                                instance: rowData?.databaseInstanceName,
                                                database: rowData?.name
                                            })
                                        );
                                        navigate('../create-new-sandbox');
                                    }

                                    // Protect POC code
                                    if (menuId === 'protect') {
                                        handleProtection(rowData);
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            }
        }
    });

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, databaseTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);
    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={styles.table}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Databases"
                    singularTitle="Database"
                    exportToCsvOptions={{ fileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
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

export default DatabasesTable;
