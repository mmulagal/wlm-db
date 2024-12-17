import {
    Table,
    useTable,
    useDialog,
    DsTypography,
    DsFlashingDotsLoader,
    DsButton,
    Popover
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ManagedHostSubTable.module.scss';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { useEffect, useRef, useState } from 'react';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { useDispatch } from 'react-redux';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import { DETECT_HOST_VAR, FROM_DIALOG, INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { createDetectHostPayload, formatSizeTwoPrecision, isSmbProtocol } from '../../../../utils/utilityFunctions';
import SmallLoader from '../../../../common/SmallLoader/SmallLoader';
import DotComponent from '../../../../common/DotComponent/DotComponent';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import { useRegisterResourceCredentialsMutation, useUnmanageMssqlInstanceMutation } from '../../../../utils/apiService';
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
    setSelectedHeaderTab,
    setUnManagedPerfInstanceIdsList,
    setValuesForForm
} from '../../../../store/workloadFactory/inventoryV2Slice';
import store from '../../../../store/store';
import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import {
    resetWorkloadFactoryResourceData,
    setSelectedDatabaseInstance,
    setSelectedDatabaseInstanceName,
    setSelectedHostname,
    setSelectedResourceId
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setDBHostName,
    setInstanceId,
    setInstanceName
} from '../../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../../store/authSlice';
import {
    detectFieldsValidation,
    getOptimizationStatus,
    getProtectionText,
    renderAllocatedCapacity,
    renderCellData,
    saveFsxInCredRegisteredObj,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import { setIsDetectHostError, setIsDetectHostLoading } from '../../../../store/mssql/msSqlActionSlice';
import UndetectedHostDialogContentV2 from '../UndetectedHostDialogContent/UndetectedHostDialogContentV2';
import UndetectedSecondDialogV2 from '../UndetectedSecondDialog/UndetectedSecondDialogV2';
import useResize from '../../../../common/hooks/useResize';
import {
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setLandingFrom
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';

const ManagedHostSubTable = ({
    handleManageInstances
}: {
    handleManageInstances: (rowData: any, instances: any, isDetected?: boolean) => void;
}) => {
    const windowSize = useResize();
    const {
        inventoryTableData,
        inProgressInstances,
        inventoryExpandedRowHostData: hostData
    } = useAppSelector(state => state.inventoryV2);

    const rowId = hostData?.id;
    const hostname = hostData?.name;
    const resourceId = hostData?.resourceId;
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);
    const managedAssessmentHostData = useAppSelector(state => state.inventoryV2.managedAssessmentHostData);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();
    const [data, setData] = useState<any>();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [registerResourceCred] = useRegisterResourceCredentialsMutation();

    useEffect(() => {
        if (inventoryTableData?.[rowId] && inventoryTableData?.[rowId]?.sqlServerInstances) {
            let optimizationStatusLoading = false;
            let optimizationStatusList: any = [];
            if (managedAssessmentHostData?.[rowId]) {
                let assessmentData = managedAssessmentHostData?.[rowId];
                optimizationStatusLoading = assessmentData?.loading;
                optimizationStatusList = assessmentData?.data;
            }
            const newTable = inventoryTableData?.[rowId]?.sqlServerInstances?.map((perRow: any) => {
                let protectionText = getProtectionText(perRow);
                let optimizationStatus = getOptimizationStatus(perRow?.databaseInstanceId, optimizationStatusList);
                return {
                    ...perRow,
                    loading: inventoryTableData?.[rowId]?.loading,
                    subLoading: perRow?.loading,
                    optimizationStatusLoading: optimizationStatusLoading,
                    optimizationStatus: optimizationStatus,
                    protectionText: protectionText,
                    allocatedCapacityText: perRow?.allocatedCapacity
                        ? formatSizeTwoPrecision(perRow?.allocatedCapacity)
                        : '',
                    statusColText: inProgressInstances.has(`${hostData?.ec2InstanceId}_${perRow.databaseInstanceName}`)
                        ? INVENTORY_STATUS.IN_PROGRESS
                        : perRow.statusColText
                };
            });
            setData(newTable);
        } else {
            setData([]);
        }
    }, [rowId, inventoryTableData, inProgressInstances, managedAssessmentHostData]);

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
                        inventoryTableData[hostData.resourceId] || inventoryTableData[hostData.ec2InstanceId];
                    const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
                        (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
                    );
                    const inProgressId = `${hostData?.ec2InstanceId}_${rowData?.databaseInstanceName}`;
                    dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstances), inProgressId])));
                    unmanageApi({
                        credentialsId: headerSelectedCred?.data?.credentialsId,
                        regionId: headerSelectedRegion?.label2,
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
                                const updatedInventoryTableData = updateInstanceStatus('unmanage', hostData, rowData);
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
        const targettedHost = inventoryTableData[hostData.resourceId] || inventoryTableData[hostData.ec2InstanceId];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setSelectedHostname(hostname));
        dispatch(setSelectedResourceId(targettedHost?.resourceId));
        dispatch(setSelectedDatabaseInstance(targettedDbInstance?.databaseInstanceId));
        dispatch(setSelectedDatabaseInstanceName(targettedDbInstance?.databaseInstanceName));
    };

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost = inventoryTableData[hostData.resourceId] || inventoryTableData[hostData.ec2InstanceId];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        dispatch(setGwHostname(hostname));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setGwResourceId(targettedHost?.resourceId));
        dispatch(setGwDatabaseInstance(targettedDbInstance?.databaseInstanceId));
        dispatch(setGwDatabaseInstanceName(targettedDbInstance?.databaseInstanceName));
        dispatch(setGwDatabaseStorageType(targettedDbInstance?.sqlServerDeploymentType));
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
            handleManageInstances(hostData, [rowData?.databaseInstanceName], true);
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
            const updatedInventoryTableData = updateInstanceStatus('detect', hostData, rowData);
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
        dispatch(setUnManagedPerfInstanceIdsList([...unManagedPerfInstanceIdsList, ...[hostData?.ec2InstanceId]]));
        if (!isFsxRegister) {
            dispatch(setDetectedInstanceId(hostData?.ec2InstanceId));
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
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instanceId: hostData?.ec2InstanceId,
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

                        if (rowData?.storage && rowData?.storage?.length > 0) {
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

    const lastColDetails = () => {
        return {
            id: '10',
            Header: '',
            accessor: 'name',

            renderCell: (cellData: any, rowData: any) => {
                const menu = [];
                let disableOption = false;
                let disableMessage = '';
                const disableCreateDb = isSmbProtocol(rowData?.storage?.fsxn?.protocol);
                const disableCreateDbMsg = disableCreateDb ? GENERAL.SMB_PROTOCOL_DISABLED : '';
                if (hostData?.status === INVENTORY_STATUS.OFFLINE) {
                    disableMessage = GENERAL.HOST_DOWN;
                    disableOption = true;
                } else if (hostData?.ssmState === INVENTORY_STATUS.OFFLINE) {
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
                            displayName: 'Create user database',
                            disabled: disableOption || disableCreateDb,
                            infoText: disableMessage || disableCreateDbMsg
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
                        hostData?.status === INVENTORY_STATUS.OFFLINE &&
                        rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                    ) {
                        disableMsg = GENERAL.HOST_DOWN;
                        width = '120px';
                        height = '33px';
                        return true;
                    }
                    if (
                        hostData?.ssmState === INVENTORY_STATUS.OFFLINE &&
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
                        hostData?.serverInstallationMode === GENERAL.AOAG &&
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
                                            handleManageInstances(hostData, [rowData?.databaseInstanceName], false);
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
                                            dispatch(updateResourceId(hostData?.resourceId));
                                            dispatch(setDBHostName(hostData?.name));
                                            dispatch(setInstanceId(rowData?.databaseInstanceId));
                                            dispatch(setInstanceName(rowData?.databaseInstanceName));
                                            navigate('../create-new-user');
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
            },
            showHide: true,
            width: '57px',
            isSticky: true
        };
    };

    const redirectToAction = (rowData: any) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
        optimizeAction(rowData);
    };

    const managedHostSubTableColDefs: ColumnProps[] = [
        {
            Header: 'SQL Server instance',
            accessor: 'databaseInstanceName',
            id: '1',
            isSortable: true,
            width: '212px',
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
            Header: 'Management status',
            accessor: 'statusColText',
            id: '2',
            isSortable: false,
            width: '190px',
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
            Header: 'Storage type',
            accessor: 'fileSystemType',
            id: '3',
            width: '150px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            Header: 'Storage savings',
            accessor: 'storageSavingsText',
            id: '4',
            width: '172px',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => {
                return (
                    <>
                        {cellData && <div>{cellData}</div>}
                        {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
                        {!cellData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
                    </>
                );
            }
        },
        {
            Header: 'Storage availability',
            accessor: 'fileSystemDeploymentMode',
            id: '5',
            width: '188px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                return renderCellData(cellData, rowData, styles);
            }
        },
        {
            Header: 'Optimization status',
            accessor: 'optimizationStatus',
            id: '6',
            width: '210px',
            filterOptions: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                let disableMsg = '';
                let disableMenu = () => {
                    if (
                        hostData?.status === INVENTORY_STATUS.OFFLINE ||
                        hostData?.ssmState === INVENTORY_STATUS.OFFLINE ||
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
                        hostData?.serverInstallationMode === GENERAL.AOAG &&
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
            Header: 'Protection',
            accessor: 'protectionText',
            id: '7',
            width: '130px',
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
            width: '160px',
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
            Header: 'Allocation capacity',
            accessor: 'allocatedCapacityText',
            id: '9',
            width: '190px',
            isSortable: true,
            renderCell: (cellData: string | number, rowData: any) => {
                return renderAllocatedCapacity(cellData, rowData);
            }
        }
    ];

    managedHostSubTableColDefs.unshift(lastColDetails());

    const tableProps = useTable({
        isSorting: false,

        columns: managedHostSubTableColDefs,
        rows: data,
        pageSize: 10,
        selectionType: 'none',
        isHorizontalScroll: true
    });
    return (
        <div className={styles.managedHostSubTable}>
            {/* <div className={styles.topDiv} /> */}
            <div className={styles.extraDiv2} />

            <span className={styles.managedSubTable}>
                <Table
                    //@ts-ignore

                    tableProps={tableProps}
                    variant="innerTable"
                    isDoubleRow={true}
                />
            </span>

            <div className={styles.extraDivRight} />

            {/* <div className={styles.topDiv} /> */}
        </div>
    );
};

export default ManagedHostSubTable;
