import { Button, Spinner, Table, TableTopBar, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UnmanagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useEffect, useState } from 'react';
import DatabaseEstimatedCost from '../../DatabaseHomePage/DatabaseTable/DatabaseEstimatedCost';
import { useAppSelector } from '../../../store/storeHooks';
import { STATUS_CONST } from '../../../utils/consts';
import { useDispatch } from 'react-redux';

import {
    databaseTableSort,
    formatFractionalNumber,
    formatSizeOnePrecision,
    initialColStateManagedHosts
} from '../../../utils/utilityFunctions';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';

const UnmanagedHosts = () => {
    const dispatch = useDispatch();

    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    const databaseHostsList = useAppSelector(state => state.databaseHome.databaseHostsList);

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);

    const [manageLoading, setManageLoading] = useState<any>({});

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const manageHost = (manageRow: any) => {
        if (!manageLoading[manageRow?.id]) {
            manageLoading[manageRow?.id] = true;
        }
        setManageLoading(manageLoading);
        setTimeout(() => {
            stopLoading(manageRow);
        }, 3000);
    };

    const stopLoading = (manageRow: any) => {
        if (manageLoading[manageRow?.id]) {
            manageLoading[manageRow?.id] = false;
        }
        setManageLoading(manageLoading);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.SUCCESS,
                message: `Host "${manageRow?.name}" successfully moved to managed hosts tab`
            })
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
            width: '200px',
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
            width: '188px',
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
            width: '188px',
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
            width: '188px',
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
            width: '188px',
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
            accessor: 'allocatedCapacity',
            isSortable: true,
            width: '194px',
            renderCell: (cellData: string) => {
                return cellData ? formatSizeOnePrecision(cellData) : GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '8',
            Header: 'Instance name',
            accessor: 'topology.ec2Details',
            isSortable: true,
            width: '235px',
            renderCell: (cellData: any) => {
                const instance = cellData ? cellData[0] : null;
                return (
                    <>
                        {instance && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>ID: {instance?.id}</TooltipInfo>
                                <Typography variant="Regular_14">{instance?.name}</Typography>
                            </div>
                        )}
                        {!instance && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '9',
            Header: 'VPC',
            accessor: 'topology.vpcId',
            isSortable: true,
            width: '235px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{cellData}</TooltipInfo>
                                <Typography variant="Regular_14">{cellData}</Typography>
                            </div>
                        )}
                        {!cellData && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '10',
            Header: 'Availability',
            accessor: 'topology.availability',
            isSortable: true,
            width: '235px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{cellData?.azList}</TooltipInfo>
                                <Typography variant="Regular_14">{cellData?.type}</Typography>
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
            width: '235px',
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
            width: '182px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.manageHostCol} onClick={() => manageHost(rowData)}>
                        {rowData?.id in manageLoading && manageLoading[rowData?.id] && (
                            <Spinner className={styles.loading} />
                        )}
                        {!manageLoading[rowData?.id] && (
                            <Typography variant="Regular_14" className={styles.textStyle}>
                                Manage host
                            </Typography>
                        )}
                    </div>
                );
            }
        },
        initialColumnState: initialColStateManagedHosts,
        isLazyLoading: databaseHostsLoading || databaseJobsLoading
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
            <div className={styles.unmanagedHosts}>
                <div
                    //  @ts-ignore
                    className={styles.table}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Unmanaged hosts"
                        singularTitle="Unmanaged host"
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

export default UnmanagedHosts;
