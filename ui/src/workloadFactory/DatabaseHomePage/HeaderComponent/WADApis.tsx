import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery,
    useLazyGetAllOfflineOracleHostsAssessmentDataQuery
} from '../../../utils/apiService';
import {
    addOfflineMssqlHostAssessmentData,
    addOfflineOracleHostAssessmentData,
    addAllMssqlHostAssessmentData,
    addAllOracleHostAssessmentData,
    setInventoryTableData,
    setOfflineMssqlHostAssessmentLoading,
    setOfflineOracleHostAssessmentLoading
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
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);

    // Refs to track current selections and prevent infinite loops
    const headerSelectedMultiCredIdsListRef = useRef(headerSelectedMultiCredIdsList);
    const headerSelectedMultiRegionIdsListRef = useRef(headerSelectedMultiRegionIdsList);
    const isUpdatingRef = useRef(false);

    // API hooks for lazy queries
    const [getAllOfflineAssessmentAPI] = useLazyGetAllOfflineMssqlHostsAssessmentDataQuery();
    const [getAllOfflineOracleAssessmentAPI] = useLazyGetAllOfflineOracleHostsAssessmentDataQuery();

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-call offline assessment APIs on refresh
    useEffect(() => {
        if (isRefreshed) {
            getAllOfflineAssessmentData([], null);
            getAllOfflineOracleAssessmentData([], null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRefreshed]);

    // When cred/region changes, reformat the MSSQL offline data
    useEffect(() => {
        if (offlineMssqlHostAssessmentData && offlineMssqlHostAssessmentData.length > 0) {
            updateInventoryWithOfflineData(offlineMssqlHostAssessmentData, 'mssql');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, offlineMssqlHostAssessmentData]);

    // When cred/region changes, reformat the Oracle offline data
    useEffect(() => {
        if (offlineOracleHostAssessmentData && offlineOracleHostAssessmentData.length > 0) {
            updateInventoryWithOfflineData(offlineOracleHostAssessmentData, 'oracle');
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
                updateInventoryWithOfflineData(offlineMssqlHostAssessmentData, 'mssql');
            }
            if (!hasOracleWadEntries && offlineOracleHostAssessmentData && offlineOracleHostAssessmentData.length > 0) {
                updateInventoryWithOfflineData(offlineOracleHostAssessmentData, 'oracle');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryTableData]);

    /**
     * Adds offline assessment data to the "all" assessment data store.
     * Transforms flat offline data to hierarchical assessment format with host → instancesAssessment structure.
     * @param offlineData - The offline assessment data to add (flat instance-level structure)
     * @param dbType - The database type ('mssql' or 'oracle')
     */
    const addOfflineDataToAllAssessment = (offlineData: any[], dbType: 'mssql' | 'oracle') => {
        const state = store.getState();
        // Transform flat offline data to hierarchical assessment format
        const formattedAssessmentData = formatOfflineDataToAssessmentFormat(offlineData, dbType);

        if (dbType === 'mssql') {
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
                    addOfflineDataToAllAssessment(newAssessmentData, 'mssql');
                    updateInventoryWithOfflineData(newAssessmentData, 'mssql');
                }
            } else {
                dispatch(setOfflineMssqlHostAssessmentLoading(false));
                if (assessmentData.length > 0) {
                    dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
                    addOfflineDataToAllAssessment(assessmentData, 'mssql');
                    updateInventoryWithOfflineData(assessmentData, 'mssql');
                }
            }
        } catch (error) {
            dispatch(setOfflineMssqlHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
                addOfflineDataToAllAssessment(assessmentData, 'mssql');
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
                    addOfflineDataToAllAssessment(newAssessmentData, 'oracle');
                    updateInventoryWithOfflineData(newAssessmentData, 'oracle');
                }
            } else {
                dispatch(setOfflineOracleHostAssessmentLoading(false));
                if (assessmentData.length > 0) {
                    dispatch(addOfflineOracleHostAssessmentData(assessmentData));
                    addOfflineDataToAllAssessment(assessmentData, 'oracle');
                    updateInventoryWithOfflineData(assessmentData, 'oracle');
                }
            }
        } catch (error) {
            dispatch(setOfflineOracleHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineOracleHostAssessmentData(assessmentData));
                addOfflineDataToAllAssessment(assessmentData, 'oracle');
            }
        }
    };

    /**
     * Updates the inventory table data with formatted offline assessment data.
     * If no credential/region is selected, shows all offline data.
     * If credential/region is selected, filters data accordingly or shows instances without cred/region.
     * @param offlineData - The offline assessment data to format and merge
     * @param dbType - The database type ('mssql' or 'oracle')
     */
    const updateInventoryWithOfflineData = (offlineData: any[], dbType: 'mssql' | 'oracle') => {
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
        const formattedOfflineData =
            dbType === 'oracle'
                ? formatOracleOfflineAssessmentToInventoryData(filteredOfflineData)
                : formatOfflineAssessmentToInventoryData(filteredOfflineData);

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
