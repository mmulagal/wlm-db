import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { DsButton, postBlueXPMessage, BlueXPListeners } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setSelectedFilterValue,
    setSelectedInventoryTab,
    setTableManageColumnState
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { DBType, INVENTORY_STATUS, WLF_TO_FORM_NAVIGATE, WLF_TO_PROTECT_NAVIGATE } from '../../../../utils/consts';
import { setDatabaseHostEntryPoint } from '../../../../store/mssql/msSqlActionSlice';
import styles from '../InventoryTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { Table } from '../../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { getHostTableColumns } from './HostTableColumns';
import { getInitialHostTableColState } from '../../../../utils/manageColumnUtils';

const HostTable = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const hostTableRows = useAppSelector(state => state.inventoryV2.hostTableRows);

    const [resetPage, setResetPage] = useState(false);
    const [pageSize] = useState(50);

    const { selectedHostType } = useAppSelector(state => state.inventoryV2);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const {
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        tableManageColumnState
    } = useAppSelector(state => state.inventoryV2);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const [loading, setLoading] = useState(false);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

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

    const findDatabaseOption = (rowData: any) => {
        let disableOptionDatabase = false;
        let disableMessageDatabase: any = '';
        if (
            rowData?.status === INVENTORY_STATUS.STOPPED ||
            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
            rowData?.status === INVENTORY_STATUS.OFFLINE
        ) {
            disableOptionDatabase = true;
            disableMessageDatabase = GENERAL.HOST_DOWN;
        } else if (rowData?.managedInstance <= 0) {
            disableOptionDatabase = true;
            disableMessageDatabase = GENERAL.DATABASE_AVAILABLE_MSG;
        }
        return { disableOptionDatabase, disableMessageDatabase };
    };

    const getTableColDefsPerEngineType = () => getHostTableColumns({ t, hostTableRows, selectedHostType });

    const getMenuItems = (disableOptionDatabase: boolean, disableMessageDatabase: string, rowData: any) => {
        if (selectedHostType === DBType.ORACLE) {
            const hasNoDatabases = !rowData?.sqlServerInstances || rowData?.sqlServerInstances?.length === 0;
            const disableOracle = disableOptionDatabase || hasNoDatabases;

            const disableMessageOracle = hasNoDatabases
                ? t('databases.general.no-databases-online-msg')
                : disableOptionDatabase
                ? disableMessageDatabase
                : '';

            return [
                {
                    id: 'viewDatabases',
                    displayName: 'View PDBs',
                    disabled: disableOracle,
                    infoText: disableMessageOracle
                },
                {
                    id: 'viewInstances',
                    displayName: 'View databases',
                    disabled: disableOracle,
                    infoText: disableMessageOracle
                }
            ];
        }
        return [
            {
                id: 'viewInstances',
                displayName: 'View instances'
            },
            {
                id: 'viewDatabases',
                displayName: 'View databases',
                disabled: disableOptionDatabase,
                infoText: disableMessageDatabase
            }
        ];
    };

    const tableProps = useTable({
        isSorting: false,
        columns: getTableColDefsPerEngineType(),
        rows: hostTableRows,
        pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialHostTableColState(selectedHostType)).filter(([, value]) => value !== undefined)
        ),
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                const { disableOptionDatabase, disableMessageDatabase } = findDatabaseOption(rowData);
                const menu = getMenuItems(disableOptionDatabase, disableMessageDatabase, rowData);

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
                                    if (menuId === 'viewInstances') {
                                        dispatch(setSelectedInventoryTab('Instances'));
                                        dispatch(
                                            setSelectedFilterValue({
                                                flag: true,
                                                value: {
                                                    hostName: rowData?.name,
                                                    credentialName: rowData?.credentialName,
                                                    regionName: rowData?.regionName
                                                },
                                                filterType: 'single'
                                            })
                                        );
                                    }
                                    if (menuId === 'viewDatabases') {
                                        dispatch(setSelectedInventoryTab('Databases'));
                                        dispatch(
                                            setSelectedFilterValue({
                                                flag: true,
                                                value: {
                                                    hostName: rowData?.name,
                                                    credentialName: rowData?.credentialName,
                                                    regionName: rowData?.regionName
                                                },
                                                filterType: 'single'
                                            })
                                        );
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
        if (isRefreshed) {
            tableProps?.pagination?.gotoPage(0);
        }
    }, [isRefreshed]);

    useEffect(() => {
        if (resetPage) {
            if ((hostTableRows || []).length % pageSize === 1) {
                tableProps.pagination?.gotoPage(0);
            }
        }
        setResetPage(false);
    }, [resetPage]);

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, hostTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={`${styles.table} ${styles.hostTable}`}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Hosts"
                    singularTitle="Host"
                    exportToCsvOptions={{ fileName: `HostTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    className={styles.topBarStyle}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        !(selectedHostType === DBType.ORACLE) ? (
                            <div className={styles.deployButton}>
                                <DsButton
                                    children="Deploy host"
                                    variant="Default"
                                    dropDown={{
                                        trigger: 'click',
                                        autoPosition: true,
                                        items: [
                                            {
                                                id: 'wlm-db-deploy-mssql-host',
                                                label: 'Microsoft SQL Server',
                                                onClick: () => {
                                                    dispatch(setDatabaseHostEntryPoint('inventory'));
                                                    if (isWorkloadFactory) {
                                                        navigate(WLF_TO_FORM_NAVIGATE);
                                                        postBlueXPMessage({
                                                            type: BlueXPListeners.navigate,
                                                            payload: {
                                                                pathname: './mssql-deploy-wizard',
                                                                replace: true
                                                            }
                                                        });
                                                    } else {
                                                        navigate('../../fsxdb/mssql-deploy-wizard');
                                                        postBlueXPMessage({
                                                            type: BlueXPListeners.navigate,
                                                            payload: {
                                                                pathname: '../../fsxdb/mssql-deploy-wizard',
                                                                replace: true
                                                            }
                                                        });
                                                    }
                                                },
                                                className: 'mssql-deployment-button'
                                            },
                                            {
                                                id: 'wlm-db-deploy-pgsql-host',
                                                label: 'PostgreSQL Server',
                                                onClick: () => {
                                                    dispatch(setDatabaseHostEntryPoint('inventory'));
                                                    if (isWorkloadFactory) {
                                                        navigate(WLF_TO_PROTECT_NAVIGATE);
                                                        postBlueXPMessage({
                                                            type: BlueXPListeners.navigate,
                                                            payload: {
                                                                pathname: './postgreSQL-deploy-wizard',
                                                                replace: true
                                                            }
                                                        });
                                                    } else {
                                                        navigate('../../fsxdb/postgreSQL-deploy-wizard');
                                                        postBlueXPMessage({
                                                            type: BlueXPListeners.navigate,
                                                            payload: {
                                                                pathname: '../../fsxdb/postgreSQL-deploy-wizard',
                                                                replace: true
                                                            }
                                                        });
                                                    }
                                                },
                                                className: 'pgsql-deployment-button'
                                            }
                                        ]
                                    }}
                                />
                            </div>
                        ) : undefined
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

export default HostTable;
