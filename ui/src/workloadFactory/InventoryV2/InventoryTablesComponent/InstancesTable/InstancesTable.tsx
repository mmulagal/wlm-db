import {
    DsButton,
    DsFlashingDotsLoader,
    DsTypography,
    Popover,
    Table,
    TableTopBar,
    useDialog,
    useTable
} from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
    useManageMssqlInstanceMutation,
    usePrepareHostMutation,
    useRegisterResourceCredentialsMutation,
    useUnmanageMssqlInstanceMutation
} from '../../../../utils/apiService';
import {
    detectFieldsValidation,
    getDiscoveredHostDeploymentV2,
    getOptimizationStatus,
    getProtectionText,
    handleManageInstances,
    renderCellData,
    saveFsxInCredRegisteredObj,
    uniqueHostRow,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import { createDetectHostPayload, formatSizeTwoPrecision, isSmbProtocol } from '../../../../utils/utilityFunctions';
import { DETECT_HOST_VAR, FROM_DIALOG, INVENTORY_ACTIONS, INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import store from '../../../../store/store';
import {
    setBreadCrumbSelectedFrom,
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPPassword,
    setDetectONTAPUserName,
    setDetectedInstanceId,
    setInProgressInstances,
    setInventoryTableData,
    setRadioValueDetect,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setUnManagedPerfInstanceIdsList,
    setValuesForForm
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { setGwPageLoadInstanceData, setLandingFrom } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setIsDetectHostError, setIsDetectHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import UndetectedSecondDialogV2 from '../../InventoryTable/UndetectedSecondDialog/UndetectedSecondDialogV2';
import UndetectedHostDialogContentV2 from '../../InventoryTable/UndetectedHostDialogContent/UndetectedHostDialogContentV2';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../../store/authSlice';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import styles from '../InventoryTable.module.scss';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { initialInstanceTableColState } from '../../../../utils/manageColumnUtils';

const InstancesTable = () => {
    const { inventoryTableData, inProgressInstances } = useAppSelector(state => state.inventoryV2);

    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading, selectedInventoryTab, selectedFilterValue } =
        useAppSelector(state => state.inventoryV2);

    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const [resetPage, setResetPage] = useState(false);
    const [pageSize, setPageSize] = useState(25);
    const [tableHorizontalScroll, setTableHorizontalScroll] = useState(false);

    const [manageInstanceApi] = useManageMssqlInstanceMutation();
    const [prepareHostApi] = usePrepareHostMutation();

    const [loading, setLoading] = useState(false);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [data, setData] = useState<any>();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [registerResourceCred] = useRegisterResourceCredentialsMutation();

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
        let newTable: any = [];
        if (inventoryTableData) {
            Object.keys(inventoryTableData).map((rowId: string) => {
                if (inventoryTableData[rowId]?.action === INVENTORY_ACTIONS.EXPLORE_SAVINGS) {
                    return;
                }
                if (inventoryTableData?.[rowId] && inventoryTableData?.[rowId]?.sqlServerInstances) {
                    let perHost = inventoryTableData?.[rowId];
                    let optimizationStatusLoading = false;
                    let optimizationStatusList: any = [];
                    let assessRow = allmssqlHostAssessmentData?.filter(
                        (perRow: any) =>
                            uniqueHostRow(perRow?.databaseHostId, perRow?.credentialId, perRow?.regionId) === rowId
                    );
                    if (assessRow.length > 0) {
                        optimizationStatusLoading = allmssqlHostAssessmentLoading;
                        optimizationStatusList = assessRow?.[0]?.instancesAssessment;
                    }
                    let perInstanceData: any = [];
                    inventoryTableData?.[rowId]?.sqlServerInstances?.map((perRow: any) => {
                        if (
                            perRow?.fileSystemType === GENERAL.EBS ||
                            perRow?.fileSystemType === GENERAL.FSX_FOR_WINDOWS
                        ) {
                            return;
                        }
                        let protectionText = getProtectionText(perRow);
                        let optimizationStatus = getOptimizationStatus(
                            perRow?.databaseInstanceId,
                            optimizationStatusList
                        );
                        let perRowData = {
                            ...perRow,
                            hostRow: perHost,
                            name: perHost?.name,
                            hostType: perHost?.hostType,
                            serverInstallationMode: getDiscoveredHostDeploymentV2(perRow),
                            loading: inventoryTableData?.[rowId]?.loading,
                            subLoading: perRow?.loading,
                            optimizationStatusLoading: optimizationStatusLoading,
                            optimizationStatus: optimizationStatus,
                            protectionText: protectionText,
                            allocatedCapacityText: perRow?.allocatedCapacity
                                ? formatSizeTwoPrecision(perRow?.allocatedCapacity)
                                : '',
                            statusColText: inProgressInstances.has(
                                uniqueHostRow(
                                    `${perHost?.ec2InstanceId}_${perRow.databaseInstanceName}`,
                                    perHost?.credentialId || '',
                                    perHost?.regionId || ''
                                )
                            )
                                ? INVENTORY_STATUS.IN_PROGRESS
                                : perRow.statusColText,
                            credentialId: perHost?.credentialId,
                            regionId: perHost?.regionId,
                            credentialName: perHost?.credentialName,
                            accountId: perHost?.accountId,
                            regionName: perHost?.regionName,
                            resourceId: perHost?.resourceId,
                            ec2InstanceId: perHost?.ec2InstanceId
                        };
                        perInstanceData.push(perRowData);
                    });
                    newTable = [...newTable, ...(perInstanceData || [])];
                }
            });
        }
        setData(newTable);
    }, [inventoryTableData, inProgressInstances, allmssqlHostAssessmentLoading]);

    const getInitialFilter = () => {
        if (selectedInventoryTab === 'Instances' && selectedFilterValue?.flag === true) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            return {
                textFilter: '',
                count: 1,
                columns: {
                    '2': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        } else {
            return undefined;
        }
    };

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={'Unmanage instance'}
                content={
                    <>
                        <DsTypography variant="Regular_14">
                            Are you sure you want to unmanage the SQL Server instance?{' '}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginTop: '24px', width: '700px' }}>
                            This will exclude the instance from Workload Factory's best practices and lifecycle
                            management. Do you wish to proceed?{' '}
                        </DsTypography>
                    </>
                }
                primaryButton={'Unmanage'}
                secondaryButton={'Close'}
                callback={() => {
                    const updatedState = store.getState();
                    const { inProgressInstances, inventoryTableData }: any = updatedState.inventoryV2;
                    const targettedHost =
                        inventoryTableData[
                            uniqueHostRow(rowData.resourceId, rowData?.credentialId, rowData?.regionId)
                        ] ||
                        inventoryTableData[
                            uniqueHostRow(rowData.ec2InstanceId, rowData?.credentialId, rowData?.regionId)
                        ];
                    const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
                        (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
                    );
                    const inProgressId = uniqueHostRow(
                        `${rowData?.ec2InstanceId}_${rowData?.databaseInstanceName}`,
                        rowData?.credentialId,
                        rowData?.regionId
                    );
                    dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), inProgressId])));
                    unmanageApi({
                        credentialsId: targettedHost?.credentialId,
                        regionId: targettedHost?.regionId,
                        resourceId: targettedHost?.resourceId,
                        dbInstanceId: targettedDbInstance?.databaseInstanceId
                    }).then((res: any) => {
                        const updatedState = store.getState();
                        const { inProgressInstances } = updatedState?.inventoryV2;
                        let updatedInProgressInstances = new Set([...inProgressInstances]);
                        updatedInProgressInstances.delete(inProgressId);
                        dispatch(setInProgressInstances(updatedInProgressInstances));
                        if (res?.data?.items) {
                            if (res?.data?.items?.[0]?.errorMessage) {
                                dispatch(
                                    addNotification({
                                        notificationType: NOTIFICATION_TYPES.ERROR,
                                        message: GENERAL.UNMANAGE_INSTANCE_FAILED_MSG(rowData?.databaseInstanceName),
                                        additionalText: res?.data?.items?.[0]?.errorMessage
                                    })
                                );
                            } else {
                                const updatedInventoryTableData = updateInstanceStatus('unmanage', rowData, rowData);
                                dispatch(setInventoryTableData(updatedInventoryTableData));
                                dispatch(
                                    addNotification({
                                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                                        message: GENERAL.UNMANAGE_INSTANCE_SUCCESS_MSG(rowData?.databaseInstanceName)
                                    })
                                );
                            }
                        }
                    });
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.setWidth}
            />
        );
    };

    const resourceAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData.resourceId, rowData.credentialId, rowData.regionId)] ||
            inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData.credentialId, rowData.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setSelectedHostname(rowData?.name));
        dispatch(
            setSelectedResourcePageHostData({
                resourceId: targettedHost?.resourceId,
                databaseInstanceId: targettedDbInstance?.databaseInstanceId,
                databaseInstanceName: targettedDbInstance?.databaseInstanceName,
                credentialId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId
            })
        );
    };

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData.resourceId, rowData.credentialId, rowData.regionId)] ||
            inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData.credentialId, rowData.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));

        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.name,
                resourceId: targettedHost?.resourceId,
                instanceId: targettedDbInstance?.databaseInstanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType
            })
        );
    };

    const resetDialogValues = () => {
        // reset all detect host dialog fields if dialog is closed.
        dispatch(setIsDetectHostError(''));
        dispatch(setDetectManageUserName(''));
        dispatch(setDetectManagePassword(''));
        dispatch(setDetectONTAPUserName(''));
        dispatch(setDetectONTAPPassword(''));
    };

    // This function is used to check if user wants to manage the detected host vis workload factory
    const handleMoveToManage = async (rowData: any, fsxId: any, isFsxRegister?: boolean) => {
        const state = store.getState();
        const detectHostRadio = state.inventoryV2.detectHostRadio;
        if (detectHostRadio === DETECT_HOST_VAR.MOVE_TO_MANAGE && fsxId) {
            handleManageInstances(
                rowData?.hostRow,
                [rowData?.databaseInstanceName],
                dispatch,
                styles,
                manageInstanceApi,
                prepareHostApi,
                true
            );
            // const manageStartMsg = (
            //     <div className={styles.notification}>
            //         {GENERAL.INSTANCE_MANAGE_REQUEST[0]}
            //         <span className={styles.bold}>{rowData?.databaseInstanceName}</span>
            //         {GENERAL.INSTANCE_MANAGE_REQUEST[1]}
            //     </div>
            // );
            // dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message: manageStartMsg }));
            dispatch(setRadioValueDetect(DETECT_HOST_VAR.MOVE_TO_MANAGE));
        } else {
            const updatedInventoryTableData = updateInstanceStatus('detect', rowData, rowData);
            dispatch(setInventoryTableData(updatedInventoryTableData));
            const detectedSuccessMsg = (
                <div className={styles.notification}>
                    {GENERAL.INSTANCE_SUCCESS_DETECTED[0]}
                    <span className={styles.bold}>{rowData?.databaseInstanceName}</span>
                    {GENERAL.INSTANCE_SUCCESS_DETECTED[1]}
                </div>
            );
            dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, message: detectedSuccessMsg }));
            dispatch(setRadioValueDetect(DETECT_HOST_VAR.MOVE_TO_MANAGE));
        }
        // if fsx register is false and only db cred is added than call instance API
        dispatch(setUnManagedPerfInstanceIdsList([...unManagedPerfInstanceIdsList, ...[rowData?.ec2InstanceId]]));
        if (!isFsxRegister) {
            dispatch(setDetectedInstanceId(rowData?.ec2InstanceId));
        }
    };

    // This function is to register credentials on detect host
    const handleRegisterResourceCred = async (rowData: any, fsxId: string) => {
        if (!detectFieldsValidation(rowData)) {
            dispatch(setValuesForForm(true));
        } else {
            dispatch(setValuesForForm(false));
            dispatch(setIsDetectHostLoading(true));
            const sqlServerInstance = rowData?.sqlServerInstance || rowData?.databaseInstanceName || '';
            try {
                const result: any = await registerResourceCred({
                    credentialId: rowData?.credentialId,
                    regionId: rowData?.regionId,
                    instanceId: rowData?.ec2InstanceId,
                    payload: createDetectHostPayload(sqlServerInstance, fsxId, rowData)
                });
                if (result && !result?.error) {
                    if (result?.data?.sqlServerError || result?.data?.fsxnError) {
                        let error = [];
                        error.push(result?.data?.sqlServerError || '');
                        error.push(result?.data?.fsxnError || '');
                        dispatch(setIsDetectHostError(error.join(' ')));
                        dispatch(setIsDetectHostLoading(false));
                    } else {
                        dispatch(setIsDetectHostLoading(false));

                        // store fsx cred in register obj if payload has fsx register
                        let isFsxRegister = saveFsxInCredRegisteredObj(fsxId, dispatch);

                        if ((rowData?.storage && rowData?.storage?.length > 0) || rowData?.storage?.fsxn) {
                            setTimeout(() => {
                                setDialog(
                                    <DialogComponent
                                        header={
                                            <div className={styles.headerDialog}>
                                                <DsTypography variant="Regular_20">
                                                    {GENERAL.DETECT_INSTANCE}
                                                </DsTypography>
                                                <DsTypography variant="Semibold_14">
                                                    {GENERAL.DETECT_HOST_STEPS[1]}
                                                </DsTypography>
                                            </div>
                                        }
                                        content={<UndetectedSecondDialogV2 data={rowData} apiResult={result?.data} />}
                                        primaryButton={GENERAL.DONE}
                                        callback={() => handleMoveToManage(rowData, fsxId, isFsxRegister)}
                                    />
                                );
                            }, 0);
                            resetDialogValues();
                        } else {
                            dispatch(setIsDetectHostError(GENERAL.DETECT_FAILED_WITH_NO_STORAGE));
                        }
                    }
                } else {
                    dispatch(setIsDetectHostError(result?.error?.data?.message || GENERAL.FAILED_TO_DETECT_HOST));
                    dispatch(setIsDetectHostLoading(false));
                }
            } catch (error) {
                dispatch(setIsDetectHostError(error || GENERAL.FAILED_TO_DETECT_HOST));
                dispatch(setIsDetectHostLoading(false));
            }
        }
    };

    // To open detect host dialog
    const handleDetectDialog = (rowData: any) => {
        dispatch(setIsDetectHostError(''));

        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerDialog}>
                        <DsTypography variant="Regular_20">{GENERAL.DETECT_INSTANCE}</DsTypography>
                        <DsTypography variant="Semibold_14">{GENERAL.DETECT_HOST_STEPS[0]}</DsTypography>
                    </div>
                }
                content={<UndetectedHostDialogContentV2 rowData={rowData} />}
                primaryButton={GENERAL.DETECT}
                secondaryButton={GENERAL.CLOSE}
                callback={() => handleRegisterResourceCred(rowData, rowData?.fsxId)}
                closeCallback={() => {
                    closeDialog();
                    resetDialogValues();
                }}
                dialogFrom={FROM_DIALOG.DETECT_HOST}
            />
        );
    };

    const redirectToAction = (rowData: any) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
        optimizeAction(rowData);
    };

    const managedHostSubTableColDefs: ColumnProps[] = [
        {
            Header: 'Instance name',
            accessor: 'databaseInstanceName',
            id: '1',
            isSortable: true,
            width: '256px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseInstanceName;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status === INVENTORY_STATUS.RUNNING ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
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
            Header: 'Host name',
            accessor: 'name',
            id: '2',
            width: '213px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Engine type',
            accessor: 'hostType',
            id: '3',
            width: '213px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Deployment model',
            accessor: 'serverInstallationMode',
            id: '4',
            width: '213px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            Header: 'Management status',
            accessor: 'statusColText',
            id: '5',
            isSortable: false,
            width: '213px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                if (cellData === INVENTORY_STATUS.UNMANAGED) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={INVENTORY_STATUS.UNMANAGED} />;
                }
                if (cellData === INVENTORY_STATUS.UNDETECTED) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={INVENTORY_STATUS.UNDETECTED} />;
                }
                if (cellData === INVENTORY_STATUS.IN_PROGRESS) {
                    return (
                        <div className={styles.inProgress}>
                            <SmallLoader />
                            <DsTypography variant="Regular_14">{INVENTORY_STATUS.IN_PROGRESS}</DsTypography>
                        </div>
                    );
                }
                if (cellData === INVENTORY_STATUS.MANAGED) {
                    return <DotComponent color={'var(--success)'} value={INVENTORY_STATUS.MANAGED} />;
                }
            }
        },
        {
            Header: 'Optimization status',
            accessor: 'optimizationStatus',
            id: '6',
            width: '240px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                let disableMsg = '';
                let disableMenu = () => {
                    if (
                        rowData?.status === INVENTORY_STATUS.OFFLINE ||
                        rowData?.ssmState === INVENTORY_STATUS.OFFLINE ||
                        rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN ||
                        rowData?.status === INVENTORY_STATUS.STOPPED
                    ) {
                        disableMsg = GENERAL.ONLINE_INSTANCE_ASSESS;
                        return true;
                    }

                    if (
                        (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                            rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                        (!rowData.fileSystemType || rowData?.fileSystemType?.toLowerCase() === GENERAL.NOT_AVAILABLE)
                    ) {
                        disableMsg = GENERAL.ASSESSMENT_STORAGE_TYPE_UNKNOWN;
                        return true;
                    }

                    if (
                        (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                            rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) &&
                        (rowData.fileSystemType === GENERAL.EBS || rowData.fileSystemType === GENERAL.FSX_FOR_WINDOWS)
                    ) {
                        disableMsg = GENERAL.FSXN_OPTIMIZE_SUPPORTED;
                        return true;
                    }

                    if (
                        rowData?.serverInstallationMode === GENERAL.AOAG &&
                        rowData.fileSystemType &&
                        rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)
                    ) {
                        if (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
                            disableMsg = GENERAL.ASSESSMENT_AOAG_DETECTED;
                            return true;
                        } else if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                            disableMsg = GENERAL.ASSESSMENT_AOAG_UNDETECTED;
                            return true;
                        }
                    }

                    if (rowData.fileSystemType && rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
                        if (rowData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
                            disableMsg = GENERAL.ASSESSMENT_FOR_MANAGE;
                            return true;
                        } else if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                            disableMsg = GENERAL.ASSESSMENT_FOR_UNDETECTED_FSXN;
                            return true;
                        }
                    }

                    if (
                        (!cellData &&
                            rowData.statusColText !== INVENTORY_STATUS.IN_PROGRESS &&
                            !rowData?.optimizationStatusLoading) ||
                        cellData === INVENTORY_STATUS.IN_PROGRESS
                    ) {
                        disableMsg = GENERAL.ASSESSMENT_IN_PROGRESS;
                        return true;
                    }
                    return false;
                };

                return (
                    <>
                        {disableMenu() ? (
                            <div className={styles.naContainer}>
                                <Popover
                                    popoverClass={''}
                                    children={<DsTypography variant="Regular_14">{disableMsg}</DsTypography>}
                                    trigger="hover"
                                    delayHide={200}
                                    interactive={true}
                                    isAppendedToBody={false}
                                    container={<TooltipIcon />}
                                />
                                <DsTypography variant="Regular_14">{GENERAL.NOT_AVAILABLE}</DsTypography>
                            </div>
                        ) : rowData?.optimizationStatusLoading ||
                          rowData?.statusColText === INVENTORY_STATUS.IN_PROGRESS ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            <div className={styles.statusCol}>
                                <DsTypography variant="Regular_14">{cellData}</DsTypography>
                                <DsButton type="text" onClick={() => redirectToAction(rowData)}>
                                    View
                                </DsButton>
                            </div>
                        )}
                    </>
                );
            }
        },
        {
            Header: 'Protection status',
            accessor: 'protectionText',
            id: '7',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const loading = rowData?.loading || rowData?.subLoading;
                return (
                    <>
                        {cellData && <div>{cellData}</div>}
                        {!cellData && loading && <DsFlashingDotsLoader />}
                        {!cellData && !loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: 'Performance',
            accessor: 'performance.assessment',
            id: '8',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const loading = rowData?.loading || rowData?.subLoading;
                return (
                    <>
                        {cellData && <div>{cellData}</div>}
                        {!cellData && loading && <DsFlashingDotsLoader />}
                        {!cellData && !loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            id: '9',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            width: '213px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '10',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            width: '213px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },
        {
            id: '11',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            width: '213px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: managedHostSubTableColDefs,
        rows: data,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        initialColumnState: initialInstanceTableColState,
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                const menu = [];
                let disableOption = false;
                let disableMessage = '';
                const disableCreateDb = isSmbProtocol(rowData?.storage?.fsxn?.protocol);
                const disableCreateDbMsg = disableCreateDb ? GENERAL.SMB_PROTOCOL_DISABLED : '';
                if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
                    disableMessage = GENERAL.HOST_DOWN;
                    disableOption = true;
                } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
                    disableMessage = GENERAL.SSM_DOWN;
                    disableOption = true;
                } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
                    disableMessage = GENERAL.SQL_SERVER_INSTANCE_DOWN;
                    disableOption = true;
                }
                if (rowData.statusColText === INVENTORY_STATUS.UNDETECTED) {
                    menu.push({
                        id: 'detect',
                        displayName: 'Detect',
                        disabled: disableOption,
                        infoText: disableMessage
                    });
                } else if (rowData.statusColText === INVENTORY_STATUS.UNMANAGED) {
                    menu.push({
                        id: 'manage',
                        displayName: 'Manage',
                        disabled: disableOption,
                        infoText: disableMessage
                    });
                } else {
                    menu.push(
                        {
                            id: 'optimize',
                            displayName: 'Optimize',
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'viewInstance',
                            displayName: 'View instance',
                            disabled: disableOption,
                            infoText: disableMessage
                        },

                        {
                            id: 'viewDatabases',
                            displayName: 'View databases',
                            disabled: disableOption,
                            infoText: disableMessage
                        },

                        {
                            id: 'createUserDb',
                            displayName: 'Create database',
                            disabled: disableOption || disableCreateDb,
                            infoText: disableMessage || disableCreateDbMsg
                        },
                        {
                            id: 'createSandbox',
                            displayName: 'Create sandbox',
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'unManage',
                            displayName: 'Unmanage'
                        }
                    );
                }

                let disableMsg = '';
                let width = '';
                let height = '';
                let disableMenu = () => {
                    if (data[0] && data[0]?.loading) {
                        disableMsg = GENERAL.INVENTORY_LOADING_DISABLED;
                        width = '170px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.status === INVENTORY_STATUS.OFFLINE &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.HOST_DOWN;
                        width = '120px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.ssmState === INVENTORY_STATUS.OFFLINE &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.SSM_DOWN;
                        width = '250px';
                        height = '50px';
                        return true;
                    }
                    if (
                        rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.SQL_SERVER_INSTANCE_DOWN;
                        width = '220px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.detectOption === DETECT_HOST_VAR.DISABLE ||
                        rowData?.detectOption === DETECT_HOST_VAR.HIDE
                    ) {
                        disableMsg = rowData?.detectOptionDisableMsg;
                        width = '250px';
                        height = '33px';
                        return true;
                    }
                    if (
                        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
                        rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP
                    ) {
                        disableMsg = GENERAL.FSXN_MANAGE_SUPPORTED;
                        width = '340px';
                        height = '50px';
                        return true;
                    }
                    if (
                        rowData?.serverInstallationMode === GENERAL.AOAG &&
                        rowData?.statusColText === INVENTORY_STATUS.UNMANAGED
                    ) {
                        disableMsg = GENERAL.AOAG_MANAGE_DISABLE;
                        width = '320px';
                        height = '50px';
                        return true;
                    }
                    return false;
                };

                return (
                    <div className={styles.jobMenuPopover}>
                        {disableMenu() ? (
                            <TooltipComponent placement={'bottom'} title={disableMsg} width={width} height={height}>
                                <div className={styles.menuPointerDisabled}>
                                    <span className={styles.menuPointer}>...</span>
                                </div>
                            </TooltipComponent>
                        ) : (
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

                                        if (menuId === 'optimize') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            optimizeAction(rowData);
                                        }

                                        if (menuId === 'manage') {
                                            handleManageInstances(
                                                rowData?.hostRow,
                                                [rowData?.databaseInstanceName],
                                                dispatch,
                                                styles,
                                                manageInstanceApi,
                                                prepareHostApi,
                                                false
                                            );
                                        }
                                        if (menuId === 'viewInstance') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                            dispatch(selectedTabSelection(WLF_TABS.OVERVIEW));
                                            resourceAction(rowData);
                                        }
                                        if (menuId === 'viewDatabases') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                            dispatch(selectedTabSelection(WLF_TABS.DATABASE_LIST));
                                            resourceAction(rowData);
                                        }
                                        if (menuId === 'createUserDb') {
                                            dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                            dispatch(updateResourceId(rowData?.resourceId));
                                            dispatch(
                                                setCdbPageData({
                                                    dbHostName: rowData?.name,
                                                    instanceId: rowData?.databaseInstanceId,
                                                    instanceName: rowData?.databaseInstanceName,
                                                    cdbCredId: rowData?.credentialId,
                                                    cdbRegionId: rowData?.regionId
                                                })
                                            );
                                            navigate('../create-new-user');
                                        }
                                        if (menuId === 'createSandbox') {
                                            dispatch(
                                                setSelectedSandboxHeaderValue({
                                                    credId: rowData?.credentialId,
                                                    regionId: rowData?.regionId
                                                })
                                            );
                                            navigate('../create-new-sandbox');
                                        }
                                        if (menuId === 'unManage') {
                                            handleDialog(rowData);
                                        }
                                        if (menuId === 'detect') {
                                            handleDetectDialog(rowData);
                                        }
                                    }
                                }}
                                CustomMenu={undefined}
                                disabledText={undefined}
                            />
                        )}
                    </div>
                );
            }
        }
    });

    useEffect(() => {
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
        if (isRefreshed) {
            tableProps?.pagination?.gotoPage(0);
        }
    }, [isRefreshed]);

    useEffect(() => {
        if (resetPage) {
            if ((data || []).length % pageSize === 1) {
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
                    className={
                        tableHorizontalScroll
                            ? `${styles.table} ${styles.tableScroll}`
                            : `${styles.table} ${styles.tableScrollRevert}`
                    }
                >
                    <TableTopBar
                        //@ts-ignore
                        tableProps={tableProps}
                        pluralTitle="Instances"
                        singularTitle="Instance"
                        exportToCsvOptions={{ fileName: 'instanceTable.csv' }}
                        className={styles.topBarStyle}
                        subTitle="This table may display duplicate records for the same resource, as each resource can be linked to multiple sets of credentials."
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

export default InstancesTable;
