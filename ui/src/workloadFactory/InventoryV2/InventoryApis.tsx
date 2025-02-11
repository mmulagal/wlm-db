import { useEffect, useState, useRef } from 'react';
import {
    useGetMssqlInstanceDataV2Mutation,
    useLazyDiscoverHostsQuery,
    useLazyGetAllMssqlHostsAssessmentDataQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery,
    useLazyGetPgSqlDatabaseHostsListQuery,
    useLazyGetPgsqlDatabaseHostsFullDataV2Query
} from '../../utils/apiService';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addDatabaseHostsDataV2,
    addPgSqlDatabaseHostsData,
    setAllMssqlHostAssessmentLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusLoading,
    setInventoryTableData,
    setIsDatabaseHostsLoading,
    setIsDiscoverHostLoading,
    setIsDiscoveredHostData,
    setIsFullHostDataLoading,
    setIsFullPgSqlHostDataLoading,
    setIsManagedHostListLoading,
    setIsPgSqlDatabaseHostsLoading,
    setMssqlInstancesData,
    setResetManagedData
} from '../../store/workloadFactory/inventoryV2Slice';
import { setMultiSelectData } from '../../store/workloadFactory/headersSlice';
import {
    formatDiscoveredInventoryData,
    formatInventoryTableData,
    getExploreSavingsRows,
    getFsxIdsFromdiscover,
    getInventoryDataCount,
    getMhUnmanagedInstances,
    getPartnerInstanceId,
    getPrimaryClusterNode,
    getUnmanagedHostInstances,
    uniqueHostRow,
    updateInstancesApiResponse
} from './InventoryUtilsV2';
import store from '../../store/store';
import { INSTANCE_API_FIELDS } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { setUnmanagedExploreSavingsHost } from '../../store/workloadFactory/exploreSavingsSlice';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    // Combination that is running currently
    const {
        headerSelectedCred,
        headerSelectedRegion,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    } = useAppSelector(state => state.headers);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const { databaseHostsData, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsData: pgsqlDatabaseHostsData, fullHostDataLoading: pgsqlFullHostDataLoading } = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts
    );
    const { inventoryTableData, mssqlInstancesData, fsxCredentialStatusObj } = useAppSelector(
        state => state.inventoryV2
    );

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    // First MSSQL API call to get managed host list
    const [getManagedHostListAPI] = useLazyGetManagedHostDataQuery();
    const [managedHostList, setManagedHostList] = useState<any>([]);
    const [managedHostListLoading, setManagedHostListLoading] = useState(true);

    // database-hosts without fields values
    const [getDatabaseHostsListApi] = useLazyGetDatabaseHostsListV2Query();
    const [topologyHostData, setTopologyHostData] = useState<any>({});

    // database-hosts with fields values
    const [getDatabaseHostsFullDataApi] = useLazyGetDatabaseHostsFullDataV2Query();
    const [fullHostData, setFullHostData] = useState<any>({});

    // pgsql database-hosts without fields values
    const [getPgSqlDatabaseHostsListApi] = useLazyGetPgSqlDatabaseHostsListQuery();
    const [pgsqlTopologyHostData, setPgsqlTopologyHostData] = useState<any>({});

    // pgsql database-hosts with fields values
    const [getPgSqlDatabaseHostsFullDataApi] = useLazyGetPgsqlDatabaseHostsFullDataV2Query();
    const [fullPgsqlHostData, setFullPgsqlHostData] = useState<any>({});

    // Discover API
    const [getDiscoveryHostsListApi] = useLazyDiscoverHostsQuery();
    const [discoveredHostData, setDiscoveredHostData] = useState<any>([]);
    const [secNodeDiscoveredListRem, setSecNodeDiscoveredListRem] = useState<any>([]);

    // Get fsx credentials status query.
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();
    const [fsxCredentialStatusData, setFsxCredentialStatusData] = useState<any>([]);

    // Get all managed hosts assessment data
    const [getAllMssqlHostAssessmentAPI] = useLazyGetAllMssqlHostsAssessmentDataQuery();
    const [allmssqlHostAssessmentData, setAllmssqlHostAssessmentData] = useState<any>([]);

    // For instances API call
    const [runningInstanceList, setRunningInstanceList] = useState<Array<string>>([]);
    const [partnerInstanceList, setPartnerInstanceList] = useState<any>([]);
    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();

    const mssqlInstancesDataRef: any = useRef(null);
    const runningInstanceListRef: any = useRef(null);

    useEffect(() => {
        mssqlInstancesDataRef.current = mssqlInstancesData;
    }, [mssqlInstancesData]);

    useEffect(() => {
        runningInstanceListRef.current = runningInstanceList;
    }, [runningInstanceList]);

    const resetValuesForPerComb = () => {
        // Manage API values reset
        setManagedHostList([]);
        setManagedHostListLoading(true);
        // database-hosts MSSQL without fields values
        dispatch(setIsDatabaseHostsLoading(false));
        setTopologyHostData({});
        // database-hosts MSSQL with fields values
        dispatch(setIsFullHostDataLoading(false));
        setFullHostData({});
        // database-hosts PGSQL without fields values
        dispatch(setIsPgSqlDatabaseHostsLoading(false));
        setPgsqlTopologyHostData({});
        // database-hosts PGSQL with fields values
        dispatch(setIsFullPgSqlHostDataLoading(false));
        setFullPgsqlHostData({});
        // Discover API
        dispatch(setIsDiscoverHostLoading(false));
        setDiscoveredHostData([]);
        // FSX credentials status
        dispatch(setFsxCredentialStatusLoading(false));
        setFsxCredentialStatusData({});
        // instances API
        setRunningInstanceList([]);
        setPartnerInstanceList([]);
    };

    const managedListAPIDataUpdate = (
        managedList: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        setManagedHostListLoading(false);
        dispatch(setIsManagedHostListLoading(false));
        setManagedHostList(managedList);
        //Sample dispatch
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getManagedHostData',
                response: managedList,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
    // We can call this API for both pgsql and mssql
    const getManagedHostList = async (
        managedList: string[],
        managedHostCursor: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getManagedHostListAPI({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: managedHostCursor
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.instances) {
                                managedList = [...managedList, ...perRow?.instances];
                            }
                        });
                        if (result?.data?.nextToken) {
                            getManagedHostList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            managedListAPIDataUpdate(managedList, runningCredId, runningRegionId, true, '');
                            callManagedHostAllAPis(managedList);
                        }
                    } else {
                        managedListAPIDataUpdate(managedList, runningCredId, runningRegionId, false, result?.error);
                    }
                }
            } catch (error) {
                managedListAPIDataUpdate(managedList, runningCredId, runningRegionId, false, error);
            }
        }
    };

    const callManagedHostAllAPis = (managedList: any) => {
        let discoveredRows: any = [];
        getDiscoveryHostsList(discoveredRows, null, credId, regionId);
        if (managedList?.length > 0) {
            let fullHostData: any = {};
            let fullPgsqlHostData: any = {};
            let topologyHostData: any = {};
            let pgsqlTopologyHostData: any = {};
            let assessmentData: any = [];
            getDatabaseHostsList(topologyHostData, null, credId, regionId);
            getPgSqlDatabaseHostsList(pgsqlTopologyHostData, null, credId, regionId);
            getDatabaseHostsFullData(fullHostData, null, credId, regionId);
            getPgsqlDatabaseHostsFullData(fullPgsqlHostData, null, credId, regionId);
            getAllMssqlHostAssessmentData(assessmentData, null, credId, regionId);
            // ToDo will add sandbox APIs here in next phase
        } else {
            getDatabaseHostsListUpdate({}, credId, regionId, false, 'No data found');
            getDatabaseHostsFullUpdate({}, credId, regionId, false, 'No data found');
            getPgSqlDatabaseHostsListUpdate({}, credId, regionId, false, 'No data found');
            getPgsqlDatabaseHostsFullDataUpdate({}, credId, regionId, false, 'No data found');
            getAllMssqlHostAssessmentDataUpdate([], credId, regionId, false, 'No data found');
            // ToDo will add sandbox APIs here in next phase
        }
    };

    const getDatabaseHostsListUpdate = (
        dataObj: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setIsDatabaseHostsLoading(false));
        setTopologyHostData(dataObj);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getDatabaseHostsListV2',
                response: dataObj,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get basic managed rows info. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsList = async (
        dataObj: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDatabaseHostsListApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                dataObj = { ...dataObj, [perRow?.id]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setTopologyHostData(dataObj);
                            getDatabaseHostsList(dataObj, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            getDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, true, '');
                        }
                    } else {
                        getDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, false, result?.error);
                    }
                }
            } catch (error) {
                getDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, false, error);
            }
        }
    };

    const getDatabaseHostsFullUpdate = (
        dataObj: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setIsFullHostDataLoading(false));
        setFullHostData(dataObj);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getDatabaseHostsFullDataV2',
                response: dataObj,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get all managed rows data. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsFullData = async (
        dataObj: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken,
                    isDemoMode: isDemoMode
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                dataObj = { ...dataObj, [perRow?.id]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setFullHostData(dataObj);
                            getDatabaseHostsFullData(dataObj, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            getDatabaseHostsFullUpdate(dataObj, runningCredId, runningRegionId, true, '');
                        }
                    } else {
                        getDatabaseHostsFullUpdate(dataObj, runningCredId, runningRegionId, false, result?.error);
                    }
                }
            } catch (error) {
                getDatabaseHostsFullUpdate(dataObj, runningCredId, runningRegionId, false, error);
            }
        }
    };

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object.
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData) {
            let databaseHostDataObj: any = {};
            Object.keys(topologyHostData).map((key: string) => {
                let uniqueKey = uniqueHostRow(key, credId, regionId);
                if (uniqueKey in fullHostData) {
                    const perObj = {
                        ...topologyHostData[key],
                        ...fullHostData[key],
                        loading: false,
                        databaseHostStatus: topologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [uniqueKey]: { ...perObj, hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE } }
                    };
                } else {
                    const perObj = { ...topologyHostData[key], loading: fullHostDataLoading ? true : false };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [uniqueKey]: { ...perObj, hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE } }
                    };
                }
            });
            dispatch(addDatabaseHostsDataV2({ ...databaseHostsData, ...databaseHostDataObj }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullHostData, topologyHostData, fullHostDataLoading]);

    const getPgSqlDatabaseHostsListUpdate = (
        dataObj: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setIsPgSqlDatabaseHostsLoading(false));
        setPgsqlTopologyHostData(dataObj);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getPgSqlDatabaseHostsList',
                response: dataObj,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get basic managed rows info for pgsql. This output is used only in dashboard page as of now.
    const getPgSqlDatabaseHostsList = async (
        dataObj: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getPgSqlDatabaseHostsListApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                dataObj = { ...dataObj, [perRow?.id]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setPgsqlTopologyHostData(dataObj);
                            getPgSqlDatabaseHostsList(dataObj, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            getPgSqlDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, true, '');
                        }
                    } else {
                        getPgSqlDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, false, result?.error);
                    }
                }
            } catch (error) {
                getPgSqlDatabaseHostsListUpdate(dataObj, runningCredId, runningRegionId, false, error);
            }
        }
    };

    const getPgsqlDatabaseHostsFullDataUpdate = (
        dataObj: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setIsFullPgSqlHostDataLoading(false));
        setFullPgsqlHostData(dataObj);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getPgsqlDatabaseHostsFullDataV2',
                response: dataObj,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get all managed rows data for pgsql. This output is used both in managed tab and dashboard page.
    const getPgsqlDatabaseHostsFullData = async (
        dataObj: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getPgSqlDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken,
                    isDemoMode: isDemoMode
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                dataObj = { ...dataObj, [perRow?.id]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setFullPgsqlHostData(dataObj);
                            getPgsqlDatabaseHostsFullData(
                                dataObj,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            getPgsqlDatabaseHostsFullDataUpdate(dataObj, runningCredId, runningRegionId, true, '');
                        }
                    } else {
                        getPgsqlDatabaseHostsFullDataUpdate(
                            dataObj,
                            runningCredId,
                            runningRegionId,
                            false,
                            result?.error
                        );
                    }
                }
            } catch (error) {
                getPgsqlDatabaseHostsFullDataUpdate(dataObj, runningCredId, runningRegionId, false, error);
            }
        }
    };

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object for pgsql.
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData) {
            let databaseHostDataObj: any = {};
            Object.keys(pgsqlTopologyHostData).map((key: string) => {
                let uniqueKey = uniqueHostRow(key, credId, regionId);
                if (uniqueKey in fullPgsqlHostData) {
                    const perObj = {
                        ...pgsqlTopologyHostData[key],
                        ...fullPgsqlHostData[key],
                        loading: false,
                        databaseHostStatus: pgsqlTopologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [uniqueKey]: { ...perObj, hostType: GENERAL.POSTGRESQL_TYPE } }
                    };
                } else {
                    const perObj = { ...pgsqlTopologyHostData[key], loading: pgsqlFullHostDataLoading ? true : false };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [uniqueKey]: { ...perObj, hostType: GENERAL.POSTGRESQL_TYPE } }
                    };
                }
            });
            dispatch(addPgSqlDatabaseHostsData({ ...pgsqlDatabaseHostsData, ...databaseHostDataObj }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPgsqlHostData, pgsqlTopologyHostData, pgsqlFullHostDataLoading]);

    const getAllMssqlHostAssessmentDataUpdate = (
        assessmentData: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setAllMssqlHostAssessmentLoading(false));
        setAllmssqlHostAssessmentData(assessmentData);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getAllMssqlHostsAssessmentData',
                response: assessmentData,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    const getAllMssqlHostAssessmentData = async (
        assessmentData: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getAllMssqlHostAssessmentAPI({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        assessmentData = [...assessmentData, ...result?.data?.assessmentsPerAccount];
                        if (result?.data?.nextToken) {
                            setAllmssqlHostAssessmentData(assessmentData);
                            getAllMssqlHostAssessmentData(
                                assessmentData,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            getAllMssqlHostAssessmentDataUpdate(
                                assessmentData,
                                runningCredId,
                                runningRegionId,
                                true,
                                ''
                            );
                        }
                    } else {
                        getAllMssqlHostAssessmentDataUpdate(
                            assessmentData,
                            runningCredId,
                            runningRegionId,
                            false,
                            result?.error
                        );
                    }
                }
            } catch (error) {
                getAllMssqlHostAssessmentDataUpdate(assessmentData, runningCredId, runningRegionId, false, error);
            }
        }
    };

    const getDiscoveryHostsListUpdate = (
        discoveredList: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setIsDiscoverHostLoading(false));
        setDiscoveredHostData(discoveredList);
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'discoverHosts',
                response: discoveredList,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get discovery API data.
    const getDiscoveryHostsList = async (
        discoveredList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDiscoveryHostsListApi({
                    regionId: regionId,
                    credentialsId: credId,
                    nextToken: nextToken
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.ec2InstanceId) {
                                discoveredList = [
                                    ...discoveredList,
                                    {
                                        ...perRow,
                                        hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE,
                                        credentialId: credId,
                                        regionId: regionId
                                    }
                                ];
                            }
                        });
                        // call fsx id cred status API is fsxids are found
                        const fsxIds = getFsxIdsFromdiscover(result?.data?.items);
                        if (fsxIds && fsxIds.length > 0) {
                            dispatch(setFsxCredentialStatusLoading(true));
                            getFsxCredentialStatusList(fsxIds, runningCredId, runningRegionId);
                        }
                        if (result?.data?.nextToken) {
                            dispatch(setIsDiscoveredHostData(discoveredList));
                            getDiscoveryHostsList(
                                discoveredList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            getDiscoveryHostsListUpdate(discoveredList, runningCredId, runningRegionId, true, '');
                        }
                    } else {
                        getDiscoveryHostsListUpdate(
                            discoveredList,
                            runningCredId,
                            runningRegionId,
                            false,
                            result?.error
                        );
                    }
                }
            } catch (error) {
                getDiscoveryHostsListUpdate(discoveredList, runningCredId, runningRegionId, false, error);
            }
        }
    };

    const getFsxCredentialStatusUpdate = (
        fsxIdsList: any,
        runningCredId: string,
        runningRegionId: string,
        isSuccess: boolean,
        error: any
    ) => {
        dispatch(setFsxCredentialStatusLoading(false));
        dispatch(
            setMultiSelectData({
                cred: runningCredId,
                region: runningRegionId,
                apiName: 'getFsxCredentialStatus',
                response: fsxIdsList,
                status: true,
                isSuccess: isSuccess,
                error: error
            })
        );
    };

    // This function is to get registered fsxids status.
    const getFsxCredentialStatusList = async (
        fsxIdsList: Array<string>,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getFsxCredentialStatusListApi({
                    credentialsId: credId,
                    regionId: regionId,
                    fsxIds: fsxIdsList.join(',')
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        let fsxCredStatusObj: any = {};
                        let fsxCredStatusObjUnique: any = {};
                        if (result?.data?.fileSystems) {
                            result?.data?.fileSystems?.map((item: any) => {
                                fsxCredStatusObj[item.id] = item.isRegistered;
                                fsxCredStatusObjUnique[uniqueHostRow(item.id, credId, regionId)] = item;
                            });
                            if (fsxCredentialStatusData) {
                                setFsxCredentialStatusData({
                                    ...fsxCredentialStatusData,
                                    ...fsxCredStatusObj
                                });
                                dispatch(
                                    setFsxCredentialStatus({
                                        ...fsxCredentialStatusObj,
                                        ...fsxCredStatusObjUnique
                                    })
                                );
                            } else {
                                setFsxCredentialStatusData(fsxCredStatusObj);
                                dispatch(setFsxCredentialStatus(fsxCredStatusObjUnique));
                                getFsxCredentialStatusUpdate(
                                    fsxCredStatusObj,
                                    runningCredId,
                                    runningRegionId,
                                    true,
                                    ''
                                );
                            }
                        }
                    } else {
                        getFsxCredentialStatusUpdate(
                            fsxCredentialStatusData,
                            runningCredId,
                            runningRegionId,
                            false,
                            result?.error
                        );
                    }
                }
            } catch (error) {
                getFsxCredentialStatusUpdate(fsxCredentialStatusData, runningCredId, runningRegionId, false, error);
            }
        }
    };

    // If any new row added than it will trigger getMssqlData (API2) function to get unmanagaed row data.
    const callInstanceApi = (instancesList: Array<string>, isManagedHost: boolean, fields: Array<string>) => {
        let mssqlInstancesDataLoad: any = {};
        let noRunningList: Array<string> = [];
        if (instancesList && instancesList.length > 0) {
            instancesList?.map((ec2InstanceId: any) => {
                if (runningInstanceListRef.current.includes(ec2InstanceId)) {
                    return;
                }
                mssqlInstancesDataLoad[uniqueHostRow(ec2InstanceId, credId, regionId)] = {
                    isManagedHost: isManagedHost,
                    loading: true,
                    data: null,
                    error: null,
                    fields: fields
                };
                noRunningList.push(ec2InstanceId);
            });
            dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataLoad }));
            setRunningInstanceList([...runningInstanceListRef.current, ...noRunningList]);
            noRunningList?.map((ec2InstanceId: any) => {
                setTimeout(() => {
                    getMssqlData(ec2InstanceId, isManagedHost, fields);
                }, 1);
            });
        }
    };

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async (
        instanceId: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: credId,
                regionId: regionId,
                instances: instanceId,
                fields: fields.join(','),
                nextToken: nextToken
            });
            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    let partnerInstanceId = getPartnerInstanceId(host, host?.id);
                    if (
                        partnerInstanceId &&
                        !runningInstanceListRef.current.includes(partnerInstanceId) &&
                        !mssqlInstancesDataRef.current[host?.id]?.isManagedHost &&
                        !partnerInstanceList.includes(partnerInstanceId)
                    ) {
                        setPartnerInstanceList([...partnerInstanceList, ...[partnerInstanceId]]);
                    }

                    // const state = store.getState();
                    // const unManagedPerfInstanceIdsListData = state.inventoryV2.unManagedPerfInstanceIdsList;
                    // if (
                    //     partnerInstanceId &&
                    //     unManagedPerfInstanceIdsListData.includes(host?.id) &&
                    //     !unManagedPerfInstanceIdsListData.includes(partnerInstanceId)
                    // ) {
                    //     dispatch(
                    //         setUnManagedPerfInstanceIdsList([
                    //             ...unManagedPerfInstanceIdsListData,
                    //             ...[partnerInstanceId]
                    //         ])
                    //     );
                    // }

                    if (mssqlInstancesDataRef.current[host?.id]) {
                        mssqlInstancesDataRes[uniqueHostRow(host?.id, credId, regionId)] = {
                            isManagedHost: mssqlInstancesDataRef.current[host?.id]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: mssqlInstancesDataRef.current[host?.id]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[instanceId]) {
                    mssqlInstancesDataRes[uniqueHostRow(instanceId, credId, regionId)] = {
                        isManagedHost: mssqlInstancesDataRef.current[instanceId]?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: mssqlInstancesDataRef.current[instanceId]?.fields
                    };
                }
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[uniqueHostRow(instanceId, credId, regionId)] = {
                    isManagedHost: isManagedHost,
                    data: null,
                    error: result?.error?.data?.message,
                    fields: fields
                };
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[uniqueHostRow(instanceId, credId, regionId)] = {
                isManagedHost: isManagedHost,
                data: null,
                error: error,
                fields: fields
            };
            dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
        }
    };

    useEffect(() => {
        // if partner instance ID
        if (partnerInstanceList) {
            callInstanceApi(partnerInstanceList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
        }
    }, [partnerInstanceList]);

    useEffect(() => {
        let managedList: string[] = [];
        if (credId && regionId) {
            resetValuesForPerComb();
            getManagedHostList(managedList, null, credId, regionId);
        }
    }, [credId, regionId]);

    // To set cred id and region id for selected combination
    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    // This data is coming from database-hosts API
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && databaseHostsData) {
            const formattedInventoryTableData = formatInventoryTableData(databaseHostsData);

            let unmanagedInstanceList = getMhUnmanagedInstances(
                formattedInventoryTableData,
                runningInstanceListRef.current
            );
            if (unmanagedInstanceList && unmanagedInstanceList?.length > 0) {
                callInstanceApi(unmanagedInstanceList, true, INSTANCE_API_FIELDS.MIXED_STATUS_FIELDS);
            }

            // To Avoid overriding
            let updatedResult = { ...inventoryTableData, ...formattedInventoryTableData };
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableData, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [databaseHostsData]);

    // This data is coming from discover API
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && !managedHostListLoading && discoveredHostData && discoveredHostData.length) {
            let newDiscoveredHostData: any = [];
            discoveredHostData.map((host: any) => {
                if (host?.sqlServerInstances) {
                    let perHostNodesList: any = [];
                    host?.sqlServerInstances?.map((perSql: any) => {
                        if (perSql?.sqlServerNodes) {
                            perHostNodesList = [...perHostNodesList, ...perSql?.sqlServerNodes];
                        }
                    });
                    host = { ...host, nodesList: perHostNodesList };
                }
                newDiscoveredHostData.push(host);
            });

            let removeRows: any[] = [];
            let clusterDiscoveredHost: any = {};
            // This function is used to find nodes available in managed or unmanaged tab. In that case Partner node will be added in removeRows list.
            getPrimaryClusterNode(
                newDiscoveredHostData,
                removeRows,
                managedHostList,
                clusterDiscoveredHost,
                isDemoMode
            );

            const formattedDiscoveredInventoryTableData = formatDiscoveredInventoryData(
                newDiscoveredHostData,
                removeRows,
                clusterDiscoveredHost
            );

            const state = store.getState();
            const removeSecNodeDiscoveredList = state.inventoryV2.removeSecNodeDiscoveredList;
            setSecNodeDiscoveredListRem([...removeSecNodeDiscoveredList, ...removeRows]);

            let unmanagedHostList = getUnmanagedHostInstances(
                formattedDiscoveredInventoryTableData,
                runningInstanceListRef.current
            );
            if (unmanagedHostList && unmanagedHostList?.length > 0) {
                callInstanceApi(unmanagedHostList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
            }

            // To Avoid overriding
            let updatedResult = { ...inventoryTableData, ...formattedDiscoveredInventoryTableData };
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableData, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredHostData, fsxCredentialStatusData, managedHostListLoading]);

    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && mssqlInstancesDataRef.current && inventoryTableData) {
            const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, inventoryTableData);
            dispatch(setInventoryTableData({ ...inventoryTableData, ...updatedInventoryData }));
        }
    }, [mssqlInstancesData]);

    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && inventoryTableData) {
            // const inventoryDataCount = getInventoryDataCount(inventoryTableData);
            // dispatch(setInventoryChartData(inventoryDataCount));
            const exploreSavingsRows = getExploreSavingsRows(inventoryTableData);
            dispatch(setUnmanagedExploreSavingsHost(exploreSavingsRows));
            // call ES APIs for dashboard potential savings
            // if (exploreSavingsRows && exploreSavingsRows.length > 0) {
            //     callPotentialSavings(exploreSavingsRows, credId, regionId);
            // }
        }
    }, [inventoryTableData, secNodeDiscoveredListRem]);

    useEffect(() => {
        if (credId && regionId && (runningInstanceList?.length > 0 || partnerInstanceList?.length > 0)) {
            let newList = [...runningInstanceList, ...partnerInstanceList];
            let isLoading = newList?.filter((instanceId: any) => {
                if (mssqlInstancesData?.[uniqueHostRow(instanceId, credId, regionId)]?.loading) {
                    return instanceId;
                }
            });
            if (!isLoading || isLoading?.length === 0) {
                dispatch(
                    setMultiSelectData({
                        cred: credId,
                        region: regionId,
                        apiName: 'getMssqlInstanceDataV2',
                        response: {},
                        status: true,
                        isSuccess: true,
                        error: ''
                    })
                );
            }
        } else if (credId && regionId && (discoveredHostData?.length > 0 || managedHostList?.length > 0)) {
            let isLoading = false;
            Object.keys(mssqlInstancesData)?.map((key: any) => {
                if (mssqlInstancesData?.[key]?.loading) {
                    isLoading = true;
                }
            });
            if (!isLoading) {
                dispatch(
                    setMultiSelectData({
                        cred: credId,
                        region: regionId,
                        apiName: 'getMssqlInstanceDataV2',
                        response: {},
                        status: true,
                        isSuccess: true,
                        error: ''
                    })
                );
            }
        }
    }, [mssqlInstancesData, runningInstanceList, partnerInstanceList]);

    return <></>;
};

export default InventoryApis;
