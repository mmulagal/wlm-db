import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useTranslation } from 'react-i18next';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_NAMES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import StorageTierOptimizeTable from './InnerTables/StorageTierOptimizeTable';
import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
    setCloneDashboardData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setLandingFromInnerPage,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import {
    formatAssessmentData,
    formatGetWellData,
    handleOptimizeStorageJob,
    instanceBreadCrumbSelectedFrom,
    selectHeaderTabFromBreadCrumb
} from '../GetWellUtils';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeComputeConfigMutation,
    useOptimizeMTUConfigForBulkMutation,
    useOptimizeOracleStorageLayoutAsmMutation,
    useOptimizeResiliencyMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import { handleDialog } from '../StorageCardComponent/optimizeUtils';
import {
    isLinkedConfig,
    getLinkedConfigNames,
    getDependencyType,
    getRecommendationType
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import LinkedConfigBanner from '../../../common/LinkedConfigBanner/LinkedConfigBanner';
import FileSystemHeadroomOptimizeTable from './InnerTables/FileSystemHeaderoomOptimizeTable';
import LogDriveSizeOptimizeTable from './InnerTables/LogDriveSizeOptimizeTable';
import DataFilesOptimizeTable from './InnerTables/DataFilesOptimizeTable';
import LogFilesOptimizeTable from './InnerTables/LogFilesOptimizeTable';
import RSSOptimizeTable from './InnerTables/RSSOptimizeTable';
import ScheduledLocalSnapshotOptimizeTable from './InnerTables/ScheduledLocalSnapshotTable';
import CRROptimizeTable from './InnerTables/CRROptimizeTable';
import CloneTabs from './CloneTabs';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import MTUOptimizeTable from './InnerTables/MTUOptimizeTable';
import StorageLayoutOracleTable from './InnerTables/StorageLayoutOracleTable';

const OptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
    const [cardHeight, setCardHeight] = useState({
        recommendationSection: '',
        tagSection: ''
    });
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        cloneIsOptimizedRows
    } = useAppSelector(state => state.getWellOptimize);
    const fullCardData = useAppSelector(state => state.getWellOptimize.cardData);
    const isWad = fullCardData?.isWad || false;

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [optimizeOracleStorageLayoutAsm] = useOptimizeOracleStorageLayoutAsmMutation();
    const [optimizeResiliency] = useOptimizeResiliencyMutation();
    const [optimizeComputeConfigForBulk] = useOptimizeComputeConfigForBulkMutation();
    const [optimizeMTUConfigForBulk] = useOptimizeMTUConfigForBulkMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const userNavigated = useRef(false);

    useEffect(() => {
        if (selectedOptimizeConfig?.type === GENERAL.CLONE_MANAGEMENT) {
            const cloneViolationsList =
                selectedOptimizeConfig?.data?.cloneDetails
                    ?.filter((clone: any) =>
                        selectedOptimizeConfig?.data?.objectsInViolation?.includes(clone.cloneDatabaseName)
                    )
                    ?.map((obj: any) => ({
                        ...obj,
                        isOptimized:
                            cloneIsOptimizedRows?.[
                                `${selectedResourceId}_${selectedDatabaseInstance}_${obj?.cloneDatabaseName}`
                            ],
                        credentialId: selectedGwInstanceCredId,
                        regionId: selectedGwInstanceRegionId,
                        resourceId: selectedResourceId,
                        hostName: selectedHostname,
                        instanceId: selectedDatabaseInstance,
                        serverInstanceName: selectedDatabaseInstanceName
                    })) || [];

            dispatch(
                setCloneDashboardData({
                    type: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                    objectsInViolation: cloneViolationsList,
                    severity: selectedOptimizeConfig?.data?.severity,
                    tags: selectedOptimizeConfig?.data?.tags,
                    recommendation: selectedOptimizeConfig?.data?.recommendation
                })
            );
        }
    }, [selectedOptimizeConfig]);

    useEffect(() => {
        switch (selectedOptimizeConfig?.type) {
            // Oracle storage layout assessment
            case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
                setCardHeight({
                    recommendationSection: '164px',
                    tagSection: '260px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
                setCardHeight({
                    recommendationSection: '228px',
                    tagSection: '324px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
                setCardHeight({
                    recommendationSection: '134px',
                    tagSection: '230px'
                });
                break;
            // MSSQL Assessment
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                setCardHeight({
                    recommendationSection: '144px',
                    tagSection: '240px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                setCardHeight({
                    recommendationSection: '228px',
                    tagSection: '324px'
                });
                break;

            case 'Data files':
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case 'Log files':
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
                setCardHeight({
                    recommendationSection: '450px',
                    tagSection: '546px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.MTU:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case 'Cross-Region Replication (CRR)':
                setCardHeight({
                    recommendationSection: '160px',
                    tagSection: '256px'
                });

                break;
            case GENERAL.CLONE_MANAGEMENT:
                setCardHeight({
                    recommendationSection: '120px',
                    tagSection: '216px'
                });
                break;
            default:
                setCardHeight({
                    recommendationSection: '160px',
                    tagSection: '256px'
                });
                break;
        }
    }, [selectedOptimizeConfig]);

    const buttonComponent = (rowData: any) => {
        if (
            selectedOptimizeConfig?.type === 'Data files' ||
            selectedOptimizeConfig?.type === 'Log files' ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={<DsTypography variant="Regular_14">Coming soon</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (selectedOptimizeConfig?.type === GENERAL.CRR) {
            return (
                <DsButton isThin variant="secondary" isDisabled>
                    {GENERAL.OPTIMIZE}
                </DsButton>
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
            (rowData?.status === 'Over-provisioned' || rowData?.status === 'Shared drive')
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        rowData?.status === 'Over-provisioned' ? (
                            <DsTypography variant="Regular_14">{GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR}</DsTypography>
                        ) : (
                            <DsTypography variant="Regular_14">{GENERAL.NOT_OPTIMIZED_SHARED_DRIVES}</DsTypography>
                        )
                    }
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0) {
            return (
                <Popover
                    isAppendedToBody
                    children={<DsTypography variant="Regular_14">Bulk action is enabled on selected rows</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            selectedOptimizeConfig?.type === GENERAL.RSS_CONFIGURATION ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.MTU ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ) {
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    isDisabled={rowData?.status === 'Over-provisioned' || rowData?.status === 'Shared drive'}
                    onClick={() => {
                        // optimizeAction(rowData);
                        handleDialog(
                            setDialog,
                            selectedOptimizeConfig?.type,
                            callOptimizeApi,
                            closeDialog,
                            selectedOptimizeConfig?.data,
                            'single',
                            rowData,
                            selectedOptimizeConfig?.engineType,
                            isWad
                        );
                    }}
                >
                    {GENERAL.OPTIMIZE}
                </DsButton>
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
        ) {
            // Oracle storage layout assessment
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    onClick={() => {
                        // optimizeAction(rowData);
                        handleDialog(
                            setDialog,
                            selectedOptimizeConfig?.type,
                            callOptimizeApi,
                            closeDialog,
                            selectedOptimizeConfig?.data,
                            'single',
                            rowData,
                            DBType.ORACLE,
                            isWad
                        );
                    }}
                >
                    {GENERAL.OPTIMIZE}
                </DsButton>
            );
        }
        return (
            <Popover
                isAppendedToBody
                children={<DsTypography variant="Regular_14">Coming soon</DsTypography>}
                trigger="hover"
                delayHide={200}
                interactive
                container={
                    <DsButton variant="secondary" isDisabled isThin>
                        {GENERAL.OPTIMIZE}
                    </DsButton>
                }
            />
        );
    };

    const lastColDetails = (name: string, data?: any, width: any = '302px') => ({
        id: '4',
        Header: '',
        accessor: '',
        isSticky: true,
        width,
        renderCell: (cellData: any, rowData: any) => (
            <div className={styles.buttonContainer}>
                <div />
                {buttonComponent(rowData)}
            </div>
        )
    });

    const storageLayoutAsmPayload = (configName: string, operation: string, singleRowData: any) => {
        let payload = null;
        if (operation === 'bulk') {
            payload = {
                assessments: [
                    {
                        configurationName: configName,
                        objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.objectName)
                    }
                ]
            };
        } else {
            payload = {
                assessments: [
                    {
                        configurationName: configName,
                        objectsToOptimize: [singleRowData?.objectName]
                    }
                ]
            };
        }
        return payload;
    };

    // This is the function that will be called when the optimize button is clicked from main cards
    const callOptimizeApi = (type: any, operation: string, singleRowData: any) => {
        let payload: null | object = {};
        let apiCall = null;

        const state = store.getState();
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (type === GENERAL.RSS_CONFIGURATION) {
            apiCall = optimizeComputeConfigForBulk;
            if (operation === 'bulk') {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    networkAdapters: selectedRowsForOptimizeInnerPage.map(
                                        (item: any) => item?.adapterName
                                    ),
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            } else {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    networkAdapters: [singleRowData?.adapterName],
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.MTU) {
            apiCall = optimizeMTUConfigForBulk;
            if (operation === 'bulk') {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'mtu-alignment',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    interfaceNames: selectedRowsForOptimizeInnerPage.map(
                                        (item: any) => item?.interfaceName || item?.objectName
                                    ),
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            } else {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'mtu-alignment',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    interfaceNames: [singleRowData?.interfaceName || singleRowData?.objectName],
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            }
        } else if (
            type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ) {
            apiCall = optimizeStorageSizing;
            payload = {
                configurationName: selectedOptimizeConfig?.data?.id
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE) {
            apiCall = optimizeStorageSizing;

            if (operation === 'bulk') {
                payload = {
                    configurationName: 'log-drive-size',
                    objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.logAccessPath)
                };
            } else {
                payload = {
                    configurationName: 'log-drive-size',
                    objectsToOptimize: [singleRowData?.logAccessPath]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            if (operation === 'bulk') {
                payload = {
                    configurationName: 'storage-tier',
                    objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.objectName)
                };
            } else {
                payload = {
                    configurationName: 'storage-tier',
                    objectsToOptimize: [singleRowData?.objectName]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) {
            apiCall = optimizeResiliency;
            const state = store.getState();
            const { selectedSnapshot } = state.getWellOptimize;
            if (operation === 'bulk') {
                payload = {
                    configurationName: ['snapshot-policy'],
                    params: [
                        {
                            snapshotPolicy: {
                                uuid: selectedSnapshot?.data?.uuid,
                                name: selectedSnapshot?.data?.name
                            },
                            volumes: selectedRowsForOptimizeInnerPage.map(({ volumeName, ontapVolumeUuid }: any) => ({
                                ontapVolumeName: volumeName,
                                ontapVolumeUuid
                            }))
                        }
                    ]
                };
            } else {
                payload = {
                    configurationName: ['snapshot-policy'],
                    params: [
                        {
                            snapshotPolicy: {
                                uuid: selectedSnapshot?.data?.uuid,
                                name: selectedSnapshot?.data?.name
                            },
                            volumes: [
                                {
                                    ontapVolumeName: singleRowData?.volumeName,
                                    ontapVolumeUuid: singleRowData?.ontapVolumeUuid
                                }
                            ]
                        }
                    ]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT) {
            apiCall = optimizeOracleStorageLayoutAsm;
            payload = storageLayoutAsmPayload('data-dg-lun-layout', operation, singleRowData);
        } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT) {
            apiCall = optimizeOracleStorageLayoutAsm;
            payload = storageLayoutAsmPayload('redolog-dg-lun-layout', operation, singleRowData);
        } else if (type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT) {
            apiCall = optimizeOracleStorageLayoutAsm;
            payload = storageLayoutAsmPayload('fra-dg-lun-layout', operation, singleRowData);
        } else if (type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT) {
            apiCall = optimizeOracleStorageLayoutAsm;
            payload = storageLayoutAsmPayload('archivelog-dg-lun-layout', operation, singleRowData);
        } else {
            // ToDo - More type will come like optimize for sizing and layout here
            apiCall = optimizeStorageConfig;
            payload = {
                assessments: [
                    {
                        configurationName: type,
                        objectsToOptimize: []
                    }
                ]
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [selectedOptimizeConfig?.data?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [type]: [
                    ...(inProgressOptimizationData[type] || []),
                    `${selectedResourceId}_${selectedDatabaseInstance}`
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [type]: [...(inProgressHostData[type] || []), selectedResourceId]
            })
        );
        formatAssessmentData(selectedOptimizeConfig?.engineType, dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                if (notificationTimeout) clearTimeout(notificationTimeout);
                                userNavigated.current = true;
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

        apiCall({
            credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload
        }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            if (notificationTimeout) clearTimeout(notificationTimeout);
                            userNavigated.current = true;
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
                dispatch(
                    setJobToInstanceMap({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                    })
                );

                const timeoutId = setTimeout(() => {
                    if (!userNavigated.current) {
                        if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
                            // Redirect to oracle well architect page
                            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                        } else {
                            // Redirect to MSSQL well architect page
                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                        }
                        dispatch(setLandingFromInnerPage(true));
                    }
                }, 1000);

                setNotificationTimeout(timeoutId);
            }
            handleOptimizeStorageJob(
                res,
                {
                    id: selectedOptimizeConfig?.data?.id,
                    name: type,
                    hostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type,
                '',
                {},
                true,
                selectedOptimizeConfig?.engineType
            );
        });
    };

    const handleBulkAction = () => {
        handleDialog(
            setDialog,
            selectedOptimizeConfig?.type,
            callOptimizeApi,
            closeDialog,
            selectedOptimizeConfig?.data,
            'bulk',
            {},
            selectedOptimizeConfig?.engineType,
            isWad
        );
    };

    const renderTable = () => {
        switch (selectedOptimizeConfig?.type) {
            // Oracle storage layout assessment
            case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
            case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
            case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
                return (
                    <StorageLayoutOracleTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );

            // MSSQL assessment
            case 'Storage tier':
                return (
                    <StorageTierOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case 'File system headroom':
                return (
                    <FileSystemHeadroomOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case 'Log drive size':
                return (
                    <LogDriveSizeOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case 'Data files':
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                return (
                    <DataFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case 'Log files':
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                return (
                    <LogFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case GENERAL.RSS_CONFIGURATION:
                return (
                    <RSSOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.MTU:
                return (
                    <MTUOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                        hostname={selectedHostname}
                    />
                );
            case GENERAL.SCHEDULED_LOCAL_SNAPSHOT:
                return (
                    <ScheduledLocalSnapshotOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case GENERAL.CRR:
                return (
                    <CRROptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            default:
                return null;
        }
    };

    const linkedConfigNames = useMemo(() => {
        const configType = selectedOptimizeConfig?.type;
        if (configType && selectedOptimizeConfig?.engineType === DBType.ORACLE && isLinkedConfig(configType)) {
            return getLinkedConfigNames(configType);
        }
        return [];
    }, [selectedOptimizeConfig?.type, selectedOptimizeConfig?.engineType]);

    const setHeading = () => {
        if (
            selectedOptimizeConfig?.type === 'Data files' ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF
        ) {
            return 'Data files (.mdf) placement';
        }
        if (
            selectedOptimizeConfig?.type === 'Log files' ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF
        ) {
            return 'Log files (.ldf) placement';
        }
        return selectedOptimizeConfig?.type;
    };

    return (
        <div className={styles['optimize-inner-page']}>
            <div className={styles.innerPage}>
                <div className={styles.breadCrump}>
                    <BreadCrumbs
                        items={[
                            {
                                title: instanceBreadCrumbSelectedFrom(breadCrumbSelectedFrom),
                                onClick: () => {
                                    selectHeaderTabFromBreadCrumb(breadCrumbSelectedFrom, dispatch);
                                }
                            },
                            {
                                title:
                                    `${selectedHostname} / ${selectedDatabaseInstanceName}` ||
                                    'Host name/instance name',
                                dataTestId: 'wlm-db-optimize-configuration',
                                onClick: () => {
                                    if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                                    } else {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                    }
                                    dispatch(setLandingFromInnerPage(true));
                                }
                            },
                            {
                                title: `${selectedOptimizeConfig?.type}`,
                                dataTestId: `wlm-db-manage-instance-inner-page-heading-for-${selectedOptimizeConfig?.type
                                    .toLowerCase()
                                    .replace(/ /g, '-')}`
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography data-testid={`wlm-db-${selectedOptimizeConfig?.type}`} variant="Semibold_20">
                        {setHeading()}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-inner-page-sub-heading-for-${selectedOptimizeConfig?.type
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Semibold_16"
                    >
                        {selectedDatabaseInstanceName || ''}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.contentSection}>
                        <OptimizeCard recommendationHeight={cardHeight.recommendationSection} />
                    </div>

                    <div className={styles.tagSection}>
                        <TagComponent tagHeight={cardHeight.tagSection} type={selectedOptimizeConfig?.type} />
                    </div>
                </div>

                {linkedConfigNames.length > 0 && (
                    <LinkedConfigBanner
                        linkedConfigNames={linkedConfigNames}
                        configName={selectedOptimizeConfig?.type}
                        dependencyType={getDependencyType(selectedOptimizeConfig?.type || '')}
                        recommendationType={getRecommendationType(selectedOptimizeConfig?.type || '')}
                    />
                )}

                {selectedOptimizeConfig?.type === GENERAL.CLONE_MANAGEMENT && <CloneTabs />}

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default OptimizeInnerPage;
