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
    resourceApi,
    useRemoveMSSQLMutation
} from '../../utils/apiService';
import { BatchEntry, Method } from '../../utils/types/resourceTypes';
import { addNotification, NOTIFICATION_TYPES, clearNotifications } from '../../store/notificationSlice';
import { useDispatch } from 'react-redux';
import { resetMssqlTables } from '../../store/resource/resourceSlice';
import { Spinner, useDialog } from '@netapp/design-system'; 
import { cmNavigateTo } from '../../utils/appConfig';
import { GENERAL } from '../../utils/appConstants';
import DialogComponent from '../../common/Dialog/DialogComponent';
import RemoveDialog from './RemoveDialog/RemoveDialog';

const ResourcePage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [removeMssql] = useRemoveMSSQLMutation();
    const [batchTables] = useBatchTablesMutation();
    const {setDialog} = useDialog();

    useEffect(() => {
        navigate('overview');
    }, []);

    const {resourceId, resourceName} = useAppSelector(state => state.auth);
    const {tables, ready} = useAppSelector(state => state.resources)

    //To fetch databases
    const {
        data: databases,
        isLoading: databasesLoading,
        refetch: databasesRefetch
    } = useGetMSSQLDatabasesQuery(resourceId);

    //To fetch summary data
    const {
        data: mssqlSummary,
        isLoading: mssqlSummaryLoading,
        refetch: mssqlSummaryRefetch
    } = useGetMSSQLSummaryQuery(resourceId);

    // To fetch CPU utilization data
    const {
        data: mssqlCpu,
        isLoading: mssqlCpuLoading,
        refetch: mssqlCpuRefetch
    } = useGetMSSQLCpuUtilizationQuery(resourceId);

    // To fetch disk utilization data
    const {
        data: mssqlDisk,
        isLoading: mssqlDiskLoading,
        refetch: mssqlDiskRefetch
    } = useGetMSSQLDiskUtilizationQuery(resourceId);

    // To fetch memory utilization data
    const {
        data: mssqlMemory,
        isLoading: mssqlMemoryLoading,
        refetch: mssqlMemoryRefetch
    } = useGetMSSQLMemoryUtilizationQuery(resourceId);

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

    const deleteMssqlResource = async () => {
        try {
            await removeMssql(resourceId).unwrap();
            cmNavigateTo('/');
        } catch (error) {
            dispatch(addNotification({message: error, notificationType: NOTIFICATION_TYPES.ERROR}));
        }
    }

    const onDeleteMssql = (event: any) => {
        setDialog(
            <DialogComponent
                header={GENERAL.REMOVE_FROM_WORKSPACE}
                content={<RemoveDialog weType={GENERAL.MSSQL}
                name={resourceName!}/>}
                primaryButton={GENERAL.REMOVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    deleteMssqlResource();
                }}
            />
        );
    };

    // To fetch tables data
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
                    dispatch(addNotification({message: error?.data?.message, notificationType: NOTIFICATION_TYPES.ERROR}));
                })
        };
    }, [databases?.databases, resourceId, batchTables, loading, navigate, dispatch]);

    return (
        <div className={styles.resourcePageContainer}>
            <ResourceHeader name={resourceName} refresh={refresh} onDeleteMssql={(e) => onDeleteMssql(e)}/>
            {loading && (
                <div className={styles['loading-screen']}>
                    <Spinner isLarge
                        className={styles['general-loader']}
                    />
                </div>
            )}
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
