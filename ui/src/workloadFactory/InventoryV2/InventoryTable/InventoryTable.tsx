import {
    DsFlashingDotsLoader,
    Popover,
    Table,
    TableTopBar,
    Typography,
    useDialog,
    useTable
} from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import styles from './InventoryTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS, STATUS_CONST } from '../../../utils/consts';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useDispatch } from 'react-redux';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';

import { isSmbProtocol, expandTableRow, formatSizeTwoPrecision } from '../../../utils/utilityFunctions';
import { updateResourceId } from '../../../store/authSlice';
import { resetWorkloadFactoryResourceData } from '../../../store/workloadFactory/workloadFactoryResourceSlice';

import { setManagedHostColState, setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setDBHostName
} from '../../../store/workloadFactory/createNewDBSlice';
import { renderAllocatedCapacity, renderEstimatedCost } from '../../Inventory/InventoryUtils';
import ManagedHostSubTable from './ManagedHostSubTable/ManagedHostSubTable';
import ManagedHostDialog from './ManagedHostDialog/ManagedHostDialog';
import OfflineComponent from './OfflineComponent/OfflineComponent';
import { onClickESHost } from '../../ExploreSavings/ExploreSavingsUtils';
import { useRunOnce } from '../../../common/hooks/useRunOnce';

