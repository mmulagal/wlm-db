import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useRef, useState } from 'react';
import { TableTopBar, Typography, useDialog, useTable, Button, Popover } from '@netapp/design-system';
import { useManageMssqlInstanceMutation, usePrepareHostMutation } from '../../../../utils/apiService';
import { GENERAL } from '../../../../utils/appConstants';
import { formatSizeTwoPrecision } from '../../../../utils/utilityFunctions';
import {
    checkForAnyAOAG,
    checkForAnySSD,
    checkForMixedStorageType,
    getPartnerNodeEc2InstanceId,
    handleManageNotification,
    handleManageTriggerNotification,
    installModuleNotification,
    renderCellData,
    renderEstimatedCost,
    renderInstanceListText,
    renderVpcText,
    sortInventoryTableData,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import store from '../../../../store/store';
import { setInProgressInstances, setInventoryTableData } from '../../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    INVENTORY_ACTIONS,
    INVENTORY_STATUS,
    PARTNER_NODE,
    PREPARE_API_ENDPOINT,
    SSM_TROUBLESHOOTING_LINK
} from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import ManagedHostDialog from '../../InventoryTable/ManagedHostDialog/ManagedHostDialog';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { onClickESHost } from '../../../ExploreSavings/ExploreSavingsUtils';
import { ColumnProps, Table } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';

