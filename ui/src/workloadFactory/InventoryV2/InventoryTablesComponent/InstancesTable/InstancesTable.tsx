import {
    BlueXPListeners,
    DsButton,
    DsFlashingDotsLoader,
    DsTypography,
    DsTooltipInfo,
    Popover,
    postBlueXPMessage,
    TooltipInfo,
    useDialog
} from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ProtectedIcon } from '@netapp/icons/ic_protected.svg';
import { ReactComponent as NotProtectedIcon } from '@netapp/icons/ic_unprotected.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useAddHostJobScMutation,
    useAddHostScMutation,
    useAssignRBACPrivilegesMutation,
    useDeleteHostScMutation,
    useDiscoverExistingFsxNMutation,
    useGenerateCredentialIDMutation,
    useGetConnectorsMutation,
    useGetFsxDetailsMutation,
    useGetRBACPrivilegesMutation,
    useGetWorkSpaceIDMutation,
    useListExistingHostsMutation,
    useUnmanageMssqlInstanceMutation,
    useUnmanageOracleInstanceMutation,
    useUnmanagePgsqlInstanceMutation
} from '../../../../utils/apiService';
import {
    addHostHandlerSc,
    deleteHostJobPolling,
    getOptimizationStatusData,
    manageActionCol,
    uniqueHostRow,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import { bxpRedirect, getFilterOptions, isSmbProtocol } from '../../../../utils/utilityFunctions';
import {
    ACTION_CTA,
    DBType,
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
    setInProgressInstances,
    setInventoryTableData,
    setManageSingleInstanceData,
    setSelectedFilterValue,
    setSelectedHeaderTab,
    setSelectedInventoryTab,
    setSelectedMultiDetectInstances,
    setTableManageColumnState,
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
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { ColumnProps, Table } from '../../../../common/Lib/Table/Table';
import { useTable } from '../../../../common/Lib/Table/useTable';
import NoAgentDialog from '../ProtectionDialogs/NoAgentDialog';
import SingleAgentDialog from '../ProtectionDialogs/SingleAgentDialog';
import FetchingDialog from '../ProtectionDialogs/FetchingDIalog';
import {
    cancelProtectionForRow,
    setDataForRow,
    setWorkSpaceData,
    startProtectionStep1
} from '../../../../store/workloadFactory/snapcenterSlice';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { resetEiData } from '../../../../store/workloadFactory/agenticAISlice';
import { setActionsDisabled } from '../../../../store/workloadFactory/dialogComponentSlice';

const InstancesTable = () => {
    const { t } = useTranslation();

    const { instanceTableRows, tableManageColumnState } = useAppSelector(state => state.inventoryV2);

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { isManagedHostListLoading, fsxCredentialStatusLoading, selectedInventoryTab, selectedFilterValue } =
        useAppSelector(state => state.inventoryV2);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const [loading, setLoading] = useState(false);

    const menuOpenedRowDetail: any = useRef(null);
    const { setDialog, closeDialog } = useDialog();
    const navigate = useNavigate();

    const dispatch = useDispatch();

    const [unmanageApi] = useUnmanageMssqlInstanceMutation();
    const [unmanageApiPgsql] = useUnmanagePgsqlInstanceMutation();
    const [unmanageApiOracle] = useUnmanageOracleInstanceMutation();
    const [getConnector] = useGetConnectorsMutation();
    const [getFsxDetails] = useGetFsxDetailsMutation();
    const [discoverExistingFsxN] = useDiscoverExistingFsxNMutation();
    const [getWorkSpaceID] = useGetWorkSpaceIDMutation();
    const [getRBACPrivileges] = useGetRBACPrivilegesMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [assignRBACPrivileges] = useAssignRBACPrivilegesMutation();
    const [generateCredentialID] = useGenerateCredentialIDMutation();
    const [addHostScApi] = useAddHostScMutation();
    const [addHostJobScApi] = useAddHostJobScMutation();
    const [deleteHostSc] = useDeleteHostScMutation();

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
                    '10': {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    '12': {
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

    const getUnmanageApiByHostType = (
        hostType: string,
        apis: {
            mssql: Function;
            pgsql: Function;
            oracle: Function;
        }
    ) => {
        switch (hostType) {
            case DBType.MSSQL:
                return apis.mssql;
            case DBType.POSTGRESQL:
                return apis.pgsql;
            case DBType.ORACLE:
                return apis.oracle;
            default:
                return null;
        }
    };

    const handleDeRegister = (rowData: any) => {
        const updatedState = store.getState();
        const { inProgressInstances: inProgressInstancesL, inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData.resourceId, rowData?.credentialId, rowData?.regionId)] ||
            inventoryTableData[uniqueHostRow(rowData.ec2InstanceId, rowData?.credentialId, rowData?.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.databaseInstanceName
        );
        const inProgressId = uniqueHostRow(
            `${rowData?.ec2InstanceId}_${rowData?.databaseInstanceName}`,
            rowData?.credentialId,
            rowData?.regionId
        );
        dispatch(setInProgressInstances(new Set([...Array.from(inProgressInstancesL), inProgressId])));

        const unmanageApiFn = getUnmanageApiByHostType(rowData.hostType, {
            mssql: unmanageApi,
            pgsql: unmanageApiPgsql,
            oracle: unmanageApiOracle
        });

        if (!unmanageApiFn) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: `Unsupported database type for deregister: ${rowData.hostType}`
                })
            );
            return;
        }
        unmanageApiFn({
            credentialsId: targettedHost?.credentialId,
            regionId: targettedHost?.regionId,
            resourceId: targettedHost?.resourceId,
            dbInstanceId: targettedDbInstance?.databaseInstanceId
        }).then((res: any) => {
            const updatedStateA = store.getState();
            const inProgressInstancesA = updatedStateA?.inventoryV2.inProgressInstances;
            const updatedInProgressInstances = new Set([...inProgressInstancesA]);
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
                callback={() => handleDeRegister(rowData)}
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
        dispatch(resetEiData({}));
    };

    // Snapcenter Protection code starts

    const isCancelled = (key: any) => store.getState().snapCenter.dataMap[key]?.cancelled;

    const handleProtection = async (rowData: any) => {
        const key = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
        const existingData = store.getState().snapCenter.dataMap[key] || {};

        dispatch(setDataForRow({ key, stepData: { cancelled: false } }));

        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header')}
                content={<FetchingDialog />}
                primaryButton={t('databases.inventory.redirect')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    dispatch(cancelProtectionForRow(key));
                    closeDialog();
                }}
                callback={() => {}}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.LOADER}
            />
        );

        if (existingData.initialHostCheck) {
            if (existingData.isHostManaged) {
                return showSingleAgentDialog([], true, rowData);
            }
            // else proceed to normal flow
        } else {
            // FIRST host API call under fetching dialog
            const hostsRes = await listExistingHosts({ accountID: store.getState().auth.accountId });
            if (isCancelled(key)) return;

            let hostExists = false;

            // Getting workspace id
            const workSpaceRes = await getWorkSpaceID({ accountID: store.getState().auth.accountId });
            if (workSpaceRes?.data?.items?.length) {
                dispatch(setWorkSpaceData(workSpaceRes.data.items[0]));
            }

            if (hostsRes?.data?.hosts?.length > 0) {
                const foundHost = hostsRes?.data?.hosts?.find((host: any) => {
                    const hostNameBeforeDot = host.name.split('.')[0];
                    return hostNameBeforeDot === rowData.hostRow.name;
                });

                if (foundHost && foundHost?.overallStatus !== 'NoPlugins' && foundHost?.overallStatus !== 'Stopped') {
                    hostExists = true;
                }
            }

            // Always store result so next time we skip API call
            dispatch(
                setDataForRow({
                    key,
                    stepData: {
                        initialHostCheck: true,
                        hostChecked: true,
                        isHostManaged: hostExists
                    }
                })
            );

            if (hostExists) {
                return showSingleAgentDialog([], true, rowData);
            }
        }

        if (existingData.connectors) {
            await handleFsxFlow(rowData, key, existingData);
            return;
        }

        const res = await getConnector({ accountID: store.getState().auth.accountId });
        if (isCancelled(key)) return;

        if (res?.data?.occms) {
            if (res.data.occms.length > 0) {
                dispatch(setDataForRow({ key, stepData: { connectors: res.data } }));
                await handleFsxFlow(rowData, key, { connectors: res.data });
            } else {
                showNoAgentDialog();
            }
        } else {
            closeDialog();
        }
    };

    const showNoAgentDialog = () => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header')}
                content={<NoAgentDialog />}
                primaryButton={t('databases.inventory.redirect')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    bxpRedirect(isWorkloadFactory);
                }}
                customClass={styles.protectionDialog}
            />
        );
    };

    const showSingleAgentDialog = (connectors?: any, hostExists?: boolean, rowData?: any) => {
        const state = store.getState();
        const dialogKeyValue = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
        const protectionState = state.snapCenter.protectionProcessState[dialogKeyValue];
        if (protectionState?.step1Status === 'running' || protectionState?.step2Status === 'running') {
            dispatch(setActionsDisabled(true));
        } else {
            dispatch(setActionsDisabled(false));
        }

        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <DsTypography variant="Regular_14">{t('databases.inventory.protect-header')}</DsTypography>
                        {!hostExists && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-1-out-of')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={<SingleAgentDialog agents={connectors} hostExists={hostExists} dialogKey={dialogKeyValue} />}
                primaryButton={hostExists ? t('databases.inventory.redirect') : t('databases.inventory.start')}
                secondaryButton={t('databases.inventory.cancel')}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    if (hostExists) {
                        bxpRedirect(isWorkloadFactory);
                    } else {
                        addHostHandlerSc(
                            rowData,
                            dispatch,
                            generateCredentialID,
                            addHostScApi,
                            addHostJobScApi,
                            t,
                            deleteHostSc
                        );
                    }
                }}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.SINGLE_AGENT}
            />
        );
    };

    const handleFsxFlow = async (rowData: any, key: string, stepData: any) => {
        // if already have fsx info, skip
        if (!stepData.fsxChecked) {
            const fsxRes = await getFsxDetails({ accountID: store.getState().auth.accountId });
            if (isCancelled(key)) return;

            const fsxExists = fsxRes?.data?.some((item: any) => item.id === rowData.fsxId);

            const workSpaceIdExists = store.getState().snapCenter.workSpaceData?.id;

            let workSpaceRes = '';

            if (!workSpaceIdExists) {
                const workSpaceResponse = await getWorkSpaceID({ accountID: store.getState().auth.accountId });
                if (workSpaceResponse?.data?.items?.length) {
                    workSpaceRes = workSpaceResponse.data.items[0].id;
                    dispatch(setWorkSpaceData(workSpaceResponse.data.items[0]));
                }
            } else {
                workSpaceRes = workSpaceIdExists;
            }

            if (!fsxExists) {
                if (isCancelled(key)) return;

                await discoverExistingFsxN({
                    accountID: store.getState().auth.accountId,
                    credentialID: rowData.credentialId,
                    workSpaceID: workSpaceRes,
                    regionID: rowData.regionId,
                    payload: [rowData.fsxId]
                });

                if (isCancelled(key)) return;
            }
            dispatch(setDataForRow({ key, stepData: { fsxChecked: true } }));
        }

        if (!stepData.rbac) {
            const rbacRes = await getRBACPrivileges({ accountID: store.getState().auth.accountId });
            if (rbacRes?.data?.items && rbacRes?.data?.items?.length > 0) {
                const emailID = store.getState().auth.userMetadata?.email;
                const matchingUser = rbacRes.data.items.find((item: any) => item.email === emailID);
                if (matchingUser) {
                    if (matchingUser?.roles) {
                        const hasRequiredRole = matchingUser?.roles.includes('381a2b6e-693b-4829-95a5-fbd753db30c7');
                        if (!hasRequiredRole) {
                            await assignRBACPrivileges({
                                accountID: store.getState().auth.accountId,
                                payload: {
                                    type: 'application/vnd.netapp.bxp.userbulk',
                                    users: [{ userId: matchingUser?.id }],
                                    version: '1.0'
                                }
                            });
                        }
                    }
                }
            }
            if (isCancelled(key)) return;

            dispatch(setDataForRow({ key, stepData: { rbac: rbacRes } }));
        }

        if (!stepData.hostChecked) {
            const hostsRes = await listExistingHosts({ accountID: store.getState().auth.accountId });
            if (isCancelled(key)) return;

            // @ts-ignore
            if (hostsRes?.error?.data === 'Unauthorized') {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'Unauthorized'
                    })
                );
            }

            if (hostsRes?.data && hostsRes?.data?.hosts && hostsRes?.data?.hosts.length > 0) {
                const hostExists = hostsRes?.data?.hosts?.some((host: any) => {
                    // Extract hostname before first dot for comparison
                    const hostNameBeforeDot = host.name.split('.')[0];
                    return hostNameBeforeDot === rowData.hostRow.name;
                });

                dispatch(setDataForRow({ key, stepData: { hostChecked: true, isHostManaged: hostExists } }));
            } else {
                dispatch(setDataForRow({ key, stepData: { hostChecked: true, isHostManaged: false } }));
            }
        }

        if (isCancelled(key)) return;

        proceedWithProtection(stepData.connectors, rowData);
    };

    const proceedWithProtection = (data: any, rowData: any) => {
        const activeAgents = data?.occms?.filter((item: any) => item.agent.status === 'active') || [];

        if (activeAgents.length === 0) {
            showNoAgentDialog();
        }
        if (activeAgents.length > 0) {
            // Single Connector case
            showSingleAgentDialog(activeAgents, false, rowData);
        }
    };

    const disableManageCheck = (rowData: any) => {
        let errorMessage = '';
        let isDisabled = false;
        if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
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
        } else if (rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP && !rowData?.fsxId) {
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
                const optimizationData = getOptimizationStatusData(row, t);
                let optimizationStatus;
                let optimizationDisableMsg;
                let optimizationIsDisabled;
                if (
                    typeof optimizationData === 'object' &&
                    optimizationData !== null &&
                    'displayValue' in optimizationData
                ) {
                    optimizationStatus = optimizationData.displayValue;
                    optimizationDisableMsg = optimizationData.disableMsg;
                    optimizationIsDisabled = optimizationData.isDisabled;
                } else {
                    optimizationStatus = optimizationData;
                    optimizationDisableMsg = '';
                    optimizationIsDisabled = false;
                }
                return {
                    ...row,
                    statusAccessor: setStatusForFilter(row),
                    optimizationStatus,
                    optimizationDisableMsg,
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
        [instanceTableRows]
    );

    const isUnregisteredRows = useMemo(
        () =>
            instanceTableRows?.some((row: any) => {
                const { colText, disableMsg } = manageActionCol(t, row);
                return colText === ACTION_CTA.MANAGE_INSTANCES && disableMsg === '';
            }),
        [instanceTableRows]
    );

    const protectionTooltipText = (data: any) => (
        <div className={styles.protectionTooltipMessage}>
            {data.map((val: any, index: number) => (
                <DsTypography key={index} variant="Regular_13" className={styles.textHeight}>
                    {val}
                </DsTypography>
            ))}
        </div>
    );

    const resourceScreenNavigation = (rowData: any) => {
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
    };

    const instanceNameHyperLink = (rowData: any, name: string) => {
        if (
            name &&
            rowData?.hostType === DBType.MSSQL &&
            rowData?.managementStatus === INVENTORY_STATUS.REGISTERED &&
            (rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP)
        ) {
            return (
                <DsButton onClick={() => resourceScreenNavigation(rowData)} type="text">
                    {name}
                </DsButton>
            );
        }
        return name;
    };

    const managedHostSubTableColDefs: ColumnProps[] = [
        {
            Header: t('databases.instance-table.headers.instance-name'),
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
                            {name && instanceNameHyperLink(rowData, name)}
                            {!name && GENERAL.NOT_AVAILABLE}
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
                                {(() => {
                                    if (
                                        rowData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ) {
                                        return INVENTORY_STATUS.ONLINE;
                                    }
                                    if (
                                        rowData?.status === INVENTORY_STATUS.STOPPED ||
                                        rowData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ) {
                                        return INVENTORY_STATUS.OFFLINE;
                                    }
                                    return rowData?.status;
                                })()}
                                {!rowData?.status && rowData?.loading && <DsFlashingDotsLoader />}
                                {!rowData?.status && !rowData?.loading && INVENTORY_STATUS.UNKNOWN}
                            </DsTypography>
                        </div>
                    </div>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.host-name'),
            accessor: 'name',
            id: '2',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'name'),
            renderCell: (cellData: string) => (
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
            Header: t('databases.instance-table.headers.engine-type'),
            accessor: 'hostType',
            id: '3',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'hostType'),
            renderCell: (cellData: string) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            Header: t('databases.instance-table.headers.deployment-model'),
            accessor: 'serverInstallationMode',
            id: '4',
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'serverInstallationMode'),
            renderCell: (cellData: string) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            Header: t('databases.instance-table.headers.registration-status'),
            accessor: 'managementStatus',
            id: '5',
            isSortable: false,
            width: '213px',
            filterOptions: getFilterOptions(updatedTableData, 'managementStatus'),
            renderCell: (cellData: string) => {
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
                return <DotComponent color="var(--toggle-off-bg)" value={t('databases.general.not_registered')} />;
            }
        },
        {
            id: '6',
            Header: t('databases.instance-table.headers.fsx-for-ontap'),
            accessor: 'fileSystemName',
            isSortable: false,
            filterOptions: getFilterOptions(updatedTableData, 'fileSystemName'),
            width: '213px',
            renderCell: (cellData: any, rowData: any) => (
                <>
                    {cellData && rowData?.fsxId ? (
                        <div className={styles.fsxNameContainer}>
                            <DsTooltipInfo className={`${styles.fsxName} ${styles['tooltip-icon']}`} trigger="hover">
                                <div className={`${styles.tooltipContainer} ${styles.fsxNamePopOver}`}>
                                    <DsTypography variant="Regular_13">{rowData?.fsxId}</DsTypography>
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children="Copied"
                                        container={
                                            <CopyToClipboardCommon
                                                value={rowData?.fsxId}
                                                iconProvided={<CopyIcon fill="#A7A7A7" />}
                                            />
                                        }
                                    />
                                </div>
                            </DsTooltipInfo>
                            <div className={styles.fsxName}>
                                <DsTypography
                                    className={styles.fsxNameText}
                                    variant="Regular_13"
                                    title={cellData || GENERAL.NOT_AVAILABLE}
                                >
                                    {cellData || GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </div>
                        </div>
                    ) : (
                        <DsTypography variant="Regular_13" className={styles.colText}>
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    )}
                </>
            )
        },
        {
            Header: t('databases.instance-table.headers.well-architected-status'),
            accessor: 'optimizationStatus',
            id: '7',
            width: '240px',
            filterOptions: getFilterOptions(updatedTableData, 'optimizationStatus'),
            renderCell: (cellData: string, rowData: any) => {
                // If the computed display value is "Not analyzed", show with tooltip
                if (cellData === 'Not analyzed') {
                    return (
                        <div className={styles.naContainer}>
                            <Popover
                                popoverClass=""
                                trigger="hover"
                                isAppendedToBody
                                placement="auto"
                                container={<TooltipIcon />}
                            >
                                <DsTypography variant="Regular_14">{rowData.optimizationDisableMsg}</DsTypography>
                            </Popover>
                            <DsTypography variant="Regular_14">Not analyzed</DsTypography>
                        </div>
                    );
                }
                if (rowData?.optimizationStatusLoading) {
                    return <DsFlashingDotsLoader />;
                }
                return (
                    <div className={styles.statusCol}>
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        },
        {
            Header: t('databases.instance-table.headers.protection-status'),
            accessor: 'protectionText',
            id: '8',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'protectionText'),
            renderCell: (cellData: string, rowData: any) => {
                let loading = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loading = true;
                }
                const protectedByList = [];
                const protection = rowData?.protection ?? {};
                if (
                    [
                        protection?.isSqlNativeEnabled,
                        protection?.isAwsBackupEnabled?.fsxn,
                        protection?.isCRREnabled,
                        protection?.isFsxOntapSnapshotsEnabled
                    ].some(Boolean)
                ) {
                    protectedByList.push(t('databases.general.storage-consistent'));
                }

                if (protection?.isAppConsistentBackupEnabled) {
                    protectedByList.push(t('databases.general.application-consistent'));
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
                                {protectedByList?.length > 0 && (
                                    <div className={commonStyles.protectionTooltipPopOver}>
                                        <TooltipInfo className={styles['tooltip-icon']} trigger="hover">
                                            {protectionTooltipText(protectedByList)}
                                        </TooltipInfo>
                                    </div>
                                )}
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
            Header: t('databases.instance-table.headers.performance'),
            accessor: 'performance.assessment',
            id: '9',
            width: '200px',
            filterOptions: getFilterOptions(updatedTableData, 'performance.assessment'),
            renderCell: (cellData: string, rowData: any) => {
                let loadingPA = rowData?.loading || rowData?.subLoading;
                if (rowData?.fullManagedInstanceLoading && rowData?.statusColText === INVENTORY_STATUS.MANAGED) {
                    loadingPA = true;
                }
                return (
                    <>
                        {cellData && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {cellData}
                            </DsTypography>
                        )}
                        {!cellData && loadingPA && <DsFlashingDotsLoader />}
                        {!cellData && !loadingPA && (
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {GENERAL.NOT_AVAILABLE}
                            </DsTypography>
                        )}
                    </>
                );
            }
        },
        {
            id: '10',
            Header: t('databases.instance-table.headers.aws-credentials'),
            accessor: 'credentialName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'credentialName'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '11',
            Header: t('databases.instance-table.headers.aws-account'),
            accessor: 'accountId',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'accountId'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '12',
            Header: t('databases.instance-table.headers.region'),
            accessor: 'regionName',
            isSortable: true,
            filterOptions: getFilterOptions(updatedTableData, 'regionName'),
            width: '213px',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {cellData || GENERAL.NOT_AVAILABLE}
                </DsTypography>
            )
        },
        {
            id: '13',
            Header: '',
            accessor: '',
            isSortable: false,
            width: '200px',
            isSticky: true,
            renderCell: (cellData: any, rowData: any) => {
                const { colText, disableMsg } = manageActionCol(t, rowData);
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
                                            navigate('../register-wizard');
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: './register-wizard',
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

                if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                    if (rowData.hostType === DBType.ORACLE || rowData.hostType === DBType.POSTGRESQL) {
                        menu.push({
                            id: 'unManage',
                            displayName: 'Deregister'
                        });
                    } else if (rowData.hostType === DBType.MSSQL) {
                        menu.push(
                            {
                                id: 'optimize',
                                displayName: t('databases.well-architect.well-architect-state'),
                                disabled: disableOption,
                                infoText: disableMessage
                            },
                            {
                                id: 'investigateErrors',
                                displayName: 'Investigate errors',
                                disabled: disableOption,
                                infoText: disableMessage
                            },
                            {
                                id: 'viewInstance',
                                displayName: 'Manage instance',
                                disabled: disableOption,
                                infoText: disableMessage,
                                subMenu: [
                                    {
                                        id: 'viewInstance',
                                        displayName: 'Instance dashboard',
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
                                    }
                                ]
                            },
                            {
                                id: 'protect',
                                displayName: 'Protect',
                                disabled: disableOption || !rowData?.fsxId,
                                infoText: disableMessage
                            },

                            {
                                id: 'unManage',
                                displayName: 'Deregister'
                            }
                        );
                    }
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
                        rowData.fileSystemType !== GENERAL.FSX_FOR_ONTAP &&
                        !rowData?.fsxId
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
                                            handleProtection(rowData);
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

                                        if (menuId === 'investigateErrors') {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                            dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
                                            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
                                            dispatch(
                                                setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION)
                                            );
                                            dispatch(
                                                setFSXId({
                                                    fsxId: rowData?.fsxId,
                                                    ec2InstanceId: rowData?.ec2InstanceId
                                                })
                                            );
                                            optimizeAction(rowData);
                                        }

                                        if (menuId === 'viewInstance') {
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
        dispatch(setTableManageColumnState({ ...tableManageColumnState, instanceTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

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
                            {!loading && !isUnregisteredRows ? (
                                <Popover
                                    isAppendedToBody
                                    children={t('databases.register-flow.register-bulk-disable-tooltip')}
                                    trigger="hover"
                                    container={
                                        <DsButton isThin isDisabled>
                                            {t('databases.register-flow.register-multiple-instances')}
                                        </DsButton>
                                    }
                                />
                            ) : (
                                <DsButton
                                    isThin
                                    onClick={() => handleManageBulk()}
                                    isDisabled={loading || !isUnregisteredRows}
                                >
                                    {t('databases.register-flow.register-multiple-instances')}
                                </DsButton>
                            )}
                        </div>
                    }
                />
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
