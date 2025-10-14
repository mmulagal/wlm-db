import { DsTypography, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DBType, DETECT_HOST_VAR, FROM_DIALOG, INVENTORY_STATUS } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedFilterValue, setTableManageColumnState } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { bxpRedirect, getProtectionHydrationFailureReason } from '../../../../utils/utilityFunctions';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import { handleProtectionUtil } from '../../AddHostUtils';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import NoAgentDialog from '../ProtectionDialogs/NoAgentDialog';
import store from '../../../../store/store';
import { setActionsDisabled } from '../../../../store/workloadFactory/dialogComponentSlice';
import SingleAgentDialog from '../ProtectionDialogs/SingleAgentDialog';
import {
    useAddHostJobScMutation,
    useAddHostScMutation,
    useAssignRBACPrivilegesMutation,
    useConfigureDirectoryMutation,
    useDeleteHostScMutation,
    useDiscoverExistingFsxNMutation,
    useGenerateCredentialIDMutation,
    useGetConnectorsMutation,
    useGetDiscoverHostResultMutation,
    useGetFsxDetailsMutation,
    useGetOrganizationIdsMutation,
    useGetRBACPrivilegesMutation,
    useGetSCCrendentialsMutation,
    useGetWorkSpaceIDMutation,
    useListAllDirectoriesMutation,
    useListExistingHostsMutation,
    useRegisterResourceCredentialsBulkMutation
} from '../../../../utils/apiService';
import FetchingDialog from '../ProtectionDialogs/FetchingDIalog';
import {
    cancelProtectionForRow,
    setAuthVerification,
    setDataForRow,
    upsertDatabaseProtectionBatch,
    upsertProtectionHosts,
    setWorkSpaceData,
    setSelectedAgent
} from '../../../../store/workloadFactory/snapcenterSlice';
import { addHostHandlerSc } from '../../InventoryUtilsV2';
import { getDatabaseTableColumns } from './DatabaseTableColumns';
import { mssqlPgsqlDatabaseColumnFilterMap } from './MssqlPgsqlDatabaseTableColumns';
import { oraclePDBColumnFilterMap } from './OraclePDBTableColumns';
import { getInitialDatabaseTableColState } from '../../../../utils/manageColumnUtils';
import WindowsAuthDialog from '../ProtectionDialogs/WindowsAuthDialog';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { updateOrgId } from '../../../../store/authSlice';

