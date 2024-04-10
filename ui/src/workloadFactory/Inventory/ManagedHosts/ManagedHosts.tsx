import {
    DsFlashingDotsLoader,
    Table,
    TableTopBar,
    TooltipInfo,
    Typography,
    useDialog,
    useTable
} from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS, STATUS_CONST, FSX_DEPLOYMENT_MODE, DETECT_HOST_VAR } from '../../../utils/consts';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useRemoveMSSQLMutation } from '../../../utils/apiService';
import { setRefetchJobSummaryApi } from '../../../store/mssql/msSqlActionSlice';
import { useDispatch } from 'react-redux';
import { addDatabaseHosts, selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { databaseTableSort, formatFractionalNumber, formatSizeOnePrecision, isAwsBackupEnabled } from '../../../utils/utilityFunctions';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import { updateResourceId } from '../../../store/authSlice';
import { resetWorkloadFactoryResourceData } from '../../../store/workloadFactory/workloadFactoryResourceSlice';

import { setManagedHostColState, setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import EstimatedCostPopover from '../EstimatedCostPopover/EstimatedCostPopover';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setDBHostName
} from '../../../store/workloadFactory/createNewDBSlice';
import { renderEstimatedCost, renderProtectionColumn } from '../InventoryUtils';

const ManagedHosts = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { databaseHostsData, databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const databaseHostsList = useAppSelector(state => state.databaseHome.databaseHostsList);
    const { managedHostInitialColumns } = useAppSelector(state => state.inventory);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [removeDatabaseHosts] = useRemoveMSSQLMutation();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);

    const menuItems = (row: any) => {
        return [
            {
                id: 'viewOverview',
                displayName: 'View host overview',
                disabled: row?.status === STATUS_CONST.UP ? false : true
            },
            {
                id: 'viewDatabaseList',
                displayName: 'View databases list',
                disabled: row?.status === STATUS_CONST.UP ? false : true
            },
            {
                id: 'createNewUserDatabase',
                displayName: GENERAL.CREATE_USER_DB_TITLE,
                disabled: row?.status === STATUS_CONST.UP ? false : true
            },
            {
                id: 'remove',
                displayName: 'Remove',
                disabled: row?.status === STATUS_CONST.DOWN || isDemoMode ? false : true
            }
        ];
    };

    // To delete MSSQL Resources
    const deleteMssqlResource = (id: string, type: string) => {
        setResetPage(true);
        // removeDatabaseHosts delete API call when data getting from database-hosts API
        removeDatabaseHosts(id).then((data: any) => {
            if (!data?.error) {
                dispatch(setRefetchJobSummaryApi(true));
                const newList = databaseHostsData?.filter((val: any) => val?.id !== id);
                dispatch(addDatabaseHosts({ databaseHostsData: newList, databaseHostsLoading: false, undefined }));
            }
        });
    };

    const handleRemoveDialog = (row: any) => {
        setDialog(
            <DialogComponent
                header={`${GENERAL.REMOVE_DATABASE_HOST} "${row?.name || row?.id}"`}
                content={<Typography variant="Regular_14">{`${GENERAL.REMOVE_CONFIG_TEXT}`}</Typography>}
                primaryButton={GENERAL.REMOVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    deleteMssqlResource(row?.id, row?.type);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'status',
            isSortable: true,
            width: '280px',
            isSticky: true,
            accessorForTextFilter: 'databaseHostname',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.sqlServerInstances?.[0]?.sqlServerName || rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.firstColText}>
                            {rowData?.status === STATUS_CONST.UP && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['up']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.DOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['down']}`}></div>
                            )}
                            {rowData?.status === STATUS_CONST.INITIALIZING && (
                                <div
                                    className={`${styles.statusIcon} ${styles['circle']} ${styles['initializing']}`}
                                ></div>
                            )}
                            {rowData?.status === STATUS_CONST.FAILED && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['failed']}`}></div>
                            )}
                            <Typography variant="Regular_13">
                                {rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                            </Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">
                                {rowData?.topology?.serverType}
                                {!rowData?.topology?.serverType && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.topology?.serverType && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                            </Typography>
                        </div>
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'topology.fileSystemType',
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (!cellData) {
                    const typeList: string[] = [];
                    rowData?.sqlServerInstances?.[0]?.storage?.map((storageObj: any) => {
                        if (storageObj.type === DETECT_HOST_VAR.FSXN && !typeList.includes(GENERAL.FSX_FOR_ONTAP)) {
                            typeList.push(GENERAL.FSX_FOR_ONTAP);
                        }
                        if (storageObj.type === DETECT_HOST_VAR.EBS && !typeList.includes(GENERAL.EBS)) {
                            typeList.push(GENERAL.EBS);
                        }
                        if (storageObj.type === DETECT_HOST_VAR.FSXW && !typeList.includes(GENERAL.FSX_FOR_WINDOWS)) {
                            typeList.push(GENERAL.FSX_FOR_WINDOWS);
                        }
                    });
                    return typeList ? typeList.join(', ') : cellData || GENERAL.NOT_AVAILABLE;
                } else {
                    return cellData || GENERAL.NOT_AVAILABLE;
                }
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protectionText',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                return renderProtectionColumn(cellData, rowData, styles);
            }
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_PERFORMANCE,
            accessor: 'performanceText',
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </Typography>
                        )}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_STORAGE_SAVINGS,
            accessor: 'storageSavingsText',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </Typography>
                        )}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '6',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'storage.size',
            isSortable: true,
            width: '212px',
            accessorForTextFilter: 'sizeformat',
            renderCell: (cellData: string | number, rowData: any) => {
                return (
                    <>
                        {!rowData?.loading &&
                            (cellData || cellData === 0 ? formatSizeOnePrecision(cellData) : GENERAL.NOT_AVAILABLE)}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                    </>
                );
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'topology',
            isSortable: true,
            width: '212px',
            accessorForTextFilter: 'instanceNames',
            renderCell: (cellData: any, rowData: any) => {
                let instanceIds: any = [];
                let instanceNames: any = [];
                cellData?.ec2Details?.map((row: any) => {
                    instanceIds.push(row?.id);
                    instanceNames.push(row?.name);
                });
                return (
                    <>
                        {instanceNames.length > 0 ? (
                            <div className={styles.colText}>
                                {instanceIds.length > 0 && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        ID: {instanceIds.join(',')}
                                    </TooltipInfo>
                                )}
                                <Typography variant="Regular_14">{instanceNames.join(',')}</Typography>
                            </div>
                        ) : (
                            rowData?.ec2InstanceName || notAvailable()
                        )}
                    </>
                );
            }
        },
        {
            id: '9',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpcNames',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                let vpcName = '';
                let vpcCidr = '';
                if (rowData?.topology?.vpcName) {
                    vpcName = rowData?.topology?.vpcName;
                    vpcCidr = rowData?.topology?.vpcCidr;
                } else if (rowData?.vpc?.name) {
                    vpcName = rowData?.vpc?.name;
                    vpcCidr = rowData?.vpc?.cidrBlock;
                }
                return (
                    <>
                        {vpcName && (
                            <div className={styles.colText}>
                                {vpcCidr && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>{vpcCidr}</TooltipInfo>
                                )}
                                <Typography variant="Regular_14">{vpcName}</Typography>
                            </div>
                        )}
                        {!vpcName && rowData?.loading && <DsFlashingDotsLoader />}
                        {!vpcName && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '10',
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'azType',
            isSortable: true,
            width: '212px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: GENERAL.SINGLE_AZ },
                { label: GENERAL.MULTI_AZ, value: GENERAL.MULTI_AZ }
            ],
            renderCell: (cellData: any, rowData: any) => {
                let azList = [];
                let azType = '';
                if (rowData?.topology?.fileSystemDeploymentMode) {
                    azList = rowData?.topology?.availabilityZones ? rowData?.topology?.availabilityZones.join(',') : '';
                    azType =
                        rowData?.topology?.fileSystemDeploymentMode === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                            ? GENERAL.SINGLE_AZ
                            : rowData?.topology?.fileSystemDeploymentMode === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                            ? GENERAL.MULTI_AZ
                            : '';
                } else {
                    azList = rowData?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.zones
                        ? rowData?.[0]?.deploymentTypes?.[0]?.zones.join(',')
                        : '';
                    const deploymentType = rowData?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
                    azType =
                        deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                            ? GENERAL.SINGLE_AZ
                            : deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                            ? GENERAL.MULTI_AZ
                            : '';
                }

                return (
                    <>
                        {azType && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                                <Typography variant="Regular_14">{azType}</Typography>
                            </div>
                        )}
                        {!azType && rowData?.loading && <DsFlashingDotsLoader />}
                        {!azType && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '11',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            isSortable: true,
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <>
                        {cellData && cellData === 'FCI' ? GENERAL.FAILOVER_CLUSTER_INSTANCES : cellData}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableSort(databaseHostsList) || [],
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
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
                                        handleRemoveDialog(rowData);
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
        initialColumnState: managedHostInitialColumns,
        isLazyLoading: databaseHostsLoading
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
            if ((databaseHostsList || []).length % pageSize === 1) {
                tableProps.pagination?.gotoPage(0);
            }
        }
        setResetPage(false);
    }, [resetPage]);

    const tableComponentProps = {
        lazyLoadingText: 'Loading'
    };

    return (
        <>
            <div className={styles.managedHosts}>
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
                        pluralTitle={GENERAL.MANAGED_HOSTS_HEADING}
                        singularTitle={GENERAL.MANAGED_HOST_HEADING}
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

export default ManagedHosts;
