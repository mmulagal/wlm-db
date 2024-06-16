import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addDatabaseHostsDataV2,
    setFsxCredentialStatus,
    setInventoryChartData,
    setInventoryTableData,
    setIsDatabaseHostsLoading,
    setIsDiscoverHostLoading,
    setIsDiscoveredHostData,
    setIsFullHostDataLoading,
    setIsManagedHostListLoading,
    setMssqlInstancesData
} from '../../store/workloadFactory/inventoryV2Slice';
import {
    useGetMssqlInstanceDataV2Mutation,
    useLazyDiscoverHostsQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery
} from '../../utils/apiService';
import {
    formatDiscoveredInventoryData,
    formatInventoryTableData,
    getFsxIdsFromdiscover,
    getInventoryDataCount,
    getMhUnmanagedInstances,
    getPrimaryClusterNode,
    getUnmanagedHostInstances
} from './InventoryUtilsV2';
import { setIsRefreshed } from '../../store/workloadFactory/inventorySlice';
import InventoryTableData from './InventoryTableData.json';

const InventoryApisV2 = () => {
    const dispatch = useAppDispatch();
    const { databaseHostsData, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { discoveredHostData } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const fsxCredentialStatusObj = useAppSelector(state => state.inventoryV2.fsxCredentialStatusObj);
    const mssqlInstancesData = useAppSelector(state => state.inventoryV2.mssqlInstancesData);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const isRefreshed = useAppSelector(state => state.inventory.isRefreshed);
    const [runningInstanceList, setRunningInstanceList] = useState<Array<String>>([]);

    // This is to call instances API for unmanaged instances in a managed host rows
    // const [mhUnmanagedInstances, setMhUnmanagedInstnaces] = useState([]);

    //This is to call instances API for unmanaged host itself
    // const [unmanagedHost, setUnmanagedHost] = useState([]);

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    // getManagedHostList function values update
    const [getManagedHostListAPI] = useLazyGetManagedHostDataQuery();
    const [managedHostList, setManagedHostList] = useState<any>([]);
    const [managedHostListLoading, setManagedHostListLoading] = useState(true);

    // database-hosts without fields values
    const [getDatabaseHostsListApi] = useLazyGetDatabaseHostsListV2Query();
    const [topologyHostData, setTopologyHostData] = useState<any>({});

    // database-hosts with fields values
    const [getDatabaseHostsFullDataApi] = useLazyGetDatabaseHostsFullDataV2Query();
    const [fullHostData, setFullHostData] = useState<any>({});

    // Discover API
    const [getDiscoveryHostsListApi] = useLazyDiscoverHostsQuery();
    const [discoveryHostData, setDiscoveryHostData] = useState<any>({});

    // Get fsx credentials status query.
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();
    // const [fsxCredentialStatusData, setFsxCredentialStatusData] = useState<any>({});

    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();

    const credIdRef = useRef();
    const regionIdRef = useRef();
    const fsxCredentialStatusObjRef: any = useRef();
    const mssqlInstancesDataRef: any = useRef();

    useEffect(() => {
        fsxCredentialStatusObjRef.current = fsxCredentialStatusObj;
    }, [fsxCredentialStatusObj]);

    useEffect(() => {
        mssqlInstancesDataRef.current = mssqlInstancesData;
    }, [mssqlInstancesData]);

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
                    credentialId: credId,
                    regionId: regionId,
                    fsxIds: fsxIdsList.join(',')
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
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
                    nextToken: nextToken
                });
                if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
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
                            getFsxCredentialStatusList(fsxIds, runningCredId, runningRegionId);
                        }
                        if (result?.data?.nextToken) {
                            setDiscoveryHostData(discoveredList);
                            dispatch(setIsDiscoveredHostData(discoveredList));
                            getDiscoveryHostsList(
                                discoveredList,
                                result?.data?.nextToken,
                                runningCredId,
                                runningRegionId
                            );
                        } else {
                            dispatch(setIsDiscoverHostLoading(false));
                            setDiscoveryHostData(discoveredList);
                            dispatch(setIsDiscoveredHostData(discoveredList));
                        }
                    } else {
                        dispatch(setIsDiscoverHostLoading(false));
                        setDiscoveryHostData(discoveredList);
                        dispatch(setIsDiscoveredHostData(discoveredList));
                    }
                }
            } catch (error) {
                dispatch(setIsDiscoverHostLoading(false));
                setDiscoveryHostData(discoveredList);
                dispatch(setIsDiscoveredHostData(discoveredList));
            }
        }
    };

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async (instanceList: any, isManagedHost: boolean, nextToken: string | null = '') => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: instanceList.join(','),
                nextToken: nextToken
            });
            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (mssqlInstancesDataRef.current[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            isManagedHost: isManagedHost,
                            loading: false,
                            data: host,
                            error: host?.errors
                        };
                    }
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataRes }));
                if (result?.data?.nextToken) {
                    getMssqlData(instanceList, result?.data?.nextToken);
                }
            } else {
                let mssqlInstancesDataErr: any = {};
                instanceList?.map((ec2InstanceId: any) => {
                    mssqlInstancesDataErr[ec2InstanceId] = {
                        isManagedHost: isManagedHost,
                        data: null,
                        error: result?.error?.data?.message
                    };
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            instanceList?.map((ec2InstanceId: any) => {
                mssqlInstancesDataErr[ec2InstanceId] = {
                    isManagedHost: isManagedHost,
                    data: null,
                    error: error
                };
            });
            dispatch(setMssqlInstancesData({ ...mssqlInstancesDataRef.current, ...mssqlInstancesDataErr }));
        }
    };

    // If any new row added than it will trigger getMssqlData (API2) function to get unmanagaed row data.
    const callInstanceApi = (instancesList: Array<string>, isManagedHost: boolean) => {
        let mssqlInstancesDataLoad: any = {};
        if (instancesList && instancesList.length > 0) {
            instancesList?.map((ec2InstanceId: any) => {
                if (runningInstanceList.find(inst => inst === ec2InstanceId)) {
                    return;
                }
                mssqlInstancesDataLoad[ec2InstanceId] = {
                    isManagedHost: isManagedHost,
                    loading: true,
                    data: null,
                    error: null
                };
            });
            dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataLoad }));
            setRunningInstanceList([...runningInstanceList, ...instancesList]);
            setTimeout(() => {
                getMssqlData(instancesList, isManagedHost);
            }, 1);
        }
    };

    const resetValues = () => {
        // reset for getManagedHostList
        setManagedHostList([]);
        setManagedHostListLoading(true);
        dispatch(setIsManagedHostListLoading(true));
        // reset for getDatabaseHostsList
        dispatch(setIsDatabaseHostsLoading(true));
        setTopologyHostData({});
        // reset for getDatabaseHostsFullData
        dispatch(setIsFullHostDataLoading(true));
        setFullHostData({});
        // reset for discovery
        dispatch(setIsDiscoveredHostData(null));
        dispatch(setIsDiscoverHostLoading(true));
        setDiscoveryHostData({});
        // FSX cred object reset
        dispatch(setFsxCredentialStatus({}));
        // inventory table reset
        dispatch(setInventoryTableData(null));
        //Instances API reset 
        dispatch(setMssqlInstancesData({}));
        // Running instanceList reset 
        setRunningInstanceList([]);
    };

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        let managedList: string[] = [];
        let fullHostData: any = {};
        let topologyHostData: any = {};
        let discoveredList: any = [];
        if (credId && regionId) {
            resetValues();
            setTimeout(() => {
                getManagedHostList(managedList, null, credId, regionId);
                getDatabaseHostsList(topologyHostData, null, credId, regionId);
                getDatabaseHostsFullData(fullHostData, null, credId, regionId);
                getDiscoveryHostsList(discoveredList, null, credId, regionId);
            }, 1);
        }
    }, [credId, regionId]);

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        let managedList: string[] = [];
        let fullHostData: any = {};
        let topologyHostData: any = {};
        let discoveredList: any = [];
        if (credId && regionId && isRefreshed) {
            resetValues();
            setTimeout(() => {
                getManagedHostList(managedList, null, credId, regionId);
                getDatabaseHostsList(topologyHostData, null, credId, regionId);
                getDatabaseHostsFullData(fullHostData, null, credId, regionId);
                getDiscoveryHostsList(discoveredList, null, credId, regionId);
            }, 1);
        }
        if (isRefreshed) {
            dispatch(setIsRefreshed(false));
        }
    }, [isRefreshed]);

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
    }, [headerSelectedCred, headerSelectedRegion]);

    // This will combine fullHostData (getDatabaseHostsFullData) and topologyHostData (getDatabaseHostsList) data and store in single object.
    useEffect(() => {
        let databaseHostDataObj: any = {};
        Object.keys(topologyHostData).map((key: string) => {
            if (key in fullHostData) {
                const perObj = {
                    ...topologyHostData[key],
                    ...fullHostData[key],
                    loading: false,
                    nodeStatus: topologyHostData[key]?.databaseHostStatus
                };
                databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
            } else {
                const perObj = { ...topologyHostData[key], loading: fullHostDataLoading ? true : false };
                databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
            }
        });
        dispatch(addDatabaseHostsDataV2(databaseHostDataObj));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullHostData, topologyHostData]);

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
            getPrimaryClusterNode(newDiscoveredHostData, removeRows, managedHostList, clusterDiscoveredHost);

            const formattedDiscoveredInventoryTableData = formatDiscoveredInventoryData(
                newDiscoveredHostData,
                removeRows,
                clusterDiscoveredHost
            );

            // ToDo - Get unmanaged host instances list
            let unmanagedHostList = getUnmanagedHostInstances(formattedDiscoveredInventoryTableData, runningInstanceList);
            if (unmanagedHostList && unmanagedHostList?.length > 0) {
                callInstanceApi(unmanagedHostList, false);
            };
            dispatch(setInventoryTableData({ ...inventoryTableData, ...formattedDiscoveredInventoryTableData }));
        }
    }, [discoveredHostData, fsxCredentialStatusObj, managedHostListLoading]);

    // This data is coming from database-hosts API
    useEffect(() => {
        const formattedInventoryTableData = formatInventoryTableData(databaseHostsData);

        // ToDo - Get instance list that has unmanaged rows and than 
        let unmanagedInstanceList = getMhUnmanagedInstances(formattedInventoryTableData, runningInstanceList);
        if (unmanagedInstanceList && unmanagedInstanceList?.length > 0) {
            callInstanceApi(unmanagedInstanceList, true);
        };

        dispatch(setInventoryTableData({ ...inventoryTableData, ...formattedInventoryTableData }));
    }, [databaseHostsData]);

    useEffect(() => {
        // ToDo - Store this loading data and update setInventoryTableData
    }, [mssqlInstancesData]);

    // ToDo - Currently stored data is from json. Will update once writting API logic
    // useEffect(() => {
    //     dispatch(setInventoryTableData(InventoryTableData));
    // }, []);

    useEffect(() => {
        const inventoryDataCount = getInventoryDataCount(inventoryTableData);
        dispatch(setInventoryChartData(inventoryDataCount));
    }, [inventoryTableData]);
};

export default InventoryApisV2;
