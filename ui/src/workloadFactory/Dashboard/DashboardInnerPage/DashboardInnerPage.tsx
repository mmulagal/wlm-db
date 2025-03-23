import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog, DsButton, Button, Popover } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useState } from 'react';
import {
    cardDataDefault,
    checkIfDisableForOptimize,
    formatGetWellData,
    handleOptimizeStorageJob,
    nameToIdConfigMapping,
    setOptimizeInnerpageSummary
} from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import StorageTierTable from './RenderTables/StorageTierTable';
import FileSystemHeadroomTable from './RenderTables/FileSystemHeadroom';
import LogDriveSizeTable from './RenderTables/LogDriveSizeTable';
import TempDBDriveSizeTable from './RenderTables/TempDBDriveSizeTable';
import UserDataFilesTable from './RenderTables/UserDataFilesTable';
import LogFileTable from './RenderTables/LogFileTable';
import TempDBPlacement from './RenderTables/TempDBPlacement';
import ComputeRightSizingTable from './RenderTables/ComputeRightSizingTable';
import OntapConfig from './RenderTables/OntapConfig';
import OperatingSystemTable from './RenderTables/OperatingSystemTable';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation,
    useOptimizeStorageSizingForBulkMutation,
    useOptimizeStorageTierForBulkMutation,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useOptimizeResiliencyMutation,
    useOptimizeAwsBackupMutation
} from '../../../utils/apiService';
import {
    setGwPageLoadInstanceData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setJobToInstanceMapForBulk,
    setLandingFrom,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { ReactComponent as OptimizeInProgressIcon } from '../../../assets/optimize-in-progress.svg';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import MaxDopTable from './RenderTables/MaxDopTable';
import MicrosoftSQLPatchTable from './RenderTables/MicrosoftSQLPatchTable';
import LicenseTable from './RenderTables/LicenseTable';
import NetworkAdapterTable from './RenderTables/NetworkAdapterTable';
import OSPatchTable from './RenderTables/OSPatchTable';
import ScheduledLocalSnapshotTable from './RenderTables/ScheduledLocalSnapshotTable';
import ScheduledAWSBackupTable from './RenderTables/ScheduledAWSBackupTable';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { backupStartTime } from '../../../utils/utilityFunctions';

const DashboardInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM } = useAppSelector(state => state.getWellOptimize);
    const { allmssqlHostAssessmentData } = useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const [valueCardData, setValueCardData] = useState<any>({
        optimizationScore: '',
        optimizedInstances: '',
        notOptimizedInstances: '',
        severity: '',
        cardHeight: '',
        tagHeight: '',
        data: {
            title: '',
            description: '',
            values: []
        },
        cardName: ''
    });

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [optimizeResiliency] = useOptimizeResiliencyMutation();
    const [optimizeAwsBackup] = useOptimizeAwsBackupMutation();
    const [optimizeStorageSizingForBulk] = useOptimizeStorageSizingForBulkMutation();
    const [optimizeStorageTierForBulk] = useOptimizeStorageTierForBulkMutation();
    const [optimizeComputeConfigForBulk] = useOptimizeComputeConfigForBulkMutation();
    const [optimizeMaxdopConfigForBulk] = useOptimizeMaxdopConfigForBulkMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const callOptimizeApi = (type: any, rowData?: any, operation?: string) => {
        let payload: null | object | any = {};
        let apiCall = null;
        const state = store.getState();
        const {
            selectedDatabaseInstance,
            selectedResourceId,
            landingFrom,
            cardData,
            recommendedInstanceInBulk,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId
        } = state.getWellOptimize;
        let credIdBulk = rowData?.[0]?.credentialId;
        let reiginIdBulk = rowData?.[0]?.regionId;
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            if (operation === 'bulk') {
                apiCall = optimizeComputeConfigForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            type: 'compute',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            { id: string; sqlServerInstances: string[]; instanceType: string }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            hostName
                                        }: { databaseHostId: string; instanceId: string; hostName: string }
                                    ) => {
                                        if (!acc[databaseHostId]) {
                                            acc[databaseHostId] = {
                                                id: databaseHostId,
                                                sqlServerInstances: [],
                                                instanceType: recommendedInstanceInBulk?.[hostName]?.value || ''
                                            };
                                        }
                                        acc[databaseHostId].sqlServerInstances.push(instanceId);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                };
            } else {
                apiCall = optimizeComputeConfig;
                const { selectedRecommendedInstance } = state.getWellOptimize;
                payload = {
                    instanceType: selectedRecommendedInstance?.value
                };
            }
        } else if (type === GENERAL.RSS_CONFIGURATION) {
            if (operation === 'bulk') {
                apiCall = optimizeComputeConfigForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            type: 'rss-config',
                            databaseHosts: Object.values(
                                //@ts-ignore
                                rowData.reduce((acc, { hostName, instanceId, networkAdapters }) => {
                                    if (!acc[hostName]) {
                                        acc[hostName] = { id: hostName, sqlServerInstances: [], networkAdapters: [] };
                                    }
                                    acc[hostName].sqlServerInstances.push(instanceId);
                                    acc[hostName].networkAdapters.push(...networkAdapters);
                                    return acc;
                                }, {})
                            )
                        }
                    ]
                };
            } else {
                apiCall = optimizeComputeConfigForBulk;
                payload = {
                    hostsToOptimize: [
                        {
                            type: 'rss-config',
                            databaseHosts: [
                                {
                                    id: rowData?.hostName,
                                    sqlServerInstances: [rowData?.instanceId],
                                    networkAdapters: rowData?.networkAdapters
                                }
                            ]
                        }
                    ]
                };
            }
        } else if (
            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ) {
            if (operation === 'bulk') {
                apiCall = optimizeStorageSizingForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            type:
                                type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
                                    ? 'log-drive-size'
                                    : type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
                                    ? 'headroom'
                                    : 'tempdb-drive-size',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<string, { id: string; sqlServerInstances: string[] }>,
                                        { databaseHostId, instanceId }: { databaseHostId: string; instanceId: string }
                                    ) => {
                                        if (!acc[databaseHostId]) {
                                            acc[databaseHostId] = { id: databaseHostId, sqlServerInstances: [] };
                                        }
                                        acc[databaseHostId].sqlServerInstances.push(instanceId);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                };
            } else {
                apiCall = optimizeStorageSizing;
                payload = {
                    type:
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
                            ? 'log-drive-size'
                            : type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
                            ? 'headroom'
                            : 'tempdb-drive-size'
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            if (operation === 'bulk') {
                apiCall = optimizeStorageTierForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            type: 'storage-tier',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<string, { id: string; sqlServerInstances: string[] }>,
                                        { databaseHostId, instanceId }: { databaseHostId: string; instanceId: string }
                                    ) => {
                                        if (!acc[databaseHostId]) {
                                            acc[databaseHostId] = { id: databaseHostId, sqlServerInstances: [] };
                                        }
                                        acc[databaseHostId].sqlServerInstances.push(instanceId);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                };
            } else {
                apiCall = optimizeStorageTier;
                payload = {};
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) {
            apiCall = optimizeResiliency;
            const state = store.getState();
            const selectedSnapshot = state.getWellOptimize.selectedSnapshot;

            payload = {
                type: ['snapshot-policy'],
                params: [
                    {
                        snapshotPolicy: {
                            uuid: selectedSnapshot?.data?.uuid,
                            name: selectedSnapshot?.data?.name
                        },
                        volumes: rowData?.violations
                    }
                ]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
            apiCall = optimizeAwsBackup;
            const state = store.getState();
            const selectedAWSBackup = state.getWellOptimize.selectedAWSBackup;

            payload = {
                hostsToOptimize: [
                    {
                        type: ['aws-backup'],
                        databaseHosts: [
                            {
                                id: rowData?.databaseHostId,
                                sqlServerInstances: [rowData?.instanceId],
                                fsxFileSystemId: rowData?.objectsInViolation?.[0],
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup)
                            }
                        ]
                    }
                ]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiCall = optimizeMaxdopConfigForBulk;
            if (operation === 'bulk') {
                payload = {
                    hostsToOptimize: [
                        {
                            type: 'max-dop',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<string, { id: string; sqlServerInstances: string[] }>,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            hostName
                                        }: { databaseHostId: string; instanceId: string; hostName: string }
                                    ) => {
                                        if (!acc[databaseHostId]) {
                                            acc[databaseHostId] = {
                                                id: databaseHostId,
                                                sqlServerInstances: []
                                            };
                                        }
                                        acc[databaseHostId].sqlServerInstances.push(instanceId);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                };
            } else {
                payload = {
                    hostsToOptimize: [
                        {
                            type: 'max-dop',
                            databaseHosts: [
                                {
                                    id: rowData?.databaseHostId,
                                    sqlServerInstances: [rowData?.instanceId]
                                }
                            ]
                        }
                    ]
                };
            }
        } else {
            // ToDo - More type will come like optimize for sizing and layout here
            apiCall = optimizeStorageConfig;
            if (operation === 'bulk') {
                payload = {
                    databaseHosts: []
                };
            } else {
                payload = {
                    assessments: [
                        {
                            configurationName: type,
                            objectsToOptimize: []
                        }
                    ]
                };
            }
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [nameToIdConfigMapping(type)]: 'optimizing'
            })
        );
        if (operation === 'bulk') {
            const hostIds = payload.hostsToOptimize[0].databaseHosts.map((host: any) => host.id);
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [type]: [...(inProgressHostData[type] || []), ...hostIds]
                })
            );
            const hostinstances = payload.hostsToOptimize.flatMap((host: any) =>
                host.databaseHosts.flatMap((databaseHost: any) =>
                    databaseHost.sqlServerInstances.map((instance: any) => `${databaseHost.id}_${instance}`)
                )
            );
            dispatch(
                setInProgressOptimizationData({
                    ...inProgressOptimizationData,
                    [type]: [...(inProgressOptimizationData[type] || []), ...hostinstances]
                })
            );
        } else {
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [type]: [...(inProgressHostData[type] || []), selectedResourceId]
                })
            );
            dispatch(
                setInProgressOptimizationData({
                    ...inProgressOptimizationData,
                    [type]: [
                        ...(inProgressOptimizationData[type] || []),
                        selectedResourceId + '_' + selectedDatabaseInstance
                    ]
                })
            );
        }

        formatGetWellData(dispatch, rowData?.assessments);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Optimization process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                dispatch(clearNotifications());
                            }}
                        >
                            {GENERAL.JOB_MONITORING}.
                        </Button>
                    </div>
                )
            })
        );

        let apiData = {};
        if (operation === 'bulk') {
            apiData = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? credIdBulk : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? reiginIdBulk : regionFromJM,
                payload: payload
            };
        } else {
            if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
                apiData = {
                    credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                    regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                    payload: payload
                };
            } else {
                apiData = {
                    credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                    regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                    databaseHostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    payload: payload
                };
            }
        }

        apiCall(apiData).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            if (!res.error) {
                if (operation === 'bulk') {
                    dispatch(
                        setJobToInstanceMapForBulk({
                            ...state.getWellOptimize.jobToInstanceMap,
                            [res?.data?.jobId]: payload?.hostsToOptimize[0]
                        })
                    );
                } else {
                    dispatch(
                        setJobToInstanceMap({
                            ...state.getWellOptimize.jobToInstanceMap,
                            [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                        })
                    );
                }
            }
            if (operation === 'bulk') {
                handleOptimizeStorageJob(
                    res,
                    {},
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    type,
                    operation,
                    getBulkInstanceList(payload?.hostsToOptimize, type)
                );
            } else {
                handleOptimizeStorageJob(
                    res,
                    {
                        id: nameToIdConfigMapping(type),
                        name: type,
                        hostId: selectedResourceId,
                        instanceId: selectedDatabaseInstance
                    },
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    type,
                    operation
                );
            }
        });
    };

    const getBulkInstanceList = (jobData: any[], name: string) => {
        const instanceList: any = [];

        jobData.forEach(({ type, databaseHosts }) => {
            databaseHosts.forEach((host: any) => {
                host.sqlServerInstances.forEach((instanceId: string) => {
                    instanceList.push({
                        id: type,
                        name: name,
                        hostId: host.id,
                        instanceId: instanceId
                    });
                });
            });
        });

        return instanceList;
    };

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData?.databaseHostId, rowData?.credentialId, rowData?.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.data?.databaseInstanceName
        );
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.hostName,
                resourceId: targettedHost?.resourceId,
                instanceId: targettedDbInstance?.databaseInstanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType
            })
        );
    };

    const handleDialog = (type: string, rowData: any, operation?: string) => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={rowData?.recommendationOptions}
                        missingPermissions={rowData?.missingPermissions}
                        recommendedSizeInGib={rowData?.recommendedSizeInGib}
                        bulkRecommendationOptions={rowData}
                        operation={operation}
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(type, rowData, operation);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={type !== ASSESSMENT_CONFIG_NAMES.MAXDOP ? 'innerPage' : ''}
                hidePrimaryButton={
                    (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                        type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
                    rowData?.missingPermissions &&
                    rowData?.missingPermissions.length > 0
                }
            />
        );
    };

    useEffect(() => {
        if (selectedConfig) {
            const configData = getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData);
            setOptimizeInnerpageSummary(selectedConfig, configData, dispatch);
        }
    }, [allmssqlHostAssessmentData]);

    useEffect(() => {
        switch (selectedConfig) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.storage_tier?.recommendation?.description
                    }
                });

                break;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '144px',
                    tagHeight: '241px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.file_system_headroom?.recommendation?.description,
                        values: cardDataDefault?.file_system_headroom?.recommendation?.values
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '168px',
                    tagHeight: '265px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_drive_size?.recommendation?.description,
                        values: cardDataDefault?.transaction_log_drive_size?.recommendation?.values
                    }
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '192px',
                    tagHeight: '289px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_drive_size?.recommendation?.description,
                        values: cardDataDefault?.tempdb_drive_size?.recommendation?.values
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.user_data_files?.recommendation?.description
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_files?.recommendation?.description
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_files?.recommendation?.description
                    }
                });
                break;

            case 'ONTAP':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    }
                });
                break;

            case 'Operating system':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    }
                });
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.compute_rightsizing?.recommendation?.description
                    },
                    cardName: 'compute_right_sizing'
                });
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.host_os_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.RSS_CONFIGURATION:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '450px',
                    tagHeight: '547px',
                    data: {
                        title: 'Recommendations',
                        descriptionRssConfig: cardDataDefault?.rss_config?.recommendation?.descriptionRssConfig
                    }
                });
                break;
            case GENERAL.LICENSE_SQL_SERVER:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '228px',
                    tagHeight: '325px',
                    data: cardDataDefault?.sql_licenses?.recommendation
                });
                break;
            case GENERAL.MICROSOFT_SQL_PATCH:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.microsoft_sql_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.MAXDOP_PATCH:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '216px',
                    tagHeight: '313px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.maxdop?.recommendation?.descriptionRssConfig?.first
                    }
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_local_snapshot?.recommendation?.description
                    }
                });

                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_FSx_for_ONTAP_backups?.recommendation?.description
                    }
                });
                break;
        }
    }, [selectedConfig, selectedConfigSummary]);

    const lastColDetails = (name: string, data?: any, inProgressOptimizationData?: any, inProgressHostData?: any) => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '318px',
            renderCell: (cellData: any, rowData: any) => {
                let { isDisabled, errorMessage } = checkIfDisableForOptimize(
                    inProgressHostData,
                    name,
                    rowData,
                    selectedRowsForOptimize
                );
                const isInProgress = inProgressOptimizationData?.[name]?.includes(rowData?.id);
                return (
                    <div className={styles.buttonContainer}>
                        {isInProgress ? (
                            <div className={styles['optimize-in-progress']}>
                                <OptimizeInProgressIcon />
                                <DsTypography variant="Semibold_14">Optimizing</DsTypography>
                            </div>
                        ) : isDisabled && errorMessage ? (
                            <Popover
                                popoverClass={CommonStyles['popover']}
                                isAppendedToBody={true}
                                children={<DsTypography variant="Regular_14">{errorMessage}</DsTypography>}
                                trigger="hover"
                                delayHide={200}
                                interactive={true}
                                container={
                                    <DsButton variant="secondary" isDisabled={true}>
                                        Optimize
                                    </DsButton>
                                }
                            />
                        ) : (
                            <DsButton
                                isThin
                                variant="secondary"
                                isDisabled={isDisabled}
                                onClick={() => {
                                    optimizeAction(rowData);
                                    handleDialog(name, rowData, 'single');
                                }}
                            >
                                Optimize
                            </DsButton>
                        )}
                    </div>
                );
            }
        };
    };

    const handleBulkAction = (type: string, rowData: any) => {
        // optimizeAction(rowData[0]);
        handleDialog(type, rowData, 'bulk');
    };

    const renderTable = () => {
        switch (selectedConfig) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return <StorageTierTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return <FileSystemHeadroomTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                return <LogDriveSizeTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                return <TempDBDriveSizeTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                return <UserDataFilesTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                return <LogFileTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                return <TempDBPlacement lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                return <ComputeRightSizingTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'ONTAP':
                return <OntapConfig />;
            case 'Operating system':
                return <OperatingSystemTable />;
            case 'MAXDOP':
                return <MaxDopTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case GENERAL.MICROSOFT_SQL_PATCH:
                return <MicrosoftSQLPatchTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case GENERAL.LICENSE_SQL_SERVER:
                return <LicenseTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case GENERAL.RSS_CONFIGURATION:
                return <NetworkAdapterTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                return <OSPatchTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                return (
                    <ScheduledLocalSnapshotTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />
                );
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return <ScheduledAWSBackupTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
        }
    };

    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Dashboard',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            },
                            {
                                title: `Optimize configuration (${selectedConfig})`,
                                dataTestId: 'wlm-db-optimize-configuration'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${selectedConfig.toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_20"
                    >
                        {selectedConfig}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-optimization-heading-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Semibold_16"
                    >
                        Manage instance optimization
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            optimizationScore={valueCardData.optimizationScore}
                            optimizedInstances={valueCardData.optimizedInstances}
                            notOptimizedInstances={valueCardData.notOptimizedInstances}
                            severity={valueCardData.severity}
                        />

                        <div className={styles.recommendation} style={{ height: valueCardData.cardHeight }}>
                            <RecommendationText
                                data={valueCardData?.data}
                                from={'dashboard'}
                                cardName={valueCardData?.cardName}
                            />
                        </div>
                    </div>
                    <div className={styles.rightSection}>
                        <TagComponent tagHeight={valueCardData.tagHeight} />
                    </div>
                </div>

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default DashboardInnerPage;
