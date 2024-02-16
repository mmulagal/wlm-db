import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { addDatabaseHosts, addDatabaseHostsList } from '../../store/workloadFactory/databaseHomeSlice';
import { useGetDatabaseHostsQuery } from '../../utils/apiService';
import { mergeDatabaseHostsData } from '../../utils/utilityFunctions';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [hostCursor, setHostCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);

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
        { skip: skipApiCall }
    );

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        if (databaseHostsError) {
            dispatch(addDatabaseHosts({ undefined, databaseHostsLoading, databaseHostsError }));
        } else {
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
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData);
        dispatch(addDatabaseHostsList(mergedData));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData]);

    return <></>;
};

export default InventoryApis;