const InventoryTable = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const [tableData, setTableData] = useState<any>([]);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);
    const [isManageButtonDisable, setIsManageButtonDisable] = useState(false);
    const [scrollPos, setScrollPos] = useState(0);

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { isManagedHostListLoading } = useAppSelector(state => state.inventoryV2);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(databaseHostsLoading || isDiscoverInProgress || fullHostDataLoading || isManagedHostListLoading);
    }, [databaseHostsLoading, isDiscoverInProgress, fullHostDataLoading, isManagedHostListLoading]);

    //For scroll sync
    useRunOnce(() => {
        const handleOuterScroll = () => {
            setScrollPos(currentTable[0].scrollLeft);
        };

        const currentTable = document.querySelectorAll("[class^='Table-module_horizontal-scroll__']");

        if (currentTable[0]) {
            //@ts-ignore
            currentTable[0].addEventListener('scroll', handleOuterScroll);
        }

        return () => {
            if (currentTable[0]) {
                //@ts-ignore
                currentTable[0].removeEventListener('scroll', handleOuterScroll);
            }
        };
    });

    const mockData = [
        {
            id: '1',
            serverInstance: 'SQL Server instance 1',
            status: 'Unmanaged',
            storageType: 'FSx for ONTAP'
        },
        { id: '2', serverInstance: 'SQL Server instance 2', status: 'inProgress', storageType: 'FSx for ONTAP' },
        { id: '3', serverInstance: 'SQL Server instance 3', status: 'Unmanaged', storageType: 'FSx for ONTAP' },
        { id: '4', serverInstance: 'SQL Server instance 4', status: 'Unmanaged', storageType: 'FSx for ONTAP' },
        { id: '5', serverInstance: 'SQL Server instance 5', status: 'managed', storageType: 'FSx for ONTAP' }
    ];

    //Use effect to check weather to disable manage button in dialog
    useEffect(() => {
        const checkButtonStatus = mockData.some((item: any) => item.status === 'Unmanaged');

        setIsManageButtonDisable(!checkButtonStatus);
    }, []);

    useEffect(() => {
        if (inventoryTableData) {
            let result: any = [];
            Object.keys(inventoryTableData).map((key: string) => {
                let instanceList: any = [];
                const allocatedCapacity = inventoryTableData[key]?.allocatedCapacity || '';
                inventoryTableData[key]?.ec2Details?.map((row: any) => {
                    instanceList.push(row?.name + ' | ' + row?.id);
                });
                const rowData = {
                    ...inventoryTableData[key],
                    sqlServerInstancesText:
                        '(' +
                        inventoryTableData[key]?.managedInstance +
                        ' out of ' +
                        inventoryTableData[key]?.totalInstance +
                        ' managed)',
                    instanceListText: instanceList.join(','),
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : ''
                };
                result.push(rowData);
            });
            setTableData(result);
        } else {
            setTableData([]);
        }
    }, [inventoryTableData]);

    const menuItems = (row: any) => {
        let isSmb = isSmbProtocol(row?.storage?.fsxn?.protocol);
        return [
            {
                id: 'viewOverview',
                displayName: 'View instance',
                disabled: row?.status === STATUS_CONST.UP ? false : true
            },
            {
                id: 'viewDatabaseList',
                displayName: 'View databases',
                disabled: row?.status === STATUS_CONST.UP ? false : true
            },
            {
                id: 'createNewUserDatabase',
                displayName: GENERAL.CREATE_USER_DB_TITLE,
                disabled: row?.status === STATUS_CONST.UP && !isSmb ? false : true,
                infoText: isSmb ? GENERAL.SMB_PROTOCOL_DISABLED : ''
            },
            {
                id: 'unmanage',
                displayName: 'Unmanage',
                disabled: row?.status === STATUS_CONST.DOWN || isDemoMode ? false : true
            }
        ];
    };

    const ExpandedRow = ({ rowData }: any) => {
        if (rowData?.ssmState === 'Online') {
            return <ManagedHostSubTable rowId={rowData?.id} scrollPosition={scrollPos} />;
        }
        return <OfflineComponent />;
    };

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={'Manage data base host <data base name> instances'}
                content={<ManagedHostDialog dialogData={mockData} />}
                primaryButton={'Manage'}
                secondaryButton={'Close'}
                callback={() => {
                    console.log('action');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
                primaryButtonDisabled={isManageButtonDisable}
            />
        );
    };

    const lastColJSX = (
        rowData: any,
        checkForAllManaged: boolean,
        checkForAllUnDetectInstance: boolean,
        checkForAllFileSystemNA: boolean
    ) => {
        //Condition for if all managed then showing disable managed button with tooltip
        if (rowData?.action && checkForAllManaged) {
            return (
                <Popover
                    popoverClass={styles['copy-popover']}
                    children={GENERAL.ALL_UNDETECT_TEXT}
                    trigger="hover"
                    container={
                        <div className={styles.detectManageDisable}>
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                {rowData?.action}
                            </Typography>
                        </div>
                    }
                />
            );
        }
        //Check for all un-detect instances and storage type is N/A
        if (rowData?.action && checkForAllUnDetectInstance && checkForAllFileSystemNA) {
            return (
                <Popover
                    popoverClass={styles['copy-popover']}
                    children={GENERAL.ALL_MANAGED_TEXT}
                    trigger="hover"
                    container={
                        <div className={styles.detectManageDisable}>
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                {rowData?.action}
                            </Typography>
                        </div>
                    }
                />
            );
        }
        //Normal use case to show dialog or move to explore savings
        if (rowData?.action && !checkForAllManaged && !rowData?.actionDisable && rowData.ssmState !== 'Offline') {
            return (
                <div
                    className={styles.detectManage}
                    onClick={() => {
                        if (rowData?.action === 'Explore savings') {
                            onClickESHost(dispatch, rowData, isDemoMode);
                        } else {
                            handleDialog();
                        }
                    }}
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {rowData?.action}
                    </Typography>
                </div>
            );
        }
        if (rowData?.action && !checkForAllManaged && rowData?.actionDisable && rowData.ssmState !== 'Offline') {
            return (
                <div className={styles.detectManageDisable} title={rowData?.detectOptionDisableMsg}>
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {rowData?.action}
                    </Typography>
                </div>
            );
        }
    };

    const lastColDetails = () => {
        return {
            id: '9',
            Header: '',
            accessor: '',
            width: '184px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const checkForAllManaged = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.statusColText === 'Managed'
                );
                const checkForAllUnDetectInstance = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.statusColText === 'Undetected'
                );
                const checkForAllFileSystemNA = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.fileSystemType === 'N/A'
                );

                return lastColJSX(rowData, checkForAllManaged, checkForAllUnDetectInstance, checkForAllFileSystemNA);
            }
        };
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '0',
            Header: '',
            accessor: 'name',
            width: '56px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
                const currentRowState = rowsState[rowData.id];
                return (
                    <>
                        <div className={styles.arrow}>
                            <ArrowIcon
                                className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
                    </>
                );
            }
        },
        {
            id: '1',
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'status',
            isSortable: true,
            width: '228px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.firstColText}>
                            {rowData?.status === STATUS_CONST.ONLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.OFFLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <Typography variant="Regular_13">
                                {rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
                            </Typography>
                            {/* <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">
                                {rowData?.topology?.serverType}
                                {!rowData?.topology?.serverType && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.topology?.serverType && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                            </Typography> */}
                        </div>
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: 'SQL server instances',
            accessor: 'totalInstance',
            width: '216px',
            isSortable: true,
            accessorForTextFilter: 'sqlServerInstancesText',
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <div>
                        {cellData && rowData?.sqlServerInstancesText && (
                            <>
                                <Typography variant="Semibold_14">{cellData + ' instances'}</Typography>
                                <Typography variant="Semibold_14">{rowData?.sqlServerInstancesText}</Typography>
                            </>
                        )}
                        {(!cellData || !rowData?.sqlServerInstancesText) && GENERAL.NOT_AVAILABLE}
                    </div>
                );
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            width: '216px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'instanceListText',
            isSortable: true,
            width: '212px',
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => {
                let instanceList: any = cellData ? cellData.split(',') : null;
                return (
                    <>
                        {instanceList && (
                            <div>
                                {instanceList?.[0] && (
                                    <Typography
                                        variant="Regular_13"
                                        className={`${styles.colText}`}
                                        title={instanceList[0]}
                                    >
                                        {instanceList[0]}
                                    </Typography>
                                )}
                                {instanceList?.[1] && (
                                    <Typography
                                        variant="Regular_13"
                                        className={`${styles.colText}`}
                                        title={instanceList[1]}
                                    >
                                        {instanceList[1]}
                                    </Typography>
                                )}
                            </div>
                        )}
                        {!instanceList && rowData?.loading && <DsFlashingDotsLoader />}
                        {!instanceList && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpcName',
            isSortable: true,
            width: '140px',
            renderCell: (cellData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '6',
            Header: 'SSM connectivity',
            accessor: 'ssmState',
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.firstColText}>
                        {rowData?.ssmState === STATUS_CONST.ONLINE && (
                            <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                        )}
                        {rowData?.ssmState === STATUS_CONST.OFFLINE && (
                            <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                        )}
                        <Typography variant="Regular_13">{rowData?.ssmState}</Typography>
                    </div>
                );
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            isSortable: true,
            width: '168px',
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'allocatedCapacityText',
            isSortable: true,
            width: '216px',
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: tableData,
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: false,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.jobMenuPopover}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                            menuItems={menuItems(rowData)}
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

                                    if (menuId === 'viewOverview') {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                        dispatch(selectedTabSelection(WLF_TABS.OVERVIEW));
                                        dispatch(updateResourceId(rowData.id));
                                        dispatch(setDBHostName(rowData?.name));
                                        dispatch(resetWorkloadFactoryResourceData());
                                    }

                                    if (menuId === 'viewDatabaseList') {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                        dispatch(selectedTabSelection(WLF_TABS.DATABASE_LIST));
                                        dispatch(updateResourceId(rowData.id));
                                        dispatch(setDBHostName(rowData?.name));
                                        dispatch(resetWorkloadFactoryResourceData());
                                    }

                                    if (menuId === 'createNewUserDatabase') {
                                        dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                        dispatch(updateResourceId(rowData.id));
                                        dispatch(setDBHostName(rowData?.name));
                                        navigate('../create-new-user');
                                    }

                                    if (menuId === 'remove') {
                                        // ToDo
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            }
        },
        isLazyLoading: loading
    });

    useEffect(() => {
        dispatch(setManagedHostColState(tableProps.columnsState));

        let count = 0;

        for (const key in tableProps.columnsState) {
            if (
                tableProps.columnsState[key].hasOwnProperty('isHidden') &&
                tableProps.columnsState[key].isHidden === false
            ) {
                count++;
            }
        }
        if (count > 7) {
            setTableHorizontalScroll(true);
        } else {
            setTableHorizontalScroll(false);
        }
    }, [tableProps.columnsState]);

    useEffect(() => {
        if (resetPage) {
            if ((tableData || []).length % pageSize === 1) {
                tableProps.pagination?.gotoPage(0);
            }
        }
        setResetPage(false);
    }, [resetPage]);

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading'
    };

    return (
        <>
            <div className={styles.inventoryTable}>
                <div
                    //  @ts-ignore
                    className={
                        tableHorizontalScroll
                            ? `${styles.table} ${styles.tableScroll}`
                            : `${styles.table} ${styles.tableScrollRevert}`
                    }
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Database hosts"
                        singularTitle="Database host"
                        className={styles.topBarStyle}
                    />
                    <Table
                        {...tableComponentProps}
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div>
        </>
    );
};

export default InventoryTable;
