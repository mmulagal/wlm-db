import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addDatabaseHosts,
    addDatabaseHostsList,
    addDatabaseHostsLoading
} from '../../store/workloadFactory/databaseHomeSlice';
import {
    useDiscoverHostsQuery,
    useGetDatabaseHostsQuery,
    useGetFsxCredentialStatusQuery,
    useGetMssqlInstanceDataMutation,
    useGetMssqlResourceDataMutation
} from '../../utils/apiService';
import {
    addNewManagedHostData,
    mergeDatabaseHostsData,
    resetDBHomePageState,
    sortListOfDict
} from '../../utils/utilityFunctions';
import {
    setDiscoveredHosts,
    setFsxCredentialStatus,
    setFsxIdsList,
    setIsRefreshed,
    setMovedManagedHosts,
    setMovedToManagedHost,
    setMovedToUnmanagedHost,
    setMssqlInstancesData,
    setUnIdentifiableHosts,
    setUnManagedHosts
} from '../../store/workloadFactory/inventorySlice';
import { setHeaderSelectedCred, setHeaderSelectedRegion } from '../../store/workloadFactory/headersSlice';
import { DETECT_HOST_VAR } from '../../utils/consts';
import store from '../../store/store';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { discoveredHostData } = useAppSelector(state => state.inventory.discoveredHosts);
    const discoveredHostState = useAppSelector(state => state.inventory.discoveredHosts);
    const databaseHostState = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { fsxIdsList, fsxCredentialStatusObj, isRefreshed } = useAppSelector(state => state.inventory);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const movedToUnmanagedHost = useAppSelector(state => state.inventory.movedToUnmanagedHost);
    const movedToManagedHost = useAppSelector(state => state.inventory.movedToManagedHost);
    const unManagedHostList = useAppSelector(state => state.inventory.unManagedHosts);
    const movedManagedHostList = useAppSelector(state => state.inventory.movedManagedHosts);
    const mssqlInstancesData = useAppSelector(state => state.inventory.mssqlInstancesData);

    const [hostCursor, setHostCursor] = useState(null);
    const [discoveryCursor, setDiscoveryCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [skipDiscoveryCall, setSkipDiscoveryCall] = useState(false);
    const [skipManagedHostCall, setSkipManagedHostCall] = useState(false);
    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');
    const [runningInstanceList, setRunningInstanceList] = useState<Array<String>>([]);
    const [runningResourceList, setRunningResourceList] = useState<Array<String>>([]);

    const isCredRegionMissing = !headerSelectedCred || !headerSelectedRegion;

    useEffect(() => {
        resetDBHomePageState(dispatch);
        dispatch(addDatabaseHostsLoading(databaseHostsLoading));
    }, [credId, regionId]);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: hostCursor
        },
        { skip: skipApiCall || skipManagedHostCall || isCredRegionMissing }
    );

    const {
        data: discoveredHosts,
        isFetching: discoverHostLoading,
        isError: discoverHostError
    } = useDiscoverHostsQuery(
        {
            credentialsId: credId,
            regionId: regionId,
            nextToken: discoveryCursor
        },
        {
            skip: skipApiCall || skipDiscoveryCall || isCredRegionMissing
        }
    );

    const {
        data: fsxCredentialStatus,
        isFetching: credentialStatusLoading,
        isError: credentialStatusError
    } = useGetFsxCredentialStatusQuery(
        {
            credentialsId: credId,
            regionId: regionId,
            fsxIds: fsxIdsList.join(',')
        },
        {
            skip: skipApiCall || !fsxIdsList?.length
        }
    );

    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataMutation();
    const [getMssqlResourceDataApi] = useGetMssqlResourceDataMutation();

    useEffect(() => {
        setSkipApiCall(true);
        setDiscoveryCursor(null);
        setHostCursor(null);
        dispatch(
            setDiscoveredHosts({
                discoveredHostData: null,
                discoverHostLoading: true,
                discoverHostError
            })
        );
        dispatch(setMssqlInstancesData({}));
        setRunningInstanceList([]);
        dispatch(addDatabaseHostsList([]));
        dispatch(
            addDatabaseHosts({
                databaseHostsData: null,
                databaseHostsLoading: true,
                databaseHostsError
            })
        );
        dispatch(setMovedManagedHosts([]));
        dispatch(setUnManagedHosts([]));
        dispatch(setUnIdentifiableHosts([]));
        dispatch(setMovedToManagedHost([]));
        dispatch(setMovedToUnmanagedHost([]));
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
            setSkipDiscoveryCall(false);
            setSkipManagedHostCall(false);
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        if (databaseHostsError) {
            dispatch(addDatabaseHosts({ undefined, databaseHostsLoading, databaseHostsError }));
        } else {
            if (!databaseHostsLoading) {
                let oldList = databaseHostsData || [];
                let newList = databaseHosts?.items || [];
                if (databaseHosts && databaseHosts?.credentialId === credId && databaseHosts?.regionId === regionId) {
                    dispatch(
                        addDatabaseHosts({
                            databaseHostsData: [...oldList, ...newList],
                            databaseHostsLoading,
                            databaseHostsError
                        })
                    );
                } else {
                    dispatch(
                        addDatabaseHosts({
                            ...databaseHostState,
                            databaseHostsLoading
                        })
                    );
                }
                setHostCursor(databaseHosts?.nextToken || null);
                if (!databaseHosts?.nextToken && databaseHostsData) {
                    setSkipManagedHostCall(true);
                } else {
                    setSkipManagedHostCall(false);
                }
            } else {
                dispatch(
                    addDatabaseHosts({
                        ...databaseHostState,
                        databaseHostsLoading
                    })
                );
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    useEffect(() => {
        if (discoverHostError) {
            dispatch(setDiscoveredHosts({ ...discoveredHostState, discoverHostLoading, discoverHostError }));
        } else {
            if (!discoverHostLoading) {
                let oldList = discoveredHostData || [];
                let newList = discoveredHosts?.items || [];
                if (
                    discoveredHosts &&
                    discoveredHosts?.credentialId === credId &&
                    discoveredHosts?.regionId === regionId
                ) {
                    dispatch(
                        setDiscoveredHosts({
                            discoveredHostData: [...oldList, ...newList],
                            discoverHostLoading,
                            discoverHostError
                        })
                    );
                } else {
                    dispatch(
                        setDiscoveredHosts({
                            ...discoveredHostState,
                            discoverHostLoading
                        })
                    );
                }
                setDiscoveryCursor(discoveredHosts?.nextToken || null);
                if (!discoveredHosts?.nextToken && discoveredHostData) {
                    setSkipDiscoveryCall(true);
                } else {
                    setSkipDiscoveryCall(false);
                }
            } else {
                dispatch(
                    setDiscoveredHosts({
                        ...discoveredHostState,
                        discoverHostLoading
                    })
                );
            }
        }
    }, [discoveredHosts, discoverHostLoading, discoverHostError]);

    useEffect(() => {
        if (isRefreshed) {
            setDiscoveryCursor(null);
            setHostCursor(null);
            dispatch(
                setDiscoveredHosts({
                    discoveredHostData: null,
                    discoverHostLoading: true,
                    discoverHostError
                })
            );
            dispatch(setMssqlInstancesData({}));
            setRunningInstanceList([]);
            dispatch(addDatabaseHostsList([]));
            dispatch(
                addDatabaseHosts({
                    databaseHostsData: null,
                    databaseHostsLoading: true,
                    databaseHostsError
                })
            );
            dispatch(setMovedManagedHosts([]));
            dispatch(setUnManagedHosts([]));
            dispatch(setUnIdentifiableHosts([]));
            dispatch(setHeaderSelectedCred(null));
            dispatch(setHeaderSelectedRegion(null));
            dispatch(setMovedToManagedHost([]));
            dispatch(setMovedToUnmanagedHost([]));
            setTimeout(() => {
                dispatch(setHeaderSelectedCred(headerSelectedCred));
                dispatch(setHeaderSelectedRegion(headerSelectedRegion));
                setCredId(headerSelectedCred?.data?.credentialsId);
                setRegionId(headerSelectedRegion?.label2);
            }, 100);
            dispatch(setIsRefreshed(false));
        }
    }, [isRefreshed]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData);
        dispatch(addDatabaseHostsList(mergedData));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData]);

    useEffect(() => {
        if (!credentialStatusLoading) {
            let fsxCredStatusObj: any = {};
            fsxCredentialStatus &&
                fsxCredentialStatus.fileSystems &&
                fsxCredentialStatus.fileSystems.map((item: any) => {
                    fsxCredStatusObj[item.id] = item.isRegistered;
                });
            dispatch(setFsxCredentialStatus(fsxCredStatusObj));
        }
    }, [fsxCredentialStatus, credentialStatusLoading, credentialStatusError]);

    useEffect(() => {
        if (discoveredHostData) {
            let fsxIds: any = [];
            discoveredHostData.map((host: any) => {
                if (host?.sqlServerInstances?.[0]?.storage) {
                    host?.sqlServerInstances?.[0]?.storage.map((storageObj: any) => {
                        if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                            fsxIds.push(storageObj.id);
                        }
                    });
                }
            });
            dispatch(setFsxIdsList(fsxIds));
        }
    }, [discoveredHostData]);

    useEffect(() => {
        if (discoveredHostData && discoveredHostData.length) {
            let movedManagedHosts: any[] = [];
            let unManagedHosts: any[] = [];
            let unIdentifiableHosts: any[] = [];
            discoveredHostData.map((host: any) => {
                if (host?.sqlServerInstances && host?.sqlServerInstances?.length > 1) {
                    host = { ...host, sqlServerInstances: sortListOfDict(host?.sqlServerInstances, 'sqlServerState') };
                }
                const isWindowAuthentication = host?.sqlServerInstances?.[0]?.windowsAuthentication;
                const isSqlAuthentication = host?.sqlServerInstances?.[0]?.sqlServerAuthentication;
                const isManaged = databaseHostsData?.find(managedHost =>
                    managedHost?.topology?.ec2Details?.find(instances => instances.id === host?.ec2InstanceId)
                );
                let fsxCredentialValidationFailed = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN && !fsxCredentialStatusObj[item.id]
                );
                // FSx credential validation always passed for demo mode
                if (isDemoMode) {
                    fsxCredentialValidationFailed = false;
                }

                const managedHost = movedToManagedHost.find(
                    (perHost: any) => perHost?.instanceId === host?.ec2InstanceId
                );
                if (managedHost) {
                    host = { ...host, resourceId: managedHost?.resourceId };
                    movedManagedHosts.push(host);
                } else if (movedToUnmanagedHost.includes(host?.ec2InstanceId)) {
                    unManagedHosts.push(host);
                } else if (
                    host.ssmState !== DETECT_HOST_VAR.SSM_CONNECTED ||
                    (!isWindowAuthentication && !isSqlAuthentication) ||
                    fsxCredentialValidationFailed
                ) {
                    unIdentifiableHosts.push(host);
                } else {
                    if (!isManaged) {
                        unManagedHosts.push(host);
                    }
                }
            });
            dispatch(setUnIdentifiableHosts(unIdentifiableHosts));
            dispatch(setUnManagedHosts(unManagedHosts));
            dispatch(setMovedManagedHosts(movedManagedHosts));
        }
    }, [discoveredHostData, databaseHostsData, fsxCredentialStatusObj, movedToUnmanagedHost, movedToManagedHost]);

    const getMssqlData = async (instancesPayload: any, nextToken: string | null = '') => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                payload: { instancesDetails: instancesPayload },
                nextToken: nextToken
            });
            const state = store.getState();
            const mssqlInstancesData = state.inventory.mssqlInstancesData;
            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (mssqlInstancesData[host?.name]) {
                        mssqlInstancesDataRes[host?.name] = {
                            loading: false,
                            data: host,
                            error: host?.errors
                        };
                    }
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataRes }));
                if (result?.nextToken) {
                    getMssqlData(instancesPayload, result?.nextToken);
                }
            } else {
                let mssqlInstancesDataErr: any = {};
                instancesPayload?.map((host: any) => {
                    mssqlInstancesDataErr[host?.ec2InstanceId] = {
                        loading: false,
                        data: null,
                        error: result?.error?.data?.message
                    };
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            instancesPayload?.map((host: any) => {
                mssqlInstancesDataErr[host?.ec2InstanceId] = {
                    loading: false,
                    data: null,
                    error: error
                };
            });
            dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataErr }));
        }
    };

    useEffect(() => {
        if (unManagedHostList && unManagedHostList.length > 0) {
            let instancesPayload: any = [];
            unManagedHostList.map((host: any) => {
                const instanceId = host?.ec2InstanceId || '';
                if (instanceId && !runningInstanceList.find(inst => inst === instanceId)) {
                    setRunningInstanceList([...runningInstanceList, host?.ec2InstanceId]);
                    let fsxId = '';
                    let ebsId = '';
                    if (host?.sqlServerInstances?.[0]?.storage) {
                        host?.sqlServerInstances?.[0]?.storage.map((storageObj: any) => {
                            if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                                fsxId = storageObj.id;
                            }
                            if (storageObj.type === DETECT_HOST_VAR.EBS) {
                                ebsId = storageObj.id;
                            }
                        });
                    }
                    let instanceObj: any = { ec2InstanceId: host?.ec2InstanceId };

                    if (fsxId) {
                        instanceObj = {
                            ...instanceObj,
                            fsxnId: fsxId
                        };
                    }

                    if (ebsId) {
                        instanceObj = {
                            ...instanceObj,
                            ebsVolumeId: ebsId
                        };
                    }
                    instancesPayload.push(instanceObj);
                }
            });
            let mssqlInstancesDataLoad: any = {};
            if (instancesPayload && instancesPayload.length > 0) {
                instancesPayload?.map((host: any) => {
                    mssqlInstancesDataLoad[host?.ec2InstanceId] = {
                        loading: true,
                        data: null,
                        error: null
                    };
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataLoad }));
                setTimeout(() => {
                    getMssqlData(instancesPayload);
                }, 1);
            }
        }
    }, [unManagedHostList]);

    // It is to get other fields data for moved managed host row. It uses database-hosts api to fetch details.
    const getManagedMssqlData = async (resourceId: string, host: any) => {
        const state = store.getState();
        const fullDatabaseHostsList = state.databaseHome.databaseHostsList;
        const newResource = {
            ...host,
            loading: true,
            id: resourceId,
            error: null
        };
        dispatch(addDatabaseHostsList(addNewManagedHostData(fullDatabaseHostsList, newResource)));
        try {
            const result: any = await getMssqlResourceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                id: resourceId
            });
            if (result && !result?.error) {
                const resultData = {
                    ...result?.data,
                    loading: false
                };
                dispatch(addDatabaseHostsList(addNewManagedHostData(fullDatabaseHostsList, resultData)));
            } else {
                const failedResource = {
                    ...host,
                    loading: false,
                    id: resourceId,
                    error: null
                };
                dispatch(addDatabaseHostsList(addNewManagedHostData(fullDatabaseHostsList, failedResource)));
            }
        } catch (error) {
            const failedResource = {
                ...host,
                loading: false,
                id: resourceId,
                error: null
            };
            dispatch(addDatabaseHostsList(addNewManagedHostData(fullDatabaseHostsList, failedResource)));
        }
    };

    // If any host is moved to managed host than it will be moved and it will get added in databaseHostsList
    useEffect(() => {
        if (movedManagedHostList && movedManagedHostList.length > 0) {
            movedManagedHostList.map((host: any) => {
                const resourceId = host?.resourceId || '';
                if (resourceId && !runningResourceList.find(res => res === resourceId)) {
                    setRunningResourceList([...runningResourceList, host?.resourceId]);
                    getManagedMssqlData(host?.resourceId, host);
                } else if (!resourceId) {
                    const state = store.getState();
                    const fullDatabaseHostsList = state.databaseHome.databaseHostsList;
                    const newResource = {
                        ...host,
                        loading: false,
                        id: resourceId,
                        error: null
                    };
                    dispatch(addDatabaseHostsList(addNewManagedHostData(fullDatabaseHostsList, newResource)));
                }
            });
        }
    }, [movedManagedHostList]);

    return <></>;
};

export default InventoryApis;
