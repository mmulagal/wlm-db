import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useRef, useState } from 'react';
import {
    TableTopBar,
    Typography,
    useDialog,
    useTable,
    Button,
    Popover,
    DsTypography,
    DsFlashingDotsLoader,
    DsButton,
    postBlueXPMessage,
    BlueXPListeners
} from '@netapp/design-system';
import { useManageMssqlInstanceMutation, usePrepareHostMutation } from '../../../../utils/apiService';
import { GENERAL } from '../../../../utils/appConstants';
import { formatSizeTwoPrecision } from '../../../../utils/utilityFunctions';
import {
    checkForAnyAOAG,
    checkForAnySSD,
    checkForMixedStorageType,
    handleManageInstances,
    renderCellData,
    renderEstimatedCost,
    renderInstanceListText,
    renderVpcText,
    sortInventoryTableData
} from '../../InventoryUtilsV2';
import store from '../../../../store/store';
import { setSelectedFilterValue, setSelectedInventoryTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    SSM_TROUBLESHOOTING_LINK,
    WLF_TO_FORM_NAVIGATE,
    WLF_TO_PROTECT_NAVIGATE
} from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import ManagedHostDialog from '../../InventoryTable/ManagedHostDialog/ManagedHostDialog';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { ColumnProps, Table } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useNavigate } from 'react-router-dom';
import { initialHostsTableColState } from '../../../../utils/manageColumnUtils';

