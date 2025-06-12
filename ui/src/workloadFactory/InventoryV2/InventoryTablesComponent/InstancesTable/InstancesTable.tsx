import {
    BlueXPListeners,
    DsButton,
    DsFlashingDotsLoader,
    DsTypography,
    Popover,
    postBlueXPMessage,
    useDialog
} from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useManageBulkMssqlInstanceMutation,
    usePrepareHostMutation,
    useRegisterResourceCredentialsMutation,
    useUnmanageMssqlInstanceMutation
} from '../../../../utils/apiService';
import {
    detectFieldsValidation,
    handleManageInstances,
    handleManageInstancesBulk,
    manageActionCol,
    saveFsxInCredRegisteredObj,
    uniqueHostRow,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import {
    checkBoxHandleManage,
    createDetectHostPayload,
    getFilterOptions,
    getSelectedFromSelectionState,
    isSmbProtocol
} from '../../../../utils/utilityFunctions';
import {
    ACTION_CTA,
    DETECT_HOST_VAR,
    FROM_DIALOG,
    INVENTORY_STATUS,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../../utils/consts';
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
    setManageSingleInstanceData,
    setRadioValueDetect,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab,
    setSelectedMultiDetectInstances,
    setSelectedRowsForManage,
    setTableManageColumnState,
    setValuesForForm,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
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

import DotComponent from '../../../../common/DotComponent/DotComponent';
import styles from '../InventoryTable.module.scss';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { ColumnProps, Table } from '../../../../common/Lib/Table/Table';
import { useTable } from '../../../../common/Lib/Table/useTable';

const InstancesTable = () => {
    const { t } = useTranslation();
    const disptach = useDispatch();

    const { instanceTableRows, inProgressInstances, tableManageColumnState } = useAppSelector(
        state => state.inventoryV2
    );

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { selectedRowsForManage } = useAppSelector(state => state.inventoryV2);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading, selectedInventoryTab, selectedFilterValue } =
        useAppSelector(state => state.inventoryV2);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const [manageBulkInstanceApi] = useManageBulkMssqlInstanceMutation();
    const [prepareHostApi] = usePrepareHostMutation();

    const [loading, setLoading] = useState(false);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [registerResourceCred] = useRegisterResourceCredentialsMutation();

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading ||
                pgsqlDatabaseHostsLoading ||
                pgsqlFullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        isDiscoverInProgress,
        fullHostDataLoading,
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        pgsqlDatabaseHostsLoading,
        pgsqlFullHostDataLoading,
        multiDataLoading
    ]);

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
                count: 3,
                columns: {
                    '2': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    '9': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    '11': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.regionName]: true
                        },
                        valuesArray: [true]
                    }
                }
            };
        }
        return undefined;
    };

    const handleDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header="Deregister instance"
                content={
                    <>
                        <DsTypography variant="Regular_14">
                            Are you sure you want to deregister the SQL Server instance?{' '}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginTop: '24px', width: '700px' }}>
                            This will exclude the instance from Workload Factory's best practices and lifecycle
                            management. Do you wish to proceed?{' '}
                        </DsTypography>
                    </>
                }
                primaryButton="Deregister"
                secondaryButton="Close"
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
                        const updatedInProgressInstances = new Set([...inProgressInstances]);
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

        let resourceId = '';
        if (targettedDbInstance?.resourceId) {
            resourceId = targettedDbInstance?.resourceId;
        } else {
            resourceId = targettedHost?.resourceId;
        }

        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.name,
                resourceId,
                instanceId: targettedDbInstance?.databaseInstanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType
            })
        );

        // For overview and database
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setSelectedHostname(rowData?.name));
        dispatch(
            setSelectedResourcePageHostData({
                resourceId,
                databaseInstanceId: targettedDbInstance?.databaseInstanceId,
                databaseInstanceName: targettedDbInstance?.databaseInstanceName,
                credentialId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId
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
        const { detectHostRadio } = state.inventoryV2;
        if (detectHostRadio === DETECT_HOST_VAR.MOVE_TO_MANAGE && fsxId) {
            handleManageInstances(
                rowData?.hostRow,
                [rowData?.databaseInstanceName],
                dispatch,
                styles,
                manageBulkInstanceApi,
                prepareHostApi,
                true
            );
            dispatch(setRadioValueDetect(DETECT_HOST_VAR.MOVE_TO_MANAGE));
            dispatch(
                setDetectedInstanceId(uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId))
            );
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
            dispatch(
                setDetectedInstanceId(uniqueHostRow(rowData?.ec2InstanceId, rowData?.credentialId, rowData?.regionId))
            );
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
                        const error = [];
                        error.push(result?.data?.sqlServerError || '');
                        error.push(result?.data?.fsxnError || '');
                        dispatch(setIsDetectHostError(error.join(' ')));
                    } else {
                        // store fsx cred in register obj if payload has fsx register
                        const isFsxRegister = saveFsxInCredRegisteredObj(fsxId, dispatch);

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
                }
            } catch (error) {
                dispatch(setIsDetectHostError(error || GENERAL.FAILED_TO_DETECT_HOST));
            } finally {
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
        dispatch(setFSXId({ fsxId: rowData?.fsxId, ec2InstanceId: rowData?.ec2InstanceId }));

        optimizeAction(rowData);
    };

    const disableManageCheck = (rowData: any) => {
        let errorMessage = '';
        let isDisabled = false;
        if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
            isDisabled = true;
            errorMessage = GENERAL.NON_MSSQL_BULK_CTA;
        } else if (rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
            isDisabled = true;
            errorMessage = 'The instance is already managed by Workload Factory.';
        } else if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
            isDisabled = true;
            errorMessage = 'The instance is not authenticated.';
        } else if (rowData?.serverInstallationMode === GENERAL.AOAG) {
            isDisabled = true;
            errorMessage = GENERAL.AOAG_MANAGE_DISABLE;
        } else if (rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP) {
            isDisabled = true;
            errorMessage = GENERAL.FSXN_MANAGE_SUPPORTED;
        } else if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
            isDisabled = true;
            errorMessage = GENERAL.HOST_DOWN;
        } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
            isDisabled = true;
            errorMessage = GENERAL.SSM_DOWN;
        } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
            isDisabled = true;
            errorMessage = GENERAL.SQL_SERVER_INSTANCE_DOWN;
        } else if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
            isDisabled = true;
            errorMessage = GENERAL.PGSQL_CTA_NA;
        }
        return { isDisabled, errorMessage };
    };

    const setStatusForFilter = (rowData?: any) => {
        if (
            rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
            rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
        ) {
            return INVENTORY_STATUS.ONLINE;
        }
        if (rowData?.status === INVENTORY_STATUS.STOPPED || rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) {
            return INVENTORY_STATUS.OFFLINE;
        }
        return rowData?.status;
    };

    const updatedTableData = useMemo(
        () =>
            instanceTableRows?.map((row: any) => {
                const { isDisabled, errorMessage } = disableManageCheck(row);
                return {
                    ...row,
                    statusAccessor: setStatusForFilter(row),
                    cellProps: {
                        ...row.cellProps,
                        isDisabled,
                        selectionProps: {
                            title: errorMessage,
                            titleProps: {
                                placement: 'bottom'
                            }
                        }
                    }
                };
            }),
        [instanceTableRows, selectedRowsForManage]
    );

    const managedHostSubTableColDefs: ColumnProps[] = [
        {
            Header: 'Instance name',
            accessor: 'databaseInstanceName',
            customAccessor: 'statusAccessor',
            id: '1',
            isSortable: true,
            filterOptions: [
                { label: 'Online', value: 'Online' },
                { label: 'Offline', value: 'Offline' }
            ],
            width: '256px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.databaseInstanceName;
                return (
                    <div className={styles.firstColumnClass}>
                        <DsTypography
                            title={name || GENERAL.NOT_AVAILABLE}
                            className={styles.textClass}
                            variant="Semibold_14"
                        >
                            {name || GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                        <div className={styles.firstColText}>
                            {(rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            )}
                            {(rowData?.status === INVENTORY_STATUS.STOPPED ||
                                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            )}
                            {rowData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <div className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                            )}
                            <DsTypography variant="Regular_13">
                                {rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
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
            filterOptions: getFilterOptions(updatedTableData, 'name'),
            renderCell: (cellData: string, rowData: any) => (
                <DsTypography
                    title={cellData || GENERAL.NOT_AVAILABLE}
                    variant="Regular_13"
                    className={`${styles.colText} ${styles.textClass}`}
                >
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            Header: 'Engine type',
            accessor: 'hostType',
            id: '3',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'hostType'),
            renderCell: (cellData: string, rowData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            Header: 'Deployment model',
            accessor: 'serverInstallationMode',
            id: '4',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'serverInstallationMode'),
            renderCell: (cellData: string, rowData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            Header: 'Registration status',
            accessor: 'managementStatus',
            id: '5',
            isSortable: false,
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'managementStatus'),
            renderCell: (cellData: string, rowData: any) => {
                if (cellData === INVENTORY_STATUS.NOT_REGISTERED) {
                    return <DotComponent color="var(--toggle-off-bg)" value={t('databases.general.not_registered')} />;
                }
                if (cellData === INVENTORY_STATUS.IN_PROGRESS) {
                    return (
                        <div className={styles.inProgress}>
                            <DsFlashingDotsLoader />
                            <DsTypography variant="Regular_14">{INVENTORY_STATUS.IN_PROGRESS}</DsTypography>
                        </div>
                    );
                }
                if (cellData === INVENTORY_STATUS.REGISTERED) {
                    return <DotComponent color="var(--success)" value={t('databases.general.registered')} />;
                }
            }
        },
        {
            Header: 'Well-architected status',
            accessor: 'optimizationStatus',
            id: '6',
            width: '240px',
            filterOptions: getFilterOptions(updatedTableData, 'optimizationStatus'),
            renderCell: (cellData: string, rowData: any) => {
                let disableMsg = '';
                const disableMenu = () => {
                    if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
                        disableMsg = GENERAL.NON_MSSQL_ASSESSMENT_NA;
                        return true;
                    }
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
                        }
                        if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                            disableMsg = GENERAL.ASSESSMENT_AOAG_UNDETECTED;
                            return true;
                        }
                    }

                    if (rowData.fileSystemType && rowData.fileSystemType.includes(GENERAL.FSX_FOR_ONTAP)) {
                        if (
                            rowData?.statusColText === INVENTORY_STATUS.UNMANAGED ||
                            rowData?.statusColText === INVENTORY_STATUS.IN_PROGRESS
                        ) {
                            disableMsg = GENERAL.ASSESSMENT_FOR_MANAGE;
                            return true;
                        }
                        if (rowData?.statusColText === INVENTORY_STATUS.UNDETECTED) {
                            disableMsg = GENERAL.ASSESSMENT_FOR_UNDETECTED_FSXN;
                            return true;
                        }
                    }

                    if (
                        (!cellData && !rowData?.optimizationStatusLoading) ||
                        cellData === INVENTORY_STATUS.IN_PROGRESS
                    ) {
                        disableMsg = t('databases.well-architect.assessment-in-progress');
                        return true;
                    }
                    return false;
                };

                return (
                    <>
                        {disableMenu() ? (
                            <div className={styles.naContainer}>
                                <Popover
                                    popoverClass=""
                                    children={<DsTypography variant="Regular_14">{disableMsg}</DsTypography>}
                                    trigger="hover"
                                    isAppendedToBody
                                    placement="auto"
                                    container={<TooltipIcon />}
                                />
                                <DsTypography variant="Regular_14">Not analyzed</DsTypography>
                            </div>
                        ) : rowData?.optimizationStatusLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            <div className={styles.statusCol}>
                                <DsTypography variant="Regular_14">{cellData}</DsTypography>
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
            filterOptions: getFilterOptions(updatedTableData, 'protectionText'),
            renderCell: (cellData: string, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                return (
                    <>
                        {cellData && (
                            <div className={styles.colTextProtection}>
                                <div className={styles.protection}>
                                    {cellData === GENERAL.PROTECTED && (
                                        <ProtectedIcon
                                            style={{
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--green-60)'
                                            }}
                                        />
                                    )}
                                    {cellData === GENERAL.NOT_PROTECTED && (
                                        <NotProtectedIcon
                                            style={{
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--grey-45)'
                                            }}
                                        />
                                    )}
                                    <DsTypography variant="Regular_14">{cellData}</DsTypography>
                                </div>
                            </div>
                        )}
                        {!cellData && loading && <DsFlashingDotsLoader />}
                        {!cellData && !loading && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {GENERAL.NOT_AVAILABLE}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            Header: 'Performance',
            accessor: 'performance.assessment',
            id: '8',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'performance.assessment'),
            renderCell: (cellData: string, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                return (
                    <>
                        {cellData && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>
                        )}
                        {!cellData && loading && <DsFlashingDotsLoader />}
                        {!cellData && !loading && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {GENERAL.NOT_AVAILABLE}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '9',
            Header: 'AWS credentials',
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'credentialName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '10',
            Header: 'AWS account',
            accessor: 'accountId',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'accountId'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '11',
            Header: 'Region',
            accessor: 'regionName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'regionName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '12',
            Header: '',
            accessor: '',
            isSortable: false,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const { colText, disableMsg } = manageActionCol(rowData);
                return (
                    <>
                        {disableMsg ? (
                            <Popover
                                isAppendedToBody
                                children={disableMsg}
                                trigger="hover"
                                container={
                                    <div className={styles.buttonContainer}>
                                        <DsButton variant="secondary" isThin isDisabled>
                                            {colText}
                                        </DsButton>
                                    </div>
                                }
                            />
                        ) : (
                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        if (
                                            colText === ACTION_CTA.FIX_ISSUES ||
                                            colText === ACTION_CTA.WELL_ARCHITECTED
                                        ) {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setSelectedWellArchitectTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
                                            optimizeAction(rowData);
                                        } else {
                                            dispatch(setManageSingleInstanceData(rowData));
                                            dispatch(setWizardOperationType('single'));
                                            navigate('../manage-wizard');
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: './manage-wizard',
                                                    replace: true
                                                }
                                            });
                                        }
                                    }}
                                >
                                    {colText}
                                </DsButton>
                            </div>
                        )}
                    </>
                );
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: managedHostSubTableColDefs,
        rows: updatedTableData,
        pageSize: 50,
        // selectionType: 'multiple',
        // defaultSelectedRows: [],
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        initialColumnState: tableManageColumnState.instanceTable,
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
                        displayName: 'Authenticate',
                        disabled: disableOption,
                        infoText: disableMessage
                    });
                } else if (rowData.statusColText === INVENTORY_STATUS.UNMANAGED) {
                    menu.push({
                        id: 'manage',
                        displayName: 'Register',
                        disabled: disableOption,
                        infoText: disableMessage
                    });
                } else {
                    if (localStorage.getItem('protection') === 'true') {
                        menu.push({
                            id: 'protect',
                            displayName: 'Protect'
                        });
                    }
                    menu.push(
                        {
                            id: 'optimize',
                            displayName: GENERAL.WELL_ARCHITECTED_STATUS,
                            disabled: disableOption,
                            infoText: disableMessage
                        },
                        {
                            id: 'viewInstance',
                            displayName: 'Manage instance',
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
                            displayName: 'Deregister'
                        }
                    );
                }

                let disableMsg = '';
                let width = '';
                let height = '';
                const disableMenu = () => {
                    if (
                        rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                        rowData.statusColText === INVENTORY_STATUS.UNDETECTED
                    ) {
                        return true;
                    }
                    if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE || rowData?.hostType === GENERAL.ORACLE_TYPE) {
                        disableMsg = GENERAL.PGSQL_CTA_NA;
                        width = '110px';
                        height = '33px';
                        return true;
                    }
                    // if (rowData?.loading) {
                    //     disableMsg = GENERAL.INVENTORY_LOADING_DISABLED;
                    //     width = '170px';
                    //     height = '33px';
                    //     return true;
                    // }
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
                            <TooltipComponent placement="bottom" title={disableMsg} width={width} height={height}>
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

                                        // Protect POC code
                                        if (menuId === 'protect') {
                                            if (isWorkloadFactory) {
                                                window.open(
                                                    'https://staging.console.bluexp.netapp.com/unified-backup-restore',
                                                    '_blank',
                                                    'noopener,noreferrer'
                                                );
                                            } else if (window.top) {
                                                window.top.location.href =
                                                    'https://staging.console.bluexp.netapp.com/unified-backup-restore';
                                            }
                                        }

                                        if (menuId === 'optimize') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );

                                            dispatch(
                                                setSelectedWellArchitectTab(
                                                    WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
                                                )
                                            );
                                            optimizeAction(rowData);
                                        }

                                        if (menuId === 'manage') {
                                            handleManageInstances(
                                                rowData?.hostRow,
                                                [rowData?.databaseInstanceName],
                                                dispatch,
                                                styles,
                                                manageBulkInstanceApi,
                                                prepareHostApi,
                                                false
                                            );
                                        }
                                        if (menuId === 'viewInstance') {
                                            // dispatch(setSelectedHeaderTab(WLF_TABS.OVERVIEW));
                                            // dispatch(selectedTabSelection(WLF_TABS.OVERVIEW));
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.OVERVIEW));
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );
                                            optimizeAction(rowData);
                                        }
                                        if (menuId === 'viewDatabases') {
                                            dispatch(setSelectedInventoryTab('Databases'));
                                            dispatch(
                                                setSelectedFilterValue({
                                                    flag: true,
                                                    value: {
                                                        hostName: rowData?.name,
                                                        instanceName: rowData?.databaseInstanceName,
                                                        credentialName: rowData?.credentialName,
                                                        regionName: rowData?.regionName
                                                    },
                                                    filterType: 'multi'
                                                })
                                            );
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
                                            dispatch(
                                                setSelectedCsData({
                                                    host: rowData?.name,
                                                    instance: rowData?.databaseInstanceName,
                                                    database: null
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
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, updatedTableData);
        disptach(setSelectedRowsForManage(rowsData));

        if (rowsData.length > 0 && inProgressInstances?.length) {
            checkBoxHandleManage(tableProps.selectionState, rowsData, disptach);
        }
    }, [tableProps.selectionState, inProgressInstances]);

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, instanceTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

    const handleBulkOperation = () => {
        checkBoxHandleManage(tableProps.selectionState, selectedRowsForManage, disptach);
        handleManageInstancesBulk(
            selectedRowsForManage,
            dispatch,
            styles,
            manageBulkInstanceApi,
            prepareHostApi,
            false
        );
    };

    const handleManageBulk = () => {
        dispatch(setSelectedMultiDetectInstances([]));
        dispatch(setWizardOperationType('bulk'));
        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={`${styles.table} ${styles.leftBorder}`}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Instances"
                    singularTitle="Instance"
                    exportToCsvOptions={{ fileName: `InstanceTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        <div className={styles.manageInstanceButton}>
                            <DsButton isThin onClick={() => handleManageBulk()} isDisabled={loading}>
                                Register multiple instances
                            </DsButton>
                        </div>
                    }
                />
                {/* {selectedRowsForManage.length > 0 && (
                        <BulkActionContainer action={'Manage'} onClick={handleBulkOperation} />
                    )} */}
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
};

export default InstancesTable;
