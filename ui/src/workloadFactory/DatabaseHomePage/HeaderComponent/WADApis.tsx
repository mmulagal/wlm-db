import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery,
    useLazyGetAllOfflineOracleHostsAssessmentDataQuery,
    useLazyGetOfflineMssqlAssessmentDatabasesQuery
} from '../../../utils/apiService';
import {
    addOfflineMssqlHostAssessmentData,
    addOfflineOracleHostAssessmentData,
    addAllMssqlHostAssessmentData,
    addAllOracleHostAssessmentData,
    addUnregisteredMssqlAssessmentData,
    addUnregisteredOracleAssessmentData,
    setInventoryTableData,
    setOfflineMssqlHostAssessmentLoading,
    setOfflineOracleHostAssessmentLoading,
    setUnregisteredAssessmentLoading,
    addOfflineMssqlDatabasesData,
    setOfflineMssqlDatabasesLoading
} from '../../../store/workloadFactory/inventoryV2Slice';
import {
    formatOfflineAssessmentToInventoryData,
    formatOracleOfflineAssessmentToInventoryData,
    mergeUnregisteredAssessmentIntoInventory
} from '../../InventoryV2/InventoryUtilsV2';
import { formatOfflineDataToAssessmentFormat } from '../DatabaseHomeUtils';
import store from '../../../store/store';
import { DBType } from '../../../utils/consts';
import { isOfflineAssessmentItem, isUnregisteredAssessmentItem } from '../../WellArchitectedTab/assessmentFormatUtils';

const WADApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const offlineMssqlHostAssessmentData = useAppSelector(state => state.inventoryV2.offlineMssqlHostAssessmentData);
    const offlineOracleHostAssessmentData = useAppSelector(state => state.inventoryV2.offlineOracleHostAssessmentData);
    const unregisteredMssqlAssessmentData = useAppSelector(state => state.inventoryV2.unregisteredMssqlAssessmentData);
    const unregisteredOracleAssessmentData = useAppSelector(
        state => state.inventoryV2.unregisteredOracleAssessmentData
    );
    const offlineMssqlDatabasesData = useAppSelector(state => state.inventoryV2.offlineMssqlDatabasesData);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);

    // Refs to track current selections and prevent infinite loops
    const headerSelectedMultiCredIdsListRef = useRef(headerSelectedMultiCredIdsList);
    const headerSelectedMultiRegionIdsListRef = useRef(headerSelectedMultiRegionIdsList);
    const isUpdatingRef = useRef(false);
    // ponytail: ref-count parallel MSSQL/Oracle host fetches; shared unregistered loading clears only when both finish
    const hostAssessmentFetchInFlightRef = useRef(0);

    // API hooks for lazy queries
    const [getAllOfflineAssessmentAPI] = useLazyGetAllOfflineMssqlHostsAssessmentDataQuery();
    const [getAllOfflineOracleAssessmentAPI] = useLazyGetAllOfflineOracleHostsAssessmentDataQuery();
    const [getOfflineMssqlDatabasesAPI] = useLazyGetOfflineMssqlAssessmentDatabasesQuery();

    // Update refs when selections change
    useEffect(() => {
        headerSelectedMultiCredIdsListRef.current = headerSelectedMultiCredIdsList;
    }, [headerSelectedMultiCredIdsList]);

    useEffect(() => {
        headerSelectedMultiRegionIdsListRef.current = headerSelectedMultiRegionIdsList;
    }, [headerSelectedMultiRegionIdsList]);

    // Call offline assessment APIs on mount
    useEffect(() => {
        // Always call these APIs regardless of cred/region availability
        getAllOfflineAssessmentData([], [], null);
        getAllOfflineOracleAssessmentData([], [], null);
        getAllOfflineMssqlDatabasesData([], null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-call offline assessment APIs on refresh
    useEffect(() => {
        if (isRefreshed) {
            getAllOfflineAssessmentData([], [], null);
            getAllOfflineOracleAssessmentData([], [], null);
            getAllOfflineMssqlDatabasesData([], null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRefreshed]);

    // When cred/region changes, reformat the MSSQL offline data.
    // Also re-merge when the offline databases data changes so WAD database rows stay in sync.
    useEffect(() => {
        if (offlineMssqlHostAssessmentData && offlineMssqlHostAssessmentData.length > 0) {
            updateInventoryWithOfflineData(offlineMssqlHostAssessmentData, DBType.MSSQL);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList,
        offlineMssqlHostAssessmentData,
        offlineMssqlDatabasesData
    ]);

    // When cred/region changes, reformat the Oracle offline data
    useEffect(() => {
        if (offlineOracleHostAssessmentData && offlineOracleHostAssessmentData.length > 0) {
            updateInventoryWithOfflineData(offlineOracleHostAssessmentData, DBType.ORACLE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, offlineOracleHostAssessmentData]);

    // Re-merge WAD / unregistered data when inventoryTableData changes (e.g., when InventoryApisV3 updates it)
    useEffect(() => {
        // Skip offline WAD re-add when this component just dispatched; still merge unregistered onto discover rows.
        if (isUpdatingRef.current) {
            isUpdatingRef.current = false;
            mergeAllUnregisteredIntoInventory();
            return;
        }

        if (inventoryTableData) {
            const inventoryEntries = Object.values(inventoryTableData);
            const hasMssqlWadEntries = inventoryEntries.some(
                (entry: any) => entry?.isWad && entry?.hostType === DBType.MSSQL
            );
            const hasOracleWadEntries = inventoryEntries.some(
                (entry: any) => entry?.isWad && entry?.hostType === DBType.ORACLE
            );

            if (!hasMssqlWadEntries && offlineMssqlHostAssessmentData && offlineMssqlHostAssessmentData.length > 0) {
                updateInventoryWithOfflineData(offlineMssqlHostAssessmentData, DBType.MSSQL);
            }
            if (!hasOracleWadEntries && offlineOracleHostAssessmentData && offlineOracleHostAssessmentData.length > 0) {
                updateInventoryWithOfflineData(offlineOracleHostAssessmentData, DBType.ORACLE);
            }

            // Discover inventory loaded — merge unregistered assessments onto matching rows
            mergeAllUnregisteredIntoInventory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryTableData]);

    // Re-merge when unregistered assessment data arrives after discover inventory is already loaded
    useEffect(() => {
        if (unregisteredMssqlAssessmentData?.length || unregisteredOracleAssessmentData?.length) {
            mergeAllUnregisteredIntoInventory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unregisteredMssqlAssessmentData, unregisteredOracleAssessmentData]);

    /**
     * Clears loading flags after an offline/unregistered assessment fetch completes.
     * Engine-specific loading clears per fetch; shared unregistered loading clears only when none remain in flight.
     */
    const beginHostAssessmentFetch = (dbType: typeof DBType.MSSQL | typeof DBType.ORACLE) => {
        hostAssessmentFetchInFlightRef.current += 1;
        if (dbType === DBType.MSSQL) {
            dispatch(setOfflineMssqlHostAssessmentLoading(true));
        } else {
            dispatch(setOfflineOracleHostAssessmentLoading(true));
        }
        if (hostAssessmentFetchInFlightRef.current === 1) {
            dispatch(setUnregisteredAssessmentLoading(true));
        }
    };

    const clearHostAssessmentFetchLoading = (dbType: typeof DBType.MSSQL | typeof DBType.ORACLE) => {
        if (dbType === DBType.MSSQL) {
            dispatch(setOfflineMssqlHostAssessmentLoading(false));
        } else {
            dispatch(setOfflineOracleHostAssessmentLoading(false));
        }
        hostAssessmentFetchInFlightRef.current = Math.max(0, hostAssessmentFetchInFlightRef.current - 1);
        if (hostAssessmentFetchInFlightRef.current === 0) {
            dispatch(setUnregisteredAssessmentLoading(false));
        }
    };

    /**
     * Stores raw offline and unregistered assessment arrays in their respective slice buckets.
     */
    const storeFetchedAssessmentData = (
        offlineData: any[],
        unregisteredData: any[],
        dbType: typeof DBType.MSSQL | typeof DBType.ORACLE
    ) => {
        if (dbType === DBType.MSSQL) {
            dispatch(addOfflineMssqlHostAssessmentData(offlineData));
            dispatch(addUnregisteredMssqlAssessmentData(unregisteredData));
        } else {
            dispatch(addOfflineOracleHostAssessmentData(offlineData));
            dispatch(addUnregisteredOracleAssessmentData(unregisteredData));
        }
    };

    /**
     * Persists fetched assessment data and optionally syncs inventory + all-assessment stores.
     * Replaces the repeated dispatch/update block at the end of paginated fetches.
     */
    const commitFetchedAssessmentData = (
        offlineData: any[],
        unregisteredData: any[],
        dbType: typeof DBType.MSSQL | typeof DBType.ORACLE,
        { syncInventory = true }: { syncInventory?: boolean } = {}
    ) => {
        clearHostAssessmentFetchLoading(dbType);
        storeFetchedAssessmentData(offlineData, unregisteredData, dbType);
        addOfflineDataToAllAssessment(offlineData, unregisteredData, dbType);
        if (syncInventory) {
            updateInventoryWithAssessmentData(offlineData, unregisteredData, dbType);
        }
    };

    /**
     * Adds offline assessment data to the "all" assessment data store.
     * Transforms flat offline data to hierarchical assessment format with host → instancesAssessment structure.
     * @param offlineData - The offline assessment data to add (flat instance-level structure, source='offline')
     * @param unregisteredData - The unregistered assessment data to add (flat instance-level structure, source='unregistered')
     * @param dbType - The database type (DBType.MSSQL or DBType.ORACLE)
     */
    const addOfflineDataToAllAssessment = (
        offlineData: any[],
        unregisteredData: any[],
        dbType: typeof DBType.MSSQL | typeof DBType.ORACLE
    ) => {
        const state = store.getState();
        // Transform flat offline data to hierarchical assessment format
        const formattedOfflineData = formatOfflineDataToAssessmentFormat(offlineData, dbType);

        if (dbType === DBType.MSSQL) {
            const existingAllData = state.inventoryV2.allmssqlHostAssessmentData || [];
            // unregistered on-demand data is inventory-only this sprint
            const registeredAndOfflineData = existingAllData.filter(
                (item: any) => !item?.isWad && !item?.isUnregistered
            );
            dispatch(addAllMssqlHostAssessmentData([...registeredAndOfflineData, ...formattedOfflineData]));
        } else {
            const existingAllData = state.inventoryV2.allOracleHostAssessmentData || [];
            const registeredAndOfflineData = existingAllData.filter(
                (item: any) => !item?.isWad && !item?.isUnregistered
            );
            dispatch(addAllOracleHostAssessmentData([...registeredAndOfflineData, ...formattedOfflineData]));
        }
    };

    /**
     * Fetches all offline MSSQL host assessment data.
     * This API is called irrespective of credential/region selection.
     * Separates offline (one-time WAD upload) from unregistered (on-demand) assessments by metadata.source.
     */
    const getAllOfflineAssessmentData = async (
        assessmentData: any[],
        unregisteredData: any[],
        nextToken: string | null
    ) => {
        try {
            if (nextToken === null) {
                beginHostAssessmentFetch(DBType.MSSQL);
            }

            const result: any = await getAllOfflineAssessmentAPI({
                credentialId: null,
                regionId: null,
                nextToken
            });

            if (result && !result?.error && result?.data) {
                const allItems = Array.isArray(result?.data?.items) ? result.data.items : [];

                // Separate offline (one-time WAD) from unregistered (on-demand) by assessments.metadata.source
                const offlineItems = allItems
                    .filter((item: any) => isOfflineAssessmentItem(item))
                    .map((item: any) => ({ ...item, isWad: true }));

                const unregisteredItems = allItems
                    .filter((item: any) => isUnregisteredAssessmentItem(item))
                    .map((item: any) => ({ ...item, isUnregistered: true }));

                const newOfflineData = [...assessmentData, ...offlineItems];
                const newUnregisteredData = [...unregisteredData, ...unregisteredItems];

                if (result?.data?.nextToken) {
                    // Continue fetching with pagination
                    await getAllOfflineAssessmentData(newOfflineData, newUnregisteredData, result?.data?.nextToken);
                } else {
                    commitFetchedAssessmentData(newOfflineData, newUnregisteredData, DBType.MSSQL);
                }
            } else if (assessmentData.length > 0 || unregisteredData.length > 0) {
                commitFetchedAssessmentData(assessmentData, unregisteredData, DBType.MSSQL);
            } else {
                clearHostAssessmentFetchLoading(DBType.MSSQL);
            }
        } catch (error) {
            if (assessmentData.length > 0 || unregisteredData.length > 0) {
                commitFetchedAssessmentData(assessmentData, unregisteredData, DBType.MSSQL, { syncInventory: false });
            } else {
                clearHostAssessmentFetchLoading(DBType.MSSQL);
            }
        }
    };

    /**
     * Fetches all offline Oracle host assessment data.
     * This API is called irrespective of credential/region selection.
     * Separates offline (one-time WAD upload) from unregistered (on-demand) assessments by metadata.source.
     */
    const getAllOfflineOracleAssessmentData = async (
        assessmentData: any[],
        unregisteredData: any[],
        nextToken: string | null
    ) => {
        try {
            if (nextToken === null) {
                beginHostAssessmentFetch(DBType.ORACLE);
            }

            const result: any = await getAllOfflineOracleAssessmentAPI({
                credentialId: null,
                regionId: null,
                nextToken
            });

            if (result && !result?.error && result?.data) {
                const allItems = Array.isArray(result?.data?.items) ? result.data.items : [];

                // Separate offline (one-time WAD) from unregistered (on-demand) by assessments.metadata.source
                const offlineItems = allItems
                    .filter((item: any) => isOfflineAssessmentItem(item))
                    .map((item: any) => ({ ...item, isWad: true }));

                const unregisteredItems = allItems
                    .filter((item: any) => isUnregisteredAssessmentItem(item))
                    .map((item: any) => ({ ...item, isUnregistered: true }));

                const newOfflineData = [...assessmentData, ...offlineItems];
                const newUnregisteredData = [...unregisteredData, ...unregisteredItems];

                if (result?.data?.nextToken) {
                    // Continue fetching with pagination
                    await getAllOfflineOracleAssessmentData(
                        newOfflineData,
                        newUnregisteredData,
                        result?.data?.nextToken
                    );
                } else {
                    commitFetchedAssessmentData(newOfflineData, newUnregisteredData, DBType.ORACLE);
                }
            } else if (assessmentData.length > 0 || unregisteredData.length > 0) {
                commitFetchedAssessmentData(assessmentData, unregisteredData, DBType.ORACLE);
            } else {
                clearHostAssessmentFetchLoading(DBType.ORACLE);
            }
        } catch (error) {
            if (assessmentData.length > 0 || unregisteredData.length > 0) {
                commitFetchedAssessmentData(assessmentData, unregisteredData, DBType.ORACLE, { syncInventory: false });
            } else {
                clearHostAssessmentFetchLoading(DBType.ORACLE);
            }
        }
    };

    /**
     * Fetches all offline MSSQL databases for one-time WAD hosts/instances.
     * This API is called irrespective of credential/region selection.
     * Pagination is handled via nextToken just like the host/instance offline APIs.
     */
    const getAllOfflineMssqlDatabasesData = async (databasesData: any[], nextToken: string | null) => {
        try {
            dispatch(setOfflineMssqlDatabasesLoading(true));

            const result: any = await getOfflineMssqlDatabasesAPI({
                pageSize: 50,
                nextToken
            });

            if (result && !result?.error && result?.data) {
                const newDatabasesData = [
                    ...databasesData,
                    ...(Array.isArray(result?.data?.items) ? result.data.items : [])
                ];

                if (result?.data?.nextToken) {
                    getAllOfflineMssqlDatabasesData(newDatabasesData, result?.data?.nextToken);
                } else {
                    dispatch(setOfflineMssqlDatabasesLoading(false));
                    dispatch(addOfflineMssqlDatabasesData(newDatabasesData));
                }
            } else {
                dispatch(setOfflineMssqlDatabasesLoading(false));
                if (databasesData.length > 0) {
                    dispatch(addOfflineMssqlDatabasesData(databasesData));
                }
            }
        } catch (error) {
            dispatch(setOfflineMssqlDatabasesLoading(false));
            if (databasesData.length > 0) {
                dispatch(addOfflineMssqlDatabasesData(databasesData));
            }
        }
    };

    /**
     * Merges offline databases data (from getOfflineMssqlAssessmentDatabases) into
     * the formatted WAD host entries. Matches entries by resourceId + databaseInstanceId
     * and attaches the `databases` array onto the corresponding instance so the Databases
     * tab can render WAD (one-time) rows.
     */
    const mergeOfflineDatabasesIntoWadHosts = (
        formattedOfflineData: { [key: string]: any },
        offlineDatabasesItems: any[]
    ) => {
        if (!offlineDatabasesItems || offlineDatabasesItems.length === 0) {
            return formattedOfflineData;
        }
        // Pre-index offline databases by `${resourceId}_${databaseInstanceId}` so the
        // per-instance lookup below is O(1) instead of O(items) per instance.
        const offlineDatabasesByKey = new Map<string, any>();
        offlineDatabasesItems.forEach((item: any) => {
            if (item?.resourceId && item?.databaseInstanceId) {
                offlineDatabasesByKey.set(`${item.resourceId}_${item.databaseInstanceId}`, item);
            }
        });

        const merged: { [key: string]: any } = {};
        Object.keys(formattedOfflineData).forEach(key => {
            const entry = formattedOfflineData[key];
            const instances = Array.isArray(entry?.sqlServerInstances)
                ? entry.sqlServerInstances.map((inst: any) => {
                      const match = offlineDatabasesByKey.get(`${entry?.resourceId}_${inst?.databaseInstanceId}`);
                      if (match?.databases && Array.isArray(match.databases)) {
                          return { ...inst, databases: match.databases };
                      }
                      return inst;
                  })
                : entry?.sqlServerInstances;
            merged[key] = {
                ...entry,
                sqlServerInstances: instances
            };
        });
        return merged;
    };

    /**
     * Builds merged inventory from offline WAD rows and unregistered discover-row overlays.
     */
    const buildMergedInventoryData = (
        currentInventoryTableData: Record<string, any>,
        offlineData: any[],
        unregisteredData: any[],
        dbType: typeof DBType.MSSQL | typeof DBType.ORACLE
    ) => {
        const selectedCredIds = headerSelectedMultiCredIdsListRef.current;
        const selectedRegionIds = headerSelectedMultiRegionIdsListRef.current;

        let filteredOfflineData = offlineData;
        if (selectedCredIds?.length > 0 && selectedRegionIds?.length > 0) {
            filteredOfflineData = offlineData.filter((host: any) => {
                const hostCredId = host?.credentialId || host?.credentialsId;
                const hostRegionId = host?.regionId || host?.region;
                const hasMatchingCred = hostCredId && selectedCredIds.includes(hostCredId);
                const hasMatchingRegion = hostRegionId && selectedRegionIds.includes(hostRegionId);
                const hasNoCred = !hostCredId;
                const hasNoRegion = !hostRegionId;

                return (hasMatchingCred && hasMatchingRegion) || (hasNoCred && hasNoRegion) || hasNoCred || hasNoRegion;
            });
        }

        let formattedOfflineData =
            dbType === DBType.ORACLE
                ? formatOracleOfflineAssessmentToInventoryData(filteredOfflineData)
                : formatOfflineAssessmentToInventoryData(filteredOfflineData);

        if (dbType === DBType.MSSQL) {
            const offlineDatabasesItems = store.getState().inventoryV2.offlineMssqlDatabasesData || [];
            formattedOfflineData = mergeOfflineDatabasesIntoWadHosts(formattedOfflineData, offlineDatabasesItems);
        }

        let mergedInventoryData = {
            ...currentInventoryTableData,
            ...formattedOfflineData
        };

        if (unregisteredData?.length) {
            mergedInventoryData = mergeUnregisteredAssessmentIntoInventory(
                mergedInventoryData,
                unregisteredData,
                dbType
            );
        }

        return mergedInventoryData;
    };

    /**
     * Updates inventory with offline WAD rows and unregistered overlays in a single dispatch.
     */
    const updateInventoryWithAssessmentData = (
        offlineData: any[],
        unregisteredData: any[],
        dbType: typeof DBType.MSSQL | typeof DBType.ORACLE
    ) => {
        const state = store.getState();
        const currentInventoryTableData = state.inventoryV2.inventoryTableData || {};
        const mergedInventoryData = buildMergedInventoryData(
            currentInventoryTableData,
            offlineData,
            unregisteredData,
            dbType
        );

        if (mergedInventoryData === currentInventoryTableData) {
            return;
        }

        isUpdatingRef.current = true;
        dispatch(setInventoryTableData(mergedInventoryData));
    };

    /**
     * Updates the inventory table data with formatted offline assessment data.
     * If no credential/region is selected, shows all offline data.
     * If credential/region is selected, filters data accordingly or shows instances without cred/region.
     * @param offlineData - The offline assessment data to format and merge
     * @param dbType - The database type (DBType.MSSQL or DBType.ORACLE)
     */
    const updateInventoryWithOfflineData = (offlineData: any[], dbType: typeof DBType.MSSQL | typeof DBType.ORACLE) => {
        updateInventoryWithAssessmentData(offlineData, [], dbType);
    };

    /**
     * Merges unregistered (on-demand) assessment data onto matching discovered inventory rows.
     * Does not create separate WAD inventory entries.
     */
    const mergeAllUnregisteredIntoInventory = () => {
        const state = store.getState();
        let mergedInventoryData = state.inventoryV2.inventoryTableData || {};

        if (unregisteredMssqlAssessmentData?.length > 0) {
            mergedInventoryData = mergeUnregisteredAssessmentIntoInventory(
                mergedInventoryData,
                unregisteredMssqlAssessmentData,
                DBType.MSSQL
            );
        }
        if (unregisteredOracleAssessmentData?.length > 0) {
            mergedInventoryData = mergeUnregisteredAssessmentIntoInventory(
                mergedInventoryData,
                unregisteredOracleAssessmentData,
                DBType.ORACLE
            );
        }

        if (mergedInventoryData === state.inventoryV2.inventoryTableData) {
            return;
        }

        isUpdatingRef.current = true;
        dispatch(setInventoryTableData(mergedInventoryData));
    };

    return null;
};

export default WADApis;