const HostTable = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const [tableData, setTableData] = useState<any>([]);

    const { setDialog, closeDialog } = useDialog();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading } = useAppSelector(state => state.inventoryV2);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const { isDemoMode } = useAppSelector(state => state.auth);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);

    const [loading, setLoading] = useState(false);

    const [manageInstanceApi] = useManageMssqlInstanceMutation();
    const [prepareHostApi] = usePrepareHostMutation();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading
        );
    }, [
        databaseHostsLoading,
        isDiscoverInProgress,
        fullHostDataLoading,
        isManagedHostListLoading,
        fsxCredentialStatusLoading
    ]);

    useEffect(() => {
        if (inventoryTableData) {
            let result: any = [];
            Object.keys(inventoryTableData).map((key: string) => {
                if (removeSecNodeDiscoveredList.includes(key)) {
                    return;
                }
                if (inventoryTableData[key]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                    return;
                }
                let instanceList: any = [];
                let instanceNameList: any = [];
                let vpcIdAndNameText = '';
                const allocatedCapacity = inventoryTableData[key]?.allocatedCapacity || '';
                inventoryTableData[key]?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(row?.name + ' | ID: ' + row?.id);
                    } else if (row?.id) {
                        instanceList.push(GENERAL.NOT_AVAILABLE + ' | ID: ' + row?.id);
                    }
                });
                if (inventoryTableData[key]?.vpcId && inventoryTableData[key]?.vpcName) {
                    vpcIdAndNameText = inventoryTableData[key]?.vpcName + ' | ID: ' + inventoryTableData[key]?.vpcId;
                } else if (inventoryTableData[key]?.vpcId) {
                    vpcIdAndNameText = GENERAL.NOT_AVAILABLE + ' | ID: ' + inventoryTableData[key]?.vpcId;
                } else {
                    vpcIdAndNameText = GENERAL.NOT_AVAILABLE + ' | ID: ' + GENERAL.NOT_AVAILABLE;
                }
                const rowData = {
                    ...inventoryTableData[key],
                    sqlServerInstancesText:
                        inventoryTableData[key]?.totalInstance !== 0
                            ? inventoryTableData[key]?.managedInstance +
                              ' out of ' +
                              inventoryTableData[key]?.totalInstance
                            : '',
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    vpcIdAndNameText: vpcIdAndNameText,
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : '',
                    nameForSorting: inventoryTableData[key]?.name?.toLowerCase()
                };
                result.push(rowData);
            });
            // sort it based on action and whether it is disable or enable
            setTableData(sortInventoryTableData(result));
        } else {
            setTableData([]);
        }
    }, [inventoryTableData]);

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={`Manage database host ${rowData?.name} instances`}
                content={<ManagedHostDialog dialogData={rowData} />}
                primaryButton={INVENTORY_ACTIONS.MANAGE}
                secondaryButton={'Close'}
                callback={() => {
                    const updatedState = store.getState();
                    const manageHostSelectedRows = updatedState?.inventoryV2?.manageHostSelectedRows;
                    const selectedInstanceNames = manageHostSelectedRows.map((row: any) => row?.databaseInstanceName);
                    handleManageInstances(
                        rowData,
                        selectedInstanceNames,
                        dispatch,
                        styles,
                        manageInstanceApi,
                        prepareHostApi
                    );
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
                primaryButtonDisabled={false}
                dialogFrom="managedHost"
            />
        );
    };

    const manageDisableMsg = (
        rowData: any,
        checkForAllManaged: boolean,
        checkForAllUnDetectInstance: boolean,
        checkForAllUnDetectOrManageInstance: boolean,
        checkForAllUnManagedInstance: boolean,
        checkForAllFsxnManagedInstance: boolean,
        checkForAllStorageType: boolean
    ) => {
        //Condition if installation mode is AOAG than disable manage
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && rowData?.serverInstallationMode === GENERAL.AOAG) {
            return GENERAL.AOAG_MANAGE_DISABLE;
        }
        //Condition for if all managed then showing disable managed button with tooltip
        if (rowData?.action && checkForAllManaged) {
            return GENERAL.ALL_MANAGED_TEXT;
        }
        //Check for all un-detect instances and storage type is N/A
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && checkForAllUnDetectInstance) {
            return GENERAL.ALL_UNDETECT_TEXT;
        }

        //Check for all un-detect or managedinstances and storage type is N/A
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && checkForAllUnDetectOrManageInstance) {
            return GENERAL.NO_UNMANAGED_TO_MANAGE;
        }

        //Check for all Explore Savings undetected rows
        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && checkForAllUnDetectInstance) {
            return GENERAL.ALL_ES_UNDETECTED_ROWS;
        }

        //Check for any FSXW Explore Savings that is AOAG. FSXW is only supported for standalone and FCI.
        if (
            rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS &&
            !checkForAllUnDetectInstance &&
            rowData?.storageType === GENERAL.FSX_FOR_WINDOWS &&
            checkForAnyAOAG(rowData)
        ) {
            return GENERAL.ALL_ES_FSXW_AOAG_ROWS;
        } else if (
            rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS &&
            rowData?.storageType === GENERAL.FSX_FOR_WINDOWS &&
            !checkForAnySSD(rowData)
        ) {
            return GENERAL.NON_SSD_FSXW_MSG;
        }

        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && checkForMixedStorageType(rowData)) {
            return GENERAL.MIXED_STORAGE_ES_MSG;
        }

        //Condition if storage type is not known and it is still loading for manage case
        if (
            rowData?.action === INVENTORY_ACTIONS.MANAGE &&
            !checkForAllManaged &&
            checkForAllFsxnManagedInstance &&
            rowData?.loading &&
            !checkForAllStorageType
        ) {
            return GENERAL.INVENTORY_LOADING_DISABLED;
        } else if (
            rowData?.action === INVENTORY_ACTIONS.MANAGE &&
            !checkForAllManaged &&
            checkForAllFsxnManagedInstance
        ) {
            //Condition if all fsxn are managed and remaining storage type is unmanaged
            return GENERAL.ALL_FSXN_MANAGED_TEXT;
        }

        //Normal use case to show dialog or move to explore savings
        if (
            rowData?.action &&
            !checkForAllManaged &&
            !rowData?.actionDisable &&
            rowData.ssmState !== INVENTORY_STATUS.OFFLINE &&
            rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS
        ) {
            return GENERAL.MANAGED_SUPPORT_FOR_EBS_FSXW;
        }

        if (
            rowData?.action &&
            !checkForAllManaged &&
            !rowData?.actionDisable &&
            rowData.ssmState !== INVENTORY_STATUS.OFFLINE &&
            rowData?.action !== INVENTORY_ACTIONS.EXPLORE_SAVINGS
        ) {
            return '';
        }

        // if (
        //     rowData?.action &&
        //     !checkForAllManaged &&
        //     rowData?.actionDisable &&
        //     rowData.ssmState !== INVENTORY_STATUS.OFFLINE
        // ) {
        //     return (
        //         <div
        //             className={styles.detectManageDisable}
        //             id="inventory-table-option"
        //             title={rowData?.detectOptionDisableMsg}
        //         >
        //             <Typography variant="Regular_14" className={styles.textStyle}>
        //                 {rowData?.action}
        //             </Typography>
        //         </div>
        //     );
        // }
    };

    const findManageOption = (rowData: any) => {
        let disableOption = false;
        let disableMessage: any = '';
        const checkForAllManaged = rowData?.sqlServerInstances?.every(
            (item: any) => item?.statusColText === INVENTORY_STATUS.MANAGED
        );
        const checkForAllUnDetectInstance = rowData?.sqlServerInstances?.every(
            (item: any) => item?.statusColText === INVENTORY_STATUS.UNDETECTED
        );
        const checkForAllUnDetectOrManageInstance = rowData?.sqlServerInstances?.every(
            (item: any) =>
                item?.statusColText === INVENTORY_STATUS.UNDETECTED || item?.statusColText === INVENTORY_STATUS.MANAGED
        );
        const checkForAllUnManagedInstance = rowData?.sqlServerInstances?.every(
            (item: any) => item?.statusColText === INVENTORY_STATUS.UNMANAGED
        );
        const checkForAllFsxnManagedInstance = rowData?.sqlServerInstances?.every((item: any) => {
            return (
                (item?.statusColText === INVENTORY_STATUS.MANAGED && item?.fileSystemType === GENERAL.FSX_FOR_ONTAP) ||
                (item?.statusColText !== INVENTORY_STATUS.MANAGED && item?.fileSystemType !== GENERAL.FSX_FOR_ONTAP)
            );
        });
        const checkForAllStorageType = rowData?.sqlServerInstances?.every(
            (item: any) => item?.fileSystemType && item?.fileSystemType !== GENERAL.NOT_AVAILABLE
        );

        disableMessage = manageDisableMsg(
            rowData,
            checkForAllManaged,
            checkForAllUnDetectInstance,
            checkForAllUnDetectOrManageInstance,
            checkForAllUnManagedInstance,
            checkForAllFsxnManagedInstance,
            checkForAllStorageType
        );
        if (disableMessage) {
            disableOption = true;
        }
        return { disableOption, disableMessage };
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
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP ||
                                rowData?.status === INVENTORY_STATUS.ONLINE) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN ||
                                rowData?.status === INVENTORY_STATUS.OFFLINE) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <DsTypography variant="Regular_13">
                                {rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ? INVENTORY_STATUS.ONLINE
                                    : rowData?.status === INVENTORY_STATUS.STOPPED ||
                                      rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ? INVENTORY_STATUS.OFFLINE
                                    : rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
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
            filterOptions: 'auto',
            width: '228px',
            renderCell: (cellData: any) => {
                return (
                    <div>
                        <Typography variant="Regular_13">{cellData || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: 'Managed instances',
            accessor: 'totalInstance',
            width: '200px',
            isSortable: true,
            accessorForTextFilter: 'sqlServerInstancesText',
            renderCell: (cellData: any, rowData: any) => {
                return (
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
                );
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            width: '236px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '4',
            Header: 'Attached EC2 nodes',
            accessor: 'instanceListText',
            isSortable: true,
            width: '329px',
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => {
                return renderInstanceListText(cellData, rowData, styles);
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpcName',
            isSortable: true,
            width: '150px',
            renderCell: (cellData: any, rowData: any) => {
                return renderVpcText(cellData, rowData, styles);
            }
        },
        {
            id: '6',
            Header: 'SSM connectivity',
            accessor: 'ssmState',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.firstColText}>
                        {rowData?.ssmState === INVENTORY_STATUS.ONLINE && (
                            <>
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                                <Typography variant="Regular_13">{rowData?.ssmState}</Typography>
                            </>
                        )}
                        {rowData?.ssmState === INVENTORY_STATUS.OFFLINE && (
                            <>
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                                <Typography variant="Regular_13">{rowData?.ssmState}</Typography>

                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass={''}
                                        children={
                                            <div>
                                                <Typography variant="Regular_14">
                                                    {GENERAL.SSM_NO_CONNECTION[0]}
                                                </Typography>
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
                                        interactive={true}
                                        isAppendedToBody={true}
                                        container={<TooltipIcon />}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                );
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            isSortable: true,
            width: '200px',
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
            }
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            width: '254px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: tableData,
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialColumnState: initialHostsTableColState,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                const { disableOption, disableMessage } = findManageOption(rowData);
                const menu = [
                    {
                        id: 'manage',
                        displayName: 'Manage',
                        disabled: disableOption,
                        infoText: disableMessage
                    },
                    {
                        id: 'viewInstances',
                        displayName: 'View instances'
                    },
                    {
                        id: 'viewDatabases',
                        displayName: 'View databases'
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

                                    if (menuId === 'manage') {
                                        handleDialog(rowData);
                                    }
                                    if (menuId === 'viewInstances') {
                                        dispatch(setSelectedInventoryTab('Instances'));
                                        dispatch(
                                            setSelectedFilterValue({
                                                flag: true,
                                                value: rowData?.name,
                                                filterType: 'single'
                                            })
                                        );
                                    }
                                    if (menuId === 'viewDatabases') {
                                        dispatch(setSelectedInventoryTab('Databases'));
                                        dispatch(
                                            setSelectedFilterValue({
                                                flag: true,
                                                value: rowData?.name,
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
            if ((tableData || []).length % pageSize === 1) {
                tableProps.pagination?.gotoPage(0);
            }
        }
        setResetPage(false);
    }, [resetPage]);

    return (
        <>
            <div className={styles.inventoryTable}>
                <div
                    //  @ts-ignore
                    className={styles.table}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Hosts"
                        singularTitle="Host"
                        exportToCsvOptions={{ fileName: 'hostTable.csv' }}
                        className={styles.topBarStyle}
                        subTitle="This table may display duplicate records for the same resource, as each resource can be linked to multiple sets of credentials."
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
                        //@ts-ignore
                        tableProps={tableProps}
                        isDoubleRow={true}
                    />
                </div>
            </div>
        </>
    );
};

export default HostTable;
