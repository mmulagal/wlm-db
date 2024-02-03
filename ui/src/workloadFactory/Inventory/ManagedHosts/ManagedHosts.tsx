import { Table, TableTopBar, TooltipInfo, Typography, useDialog, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import DatabaseEstimatedCost from '../../DatabaseHomePage/DatabaseTable/DatabaseEstimatedCost';
import { useAppSelector } from '../../../store/storeHooks';
import { DB_HOME_DATA_TYPE, STATUS_CONST } from '../../../utils/consts';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useRemoveDatabaseJobsMutation, useRemoveMSSQLMutation } from '../../../utils/apiService';
import { setRefetchJobSummaryApi } from '../../../store/mssql/msSqlActionSlice';
import { useDispatch } from 'react-redux';
import {
    addDatabaseHosts,
    addDatabaseJobs,
    selectedTabSelection
} from '../../../store/workloadFactory/databaseHomeSlice';
import { databaseTableSort, formatFractionalNumber } from '../../../utils/utilityFunctions';
import { useNavigate } from 'react-router-dom';
import { updateResourceId } from '../../../store/authSlice';
import { resetWorkloadFactoryResourceData } from '../../../store/workloadFactory/workloadFactoryResourceSlice';

import DatabaseHosts from '../databaseHosts.json';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';

const ManagedHosts = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const databaseJobsData: any[] = [];
    const databaseHostsList: any[] = DatabaseHosts?.items;

    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();

    const [removeDatabaseHosts] = useRemoveMSSQLMutation();
    const [removeDatabaseJobs] = useRemoveDatabaseJobsMutation();

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
                displayName: 'View database list',
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
        if (type === DB_HOME_DATA_TYPE.JOBS) {
            // removeDatabaseJobs delete API call when data getting from jobs API
            removeDatabaseJobs(id).then((data: any) => {
                if (!data?.error) {
                    dispatch(setRefetchJobSummaryApi(true));
                    const newList = databaseJobsData?.filter((val: any) => val?.id !== id);
                    dispatch(addDatabaseJobs({ databaseJobsData: newList, databaseJobsLoading: false, undefined }));
                }
            });
        } else {
            // removeDatabaseHosts delete API call when data getting from database-hosts API
            removeDatabaseHosts(id).then((data: any) => {
                if (!data?.error) {
                    dispatch(setRefetchJobSummaryApi(true));
                    const newList = databaseHostsList?.filter((val: any) => val?.id !== id);
                    dispatch(addDatabaseHosts({ databaseHostsData: newList, databaseHostsLoading: false, undefined }));
                }
            });
        }
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

    const lastColDetails = () => {
        return {
            id: '12',
            Header: '',
            accessor: '',
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
                                        dispatch(setSelectedHeaderTab('Overview'));
                                        dispatch(selectedTabSelection('Overview'));
                                        dispatch(updateResourceId(rowData.id));
                                        dispatch(resetWorkloadFactoryResourceData());
                                    }

                                    if (menuId === 'viewDatabaseList') {
                                        dispatch(setSelectedHeaderTab('Overview'));
                                        dispatch(selectedTabSelection('Database list'));
                                        dispatch(updateResourceId(rowData.id));
                                        dispatch(resetWorkloadFactoryResourceData());
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
            },
            showHide: true,
            width: '56px',
            isSticky: true
        };
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
                        <div className={styles.colText}>
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
            width: '184px',
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
            width: '184px',
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
                                <div className={styles.protection}>
                                    <Typography variant="Regular_14">
                                        {protectedChk
                                            ? formatFractionalNumber(protectionPercent) + '% ' + GENERAL.PROTECTION
                                            : GENERAL.NOT_PROTECTED}
                                    </Typography>
                                </div>
                                {protectedChk && (
                                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                        {protectionDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[0] +
                                            totalDbCount +
                                            GENERAL.PROTECTION_TOOLTIP[1]}
                                    </TooltipInfo>
                                )}
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
            width: '184px',
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
            width: '184px',
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
            width: '184px',
            renderCell: (cellData: any, rowData: any) => {
                const costData = rowData?.estimatedUsageCost;
                const totalCost = costData?.compute + costData?.storage + costData?.connectivity + costData?.others;
                return (
                    <>
                        {costData && (
                            <div className={styles.cost}>
                                <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                                    {DatabaseEstimatedCost({ ...costData, totalCost: totalCost })}
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
            Header: 'Allocated Capacity',
            accessor: 'topology.allocatedCapacity',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '8',
            Header: 'Instance name',
            accessor: 'topology.istanceName',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '9',
            Header: 'VPC',
            accessor: 'topology.vpc',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '10',
            Header: 'Availability',
            accessor: 'topology.availability',
            isSortable: true,
            width: '184px',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '11',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'topology.serverInstallationMode',
            isSortable: true,
            width: '204px',
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        lastColDetails()
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: databaseTableSort(databaseHostsList) || [],
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: false
        // selectionType: SELECTION_TYPE.MULTIPLE,
    });

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
                    className={databaseHostsList?.length ? `${styles.table} ${styles.tableScroll}` : `${styles.table}`}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle={GENERAL.DATABASE_HOSTS}
                        singularTitle={GENERAL.DATABASE_HOST}
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
