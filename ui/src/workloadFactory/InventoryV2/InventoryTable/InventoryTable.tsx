import {
    Button,
    DsFlashingDotsLoader,
    DsTooltipInfo,
    Popover,
    Table,
    TableTopBar,
    Typography,
    useDialog,
    useTable
} from '@netapp/design-system';

import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import styles from './InventoryTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import {
    STATUS_CONST,
    INVENTORY_STATUS,
    INVENTORY_ACTIONS,
    API_ERRORS,
    SSM_TROUBLESHOOTING_LINK
} from '../../../utils/consts';
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
import {
    errorNotification,
    installModuleNotification,
    renderAllocatedCapacity,
    renderCellData,
    renderEstimatedCost,
    renderInstanceListText
} from '../../Inventory/InventoryUtils';
import ManagedHostSubTable from './ManagedHostSubTable/ManagedHostSubTable';
import ManagedHostDialog from './ManagedHostDialog/ManagedHostDialog';
import OfflineComponent from './OfflineComponent/OfflineComponent';
import { onClickESHost } from '../../ExploreSavings/ExploreSavingsUtils';

import {
    handleManageNotification,
    handleManageTriggerNotification,
    sortInventoryTableData,
    updateInstanceStatus
} from '../InventoryUtilsV2';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { useManageMssqlInstanceMutation, usePrepareHostMutation } from '../../../utils/apiService';
import store from '../../../store/store';
import {
    setInProgressInstances,
    setInventoryExpandedRowHostData,
    setInventoryTableData,
    setUnManagedPerfInstanceIdsList
} from '../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { StatusObjInterface } from '../../../utils/types/inventoryV2Types';

