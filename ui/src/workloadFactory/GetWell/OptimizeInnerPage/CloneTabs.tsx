import { useDispatch } from 'react-redux';
import { Button, DsTypography, useDialog } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import styles from './OptimizeInnerPage.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setInProgressResourceOptimizeData,
    setJobToInstanceMapForBulk,
    setOptimizingData,
    setOptimizingInstanceData,
    setSelectedCloneTab
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import CloneInsideWF from './InnerTables/CloneInsideWF';
import CloneOutsideWF from './InnerTables/CloneOutsideWF';
import { GENERAL } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { useLazyGetSubTaskListQuery, useOptimizeCloneCleanupMutation } from '../../../utils/apiService';
import {
    ASSESSMENT_CONFIG_NAMES,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { handleOptimizeResourceJob, nameToIdConfigMapping } from '../GetWellUtils';
import store from '../../../store/store';
import { cloneAgeRange } from '../../../utils/utilityFunctions';

const CloneTabs = ({ fromPage = '' }: any) => {
    const dispatch = useDispatch();
    const { selectedCloneTab } = useAppSelector(state => state.getWellOptimize);
    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { cloneDashboardData, cloneIsOptimizedRows } = useAppSelector(state => state.getWellOptimize);
    const { inProgressOptimizationData, inProgressHostData, inProgressResourceOptimizeData } = useAppSelector(
        state => state.getWellOptimize
    );
    const [wfDatabase, setWfDatabase] = useState<any>(null);
    const [otherDatabase, setOtherDatabase] = useState<any>(null);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const [cloneCleanupOptimizeApi] = useOptimizeCloneCleanupMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const { setDialog, closeDialog } = useDialog();

    useEffect(() => {
        const wfDbItems: any = [];
        const otherDbItems: any = [];
        cloneDashboardData?.objectsInViolation?.map((item: any) => {
            const sourceVolumeNames = item?.clonedVolumeDetails?.map((detail: any) => detail?.sourceVolumeName) || [];
            if (item?.isOptimized) {
                return;
            }
            if (item?.clonedBy === 'netapp_wf') {
                wfDbItems.push({
                    ...item,
                    id: `${item?.resourceId}_${item?.instanceId}_${item?.cloneDatabaseName}`,
                    sourceVolumeNamesList: sourceVolumeNames.join(','),
                    cloneAgeFilterData: cloneAgeRange(item?.cloneAge)
                });
            } else {
                otherDbItems.push({
                    ...item,
                    id: `${item?.resourceId}_${item?.instanceId}_${item?.cloneDatabaseName}`,
                    sourceVolumeNamesList: sourceVolumeNames.join(','),
                    cloneAgeFilterData: cloneAgeRange(item?.cloneAge)
                });
            }
        });
        setWfDatabase(wfDbItems);
        setOtherDatabase(otherDbItems);
    }, [cloneDashboardData]);

    // Function to get unique instance row
    const getBulkInstanceList = (jobData: any[], name: string) => {
        const instanceList: any = [];

        jobData.forEach(({ configurationName, databaseHosts }) => {
            databaseHosts.forEach((host: any) => {
                host.sqlServerInstances.forEach((instance: any) => {
                    instanceList.push({
                        id: configurationName,
                        name,
                        hostId: host.id,
                        instanceId: instance?.instanceId,
                        credentialId: host?.credentialsId,
                        regionId: host?.region,
                        clones: instance?.clones
                    });
                });
            });
        });

        return instanceList;
    };

    const callCloneOptimizeApi = (actionType: string, operation: any, rowData: any) => {
        // Group data by unique combination of databaseHostId, regionId, and credentialId
        const groupedData = rowData?.reduce((acc: any, data: any) => {
            const hostKey = uniqueHostRow(data?.resourceId, data?.credentialId, data?.regionId);
            if (!acc[hostKey]) {
                acc[hostKey] = {
                    id: data?.resourceId,
                    region: data?.regionId,
                    credentialsId: data?.credentialId,
                    sqlServerInstances: {}
                };
            }

            // Group clones by instanceId
            const instanceKey = data?.instanceId;
            if (!acc[hostKey]?.sqlServerInstances[instanceKey]) {
                acc[hostKey].sqlServerInstances[instanceKey] = {
                    instanceId: data?.instanceId,
                    clones: []
                };
            }

            acc[hostKey].sqlServerInstances[instanceKey].clones.push({
                cloneDatabaseName: data?.cloneDatabaseName,
                clonedBy: data?.clonedBy,
                action: actionType.toLowerCase()
            });

            return acc;
        }, {});

        // Convert grouped data into the desired payload structure
        const payload = {
            hostsToOptimize: [
                {
                    configurationName: 'clone',
                    databaseHosts: Object.values(groupedData).map((host: any) => ({
                        ...host,
                        sqlServerInstances: Object.values(host?.sqlServerInstances)
                    }))
                }
            ]
        };

        // call optimize api
        dispatch(setOptimizingInstanceData(true));

        dispatch(
            setOptimizingData({
                ...optimizingData,
                [nameToIdConfigMapping(ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT)]: 'optimizing'
            })
        );

        const hostIds = payload?.hostsToOptimize?.[0]?.databaseHosts.map((host: any) => host?.id);
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: [
                    ...(inProgressHostData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT] || []),
                    ...hostIds
                ]
            })
        );
        const hostinstances = payload?.hostsToOptimize?.flatMap((host: any) =>
            host?.databaseHosts?.flatMap((databaseHost: any) =>
                databaseHost?.sqlServerInstances.map((instance: any) => `${databaseHost?.id}_${instance?.instanceId}`)
            )
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: [
                    ...(inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT] || []),
                    ...hostinstances
                ]
            })
        );
        const resourceInstances = payload?.hostsToOptimize?.flatMap((host: any) =>
            host?.databaseHosts?.flatMap((databaseHost: any) =>
                databaseHost?.sqlServerInstances?.flatMap((instance: any) =>
                    instance?.clones?.map(
                        (clone: any) => `${databaseHost?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`
                    )
                )
            )
        );
        dispatch(
            setInProgressResourceOptimizeData({
                ...inProgressResourceOptimizeData,
                [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: [
                    ...(inProgressResourceOptimizeData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT] || []),
                    ...resourceInstances
                ]
            })
        );

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));

                                const path = isWorkloadFactory
                                    ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                    : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: { pathname: path, replace: true }
                                });
                                dispatch(clearNotifications());
                            }}
                        >
                            {GENERAL.JOB_MONITORING}.
                        </Button>
                    </div>
                )
            })
        );

        // Call the API with the payload
        cloneCleanupOptimizeApi({ payload }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            const path = isWorkloadFactory
                                ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: { pathname: path, replace: true }
                            });
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            if (!res.error) {
                const state = store.getState();
                dispatch(
                    setJobToInstanceMapForBulk({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: payload?.hostsToOptimize?.[0]
                    })
                );
            }
            handleOptimizeResourceJob(
                res,
                failedMsgData,
                getJobDetailApi,
                dispatch,
                ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                getBulkInstanceList(payload?.hostsToOptimize, ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT)
            );
        });
    };

    // Function to change clone tabs
    const handleClick = (tab: string) => {
        dispatch(setSelectedCloneTab(tab));
    };

    const handleBulkActionForClone = (actionType: string, operation?: string, rowData?: any) => {
        setDialog(
            <DialogComponent
                header={`${actionType} clone`}
                content={<DialogContent type={`${GENERAL.CLONE_MANAGEMENT} ${actionType}`} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callCloneOptimizeApi(actionType, operation, rowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass="innerPage"
            />
        );
    };

    return (
        <>
            <div className={styles.cloneTabs}>
                <div
                    className={
                        selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(GENERAL.CLONE_MANAGEMENT_TAB1)}
                    >
                        {GENERAL.CLONE_MANAGEMENT_TAB1} {`(${wfDatabase?.length})`}
                    </DsTypography>
                </div>
                <div
                    className={
                        selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(GENERAL.CLONE_MANAGEMENT_TAB2)}
                    >
                        {GENERAL.CLONE_MANAGEMENT_TAB2} {`(${otherDatabase?.length})`}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.tableSection}>
                {selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB1 && (
                    <CloneInsideWF
                        data={wfDatabase}
                        handleBulkActionForClone={handleBulkActionForClone}
                        fromPage={fromPage}
                    />
                )}
                {selectedCloneTab === GENERAL.CLONE_MANAGEMENT_TAB2 && (
                    <CloneOutsideWF
                        data={otherDatabase}
                        handleBulkActionForClone={handleBulkActionForClone}
                        fromPage={fromPage}
                    />
                )}
            </div>
        </>
    );
};

export default CloneTabs;
