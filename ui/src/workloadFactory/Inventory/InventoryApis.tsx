import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { addDatabaseHosts, addDatabaseHostsList } from '../../store/workloadFactory/databaseHomeSlice';
import {
    useDiscoverHostsQuery,
    useGetDatabaseHostsQuery,
    useGetFsxCredentialStatusQuery
} from '../../utils/apiService';
import { mergeDatabaseHostsData, resetDBHomePageState } from '../../utils/utilityFunctions';
import {
    setDiscoveredHosts,
    setFsxCredentialStatus,
    setFsxIdsList,
    setIsRefreshed,
    setUnIdentifiableHosts,
    setUnManagedHosts
} from '../../store/workloadFactory/inventorySlice';
import { setHeaderSelectedCred, setHeaderSelectedRegion } from '../../store/workloadFactory/headersSlice';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { discoveredHostData } = useAppSelector(state => state.inventory.discoveredHosts);
    const discoveredHostState = useAppSelector(state => state.inventory.discoveredHosts);
    const databaseHostState = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { fsxIdsList, fsxCredentialStatusObj, isRefreshed } = useAppSelector(state => state.inventory);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [hostCursor, setHostCursor] = useState(null);
    const [discoveryCursor, setDiscoveryCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [skipDiscoveryCall, setSkipDiscoveryCall] = useState(false);
    const [skipManagedHostCall, setSkipManagedHostCall] = useState(false);
    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    const isCredRegionMissing = !headerSelectedCred || !headerSelectedRegion;

    useEffect(() => {
        resetDBHomePageState(dispatch);
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
        dispatch(addDatabaseHostsList([]));
        dispatch(
            addDatabaseHosts({
                databaseHostsData: null,
                databaseHostsLoading: true,
                databaseHostsError
            })
        );
        dispatch(setUnManagedHosts([]));
        dispatch(setUnIdentifiableHosts([]));
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
            dispatch(setDiscoveredHosts({ discoveredHostData: null, databaseHostsLoading, databaseHostsError }));
        } else {
            if (!discoverHostLoading) {
                let oldList = discoveredHostData || [];
                let newList = discoveredHosts?.items || [];
                if (discoveredHosts && discoveredHosts?.credentialId === credId && discoveredHosts?.regionId === regionId) {
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
            dispatch(addDatabaseHostsList([]));
            dispatch(
                addDatabaseHosts({
                    databaseHostsData: null,
                    databaseHostsLoading: true,
                    databaseHostsError
                })
            );
            dispatch(setUnManagedHosts([]));
            dispatch(setUnIdentifiableHosts([]));
            dispatch(setHeaderSelectedCred(null));
            dispatch(setHeaderSelectedRegion(null));
            setTimeout(() => {
                dispatch(setHeaderSelectedCred(headerSelectedCred));
                dispatch(setHeaderSelectedRegion(headerSelectedRegion));
                setCredId(headerSelectedCred?.data?.credentialsId);
                setRegionId(headerSelectedRegion?.label2);
            }, 100);
            dispatch(setIsRefreshed(false));
        }
    }, [isRefreshed]);

    useEffect(() => {
        setDiscoveryCursor(null);
        setHostCursor(null);
        dispatch(
            setDiscoveredHosts({
                discoveredHostData: null,
                discoverHostLoading: true,
                discoverHostError
            })
        );
        dispatch(addDatabaseHostsList([]));
        dispatch(
            addDatabaseHosts({
                databaseHostsData: null,
                databaseHostsLoading: true,
                databaseHostsError
            })
        );
        dispatch(setUnManagedHosts([]));
        dispatch(setUnIdentifiableHosts([]));
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
            setSkipDiscoveryCall(false);
            setSkipManagedHostCall(false);
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

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
                        if (storageObj.type === 'FSXN') {
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
            let unManagedHosts: any[] = [];
            let unIdentifiableHosts: any[] = [];
            discoveredHostData.map((host: any) => {
                const isWindowAuthentication = host?.sqlServerInstances?.[0]?.windowsAuthentication;
                const isManaged = databaseHostsData?.find(managedHost =>
                    managedHost?.topology?.ec2Details?.find(instances => instances.id === host?.ec2InstanceId)
                );
                let fsxCredentialValidationFailed = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === 'FSXN' && !fsxCredentialStatusObj[item.id]
                );
                // FSx credential validation always passed for demo mode
                if (isDemoMode) {
                    fsxCredentialValidationFailed = false;
                }
                if (host.ssmState !== 'connected' || !isWindowAuthentication || fsxCredentialValidationFailed) {
                    unIdentifiableHosts.push(host);
                } else {
                    if (!isManaged) {
                        unManagedHosts.push(host);
                    }
                }
            });
            dispatch(setUnIdentifiableHosts(unIdentifiableHosts));
            dispatch(setUnManagedHosts(unManagedHosts));
        }
    }, [discoveredHostData, databaseHostsData, fsxCredentialStatusObj]);

    return <></>;
};

export default InventoryApis;
