import { useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DBType } from '../../../../utils/consts';
import styles from '../InventoryTable.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedFilterValue, setTableManageColumnState } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useTable } from '../../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../../common/Lib/Table/TableTopBar';
import { Table } from '../../../../common/Lib/Table/Table';
import { bxpRedirect, collapseAllRows, createSandboxNavigation } from '../../../../utils/utilityFunctions';
import MenuPopover from '../../../../common/MenuPopover/MenuPopover';
import { setSelectedCsData, setSelectedSandboxHeaderValue } from '../../../../store/workloadFactory/createSandboxSlice';
import store from '../../../../store/store';
import {
    useGetConnectorsMutation,
    useGetDiscoverHostResultMutation,
    useGetOrganizationIdsMutation,
    useGetWorkSpaceIDMutation,
    useListExistingHostsMutation
} from '../../../../utils/apiService';
import {
    upsertDatabaseProtectionBatch,
    upsertProtectionHosts,
    setWorkSpaceData,
    setSelectedAgent
} from '../../../../store/workloadFactory/snapcenterSlice';
import { determineProtectionStatusMssql, mssqlDatabaseMenuOptions } from '../../InventoryUtilsV2';
import { useSnapCenterProtectionFlow } from '../../useSnapCenterProtectionFlow';
import { getLunFilterOptions, getUniqueLunNames } from '../../../WellArchitectedTab/WellArchitectedTabUtils';
import { getDatabaseTableColumns } from './DatabaseTableColumns';
import { mssqlPgsqlDatabaseColumnFilterMap } from './MssqlPgsqlDatabaseTableColumns';
import { oraclePDBColumnFilterMap } from './OraclePDBTableColumns';
import { getInitialDatabaseTableColState } from '../../../../utils/manageColumnUtils';
import { updateOrgId } from '../../../../store/authSlice';
import AoagReplicaTable from './ReplicaTable/AoagReplicaTable';
import { ReactComponent as ArrowIcon } from '../../../../assets/row_arrow.svg';

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
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const databaseTableRef = useRef<HTMLDivElement>(null);

    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);
    const navigate = useNavigate();

    const [getConnector] = useGetConnectorsMutation();
    const [getWorkSpaceID] = useGetWorkSpaceIDMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [getDiscoverHostResult] = useGetDiscoverHostResultMutation();
    const [getOrganizationIds] = useGetOrganizationIdsMutation();

    const { startProtection: handleProtection, startEditProtection: handleEditProtectionDb } =
        useSnapCenterProtectionFlow(setDialog, closeDialog, { dialogType: 'database' });

    const handleViewProtectionDetailsDb = useCallback(
        (rowData: any) => {
            if (isGovAccount) return;
            bxpRedirect(
                isWorkloadFactory,
                { ...rowData, viewProtectionDetails: true },
                'database',
                undefined,
                getDiscoverHostResult
            );
        },
        [getDiscoverHostResult, isGovAccount, isWorkloadFactory]
    );

    const updatedTableData = useMemo(
        () =>
            databaseTableRows
                ?.filter((row: any) => {
                    // Exclude AOAG standby instances from the table
                    if (selectedHostType === DBType.MSSQL && row?.isReplica) {
                        return false;
                    }
                    return true;
                })
                .map((row: any) => ({ ...row, lunPaths: getUniqueLunNames(row?.luns) })),
        [databaseTableRows, selectedHostType]
    );

    const lunFilterOptions = useMemo(() => getLunFilterOptions(updatedTableData), [updatedTableData]);

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

    const getTableColDefsPerEngineType = () =>
        getDatabaseTableColumns({ t, databaseTableRows, selectedHostType, setDialog, lunFilterOptions });

    // Prefetch SnapCenter databases per host
    const prefetchRun = useRef(false);
    const orgId = useAppSelector(state => state.auth?.orgId);
    const { databaseProtection } = useAppSelector(state => state.snapCenter);
    useEffect(() => {
        if (prefetchRun.current || isDemoMode || isGovAccount) return;
        prefetchRun.current = true;
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
                const hostNames = hosts.map(h => h?.name).filter(Boolean);

                // Ensure workspace and agent are persisted
                const [workSpaceRes, connectorsRes] = await Promise.all([
                    getWorkSpaceID({ accountID: organizationId, selfErrorHandling: true }),
                    getConnector({ accountID: organizationId, selfErrorHandling: true })
                ]);
                const workspaceItem = workSpaceRes?.data?.items?.[0];
                const workspaceID = workspaceItem?.id;
                if (workspaceItem) dispatch(setWorkSpaceData(workspaceItem));
                const occms: any[] = connectorsRes?.data?.occms || [];
                const activeAws = occms.find((o: any) => o?.agent?.status === 'active' && o?.agent?.provider === 'aws');
                const agentID = activeAws?.agent?.agentId;
                if (agentID) dispatch(setSelectedAgent([{ id: agentID }]));

                if (!workspaceID || !agentID || !hosts.length) return;

                await Promise.allSettled(
                    hostNames.map(hostName =>
                        getDiscoverHostResult({
                            accountID: organizationId,
                            hostName,
                            agentID,
                            workspaceID,
                            selfErrorHandling: true
                        })
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
                // No need to handle error
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
        getOrganizationIds,
        isDemoMode,
        isGovAccount
    ]);

    /**
     * Expands or collapses a table row to show/hide AOAG replica details
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

    const shouldShowAoagArrow = (rowData: any) => {
        if (rowData?.hasReplicas && rowData?.isPrimary) {
            return true;
        }
        return false;
    };

    const ExpandedRow = useCallback(
        ({ rowData }: any) => (
            <AoagReplicaTable
                width={databaseTableRef.current ? databaseTableRef.current.offsetWidth : 0}
                rowData={rowData}
                handleProtection={handleProtection}
                handleEditProtectionDb={handleEditProtectionDb}
                handleViewProtectionDetailsDb={handleViewProtectionDetailsDb}
            />
        ),
        [handleEditProtectionDb, handleProtection, handleViewProtectionDetailsDb]
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
        selectionType: 'none',
        isHorizontalScroll: true,
        isManagedColumns: true,
        isLazyLoading: loading,
        additionalSearchKeys: ['lunPaths'],
        // @ts-ignore
        initialFilterState: getInitialFilter(),
        initialColumnState: Object.fromEntries(
            Object.entries(getInitialDatabaseTableColState(selectedHostType) ?? {}).filter(
                ([, value]) => value !== undefined
            )
        ),
        manageColumnsProps: {
            width: selectedHostType === DBType.MSSQL ? '90px' : '62px',
            renderCell: (cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
                const currentRowState = rowsState[rowData.id];
                if (rowData?.hostType === DBType.ORACLE) {
                    return null;
                }

                const isProtected = determineProtectionStatusMssql(isDemoMode, rowData, databaseProtection);
                const menu = mssqlDatabaseMenuOptions(t, isProtected, rowData, isGovAccount);
                return (
                    <div className={styles.lastContainer}>
                        <div
                            className={styles.jobMenuPopover}
                            style={{ marginLeft: selectedHostType === DBType.MSSQL ? '-24px' : '-12px' }}
                        >
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
                                            createSandboxNavigation(navigate);
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
                        {shouldShowAoagArrow(rowData) && (
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

    useEffect(() => {
        dispatch(setTableManageColumnState({ ...tableManageColumnState, databaseTable: tableProps.columnsState }));
    }, [tableProps.columnsState]);
    return (
        <div className={styles.inventoryTable} ref={databaseTableRef}>
            <div
                //  @ts-ignore
                className={styles.table}
            >
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    tableRowsLength={databaseTableRows?.length}
                    pluralTitle={
                        selectedHostType === DBType.ORACLE
                            ? t('databases.well-architect.pdbs')
                            : t('databases.well-architect.databases')
                    }
                    singularTitle={
                        selectedHostType === DBType.ORACLE
                            ? t('databases.well-architect.pdb')
                            : t('databases.well-architect.database')
                    }
                    exportToCsvOptions={{ fileName: `DatabaseTable-${new Date(Date.now()).toLocaleString()}.csv` }}
                    subTitle={t('databases.inventory.database-table-upper-text')}
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

export default DatabasesTable;
