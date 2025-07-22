import { useEffect, useRef, useState } from 'react';
import pLimit from 'p-limit';
import isEqual from 'lodash/isEqual';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAllMssqlHostAssessmentData,
    addDatabaseHostsDataV2,
    addMultiMssqlDatabaseHostsDataV2,
    addMultiPgSqlDatabaseHostsData,
    addMultiOracleDatabaseHostsData,
    addPgSqlDatabaseHostsData,
    addOracleDatabaseHostsData,
    resetPerComboData,
    resetRefreshData,
    setAllMssqlHostAssessmentLoading,
    setCreateResourceApiLoading,
    setDashSandboxList,
    setDashSandboxListLoading,
    setDashSandboxSavings,
    setDashSandboxSavingsLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusLoading,
    setInventoryChartData,
    setInventoryTableData,
    setIsDatabaseHostsLoading,
    setIsDiscoverHostLoading,
    setIsDiscoverOracleHostLoading,
    setIsDiscoverPgsqlHostLoading,
    setIsDiscoveredHostData,
    setIsDiscoveredOracleHostData,
    setIsDiscoveredPgsqlHostData,
    setIsFullHostDataLoading,
    setIsFullPgSqlHostDataLoading,
    setIsFullOracleHostDataLoading,
    setIsManagedHostListLoading,
    setIsPgSqlDatabaseHostsLoading,
    setIsOracleDatabaseHostsLoading,
    setMssqlInstancesData,
    setPerfMssqlInstancesData,
    setPgsqlInstancesData,
    setOracleInstancesData,
    setPotentialSavingsHostData,
    setRemoveSecNodeDiscoveredList,
    setResetManagedData,
    setUnManagedPerfInstanceIdsList,
    resetManagedInventoryData
} from '../../store/workloadFactory/inventoryV2Slice';
import {
    useCreateDemoResourcesMutation,
    useGetMssqlInstanceDataV2Mutation,
    useGetPgsqlInstanceDataMutation,
    useGetOracleInstanceDataMutation,
    useGetStorageSavingsMutation,
    useLazyDiscoverHostsQuery,
    useLazyDiscoverOracleHostsQuery,
    useLazyDiscoverPgsqlHostsQuery,
    useLazyGetAllMssqlHostsAssessmentDataQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery,
    useLazyGetPgsqlDatabaseHostsFullDataV2Query,
    useLazyGetPgSqlDatabaseHostsListQuery,
    useLazyGetSandboxListQuery,
    useLazyGetSandboxSavingsQuery,
    useLazyGetOracleDatabaseHostsListQuery,
    useLazyGetOracleDatabaseHostsFullDataV2Query
} from '../../utils/apiService';
import {
    addInstanceIdToGetPerf,
    formatDiscoveredInventoryData,
    formatDiscoveredOracleInventoryData,
    formatDiscoveredPgsqlInventoryData,
    formatInventoryTableData,
    getExploreSavingsRows,
    getFsxIdsFromdiscover,
    getInventoryDataCount,
    getMhUnmanagedInstances,
    getPartnerInstanceId,
    getPrimaryClusterNode,
    getPrimaryPgsqlNode,
    getUnmanagedHostInstances,
    getUnmanagedPgsqlHostInstances,
    getUnmanagedOracleHostInstances,
    uniqueHostRow,
    updateInstancesApiResponse
} from './InventoryUtilsV2';
import { setUnmanagedExploreSavingsHost } from '../../store/workloadFactory/exploreSavingsSlice';
import store from '../../store/store';
import { EBS_PROTECTED_OPTIONS, INSTANCE_API_FIELDS, SNAPSHOT_FREQUENCY } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import {
    addInitialData,
    initialDBHomepageState,
    setPotentialSavingsValues
} from '../../store/workloadFactory/databaseHomeSlice';
import { checkIfEbsProtected } from '../ExploreSavings/SavingsCalculator/savingsUtil';
import { OracleInstanceData } from '../../utils/types/inventoryV2Types';

// Limit the number of concurrent API calls to avoid overloading the backend or hitting rate limits.
// storageSavingsApiLimit: Used specifically for storage savings API calls, allowing up to 10 concurrent requests.
// generalApiLimit: Used for general API calls (e.g., instance/resource data), allowing up to 5 concurrent requests.
const storageSavingsApiLimit = pLimit(10);
const generalApiLimit = pLimit(5);