const HostTable = () => {
    const dispatch = useDispatch();

    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const [tableData, setTableData] = useState<any>([]);

    const { setDialog, closeDialog } = useDialog();

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading } = useAppSelector(state => state.inventoryV2);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const { isDemoMode } = useAppSelector(state => state.auth);
    const { isWorkloadFactory } = useAppSelector(state => state.auth);

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
        if (rowData?.resourceId && isDemoMode) {
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
                if (res?.error?.status === 422 || res?.error?.status === 500) {
                    const updatedState = store.getState();
                    // handle prepare API
                    const errorList = res?.error?.data?.message?.split('\n');
                    let prepareApiRequired = false;
                    let sourceNodePrepareRequired = false;
                    let partnerNodeEc2Id;
                    errorList.map((errorItem: any) => {
                        if (errorItem.includes(PREPARE_API_ENDPOINT)) {
                            prepareApiRequired = true;
                            if (errorItem.includes(PARTNER_NODE)) {
                                partnerNodeEc2Id = getPartnerNodeEc2InstanceId(errorItem);
                            } else {
                                sourceNodePrepareRequired = true;
                            }
                        }
                    });
                    if (prepareApiRequired) {
                        if (sourceNodePrepareRequired) {
                            prepareHostApi({
                                credentialId: updatedState?.headers?.headerSelectedCred?.data?.credentialsId,
                                regionId: updatedState?.headers?.headerSelectedRegion?.label2,
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
                        }
                        if (partnerNodeEc2Id) {
                            prepareHostApi({
                                credentialId: updatedState?.headers?.headerSelectedCred?.data?.credentialsId,
                                regionId: updatedState?.headers?.headerSelectedRegion?.label2,
                                instanceId: partnerNodeEc2Id
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
                        }
                    } else {
                        handleManageNotification(instances, [], errorList[0], isDetected, dispatch, styles);
                    }
                } else {
                    handleManageNotification(instances, [], '', isDetected, dispatch, styles);
                }
            }
        });
    };

    const divRef = useRef<HTMLDivElement>(null);
    const [divWidth, setDivWidth] = useState(0);

    const updateDivWidth = () => {
        if (divRef.current) {
            setDivWidth(divRef.current.offsetWidth);
        }
    };

    useEffect(() => {
        // Set initial width
        updateDivWidth();

        // Update width on window resize
        window.addEventListener('resize', updateDivWidth);

        // Cleanup event listener on component unmount
        return () => {
            window.removeEventListener('resize', updateDivWidth);
        };
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
                dialogFrom="managedHost"
            />
        );
    };

    const lastColJSX = (
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
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && checkForAllUnDetectInstance) {
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

        //Check for all un-detect or managedinstances and storage type is N/A
        if (rowData?.action === INVENTORY_ACTIONS.MANAGE && checkForAllUnDetectOrManageInstance) {
            return (
                <TooltipComponent title={GENERAL.NO_UNMANAGED_TO_MANAGE} placement="bottom" width="320px" height="90px">
                    <div className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }

        //Check for all Explore Savings undetected rows
        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && checkForAllUnDetectInstance) {
            return (
                <TooltipComponent
                    title={GENERAL.ALL_ES_UNDETECTED_ROWS}
                    placement="bottom"
                    width="320px"
                    height="100px"
                >
                    <div id="inventory-table-option" className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }

        //Check for any FSXW Explore Savings that is AOAG. FSXW is only supported for standalone and FCI.
        if (
            rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS &&
            !checkForAllUnDetectInstance &&
            rowData?.storageType === GENERAL.FSX_FOR_WINDOWS &&
            checkForAnyAOAG(rowData)
        ) {
            return (
                <TooltipComponent title={GENERAL.ALL_ES_FSXW_AOAG_ROWS} placement="bottom" width="340px" height="70px">
                    <div id="inventory-table-option" className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        } else if (
            rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS &&
            rowData?.storageType === GENERAL.FSX_FOR_WINDOWS &&
            !checkForAnySSD(rowData)
        ) {
            return (
                <TooltipComponent title={GENERAL.NON_SSD_FSXW_MSG} placement="bottom" width="360px" height="50px">
                    <div id="inventory-table-option" className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }

        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS && checkForMixedStorageType(rowData)) {
            return (
                <TooltipComponent title={GENERAL.MIXED_STORAGE_ES_MSG} placement="bottom" width="260px" height="50px">
                    <div id="inventory-table-option" className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        }

        //Condition if storage type is not known and it is still loading for manage case
        if (
            rowData?.action === INVENTORY_ACTIONS.MANAGE &&
            !checkForAllManaged &&
            checkForAllFsxnManagedInstance &&
            rowData?.loading &&
            !checkForAllStorageType
        ) {
            return (
                <TooltipComponent
                    title={GENERAL.INVENTORY_LOADING_DISABLED}
                    placement="bottom"
                    width="170px"
                    height="33px"
                >
                    <div className={styles.detectManageDisable}>
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {rowData?.action}
                        </Typography>
                    </div>
                </TooltipComponent>
            );
        } else if (
            rowData?.action === INVENTORY_ACTIONS.MANAGE &&
            !checkForAllManaged &&
            checkForAllFsxnManagedInstance
        ) {
            //Condition if all fsxn are managed and remaining storage type is unmanaged
            return (
                <TooltipComponent title={GENERAL.ALL_FSXN_MANAGED_TEXT} placement="bottom" width="320px" height="93px">
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
                    id={
                        rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS
                            ? 'explore-savings-inventory-table'
                            : 'inventory-table-option'
                    }
                    onClick={() => {
                        if (rowData?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                            onClickESHost(dispatch, rowData, isWorkloadFactory);
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
                <div
                    className={styles.detectManageDisable}
                    id="inventory-table-option"
                    title={rowData?.detectOptionDisableMsg}
                >
                    <Typography variant="Regular_14" className={styles.textStyle}>
                        {rowData?.action}
                    </Typography>
                </div>
            );
        }
    };

    const lastColDetails = () => {
        return {
            id: '11',
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
                const checkForAllUnDetectOrManageInstance = rowData?.sqlServerInstances?.every(
                    (item: any) =>
                        item?.statusColText === INVENTORY_STATUS.UNDETECTED ||
                        item?.statusColText === INVENTORY_STATUS.MANAGED
                );
                const checkForAllUnManagedInstance = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.statusColText === INVENTORY_STATUS.UNMANAGED
                );
                const checkForAllFsxnManagedInstance = rowData?.sqlServerInstances?.every((item: any) => {
                    return (
                        (item?.statusColText === INVENTORY_STATUS.MANAGED &&
                            item?.fileSystemType === GENERAL.FSX_FOR_ONTAP) ||
                        (item?.statusColText !== INVENTORY_STATUS.MANAGED &&
                            item?.fileSystemType !== GENERAL.FSX_FOR_ONTAP)
                    );
                });
                const checkForAllStorageType = rowData?.sqlServerInstances?.every(
                    (item: any) => item?.fileSystemType && item?.fileSystemType !== GENERAL.NOT_AVAILABLE
                );
                return lastColJSX(
                    rowData,
                    checkForAllManaged,
                    checkForAllUnDetectInstance,
                    checkForAllUnDetectOrManageInstance,
                    checkForAllUnManagedInstance,
                    checkForAllFsxnManagedInstance,
                    checkForAllStorageType
                );
            }
        };
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
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            id: '1',
            Header: 'Host type',
            accessor: 'hostType',
            isSortable: true,
            width: '228px',
            renderCell: (cellData: any) => {
                return (
                    <div>
                        <Typography variant="Semibold_14">{'Microsoft SQL Server'}</Typography>
                    </div>
                );
            }
        },
        {
            id: '2',
            Header: 'Managed instances',
            accessor: 'totalInstance',
            width: '216px',
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
            Header: 'Attached EC2 nodes',
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
            width: '150px',
            renderCell: (cellData: any, rowData: any) => {
                return renderVpcText(cellData, rowData, styles);
            }
        },
        {
            id: '6',
            Header: 'SSM connectivity',
            accessor: 'ssmState',
            width: '180px',
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
            width: '168px',
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
            }
        },
        {
            id: '8',
            Header: 'AWS credentials',
            accessor: 'awsCredentials',
            isSortable: true,
            width: '168px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '9',
            Header: 'AWS account',
            accessor: 'awsAccount',
            isSortable: true,
            width: '168px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '10',
            Header: 'Region',
            accessor: 'region',
            isSortable: true,
            width: '168px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
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
            <div className={styles.hostTable}>
                <div
                    //  @ts-ignore
                    className={
                        tableHorizontalScroll
                            ? `${styles.table} ${styles.tableScroll}`
                            : `${styles.table} ${styles.tableScrollRevert}`
                    }
                    ref={divRef}
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Hosts"
                        singularTitle="Host"
                        className={styles.topBarStyle}
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
