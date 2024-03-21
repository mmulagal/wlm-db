import {
    Button,
    DsFlashingDotsLoader,
    Spinner,
    Table,
    TableTopBar,
    TooltipInfo,
    Typography,
    useTable
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UnmanagedHosts.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { DETECT_HOST_VAR, FSX_DEPLOYMENT_MODE, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';

import {
    formatFractionalNumber,
    formatSizeOnePrecision,
    formatUnamanagedHostList
} from '../../../utils/utilityFunctions';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import EstimatedCostPopover from '../EstimatedCostPopover/EstimatedCostPopover';
import {
    setMovedToManagedHost,
    setSelectedHeaderTab,
    setUnManagedHostColState
} from '../../../store/workloadFactory/inventorySlice';
import { useManageHostMutation } from '../../../utils/apiService';
import store from '../../../store/store';

const UnmanagedHosts = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const unManagedHostList = useAppSelector(state => state.inventory.unManagedHosts);
    const mssqlInstancesData = useAppSelector(state => state.inventory.mssqlInstancesData);
    const { unManagedHostInitialColumns } = useAppSelector(state => state.inventory);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);

    const [manageLoading, setManageLoading] = useState<any>({});
    const [manageHostApi] = useManageHostMutation();
    const [tableData, setTableData] = useState<any>([]);

    useEffect(() => {
        // Format data again on unIdentifiableHosts or fsxCredentialStatusObj change
        setTableData(formatUnamanagedHostList(unManagedHostList, mssqlInstancesData));
    }, [unManagedHostList, mssqlInstancesData]);

    const notAvailable = () => {
        return (
            <Typography variant="Regular_13" className={styles.colText}>
                {GENERAL.NOT_AVAILABLE}
            </Typography>
        );
    };

    const manageHost = async (rowData: any) => {
        const state = store.getState();
        const movedToManagedHost = state.inventory.movedToManagedHost;
        const name = rowData?.sqlServerInstances?.[0]?.sqlServerName;
        if (!manageLoading[rowData?.id]) {
            manageLoading[rowData?.id] = true;
            setManageLoading(manageLoading);
        }
        const result: any = await manageHostApi({
            credentialId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2,
            instanceId: rowData?.ec2InstanceId
        });
        if (result && !result?.error) {
            if (manageLoading[rowData?.id]) {
                manageLoading[rowData?.id] = false;
                setManageLoading(manageLoading);
            }
            dispatch(
                setMovedToManagedHost([
                    ...movedToManagedHost,
                    { instanceId: rowData?.ec2InstanceId, resourceId: result?.data?.resourceId }
                ])
            );
            const managedSuccessMsg = (
                <div className={styles.notification}>
                    {GENERAL.HOST_MANAGED_MOVED_SUCCESS[0]}
                    <span className={styles.bold}>{name}</span>
                    {GENERAL.HOST_MANAGED_MOVED_SUCCESS[1]}
                    <span className={styles.bold}>{GENERAL.HOST_MANAGED_MOVED_SUCCESS[2]}</span>
                    {GENERAL.HOST_MANAGED_MOVED_SUCCESS[3]}
                </div>
            );
            dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, message: managedSuccessMsg }));
        } else {
            if (manageLoading[rowData?.id]) {
                manageLoading[rowData?.id] = false;
                setManageLoading(manageLoading);
            }
            const managedFailedMsg = (
                <div className={styles.notification}>
                    {GENERAL.HOST_MOVED_FAILED[0]}
                    <span className={styles.bold}>{name}</span>
                    {GENERAL.HOST_MOVED_FAILED[1]}
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.JOB_MONITORING}.
                    </Button>
                </div>
            );
            dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: managedFailedMsg }));
        }
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
                const name = rowData?.sqlServerInstances?.[0]?.sqlServerName || rowData?.name;
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
                const hasFsx = rowData?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN
                );
                const hasEbs = rowData?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.EBS
                );
                return hasEbs && hasFsx
                    ? `${GENERAL.FSX_FOR_ONTAP}, ${GENERAL.EBS}`
                    : hasEbs
                    ? GENERAL.EBS
                    : hasFsx
                    ? GENERAL.FSX_FOR_ONTAP
                    : cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protectionText',
            isSortable: true,
            width: '188px',
            renderCell: (cellData: any, rowData: any) => {
                const isLoading = rowData?.loading;
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
                        {!protectionData && isLoading && <DsFlashingDotsLoader />}
                        {!protectionData && !isLoading && notAvailable()}
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
            width: '188px',
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
                        {!costData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!costData && !rowData?.loading && notAvailable()}
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
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <>
                        {cellData && formatSizeOnePrecision(cellData)}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'topology',
            isSortable: true,
            width: '235px',
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
            accessor: 'vpc',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any) => {
                return (
                    <>
                        {cellData?.name && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                    {cellData?.cidrBlock}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{cellData?.name}</Typography>
                            </div>
                        )}
                        {!cellData?.name && notAvailable()}
                    </>
                );
            }
        },
        {
            id: '10',
            Header: GENERAL.DB_HOST_AVAILABILITY,
            accessor: 'sqlServerInstances',
            isSortable: true,
            width: '212px',
            filterOptions: [
                { label: GENERAL.SINGLE_AZ, value: FSX_DEPLOYMENT_MODE.SINGLE_AZ_1 },
                { label: GENERAL.MULTI_AZ, value: FSX_DEPLOYMENT_MODE.MULTI_AZ_1 }
            ],
            renderCell: (cellData: any) => {
                const azList = cellData?.[0]?.deploymentTypes?.[0]?.zones
                    ? cellData?.[0]?.deploymentTypes?.[0]?.zones.join(',')
                    : '';
                const deploymentType = cellData?.[0]?.deploymentTypes?.[0]?.type;
                return (
                    <>
                        {deploymentType && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                                <Typography variant="Regular_14">
                                    {deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                                        ? GENERAL.SINGLE_AZ
                                        : deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                                        ? GENERAL.MULTI_AZ
                                        : ''}
                                </Typography>
                            </div>
                        )}
                        {!deploymentType && notAvailable()}
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
            renderCell: (cellData: string, rowData: any) => {
                const nodes = rowData?.sqlServerInstances?.[0]?.sqlServerNodes;
                let type = '';
                if (nodes && nodes.length > 1) {
                    type = GENERAL.FCI;
                } else if (nodes && nodes.length === 1) {
                    type = GENERAL.STANDALONE;
                }
                const rowValue = cellData || type;
                return (
                    <>
                        {rowValue}
                        {!rowValue && rowData?.loading && <DsFlashingDotsLoader />}
                        {!rowValue && !rowData?.loading && notAvailable()}
                    </>
                );
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: tableData || [],
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        manageColumnsProps: {
            width: '182px',
            renderCell: (cellData: any, rowData: any) => {
                const hasFsx = rowData?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN
                );
                return (
                    <>
                        {hasFsx && (
                            <div
                                className={styles.manageHostCol}
                                onClick={() => {
                                    manageHost(rowData);
                                }}
                            >
                                {rowData?.id in manageLoading && manageLoading[rowData?.id] && (
                                    <Spinner className={styles.loading} />
                                )}
                                {!manageLoading[rowData?.id] && (
                                    <Typography variant="Regular_14" className={styles.textStyle}>
                                        {GENERAL.MANAGE_HOST}
                                    </Typography>
                                )}
                            </div>
                        )}
                    </>
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