const InventoryApisV3 = () => {
    const dispatch = useAppDispatch();
    const { databaseHostsData, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsData: pgsqlDatabaseHostsData, fullHostDataLoading: pgsqlFullHostDataLoading } = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts
    );
    const { databaseHostsData: oracleDatabaseHostsData, fullHostDataLoading: oracleFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getOracleDatabaseHosts);
    const {
        headerSelectedCred,
        headerSelectedRegion,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    } = useAppSelector(state => state.headers);
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const { discoveredOracleHostData } = useAppSelector(state => state.inventoryV2.discoveredOracleHosts);
    const { discoveredPgsqlHostData } = useAppSelector(state => state.inventoryV2.discoveredPgsqlHosts);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const fsxCredentialStatusObj = useAppSelector(state => state.inventoryV2.fsxCredentialStatusObj);
    const mssqlInstancesData = useAppSelector(state => state.inventoryV2.mssqlInstancesData);
    const pgsqlInstancesData = useAppSelector(state => state.inventoryV2.pgsqlInstancesData);
    const oracleInstancesData = useAppSelector(state => state.inventoryV2.oracleInstancesData);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const [runningInstanceList, setRunningInstanceList] = useState<Array<string>>([]);
    const [runningPgsqlInstanceList, setRunningPgsqlInstanceList] = useState<Array<string>>([]);
    const [runningOracleInstanceList, setRunningOracleInstanceList] = useState<Array<string>>([]);
    const [runningPerfInstanceList, setRunningPerfInstanceList] = useState<Array<string>>([]);
    const [runningManagedAssessmentList, setRunningManagedAssessmentList] = useState<Array<string>>([]);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const refreshBlocked = useAppSelector(state => state.auth?.refreshBlocked);
    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);
    const allmssqlHostAssessmentDataS = useAppSelector(state => state.inventoryV2.allmssqlHostAssessmentData);
    const perfMssqlInstancesData = useAppSelector(state => state.inventoryV2.perfMssqlInstancesData);
    const potentialSavingsHostData = useAppSelector(state => state.inventoryV2.potentialSavingsHostData);
    const { multiMssqlDatabaseHostsData, multiPgSqlDatabaseHostsData, multiOracleDatabaseHostsData } = useAppSelector(
        state => state.inventoryV2
    );
    const dashSandboxSavingsData = useAppSelector(state => state.inventoryV2.dashSandboxSavings.data);
    const dashSandboxListData = useAppSelector(state => state.inventoryV2.dashSandboxList.data);

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.data?.regionCode || '');
    const [partnerInstanceList, setPartnerInstanceList] = useState<any>([]);

    // getManagedHostList function values update
    const [getManagedHostListAPI] = useLazyGetManagedHostDataQuery();
    const [managedHostList, setManagedHostList] = useState<any>([]);
    const [managedHostListLoading, setManagedHostListLoading] = useState(true);

    // database-hosts without fields values
    const [getDatabaseHostsListApi] = useLazyGetDatabaseHostsListV2Query();
    const [topologyHostData, setTopologyHostData] = useState<any>({});

    // pgsql database-hosts without fields values
    const [getPgSqlDatabaseHostsListApi] = useLazyGetPgSqlDatabaseHostsListQuery();
    const [pgsqlTopologyHostData, setPgsqlTopologyHostData] = useState<any>({});

    // oracle database-hosts without fields values
    const [getOracleDatabaseHostsListApi] = useLazyGetOracleDatabaseHostsListQuery();
    const [oracleTopologyHostData, setOracleTopologyHostData] = useState<any>({});

    // database-hosts with fields values
    const [getDatabaseHostsFullDataApi] = useLazyGetDatabaseHostsFullDataV2Query();
    const [fullHostData, setFullHostData] = useState<any>({});

    // pgsql database-hosts with fields values
    const [getPgSqlDatabaseHostsFullDataApi] = useLazyGetPgsqlDatabaseHostsFullDataV2Query();
    const [fullPgsqlHostData, setFullPgsqlHostData] = useState<any>({});

    // oracle database-hosts with fields values
    const [getOracleDatabaseHostsFullDataApi] = useLazyGetOracleDatabaseHostsFullDataV2Query();
    const [fullOracleHostData, setFullOracleHostData] = useState<any>({});

    // Potential savings API for EBS and FSxW
    const [getStorageSavingsApi] = useGetStorageSavingsMutation();

    // Discover MSSQL API
    const [getDiscoveryHostsListApi] = useLazyDiscoverHostsQuery();

    // Discover oracle API
    const [getDiscoveryOracleHostsListApi] = useLazyDiscoverOracleHostsQuery();

    // Discover pgsql API
    const [getDiscoveryPgsqlHostsListApi] = useLazyDiscoverPgsqlHostsQuery();

    // Get fsx credentials status query.
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();

    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();
    const [getPgsqlInstanceDataApi] = useGetPgsqlInstanceDataMutation();
    const [getOracleInstanceDataApi] = useGetOracleInstanceDataMutation();

    // Get all managed hosts assessment data
    const [getAllMssqlHostAssessmentAPI] = useLazyGetAllMssqlHostsAssessmentDataQuery();
    const [allmssqlHostAssessmentData, setAllmssqlHostAssessmentData] = useState<any>([]);

    // Get all sandbox API data
    const [getSandboxListApi] = useLazyGetSandboxListQuery();
    const [getSandboxSavingsApi] = useLazyGetSandboxSavingsQuery();

    // create resource API call
    const [createDemoResourcesApi] = useCreateDemoResourcesMutation();

    const fsxCredentialStatusObjRef: any = useRef(null);
    const mssqlInstancesDataRef: any = useRef(null);
    const pgsqlInstancesDataRef: any = useRef(null);
    const oracleInstancesDataRef: any = useRef(null);
    const perfMssqlInstancesDataRef: any = useRef(null);
    const runningInstanceListRef: any = useRef(null);
    const runningPgsqlInstanceListRef: any = useRef(null);
    const runningOracleInstanceListRef: any = useRef(null);

    const runningPerfInstanceListRef: any = useRef(null);
    const runningManagedAssessmentRef: any = useRef(null);
    const potentialSavingsHostDataRef: any = useRef(null);
    const inventoryTableDataRef: any = useRef(null);
    const headerSelectedMultiCredIdsListRef: any = useRef(null);
    const headerSelectedMultiRegionIdsListRef: any = useRef(null);

    useEffect(() => {
        runningPerfInstanceListRef.current = runningPerfInstanceList;
    }, [runningPerfInstanceList]);

    useEffect(() => {
        runningManagedAssessmentRef.current = runningManagedAssessmentList;
    }, [runningManagedAssessmentList]);

    useEffect(() => {
        runningInstanceListRef.current = runningInstanceList;
    }, [runningInstanceList]);

    useEffect(() => {
        runningPgsqlInstanceListRef.current = runningPgsqlInstanceList;
    }, [runningPgsqlInstanceList]);

    useEffect(() => {
        runningOracleInstanceListRef.current = runningOracleInstanceList;
    }, [runningOracleInstanceList]);

    useEffect(() => {
        fsxCredentialStatusObjRef.current = fsxCredentialStatusObj;
    }, [fsxCredentialStatusObj]);

    useEffect(() => {
        mssqlInstancesDataRef.current = mssqlInstancesData;
    }, [mssqlInstancesData]);

    useEffect(() => {
        pgsqlInstancesDataRef.current = pgsqlInstancesData;
    }, [pgsqlInstancesData]);

    useEffect(() => {
        oracleInstancesDataRef.current = oracleInstancesData;
    }, [oracleInstancesData]);

    useEffect(() => {
        inventoryTableDataRef.current = inventoryTableData;
    }, [inventoryTableData]);

    useEffect(() => {
        perfMssqlInstancesDataRef.current = perfMssqlInstancesData;
    }, [perfMssqlInstancesData]);

    useEffect(() => {
        potentialSavingsHostDataRef.current = potentialSavingsHostData;
    }, [potentialSavingsHostData]);

    useEffect(() => {
        headerSelectedMultiCredIdsListRef.current = headerSelectedMultiCredIdsList;
    }, [headerSelectedMultiCredIdsList]);

    useEffect(() => {
        headerSelectedMultiRegionIdsListRef.current = headerSelectedMultiRegionIdsList;
    }, [headerSelectedMultiRegionIdsList]);

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
    const getFsxCredentialStatusList = async (
        fsxIdsList: Array<string>,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getFsxCredentialStatusListApi({
                    credentialsId: credId,
                    regionId,
                    fsxIds: fsxIdsList.join(',')
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setFsxCredentialStatusLoading(false));
                    if (result && !result?.error) {
                        if (result?.data?.fileSystems) {
                            const fsxCredStatusObj: any = {};
                            result?.data?.fileSystems?.map((item: any) => {
                                fsxCredStatusObj[item.id] = item.isRegistered;
                            });
                            if (fsxCredentialStatusObjRef.current) {
                                dispatch(
                                    setFsxCredentialStatus({
                                        ...fsxCredentialStatusObjRef.current,
                                        ...fsxCredStatusObj
                                    })
                                );
                            } else {
                                dispatch(setFsxCredentialStatus(fsxCredStatusObj));
                            }
                        }
                    }
                }
            } catch (error) {}
        }
    };

    const callResourceAPIIfDemo = async (
        managedList: string[],
        managedHostCursor: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (isDemoMode) {
            try {
                const result: any = await createDemoResourcesApi({
                    credentialsId: runningCredId,
                    regionId: runningRegionId
                });
                if (result) {
                    getManagedHostList(managedList, managedHostCursor, runningCredId, runningRegionId);
                    dispatch(setCreateResourceApiLoading(false));
                }
            } catch (error) {
                getManagedHostList(managedList, managedHostCursor, runningCredId, runningRegionId);
                dispatch(setCreateResourceApiLoading(false));
            }
        } else {
            dispatch(setCreateResourceApiLoading(false));
            getManagedHostList(managedList, managedHostCursor, runningCredId, runningRegionId);
        }
    };

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
    const getManagedHostList = async (
        managedList: string[],
        managedHostCursor: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getManagedHostListAPI({
                    credentialId: credId,
                    regionId,
                    nextToken: managedHostCursor
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
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
                            setManagedHostListLoading(false);
                            dispatch(setIsManagedHostListLoading(false));
                            setManagedHostList(managedList);
                            callManagedHostAllAPis(managedList);
                        }
                    } else {
                        setManagedHostListLoading(false);
                        dispatch(setIsManagedHostListLoading(false));
                        setManagedHostList(managedList);
                    }
                }
            } catch (error) {
                setManagedHostListLoading(false);
                dispatch(setIsManagedHostListLoading(false));
                setManagedHostList(managedList);
            }
        }
    };

    const callManagedHostAllAPis = (managedList: any) => {
        const discoveredRows: any = [];
        const discoveredOracleRows: any = [];
        const discoveredPgsqlRows: any = [];
        getDiscoveryHostsList(discoveredRows, null, credId, regionId);
        getDiscoveryOracleHostsList(discoveredOracleRows, null, credId, regionId);
        getDiscoveryPgsqlHostsList(discoveredPgsqlRows, null, credId, regionId);
        if (managedList?.length > 0) {
            const fullHostData: any = {};
            const fullPgsqlHostData: any = {};
            const fullOracleHostData: any = {};
            const topologyHostData: any = {};
            const pgsqlTopologyHostData: any = {};
            const oracleTopologyHostData: any = {};
            const assessmentData: any = [];
            const sandboxListData: any = [];
            const sandboxSavingsData: any = [];
            getDatabaseHostsList(topologyHostData, null, credId, regionId);
            getPgSqlDatabaseHostsList(pgsqlTopologyHostData, null, credId, regionId);
            getOracleDatabaseHostsList(oracleTopologyHostData, null, credId, regionId);
            getDatabaseHostsFullData(fullHostData, null, credId, regionId);
            getPgsqlDatabaseHostsFullData(fullPgsqlHostData, null, credId, regionId);
            getOracleDatabaseHostsFullData(fullOracleHostData, null, credId, regionId);
            getAllMssqlHostAssessmentData(assessmentData, null, credId, regionId);
            // sandbox APIs
            getAllSandboxListData(sandboxListData, null, credId, regionId);
            getAllSandboxSavingsData(sandboxSavingsData, credId, regionId);
        } else {
            dispatch(resetManagedInventoryData());
        }
    };

    // This function is to get basic managed rows info. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsList = async (
        managedList: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDatabaseHostsListApi({
                    credentialId: credId,
                    regionId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setTopologyHostData(managedList);
                            getDatabaseHostsList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            dispatch(setIsDatabaseHostsLoading(false));
                            setTopologyHostData(managedList);
                        }
                    } else {
                        dispatch(setIsDatabaseHostsLoading(false));
                        setTopologyHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsDatabaseHostsLoading(false));
                setTopologyHostData(managedList);
            }
        }
    };

    // This function is to get basic managed rows info for pgsql. This output is used only in dashboard page as of now.
    const getPgSqlDatabaseHostsList = async (
        managedList: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getPgSqlDatabaseHostsListApi({
                    credentialId: credId,
                    regionId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setPgsqlTopologyHostData(managedList);
                            getPgSqlDatabaseHostsList(
                                managedList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsPgSqlDatabaseHostsLoading(false));
                            setPgsqlTopologyHostData(managedList);
                        }
                    } else {
                        dispatch(setIsPgSqlDatabaseHostsLoading(false));
                        setPgsqlTopologyHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsPgSqlDatabaseHostsLoading(false));
                setPgsqlTopologyHostData(managedList);
            }
        }
    };

    // This function is to get basic managed rows info for oracle. This output is used only in dashboard page as of now.
    const getOracleDatabaseHostsList = async (
        managedList: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getOracleDatabaseHostsListApi({
                    credentialId: credId,
                    regionId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setOracleTopologyHostData(managedList);
                            getOracleDatabaseHostsList(
                                managedList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsOracleDatabaseHostsLoading(false));
                            setOracleTopologyHostData(managedList);
                        }
                    } else {
                        dispatch(setIsOracleDatabaseHostsLoading(false));
                        setOracleTopologyHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsOracleDatabaseHostsLoading(false));
                setOracleTopologyHostData(managedList);
            }
        }
    };

    // This function is to get all managed rows data. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsFullData = async (
        managedList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId,
                    nextToken,
                    isDemoMode
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setFullHostData(managedList);
                            getDatabaseHostsFullData(
                                managedList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsFullHostDataLoading(false));
                            setFullHostData(managedList);
                        }
                    } else {
                        dispatch(setIsFullHostDataLoading(false));
                        setFullHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsFullHostDataLoading(false));
                setFullHostData(managedList);
            }
        }
    };

    // This function is to get all managed rows data for pgsql. This output is used both in managed tab and dashboard page.
    const getPgsqlDatabaseHostsFullData = async (
        managedList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getPgSqlDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId,
                    nextToken,
                    isDemoMode
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setFullPgsqlHostData(managedList);
                            getPgsqlDatabaseHostsFullData(
                                managedList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsFullPgSqlHostDataLoading(false));
                            setFullPgsqlHostData(managedList);
                        }
                    } else {
                        dispatch(setIsFullPgSqlHostDataLoading(false));
                        setFullPgsqlHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsFullPgSqlHostDataLoading(false));
                setFullPgsqlHostData(managedList);
            }
        }
    };

    // This function is to get all managed rows data for oracle. This output is used both in managed tab and dashboard page.
    const getOracleDatabaseHostsFullData = async (
        managedList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getOracleDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId,
                    nextToken,
                    isDemoMode
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [uniqueHostRow(perRow?.id, credId, regionId)]: perRow };
                            }
                        });
                        if (result?.data?.nextToken) {
                            setFullOracleHostData(managedList);
                            getOracleDatabaseHostsFullData(
                                managedList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsFullOracleHostDataLoading(false));
                            setFullOracleHostData(managedList);
                        }
                    } else {
                        dispatch(setIsFullOracleHostDataLoading(false));
                        setFullOracleHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsFullOracleHostDataLoading(false));
                setFullOracleHostData(managedList);
            }
        }
    };

    // This function is to get discovery API data for mssql.
    const getDiscoveryHostsList = async (
        discoveredList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDiscoveryHostsListApi({
                    regionId,
                    credentialsId: credId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
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
                                        regionId
                                    }
                                ];
                                // discoveredList.push(perRow);
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
                            dispatch(setIsDiscoverHostLoading(false));
                            dispatch(setIsDiscoveredHostData(discoveredList));
                        }
                    } else {
                        dispatch(setIsDiscoverHostLoading(false));
                        dispatch(setIsDiscoveredHostData(discoveredList));
                    }
                }
            } catch (error) {
                dispatch(setIsDiscoverHostLoading(false));
                dispatch(setIsDiscoveredHostData(discoveredList));
            }
        }
    };

    // This function is to get oracle discovery API data.
    const getDiscoveryOracleHostsList = async (
        discoveredOracleList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDiscoveryOracleHostsListApi({
                    regionId,
                    credentialsId: credId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.ec2InstanceId) {
                                discoveredOracleList = [
                                    ...discoveredOracleList,
                                    {
                                        ...perRow,
                                        hostType: GENERAL.ORACLE_TYPE,
                                        credentialId: credId,
                                        regionId
                                    }
                                ];
                            }
                        });
                        if (result?.data?.nextToken) {
                            dispatch(setIsDiscoveredOracleHostData(discoveredOracleList));
                            getDiscoveryOracleHostsList(
                                discoveredOracleList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsDiscoverOracleHostLoading(false));
                            dispatch(setIsDiscoveredOracleHostData(discoveredOracleList));
                        }
                    } else {
                        dispatch(setIsDiscoverOracleHostLoading(false));
                        dispatch(setIsDiscoveredOracleHostData(discoveredOracleList));
                    }
                }
            } catch (error) {
                dispatch(setIsDiscoverOracleHostLoading(false));
                dispatch(setIsDiscoveredOracleHostData(discoveredOracleList));
            }
        }
    };

    // This function is to get pgsql discovery API data.
    const getDiscoveryPgsqlHostsList = async (
        discoveredPgsqlList: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getDiscoveryPgsqlHostsListApi({
                    regionId,
                    credentialsId: credId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.forEach((perRow: any) => {
                            if (perRow?.ec2InstanceId) {
                                discoveredPgsqlList = [
                                    ...discoveredPgsqlList,
                                    {
                                        ...perRow,
                                        hostType: GENERAL.POSTGRESQL_TYPE,
                                        credentialId: credId,
                                        regionId
                                    }
                                ];
                            }
                        });
                        if (result?.data?.nextToken) {
                            dispatch(setIsDiscoveredPgsqlHostData(discoveredPgsqlList));
                            getDiscoveryPgsqlHostsList(
                                discoveredPgsqlList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsDiscoverPgsqlHostLoading(false));
                            dispatch(setIsDiscoveredPgsqlHostData(discoveredPgsqlList));
                        }
                    } else {
                        dispatch(setIsDiscoverPgsqlHostLoading(false));
                        dispatch(setIsDiscoveredPgsqlHostData(discoveredPgsqlList));
                    }
                }
            } catch (error) {
                dispatch(setIsDiscoverPgsqlHostLoading(false));
                dispatch(setIsDiscoveredPgsqlHostData(discoveredPgsqlList));
            }
        }
    };

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async (
        instanceIdComb: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        const [instanceId, instanceCredId, instanceRegionId] = instanceIdComb.split('_');
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: instanceCredId,
                regionId: instanceRegionId,
                instances: instanceId,
                fields: fields.join(','),
                nextToken
            });
            if (result && !result?.error) {
                const mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    const partnerInstanceId = getPartnerInstanceId(host, host?.id);
                    if (
                        partnerInstanceId &&
                        !runningInstanceListRef.current.includes(
                            uniqueHostRow(partnerInstanceId, instanceCredId, instanceRegionId)
                        ) &&
                        !mssqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]
                            ?.isManagedHost &&
                        !partnerInstanceList.includes(
                            uniqueHostRow(partnerInstanceId, instanceCredId, instanceRegionId)
                        )
                    ) {
                        setPartnerInstanceList([
                            ...partnerInstanceList,
                            ...[uniqueHostRow(partnerInstanceId, instanceCredId, instanceRegionId)]
                        ]);
                    }

                    const state = store.getState();
                    const unManagedPerfInstanceIdsListData = state.inventoryV2.unManagedPerfInstanceIdsList;
                    if (
                        partnerInstanceId &&
                        unManagedPerfInstanceIdsListData.includes(
                            uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                        ) &&
                        !unManagedPerfInstanceIdsListData.includes(
                            uniqueHostRow(partnerInstanceId, instanceCredId, instanceRegionId)
                        )
                    ) {
                        dispatch(
                            setUnManagedPerfInstanceIdsList([
                                ...unManagedPerfInstanceIdsListData,
                                ...[uniqueHostRow(partnerInstanceId, instanceCredId, instanceRegionId)]
                            ])
                        );
                    }

                    if (mssqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]) {
                        mssqlInstancesDataRes[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)] = {
                            isManagedHost:
                                mssqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]
                                    ?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: mssqlInstancesDataRef.current[
                                uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                            ]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]) {
                    mssqlInstancesDataRes[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                        isManagedHost:
                            mssqlInstancesDataRef.current[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]
                                ?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: mssqlInstancesDataRef.current[
                            uniqueHostRow(instanceId, instanceCredId, instanceRegionId)
                        ]?.fields
                    };
                }
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
            } else {
                const mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                    isManagedHost,
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    fields
                };
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            const mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                isManagedHost,
                loading: false,
                data: null,
                error,
                fields
            };
            dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
        }
    };

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance for pgsql
    const getPgsqlData = async (
        instanceIdComb: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        const [instanceId, instanceCredId, instanceRegionId] = instanceIdComb.split('_');
        try {
            const result: any = await getPgsqlInstanceDataApi({
                credentialId: instanceCredId,
                regionId: instanceRegionId,
                instances: instanceId,
                fields: fields.join(','),
                nextToken
            });
            if (result && !result?.error) {
                const pgsqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (pgsqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]) {
                        pgsqlInstancesDataRes[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)] = {
                            isManagedHost:
                                pgsqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]
                                    ?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: pgsqlInstancesDataRef.current[
                                uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                            ]?.fields
                        };
                    }
                });
                if (!pgsqlInstancesDataRes?.[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]) {
                    pgsqlInstancesDataRes[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                        isManagedHost:
                            pgsqlInstancesDataRef.current[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]
                                ?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: pgsqlInstancesDataRef.current[
                            uniqueHostRow(instanceId, instanceCredId, instanceRegionId)
                        ]?.fields
                    };
                }
                dispatch(setPgsqlInstancesData({ ...pgsqlInstancesDataRef.current, ...pgsqlInstancesDataRes }));
            } else {
                const pgsqlInstancesDataErr: any = {};
                pgsqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                    isManagedHost,
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    fields
                };
                dispatch(setPgsqlInstancesData({ ...pgsqlInstancesDataRef.current, ...pgsqlInstancesDataErr }));
            }
        } catch (error) {
            const pgsqlInstancesDataErr: any = {};
            pgsqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                isManagedHost,
                loading: false,
                data: null,
                error,
                fields
            };
            dispatch(setPgsqlInstancesData({ ...pgsqlInstancesDataRef.current, ...pgsqlInstancesDataErr }));
        }
    };

    // This function is to call API2 that will return unmanaged oracle per instance full data like SS, cost, protection, performance.
    const getOracleData = async (
        instanceIdComb: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        const [instanceId, instanceCredId, instanceRegionId] = instanceIdComb.split('_');
        try {
            const result: any = await getOracleInstanceDataApi({
                credentialId: instanceCredId,
                regionId: instanceRegionId,
                instances: instanceId,
                fields: fields.join(','),
                nextToken
            });
            if (result && !result?.error) {
                const oracleInstancesDataRes: Record<string, OracleInstanceData> = {};
                result?.data?.items?.forEach((host: any) => {
                    if (oracleInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]) {
                        oracleInstancesDataRes[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)] = {
                            isManagedHost:
                                oracleInstancesDataRef.current[
                                    uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                                ]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: oracleInstancesDataRef.current[
                                uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                            ]?.fields
                        };
                    }
                });
                if (!oracleInstancesDataRes?.[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]) {
                    oracleInstancesDataRes[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                        isManagedHost:
                            oracleInstancesDataRef.current[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]
                                ?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: oracleInstancesDataRef.current[
                            uniqueHostRow(instanceId, instanceCredId, instanceRegionId)
                        ]?.fields
                    };
                }
                dispatch(setOracleInstancesData({ ...oracleInstancesDataRef.current, ...oracleInstancesDataRes }));
            } else {
                const oracleInstancesDataErr: any = {};
                oracleInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                    isManagedHost,
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    fields
                };
                dispatch(setOracleInstancesData({ ...oracleInstancesDataRef.current, ...oracleInstancesDataErr }));
            }
        } catch (error) {
            const oracleInstancesDataErr: any = {};
            oracleInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                isManagedHost,
                loading: false,
                data: null,
                error,
                fields
            };
            dispatch(setOracleInstancesData({ ...oracleInstancesDataRef.current, ...oracleInstancesDataErr }));
        }
    };

    const callInstanceApi = (instancesList: Array<string>, isManagedHost: boolean, fields: Array<string>) => {
        const mssqlInstancesDataLoad: any = {};
        const noRunningList: Array<string> = [];
        if (instancesList && instancesList.length > 0) {
            instancesList?.forEach((ec2InstanceIdComb: any) => {
                if (
                    runningInstanceListRef.current.includes(ec2InstanceIdComb) ||
                    mssqlInstancesDataRef.current?.[ec2InstanceIdComb]
                ) {
                    return;
                }
                mssqlInstancesDataLoad[ec2InstanceIdComb] = {
                    isManagedHost,
                    loading: true,
                    data: null,
                    error: null,
                    fields
                };
                noRunningList.push(ec2InstanceIdComb);
            });
            dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataLoad }));
            setRunningInstanceList([...runningInstanceListRef.current, ...noRunningList]);
            // generalApiLimit is used to limit the number of concurrent API calls. As of now Limited to 5 concurrent calls.
            // This is used to avoid throttling error from API.
            Promise.all(
                noRunningList.map((ec2InstanceIdComb: any) =>
                    generalApiLimit(() => getMssqlData(ec2InstanceIdComb, isManagedHost, fields))
                )
            );
        }
    };

    // If any new row added than it will trigger getMssqlData (API2) function to get unmanagaed row data.
    const callPgsqlResourceApi = (instancesList: Array<string>, isManagedHost: boolean, fields: Array<string>) => {
        const pgsqlInstancesDataLoad: any = {};
        const noRunningList: Array<string> = [];
        if (instancesList && instancesList.length > 0) {
            instancesList.forEach((ec2InstanceIdComb: any) => {
                if (runningPgsqlInstanceListRef.current.includes(ec2InstanceIdComb)) {
                    return;
                }
                pgsqlInstancesDataLoad[ec2InstanceIdComb] = {
                    isManagedHost,
                    loading: true,
                    data: null,
                    error: null,
                    fields
                };
                noRunningList.push(ec2InstanceIdComb);
            });
            dispatch(setPgsqlInstancesData({ ...pgsqlInstancesDataRef.current, ...pgsqlInstancesDataLoad }));
            setRunningPgsqlInstanceList([...runningPgsqlInstanceListRef.current, ...noRunningList]);
            // generalApiLimit is used to limit the number of concurrent API calls. As of now Limited to 5 concurrent calls.
            // This is used to avoid throttling error from API.
            Promise.all(
                noRunningList.map((ec2InstanceIdComb: any) =>
                    generalApiLimit(() => getPgsqlData(ec2InstanceIdComb, isManagedHost, fields))
                )
            );
        }
    };

    const callOracleResourceApi = (instancesList: Array<string>, isManagedHost: boolean, fields: Array<string>) => {
        const oracleInstancesDataLoad: Record<string, OracleInstanceData> = {};
        const noRunningList: Array<string> = [];
        if (instancesList && instancesList.length > 0) {
            instancesList.forEach((ec2InstanceIdComb: any) => {
                if (runningOracleInstanceListRef.current.includes(ec2InstanceIdComb)) {
                    return;
                }
                oracleInstancesDataLoad[ec2InstanceIdComb] = {
                    isManagedHost,
                    loading: true,
                    data: null,
                    error: null,
                    fields
                };
                noRunningList.push(ec2InstanceIdComb);
            });
            dispatch(setOracleInstancesData({ ...oracleInstancesDataRef.current, ...oracleInstancesDataLoad }));
            setRunningOracleInstanceList([...runningOracleInstanceListRef.current, ...noRunningList]);
            // generalApiLimit is used to limit the number of concurrent API calls. As of now Limited to 5 concurrent calls.
            // This is used to avoid throttling error from API.
            Promise.all(
                noRunningList.map((ec2InstanceIdComb: any) =>
                    generalApiLimit(() => getOracleData(ec2InstanceIdComb, isManagedHost, fields))
                )
            );
        }
    };

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getUnmanagedPerfMssqlData = async (
        instanceIdComb: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        const [instanceId, instanceCredId, instanceRegionId] = instanceIdComb.split('_');
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: instanceCredId,
                regionId: instanceRegionId,
                instances: instanceId,
                fields: fields.join(','),
                nextToken
            });
            if (result && !result?.error) {
                const mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (perfMssqlInstancesDataRef.current[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)]) {
                        mssqlInstancesDataRes[uniqueHostRow(host?.id, instanceCredId, instanceRegionId)] = {
                            isManagedHost:
                                perfMssqlInstancesDataRef.current[
                                    uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                                ]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: perfMssqlInstancesDataRef.current[
                                uniqueHostRow(host?.id, instanceCredId, instanceRegionId)
                            ]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)]) {
                    mssqlInstancesDataRes[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                        isManagedHost:
                            perfMssqlInstancesDataRef.current[
                                uniqueHostRow(instanceId, instanceCredId, instanceRegionId)
                            ]?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: perfMssqlInstancesDataRef.current[
                            uniqueHostRow(instanceId, instanceCredId, instanceRegionId)
                        ]?.fields
                    };
                }
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
            } else {
                const mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                    isManagedHost,
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    fields
                };
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            const mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[uniqueHostRow(instanceId, instanceCredId, instanceRegionId)] = {
                isManagedHost,
                loading: false,
                data: null,
                error,
                fields
            };
            dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
        }
    };

    const getAllMssqlHostAssessmentData = async (
        assessmentData: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getAllMssqlHostAssessmentAPI({
                    credentialId: credId,
                    regionId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        assessmentData = [
                            // ...assessmentData,
                            ...(Array.isArray(result?.data?.assessmentsPerAccount)
                                ? result.data.assessmentsPerAccount.map((assessment: any) => ({
                                      ...assessment,
                                      credentialId: credId,
                                      regionId
                                  }))
                                : [])
                        ];
                        if (result?.data?.nextToken) {
                            setAllmssqlHostAssessmentData(assessmentData);
                            getAllMssqlHostAssessmentData(
                                assessmentData,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setAllMssqlHostAssessmentLoading(false));
                            setAllmssqlHostAssessmentData(assessmentData);
                        }
                    } else {
                        dispatch(setAllMssqlHostAssessmentLoading(false));
                        setAllmssqlHostAssessmentData(assessmentData);
                    }
                }
            } catch (error) {
                dispatch(setAllMssqlHostAssessmentLoading(false));
                setAllmssqlHostAssessmentData(assessmentData);
            }
        }
    };

    const getAllSandboxListData = async (
        sandboxListData: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getSandboxListApi({
                    credentialId: credId,
                    region: regionId,
                    nextToken
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        sandboxListData = [
                            ...sandboxListData,
                            ...(Array.isArray(result?.data?.items)
                                ? result.data.items.map((sandbox: any) => ({
                                      ...sandbox,
                                      credentialId: credId,
                                      regionId
                                  }))
                                : [])
                        ];
                        if (result?.data?.nextToken) {
                            dispatch(
                                setDashSandboxList({
                                    data: [...dashSandboxListData, ...sandboxListData],
                                    loading: true
                                })
                            );
                            getAllSandboxListData(
                                sandboxListData,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(
                                setDashSandboxList({
                                    data: [...dashSandboxListData, ...sandboxListData],
                                    loading: false
                                })
                            );
                        }
                    } else {
                        dispatch(
                            setDashSandboxList({
                                data: [...dashSandboxListData, ...sandboxListData],
                                loading: false
                            })
                        );
                    }
                }
            } catch (error) {
                dispatch(
                    setDashSandboxList({
                        data: [...dashSandboxListData, ...sandboxListData],
                        loading: false
                    })
                );
            }
        }
    };

    const getAllSandboxSavingsData = async (
        sandboxSavingsData: any,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
            headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
        ) {
            try {
                const result: any = await getSandboxSavingsApi({
                    credentialId: credId,
                    region: regionId
                });
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        const perSandboxAPI = {
                            ...result?.data,
                            credentialId: credId,
                            regionId
                        };
                        sandboxSavingsData = [...sandboxSavingsData, perSandboxAPI];
                        dispatch(
                            setDashSandboxSavings({
                                data: [...dashSandboxSavingsData, ...sandboxSavingsData],
                                loading: false
                            })
                        );
                    } else {
                        dispatch(
                            setDashSandboxSavings({
                                data: [...dashSandboxSavingsData, ...sandboxSavingsData],
                                loading: false
                            })
                        );
                    }
                }
            } catch (error) {
                dispatch(
                    setDashSandboxSavings({
                        data: [...dashSandboxSavingsData, ...sandboxSavingsData],
                        loading: false
                    })
                );
            }
        }
    };

    // This is to call instance API to get perf and protection data
    const callUnmanagedPerfInstanceApi = (
        instancesListComb: Array<string>,
        isManagedHost: boolean,
        fields: Array<string>
    ) => {
        const mssqlInstancesDataLoad: any = {};
        const noRunningList: Array<string> = [];
        if (instancesListComb && instancesListComb.length > 0) {
            instancesListComb.forEach((ec2InstanceIdComb: any) => {
                if (
                    runningPerfInstanceListRef.current.includes(ec2InstanceIdComb) ||
                    perfMssqlInstancesDataRef.current?.[ec2InstanceIdComb]
                ) {
                    return;
                }
                mssqlInstancesDataLoad[ec2InstanceIdComb] = {
                    isManagedHost,
                    loading: true,
                    data: null,
                    error: null,
                    fields
                };
                noRunningList.push(ec2InstanceIdComb);
            });
            dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataLoad }));
            setRunningPerfInstanceList([...runningPerfInstanceListRef.current, ...noRunningList]);
            // generalApiLimit is used to limit the number of concurrent API calls. As of now Limited to 5 concurrent calls.
            // This is used to avoid throttling error from API.
            Promise.all(
                noRunningList.map((ec2InstanceIdComb: any) =>
                    generalApiLimit(() => getUnmanagedPerfMssqlData(ec2InstanceIdComb, isManagedHost, fields))
                )
            );
        }
    };

    const getStorageSavingsData = async (
        savingsCalculatorType: string,
        selectedInstanceId: string,
        runningCredId: string,
        runningRegionId: string,
        isEbsProtected: string
    ) => {
        let snapshotFrequency = '';
        if (savingsCalculatorType === GENERAL.FSX_FOR_WINDOWS) {
            // For FSXW it is default set to Daily
            snapshotFrequency = SNAPSHOT_FREQUENCY[2]?.value;
        } else if (savingsCalculatorType === GENERAL.EBS) {
            // For EBS snapshotfrequency set is based on whether EBS is protected or not
            if (isEbsProtected === EBS_PROTECTED_OPTIONS.PROTECTED) {
                snapshotFrequency = SNAPSHOT_FREQUENCY[2]?.value;
            } else if (isEbsProtected === EBS_PROTECTED_OPTIONS.UNPROTECTED) {
                snapshotFrequency = SNAPSHOT_FREQUENCY[0]?.value;
            } else if (isEbsProtected === EBS_PROTECTED_OPTIONS.UNKNOWN) {
                snapshotFrequency = SNAPSHOT_FREQUENCY[1]?.value;
            } else {
                snapshotFrequency = SNAPSHOT_FREQUENCY[0]?.value;
            }
        }
        let payload: any = {
            snapshotFrequency,
            clonedCopiesCount: 1, // clonedCopiesCount default to 1 for dashboard potential
            monthlyChangeRatePercentage: savingsCalculatorType === GENERAL.FSX_FOR_WINDOWS ? 3 : 8 // monthlyChangeRatePercentage default to 3 for FSxW and 8 for EBS
        };
        if (savingsCalculatorType === GENERAL.EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: 'Daily' // cloneRefreshFrequency default to Daily for dashboard potential EBS
            };
        }
        const instanceData: any = {};
        try {
            const result: any = await getStorageSavingsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.data?.regionCode,
                instanceId: selectedInstanceId,
                payload,
                type: savingsCalculatorType === GENERAL.EBS ? 'ebs' : 'fsxw'
            });
            if (
                headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
            ) {
                if (result && !result?.error) {
                    instanceData[uniqueHostRow(selectedInstanceId, credId, regionId)] = {
                        error: null,
                        data: result?.data,
                        loading: false,
                        storageType: savingsCalculatorType
                    };
                    // Potential savings data is stored in inventoryV2 slice and
                    // it will be used in DatabaseHomeApis to format data for dashboard potential card UI.
                    dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
                } else {
                    instanceData[uniqueHostRow(selectedInstanceId, credId, regionId)] = {
                        error: result?.error?.data?.message,
                        data: null,
                        loading: false,
                        storageType: savingsCalculatorType
                    };
                    dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
                }
            }
        } catch (error) {
            instanceData[uniqueHostRow(selectedInstanceId, credId, regionId)] = {
                error,
                data: null,
                loading: false,
                storageType: savingsCalculatorType
            };
            dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
        }
    };

    const callPotentialSavings = async (exploreSavingsRows: any, runningCredId: string, runningRegionId: string) => {
        const instanceData: any = {};
        const promises: Promise<void>[] = [];

        exploreSavingsRows?.forEach((row: any) => {
            const { credentialId, regionId: rowRegionId, storageType, id, isDetected } = row;

            if (credentialId !== runningCredId || rowRegionId !== runningRegionId) {
                return;
            }
            if (
                storageType &&
                !potentialSavingsHostDataRef.current?.[uniqueHostRow(id, credId, rowRegionId)] &&
                isDetected
            ) {
                if (
                    headerSelectedMultiCredIdsListRef.current.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsListRef.current.includes(runningRegionId)
                ) {
                    let isEbsProtected = null;
                    if (storageType === GENERAL.EBS) {
                        isEbsProtected = checkIfEbsProtected(row, null);
                    }
                    instanceData[uniqueHostRow(id, credId, rowRegionId)] = {
                        error: null,
                        data: null,
                        loading: true,
                        storageType,
                        isProtected: isEbsProtected
                    };
                    dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));

                    // storageSavingsApiLimit is used to limit the number of API calls to storage savings API. Limited to 10 For now.
                    // This is to avoid hitting the API limit for storage savings API.
                    if (storageType === GENERAL.EBS) {
                        if (isEbsProtected) {
                            promises.push(
                                storageSavingsApiLimit(() =>
                                    getStorageSavingsData(
                                        storageType,
                                        id,
                                        runningCredId,
                                        runningRegionId,
                                        isEbsProtected
                                    )
                                )
                            );
                        } else {
                            addInstanceIdToGetPerf(row, dispatch);
                        }
                    } else if (storageType === GENERAL.FSX_FOR_WINDOWS) {
                        promises.push(
                            storageSavingsApiLimit(() =>
                                getStorageSavingsData(storageType, id, runningCredId, runningRegionId, '')
                            )
                        );
                    }
                }
            } else if (
                storageType === GENERAL.EBS &&
                potentialSavingsHostDataRef.current?.[uniqueHostRow(id, credId, rowRegionId)]?.loading &&
                !potentialSavingsHostDataRef.current?.[uniqueHostRow(id, credId, rowRegionId)]?.isProtected
            ) {
                const isEbsProtected = checkIfEbsProtected(row, null);
                instanceData[uniqueHostRow(id, credId, rowRegionId)] = {
                    error: null,
                    data: null,
                    loading: true,
                    storageType,
                    isProtected: isEbsProtected
                };
                dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
                if (isEbsProtected) {
                    promises.push(
                        storageSavingsApiLimit(() =>
                            getStorageSavingsData(storageType, id, runningCredId, runningRegionId, isEbsProtected)
                        )
                    );
                }
            }
        });

        await Promise.all(promises);
    };

    useEffect(() => {
        // if partner instance ID
        if (partnerInstanceList?.length > 0) {
            callInstanceApi(partnerInstanceList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
        }
    }, [partnerInstanceList]);

    useEffect(() => {
        // this updates the perfMssqlInstancesData with instance api
        // if partner instance ID
        if (unManagedPerfInstanceIdsList?.length) {
            callUnmanagedPerfInstanceApi(unManagedPerfInstanceIdsList, false, INSTANCE_API_FIELDS.SUB_TABLE_FIELDS);
        }
    }, [unManagedPerfInstanceIdsList]);

    const resetPerComboValues = () => {
        dispatch(resetPerComboData(null));
        // reset for getManagedHostList
        setManagedHostList([]);
        setManagedHostListLoading(true);
        // reset for getDatabaseHostsList
        setTopologyHostData({});
        setPgsqlTopologyHostData({});
        setOracleTopologyHostData({});
        // reset for getDatabaseHostsFullData
        setFullHostData({});
        setFullPgsqlHostData({});
        setFullOracleHostData({});
        // reset for discovery
        // Instances API reset
        // Running instanceList reset
        setRunningInstanceList([]);
        // chart counts
        // reset partner list in FCI and AOAG
        setRunningPerfInstanceList([]);
        setRunningManagedAssessmentList([]);
        setAllmssqlHostAssessmentData([]);
    };

    const resetFullData = () => {
        resetPerComboValues();
        dispatch(resetRefreshData(null));
        // Explore savings data
        dispatch(setUnmanagedExploreSavingsHost([]));
        dispatch(setPotentialSavingsValues(null));
        dispatch(addInitialData(initialDBHomepageState));

        // Partner instance list reset
        setPartnerInstanceList([]);
    };

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked && !isRefreshed) {
            const managedList: string[] = [];
            if (credId && regionId) {
                resetPerComboValues();
                // resetFullData(); // For now will reset all data on change of cred and region.
                setTimeout(() => {
                    callResourceAPIIfDemo(managedList, null, credId, regionId);
                }, 10);
            }
        }
    }, [credId, regionId, refreshBlocked, isRefreshed]);

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked && isRefreshed) {
            resetFullData();
        }
    }, [isRefreshed, refreshBlocked]);

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.data?.regionCode);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object.
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData) {
            let databaseHostDataObj: any = {};
            Object.keys(topologyHostData).map((key: string) => {
                // let uniqueKey = uniqueHostRow(key, credId, regionId);
                if (key in fullHostData) {
                    const perObj = {
                        ...topologyHostData[key],
                        ...fullHostData[key],
                        loading: false,
                        databaseHostStatus: topologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE } }
                    };
                } else {
                    const perObj = { ...topologyHostData[key], loading: !!fullHostDataLoading };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE } }
                    };
                }
            });
            dispatch(addDatabaseHostsDataV2(databaseHostDataObj));
            dispatch(addMultiMssqlDatabaseHostsDataV2({ ...multiMssqlDatabaseHostsData, ...databaseHostDataObj }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullHostData, topologyHostData, fullHostDataLoading]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object for pgsql.
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData) {
            let databaseHostDataObj: any = {};
            Object.keys(pgsqlTopologyHostData).map((key: string) => {
                // let uniqueKey = uniqueHostRow(key, credId, regionId);
                if (key in fullPgsqlHostData) {
                    const perObj = {
                        ...pgsqlTopologyHostData[key],
                        ...fullPgsqlHostData[key],
                        loading: false,
                        databaseHostStatus: pgsqlTopologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.POSTGRESQL_TYPE } }
                    };
                } else {
                    const perObj = { ...pgsqlTopologyHostData[key], loading: !!pgsqlFullHostDataLoading };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.POSTGRESQL_TYPE } }
                    };
                }
            });
            dispatch(addPgSqlDatabaseHostsData(databaseHostDataObj));
            dispatch(addMultiPgSqlDatabaseHostsData({ ...multiPgSqlDatabaseHostsData, ...databaseHostDataObj }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPgsqlHostData, pgsqlTopologyHostData, pgsqlFullHostDataLoading]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object for oracle.
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData) {
            let databaseHostDataObj: any = {};
            Object.keys(oracleTopologyHostData).map((key: string) => {
                if (key in fullOracleHostData) {
                    const perObj = {
                        ...oracleTopologyHostData[key],
                        ...fullOracleHostData[key],
                        loading: false,
                        databaseHostStatus: oracleTopologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.ORACLE_TYPE } }
                    };
                } else {
                    const perObj = { ...oracleTopologyHostData[key], loading: !!oracleFullHostDataLoading };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.ORACLE_TYPE } }
                    };
                }
            });
            dispatch(addOracleDatabaseHostsData(databaseHostDataObj));
            dispatch(addMultiOracleDatabaseHostsData({ ...multiOracleDatabaseHostsData, ...databaseHostDataObj }));
        }
    }, [fullOracleHostData, oracleTopologyHostData, oracleFullHostDataLoading]);

    // This data is coming from discover API
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && !managedHostListLoading && discoveredHostData && discoveredHostData.length) {
            const newDiscoveredHostData: any = [];
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

            const removeRows: any[] = [];
            const clusterDiscoveredHost: any = {};
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
            const { removeSecNodeDiscoveredList } = state.inventoryV2;
            dispatch(setRemoveSecNodeDiscoveredList([...removeSecNodeDiscoveredList, ...removeRows]));

            const unmanagedHostList = getUnmanagedHostInstances(
                formattedDiscoveredInventoryTableData,
                runningInstanceListRef.current
            );
            if (unmanagedHostList && unmanagedHostList?.length > 0) {
                callInstanceApi(unmanagedHostList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
                callUnmanagedPerfInstanceApi(unmanagedHostList, false, INSTANCE_API_FIELDS.SUB_TABLE_FIELDS);
            }

            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedDiscoveredInventoryTableData };
            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedData = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                const updatedInventoryData = updateInstancesApiResponse(mergedData, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredHostData, fsxCredentialStatusObj, managedHostListLoading]);

    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (
            !resetManagedData &&
            !managedHostListLoading &&
            discoveredOracleHostData &&
            discoveredOracleHostData.length
        ) {
            // Grouping logic is not required here as oracle is just supporting standalone for now
            // Grouing logic will be required if they support cluster in future
            const formattedDiscoveredOracleInventoryTableData =
                formatDiscoveredOracleInventoryData(discoveredOracleHostData);
            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedDiscoveredOracleInventoryTableData };

            const unmanagedOracleHostList = getUnmanagedOracleHostInstances(
                formattedDiscoveredOracleInventoryTableData,
                runningOracleInstanceListRef.current
            );
            if (unmanagedOracleHostList && unmanagedOracleHostList?.length > 0) {
                callOracleResourceApi(unmanagedOracleHostList, false, INSTANCE_API_FIELDS.UNMANAGED_ORACLE_DEFAULT);
            }

            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedData = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                const updatedInventoryData = updateInstancesApiResponse(mergedData, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredOracleHostData, managedHostListLoading]);

    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && !managedHostListLoading && discoveredPgsqlHostData && discoveredPgsqlHostData.length) {
            const removeRows: any[] = [];
            const clusterDiscoveredHost: any = {};
            const newDiscoveredPgsqlHostData: any = [];
            getPrimaryPgsqlNode(
                newDiscoveredPgsqlHostData,
                discoveredPgsqlHostData,
                removeRows,
                managedHostList,
                clusterDiscoveredHost,
                isDemoMode
            );

            const formattedDiscoveredInventoryTableData = formatDiscoveredPgsqlInventoryData(
                newDiscoveredPgsqlHostData,
                removeRows,
                clusterDiscoveredHost
            );

            const state = store.getState();
            const { removeSecNodeDiscoveredList } = state.inventoryV2;
            dispatch(setRemoveSecNodeDiscoveredList([...removeSecNodeDiscoveredList, ...removeRows]));

            const unmanagedPgsqlHostList = getUnmanagedPgsqlHostInstances(
                formattedDiscoveredInventoryTableData,
                runningPgsqlInstanceListRef.current
            );
            if (unmanagedPgsqlHostList && unmanagedPgsqlHostList?.length > 0) {
                callPgsqlResourceApi(unmanagedPgsqlHostList, false, INSTANCE_API_FIELDS.UNMANAGED_PGSQL_DEFAULT);
            }
            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedDiscoveredInventoryTableData };
            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedData = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                const updatedInventoryData = updateInstancesApiResponse(mergedData, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredPgsqlHostData, managedHostListLoading]);

    // This data is coming from database-hosts API
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && databaseHostsData) {
            const formattedInventoryTableData = formatInventoryTableData(databaseHostsData);

            const unmanagedInstanceList = getMhUnmanagedInstances(
                formattedInventoryTableData,
                runningInstanceListRef.current
            );
            if (unmanagedInstanceList && unmanagedInstanceList?.length > 0) {
                callInstanceApi(unmanagedInstanceList, true, INSTANCE_API_FIELDS.MIXED_STATUS_FIELDS);
                callUnmanagedPerfInstanceApi(unmanagedInstanceList, true, INSTANCE_API_FIELDS.SUB_TABLE_FIELDS);
            }

            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedInventoryTableData };
            // dispatch(setInventoryTableData(updatedResult));

            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedData = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                // @ts-ignore
                const updatedInventoryData = updateInstancesApiResponse(mergedData, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [databaseHostsData]);

    // This data is coming from database-hosts pgsql API
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && pgsqlDatabaseHostsData) {
            const formattedInventoryTableData = formatInventoryTableData(pgsqlDatabaseHostsData);

            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedInventoryTableData };
            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedDataArray = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                const updatedInventoryData = updateInstancesApiResponse(mergedDataArray, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [pgsqlDatabaseHostsData]);

    // This data is coming from database-hosts oracle API
    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && oracleDatabaseHostsData) {
            const formattedInventoryTableData = formatInventoryTableData(oracleDatabaseHostsData);

            // To Avoid overriding
            const updatedResult = { ...inventoryTableDataRef.current, ...formattedInventoryTableData };
            if (mssqlInstancesDataRef.current || pgsqlInstancesDataRef.current || oracleInstancesDataRef.current) {
                const mergedDataArray = {
                    ...mssqlInstancesDataRef.current,
                    ...pgsqlInstancesDataRef.current,
                    ...oracleInstancesDataRef.current
                };
                const updatedInventoryData = updateInstancesApiResponse(mergedDataArray, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [oracleDatabaseHostsData]);

    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (
            !resetManagedData &&
            (mssqlInstancesData || pgsqlInstancesData || oracleInstancesData) &&
            inventoryTableData
        ) {
            const mergedData = {
                ...mssqlInstancesData,
                ...pgsqlInstancesData,
                ...oracleInstancesData
            };
            const updatedInventoryData = updateInstancesApiResponse(mergedData, inventoryTableData);
            const newInventoryTableData = { ...inventoryTableData, ...updatedInventoryData };

            // Use lodash.isequal for deep comparison
            // under the hood this inventory table data will get sync with perfMssqlInstancesData to have protection and performance data
            if (!isEqual(newInventoryTableData, inventoryTableData)) {
                dispatch(setInventoryTableData(newInventoryTableData));
            }
        }
    }, [mssqlInstancesData, pgsqlInstancesData, oracleInstancesData, inventoryTableData, perfMssqlInstancesData]);

    useEffect(() => {
        const state = store.getState();
        const { resetManagedData } = state.inventoryV2;
        if (!resetManagedData && inventoryTableDataRef.current) {
            const inventoryDataCount = getInventoryDataCount(inventoryTableDataRef.current);
            const currentChartData = state.inventoryV2.inventoryChartData;
            if (!isEqual(inventoryDataCount, currentChartData)) {
                dispatch(setInventoryChartData(inventoryDataCount));
            }

            const exploreSavingsRows = getExploreSavingsRows(inventoryTableDataRef.current);
            const currentExploreSavings = state.exploreSavings.unmanagedExploreSavingsHost;
            if (!isEqual(exploreSavingsRows, currentExploreSavings)) {
                dispatch(setUnmanagedExploreSavingsHost(exploreSavingsRows));
            }

            // Only call if exploreSavingsRows is not empty and has changed
            if (
                exploreSavingsRows &&
                exploreSavingsRows.length > 0 &&
                !isEqual(exploreSavingsRows, currentExploreSavings)
            ) {
                callPotentialSavings(exploreSavingsRows, credId, regionId);
            }
        }
    }, [inventoryTableData, removeSecNodeDiscoveredList]);

    useEffect(() => {
        if (!refreshBlocked) {
            // Below is required for multi cred and region - as it was creating duplicate so fixed now but will change for multi cred
            dispatch(addAllMssqlHostAssessmentData([...allmssqlHostAssessmentDataS, ...allmssqlHostAssessmentData]));
            // dispatch(addAllMssqlHostAssessmentData([...allmssqlHostAssessmentData]));
        }
    }, [allmssqlHostAssessmentData]);
};

export default InventoryApisV3;
