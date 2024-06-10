import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addDatabaseHostsDataV2,
    setInventoryChartData,
    setInventoryTableData,
    setIsDatabaseHostsLoading,
    setIsDiscoverHostLoading,
    setIsFullHostDataLoading,
    setIsManagedHostListLoading
} from '../../store/workloadFactory/inventoryV2Slice';
import InventoryTableData from './InventoryTableData.json';
import {
    useGetMssqlInstanceDataV2Mutation,
    useLazyDiscoverHostsQuery,
    useLazyGetDatabaseHostsFullDataV2Query,
    useLazyGetDatabaseHostsListV2Query,
    useLazyGetFsxCredentialStatusQuery,
    useLazyGetManagedHostDataQuery
} from '../../utils/apiService';
import { formatInventoryTableData } from './InventoryUtilsV2';

const InventoryApisV2 = () => {
    const dispatch = useAppDispatch();
    const {databaseHostsData, fullHostDataLoading} = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
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

    // Get fsx credentials status query. - TODO
    const [getFsxCredentialStatusListApi] = useLazyGetFsxCredentialStatusQuery();
    const [fsxCredentialStatusData, setFsxCredentialStatusData] = useState<any>({});

    // Get Instance data mutation. This will be called to get unmanaged rows full data - ToDo
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataV2Mutation();

    const credIdRef = useRef();
    const regionIdRef = useRef();

    useEffect(() => {
        credIdRef.current = credId;
        regionIdRef.current = regionId;
    }, [credId, regionId]);

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
        managedList: string[],
        nextToken: string | null,
        runningCredId: string,
        runningRegionId: string
    ) => {
        if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
            try {
                const result: any = await getDiscoveryHostsListApi({
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
                            setDiscoveryHostData(managedList);
                            getDiscoveryHostsList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
                        } else {
                            dispatch(setIsDiscoverHostLoading(false));
                            setDiscoveryHostData(managedList);
                        }
                    } else {
                        dispatch(setIsDiscoverHostLoading(false));
                        setDiscoveryHostData(managedList);
                    }
                }
            } catch (error) {
                dispatch(setIsDiscoverHostLoading(false));
                setDiscoveryHostData(managedList);
            }
        }
    };

    // This will trigger getManagedHostList, getDatabaseHostsList and getDatabaseHostsFullData on change of cred, region and refresh.
    useEffect(() => {
        let managedList: string[] = [];
        let fullHostData: any = {};
        let topologyHostData: any = {};
        let discoveryHostData: any = {};
        if (credId && regionId) {
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
            dispatch(setIsDiscoverHostLoading(true));
            setDiscoveryHostData({});
            setTimeout(() => {
                getManagedHostList(managedList, null, credId, regionId);
                getDatabaseHostsList(topologyHostData, null, credId, regionId);
                getDatabaseHostsFullData(fullHostData, null, credId, regionId);
                getDiscoveryHostsList(discoveryHostData, null, credId, regionId);
            }, 10);
        }
    }, [credId, regionId]);

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
                const perObj = { ...topologyHostData[key], ...fullHostData[key], loading: false };
                databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
            } else {
                const perObj = { ...topologyHostData[key], loading: fullHostDataLoading ? true : false };
                databaseHostDataObj = { ...databaseHostDataObj, ...{ [key]: perObj } };
            }
        });
        dispatch(addDatabaseHostsDataV2(databaseHostDataObj));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullHostData, topologyHostData]);

    useEffect(() => {
        const formattedInventoryTableData = formatInventoryTableData(databaseHostsData, {});
        dispatch(setInventoryTableData(formattedInventoryTableData));
    }, [databaseHostsData]);

    // ToDo - Currently stored data is from json. Will update once writting API logic
    useEffect(() => {
        // dispatch(setInventoryTableData(InventoryTableData));
        dispatch(
            setInventoryChartData({
                detectedHost: 9,
                undetectedHost: 2,
                managedInstance: 6,
                unmanagedInstance: 24
            })
        );
    }, []);
};

export default InventoryApisV2;
