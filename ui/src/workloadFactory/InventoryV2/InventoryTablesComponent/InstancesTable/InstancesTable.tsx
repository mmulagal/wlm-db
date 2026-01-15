import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useAddHostJobScMutation,
    useAddHostScMutation,
    useAssignBackupRecoveryLicenseMutation,
    useAssignRBACPrivilegesMutation,
    useConfigureDirectoryMutation,
    useDeleteHostScMutation,
    useDiscoverExistingFsxNMutation,
    useGenerateCredentialIDMutation,
    useGetBackupRecoveryLicenseMutation,
    useGetConnectorsMutation,
    useGetDiscoverHostResultMutation,
    useGetDiscoverInstanceResultMutation,
    useGetFsxDetailsMutation,
    useGetOrganizationIdsMutation,
    useGetRBACPrivilegesMutation,
    useGetSCCrendentialsMutation,
    useGetWorkSpaceIDMutation,
    useListAllDirectoriesMutation,
    useListExistingHostsMutation,
    useRegisterResourceCredentialsBulkMutation,
    useUnmanageMssqlInstanceMutation,
    useUnmanageOracleInstanceMutation,
    useUnmanagePgsqlInstanceMutation
} from '../../../../utils/apiService';
import {
    addHostHandlerSc,
    getDeregisterContent,
    instanceExtraDataUpdate,
    manageActionCol,
    uniqueHostRow,
    updateInstanceStatus
} from '../../InventoryUtilsV2';
import { bxpRedirect, collapseAllRows, isSmbProtocol } from '../../../../utils/utilityFunctions';
import { ACTION_CTA, DBType, FROM_DIALOG, INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import store from '../../../../store/store';
import {
    setInProgressInstances,
    setInventoryTableData,
    setRegisterHostType,
    setSelectedFilterValue,
    setSelectedMultiDetectInstances,
    setSelectedRowsForBulkRegister,
    setTableManageColumnState,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { updateOrgId } from '../../../../store/authSlice';
import { NOTIFICATION_TYPES, addNotification } from '../../../../store/notificationSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import {
    setGwPageLoadInstanceData,
    setLandingFrom,
    setOptimizingData
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../../common/TooltipComponent/TooltipComponent';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import styles from '../InventoryTable.module.scss';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { useTable } from '../../../../common/Lib/Table/useTable';
import NoAgentDialog from '../ProtectionDialogs/NoAgentDialog';
import SingleAgentDialog from '../ProtectionDialogs/SingleAgentDialog';
import FetchingDialog from '../ProtectionDialogs/FetchingDIalog';
import {
    cancelProtectionForRow,
    setAuthVerification,
    setDataForRow,
    upsertProtectionHosts,
    upsertInstanceProtectionBatch,
    setWorkSpaceData,
    setSelectedAgent
} from '../../../../store/workloadFactory/snapcenterSlice';
import {
    resetAgenticPreCheckData,
    resetEiData,
    setLogAnalyzerState
} from '../../../../store/workloadFactory/agenticAISlice';
import { setActionsDisabled } from '../../../../store/workloadFactory/dialogComponentSlice';
import { handleProtectionUtil } from '../../AddHostUtils';
import { getInstanceTableColumns } from './InstanceTableColumns';
import { mssqlInstanceColumnFilterMap } from './MssqlInstanceColumnList';
import { oracleDatabaseColumnFilterMap } from './OracleDatabaseColumnsList';
import { pgsqlInstanceColumnFilterMap } from './PgsqlInstanceColumnList';
import { getInitialInstanceTableColState } from '../../../../utils/manageColumnUtils';
import BulkActionContainer from '../../../../common/BulkAction/BulkActionContainer';

import WindowsAuthDialog from '../ProtectionDialogs/WindowsAuthDialog';
import {
    getInstableTableTopMenuOptions,
    getInstanceTableMenuOptions,
    handleInstanceMenuSelection,
    inventoryBannerFilterUpdates,
    isInstanceActionDisabled,
    isRowSelectableForBulkRegister,
    getDisabledSelectionTooltip
} from './InstanceTableHelper';

const InstancesTable = () => {
    const { t } = useTranslation();

    const { instanceTableRows, tableManageColumnState, selectedRowsForBulkRegister } = useAppSelector(
        state => state.inventoryV2
    );
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const {
        isManagedHostListLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        selectedHostType,
        selectedInventoryTab,
        selectedFilterValue
    } = useAppSelector(state => state.inventoryV2);
    const { multiDataLoading, regionMapping } = useAppSelector(state => state.headers);
    const { instanceProtection } = useAppSelector(state => state.snapCenter);
    const orgId = useAppSelector(state => state.auth?.orgId);
    const {
        notRegisteredSQLView,
        notActiveSQLInstancesView,
        notActiveOracleDatabasesView,
        notRegisteredOracleDatabasesView,
        notOptimizedSQLInstancesView,
        notOptimizedOracleDatabaseView
    } = useAppSelector(state => state.inventoryBannerSlice);

    const [menuOpenedRow, setOpenedRow] = useState(null);

    const [loading, setLoading] = useState(false);
    const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

    const menuOpenedRowDetail: any = useRef(null);
    const inventoryTableRef = useRef<HTMLDivElement>(null);
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
    const [getBackupRecoveryLicense] = useGetBackupRecoveryLicenseMutation();
    const [assignBackupRecoveryLicense] = useAssignBackupRecoveryLicenseMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [assignRBACPrivileges] = useAssignRBACPrivilegesMutation();
    const [generateCredentialID] = useGenerateCredentialIDMutation();
    const [addHostScApi] = useAddHostScMutation();
    const [addHostJobScApi] = useAddHostJobScMutation();
    const [deleteHostSc] = useDeleteHostScMutation();
    const [configureDirectory] = useConfigureDirectoryMutation();
    const [listAllDirectories] = useListAllDirectoriesMutation();
    const [getDiscoverHostResult] = useGetDiscoverHostResultMutation();
    const [getDiscoverInstanceResult] = useGetDiscoverInstanceResultMutation();
    const [getSCCrendentials] = useGetSCCrendentialsMutation();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [getOrganizationIds] = useGetOrganizationIdsMutation();

    const { title, exportToCsvFileName, buttonText } = getInstableTableTopMenuOptions(selectedHostType, t);

    // Prefetch SnapCenter hosts and instances to decide Protect/Edit Protection
    const protectionPrefetchRun = useRef(false);
    useEffect(() => {
        if (protectionPrefetchRun.current || isDemoMode) return;
        protectionPrefetchRun.current = true;

        (async () => {
            try {
                let organizationId: string = orgId || '';
                if (isWorkloadFactory && !organizationId) {
                    const orgRes: any = await getOrganizationIds({ selfErrorHandling: true });
                    const resolved = orgRes?.data?.items?.find(
                        (i: any) => i?.legacyId === store.getState().auth.accountId
                    )?.ownerOrganizationId;
                    if (resolved) {
                        organizationId = resolved;
                        dispatch(updateOrgId(resolved));
                    } else {
                        return;
                    }
                }
                const hostsRes: any = await listExistingHosts({ accountID: organizationId, selfErrorHandling: true });
                const hosts: any[] = hostsRes?.data?.hosts || [];
                if (hosts.length) {
                    dispatch(upsertProtectionHosts(hosts));
                }

                const [workSpaceRes, connectorsRes] = await Promise.all([
                    getWorkSpaceID({ accountID: organizationId, selfErrorHandling: true }),
                    getConnector({ accountID: organizationId, selfErrorHandling: true })
                ]);
                const workspaceItem = workSpaceRes?.data?.items?.[0];
                const workspaceID = workspaceItem?.id;
                if (workspaceItem) {
                    dispatch(setWorkSpaceData(workspaceItem));
                }
                const occms: any[] = connectorsRes?.data?.occms || [];
                const activeAws = occms.find((o: any) => o?.agent?.status === 'active' && o?.agent?.provider === 'aws');
                const agentID = activeAws?.agent?.agentId;
                if (agentID) {
                    dispatch(setSelectedAgent([{ id: agentID }]));
                }

                if (!workspaceID || !agentID || !hosts.length) return;

                const hostNames = hosts.map(h => h?.name).filter(Boolean);
                await Promise.allSettled(
                    hostNames.map(name =>
                        getDiscoverInstanceResult({
                            accountID: organizationId,
                            name,
                            agentID,
                            workspaceID,
                            selfErrorHandling: true
                        })
                            .then((instRes: any) => {
                                const instances: any[] = instRes?.data?.instances || [];
                                if (!instances.length) return;
                                const items = instances.map((it: any) => ({
                                    host: it?.host,
                                    hostName: it?.host,
                                    name: it?.name,
                                    instance: it?.name,
                                    instanceName: it?.name,
                                    status: it?.status,
                                    id: it?.id,
                                    policies: it?.policies || []
                                }));
                                dispatch(upsertInstanceProtectionBatch({ items }));
                            })
                            .catch(() => undefined)
                    )
                );
            } catch (e) {
                // No need to handle error
            }
        })();
    }, [
        orgId,
        listExistingHosts,
        getWorkSpaceID,
        getConnector,
        getDiscoverInstanceResult,
        isWorkloadFactory,
        getOrganizationIds,
        dispatch,
        isDemoMode
    ]);

    // Direct Edit Protection handler - no prereqs, redirect only
    const handleEditProtection = (rowData: any) => {
        bxpRedirect(isWorkloadFactory, { ...rowData, editProtection: true }, 'instance', getDiscoverInstanceResult);
    };

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                isDiscoverInProgress ||
                fullHostDataLoading ||
                isManagedHostListLoading ||
                fsxCredentialStatusLoading ||
                fsxCredentialStatusLoadingOracle ||
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
        fsxCredentialStatusLoadingOracle,
        pgsqlDatabaseHostsLoading,
        pgsqlFullHostDataLoading,
        multiDataLoading
    ]);

    const getColumnFilterMap = () => {
        switch (selectedHostType) {
            case DBType.MSSQL:
                return mssqlInstanceColumnFilterMap;
            case DBType.POSTGRESQL:
                return pgsqlInstanceColumnFilterMap;
            case DBType.ORACLE:
                return oracleDatabaseColumnFilterMap;
            default:
                return mssqlInstanceColumnFilterMap;
        }
    };
    const getInitialFilter = () => {
        if (selectedInventoryTab === 'Instances' && selectedFilterValue?.flag === true) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            const filterMap = getColumnFilterMap();
            return {
                textFilter: '',
                count: 3,
                columns: {
                    [filterMap.hostName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.credentialName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.credentialName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.regionName]: {
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
                            {t('databases.deregister-flow.content-part1')} {getDeregisterContent(rowData, t)}?{' '}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ marginTop: '24px', width: '700px' }}>
                            {t('databases.deregister-flow.content-part2')}
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

        dispatch(setOptimizingData({}));

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
        dispatch(setLogAnalyzerState(rowData?.logAnalyzer?.status));
    };

    // Snapcenter Protection code starts

    const fetchDialog = (key: string) => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header')}
                content={<FetchingDialog />}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    dispatch(cancelProtectionForRow(key));
                    closeDialog();
                }}
                hidePrimaryButton
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.LOADER}
            />
        );
    };

    // SC Auth Dialog
    const scAuthDialog = (key: string, dialogToOpen: string, activeAgents?: [], boolValue?: boolean, rowData?: any) => {
        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <DsTypography variant="Regular_14">{t('databases.inventory.protect-header')}</DsTypography>

                        <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                            {t('databases.inventory.step-1-out-of')}
                        </DsTypography>
                    </div>
                }
                content={<WindowsAuthDialog />}
                primaryButton={t('databases.inventory.continue')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    dispatch(cancelProtectionForRow(key));
                    closeDialog();
                }}
                callback={async () => {
                    try {
                        dispatch(setAuthVerification(true));
                        const state = store.getState(); // For live state
                        const credDetails = state.snapCenter.credentials;
                        const payload = {
                            items: [
                                {
                                    credentials: [
                                        {
                                            resourceId: rowData?.databaseInstanceName,
                                            resourceType: 'WINDOWS_USER',
                                            username: credDetails.username,
                                            password: credDetails.password
                                        }
                                    ],

                                    ec2InstanceId: rowData?.ec2InstanceId,
                                    region: rowData.regionId,
                                    credentialsId: rowData.credentialId
                                }
                            ]
                        };
                        const result = await registerResourceCredBulk({ payload });
                        if (result && !result?.error && result?.data) {
                            if (result?.data?.items[0]?.registerDetails[0]?.databaseServerError) {
                                dispatch(setAuthVerification(false));
                                dispatch(
                                    addNotification({
                                        notificationType: NOTIFICATION_TYPES.ERROR,
                                        message:
                                            result?.data?.items[0]?.registerDetails[0]?.databaseServerError ||
                                            'Authentication failed. Please check the credentials and try again.'
                                    })
                                );
                            } else {
                                // Mark authentication as completed for this row
                                dispatch(
                                    setDataForRow({
                                        key,
                                        stepData: {
                                            scCredentialsChecked: true,
                                            scCredentialsValid: true
                                        }
                                    })
                                );

                                if (dialogToOpen === 'openNoAgent') {
                                    setTimeout(() => {
                                        showNoAgentDialog(true, rowData);
                                    }, 10);
                                } else {
                                    setTimeout(() => {
                                        showSingleAgentDialog(activeAgents, boolValue, rowData, true);
                                    }, 10);
                                }
                            }
                        }
                    } catch (error) {
                        dispatch(setAuthVerification(false));
                    } finally {
                        dispatch(setAuthVerification(false));
                    }
                }}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.WINDOWS_AUTH}
            />
        );
    };

    const handleProtection = async (rowData: any) => {
        await handleProtectionUtil(rowData, {
            dispatch,
            fetchDialog,
            showSingleAgentDialog,
            showNoAgentDialog,
            closeDialog,
            listExistingHosts,
            getWorkSpaceID,
            getConnector,
            getFsxDetails,
            discoverExistingFsxN,
            assignRBACPrivileges,
            getRBACPrivileges,
            getBackupRecoveryLicense,
            assignBackupRecoveryLicense,
            isDemoMode,
            getSCCrendentials,
            scAuthDialog,
            getOrganizationIds
        });
    };

    const showNoAgentDialog = (extraStep?: boolean, rowData?: any) => {
        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <DsTypography variant="Regular_14">{t('databases.inventory.protect-header')}</DsTypography>

                        {extraStep && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-2-out-of')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={<NoAgentDialog />}
                primaryButton={t('databases.inventory.redirect')}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    bxpRedirect(isWorkloadFactory, rowData);
                }}
                customClass={styles.protectionDialog}
            />
        );
    };

    const showSingleAgentDialog = (connectors?: any, hostExists?: boolean, rowData?: any, extraStep?: boolean) => {
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
                        {!hostExists && !extraStep && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-1-out-of')}
                            </DsTypography>
                        )}
                        {extraStep && !hostExists && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-2-out-of-3')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={
                    <SingleAgentDialog
                        agents={connectors}
                        hostExists={hostExists}
                        dialogKey={dialogKeyValue}
                        extraStep={extraStep}
                        rowData={rowData}
                        dialogType="instance"
                    />
                }
                primaryButton={hostExists ? t('databases.inventory.redirect') : t('databases.inventory.continue')}
                secondaryButton={t('databases.inventory.cancel')}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    if (hostExists) {
                        bxpRedirect(isWorkloadFactory, rowData, 'instance', getDiscoverInstanceResult);
                    } else {
                        addHostHandlerSc(
                            rowData,
                            dispatch,
                            generateCredentialID,
                            addHostScApi,
                            addHostJobScApi,
                            t,
                            deleteHostSc,
                            listAllDirectories,
                            configureDirectory,
                            getDiscoverHostResult
                        );
                    }
                }}
                customClass={styles.protectionDialog}
                dialogFrom={FROM_DIALOG.SINGLE_AGENT}
            />
        );
    };

    // Maximum number of instances that can be selected for bulk register
    const MAX_BULK_REGISTER_SELECTION = 10;

    // For Oracle: Check if there are any registerable rows (used for the Register button in TableTopBar)
    const isUnregisteredRows = useMemo(
        () =>
            selectedHostType === DBType.ORACLE &&
            instanceTableRows?.some((row: any) => {
                const { colText, disableMsg } = manageActionCol(t, selectedHostType, row);
                return colText === ACTION_CTA.REGISTER_DATABASE && disableMsg === '';
            }),
        [instanceTableRows, selectedHostType, t]
    );

    // For Oracle: Navigate to bulk registration wizard
    const handleManageBulk = () => {
        dispatch(setSelectedMultiDetectInstances([]));
        dispatch(setWizardOperationType('bulk'));
        dispatch(setRegisterHostType(selectedHostType));
        dispatch(resetAgenticPreCheckData());
        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    // For Oracle: Tooltip content when Register button is disabled
    const getPopoverContent = () => t('databases.register-flow.register-bulk-disable-tooltip-oracle');

    const updatedTableData = useMemo(
        () =>
            instanceTableRows?.map((row: any) => {
                const processedRow = instanceExtraDataUpdate(row, t, instanceProtection, isDemoMode);
                const isSelectable = isRowSelectableForBulkRegister(processedRow, selectedHostType, t);
                const tooltipMsg = !isSelectable ? getDisabledSelectionTooltip(processedRow, selectedHostType, t) : '';

                // Add cellProps for selection control
                return {
                    ...processedRow,
                    cellProps: {
                        ...processedRow.cellProps,
                        isDisabled: !isSelectable,
                        selectionProps: {
                            title: tooltipMsg
                        }
                    }
                };
            }),
        [instanceTableRows, instanceProtection, isDemoMode, selectedHostType]
    );

    const getTableColDefsPerEngineType = () => getInstanceTableColumns({ t, updatedTableData, selectedHostType });

    // Compute selectable rows for bulk register
    const selectableRowsForBulk = useMemo(
        () => updatedTableData?.filter((row: any) => !row.cellProps?.isDisabled) || [],
        [updatedTableData]
    );

    // Determine if header checkbox should be enabled
    const isHeaderCheckboxEnabled = useMemo(() => {
        if (selectedHostType !== DBType.MSSQL) return false;
        if (loading) return false;
        return selectableRowsForBulk.length > 0;
    }, [selectedHostType, loading, selectableRowsForBulk]);

    // Check if max selection limit reached
    const isMaxSelectionReached = useMemo(
        () => selectedRowsForBulkRegister.length >= MAX_BULK_REGISTER_SELECTION,
        [selectedRowsForBulkRegister]
    );

    // Compute header checkbox tooltip message
    const headerCheckboxTooltip = useMemo(() => {
        if (!isHeaderCheckboxEnabled) {
            return t('databases.bulk-register.select-header-disabled');
        }
        if (isMaxSelectionReached) {
            return t('databases.bulk-register.max-selection-reached', { max: MAX_BULK_REGISTER_SELECTION });
        }
        return '';
    }, [isHeaderCheckboxEnabled, isMaxSelectionReached]);

    const tableProps = useTable({
        isSorting: false,
        selectionType: selectedHostType === DBType.MSSQL ? 'multiple' : 'none',
        columns: getTableColDefsPerEngineType(),
        rows: updatedTableData,
        pageSize: 50,
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        defaultSelectedRows: [],
        selectAllProps: {
            isDisabled: !isHeaderCheckboxEnabled || isMaxSelectionReached,
            title: headerCheckboxTooltip
        },
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialInstanceTableColState(selectedHostType)).filter(
                ([_, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            width: '62px',
            renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
                const menu = [];
                let isBedRockAvailable = true;
                const currentRowState = rowsState[rowData.id];
                if (
                    regionMapping &&
                    rowData?.regionId &&
                    regionMapping.hasOwnProperty(rowData?.regionId) &&
                    regionMapping[rowData?.regionId]?.hasOwnProperty('bedrockAvailable') &&
                    !regionMapping[rowData?.regionId]?.bedrockAvailable
                ) {
                    isBedRockAvailable = false;
                }
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
                    disableMessage =
                        selectedHostType === DBType.ORACLE
                            ? t('databases.register-flow.oracle-server-instance-down')
                            : t('databases.register-flow.sql-server-instance-down');
                    disableOption = true;
                }

                if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                    menu.push(
                        ...getInstanceTableMenuOptions(
                            rowData,
                            t,
                            disableOption,
                            disableMessage,
                            disableCreateDb,
                            disableCreateDbMsg,
                            isBedRockAvailable
                        )
                    );
                }

                // Use shared utility for disabling logic
                const disableResult = isInstanceActionDisabled(rowData, selectedHostType, t);
                // For menu, also disable if status is unmanaged/undetected/in-progress
                const shouldDisableMenu =
                    rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED ||
                    rowData.statusColText === INVENTORY_STATUS.IN_PROGRESS ||
                    disableResult.isDisabled;
                const { disableMsg } = disableResult;
                const width = disableResult.tooltipWidth || '';
                const height = disableResult.tooltipHeight || '';

                return (
                    <div className={styles.lastContainer}>
                        <div className={styles.jobMenuPopover} style={{ marginLeft: '-12px' }}>
                            {shouldDisableMenu ? (
                                <TooltipComponent placement="bottom" title={disableMsg} width={width} height={height}>
                                    <div className={styles.menuPointerDisabled}>
                                        <span className={styles.menuPointer}>...</span>
                                    </div>
                                </TooltipComponent>
                            ) : (
                                <MenuPopover
                                    isMenuOpen={
                                        menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id
                                    }
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
                                            handleInstanceMenuSelection({
                                                menuId,
                                                rowData,
                                                dispatch,
                                                navigate,
                                                handleProtection,
                                                handleDialog,
                                                optimizeAction,
                                                handleEditProtection
                                            });
                                        }
                                    }}
                                    CustomMenu={undefined}
                                    disabledText={undefined}
                                />
                            )}
                        </div>
                    </div>
                );
            }
        }
    });

    // Handle banner filter views when instances table is already open
    useEffect(() => {
        inventoryBannerFilterUpdates(
            tableProps,
            notRegisteredSQLView,
            notActiveSQLInstancesView,
            notActiveOracleDatabasesView,
            notOptimizedSQLInstancesView,
            notRegisteredOracleDatabasesView,
            notOptimizedOracleDatabaseView,
            updatedTableData,
            selectedHostType,
            dispatch
        );
    }, [
        notRegisteredSQLView,
        notActiveSQLInstancesView,
        notActiveOracleDatabasesView,
        notOptimizedSQLInstancesView,
        notRegisteredOracleDatabasesView,
        notOptimizedOracleDatabaseView,
        tableProps.updateFilterState,
        tableProps.resetFilters,
        selectedHostType,
        updatedTableData
    ]);

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, instanceTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);

    // Sync table selection state to Redux for bulk register
    useEffect(() => {
        if (selectedHostType !== DBType.MSSQL) {
            // Clear selection when switching away from MSSQL
            if (selectedRowsForBulkRegister.length > 0) {
                dispatch(setSelectedRowsForBulkRegister([]));
            }
            return;
        }

        const selectedRowIds = Object.keys(tableProps.selectionState?.rows || {}).filter(
            key => tableProps.selectionState?.rows[key]
        );

        // Limit selection to MAX_BULK_REGISTER_SELECTION
        const limitedSelectedIds = selectedRowIds.slice(0, MAX_BULK_REGISTER_SELECTION);

        if (limitedSelectedIds.length > 0) {
            const selectedRows = updatedTableData?.filter((row: any) => limitedSelectedIds.includes(String(row.id)));
            dispatch(setSelectedRowsForBulkRegister(selectedRows || []));
        } else {
            dispatch(setSelectedRowsForBulkRegister([]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableProps.selectionState, updatedTableData, selectedHostType]);

    // Clear selection when host type changes
    useEffect(() => {
        if (selectedRowsForBulkRegister.length > 0) {
            dispatch(setSelectedRowsForBulkRegister([]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedHostType]);

    /**
     * Handler for bulk register action from the BulkActionContainer
     * Uses the selected rows from table checkboxes to navigate to bulk wizard
     */
    const handleBulkRegisterAction = () => {
        if (selectedRowsForBulkRegister.length === 0) return;

        // Set the selected instances for the bulk wizard
        dispatch(setSelectedMultiDetectInstances(selectedRowsForBulkRegister));
        dispatch(setWizardOperationType('bulk'));
        dispatch(setRegisterHostType(selectedHostType));
        dispatch(resetAgenticPreCheckData());

        // Clear the table selection after navigating
        dispatch(setSelectedRowsForBulkRegister([]));

        if (isWorkloadFactory) {
            navigate('../register-bulk-wizard');
        } else {
            navigate('../fsxdb/register-bulk-wizard');
        }
    };

    return (
        <div className={styles.inventoryTable} ref={inventoryTableRef}>
            {/* Show BulkActionContainer above the table when rows are selected */}
            {selectedHostType === DBType.MSSQL && selectedRowsForBulkRegister.length > 0 && (
                <BulkActionContainer
                    action={t('databases.bulk-register.register-selected-instances', {
                        count: selectedRowsForBulkRegister.length
                    })}
                    onClick={handleBulkRegisterAction}
                />
            )}
            <div
                //  @ts-ignore
                className={`${styles.table} ${styles.leftBorder}`}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={title}
                    singularTitle={title}
                    exportToCsvOptions={{ fileName: exportToCsvFileName }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        selectedHostType === DBType.ORACLE ? (
                            <div className={styles.manageInstanceButton}>
                                {!loading && !isUnregisteredRows ? (
                                    <Popover
                                        isAppendedToBody
                                        children={getPopoverContent()}
                                        trigger="hover"
                                        container={
                                            <DsButton isThin isDisabled>
                                                {buttonText}
                                            </DsButton>
                                        }
                                    />
                                ) : (
                                    <DsButton
                                        isThin
                                        onClick={() => handleManageBulk()}
                                        isDisabled={loading || !isUnregisteredRows}
                                    >
                                        {buttonText}
                                    </DsButton>
                                )}
                            </div>
                        ) : undefined
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
