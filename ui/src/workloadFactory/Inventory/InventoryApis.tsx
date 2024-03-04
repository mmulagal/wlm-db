import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { addDatabaseHosts, addDatabaseHostsList } from '../../store/workloadFactory/databaseHomeSlice';
import {
    useDiscoverHostsQuery,
    useGetDatabaseHostsQuery,
    useGetFsxCredentialStatusQuery
} from '../../utils/apiService';
import { mergeDatabaseHostsData } from '../../utils/utilityFunctions';
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
    const { fsxIdsList, fsxCredentialStatusObj, isRefreshed } = useAppSelector(state => state.inventory);

    const [hostCursor, setHostCursor] = useState(null);
    const [discoveryCursor, setDiscoveryCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [skipDiscoveryCall, setSkipDiscoveryCall] = useState(false);
    const [skipManagedHostCall, setSkipManagedHostCall] = useState(false);

    const isCredRegionMissing = !headerSelectedCred || !headerSelectedRegion;

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
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
            credentialsId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2,
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
            credentialsId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2,
            fsxIds: fsxIdsList.join(',')
        },
        {
            skip: skipApiCall || !fsxIdsList?.length
        }
    );

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
                dispatch(
                    addDatabaseHosts({
                        databaseHostsData: [...oldList, ...newList],
                        databaseHostsLoading,
                        databaseHostsError
                    })
                );
                setHostCursor(databaseHosts?.nextToken || null);
                if (!databaseHosts?.nextToken && databaseHostsData) {
                    setSkipManagedHostCall(true);
                } else {
                    setSkipManagedHostCall(false);
                }
            } else {
                dispatch(
                    addDatabaseHosts({
                        databaseHostsData,
                        databaseHostsLoading,
                        databaseHostsError
                    })
                );
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData);
        dispatch(addDatabaseHostsList(mergedData));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData]);

    useEffect(() => {
        if (discoverHostError) {
            dispatch(setDiscoveredHosts({ discoveredHostData: null, databaseHostsLoading, databaseHostsError }));
        } else {
            if (!discoverHostLoading) {
                let oldList = discoveredHostData || [];
                let newList = discoveredHosts?.items || [];
                dispatch(
                    setDiscoveredHosts({
                        discoveredHostData: [...oldList, ...newList],
                        discoverHostLoading,
                        discoverHostError
                    })
                );
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
                const fsxCredentialValidationFailed = host?.sqlServerInstances?.[0]?.storage?.find(
                    (item: any) => item.type === 'FSXN' && !fsxCredentialStatusObj[item.id]
                );
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
