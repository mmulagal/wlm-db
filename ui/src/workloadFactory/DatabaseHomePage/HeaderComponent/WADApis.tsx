import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useLazyGetAllOfflineMssqlHostsAssessmentDataQuery } from '../../../utils/apiService';
import {
    addOfflineMssqlHostAssessmentData,
    setInventoryTableData,
    setOfflineMssqlHostAssessmentLoading
} from '../../../store/workloadFactory/inventoryV2Slice';
import { formatOfflineAssessmentToInventoryData } from '../../InventoryV2/InventoryUtilsV2';
import store from '../../../store/store';

const WADApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const offlineMssqlHostAssessmentData = useAppSelector(state => state.inventoryV2.offlineMssqlHostAssessmentData);

    // Refs to track current selections and prevent infinite loops
    const headerSelectedMultiCredIdsListRef = useRef(headerSelectedMultiCredIdsList);
    const headerSelectedMultiRegionIdsListRef = useRef(headerSelectedMultiRegionIdsList);
    const isUpdatingRef = useRef(false);

    // API hook for lazy query
    const [getAllOfflineAssessmentAPI] = useLazyGetAllOfflineMssqlHostsAssessmentDataQuery();

    // Update refs when selections change
    useEffect(() => {
        headerSelectedMultiCredIdsListRef.current = headerSelectedMultiCredIdsList;
    }, [headerSelectedMultiCredIdsList]);

    useEffect(() => {
        headerSelectedMultiRegionIdsListRef.current = headerSelectedMultiRegionIdsList;
    }, [headerSelectedMultiRegionIdsList]);

    // Call offline assessment API on mount
    useEffect(() => {
        // Always call this API regardless of cred/region availability
        getAllOfflineAssessmentData([], null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When cred/region changes, reformat the offline data
    useEffect(() => {
        if (offlineMssqlHostAssessmentData && offlineMssqlHostAssessmentData.length > 0) {
            updateInventoryWithOfflineData(offlineMssqlHostAssessmentData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, offlineMssqlHostAssessmentData]);

    // Re-merge WAD data when inventoryTableData changes (e.g., when InventoryApisV3 updates it)
    useEffect(() => {
        // Prevent infinite loop - only re-merge if we're not the one updating
        if (isUpdatingRef.current) {
            isUpdatingRef.current = false;
            return;
        }

        // Check if we have offline data and if any WAD entries are missing from inventoryTableData
        if (offlineMssqlHostAssessmentData && offlineMssqlHostAssessmentData.length > 0 && inventoryTableData) {
            const hasWadEntries = Object.values(inventoryTableData).some((entry: any) => entry?.isWad);
            if (!hasWadEntries) {
                updateInventoryWithOfflineData(offlineMssqlHostAssessmentData);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryTableData]);

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
                    ...(Array.isArray(result?.data?.assessmentsPerAccount)
                        ? result.data.assessmentsPerAccount.map((assessment: any) => ({
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
                    updateInventoryWithOfflineData(newAssessmentData);
                }
            } else {
                dispatch(setOfflineMssqlHostAssessmentLoading(false));
                if (assessmentData.length > 0) {
                    dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
                    updateInventoryWithOfflineData(assessmentData);
                }
            }
        } catch (error) {
            dispatch(setOfflineMssqlHostAssessmentLoading(false));
            if (assessmentData.length > 0) {
                dispatch(addOfflineMssqlHostAssessmentData(assessmentData));
            }
        }
    };

    /**
     * Updates the inventory table data with formatted offline assessment data.
     * If no credential/region is selected, shows all offline data.
     * If credential/region is selected, filters data accordingly or shows instances without cred/region.
     */
    const updateInventoryWithOfflineData = (offlineData: any[]) => {
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

        // Format the filtered offline data
        const formattedOfflineData = formatOfflineAssessmentToInventoryData(filteredOfflineData);

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
};

export default WADApis;
