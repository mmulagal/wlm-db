import { Spinner, Table, TableTopBar, TooltipInfo, Typography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './UnmanagedHosts.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useEffect, useState, useRef } from 'react';
import { useAppSelector } from '../../../store/storeHooks';
import { API_ERRORS, DETECT_HOST_VAR, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import {
    setMovedToManagedHost,
    setSelectedHeaderTab,
    setUnManagedHostColState
} from '../../../store/workloadFactory/inventorySlice';
import { useManageHostMutation, usePrepareHostMutation } from '../../../utils/apiService';
import store from '../../../store/store';
import {
    errorNotification,
    installModuleNotification,
    renderAllocatedCapacity,
    renderCellData,
    renderDeploymentModel,
    renderEstimatedCost,
    renderFileSystemType,
    renderInstanceName,
    renderProtectionColumn,
    renderUnmanagedAZ,
    renderUnmanagedHostName
} from '../InventoryUtils';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import {
    setSelectedDeploymentModel,
    setSelectedHostDetails,
    setSelectedInstanceId,
    setSelectedServerName
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import { setESInstanceData } from '../../ExploreSavings/ExploreSavingsUtils';

const UnmanagedHosts = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventory.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventory.isManagedHostListLoading);
    let unManagedHostFormatedList = useAppSelector(state => state.inventory.unmanagedFormatedData);
    const { unManagedHostInitialColumns } = useAppSelector(state => state.inventory);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const selectedDeploymentModel = useAppSelector(state => state.exploreSavings.selectedDeploymentModel);

    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);

    const [manageLoading, setManageLoading] = useState<any>({});
    const [manageHostApi] = useManageHostMutation();
    const [prepareHostApi] = usePrepareHostMutation();

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const isDemoCheck = (hasEbs: boolean) => {
        if (!isDemoMode) {
            return true;
        } else if (!hasEbs) {
            return true;
        } else {
            return false;
        }
    };
    const menuItems = (row: any, hasFsx: boolean, hasEbs: boolean) => {
        let isManageDisable = false;
        if (!hasFsx || (row?.id in manageLoading && manageLoading[row?.id])) {
            isManageDisable = true;
        }
        return [
            {
                id: 'manageHost',
                displayName: 'Manage host',
                disabled: isManageDisable,
                infoText: isManageDisable ? GENERAL.MANAGE_HOST_DISABLED : ''
            },
            {
                id: 'exploreSavings',
                displayName: 'Explore savings',
                disabled: isDemoCheck(hasEbs),
                infoText: !hasEbs && isDemoMode ? GENERAL.EXPLORE_SAVINGS_DISABLED : '',
                tagAdded: !isDemoMode && true,
                tag: !isDemoMode && <ComingSoon />
            }
        ];
    };

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
            let errorMessage: string = result?.error?.data?.message || '';
            let jobTriggered: boolean = false;
            if (result?.error?.status === 424 && !result?.error?.data?.message.includes(API_ERRORS.POWERSHELL_7)) {
                const prepareResult: any = await prepareHostApi({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instanceId: rowData?.ec2InstanceId
                });
                if (prepareResult && !prepareResult?.error) {
                    jobTriggered = true;
                } else {
                    jobTriggered = false;
                    errorMessage = prepareResult?.error?.data?.message;
                }
            }
            if (manageLoading[rowData?.id]) {
                manageLoading[rowData?.id] = false;
                setManageLoading(manageLoading);
            }
            const managedFailedMsg = (
                <div className={styles.notification}>
                    {GENERAL.HOST_MOVED_FAILED[0]}
                    <span className={styles.bold}>{name}</span>
                    {GENERAL.HOST_MOVED_FAILED[1]}
                    {errorMessage}
                </div>
            );
            if (jobTriggered) {
                installModuleNotification(styles, name, dispatch, GENERAL.PREPARE_HOST_INFO_TAB2);
            } else {
                errorNotification(dispatch, errorMessage, managedFailedMsg);
            }
        }
    };

    const exploreSavingsAction = (rowData: any) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
        dispatch(setSelectedInstanceId(rowData?.id));
        dispatch(
            setSelectedDeploymentModel(
                rowData?.serverInstallationMode?.toLowerCase() === 'standalone' ? 'standalone' : 'aoag'
            )
        );
        dispatch(setSelectedServerName(rowData.sqlServerInstances?.[0].sqlServerName || 'Server name'));
        setESInstanceData(rowData, isDemoMode, selectedDeploymentModel, dispatch);
    };

    const DatabasesColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'databaseServerName',
            isSortable: true,
            width: '280px',
            isSticky: true,
            accessorForTextFilter: 'databaseHostname',
            renderCell: (cellData: any, rowData: any) => {
                return renderUnmanagedHostName(cellData, rowData, styles);
            }
        },
        {
            id: '2',
            Header: GENERAL.DB_HOST_FILE_SYSTEM_TYPE,
            accessor: 'fileSystemType',
            width: '200px',
            filterOptions: 'auto',
            accessorForTextFilter: 'fileSystemType',
            renderCell: (cellData: string, rowData: any) => {
                return renderFileSystemType(cellData, rowData);
            }
        },
        {
            id: '3',
            Header: GENERAL.DB_HOST_PROTECTION,
            accessor: 'protectionText',
            isSortable: true,
            width: '188px',
            renderCell: (cellData: any, rowData: any) => {
                return renderProtectionColumn(cellData, rowData, styles);
            }
        },
        {
            id: '4',
            Header: GENERAL.DB_HOST_PERFORMANCE,
            accessor: 'performanceText',
            width: '188px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '5',
            Header: GENERAL.DB_HOST_STORAGE_SAVINGS,
            accessor: 'storageSavingsText',
            isSortable: true,
            width: '188px',
            renderCell: (cellData: any, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            id: '6',
            Header: GENERAL.DB_HOST_ESTIMATED_COST,
            accessor: 'totalCost',
            isSortable: true,
            width: '188px',
            renderCell: (cellData: any, rowData: any) => {
                return renderEstimatedCost(cellData, rowData, styles);
            }
        },
        {
            id: '7',
            Header: GENERAL.DB_HOST_ALLOCATED_CAPACITY,
            accessor: 'sizeformat',
            isSortable: true,
            width: '194px',
            accessorForTextFilter: 'sizeformat',
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        },
        {
            id: '8',
            Header: GENERAL.DB_HOST_INSTANCE_NAME,
            accessor: 'topology',
            isSortable: true,
            width: '235px',
            accessorForTextFilter: 'instanceNames',
            renderCell: (cellData: any, rowData: any) => {
                return renderInstanceName(cellData, rowData, styles);
            }
        },
        {
            id: '9',
            Header: GENERAL.DB_HOST_VPC,
            accessor: 'vpcNames',
            isSortable: true,
            width: '212px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        {rowData?.vpc?.name && (
                            <div className={styles.colText}>
                                <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                                    {rowData?.vpc?.cidrBlock}
                                </TooltipInfo>
                                <Typography variant="Regular_14">{rowData?.vpc?.name}</Typography>
                            </div>
                        )}
                        {!rowData?.vpc?.name && notAvailable()}
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
                return renderUnmanagedAZ(cellData, rowData, styles);
            }
        },
        {
            id: '11',
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            isSortable: true,
            width: '235px',
            renderCell: (cellData: string, rowData: any) => {
                return renderDeploymentModel(cellData, rowData);
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: DatabasesColDefs,
        rows: unManagedHostFormatedList || [],
        pageSize: pageSize,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        manageColumnsProps: {
            width: '92px',
            renderCell: (cellData: any, rowData: any) => {
                const hasFsx = rowData?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN
                );
                const hasEbs = rowData?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.EBS
                );
                return (
                    <div className={styles.actionsCol}>
                        <div>
                            {rowData?.id in manageLoading && manageLoading[rowData?.id] && (
                                <Spinner className={styles.loading} />
                            )}
                            {!(rowData?.id in manageLoading && manageLoading[rowData?.id]) && (
                                <div className={styles.loading}></div>
                            )}
                        </div>
                        <div className={styles.jobMenuPopover}>
                            <MenuPopover
                                isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                                menuItems={menuItems(rowData, hasFsx, hasEbs)}
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

                                        if (menuId === 'manageHost') {
                                            manageHost(rowData);
                                        }

                                        if (menuId === 'exploreSavings') {
                                            exploreSavingsAction(rowData);
                                        }
                                    }
                                }}
                                CustomMenu={undefined}
                                disabledText={undefined}
                            />
                        </div>
                    </div>
                );
            }
        },
        initialColumnState: unManagedHostInitialColumns,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading
    });

    useEffect(() => {
        dispatch(setUnManagedHostColState(tableProps.columnsState));

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
            if ((unManagedHostFormatedList || []).length % pageSize === 1) {
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
                    className={
                        tableHorizontalScroll
                            ? `${styles.table} ${styles.tableScroll}`
                            : `${styles.table} ${styles.tableScrollRevert}`
                    }
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
