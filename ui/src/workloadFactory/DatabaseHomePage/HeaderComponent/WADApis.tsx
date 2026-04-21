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
    setInventoryTableData,
    setOfflineMssqlHostAssessmentLoading,
    setOfflineOracleHostAssessmentLoading,
    addOfflineMssqlDatabasesData,
    setOfflineMssqlDatabasesLoading
} from '../../../store/workloadFactory/inventoryV2Slice';
import {
    formatOfflineAssessmentToInventoryData,
    formatOracleOfflineAssessmentToInventoryData
} from '../../InventoryV2/InventoryUtilsV2';
import { formatOfflineDataToAssessmentFormat } from '../DatabaseHomeUtils';
import store from '../../../store/store';
import { DBType } from '../../../utils/consts';

const WADApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const offlineMssqlHostAssessmentData = useAppSelector(state => state.inventoryV2.offlineMssqlHostAssessmentData);
    const offlineOracleHostAssessmentData = useAppSelector(state => state.inventoryV2.offlineOracleHostAssessmentData);
    const offlineMssqlDatabasesData = useAppSelector(state => state.inventoryV2.offlineMssqlDatabasesData);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);

    // Refs to track current selections and prevent infinite loops
    const headerSelectedMultiCredIdsListRef = useRef(headerSelectedMultiCredIdsList);
    const headerSelectedMultiRegionIdsListRef = useRef(headerSelectedMultiRegionIdsList);
    const isUpdatingRef = useRef(false);

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
        getAllOfflineAssessmentData([], null);
        getAllOfflineOracleAssessmentData([], null);
        getAllOfflineMssqlDatabasesData([], null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-call offline assessment APIs on refresh
    useEffect(() => {
        if (isRefreshed) {
            getAllOfflineAssessmentData([], null);
            getAllOfflineOracleAssessmentData([], null);
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

    // Re-merge WAD data when inventoryTableData changes (e.g., when InventoryApisV3 updates it)
    useEffect(() => {
        // Prevent infinite loop - only re-merge if we're not the one updating
        if (isUpdatingRef.current) {
            isUpdatingRef.current = false;
            return;
        }

        // Check if we have offline data and if WAD entries are missing per DB type from inventoryTableData
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
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryTableData]);

    /**
     * Adds offline assessment data to the "all" assessment data store.
     * Transforms flat offline data to hierarchical assessment format with host → instancesAssessment structure.
     * @param offlineData - The offline assessment data to add (flat instance-level structure)
     * @param dbType - The database type (DBType.MSSQL or DBType.ORACLE)
     */
    const addOfflineDataToAllAssessment = (offlineData: any[], dbType: typeof DBType.MSSQL | typeof DBType.ORACLE) => {
        const state = store.getState();
        // Transform flat offline data to hierarchical assessment format
        const formattedAssessmentData = formatOfflineDataToAssessmentFormat(offlineData, dbType);

        if (dbType === DBType.MSSQL) {
            const existingAllData = state.inventoryV2.allmssqlHostAssessmentData || [];
            // Filter out any existing WAD data to avoid duplicates, then add new formatted offline data
            const nonWadData = existingAllData.filter((item: any) => !item?.isWad);
            dispatch(addAllMssqlHostAssessmentData([...nonWadData, ...formattedAssessmentData]));
        } else {
            const existingAllData = state.inventoryV2.allOracleHostAssessmentData || [];
            // Filter out any existing WAD data to avoid duplicates, then add new formatted offline data
            const nonWadData = existingAllData.filter((item: any) => !item?.isWad);
            dispatch(addAllOracleHostAssessmentData([...nonWadData, ...formattedAssessmentData]));
        }
    };

    /**
     * Fetches all offline MSSQL host assessment data.
     * This API is called irrespective of credential/region selection.
     */
    const getAllOfflineAssessmentData = async (assessmentData: any[], nextToken: string | null) => {
        try {
            dispatch(setOfflineMssqlHostAssessmentLoading(true));

            const result: any = await getAllOfflineAssessmentAPI({
                credentialId: null,
                regionId: null,
                nextToken
            });

            if (result && !result?.error && result?.data) {
                const newAssessmentData = [
                    ...assessmentData,
                    ...(Array.isArray(result?.data?.items)
                        ? result.data.items.map((assessment: any) => ({
                              ...assessment,
                              isWad: true // Mark as WAD (offline) data
                          }))
                        : [])
                ];

                if (result?.data?.nextToken) {
                    // Continue fetching with pagination
                    getAllOfflineAssessmentData(newAssessmentData, result?.data?.nextToken);
                } else {
                    // All data fetched, store in slice
                    dispatch(setOfflineMssqlHostAssessmentLoading(false));
                    dispatch(addOfflineMssqlHostAssessmentData(newAssessmentData));
                    addOfflineDataToAllAssessment(newAssessmentData, DBType.MSSQL);
                    updateInventoryWithOfflineData(newAssessmentData, DBType.MSSQL);
                }
            } else {
                dispatch(setOfflineMssqlHostAssessmentLoading(false));
                if (assessmentData.length > 0) {
                    dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
                    addOfflineDataToAllAssessment(assessmentData, DBType.MSSQL);
                    updateInventoryWithOfflineData(assessmentData, DBType.MSSQL);
                }
            }
        } catch (error) {
            dispatch(setOfflineMssqlHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
                addOfflineDataToAllAssessment(assessmentData, DBType.MSSQL);
            }
        }
    };

    /**
     * Fetches all offline Oracle host assessment data.
     * This API is called irrespective of credential/region selection.
     */
    const getAllOfflineOracleAssessmentData = async (assessmentData: any[], nextToken: string | null) => {
        try {
            dispatch(setOfflineOracleHostAssessmentLoading(true));

            const result: any = await getAllOfflineOracleAssessmentAPI({
                credentialId: null,
                regionId: null,
                nextToken
            });

            if (result && !result?.error && result?.data) {
                const newAssessmentData = [
                    ...assessmentData,
                    ...(Array.isArray(result?.data?.items)
                        ? result.data.items.map((assessment: any) => ({
                              ...assessment,
                              isWad: true // Mark as WAD (offline) data
                          }))
                        : [])
                ];

                if (result?.data?.nextToken) {
                    // Continue fetching with pagination
                    getAllOfflineOracleAssessmentData(newAssessmentData, result?.data?.nextToken);
                } else {
                    // All data fetched, store in slice
                    dispatch(setOfflineOracleHostAssessmentLoading(false));
                    dispatch(addOfflineOracleHostAssessmentData(newAssessmentData));
                    addOfflineDataToAllAssessment(newAssessmentData, DBType.ORACLE);
                    updateInventoryWithOfflineData(newAssessmentData, DBType.ORACLE);
                }
            } else {
                dispatch(setOfflineOracleHostAssessmentLoading(false));
                if (assessmentData.length > 0) {
                    dispatch(addOfflineOracleHostAssessmentData(assessmentData));
                    addOfflineDataToAllAssessment(assessmentData, DBType.ORACLE);
                    updateInventoryWithOfflineData(assessmentData, DBType.ORACLE);
                }
            }
        } catch (error) {
            dispatch(setOfflineOracleHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineOracleHostAssessmentData(assessmentData));
                addOfflineDataToAllAssessment(assessmentData, DBType.ORACLE);
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
     * Updates the inventory table data with formatted offline assessment data.
     * If no credential/region is selected, shows all offline data.
     * If credential/region is selected, filters data accordingly or shows instances without cred/region.
     * @param offlineData - The offline assessment data to format and merge
     * @param dbType - The database type (DBType.MSSQL or DBType.ORACLE)
     */
    const updateInventoryWithOfflineData = (offlineData: any[], dbType: typeof DBType.MSSQL | typeof DBType.ORACLE) => {
        const state = store.getState();
        const currentInventoryTableData = state.inventoryV2.inventoryTableData || {};
        const selectedCredIds = headerSelectedMultiCredIdsListRef.current;
        const selectedRegionIds = headerSelectedMultiRegionIdsListRef.current;

        // Filter offline data based on selected credentials and regions
        let filteredOfflineData = offlineData;

        // If credentials and regions are selected, filter data
        // Show data that matches the selected cred/region OR has no cred/region
        if (selectedCredIds?.length > 0 && selectedRegionIds?.length > 0) {
            filteredOfflineData = offlineData.filter((host: any) => {
                const hostCredId = host?.credentialId || host?.credentialsId;
                const hostRegionId = host?.regionId || host?.region;

                // Include if:
                // 1. Host has matching credentialId and regionId
                // 2. Host has no credentialId/regionId (unregistered offline data)
                const hasMatchingCred = hostCredId && selectedCredIds.includes(hostCredId);
                const hasMatchingRegion = hostRegionId && selectedRegionIds.includes(hostRegionId);
                const hasNoCred = !hostCredId;
                const hasNoRegion = !hostRegionId;

                return (hasMatchingCred && hasMatchingRegion) || (hasNoCred && hasNoRegion) || hasNoCred || hasNoRegion;
            });
        }

        // Format the filtered offline data based on db type
        let formattedOfflineData =
            dbType === DBType.ORACLE
                ? formatOracleOfflineAssessmentToInventoryData(filteredOfflineData)
                : formatOfflineAssessmentToInventoryData(filteredOfflineData);

        // For MSSQL WAD hosts, merge the offline databases (from
        // getOfflineMssqlAssessmentDatabases) onto each matching instance so the
        // Databases tab can render one-time WAD database rows.
        if (dbType === DBType.MSSQL) {
            const offlineDatabasesItems = state.inventoryV2.offlineMssqlDatabasesData || [];
            formattedOfflineData = mergeOfflineDatabasesIntoWadHosts(formattedOfflineData, offlineDatabasesItems);
        }

        // Merge with existing inventory data
        // Note: Offline data uses a special key format to avoid conflicts
        const mergedInventoryData = {
            ...currentInventoryTableData,
            ...formattedOfflineData
        };

        // Set flag to prevent infinite loop in useEffect
        isUpdatingRef.current = true;
        dispatch(setInventoryTableData(mergedInventoryData));
    };

    return null;
};

export default WADApis;
