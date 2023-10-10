import { useEffect } from "react";
import { useAppDispatch } from "../../store/storeHooks";
import { addDatabaseHosts } from "../../store/workloadFactory/databaseHomeSlice";
import { useGetDatabaseHostsQuery } from "../../utils/apiService";


const DatabaseHomeApis = () => {

    const dispatch = useAppDispatch();

    // API call to get database hosts details
    const {
        data: databaseHostsData,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery({});

    // To add database hosts list
    useEffect(() => {
        if(databaseHostsError) {
            dispatch(addDatabaseHosts({undefined, databaseHostsLoading, databaseHostsError}));
        } else {
            dispatch(addDatabaseHosts({databaseHostsData, databaseHostsLoading, databaseHostsError}));
        }
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData, databaseHostsLoading, databaseHostsError]);

    return;
};

export default DatabaseHomeApis;
