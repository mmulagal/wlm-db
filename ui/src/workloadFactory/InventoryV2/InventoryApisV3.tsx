import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAllMssqlHostAssessmentData,
    addDatabaseHostsDataV2,
    addPgSqlDatabaseHostsData,
    resetPerComboData,
    setAllMssqlHostAssessmentLoading,
    setDashSandboxListData,
    setDashSandboxListLoading,
    setDashSandboxSavingsData,
    setDashSandboxSavingsLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusLoading,
    setInventoryChartData,
    setInventoryTableData,
    setIsDatabaseHostsLoading,
    setIsDiscoverHostLoading,
    setIsDiscoveredHostData,
    setIsFullHostDataLoading,
    setIsFullPgSqlHostDataLoading,
    setIsManagedHostListLoading,
    setIsPgSqlDatabaseHostsLoading,
    setIsRefreshed,
    setMssqlInstancesData,
    setPerfMssqlInstancesData,
    setPotentialSavingsHostData,
    setRemoveSecNodeDiscoveredList,
    setResetManagedData,
    setUnManagedPerfInstanceIdsList
} from '../../store/workloadFactory/inventoryV2Slice';
import {
    useGetMssqlInstanceDataV2Mutation,
    useGetStorageSavingsMutation,
    useLazyDiscoverHostsQuery,
    useLazyGetAllMssqlHostsAssessmentDataQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery,
    useLazyGetPgsqlDatabaseHostsFullDataV2Query,
    useLazyGetPgSqlDatabaseHostsListQuery,
    useLazyGetSandboxListQuery,
    useLazyGetSandboxSavingsQuery
} from '../../utils/apiService';
import {
    addInstanceIdToGetPerf,
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
import { setUnmanagedExploreSavingsHost } from '../../store/workloadFactory/exploreSavingsSlice';
import store from '../../store/store';
import { EBS_PROTECTED_OPTIONS, INSTANCE_API_FIELDS, SNAPSHOT_FREQUENCY } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import { setPotentialSavingsValues } from '../../store/workloadFactory/databaseHomeSlice';
import { checkIfEbsProtected } from '../ExploreSavings/SavingsCalculator/savingsUtil';

const InventoryApisV3 = () => {
    const dispatch = useAppDispatch();
    const { databaseHostsData, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsData: pgsqlDatabaseHostsData, fullHostDataLoading: pgsqlFullHostDataLoading } = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts
    );
    const {
        headerSelectedCred,
        headerSelectedRegion,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    } = useAppSelector(state => state.headers);
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const fsxCredentialStatusObj = useAppSelector(state => state.inventoryV2.fsxCredentialStatusObj);
    const mssqlInstancesData = useAppSelector(state => state.inventoryV2.mssqlInstancesData);
    const detectedInstanceId = useAppSelector(state => state.inventoryV2.detectedInstanceId);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const [runningInstanceList, setRunningInstanceList] = useState<Array<string>>([]);
    const [runningPerfInstanceList, setRunningPerfInstanceList] = useState<Array<string>>([]);
    const [runningManagedAssessmentList, setRunningManagedAssessmentList] = useState<Array<string>>([]);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const refreshBlocked = useAppSelector(state => state.auth?.refreshBlocked);
    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);
    const allmssqlHostAssessmentDataS = useAppSelector(state => state.inventoryV2.allmssqlHostAssessmentData);
    const perfMssqlInstancesData = useAppSelector(state => state.inventoryV2.perfMssqlInstancesData);
    const managedAssessmentHostData = useAppSelector(state => state.inventoryV2.managedAssessmentHostData);
    const potentialSavingsHostData = useAppSelector(state => state.inventoryV2.potentialSavingsHostData);

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');
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

    // database-hosts with fields values
    const [getDatabaseHostsFullDataApi] = useLazyGetDatabaseHostsFullDataV2Query();
    const [fullHostData, setFullHostData] = useState<any>({});

    // pgsql database-hosts with fields values
    const [getPgSqlDatabaseHostsFullDataApi] = useLazyGetPgsqlDatabaseHostsFullDataV2Query();
    const [fullPgsqlHostData, setFullPgsqlHostData] = useState<any>({});

    // Potential savings API for EBS and FSxW
    const [getStorageSavingsApi] = useGetStorageSavingsMutation();

    // Discover API
    const [getDiscoveryHostsListApi] = useLazyDiscoverHostsQuery();

    // Get fsx credentials status query.
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();

    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();

    // Get all managed hosts assessment data
    const [getAllMssqlHostAssessmentAPI] = useLazyGetAllMssqlHostsAssessmentDataQuery();
    const [allmssqlHostAssessmentData, setAllmssqlHostAssessmentData] = useState<any>([]);

    // Get all sandbox API data
    const [getSandboxListApi] = useLazyGetSandboxListQuery();
    const [getSandboxSavingsApi] = useLazyGetSandboxSavingsQuery();

    const fsxCredentialStatusObjRef: any = useRef(null);
    const mssqlInstancesDataRef: any = useRef(null);
    const perfMssqlInstancesDataRef: any = useRef(null);
    const managedAssessmentHostDataRef: any = useRef(null);
    const runningInstanceListRef: any = useRef(null);

    const runningPerfInstanceListRef: any = useRef(null);
    const runningManagedAssessmentRef: any = useRef(null);
    const potentialSavingsHostDataRef: any = useRef(null);
    const inventoryTableDataRef: any = useRef(null);

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
        fsxCredentialStatusObjRef.current = fsxCredentialStatusObj;
    }, [fsxCredentialStatusObj]);

    useEffect(() => {
        mssqlInstancesDataRef.current = mssqlInstancesData;
    }, [mssqlInstancesData]);

    useEffect(() => {
        inventoryTableDataRef.current = inventoryTableData;
    }, [inventoryTableData]);

    useEffect(() => {
        perfMssqlInstancesDataRef.current = perfMssqlInstancesData;
    }, [perfMssqlInstancesData]);

    useEffect(() => {
        managedAssessmentHostDataRef.current = managedAssessmentHostData;
    }, [managedAssessmentHostData]);

    useEffect(() => {
        potentialSavingsHostDataRef.current = potentialSavingsHostData;
    }, [potentialSavingsHostData]);

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
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
                    dispatch(setFsxCredentialStatusLoading(false));
                    if (result && !result?.error) {
                        if (result?.data?.fileSystems) {
                            let fsxCredStatusObj: any = {};
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

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
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
        let discoveredRows: any = [];
        getDiscoveryHostsList(discoveredRows, null, credId, regionId);
        if (managedList?.length > 0) {
            let fullHostData: any = {};
            let fullPgsqlHostData: any = {};
            let topologyHostData: any = {};
            let pgsqlTopologyHostData: any = {};
            let assessmentData: any = [];
            let sandboxListData: any = [];
            let sandboxSavingsData: any = [];
            getDatabaseHostsList(topologyHostData, null, credId, regionId);
            getPgSqlDatabaseHostsList(pgsqlTopologyHostData, null, credId, regionId);
            getDatabaseHostsFullData(fullHostData, null, credId, regionId);
            getPgsqlDatabaseHostsFullData(fullPgsqlHostData, null, credId, regionId);
            getAllMssqlHostAssessmentData(assessmentData, null, credId, regionId);
            // sandbox APIs
            getAllSandboxListData(sandboxListData, null, credId, regionId);
            getAllSandboxSavingsData(sandboxSavingsData, credId, regionId);
        } else {
            dispatch(setIsDatabaseHostsLoading(false));
            dispatch(setIsPgSqlDatabaseHostsLoading(false));
            dispatch(setIsFullHostDataLoading(false));
            dispatch(setIsFullPgSqlHostDataLoading(false));
            dispatch(setAllMssqlHostAssessmentLoading(false));
            dispatch(setDashSandboxListLoading(false));
            dispatch(setDashSandboxSavingsLoading(false));
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

    // This function is to get all managed rows data. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsFullData = async (
        managedList: any,
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

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async (
        instanceId: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
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
                        !mssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]?.isManagedHost &&
                        !partnerInstanceList.includes(partnerInstanceId)
                    ) {
                        setPartnerInstanceList([...partnerInstanceList, ...[partnerInstanceId]]);
                    }

                    const state = store.getState();
                    const unManagedPerfInstanceIdsListData = state.inventoryV2.unManagedPerfInstanceIdsList;
                    if (
                        partnerInstanceId &&
                        unManagedPerfInstanceIdsListData.includes(host?.id) &&
                        !unManagedPerfInstanceIdsListData.includes(partnerInstanceId)
                    ) {
                        dispatch(
                            setUnManagedPerfInstanceIdsList([
                                ...unManagedPerfInstanceIdsListData,
                                ...[partnerInstanceId]
                            ])
                        );
                    }

                    if (mssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]) {
                        mssqlInstancesDataRes[uniqueHostRow(host?.id, credId, regionId)] = {
                            isManagedHost:
                                mssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: mssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[uniqueHostRow(instanceId, credId, regionId)]) {
                    mssqlInstancesDataRes[uniqueHostRow(instanceId, credId, regionId)] = {
                        isManagedHost:
                            mssqlInstancesDataRef.current[uniqueHostRow(instanceId, credId, regionId)]?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: mssqlInstancesDataRef.current[uniqueHostRow(instanceId, credId, regionId)]?.fields
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
    const getUnmanagedPerfMssqlData = async (
        instanceId: any,
        isManagedHost: boolean,
        fields: Array<string>,
        nextToken: string | null = ''
    ) => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: instanceId,
                fields: fields.join(','),
                nextToken: nextToken
            });
            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (perfMssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]) {
                        mssqlInstancesDataRes[uniqueHostRow(host?.id, credId, regionId)] = {
                            isManagedHost:
                                perfMssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]
                                    ?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: perfMssqlInstancesDataRef.current[uniqueHostRow(host?.id, credId, regionId)]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[uniqueHostRow(instanceId, credId, regionId)]) {
                    mssqlInstancesDataRes[uniqueHostRow(instanceId, credId, regionId)] = {
                        isManagedHost:
                            perfMssqlInstancesDataRef.current[uniqueHostRow(instanceId, credId, regionId)]
                                ?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: perfMssqlInstancesDataRef.current[uniqueHostRow(instanceId, credId, regionId)]?.fields
                    };
                }
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[uniqueHostRow(instanceId, credId, regionId)] = {
                    isManagedHost: isManagedHost,
                    data: null,
                    error: result?.error?.data?.message,
                    fields: fields
                };
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[uniqueHostRow(instanceId, credId, regionId)] = {
                isManagedHost: isManagedHost,
                data: null,
                error: error,
                fields: fields
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
                        assessmentData = [
                            ...assessmentData,
                            ...(Array.isArray(result?.data?.assessmentsPerAccount)
                                ? result.data.assessmentsPerAccount.map((assessment: any) => ({
                                      ...assessment,
                                      credentialId: credId,
                                      regionId: regionId
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
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getSandboxListApi({
                    credentialId: credId,
                    region: regionId,
                    nextToken: nextToken
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        sandboxListData = [
                            ...sandboxListData,
                            ...(Array.isArray(result?.data?.items)
                                ? result.data.items.map((sandbox: any) => ({
                                      ...sandbox,
                                      credentialId: credId,
                                      regionId: regionId
                                  }))
                                : [])
                        ];
                        if (result?.data?.nextToken) {
                            dispatch(setDashSandboxListData(sandboxListData));
                            getAllSandboxListData(
                                sandboxListData,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setDashSandboxListLoading(false));
                            dispatch(setDashSandboxListData(sandboxListData));
                        }
                    } else {
                        dispatch(setDashSandboxListLoading(false));
                        dispatch(setDashSandboxListData(sandboxListData));
                    }
                }
            } catch (error) {
                dispatch(setDashSandboxListLoading(false));
                dispatch(setDashSandboxListData(sandboxListData));
            }
        }
    };

    const getAllSandboxSavingsData = async (
        sandboxSavingsData: any,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (
            headerSelectedMultiCredIdsList.includes(runningCredId) &&
            headerSelectedMultiRegionIdsList.includes(runningRegionId)
        ) {
            try {
                const result: any = await getSandboxSavingsApi({
                    credentialId: credId,
                    region: regionId
                });
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    if (result && !result?.error) {
                        let perSandboxAPI = {
                            ...result?.data,
                            credentialId: credId,
                            regionId: regionId
                        };
                        sandboxSavingsData = [...sandboxSavingsData, perSandboxAPI];
                        dispatch(setDashSandboxSavingsLoading(false));
                        dispatch(setDashSandboxSavingsData(sandboxSavingsData));
                    } else {
                        dispatch(setDashSandboxSavingsLoading(false));
                        dispatch(setDashSandboxSavingsData(sandboxSavingsData));
                    }
                }
            } catch (error) {
                dispatch(setDashSandboxSavingsLoading(false));
                dispatch(setDashSandboxSavingsData(sandboxSavingsData));
            }
        }
    };

    // This is to call instance API to get perf and protection data
    const callUnmanagedPerfInstanceApi = (
        instancesList: Array<string>,
        isManagedHost: boolean,
        fields: Array<string>
    ) => {
        let mssqlInstancesDataLoad: any = {};
        let noRunningList: Array<string> = [];
        if (instancesList && instancesList.length > 0) {
            instancesList?.map((ec2InstanceId: any) => {
                if (runningPerfInstanceListRef.current.includes(uniqueHostRow(ec2InstanceId, credId, regionId))) {
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
            dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataLoad }));
            setRunningPerfInstanceList([...runningPerfInstanceListRef.current, ...noRunningList]);
            noRunningList?.map((ec2InstanceId: any) => {
                setTimeout(() => {
                    getUnmanagedPerfMssqlData(ec2InstanceId, isManagedHost, fields);
                }, 1);
            });
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
            snapshotFrequency: snapshotFrequency,
            clonedCopiesCount: 1, // clonedCopiesCount default to 1 for dashboard potential
            monthlyChangeRatePercentage: savingsCalculatorType === GENERAL.FSX_FOR_WINDOWS ? 3 : 8 // monthlyChangeRatePercentage default to 3 for FSxW and 8 for EBS
        };
        if (savingsCalculatorType === GENERAL.EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: 'Daily' // cloneRefreshFrequency default to Daily for dashboard potential EBS
            };
        }
        let instanceData: any = {};
        try {
            const result: any = await getStorageSavingsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: selectedInstanceId,
                payload: payload,
                type: savingsCalculatorType === GENERAL.EBS ? 'ebs' : 'fsxw'
            });
            if (
                headerSelectedMultiCredIdsList.includes(runningCredId) &&
                headerSelectedMultiRegionIdsList.includes(runningRegionId)
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
                error: error,
                data: null,
                loading: false,
                storageType: savingsCalculatorType
            };
            dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
        }
    };

    const callPotentialSavings = (exploreSavingsRows: any, runningCredId: string, runningRegionId: string) => {
        let instanceData: any = {};
        // This will loop all unamanged EBS/FSXW rows
        exploreSavingsRows?.map((row: any) => {
            if (
                row?.storageType &&
                !potentialSavingsHostDataRef.current?.[uniqueHostRow(row?.id, credId, regionId)] &&
                row?.isDetected
            ) {
                if (
                    headerSelectedMultiCredIdsList.includes(runningCredId) &&
                    headerSelectedMultiRegionIdsList.includes(runningRegionId)
                ) {
                    let isEbsProtected = null;
                    // For EBS first checking is it is protected or not.
                    // If not that first we need to call instance protection API to get protection.
                    if (row?.storageType === GENERAL.EBS) {
                        isEbsProtected = checkIfEbsProtected(row, null);
                    }
                    instanceData[uniqueHostRow(row?.id, credId, regionId)] = {
                        error: null,
                        data: null,
                        loading: true,
                        storageType: row?.storageType,
                        isProtected: isEbsProtected // If already protected that set protection info along with loading true
                    };
                    dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
                    if (row?.storageType === GENERAL.EBS) {
                        // Protection check is required to set snapshotFrequency in storage savings API.
                        if (isEbsProtected) {
                            // If protected than directly we can call storage savings API.
                            getStorageSavingsData(
                                row?.storageType,
                                row?.id,
                                runningCredId,
                                runningRegionId,
                                isEbsProtected
                            );
                        } else {
                            // If not protected than first we need to call instance protection API to get protection.
                            // This same flow is used to call instance API to get perf and protection data as well as in ES page.
                            addInstanceIdToGetPerf(row, dispatch);
                        }
                    } else if (row?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                        // For FSxW snapshotFrequency in default Daily in storage savings API.
                        getStorageSavingsData(row?.storageType, row?.id, runningCredId, runningRegionId, '');
                    }
                }
            } else if (
                row?.storageType === GENERAL.EBS &&
                potentialSavingsHostDataRef.current?.[uniqueHostRow(row?.id, credId, regionId)]?.loading &&
                !potentialSavingsHostDataRef.current?.[uniqueHostRow(row?.id, credId, regionId)]?.isProtected
            ) {
                // In above if we protection data is missing for EBS than we trigger instance API.
                // This else is used to capture response once instance API is loaded for protection.
                let isEbsProtected = checkIfEbsProtected(row, null);
                // Again check if instance EBS is protected or not.
                instanceData[uniqueHostRow(row?.id, credId, regionId)] = {
                    error: null,
                    data: null,
                    loading: true,
                    storageType: row?.storageType,
                    isProtected: isEbsProtected
                };
                dispatch(setPotentialSavingsHostData({ ...potentialSavingsHostDataRef.current, ...instanceData }));
                if (isEbsProtected) {
                    // If protection data available after instance API call in EBS than call storage savings API.
                    getStorageSavingsData(row?.storageType, row?.id, runningCredId, runningRegionId, isEbsProtected);
                }
            }
        });
    };

    useEffect(() => {
        // if fsx register is false and only db cred is added than call instance API
        if (detectedInstanceId) {
            callInstanceApi([detectedInstanceId], false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
            callUnmanagedPerfInstanceApi([detectedInstanceId], false, INSTANCE_API_FIELDS.SUB_TABLE_FIELDS);
        }
    }, [detectedInstanceId]);

    useEffect(() => {
        // if partner instance ID
        if (partnerInstanceList) {
            callInstanceApi(partnerInstanceList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
        }
    }, [partnerInstanceList]);

    useEffect(() => {
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
        // reset for getDatabaseHostsFullData
        setFullHostData({});
        setFullPgsqlHostData({});
        // reset for discovery
        //Instances API reset
        // Running instanceList reset
        setRunningInstanceList([]);
        // chart counts
        // Partner instance list reset
        setPartnerInstanceList([]);
        // reset partner list in FCI and AOAG
        setRunningPerfInstanceList([]);
        setRunningManagedAssessmentList([]);
        setAllmssqlHostAssessmentData([]);
    };

    const resetFullData = () => {
        resetPerComboValues();
        // inventory table reset
        dispatch(setInventoryTableData(null));
        // FSX cred object reset
        dispatch(setFsxCredentialStatus({}));
        // Explore savings data
        dispatch(setUnmanagedExploreSavingsHost([]));
        dispatch(setPotentialSavingsValues(null));
        dispatch(addAllMssqlHostAssessmentData([]));
        dispatch(setDashSandboxListData([]));
        dispatch(setDashSandboxSavingsData([]));
    };

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked) {
            let managedList: string[] = [];
            if (credId && regionId) {
                // resetPerComboValues();
                resetFullData(); // For now will reset all data on change of cred and region.
                setTimeout(() => {
                    getManagedHostList(managedList, null, credId, regionId);
                }, 10);
            }
        }
    }, [credId, regionId, refreshBlocked]);

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked && isRefreshed) {
            let managedList: string[] = [];
            if (credId && regionId && isRefreshed) {
                resetFullData();
                setTimeout(() => {
                    getManagedHostList(managedList, null, credId, regionId);
                }, 10);
            }
            dispatch(setIsRefreshed(false));
        }
    }, [isRefreshed, refreshBlocked]);

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object.
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
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
                    const perObj = { ...topologyHostData[key], loading: fullHostDataLoading ? true : false };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.MICROSOFT_SQL_SERVER_TYPE } }
                    };
                }
            });
            dispatch(addDatabaseHostsDataV2(databaseHostDataObj));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullHostData, topologyHostData, fullHostDataLoading]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object for pgsql.
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
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
                    const perObj = { ...pgsqlTopologyHostData[key], loading: pgsqlFullHostDataLoading ? true : false };
                    databaseHostDataObj = {
                        ...databaseHostDataObj,
                        ...{ [key]: { ...perObj, hostType: GENERAL.POSTGRESQL_TYPE } }
                    };
                }
            });
            dispatch(addPgSqlDatabaseHostsData(databaseHostDataObj));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPgsqlHostData, pgsqlTopologyHostData, pgsqlFullHostDataLoading]);

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
            dispatch(setRemoveSecNodeDiscoveredList([...removeSecNodeDiscoveredList, ...removeRows]));

            let unmanagedHostList = getUnmanagedHostInstances(
                formattedDiscoveredInventoryTableData,
                runningInstanceListRef.current
            );
            if (unmanagedHostList && unmanagedHostList?.length > 0) {
                callInstanceApi(unmanagedHostList, false, INSTANCE_API_FIELDS.UNMANAGED_DEFAULT);
            }

            // To Avoid overriding
            let updatedResult = { ...inventoryTableDataRef.current, ...formattedDiscoveredInventoryTableData };
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredHostData, fsxCredentialStatusObj, managedHostListLoading]);

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
            let updatedResult = { ...inventoryTableDataRef.current, ...formattedInventoryTableData };
            // dispatch(setInventoryTableData(updatedResult));
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [databaseHostsData]);

    // This data is coming from database-hosts pgsql API
    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && pgsqlDatabaseHostsData) {
            const formattedInventoryTableData = formatInventoryTableData(pgsqlDatabaseHostsData);

            // To Avoid overriding
            let updatedResult = { ...inventoryTableDataRef.current, ...formattedInventoryTableData };
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [pgsqlDatabaseHostsData]);

    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && mssqlInstancesDataRef.current && inventoryTableDataRef.current) {
            const updatedInventoryData = updateInstancesApiResponse(
                mssqlInstancesDataRef.current,
                inventoryTableDataRef.current
            );
            dispatch(setInventoryTableData({ ...inventoryTableDataRef.current, ...updatedInventoryData }));
        }
    }, [mssqlInstancesData, perfMssqlInstancesData]);

    useEffect(() => {
        const state = store.getState();
        const resetManagedData = state.inventoryV2.resetManagedData;
        if (!resetManagedData && inventoryTableDataRef.current) {
            const inventoryDataCount = getInventoryDataCount(inventoryTableDataRef.current);
            dispatch(setInventoryChartData(inventoryDataCount));
            const exploreSavingsRows = getExploreSavingsRows(inventoryTableDataRef.current);
            dispatch(setUnmanagedExploreSavingsHost(exploreSavingsRows));
            // call ES APIs for dashboard potential savings
            if (exploreSavingsRows && exploreSavingsRows.length > 0) {
                callPotentialSavings(exploreSavingsRows, credId, regionId);
            }
        }
    }, [inventoryTableData, removeSecNodeDiscoveredList]);

    useEffect(() => {
        if (!refreshBlocked) {
            dispatch(addAllMssqlHostAssessmentData([...allmssqlHostAssessmentDataS, ...allmssqlHostAssessmentData]));
        }
    }, [allmssqlHostAssessmentData]);
};

export default InventoryApisV3;
