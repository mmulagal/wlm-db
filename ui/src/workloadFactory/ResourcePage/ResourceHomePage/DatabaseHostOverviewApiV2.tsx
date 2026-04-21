import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../store/storeHooks';
import {
    useGenerateDiagramMutation,
    useLazyGetDatabaseListV2Query,
    useLazyGetOfflineMssqlAssessmentDatabasesByInstanceQuery,
    useLazyGetResourceDetailsV2Query
} from '../../../utils/apiService';
import {
    resetWorkloadFactoryResourceData,
    setDatabaseList,
    setDatabaseListLoading,
    setDiagramImageData,
    setIsResourceRefresh,
    setReplicaDatabasesLoading,
    setReplicaDatabasesMap,
    setResourceDetails,
    setResourceLoading
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { blobToDataURL, isAoagDeploymentType } from '../../../utils/utilityFunctions';
import { AoagClusterNode, WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';

const DatabaseHostOverviewApiV2 = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        isResourceRefresh,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    const {
        visitedTabs,
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance,
        isWad
    } = useAppSelector(state => state.getWellOptimize);

    const [resourceDetailsApi] = useLazyGetResourceDetailsV2Query();
    const [databaseListApi] = useLazyGetDatabaseListV2Query();
    const [offlineMssqlDatabasesByInstanceApi] = useLazyGetOfflineMssqlAssessmentDatabasesByInstanceQuery();
    const [generateDiagramAPI] = useGenerateDiagramMutation();

    useEffect(() => {
        if (!visitedTabs.Overview) {
            viewResourceAction();
        }
    }, [visitedTabs]);

    useEffect(() => {
        if (isResourceRefresh) {
            viewResourceAction();
            dispatch(setIsResourceRefresh(false));
        }
    }, [isResourceRefresh]);

    const runGenerateDiagramApi = async () => {
        try {
            const response: any = await generateDiagramAPI({
                credentialId: selectedResourceCredId || credIdFromJM,
                regionId: selectedResourceRegionId || regionFromJM,
                databaseHostId: selectedResourceId || getWellResourceId
            }).unwrap();

            const dataUrl = await blobToDataURL(response);

            dispatch(setDiagramImageData(dataUrl));
        } catch (error) {
            return null;
        }
    };

    const fetchReplicaDatabases = async (
        clusterNodes: AoagClusterNode[],
        currentResourceId: string,
        credentialId: string,
        region: string
    ) => {
        dispatch(setReplicaDatabasesLoading(true));
        try {
            const replicaNodes = clusterNodes.filter(
                (node: AoagClusterNode) =>
                    node.databaseHostId && node.databaseInstanceId && node.databaseHostId !== currentResourceId
            );

            if (replicaNodes.length === 0) {
                dispatch(setReplicaDatabasesMap({}));
                return;
            }

            const replicaMap: Record<string, WorkloadFactoryDatabaseItem[]> = {};
            let failedCount = 0;
            await Promise.allSettled(
                replicaNodes.map(async (node: AoagClusterNode) => {
                    try {
                        const result: any = await databaseListApi({
                            credentialId,
                            region,
                            id: node.databaseHostId,
                            sqlInstanceId: node.databaseInstanceId,
                            fields: true,
                            includeAoag: true
                        });
                        if (result && !result?.error) {
                            const databases = (result?.data?.items || []).map((db: WorkloadFactoryDatabaseItem) => ({
                                ...db,
                                replicaHostName: node.node || node.memberName
                            }));
                            replicaMap[`${node.databaseHostId}_${node.databaseInstanceId}`] = databases;
                        } else {
                            failedCount++;
                            console.warn('Failed to fetch replica databases for AOAG node', {
                                databaseHostId: node.databaseHostId,
                                databaseInstanceId: node.databaseInstanceId
                            });
                        }
                    } catch (error) {
                        failedCount++;
                        console.warn('Failed to fetch replica databases for AOAG node', {
                            databaseHostId: node.databaseHostId,
                            databaseInstanceId: node.databaseInstanceId,
                            error
                        });
                    }
                })
            );
            dispatch(setReplicaDatabasesMap(replicaMap));
            if (failedCount > 0) {
                dispatch(
                    addNotification({
                        message: t('databases.general.failed-to-fetch-replica-databases'),
                        notificationType: NOTIFICATION_TYPES.ERROR
                    })
                );
            }
        } catch (error) {
            console.warn('Failed to fetch AOAG replica databases', { currentResourceId, error });
            dispatch(setReplicaDatabasesMap({}));
            dispatch(
                addNotification({
                    message: t('databases.general.failed-to-fetch-replica-databases'),
                    notificationType: NOTIFICATION_TYPES.ERROR
                })
            );
        } finally {
            dispatch(setReplicaDatabasesLoading(false));
        }
    };

    const runResourceDetailsApi = async () => {
        try {
            const credentialId = selectedResourceCredId || credIdFromJM;
            const region = selectedResourceRegionId || regionFromJM;
            const currentInstanceId = selectedDatabaseInstance || getWellSelectedDatabaseInstance;

            const result: any = await resourceDetailsApi({
                credentialId,
                region,
                id: selectedResourceId || getWellResourceId,
                sqlInstanceId: currentInstanceId
            });
            if (result && !result?.error) {
                const resourceData = {
                    ...result?.data,
                    topology: {
                        ...result?.data?.databaseInstanceTopology,
                        ...result?.data?.nodeTopology
                    }
                };
                dispatch(setResourceDetails(resourceData));
                dispatch(setResourceLoading(false));

                if (
                    isAoagDeploymentType(result?.data?.sqlServerDeploymentType) &&
                    result?.data?.aoagClusterNodeDetails?.length > 0
                ) {
                    const currentResourceId = selectedResourceId || getWellResourceId;
                    fetchReplicaDatabases(result.data.aoagClusterNodeDetails, currentResourceId, credentialId, region);
                }
            } else {
                dispatch(setResourceLoading(false));
            }
        } catch (error) {
            dispatch(setResourceLoading(false));
        }
    };

    const runDatabaseDetailsApi = async () => {
        try {
            const result: any = await databaseListApi({
                credentialId: selectedResourceCredId || credIdFromJM,
                region: selectedResourceRegionId || regionFromJM,
                id: selectedResourceId || getWellResourceId,
                sqlInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                fields: true,
                includeAoag: true
            });
            if (result && !result?.error) {
                dispatch(setDatabaseList(result?.data?.items || []));
                dispatch(setDatabaseListLoading(false));
            } else {
                dispatch(setDatabaseListLoading(false));
            }
        } catch (error) {
            dispatch(setDatabaseListLoading(false));
        }
    };

    // One-time WAD (MSSQL) flow: hit the offline-assessment databases API scoped by host + instance.
    // The regular overview / AOAG replica calls don't apply to offline assessments.
    const runOfflineMssqlDatabasesApi = async () => {
        try {
            const hostId = selectedResourceId || getWellResourceId;
            const instanceId = selectedDatabaseInstance || getWellSelectedDatabaseInstance;
            if (!hostId || !instanceId) {
                return;
            }
            const result: any = await offlineMssqlDatabasesByInstanceApi({ hostId, instanceId });
            if (result && !result?.error) {
                const rawDatabases = result?.data?.databases || result?.data?.items || [];
                const databases = rawDatabases.map((db: any) => ({ ...db, isWad: true }));
                dispatch(setDatabaseList(databases));
            }
        } catch (error) {
            dispatch(setDatabaseListLoading(false));
            dispatch(setResourceLoading(false));
        } finally {
            dispatch(setDatabaseListLoading(false));
            dispatch(setResourceLoading(false));
        }
    };

    const viewResourceAction = () => {
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setDatabaseListLoading(true));
        dispatch(setResourceLoading(true));
        if (isWad) {
            runOfflineMssqlDatabasesApi();
            return;
        }
        runResourceDetailsApi();
        runDatabaseDetailsApi();
    };
};

export default DatabaseHostOverviewApiV2;