const InventoryTable = () => {
    const dispatch = useDispatch();

    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const [tableData, setTableData] = useState<any>([]);

    const { setDialog, closeDialog } = useDialog();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading } = useAppSelector(state => state.inventoryV2);
    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);

    const [loading, setLoading] = useState(false);

    const [manageInstanceApi] = useManageMssqlInstanceMutation();
    const [prepareHostApi] = usePrepareHostMutation();

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
                let instanceList: any = [];
                const allocatedCapacity = inventoryTableData[key]?.allocatedCapacity || '';
                inventoryTableData[key]?.ec2Details?.map((row: any) => {
                    if (row?.name && row?.id) {
                        instanceList.push(row?.name + ' | ' + row?.id);
                    } else if (row?.id) {
                        instanceList.push(row?.id);
                    }
                });
                const rowData = {
                    ...inventoryTableData[key],
                    sqlServerInstancesText:
                        inventoryTableData[key]?.totalInstance !== 0
                            ? '(' +
                              inventoryTableData[key]?.managedInstance +
                              ' out of ' +
                              inventoryTableData[key]?.totalInstance +
                              ' managed)'
                            : '',
                    instanceListText: instanceList.join(','),
                    allocatedCapacityText: allocatedCapacity ? formatSizeTwoPrecision(allocatedCapacity) : ''
                };
                result.push(rowData);
            });
            // sort it based on action and whether it is disable or enable
            setTableData(sortInventoryTableData(result));
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

    const handleManageInstances = (rowData: any, instances: any, isDetected?: boolean | undefined) => {
        const updatedState = store.getState();
        const { inProgressInstances } = updatedState.inventoryV2;
        const inProgressIds = instances.map((instance: any) => `${rowData?.ec2InstanceId}_${instance}`);
        dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), ...inProgressIds])));
        handleManageTriggerNotification(instances, dispatch, styles);
        let payload: any = {
            ec2InstanceId: rowData?.ec2InstanceId,
            databaseInstanceNames: instances
        };
        if (rowData?.resourceId) {
            payload.databaseHostId = rowData.resourceId;
        }
        manageInstanceApi({
            credentialsId: updatedState?.headers?.headerSelectedCred?.data?.credentialsId,
            regionId: updatedState?.headers?.headerSelectedRegion?.label2,
            payload
        }).then((res: any) => {
            const updatedState = store.getState();
            const { inProgressInstances } = updatedState?.inventoryV2;
            let updatedInProgressInstances = new Set([...inProgressInstances]);
            inProgressIds.map((inProgressId: any) => {
                updatedInProgressInstances.delete(inProgressId);
            });
            dispatch(setInProgressInstances(updatedInProgressInstances));
            if (res?.data?.items) {
                let successFullInstances: any = [];
                let failedInstances: any = [];
                res?.data?.items.map((item: any) => {
                    if (item.status === NOTIFICATION_TYPES.SUCCESS) {
                        successFullInstances.push(item);
                    } else {
                        failedInstances.push(item);
                    }
                });
                handleManageNotification(instances, successFullInstances, '', isDetected, dispatch, styles);
                const updatedInventoryTableData = updateInstanceStatus(
                    'manage',
                    rowData,
                    instances,
                    successFullInstances,
                    res?.data?.resourceId
                );
                dispatch(setInventoryTableData(updatedInventoryTableData));
            } else if (res?.error) {
                if (res?.error?.status === 424) {
                    // handle prepare API
                    const errorList = res?.error?.data?.message?.split('\n');
                    const isOnlyPowerShellError =
                        errorList?.length === 1 && errorList[0].includes(API_ERRORS.POWERSHELL_7);
                    if (!isOnlyPowerShellError) {
                        prepareHostApi({
                            credentialId: headerSelectedCred?.data?.credentialsId,
                            regionId: headerSelectedRegion?.label2,
                            instanceId: rowData?.ec2InstanceId
                        }).then((prepareRes: any) => {
                            if (prepareRes && !prepareRes?.error) {
                                const msgObj =
                                    instances.length === 1
                                        ? isDetected
                                            ? GENERAL.PREPARE_DETECTED_INSTANCE_INFO
                                            : GENERAL.PREPARE_INSTANCE_INFO
                                        : isDetected
                                        ? GENERAL.PREPARE_DETECTED_INSTANCES_INFO
                                        : GENERAL.PREPARE_INSTANCES_INFO;
                                installModuleNotification(
                                    styles,
                                    instances.length === 1 ? instances[0] : '',
                                    dispatch,
                                    msgObj
                                );
                            } else {
                                handleManageNotification(instances, [], '', isDetected, dispatch, styles);
                            }
                        });
                    } else {
                        handleManageNotification(instances, [], errorList[0], isDetected, dispatch, styles);
                    }
                } else {
                    handleManageNotification(instances, [], '', isDetected, dispatch, styles);
                }
            }
        });
    };

    const ExpandedRow = useCallback(({ rowData }: any) => {
        if (rowData?.ssmState === INVENTORY_STATUS.ONLINE || rowData?.totalInstance !== 0) {
            dispatch(setInventoryExpandedRowHostData(rowData));
            return <ManagedHostSubTable handleManageInstances={handleManageInstances} />;
        }
        return <OfflineComponent />;
    }, []);

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
                    handleManageInstances(rowData, selectedInstanceNames);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
                primaryButtonDisabled={false}
            />
        );
    };

    const addInstanceIdToGetPerf = (rowData: any) => {
        // First check if this is already opened or closed. If this data is already available or not.
        if (!unManagedPerfInstanceIdsList.includes(rowData?.ec2InstanceId)) {
            // If this has unmanaged rows or not ?
            let unmanagedRows = rowData?.sqlServerInstances?.filter(
                (per: any) => per?.statusColText === INVENTORY_STATUS.UNMANAGED
            );
            if (unmanagedRows && unmanagedRows?.length > 0 && rowData?.ec2InstanceId) {
                dispatch(
                    setUnManagedPerfInstanceIdsList([...unManagedPerfInstanceIdsList, ...[rowData?.ec2InstanceId]])
                );
            }
            // This has to be called even if any row is becoming unmanaged row or managed row
        }
    };

    const lastColJSX = (
        rowData: any,
        checkForAllManaged: boolean,
        checkForAllUnDetectInstance: boolean,
        checkForAllFileSystemNA: boolean
    ) => {
        //Condition if installation mode is AOAG than disable manage
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && rowData?.serverInstallationMode === GENERAL.AOAG) {
            return (
                <TooltipComponent title={GENERAL.AOAG_MANAGE_DISABLE} placement="bottom" width="320px" height="50px">
                    <div className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }
        //Condition for if all managed then showing disable managed button with tooltip
        if (rowData?.action && checkForAllManaged) {
            return (
                <TooltipComponent title={GENERAL.ALL_MANAGED_TEXT} placement="bottom" width="320px" height="90px">
                    <div className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }
        //Check for all un-detect instances and storage type is N/A
        if (rowData?.action && checkForAllUnDetectInstance && checkForAllFileSystemNA) {
            return (
                <TooltipComponent title={GENERAL.ALL_UNDETECT_TEXT} placement="bottom" width="320px" height="90px">
                    <div className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }
        //Normal use case to show dialog or move to explore savings
        if (
            rowData?.action &&
            !checkForAllManaged &&
            !rowData?.actionDisable &&
            rowData.ssmState !== INVENTORY_STATUS.OFFLINE
        ) {
            return (
                <div
                    className={styles.detectManage}
                    onClick={() => {
                        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                            onClickESHost(dispatch, rowData);
                        } else {
                            handleDialog(rowData);
                        }
                    }}
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {rowData?.action}
                    </Typography>
                </div>
            );
        }
        if (
            rowData?.action &&
            !checkForAllManaged &&
            rowData?.actionDisable &&
            rowData.ssmState !== INVENTORY_STATUS.OFFLINE
        ) {
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
                    (item: any) => item?.statusColText === INVENTORY_STATUS.MANAGED
                );
                const checkForAllUnDetectInstance = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.statusColText === INVENTORY_STATUS.UNDETECTED
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
                                    addInstanceIdToGetPerf(rowData);
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
                            {rowData?.status === INVENTORY_STATUS.ONLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.OFFLINE && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                            )}
                            <Typography variant="Regular_13">
                                {rowData?.status}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && 'Unknown'}
                            </Typography>
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
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div>
                        {cellData && rowData?.sqlServerInstancesText && cellData !== 0 ? (
                            <>
                                <Typography variant="Semibold_14">{cellData + ' instances'}</Typography>
                                <Typography variant="Semibold_14">{rowData?.sqlServerInstancesText}</Typography>
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
            width: '216px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
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
                return renderInstanceListText(cellData, rowData, styles);
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
                        {rowData?.ssmState === INVENTORY_STATUS.ONLINE && (
                            <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                        )}
                        {rowData?.ssmState === INVENTORY_STATUS.OFFLINE && (
                            <>
                                <div className={styles.ssmOffline}>
                                    <Popover
                                        popoverClass={''}
                                        children={
                                            <div>
                                                <Typography variant="Regular_14">
                                                    {GENERAL.SSM_NO_CONNECTION_MSG}
                                                </Typography>
                                                <Button
                                                    className={styles.ssmLink}
                                                    variant="link"
                                                    onClick={() =>
                                                        window.open(SSM_TROUBLESHOOTING_LINK, '_blank', 'noopener')
                                                    }
                                                >
                                                    {GENERAL.SSM_NO_CONNECTION_LINK}
                                                </Button>
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive={true}
                                        container={<TooltipIcon />}
                                    />
                                </div>

                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                            </>
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
            accessor: 'allocatedCapacity',
            isSortable: true,
            width: '216px',
            accessorForTextFilter: 'allocatedCapacityText',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(rowData?.allocatedCapacityText, rowData);
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
