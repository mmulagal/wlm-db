import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import ResourceHeader from './ResourceHeader/ResourceHeader';
import styles from './ResourcePage.module.scss';
import { useAppSelector } from '../../store/storeHooks';
import {
    useGetMSSQLDatabasesQuery,
    useGetMSSQLSummaryQuery,
    useGetMSSQLCpuUtilizationQuery,
    useGetMSSQLDiskUtilizationQuery,
    useGetMSSQLMemoryUtilizationQuery,
    useBatchTablesMutation,
    resourceApi
} from '../../utils/apiService';
import { BatchEntry, Method } from '../../utils/types/resourceTypes';
import { addNotification, NOTIFICATION_TYPES, clearNotifications } from '../../store/notificationSlice';
import { useDispatch } from 'react-redux';
import { resetMssqlTables } from '../../store/resource/resourceSlice';

const ResourcePage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        navigate('overview');
    }, []);

    const {resourceId, resourceName} = useAppSelector(state => state.auth);
    const {tables, ready} = useAppSelector(state => state.resources)

    const {
        data: databases,
        isLoading: databasesLoading,
        refetch: databasesRefetch
    } = useGetMSSQLDatabasesQuery(resourceId);

    const {
        data: mssqlSummary,
        isLoading: mssqlSummaryLoading,
        refetch: mssqlSummaryRefetch
    } = useGetMSSQLSummaryQuery(resourceId);

    const {
        data: mssqlCpu,
        isLoading: mssqlCpuLoading,
        refetch: mssqlCpuRefetch
    } = useGetMSSQLCpuUtilizationQuery(resourceId);

    const {
        data: mssqlDisk,
        isLoading: mssqlDiskLoading,
        refetch: mssqlDiskRefetch
    } = useGetMSSQLDiskUtilizationQuery(resourceId);

    const {
        data: mssqlMemory,
        isLoading: mssqlMemoryLoading,
        refetch: mssqlMemoryRefetch
    } = useGetMSSQLMemoryUtilizationQuery(resourceId);

    const [batchTables] = useBatchTablesMutation();

    const loading = databasesLoading || mssqlSummaryLoading || mssqlCpuLoading || 
    mssqlDiskLoading || mssqlMemoryLoading;

    const [batchingCompleted, setBatchingCompleted] = useState(false);

    const databasesList = databases ? databases.databases : [];

    const refresh = () => {
        dispatch(clearNotifications());
        dispatch(resourceApi.util.resetApiState());
        dispatch(resetMssqlTables());
        setBatchingCompleted(false);
        databasesRefetch();
        mssqlSummaryRefetch();
        mssqlCpuRefetch();
        mssqlDiskRefetch();
        mssqlMemoryRefetch();
    };

    useEffect(() => {
        if(databases?.databases.length > 0){
            const tablesBatchBody: BatchEntry[] = databases.databases.map((databaseRow: any) => {
                const databaseName = databaseRow?.databaseName;
                return {
                    url: `mssql/${resourceId}/${databaseName}/tables`,
                    method: Method.GET,
                    inputs: {databaseName}
                }
            });
            const chunkData = [];
            const chunkSize = 30;
            for (let i = 0; i < tablesBatchBody.length; i += chunkSize) {
                const chunk = tablesBatchBody.slice(i, i + chunkSize);
                chunkData.push(chunk);
            }
            const tablesChunks: BatchEntry[][] = chunkData;
            batchTables(tablesChunks).unwrap()
                .then(() => {
                    setBatchingCompleted(true);
                })
                .catch(error => {
                    dispatch(addNotification({children: error.message, type: NOTIFICATION_TYPES.ERROR}));
                })
        };
    }, [databases?.databases, resourceId, batchTables, loading, navigate, dispatch]);

    return (
        <div className={styles.resourcePageContainer}>
            <ResourceHeader name={resourceName} refresh={refresh}/>
            {!loading && <Outlet
                context={{
                    databasesList,
                    tables,
                    ready,
                    mssqlSummary,
                    mssqlCpu,
                    mssqlDisk,
                    mssqlMemory,
                    batchingCompleted: batchingCompleted || databasesList.length === 0,
                }}
            />}
        </div>
    );
};

export default ResourcePage;