const DatabasesTable = () => {
    const { t } = useTranslation();
    const { selectedInventoryTab, selectedFilterValue, selectedHostType, databaseTableRows, tableManageColumnState } =
        useAppSelector(state => state.inventoryV2);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const { setDialog, closeDialog } = useDialog();
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqldatabaseHostsLoading, fullHostDataLoading: pgsqlfullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { multiDataLoading } = useAppSelector(state => state.headers);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const navigate = useNavigate();

    // Protection api's
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
    const [configureDirectory] = useConfigureDirectoryMutation();
    const [listAllDirectories] = useListAllDirectoriesMutation();
    const [getDiscoverHostResult] = useGetDiscoverHostResultMutation();
    const [getSCCrendentials] = useGetSCCrendentialsMutation();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [getOrganizationIds] = useGetOrganizationIdsMutation();

    // Function to check if protect option should be disabled
    const isProtectDisabled = (rowData: any): boolean =>
        rowData?.hostType !== GENERAL.MICROSOFT_SQL_SERVER_TYPE ||
        !rowData?.instanceRow?.fsxId ||
        !rowData?.hostRow?.nodeIpAddress ||
        rowData?.status !== 'ONLINE';

    useEffect(() => {
        setLoading(
            databaseHostsLoading ||
                fullHostDataLoading ||
                pgsqldatabaseHostsLoading ||
                pgsqlfullHostDataLoading ||
                multiDataLoading
        );
    }, [
        databaseHostsLoading,
        fullHostDataLoading,
        pgsqldatabaseHostsLoading,
        pgsqlfullHostDataLoading,
        multiDataLoading
    ]);

    const getColumnFilterMap = () => {
        switch (selectedHostType) {
            case DBType.MSSQL:
            case DBType.POSTGRESQL:
                return mssqlPgsqlDatabaseColumnFilterMap;
            case DBType.ORACLE:
                return oraclePDBColumnFilterMap;
            default:
                return mssqlPgsqlDatabaseColumnFilterMap;
        }
    };

    const getInitialFilter = () => {
        const filterMap = getColumnFilterMap();
        if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'single'
        ) {
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
        if (
            selectedInventoryTab === 'Databases' &&
            selectedFilterValue?.flag === true &&
            selectedFilterValue?.filterType === 'multi'
        ) {
            dispatch(
                setSelectedFilterValue({
                    flag: false,
                    value: ''
                })
            );
            return {
                textFilter: '',
                count: 4,
                columns: {
                    [filterMap.hostName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.hostName]: true
                        },
                        valuesArray: [true]
                    },
                    [filterMap.instanceName]: {
                        activeCount: 1,
                        values: {
                            [selectedFilterValue?.value?.instanceName]: true
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

    // handle protection logic

    const fetchDialog = (key: string) => {
        setDialog(
            <DialogComponent
                header={t('databases.inventory.protect-header-database')}
                content={<FetchingDialog />}
                secondaryButton={GENERAL.CANCEL}
                closeCallback={() => {
                    dispatch(cancelProtectionForRow(key));
                    closeDialog();
                }}
                hidePrimaryButton
                callback={() => {}}
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
                                        showNoAgentDialog(true);
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
            isDemoMode,
            getSCCrendentials,
            scAuthDialog,
            getOrganizationIds
        });
    };

    // Direct redirect handlers for cleaner usage in menu selection
    const handleEditProtectionDb = (rowData: any) => {
        bxpRedirect(
            isWorkloadFactory,
            { ...rowData, editProtection: true },
            'database',
            undefined,
            getDiscoverHostResult
        );
    };

    const handleViewProtectionDetailsDb = (rowData: any) => {
        bxpRedirect(
            isWorkloadFactory,
            { ...rowData, viewProtectionDetails: true },
            'database',
            undefined,
            getDiscoverHostResult
        );
    };

    const showNoAgentDialog = (extraStep?: boolean, rowData?: any) => {
        setDialog(
            <DialogComponent
                header={
                    <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.protect-header-database')}
                        </DsTypography>

                        {extraStep && (
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-2-out-of')}
                            </DsTypography>
                        )}
                    </div>
                }
                content={<NoAgentDialog dialogType="database" />}
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
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.protect-header-database')}
                        </DsTypography>
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
                        dialogType="database"
                        extraStep={extraStep}
                        rowData={rowData}
                    />
                }
                primaryButton={hostExists ? t('databases.inventory.redirect') : t('databases.inventory.continue')}
                secondaryButton={t('databases.inventory.cancel')}
                closeCallback={() => {
                    closeDialog();
                }}
                callback={() => {
                    if (hostExists) {
                        bxpRedirect(isWorkloadFactory, rowData, 'database', undefined, getDiscoverHostResult);
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

    const getTableColDefsPerEngineType = () => getDatabaseTableColumns({ t, databaseTableRows, selectedHostType });

    // Prefetch SnapCenter databases per host
    const prefetchRun = useRef(false);
    const orgId = useAppSelector(state => state.auth?.orgId);
    const { databaseProtection } = useAppSelector(state => state.snapCenter);
    useEffect(() => {
        if (prefetchRun.current) return;
        prefetchRun.current = true;
        (async () => {
            try {
                let organizationId: string = orgId || '';
                if (isWorkloadFactory && !organizationId) {
                    const orgRes: any = await getOrganizationIds({});
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

                const hostsRes: any = await listExistingHosts({ accountID: organizationId });
                const hosts: any[] = hostsRes?.data?.hosts || [];
                if (hosts.length) {
                    dispatch(upsertProtectionHosts(hosts));
                }
                const hostNames = hosts.map(h => h?.name).filter(Boolean);

                // Ensure workspace and agent are persisted
                const [workSpaceRes, connectorsRes] = await Promise.all([
                    getWorkSpaceID({ accountID: organizationId }),
                    getConnector({ accountID: organizationId })
                ]);
                const workspaceItem = workSpaceRes?.data?.items?.[0];
                const workspaceID = workspaceItem?.id;
                if (workspaceItem) dispatch(setWorkSpaceData(workspaceItem));
                const occms: any[] = connectorsRes?.data?.occms || [];
                const activeAws = occms.find((o: any) => o?.agent?.status === 'active' && o?.agent?.provider === 'aws');
                const agentID = activeAws?.agent?.id || activeAws?.id;
                if (agentID) dispatch(setSelectedAgent([{ id: agentID }]));

                if (!workspaceID || !agentID || !hosts.length) {
                    const reason = getProtectionHydrationFailureReason(hosts.length, agentID, workspaceID);
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: `Unable to retrieve protection status: ${reason}. Please try again later.`
                        })
                    );
                    return;
                }

                await Promise.allSettled(
                    hostNames.map(hostName =>
                        getDiscoverHostResult({ accountID: organizationId, hostName, agentID, workspaceID })
                            .then((res: any) => {
                                const databases: any[] = res?.data?.databases || [];
                                if (!databases.length) return;
                                dispatch(
                                    upsertDatabaseProtectionBatch({
                                        items: databases.map(db => ({
                                            host: db?.host,
                                            instance: db?.instance,
                                            name: db?.name,
                                            status: db?.status
                                        }))
                                    })
                                );
                            })
                            .catch(() => undefined)
                    )
                );
            } catch {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'Unable to retrieve protection status: Please try again later.'
                    })
                );
            }
        })();
    }, [
        orgId,
        listExistingHosts,
        getDiscoverHostResult,
        getWorkSpaceID,
        getConnector,
        dispatch,
        isWorkloadFactory,
        getOrganizationIds
    ]);

    const tableProps = useTable({
        isSorting: false,
        columns: getTableColDefsPerEngineType(),
        rows: databaseTableRows,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        // @ts-ignore
        initialFilterState: getInitialFilter(),
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialDatabaseTableColState(selectedHostType) ?? {}).filter(
                ([, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.hostType === DBType.ORACLE) {
                    return null;
                }
                let disableOption = false;
                let disableMessage = '';

                if (rowData?.hostType === GENERAL.POSTGRESQL_TYPE) {
                    disableOption = true;
                    disableMessage = GENERAL.COMING_SOON;
                } else if (rowData?.type === GENERAL.SYSTEM_DATABASE) {
                    disableOption = true;
                    disableMessage = 'Create sandbox option is not available for system database.';
                }
                // Determine protection via cache first, fall back to status text
                const hostFqdn = (rowData?.hostRow?.fqdn || rowData?.hostName || '').toLowerCase();
                const hostShort = hostFqdn.split('.')[0];
                const instanceShort = (rowData?.databaseInstanceName || '').toLowerCase();
                const dbName = (rowData?.name || '').toLowerCase();
                const possibleKeys = [
                    `${hostFqdn}::${instanceShort}::${dbName}`,
                    `${hostShort}::${instanceShort}::${dbName}`,
                    `${hostFqdn}::mssqlserver::${dbName}`,
                    `${hostShort}::mssqlserver::${dbName}`
                ];
                const isProtectedCache = possibleKeys.some(k => databaseProtection?.[k]?.protected === true);
                const statusVal = (rowData?.protectionStatus || rowData?.status || '').toLowerCase();
                const isProtected = isProtectedCache || statusVal === 'protected' || statusVal === 'instance protected';
                const menu = [
                    {
                        id: 'createSandbox',
                        displayName: t('databases.instance-table.menu-options.create-sandbox'),
                        disabled: disableOption,
                        infoText: disableMessage
                    },
                    {
                        id: isProtected ? 'editProtection' : 'protect',
                        displayName: isProtected
                            ? t('databases.instance-table.menu-options.edit-protection')
                            : t('databases.instance-table.menu-options.protect'),
                        disabled: isProtectDisabled(rowData)
                    },
                    ...(isProtected
                        ? [
                              {
                                  id: 'viewProtectionDetails',
                                  displayName: t('databases.instance-table.menu-options.view-protection-details'),
                                  disabled: false
                              }
                          ]
                        : [])
                ];
                return (
                    <div className={styles.jobMenuPopover}>
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

                                    if (menuId === 'createSandbox') {
                                        dispatch(
                                            setSelectedSandboxHeaderValue({
                                                credId: rowData?.credentialId,
                                                regionId: rowData?.regionId
                                            })
                                        );
                                        dispatch(
                                            setSelectedCsData({
                                                host: rowData?.hostName,
                                                instance: rowData?.databaseInstanceName,
                                                database: rowData?.name
                                            })
                                        );
                                        navigate('../create-new-sandbox');
                                    }

                                    // Protect POC code
                                    if (menuId === 'protect') {
                                        handleProtection(rowData);
                                    } else if (menuId === 'editProtection') {
                                        handleEditProtectionDb(rowData);
                                    } else if (menuId === 'viewProtectionDetails') {
                                        handleViewProtectionDetailsDb(rowData);
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                );
            }
        }
    });

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, databaseTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);
    return (
        <div className={styles.inventoryTable}>
            <div
                //  @ts-ignore
                className={styles.table}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle="Databases"
                    singularTitle="Database"
                    exportToCsvOptions={{ fileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle="This table might show the same resource multiple times if it's linked to different credentials. Filter by AWS credentials to remove duplicates."
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

export default DatabasesTable;
