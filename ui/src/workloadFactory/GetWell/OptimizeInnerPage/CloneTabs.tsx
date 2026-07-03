import { useDispatch } from 'react-redux';
import { Button, DsTypography, useDialog } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import styles from './OptimizeInnerPage.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setInProgressResourceOptimizeData,
    setJobToInstanceMapForBulk,
    setOptimizingData,
    setSelectedCloneTab,
    setCardData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import CloneInsideWF from './InnerTables/CloneInsideWF';
import CloneOutsideWF from './InnerTables/CloneOutsideWF';
import { GENERAL } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeCloneCleanupMutation,
    useOptimizeOracleOperatingSystemMutation
} from '../../../utils/apiService';
import {
    ASSESSMENT_CONFIG_IDS,
    ASSESSMENT_CONFIG_NAMES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS,
    GETWELL_STATUS,
    WELL_ARCHITECTED_STATUS
} from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { handleOptimizeResourceJob } from '../GetWellUtils';
import store from '../../../store/store';
import { cloneAgeRange } from '../../../utils/utilityFunctions';

const CloneTabs = ({ fromPage = '', engineType = DBType.MSSQL }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedCloneTab, cardData: fullCardData } = useAppSelector(state => state.getWellOptimize);
    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { cloneDashboardData, cloneIsOptimizedRows } = useAppSelector(state => state.getWellOptimize);
    const { inProgressOptimizationData, inProgressHostData, inProgressResourceOptimizeData } = useAppSelector(
        state => state.getWellOptimize
    );
    const isOracle = engineType === DBType.ORACLE;
    // Check if this is a WAD (offline assessment) instance
    const isWad = fullCardData?.isWad || false;
    const [wfDatabase, setWfDatabase] = useState<any>(null);
    const [otherDatabase, setOtherDatabase] = useState<any>(null);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const [cloneCleanupOptimizeApi] = useOptimizeCloneCleanupMutation();
    const [oracleCloneCleanupOptimizeApi] = useOptimizeOracleOperatingSystemMutation();
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
        const instancesKey = isOracle ? 'oracleInstances' : 'sqlServerInstances';

        jobData.forEach(({ configurationName, databaseHosts }) => {
            databaseHosts.forEach((host: any) => {
                (host[instancesKey] || []).forEach((instance: any) => {
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

    const buildOracleClonePayload = (actionType: string, rowData: any) => {
        const groupedData = rowData?.reduce((acc: any, data: any) => {
            const hostKey = uniqueHostRow(data?.resourceId, data?.credentialId, data?.regionId);
            if (!acc[hostKey]) {
                acc[hostKey] = {
                    id: data?.resourceId,
                    region: data?.regionId,
                    credentialsId: data?.credentialId,
                    oracleInstances: {}
                };
            }

            const instanceKey = data?.instanceId;
            if (!acc[hostKey]?.oracleInstances[instanceKey]) {
                acc[hostKey].oracleInstances[instanceKey] = {
                    instanceId: data?.instanceId,
                    clones: []
                };
            }

            acc[hostKey].oracleInstances[instanceKey].clones.push({
                cloneDatabaseName: data?.cloneDatabaseName,
                clonedBy: data?.clonedBy,
                action: actionType.toLowerCase()
            });

            return acc;
        }, {});

        return {
            type: 'clone',
            hostsToOptimize: [
                {
                    configurationName: 'clone',
                    databaseHosts: Object.values(groupedData).map((host: any) => ({
                        ...host,
                        oracleInstances: Object.values(host?.oracleInstances)
                    }))
                }
            ]
        };
    };

    const buildMssqlClonePayload = (actionType: string, rowData: any) => {
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

        return {
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
    };

    const getInstancesFromPayload = (payload: any) => {
        const instancesKey = isOracle ? 'oracleInstances' : 'sqlServerInstances';
        return payload?.hostsToOptimize?.flatMap((host: any) =>
            host?.databaseHosts?.flatMap((databaseHost: any) =>
                databaseHost?.[instancesKey].map((instance: any) => `${databaseHost?.id}_${instance?.instanceId}`)
            )
        );
    };

    const getResourceInstancesFromPayload = (payload: any) => {
        const instancesKey = isOracle ? 'oracleInstances' : 'sqlServerInstances';
        return payload?.hostsToOptimize?.flatMap((host: any) =>
            host?.databaseHosts?.flatMap((databaseHost: any) =>
                databaseHost?.[instancesKey]?.flatMap((instance: any) =>
                    instance?.clones?.map(
                        (clone: any) => `${databaseHost?.id}_${instance?.instanceId}_${clone?.cloneDatabaseName}`
                    )
                )
            )
        );
    };

    const callCloneOptimizeApi = (actionType: string, operation: any, rowData: any) => {
        const payload = isOracle
            ? buildOracleClonePayload(actionType, rowData)
            : buildMssqlClonePayload(actionType, rowData);

        dispatch(
            setOptimizingData({
                ...optimizingData,
                [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: WELL_ARCHITECTED_STATUS.OPTIMIZING
            })
        );

        // Update cardData to show "Optimizing" status immediately
        const currentCardData = store.getState().getWellOptimize.cardData;
        if (currentCardData && currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]) {
            dispatch(
                setCardData({
                    ...currentCardData,
                    [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
                        ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT],
                        block_two: {
                            ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT].block_two,
                            value: GETWELL_STATUS.OPTIMIZING
                        }
                    }
                })
            );
        }

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

        const hostinstances = getInstancesFromPayload(payload);
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: [
                    ...(inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT] || []),
                    ...hostinstances
                ]
            })
        );

        const resourceInstances = getResourceInstancesFromPayload(payload);
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

        const optimizeApiFn = isOracle ? oracleCloneCleanupOptimizeApi : cloneCleanupOptimizeApi;

        optimizeApiFn({ payload })
            .then((res: any) => {
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
                } else {
                    // Immediate API error - reset status
                    const currentOptimizingData = store.getState().getWellOptimize.optimizingData || {};
                    dispatch(
                        setOptimizingData({
                            ...currentOptimizingData,
                            [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: ''
                        })
                    );

                    // Clear cardData status to prevent stuck "Optimizing" display
                    const currentCardData = store.getState().getWellOptimize.cardData;
                    if (currentCardData && currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]) {
                        dispatch(
                            setCardData({
                                ...currentCardData,
                                [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
                                    ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT],
                                    block_two: {
                                        ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT].block_two,
                                        value: ''
                                    }
                                }
                            })
                        );
                    }
                }
                handleOptimizeResourceJob(
                    res,
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                    getBulkInstanceList(payload?.hostsToOptimize, ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT),
                    engineType
                );
            })
            .catch(() => {
                // Promise rejection - reset status
                const currentOptimizingData = store.getState().getWellOptimize.optimizingData || {};
                dispatch(
                    setOptimizingData({
                        ...currentOptimizingData,
                        [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: ''
                    })
                );

                // Clear cardData status
                const currentCardData = store.getState().getWellOptimize.cardData;
                if (currentCardData && currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]) {
                    dispatch(
                        setCardData({
                            ...currentCardData,
                            [ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT]: {
                                ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT],
                                block_two: {
                                    ...currentCardData[ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT].block_two,
                                    value: ''
                                }
                            }
                        })
                    );
                }

                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: `${ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT} failed to optimize.`
                    })
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
                content={
                    <DialogContent
                        type={`${GENERAL.CLONE_MANAGEMENT} ${actionType}`}
                        engineType={engineType}
                        isWad={isWad}
                    />
                }
                primaryButton={isWad ? GENERAL.CLOSE : GENERAL.CONTINUE}
                secondaryButton={!isWad ? GENERAL.CANCEL : undefined}
                callback={() => {
                    if (isWad) {
                        closeDialog();
                    } else {
                        callCloneOptimizeApi(actionType, operation, rowData);
                    }
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={isWad ? 'oneTimeWADDialog' : 'innerPage'}
            />
        );
    };

    if (isOracle) {
        return (
            <div className={styles.tableSection}>
                <CloneOutsideWF
                    data={otherDatabase}
                    handleBulkActionForClone={handleBulkActionForClone}
                    fromPage={fromPage}
                    engineType={engineType}
                />
            </div>
        );
    }

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
