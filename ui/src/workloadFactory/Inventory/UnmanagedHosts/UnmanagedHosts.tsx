import { Button, Spinner, Table, TableTopBar, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UnmanagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { STATUS_CONST } from '../../../utils/consts';
import { useDispatch } from 'react-redux';

import { databaseTableSort, formatFractionalNumber, formatSizeOnePrecision } from '../../../utils/utilityFunctions';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import EstimatedCostPopover from '../EstimatedCostPopover/EstimatedCostPopover';
import { setUnManagedHostColState } from '../../../store/workloadFactory/inventorySlice';

const UnmanagedHosts = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const unManagedHostList = useAppSelector(state => state.inventory.unManagedHosts);
    const { unManagedHostInitialColumns } = useAppSelector(state => state.inventory);

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
                const status = rowData?.sqlServerInstances?.[0]?.sqlServerState;
                const name = rowData?.sqlServerInstances?.[0]?.sqlServerInstance;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                        <div className={styles.firstColText}>
                            {status === GENERAL.JOB_STATUS_RUNNING && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['up']}`}></div>
                            )}
                            {status !== GENERAL.JOB_STATUS_RUNNING && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['down']}`}></div>
                            )}
                            <Typography variant="Regular_13">
                                {status
                                    ? status === GENERAL.JOB_STATUS_RUNNING
                                        ? GENERAL.DB_HOST_UP
                                        : GENERAL.DB_HOST_DOWN
                                    : GENERAL.NOT_AVAILABLE}
                            </Typography>
                            <div className={CommonStyles.separator} />
                            <Typography variant="Regular_13">{GENERAL.MSSQL}</Typography>
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
            renderCell: (cellData: string, rowData: any) => {
                const hasFsx = rowData?.sqlServerInstances?.[0]?.storage?.find((item: any) => item.type === 'FSXN');
                const hasEbs = rowData?.sqlServerInstances?.[0]?.storage?.find((item: any) => item.type === 'EBS');
                return hasEbs && hasFsx
                    ? `${GENERAL.FSX_FOR_ONTAP}, ${GENERAL.EBS}`
                    : hasEbs
                    ? GENERAL.EBS
                    : hasFsx
                    ? GENERAL.FSX_FOR_ONTAP
                    : 'N/A';
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
            width: '194px',
            renderCell: (cellData: string) => {
                return cellData ? formatSizeOnePrecision(cellData) : GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'topology',
            isSortable: true,
            width: '235px',
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
            width: '235px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData?.vpcId && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{cellData?.vpcId}</TooltipInfo>
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
            accessor: 'topology',
            isSortable: true,
            width: '235px',
            renderCell: (cellData: any) => {
                const azList = cellData?.availabilityZones ? cellData.availabilityZones.join(',') : '';
                return (
                    <>
                        {cellData?.fileSystemDeploymentMode && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                                <Typography variant="Regular_14">{cellData?.fileSystemDeploymentMode}</Typography>
                            </div>
                        )}
                        {!cellData?.fileSystemDeploymentMode && notAvailable()}
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
        rows: databaseTableSort(unManagedHostList) || [],
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        manageColumnsProps: {
            width: '182px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div
                        className={styles.manageHostCol}
                        onClick={() => {
                            //manageHost(rowData)
                        }}
                    >
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
        initialColumnState: unManagedHostInitialColumns,
        isLazyLoading: isDiscoverInProgress
    });

    useEffect(() => {
        dispatch(setUnManagedHostColState(tableProps.columnsState));
    }, [tableProps.columnsState]);

    useEffect(() => {
        if (resetPage) {
            if ((unManagedHostList || []).length % pageSize === 1) {
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
