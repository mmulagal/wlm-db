import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { addDatabaseHosts, addDatabaseHostsList } from '../../store/workloadFactory/databaseHomeSlice';
import { useDiscoverHostsQuery, useGetDatabaseHostsQuery } from '../../utils/apiService';
import { mergeDatabaseHostsData } from '../../utils/utilityFunctions';
import {
    setDiscoveredHosts,
    setUnIdentifiableHosts,
    setUnManagedHosts
} from '../../store/workloadFactory/inventorySlice';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { discoveredHostData } = useAppSelector(state => state.inventory.discoveredHosts);

    const [hostCursor, setHostCursor] = useState(null);
    const [discoveryCursor, setDiscoveryCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [skipDiscoveryCall, setSkipDiscoveryCall] = useState(false);
    const [skipManagedHostCall, setSkipManagedHostCall] = useState(false);

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
        { skip: skipApiCall || skipManagedHostCall }
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
            skip: skipApiCall || skipDiscoveryCall
        }
    );

    useEffect(() => {
        setDiscoveryCursor(null);
        setHostCursor(null);
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
            setSkipDiscoveryCall(false);
            setSkipManagedHostCall(false);
            dispatch(
                setDiscoveredHosts({
                    discoveredHostData: null,
                    discoverHostLoading: true,
                    discoverHostError
                })
            );
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
                        discoveredHostData,
                        discoverHostLoading,
                        discoverHostError
                    })
                );
            }
        }
    }, [discoveredHosts, discoverHostLoading, discoverHostError]);

    useEffect(() => {
        if (discoveredHostData && discoveredHostData.length) {
            let unManagedHosts: any[] = [];
            let unIdentifiableHosts: any[] = [];
            discoveredHostData.map((host: any) => {
                const isWindowAuthentication = host?.sqlServerInstances?.[0]?.windowsAuthentication;
                if (host.ssmState !== 'connected' || !isWindowAuthentication) {
                    unIdentifiableHosts.push(host);
                } else {
                    unManagedHosts.push(host);
                }
            });
            dispatch(setUnIdentifiableHosts(unIdentifiableHosts));
            dispatch(setUnManagedHosts(unManagedHosts));
        }
    }, [discoveredHostData]);

    return <></>;
};

export default InventoryApis;
