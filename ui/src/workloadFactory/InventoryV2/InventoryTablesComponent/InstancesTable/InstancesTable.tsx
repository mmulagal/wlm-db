import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ACTION_CTA, DBType, DETECT_HOST_VAR, FROM_DIALOG, INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import store from '../../../../store/store';
import {
    setInProgressInstances,
    setInventoryTableData,
    setRegisterHostType,
    setSelectedFilterValue,
    setSelectedMultiDetectInstances,
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

import WindowsAuthDialog from '../ProtectionDialogs/WindowsAuthDialog';
import {
    getInstableTableTopMenuOptions,
    getInstanceTableMenuOptions,
    handleInstanceMenuSelection,
    inventoryBannerFilterUpdates
} from './InstanceTableHelper';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';
import DgReplicaTable from './ReplicaTable/DgReplicaTable';

const InstancesTable = () => {
    const { t } = useTranslation();

    const { instanceTableRows, tableManageColumnState } = useAppSelector(state => state.inventoryV2);
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

    // This might be used when we have scroll sync between parent and expanded child table
    // const [scrollPos, setScrollPos] = useState(0);

    // useEffect(() => {
    //     const root = inventoryTableRef.current;
    //     if (!root) return;

    //     let outerScrollEl = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
    //     let innerScrollEl = root.querySelector<HTMLElement>(
    //         "[class*='expanded-row-section'] [class*='horizontal-scroll']"
    //     );

    //     const onOuterScroll = () => {
    //         if (!innerScrollEl || !innerScrollEl.isConnected) {
    //             innerScrollEl = root.querySelector<HTMLElement>(
    //                 "[class*='expanded-row-section'] [class*='horizontal-scroll']"
    //             );
    //         }
    //         if (outerScrollEl && innerScrollEl) {
    //             innerScrollEl.scrollLeft = outerScrollEl.scrollLeft;
    //             setScrollPos(outerScrollEl.scrollLeft);
    //         }
    //     };

    //     const attachListeners = () => {
    //         requestAnimationFrame(() => {
    //             const latestOuter = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
    //             const latestInner = root.querySelector<HTMLElement>(
    //                 "[class*='expanded-row-section'] [class*='horizontal-scroll']"
    //             );

    //             if (outerScrollEl && latestOuter && outerScrollEl !== latestOuter) {
    //                 outerScrollEl.removeEventListener('scroll', onOuterScroll);
    //             }
    //             outerScrollEl = latestOuter || outerScrollEl;
    //             innerScrollEl = latestInner || innerScrollEl;

    //             if (outerScrollEl) {
    //                 outerScrollEl.addEventListener('scroll', onOuterScroll, { passive: true });

    //                 if (innerScrollEl) {
    //                     innerScrollEl.scrollLeft = outerScrollEl.scrollLeft;
    //                 }
    //             }
    //         });
    //     };

    //     attachListeners();

    //     const observer = new MutationObserver(() => {
    //         const maybeOuter = root.querySelector<HTMLElement>("[class*='horizontal-scroll']");
    //         const maybeInner = root.querySelector<HTMLElement>(
    //             "[class*='expanded-row-section'] [class*='horizontal-scroll']"
    //         );

    //         if (maybeOuter && maybeOuter !== outerScrollEl) {
    //             if (outerScrollEl) outerScrollEl.removeEventListener('scroll', onOuterScroll);
    //             outerScrollEl = maybeOuter;
    //             outerScrollEl.addEventListener('scroll', onOuterScroll, { passive: true });
    //         }

    //         if (maybeInner && maybeInner !== innerScrollEl) {
    //             innerScrollEl = maybeInner;
    //             onOuterScroll();
    //         }
    //     });
    //     observer.observe(root, { childList: true, subtree: true });

    //     return () => {
    //         if (outerScrollEl) outerScrollEl.removeEventListener('scroll', onOuterScroll);
    //         observer.disconnect();
    //     };
    // }, []);

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

    /**
     * Expands or collapses a table row to show/hide the DataGuard replica sub-table
     * First collapses all other expanded rows, then toggles the expansion state of the clicked row
     *
     * @param updateRowState - Function to update the row's state (expand/collapse)
     * @param rowData - The row data containing the unique row id
     * @param currentRowState - The current state of the row including isExpanded flag
     * @param rowState - The state object containing all rows' states
     */
    const expandTableRow = (
        updateRowState: (arg0: any) => { (arg0: { isExpanded: boolean }): void; new (): any },
        rowData: { id: any },
        currentRowState: { isExpanded: any },
        rowState: any
    ) => {
        collapseAllRows(updateRowState, rowState);
        updateRowState(rowData.id)({
            isExpanded: !currentRowState?.isExpanded
        });
    };

    const shouldShowDataGuardArrow = (rowData: any) => {
        if (rowData?.hasReplicas) {
            return true;
        }
        return false;
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

    const updatedTableData = useMemo(
        () =>
            instanceTableRows
                ?.filter((row: any) => {
                    // Exclude Oracle DataGuard standby instances from the table
                    if (selectedHostType === DBType.ORACLE && row?.isReplica) {
                        return false;
                    }
                    return true;
                })
                ?.map((row: any) => instanceExtraDataUpdate(row, t, instanceProtection, isDemoMode)),
        [instanceTableRows, instanceProtection, isDemoMode]
    );

    const isUnregisteredRows = useMemo(
        () =>
            instanceTableRows?.some((row: any) => {
                const { colText, disableMsg } = manageActionCol(t, selectedHostType, row);
                if (selectedHostType === DBType.ORACLE) {
                    return colText === ACTION_CTA.REGISTER_DATABASE && disableMsg === '';
                }
                return colText === ACTION_CTA.MANAGE_INSTANCES && disableMsg === '';
            }),
        [instanceTableRows]
    );

    const getTableColDefsPerEngineType = () => getInstanceTableColumns({ t, updatedTableData, selectedHostType });

    /**
     * Renders the expanded row content showing DataGuard replica sub-table
     *
     * This memoized component is used by the Table component to render expanded row content
     * for Oracle DataGuard primary instances. When a primary row is expanded, this component
     * renders a DgReplicaTable showing all standby replicas associated with that primary.
     *
     * Memoization ensures the component only re-renders when dependencies change:
     * - inventoryTableRef: For calculating table width to match parent
     * - handleProtection: Handler for initiating protection workflows
     * - handleDialog: Handler for showing deregister confirmation dialog
     * - optimizeAction: Handler for navigating to well-architected analysis
     * - handleEditProtection: Handler for editing existing protection policies
     *
     * @param rowData - The primary database instance row data containing replicasList
     * @returns DgReplicaTable component displaying replica instances
     */
    const ExpandedRow = useCallback(
        ({ rowData }: any) => (
            <DgReplicaTable
                width={inventoryTableRef.current ? inventoryTableRef.current.offsetWidth : 0}
                rowData={rowData}
                handleProtection={handleProtection}
                handleDialog={handleDialog}
                optimizeAction={optimizeAction}
                handleEditProtection={handleEditProtection}
            />
        ),
        [inventoryTableRef, handleProtection, handleDialog, optimizeAction, handleEditProtection]
    );
    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading'
    };

    const tableProps = useTable({
        isSorting: false,
        columns: getTableColDefsPerEngineType(),
        rows: updatedTableData,
        pageSize: 50,
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        initialFilterState: getInitialFilter(),
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialInstanceTableColState(selectedHostType)).filter(
                ([_, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            width: selectedHostType === DBType.ORACLE ? '90px' : '62px',
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

                let disableMsg = '';
                let width = '';
                let height = '';
                const disableMenu = () => {
                    if (
                        rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                        rowData.statusColText === INVENTORY_STATUS.UNDETECTED ||
                        rowData.statusColText === INVENTORY_STATUS.IN_PROGRESS
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
                        disableMsg =
                            selectedHostType === DBType.ORACLE
                                ? t('databases.register-flow.oracle-server-instance-down')
                                : t('databases.register-flow.sql-server-instance-down');
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
                        disableMsg =
                            selectedHostType === DBType.ORACLE
                                ? GENERAL.FSXN_MANAGE_SUPPORTED_ORACLE
                                : GENERAL.FSXN_MANAGE_SUPPORTED;
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
                    <div className={styles.lastContainer}>
                        <div
                            className={styles.jobMenuPopover}
                            style={{ marginLeft: selectedHostType === DBType.ORACLE ? '-24px' : '-12px' }}
                        >
                            {disableMenu() ? (
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

                        {shouldShowDataGuardArrow(rowData) && (
                            <div className={styles.arrow}>
                                <ArrowIcon
                                    className={currentRowState?.isExpanded ? styles['arrow-down'] : ''}
                                    onClick={(e: any) => {
                                        e.stopPropagation();
                                        expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                    }}
                                />
                            </div>
                        )}
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

    const getPopoverContent = (selectedHostType: string) => {
        switch (selectedHostType) {
            case DBType.ORACLE:
                return t('databases.register-flow.register-bulk-disable-tooltip-oracle');
            case DBType.MSSQL:
                return t('databases.register-flow.register-bulk-disable-tooltip');
            default:
                return t('databases.register-flow.register-bulk-disable-tooltip');
        }
    };

    return (
        <div className={styles.inventoryTable} ref={inventoryTableRef}>
            <div
                //  @ts-ignore
                className={`${styles.table} ${styles.leftBorder}`}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={title}
                    singularTitle={title}
                    tableRowsLength={instanceTableRows?.length}
                    exportToCsvOptions={{ fileName: exportToCsvFileName }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
                    actionsRight={
                        <div className={styles.manageInstanceButton}>
                            {!loading && !isUnregisteredRows ? (
                                <Popover
                                    isAppendedToBody
                                    children={getPopoverContent(selectedHostType)}
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
                    }
                />
                <Table
                    {...tableComponentProps}
                    // @ts-ignore
                    tableProps={tableProps}
                    isDoubleRow
                />
            </div>
        </div>
    );
};

export default InstancesTable;
