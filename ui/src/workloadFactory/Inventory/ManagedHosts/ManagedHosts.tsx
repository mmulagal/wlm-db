import { Table, TableTopBar, TooltipInfo, Typography, useDialog, useTable } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS, STATUS_CONST, FSX_DEPLOYMENT_MODE } from '../../../utils/consts';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useRemoveMSSQLMutation } from '../../../utils/apiService';
import { setRefetchJobSummaryApi } from '../../../store/mssql/msSqlActionSlice';
import { useDispatch } from 'react-redux';
import { addDatabaseHosts, selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import { databaseTableSort, formatFractionalNumber, formatSizeOnePrecision } from '../../../utils/utilityFunctions';
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

const ManagedHosts = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { databaseHostsData, databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const databaseHostsList = useAppSelector(state => state.databaseHome.databaseHostsList);
    const { managedHostInitialColumns } = useAppSelector(state => state.inventory);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [removeDatabaseHosts] = useRemoveMSSQLMutation();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);

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
                id: 'observe',
                displayName: 'Observe',
                disabled: true,
                tagAdded: true,
                tag: <ComingSoon />
            }
            // {
            //     id: 'remove',
            //     displayName: 'Remove',
            //     disabled: row?.status === STATUS_CONST.DOWN || isDemoMode ? false : true
            // }
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
                return (
                    <div>
                        <Typography variant="Semibold_14">{rowData?.name || GENERAL.NOT_AVAILABLE}</Typography>
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
                            <Typography variant="Regular_13">{rowData?.status || GENERAL.NOT_AVAILABLE}</Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">
                                {rowData?.topology?.serverType || GENERAL.NOT_AVAILABLE}
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
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protectionText',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;
                const totalDbCount = rowData?.databaseCount || 0;
                let protectedChk = false;
                if (
                    protectionData?.isAwsBackUpEnabled ||
                    protectionData?.isFsxOntapSnapshotsEnabled ||
                    protectionData?.isSqlNativeEnabled
                ) {
                    protectedChk = true;
                }

                let protectionDbCount = 0;
                let protectionPercent = 0;
                if (protectionData?.isAwsBackUpEnabled || protectionData?.isFsxOntapSnapshotsEnabled) {
                    protectionDbCount = totalDbCount;
                    protectionPercent = 100;
                } else if (protectionData?.isSqlNativeEnabled) {
                    protectionDbCount = protectionData?.protectedDatabases || 0;
                    protectionPercent =
                        totalDbCount > 0 && protectionDbCount <= totalDbCount
                            ? (protectionDbCount / totalDbCount) * 100
                            : 0;
                }

                return (
                    <>
                        {protectionData && (
                            <div className={styles.colText}>
                                {protectedChk && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        {protectionDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[0] +
                                            totalDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[1]}
                                    </TooltipInfo>
                                )}
                                <div className={styles.protection}>
                                    <Typography variant="Regular_14">
                                        {protectedChk
                                            ? formatFractionalNumber(protectionPercent) + '% ' + GENERAL.PROTECTION
                                            : GENERAL.NOT_PROTECTED}
                                    </Typography>
                                </div>
                            </div>
                        )}
                        {!protectionData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_PERFORMANCE,
            accessor: 'performanceText',
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </Typography>
                        )}
                        {!cellData && notAvailable()}
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
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <Typography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </Typography>
                        )}
                        {!cellData && notAvailable()}
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
                const costData = rowData?.estimatedUsageCost;
                const totalCost = costData?.compute + costData?.storage + costData?.connectivity + costData?.others;
                return (
                    <>
                        {costData && (
                            <div className={styles.cost}>
                                <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                                    {EstimatedCostPopover({ ...costData, totalCost: totalCost })}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{`$ ${formatFractionalNumber(
                                    totalCost,
                                    2
                                )}`}</Typography>
                            </div>
                        )}
                        {!costData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'storage.size',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: string) => {
                return cellData ? formatSizeOnePrecision(cellData) : GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'topology',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any) => {
                let instanceIds: any = [];
                let instanceNames: any = [];
                cellData?.ec2Details?.map((row: any) => {
                    instanceIds.push(row?.id);
                    instanceNames.push(row?.name);
                });
                return (
                    <>
                        {cellData?.ec2Details && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                    ID: {instanceIds.join(',')}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{instanceNames.join(',')}</Typography>
                            </div>
                        )}
                        {!cellData?.ec2Details && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '9',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'topology',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData?.vpcId && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                    {cellData?.vpcCidr}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{cellData?.vpcName}</Typography>
                            </div>
                        )}
                        {!cellData?.vpcId && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '10',
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'topology.fileSystemDeploymentMode',
            isSortable: true,
            width: '212px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: FSX_DEPLOYMENT_MODE.SINGLE_AZ_1 },
                { label: GENERAL.MULTI_AZ, value: FSX_DEPLOYMENT_MODE.MULTI_AZ_1 }
            ],
            renderCell: (cellData: any, rowData: any) => {
                const azList = rowData?.topology?.availabilityZones
                    ? rowData?.topology?.availabilityZones.join(',')
                    : '';
                return (
                    <>
                        {cellData && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                                <Typography variant="Regular_14">
                                    {cellData === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                                        ? GENERAL.SINGLE_AZ
                                        : cellData === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                                        ? GENERAL.MULTI_AZ
                                        : ''}
                                </Typography>
                            </div>
                        )}
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '11',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'topology.serverInstallationMode',
            isSortable: true,
            width: '212px',
            filterOptions: 'auto',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
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
                    className={styles.table}
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
