import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import {
    Typography,
    Button,
    Popover,
    DsTypography,
    DsFlashingDotsLoader,
    DsButton,
    postBlueXPMessage,
    BlueXPListeners
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { renderCellData, renderEstimatedCost, renderInstanceListText, renderVpcText } from '../../InventoryUtilsV2';
import {
    setSelectedFilterValue,
    setSelectedInventoryTab,
    setTableManageColumnState
} from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    INVENTORY_STATUS,
    SSM_TROUBLESHOOTING_LINK,
    WLF_TO_FORM_NAVIGATE,
    WLF_TO_PROTECT_NAVIGATE
} from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { Table } from '../../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { getFilterOptions } from '../../../../utils/utilityFunctions';

const HostTable = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const hostTableRows = useAppSelector(state => state.inventoryV2.hostTableRows);

    const [resetPage, setResetPage] = useState(false);
    const [pageSize] = useState(50);

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading, tableManageColumnState } = useAppSelector(
        state => state.inventoryV2
    );
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

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: 'Host name',
            accessor: 'nameForSorting',
            isSortable: true,
            width: '228px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div className={styles.firstColumnClass}>
                        <DsTypography
                            title={name || GENERAL.NOT_AVAILABLE}
                            className={styles.textClass}
                            variant="Semibold_14"
                        >
                            {name || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP ||
                                rowData?.status === INVENTORY_STATUS.ONLINE) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
                                rowData?.status === INVENTORY_STATUS.OFFLINE) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                            )}
                            <DsTypography variant="Regular_13">
                                {(() => {
                                    if (
                                        rowData?.status === INVENTORY_STATUS.RUNNING ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ) {
                                        return INVENTORY_STATUS.ONLINE;
                                    }
                                    if (
                                        rowData?.status === INVENTORY_STATUS.STOPPED ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ) {
                                        return INVENTORY_STATUS.OFFLINE;
                                    }
                                    if (rowData?.status) {
                                        return rowData?.status;
                                    }
                                    if (rowData?.loading) {
                                        return <DsFlashingDotsLoader />;
                                    }
                                    return INVENTORY_STATUS.UNKNOWN;
                                })()}
                            </DsTypography>
                        </div>
                    </div>
                );
            }
        },
        {
            id: '1',
            Header: 'Engine type',
            accessor: 'hostType',
            filterOptions: getFilterOptions(hostTableRows, 'hostType'),
            width: '228px',
            renderCell: (cellData: any) => (
                <div>
                    <Typography variant="Regular_13">{cellData || GENERAL.NOT_AVAILABLE}</Typography>
                </div>
            )
        },
        {
            id: '2',
            Header: 'Registered instances',
            accessor: 'totalInstance',
            width: '200px',
            isSortable: true,
            accessorForTextFilter: 'sqlServerInstancesText',
            renderCell: (cellData: any, rowData: any) => (
                <div>
                    {cellData && rowData?.sqlServerInstancesText && cellData !== 0 ? (
                        <>
                            {/* <Typography variant="Semibold_14">
                                    {cellData === 1 ? cellData + ' instance' : cellData + ' instances'}
                                </Typography> */}
                            <Typography variant="Regular_13">{rowData?.sqlServerInstancesText}</Typography>
                        </>
                    ) : (
                        ''
                    )}
                    {!cellData || !rowData?.sqlServerInstancesText ? GENERAL.NOT_AVAILABLE : ''}
                </div>
            )
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            width: '236px',
            filterOptions: getFilterOptions(hostTableRows, 'serverInstallationMode'),
            renderCell: (cellData: string, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '4',
            Header: 'Attached EC2 nodes',
            accessor: 'instanceListText',
            isSortable: true,
            width: '329px',
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => renderInstanceListText(cellData, rowData, styles)
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpcName',
            isSortable: true,
            width: '150px',
            renderCell: (cellData: any, rowData: any) => renderVpcText(cellData, rowData, styles)
        },
        {
            id: '6',
            Header: 'SSM connectivity',
            accessor: 'ssmState',
            width: '200px',
            filterOptions: getFilterOptions(hostTableRows, 'ssmState'),
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.firstColText}>
                    {rowData?.ssmState === INVENTORY_STATUS.ONLINE && (
                        <>
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            <Typography variant="Regular_13">{rowData?.ssmState}</Typography>
                        </>
                    )}
                    {rowData?.ssmState === INVENTORY_STATUS.OFFLINE && (
                        <>
                            <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            <Typography variant="Regular_13">{rowData?.ssmState}</Typography>

                            <div className={styles.ssmOffline}>
                                <Popover
                                    popoverClass=""
                                    children={
                                        <div>
                                            <Typography variant="Regular_14">{GENERAL.SSM_NO_CONNECTION[0]}</Typography>
                                            <Button
                                                className={styles.ssmLink}
                                                variant="link"
                                                onClick={() =>
                                                    window.open(SSM_TROUBLESHOOTING_LINK, '_blank', 'noopener')
                                                }
                                            >
                                                {GENERAL.SSM_NO_CONNECTION[1]}
                                            </Button>
                                        </div>
                                    }
                                    trigger="hover"
                                    delayHide={200}
                                    interactive
                                    isAppendedToBody
                                    container={<TooltipIcon />}
                                />
                            </div>
                        </>
                    )}
                </div>
            )
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => renderEstimatedCost(cellData, rowData, styles)
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'credentialName'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'accountId'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            filterOptions: getFilterOptions(hostTableRows, 'regionName'),
            width: '254px',
            renderCell: (cellData: any, rowData: any) => renderCellData(cellData, rowData, styles)
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: hostTableRows,
        pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialColumnState: tableManageColumnState.hostTable,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                const { disableOptionDatabase, disableMessageDatabase } = findDatabaseOption(rowData);
                const menu = [
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
