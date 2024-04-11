import { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addDatabaseHosts,
    addDatabaseHostsList,
    addDatabaseHostsLoading
} from '../../store/workloadFactory/databaseHomeSlice';
import {
    useDiscoverHostsQuery,
    useGetFsxCredentialStatusQuery,
    useGetMssqlInstanceDataMutation,
    useGetMssqlResourceDataMutation,
    useLazyGetDatabaseHostsFullDataQuery,
    useLazyGetDatabaseHostsListQuery,
    useLazyGetManagedHostDataQuery
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
    setIsManagedHostListLoading,
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

    const [getManagedHostListAPI] = useLazyGetManagedHostDataQuery();
    const [getDatabaseHostsFullDataApi] = useLazyGetDatabaseHostsFullDataQuery();
    const [getDatabaseHostsListApi] = useLazyGetDatabaseHostsListQuery();
    const [managedHostList, setManagedHostList] = useState<any>([]);
    const [managedHostListLoading, setManagedHostListLoading] = useState(true);

    const credIdRef = useRef();
    const regionIdRef = useRef();

    useEffect(() => {
        credIdRef.current = credId;
        regionIdRef.current = regionId;
    }, [credId, regionId]);

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

    // const getDatabaseHostsFullData = async (
    //     managedList: string[],
    //     managedHostCursor: string | null,
    //     runningCredId: string,
    //     runningRegionId: string
    // ) => {
    //     if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
    //         try {
    //             const result: any = await getDatabaseHostsFullDataApi({
    //                 credentialId: credId,
    //                 regionId: regionId,
    //                 nextToken: managedHostCursor
    //             });
    //             if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
    //                 if (result && !result?.error) {
    //                     result?.data?.items?.map((perRow: any) => {
    //                         if (perRow?.instances) {
    //                             managedList = [...managedList, ...perRow?.instances];
    //                         }
    //                     });
    //                     if (result?.data?.nextToken) {
    //                         getManagedHostList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
    //                     } else {
    //                         setManagedHostListLoading(false);
    //                         dispatch(setIsManagedHostListLoading(false));
    //                         setManagedHostList(managedList);
    //                     }
    //                 } else {
    //                     setManagedHostListLoading(false);
    //                     dispatch(setIsManagedHostListLoading(false));
    //                     setManagedHostList(managedList);
    //                 }
    //             }
    //         } catch (error) {
    //             setManagedHostListLoading(false);
    //             dispatch(setIsManagedHostListLoading(false));
    //             setManagedHostList(managedList);
    //         }
    //     }
    // };

    // const getDatabaseHostsList = async (
    //     managedList: string[],
    //     managedHostCursor: string | null,
    //     runningCredId: string,
    //     runningRegionId: string
    // ) => {
    //     if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
    //         try {
    //             const result: any = await getDatabaseHostsListApi({
    //                 credentialId: credId,
    //                 regionId: regionId,
    //                 nextToken: managedHostCursor
    //             });
    //             if (runningCredId === credIdRef.current && runningRegionId === regionIdRef.current) {
    //                 if (result && !result?.error) {
    //                     result?.data?.items?.map((perRow: any) => {
    //                         if (perRow?.instances) {
    //                             managedList = [...managedList, ...perRow?.instances];
    //                         }
    //                     });
    //                     if (result?.data?.nextToken) {
    //                         getManagedHostList(managedList, result?.data?.nextToken, runningCredId, runningRegionId);
    //                     } else {
    //                         setManagedHostListLoading(false);
    //                         dispatch(setIsManagedHostListLoading(false));
    //                         setManagedHostList(managedList);
    //                     }
    //                 } else {
    //                     setManagedHostListLoading(false);
    //                     dispatch(setIsManagedHostListLoading(false));
    //                     setManagedHostList(managedList);
    //                 }
    //             }
    //         } catch (error) {
    //             setManagedHostListLoading(false);
    //             dispatch(setIsManagedHostListLoading(false));
    //             setManagedHostList(managedList);
    //         }
    //     }
    // };

    useEffect(() => {
        let managedList: string[] = [];
        if (credId && regionId) {
            dispatch(setIsManagedHostListLoading(true));
            setManagedHostList([]);
            setManagedHostListLoading(true);
            getManagedHostList(managedList, null, credId, regionId);
        }
    }, [credId, regionId, isRefreshed]);

    useEffect(() => {
        resetDBHomePageState(dispatch);
        // dispatch(addDatabaseHostsLoading(databaseHostsLoading));
    }, [credId, regionId]);

    // const {
    //     data: databaseHosts,
    //     isFetching: databaseHostsLoading,
    //     isError: databaseHostsError
    // } = useGetDatabaseHostsQuery(
    //     {
    //         credentialId: credId,
    //         region: regionId,
    //         nextToken: hostCursor
    //     },
    //     { skip: skipApiCall || skipManagedHostCall || isCredRegionMissing }
    // );

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
        // dispatch(
        //     addDatabaseHosts({
        //         databaseHostsData: null,
        //         databaseHostsLoading: true,
        //         databaseHostsError
        //     })
        // );
        dispatch(setMovedManagedHosts([]));
        dispatch(setUnManagedHosts([]));
        dispatch(setUnIdentifiableHosts([]));
        dispatch(setMovedToManagedHost([]));
        dispatch(setMovedToUnmanagedHost([]));
        setRunningResourceList([]);
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
            setSkipDiscoveryCall(false);
            setSkipManagedHostCall(false);
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

    // useEffect(() => {
    //     if (databaseHostsError) {
    //         dispatch(addDatabaseHosts({ undefined, databaseHostsLoading, databaseHostsError }));
    //     } else {
    //         if (!databaseHostsLoading) {
    //             let oldList = databaseHostsData || [];
    //             let newList = databaseHosts?.items || [];
    //             if (databaseHosts && databaseHosts?.credentialId === credId && databaseHosts?.regionId === regionId) {
    //                 dispatch(
    //                     addDatabaseHosts({
    //                         databaseHostsData: [...oldList, ...newList],
    //                         databaseHostsLoading,
    //                         databaseHostsError
    //                     })
    //                 );
    //             } else {
    //                 dispatch(
    //                     addDatabaseHosts({
    //                         ...databaseHostState,
    //                         databaseHostsLoading
    //                     })
    //                 );
    //             }
    //             setHostCursor(databaseHosts?.nextToken || null);
    //             if (!databaseHosts?.nextToken && databaseHostsData) {
    //                 setSkipManagedHostCall(true);
    //             } else {
    //                 setSkipManagedHostCall(false);
    //             }
    //         } else {
    //             dispatch(
    //                 addDatabaseHosts({
    //                     ...databaseHostState,
    //                     databaseHostsLoading
    //                 })
    //             );
    //         }
    //     }
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

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
            // dispatch(
            //     addDatabaseHosts({
            //         databaseHostsData: null,
            //         databaseHostsLoading: true,
            //         databaseHostsError
            //     })
            // );
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
                    host?.sqlServerInstances?.[0]?.storage?.map((storageObj: any) => {
                        if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                            fsxIds.push(storageObj.id);
                        }
                    });
                }
            });
            dispatch(setFsxIdsList(fsxIds));
        }
    }, [discoveredHostData]);

    // This function is used to find nodes available in managed or unmanaged tab. In that case Partner node will be added in removeRows list.
    const getPrimaryClusterNode = (newDiscoveredHostData: any, removeRows: any, managedHostsList: string[]) => {
        let testedNodes: string[] = [];
        newDiscoveredHostData.map((host: any) => {
            if (host?.nodesList) {
                if (testedNodes.includes(host?.ec2InstanceId)) {
                    return;
                }

                // To find partner node in a cluster
                const partnerNode = newDiscoveredHostData.filter((perHost: any) => {
                    const isSameCluster = host?.nodesList.filter((val: any) => {
                        return (
                            perHost?.ec2InstanceId !== host?.ec2InstanceId &&
                            perHost?.nodesList &&
                            perHost.nodesList.includes(val)
                        );
                    });
                    if (isSameCluster && isSameCluster.length > 0) {
                        return perHost;
                    } else {
                        return;
                    }
                })?.[0];

                if (!partnerNode) {
                    return;
                }

                testedNodes.push(host?.ec2InstanceId);
                testedNodes.push(partnerNode?.ec2InstanceId);

                // To check if node or partner node is already in managed host. Ignore other node if is already available in Managed host.
                const isManagedNode1 = managedHostsList.includes(host?.ec2InstanceId);
                const isManagedNode2 = managedHostsList.includes(partnerNode?.ec2InstanceId);

                if ((isManagedNode1 && isManagedNode2) || (isManagedNode1 && !isManagedNode2)) {
                    removeRows.push(partnerNode?.ec2InstanceId);
                    return;
                } else if (!isManagedNode1 && isManagedNode2) {
                    removeRows.push(host?.ec2InstanceId);
                    return;
                }

                // To check if node or partner node is moved to managed host. Ignore other node if is already moved in Managed host.
                const managedHostNode1 = movedToManagedHost.find(
                    (perHost: any) => perHost?.instanceId === host?.ec2InstanceId
                );
                const managedHostNode2 = movedToManagedHost.find(
                    (perHost: any) => perHost?.instanceId === partnerNode?.ec2InstanceId
                );

                if ((managedHostNode1 && managedHostNode2) || (managedHostNode1 && !managedHostNode2)) {
                    removeRows.push(partnerNode?.ec2InstanceId);
                    return;
                } else if (!managedHostNode1 && managedHostNode2) {
                    removeRows.push(host?.ec2InstanceId);
                    return;
                }

                // To check if node or partner node is available to unmanaged host. Ignore other node if is already available in UnManaged host.
                const isWindowAuthenticationNode1 = host?.sqlServerInstances?.[0]?.windowsAuthentication;
                const isSqlAuthenticationNode1 = host?.sqlServerInstances?.[0]?.sqlServerAuthentication;
                let fsxCredentialValidationFailedNode1 = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN && !fsxCredentialStatusObj[item.id]
                );
                let storageTypeCheckNode1 = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) =>
                        item.type === DETECT_HOST_VAR.FSXN ||
                        item.type === DETECT_HOST_VAR.FSXW ||
                        item.type === DETECT_HOST_VAR.EBS
                );
                const unmanagedHost1 = !(
                    host.ssmState !== DETECT_HOST_VAR.SSM_CONNECTED ||
                    (!isWindowAuthenticationNode1 && !isSqlAuthenticationNode1) ||
                    fsxCredentialValidationFailedNode1 ||
                    !storageTypeCheckNode1
                );

                const isWindowAuthenticationNode2 = partnerNode?.sqlServerInstances?.[0]?.windowsAuthentication;
                const isSqlAuthenticationNode2 = partnerNode?.sqlServerInstances?.[0]?.sqlServerAuthentication;
                let fsxCredentialValidationFailedNode2 = partnerNode?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN && !fsxCredentialStatusObj[item.id]
                );
                let storageTypeCheckNode2 = partnerNode?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) =>
                        item.type === DETECT_HOST_VAR.FSXN ||
                        item.type === DETECT_HOST_VAR.FSXW ||
                        item.type === DETECT_HOST_VAR.EBS
                );
                const unmanagedHost2 = !(
                    partnerNode.ssmState !== DETECT_HOST_VAR.SSM_CONNECTED ||
                    (!isWindowAuthenticationNode2 && !isSqlAuthenticationNode2) ||
                    fsxCredentialValidationFailedNode2 ||
                    !storageTypeCheckNode2
                );

                if ((unmanagedHost1 && unmanagedHost2) || (unmanagedHost1 && !unmanagedHost2)) {
                    removeRows.push(partnerNode?.ec2InstanceId);
                    return;
                } else if (!unmanagedHost1 && unmanagedHost2) {
                    removeRows.push(host?.ec2InstanceId);
                    return;
                }

                // To check if node or partner node is moved to unmanaged host. Ignore other node if is already moved to UnManaged host.
                const unmanagedHostNode1 = movedToUnmanagedHost.includes(host?.ec2InstanceId);
                const unmanagedHostNode2 = movedToUnmanagedHost.includes(partnerNode?.ec2InstanceId);
                if ((unmanagedHostNode1 && unmanagedHostNode2) || (unmanagedHostNode1 && !unmanagedHostNode2)) {
                    removeRows.push(partnerNode?.ec2InstanceId);
                    return;
                } else if (!unmanagedHostNode1 && unmanagedHostNode2) {
                    removeRows.push(host?.ec2InstanceId);
                    return;
                }

                // In case if both nodes are in Undetected Tab than it needs to show both.
            }
        });
        return;
    };

    useEffect(() => {
        if (!managedHostListLoading && discoveredHostData && discoveredHostData.length) {
            let newDiscoveredHostData: any = [];
            discoveredHostData.map((host: any) => {
                if (host?.sqlServerInstances) {
                    // sort sqlServerInstances so every time it picks first running
                    if (host?.sqlServerInstances && host?.sqlServerInstances?.length > 1) {
                        host = {
                            ...host,
                            sqlServerInstances: sortListOfDict(host?.sqlServerInstances, 'sqlServerState')
                        };
                    }
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

            // This function is used to find nodes available in managed or unmanaged tab. In that case Partner node will be added in removeRows list.
            getPrimaryClusterNode(newDiscoveredHostData, removeRows, managedHostList);

            let movedManagedHosts: any[] = [];
            let unManagedHosts: any[] = [];
            let unIdentifiableHosts: any[] = [];
            newDiscoveredHostData.map((host: any) => {
                if (removeRows.includes(host?.ec2InstanceId)) {
                    return;
                }
                const isWindowAuthentication = host?.sqlServerInstances?.[0]?.windowsAuthentication;
                const isSqlAuthentication = host?.sqlServerInstances?.[0]?.sqlServerAuthentication;
                let fsxCredentialValidationFailed = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === DETECT_HOST_VAR.FSXN && !fsxCredentialStatusObj[item.id]
                );
                let storageTypeCheck = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) =>
                        item.type === DETECT_HOST_VAR.FSXN ||
                        item.type === DETECT_HOST_VAR.FSXW ||
                        item.type === DETECT_HOST_VAR.EBS
                );
                // FSx credential validation always passed for demo mode
                if (isDemoMode) {
                    fsxCredentialValidationFailed = isWindowAuthentication ? false : true;
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
                    !managedHostList.includes(host?.ec2InstanceId) &&
                    (host.ssmState !== DETECT_HOST_VAR.SSM_CONNECTED ||
                        (!isWindowAuthentication && !isSqlAuthentication) ||
                        fsxCredentialValidationFailed ||
                        !storageTypeCheck)
                ) {
                    unIdentifiableHosts.push(host);
                } else {
                    if (!managedHostList.includes(host?.ec2InstanceId)) {
                        unManagedHosts.push(host);
                    }
                }
            });
            dispatch(setUnIdentifiableHosts(unIdentifiableHosts));
            dispatch(setUnManagedHosts(unManagedHosts));
            dispatch(setMovedManagedHosts(movedManagedHosts));
        }
    }, [
        discoveredHostData,
        databaseHostsData,
        fsxCredentialStatusObj,
        movedToUnmanagedHost,
        movedToManagedHost,
        managedHostListLoading
    ]);

    const getMssqlData = async (instanceList: any, nextToken: string | null = '') => {
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: instanceList.join(','),
                nextToken: nextToken
            });
            const state = store.getState();
            const mssqlInstancesData = state.inventory.mssqlInstancesData;
            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (mssqlInstancesData[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            loading: false,
                            data: host,
                            error: host?.errors
                        };
                    }
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataRes }));
                if (result?.data?.nextToken) {
                    getMssqlData(instanceList, result?.data?.nextToken);
                }
            } else {
                let mssqlInstancesDataErr: any = {};
                instanceList?.map((ec2InstanceId: any) => {
                    mssqlInstancesDataErr[ec2InstanceId] = {
                        loading: false,
                        data: null,
                        error: result?.error?.data?.message
                    };
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            instanceList?.map((ec2InstanceId: any) => {
                mssqlInstancesDataErr[ec2InstanceId] = {
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
            let instancesList: any = [];
            unManagedHostList.map((host: any) => {
                const instanceId = host?.ec2InstanceId || '';
                if (instanceId && !runningInstanceList.find(inst => inst === instanceId)) {
                    setRunningInstanceList([...runningInstanceList, host?.ec2InstanceId]);
                    instancesList.push(host?.ec2InstanceId);
                }
            });
            let mssqlInstancesDataLoad: any = {};
            if (instancesList && instancesList.length > 0) {
                instancesList?.map((ec2InstanceId: any) => {
                    mssqlInstancesDataLoad[ec2InstanceId] = {
                        loading: true,
                        data: null,
                        error: null
                    };
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataLoad }));
                setTimeout(() => {
                    getMssqlData(instancesList);
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
