import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAllMssqlHostAssessmentData,
    addDatabaseHostsDataV2,
    addPgSqlDatabaseHostsData,
    setAllMssqlHostAssessmentLoading,
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
    setManagedAssessmentHostData,
    setManagedAssessmentHostIdsList,
    setMssqlInstancesData,
    setPerfMssqlInstancesData,
    setRemoveSecNodeDiscoveredList,
    setResetManagedData,
    setUnManagedPerfInstanceIdsList
} from '../../store/workloadFactory/inventoryV2Slice';
import {
    useGetMssqlAssessmentDataForHostMutation,
    useGetMssqlInstanceDataV2Mutation,
    useLazyDiscoverHostsQuery,
    useLazyGetAllMssqlHostsAssessmentDataQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery,
    useLazyGetPgsqlDatabaseHostsFullDataV2Query,
    useLazyGetPgSqlDatabaseHostsListQuery
} from '../../utils/apiService';
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
    updateInstancesApiResponse
} from './InventoryUtilsV2';
import { setUnmanagedExploreSavingsHost } from '../../store/workloadFactory/exploreSavingsSlice';
import store from '../../store/store';
import { INSTANCE_API_FIELDS } from '../../utils/consts';
import { all } from 'axios';

const InventoryApisV2 = () => {
    const dispatch = useAppDispatch();
    const { databaseHostsData, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { fullHostDataLoading: pgsqlFullHostDataLoading } = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts
    );
    const removeSecNodeDiscoveredList = useAppSelector(state => state.inventoryV2.removeSecNodeDiscoveredList);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const fsxCredentialStatusObj = useAppSelector(state => state.inventoryV2.fsxCredentialStatusObj);
    const mssqlInstancesData = useAppSelector(state => state.inventoryV2.mssqlInstancesData);
    const detectedInstanceId = useAppSelector(state => state.inventoryV2.detectedInstanceId);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const [runningInstanceList, setRunningInstanceList] = useState<Array<string>>([]);
    const [runningPerfInstanceList, setRunningPerfInstanceList] = useState<Array<string>>([]);
    const [runningManagedAssessmentList, setRunningManagedAssessmentList] = useState<Array<string>>([]);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const refreshBlocked = useAppSelector(state => state.auth?.refreshBlocked);
    const unManagedPerfInstanceIdsList = useAppSelector(state => state.inventoryV2.unManagedPerfInstanceIdsList);
    const managedAssessmentHostIdsList = useAppSelector(state => state.inventoryV2.managedAssessmentHostIdsList);
    const perfMssqlInstancesData = useAppSelector(state => state.inventoryV2.perfMssqlInstancesData);
    const managedAssessmentHostData = useAppSelector(state => state.inventoryV2.managedAssessmentHostData);

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

    // Discover API
    const [getDiscoveryHostsListApi] = useLazyDiscoverHostsQuery();

    // Get fsx credentials status query.
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();

    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();

    // Get managed assessment data
    const [getMssqlAssessmentData] = useGetMssqlAssessmentDataForHostMutation();

    // Get all managed hosts assessment data
    const [getAllMssqlHostAssessmentAPI] = useLazyGetAllMssqlHostsAssessmentDataQuery();
    const [allmssqlHostAssessmentData, setAllmssqlHostAssessmentData] = useState<any>([]);

    const credIdRef = useRef();
    const regionIdRef = useRef();
    const fsxCredentialStatusObjRef: any = useRef();
    const mssqlInstancesDataRef: any = useRef();
    const perfMssqlInstancesDataRef: any = useRef();
    const managedAssessmentHostDataRef: any = useRef();
    const runningInstanceListRef: any = useRef();

    const runningPerfInstanceListRef: any = useRef();
    const runningManagedAssessmentRef: any = useRef();

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
        perfMssqlInstancesDataRef.current = perfMssqlInstancesData;
    }, [perfMssqlInstancesData]);

    useEffect(() => {
        managedAssessmentHostDataRef.current = managedAssessmentHostData;
    }, [managedAssessmentHostData]);

    useEffect(() => {
        credIdRef.current = credId;
        regionIdRef.current = regionId;
    }, [credId, regionId]);

    // This function is to get managed list and respective instance IDs. This will be used to map logic for resource id and instance.
    const getFsxCredentialStatusList = async (
        fsxIdsList: Array<string>,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getFsxCredentialStatusListApi({
                    credentialsId: credId,
                    regionId: regionId,
                    fsxIds: fsxIdsList.join(',')
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
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
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getManagedHostListAPI({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: managedHostCursor
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
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

    // This function is to get basic managed rows info. This output is used both in managed tab and dashboard page.
    const getDatabaseHostsList = async (
        managedList: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getDatabaseHostsListApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [perRow?.id]: perRow };
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
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getPgSqlDatabaseHostsListApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [perRow?.id]: perRow };
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
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken,
                    isDemoMode: isDemoMode
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [perRow?.id]: perRow };
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
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getPgSqlDatabaseHostsFullDataApi({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken,
                    isDemoMode: isDemoMode
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
                    dispatch(setResetManagedData(false));
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.id) {
                                managedList = { ...managedList, [perRow?.id]: perRow };
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
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getDiscoveryHostsListApi({
                    regionId: regionId,
                    credentialsId: credId,
                    nextToken: nextToken
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
                    if (result && !result?.error) {
                        result?.data?.items?.map((perRow: any) => {
                            if (perRow?.ec2InstanceId) {
                                discoveredList = [...discoveredList, perRow];
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
                        !mssqlInstancesDataRef.current[host?.id]?.isManagedHost &&
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

                    if (mssqlInstancesDataRef.current[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            isManagedHost: mssqlInstancesDataRef.current[host?.id]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: mssqlInstancesDataRef.current[host?.id]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[instanceId]) {
                    mssqlInstancesDataRes[instanceId] = {
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
                mssqlInstancesDataErr[instanceId] = {
                    isManagedHost: isManagedHost,
                    data: null,
                    error: result?.error?.data?.message,
                    fields: fields
                };
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[instanceId] = {
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
                mssqlInstancesDataLoad[ec2InstanceId] = {
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
                    if (perfMssqlInstancesDataRef.current[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            isManagedHost: perfMssqlInstancesDataRef.current[host?.id]?.isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors,
                            fields: perfMssqlInstancesDataRef.current[host?.id]?.fields
                        };
                    }
                });
                if (!mssqlInstancesDataRes?.[instanceId]) {
                    mssqlInstancesDataRes[instanceId] = {
                        isManagedHost: perfMssqlInstancesDataRef.current[instanceId]?.isManagedHost,
                        loading: false,
                        data: null,
                        error: null,
                        fields: perfMssqlInstancesDataRef.current[instanceId]?.fields
                    };
                }
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[instanceId] = {
                    isManagedHost: isManagedHost,
                    data: null,
                    error: result?.error?.data?.message,
                    fields: fields
                };
                dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[instanceId] = {
                isManagedHost: isManagedHost,
                data: null,
                error: error,
                fields: fields
            };
            dispatch(setPerfMssqlInstancesData({ ...perfMssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
        }
    };

    const getManagedAssessmentData = async (resourceId: string) => {
        try {
            const result: any = await getMssqlAssessmentData({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                databaseHostId: resourceId
            });
            if (result && !result?.error) {
                let mssqlAssessmentDataRes: any = {};
                if (result?.data) {
                    if (managedAssessmentHostDataRef.current[resourceId]) {
                        mssqlAssessmentDataRes[resourceId] = {
                            loading: false,
                            data: result?.data?.instancesAssessment,
                            error: result?.data?.error
                        };
                    }
                }
                if (!mssqlAssessmentDataRes?.[resourceId]) {
                    mssqlAssessmentDataRes[resourceId] = {
                        loading: false,
                        data: null,
                        error: null
                    };
                }
                dispatch(
                    setManagedAssessmentHostData({ ...managedAssessmentHostDataRef.current, ...mssqlAssessmentDataRes })
                );
            } else {
                let mssqlAssessmentDataErr: any = {};
                mssqlAssessmentDataErr[resourceId] = {
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message
                };
                dispatch(
                    setManagedAssessmentHostData({ ...managedAssessmentHostDataRef.current, ...mssqlAssessmentDataErr })
                );
            }
        } catch (error) {
            let mssqlAssessmentDataErr: any = {};
            mssqlAssessmentDataErr[resourceId] = {
                loading: false,
                data: null,
                error: error
            };
            dispatch(
                setManagedAssessmentHostData({ ...managedAssessmentHostDataRef.current, ...mssqlAssessmentDataErr })
            );
        }
    };

    const getAllMssqlHostAssessmentData = async (
        assessmentData: any,
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getAllMssqlHostAssessmentAPI({
                    credentialId: credId,
                    regionId: regionId,
                    nextToken: nextToken
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
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
                if (runningPerfInstanceListRef.current.includes(ec2InstanceId)) {
                    return;
                }
                mssqlInstancesDataLoad[ec2InstanceId] = {
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

    const callManagedAssessment = (resourceIds: Array<string>) => {
        if (resourceIds.length > 0) {
            let mssqlAssessmentDataLoad: any = {};
            let noRunningList: Array<string> = [];
            resourceIds?.map((resourceId: any) => {
                if (
                    runningManagedAssessmentRef.current?.length &&
                    runningManagedAssessmentRef.current.includes(resourceId)
                ) {
                    return;
                }
                mssqlAssessmentDataLoad[resourceId] = {
                    loading: true,
                    data: null,
                    error: null
                };
                noRunningList.push(resourceId);
            });
            dispatch(
                setManagedAssessmentHostData({ ...managedAssessmentHostDataRef.current, ...mssqlAssessmentDataLoad })
            );
            setRunningManagedAssessmentList([...runningManagedAssessmentRef.current, ...noRunningList]);
            noRunningList?.map((resourceId: any) => {
                setTimeout(() => {
                    getManagedAssessmentData(resourceId);
                }, 1);
            });
        }
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
        if (unManagedPerfInstanceIdsList) {
            callUnmanagedPerfInstanceApi(unManagedPerfInstanceIdsList, false, INSTANCE_API_FIELDS.SUB_TABLE_FIELDS);
        }
    }, [unManagedPerfInstanceIdsList]);

    useEffect(() => {
        // Assessment call for managed rows
        if (managedAssessmentHostIdsList) {
            callManagedAssessment(managedAssessmentHostIdsList);
        }
    }, [managedAssessmentHostIdsList]);

    const resetValues = () => {
        dispatch(setResetManagedData(true));
        // reset for getManagedHostList
        setManagedHostList([]);
        setManagedHostListLoading(true);
        dispatch(setIsManagedHostListLoading(true));
        // reset for getDatabaseHostsList
        dispatch(setIsDatabaseHostsLoading(true));
        dispatch(setIsPgSqlDatabaseHostsLoading(true));
        setTopologyHostData({});
        setPgsqlTopologyHostData({});
        // reset for getDatabaseHostsFullData
        dispatch(setIsFullHostDataLoading(true));
        dispatch(setIsFullPgSqlHostDataLoading(true));
        dispatch(setAllMssqlHostAssessmentLoading(true));
        dispatch(addDatabaseHostsDataV2(null));
        dispatch(addPgSqlDatabaseHostsData(null));
        setFullHostData({});
        setFullPgsqlHostData({});
        // reset for discovery
        dispatch(setIsDiscoveredHostData(null));
        dispatch(setIsDiscoverHostLoading(true));
        // FSX cred object reset
        dispatch(setFsxCredentialStatus({}));
        // inventory table reset
        dispatch(setInventoryTableData(null));
        //Instances API reset
        dispatch(setMssqlInstancesData({}));
        // Running instanceList reset
        setRunningInstanceList([]);
        // Explore savings data
        dispatch(setUnmanagedExploreSavingsHost([]));
        // chart counts
        dispatch(setInventoryChartData(null));
        // Partner instance list reset
        setPartnerInstanceList([]);
        // reset partner list in FCI and AOAG
        dispatch(setRemoveSecNodeDiscoveredList([]));
        // Perf and protection call for unmanaged rows
        dispatch(setUnManagedPerfInstanceIdsList([]));
        // Assessment call for managed rows
        dispatch(setManagedAssessmentHostIdsList([]));
        setRunningPerfInstanceList([]);
        setRunningManagedAssessmentList([]);
        dispatch(setPerfMssqlInstancesData({}));
        dispatch(setManagedAssessmentHostData({}));
        dispatch(addAllMssqlHostAssessmentData([]));
    };

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked) {
            let managedList: string[] = [];
            let fullHostData: any = {};
            let fullPgsqlHostData: any = {};
            let topologyHostData: any = {};
            let pgsqlTopologyHostData: any = {};
            let discoveredList: any = [];
            let allmssqlHostAssessmentData: any = [];
            if (credId && regionId) {
                resetValues();
                setTimeout(() => {
                    getManagedHostList(managedList, null, credId, regionId);
                    getDatabaseHostsList(topologyHostData, null, credId, regionId);
                    getPgSqlDatabaseHostsList(pgsqlTopologyHostData, null, credId, regionId);
                    getDatabaseHostsFullData(fullHostData, null, credId, regionId);
                    getPgsqlDatabaseHostsFullData(fullPgsqlHostData, null, credId, regionId);
                    getAllMssqlHostAssessmentData(allmssqlHostAssessmentData, null, credId, regionId);
                    getDiscoveryHostsList(discoveredList, null, credId, regionId);
                }, 10);
            }
        }
    }, [credId, regionId, refreshBlocked]);

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        if (!refreshBlocked && isRefreshed) {
            let managedList: string[] = [];
            let fullHostData: any = {};
            let fullPgsqlHostData: any = {};
            let topologyHostData: any = {};
            let pgsqlTopologyHostData: any = {};
            let discoveredList: any = [];
            let allmssqlHostAssessmentData: any = [];
            if (credId && regionId && isRefreshed) {
                resetValues();
                setTimeout(() => {
                    getManagedHostList(managedList, null, credId, regionId);
                    getDatabaseHostsList(topologyHostData, null, credId, regionId);
                    getPgSqlDatabaseHostsList(pgsqlTopologyHostData, null, credId, regionId);
                    getDatabaseHostsFullData(fullHostData, null, credId, regionId);
                    getPgsqlDatabaseHostsFullData(fullPgsqlHostData, null, credId, regionId);
                    getAllMssqlHostAssessmentData(allmssqlHostAssessmentData, null, credId, regionId);
                    getDiscoveryHostsList(discoveredList, null, credId, regionId);
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
                if (key in fullHostData) {
                    const perObj = {
                        ...topologyHostData[key],
                        ...fullHostData[key],
                        loading: false,
                        databaseHostStatus: topologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
                } else {
                    const perObj = { ...topologyHostData[key], loading: fullHostDataLoading ? true : false };
                    databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
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
                if (key in fullPgsqlHostData) {
                    const perObj = {
                        ...pgsqlTopologyHostData[key],
                        ...fullPgsqlHostData[key],
                        loading: false,
                        databaseHostStatus: pgsqlTopologyHostData[key]?.databaseHostStatus
                    };
                    databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
                } else {
                    const perObj = { ...pgsqlTopologyHostData[key], loading: pgsqlFullHostDataLoading ? true : false };
                    databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
                }
            });
            dispatch(addPgSqlDatabaseHostsData(databaseHostDataObj));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullPgsqlHostData, pgsqlTopologyHostData, pgsqlFullHostDataLoading]);

    // This data is coming from discover API
    useEffect(() => {
        if (!managedHostListLoading && discoveredHostData && discoveredHostData.length) {
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
            let updatedResult = { ...inventoryTableData, ...formattedDiscoveredInventoryTableData };
            if (mssqlInstancesDataRef.current) {
                const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, updatedResult);
                dispatch(setInventoryTableData({ ...inventoryTableData, ...updatedInventoryData }));
            } else {
                dispatch(setInventoryTableData(updatedResult));
            }
        }
    }, [discoveredHostData, fsxCredentialStatusObj, managedHostListLoading]);

    // This data is coming from database-hosts API
    useEffect(() => {
        if (databaseHostsData) {
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

    useEffect(() => {
        if (mssqlInstancesDataRef.current && inventoryTableData) {
            const updatedInventoryData = updateInstancesApiResponse(mssqlInstancesDataRef.current, inventoryTableData);
            dispatch(setInventoryTableData({ ...inventoryTableData, ...updatedInventoryData }));
        }
    }, [mssqlInstancesData, perfMssqlInstancesData]);

    useEffect(() => {
        if (inventoryTableData) {
            const inventoryDataCount = getInventoryDataCount(inventoryTableData);
            dispatch(setInventoryChartData(inventoryDataCount));
            const exploreSavingsRows = getExploreSavingsRows(inventoryTableData);
            dispatch(setUnmanagedExploreSavingsHost(exploreSavingsRows));
        }
    }, [inventoryTableData, removeSecNodeDiscoveredList]);

    useEffect(() => {
        if (!refreshBlocked) {
            dispatch(addAllMssqlHostAssessmentData(allmssqlHostAssessmentData));
        }
    }, [allmssqlHostAssessmentData]);
};

export default InventoryApisV2;
