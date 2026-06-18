import { useDispatch } from 'react-redux';
import { DsTypography, useDialog, DsButton, Button, Popover, TooltipInfo } from '@netapp/design-system';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DsFlashingDotsLoader } from '@tlveng/wlm-ds';
import {
    isLayoutConfig,
    getLinkedConfigNames
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import LinkedConfigBanner from '../../../common/LinkedConfigBanner/LinkedConfigBanner';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ACTION_TYPE,
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FROM_DIALOG,
    GETWELL_STATUS,
    INVENTORY_STATUS,
    WLF_TABS
} from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import {
    cardDataDefault,
    checkIfDisableForOptimize,
    formatGetWellData,
    handleOptimizeStorageJob,
    nameToIdConfigMapping,
    setOptimizeInnerpageSummary
} from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Schedule } from '../../../assets/Schedule.svg';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
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
    useOptimizeMTUConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useOptimizeResiliencyMutation,
    useOptimizeAwsBackupMutation,
    useDismissMssqlAssessmentMutation,
    useDismissOracleAssessmentMutation,
    useOptimizeOracleStorageLayoutAsmMutation,
    useOptimizeOracleOperatingSystemMutation
} from '../../../utils/apiService';
import {
    setCloneDashboardData,
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
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import {
    findFlatConfigItem,
    hasConfigStats,
    resolveConfigDisplayName
} from '../../WellArchitectedTab/assessmentFormatUtils';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { backupStartTime } from '../../../utils/utilityFunctions';
import {
    calculatePostponeInfo,
    callDashboardDismissApi,
    filterNotOptimizedRows,
    getAssessmentStatusConsistency
} from './DashboardInnerPageHelper';
import DashboardConfigsTable from './RenderTables/DashboardConfigsTable';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import {
    formatOracleWellArchitectedData,
    oracleCardData
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { engineTypeBasedResourceStr } from '../../WellArchitectedTab/WellArchitectedTabUtils';

const DashboardInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { inProgressOptimizationData, inProgressHostData, cloneIsOptimizedRows, configEngineType } = useAppSelector(
        state => state.getWellOptimize
    );
    const { credIdFromJM, regionFromJM } = useAppSelector(state => state.getWellOptimize);
    const { allmssqlHostAssessmentData, allOracleHostAssessmentData } = useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const [valueCardData, setValueCardData] = useState<any>({
        optimizationScore: '',
        dismissedInstances: '',
        activatingInstances: '',
        partialDismissInstances: '',
        totalInstances: '',
        optimizedInstances: '',
        notOptimizedInstances: '',
        severity: '',
        analysisState: '',
        cardHeight: '96px',
        tagHeight: '96px',
        data: {
            title: '',
            description: '',
            values: []
        },
        cardName: ''
    });

    const recommendationRef = useRef<HTMLDivElement | null>(null);
    const VALUE_CARD_FIXED_HEIGHT = 96;

    useEffect(() => {
        const recEl = recommendationRef.current;
        const measure = () => {
            const el = recommendationRef.current || recEl;
            const recHeight = el ? Math.ceil(el.getBoundingClientRect().height) : 0;
            const tagH = VALUE_CARD_FIXED_HEIGHT + recHeight;
            setValueCardData((prev: any) => ({
                ...prev,
                cardHeight: `${VALUE_CARD_FIXED_HEIGHT}px`,
                tagHeight: `${tagH}px`
            }));
        };

        // Use ResizeObserver when available to catch initial layout and dynamic changes
        let ro: ResizeObserver | null = null;
        if (recEl && (window as any).ResizeObserver) {
            ro = new (window as any).ResizeObserver(() => {
                window.requestAnimationFrame(measure);
            });
            if (ro && recEl) ro.observe(recEl);
        }

        measure();
        window.requestAnimationFrame(measure);

        const onResize = () => window.requestAnimationFrame(measure);
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            if (ro && recEl) ro.unobserve(recEl);
            ro = null;
        };
    }, [valueCardData?.data?.description, valueCardData?.data?.descriptionRssConfig, valueCardData?.data?.values]);

    const linkedConfigNames = useMemo(() => {
        if (selectedConfig && configEngineType === DBType.ORACLE && isLayoutConfig(selectedConfig)) {
            return getLinkedConfigNames(selectedConfig);
        }
        return [];
    }, [selectedConfig, configEngineType]);

    const assessmentConfigData = useMemo(
        () => getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [allmssqlHostAssessmentData, allOracleHostAssessmentData]
    );

    const configItem = useMemo(() => {
        if (!selectedConfig) return undefined;
        const hosts = configEngineType === DBType.ORACLE ? allOracleHostAssessmentData : allmssqlHostAssessmentData;
        return findFlatConfigItem(hosts, selectedConfig);
    }, [selectedConfig, configEngineType, allmssqlHostAssessmentData, allOracleHostAssessmentData]);

    const configDisplayName = configItem?.name ?? selectedConfig ?? '';
    const configCategories = configItem?.categories;

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
    const [optimizeMTUConfigForBulk] = useOptimizeMTUConfigForBulkMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();
    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();
    const [optimizeOracleStorageLayoutAsm] = useOptimizeOracleStorageLayoutAsmMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();

    const storageLayoutAsmPayload = (configName: string, rowData: any) => ({
        assessments: [
            {
                configurationName: configName,
                objectsToOptimize: rowData?.objectsInViolation || []
            }
        ]
    });

    const computeHostOsPayload = (configurationName: string, rowData: any) => ({
        type: 'compute-host-os',
        hostsToOptimize: [
            {
                configurationName,
                databaseHosts: [
                    {
                        id: rowData?.databaseHostId,
                        credentialsId: rowData?.credentialId,
                        region: rowData?.regionId,
                        databases: [rowData?.instanceId]
                    }
                ]
            }
        ]
    });

    const callOptimizeApi = (type: any, fullRowData?: any, operation?: string) => {
        type = resolveConfigDisplayName(type);
        // Filter rows to only include those with "Not optimized" status if fullRowData is an array
        const rowData = Array.isArray(fullRowData) ? filterNotOptimizedRows(fullRowData) : fullRowData;

        let payload: null | object | any = {};
        let apiCall = null;
        const state = store.getState();
        const {
            selectedDatabaseInstance,
            selectedResourceId,
            landingFrom,
            recommendedInstanceInBulk,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId
        } = state.getWellOptimize;
        if (configEngineType === DBType.ORACLE) {
            if (type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT) {
                apiCall = optimizeOracleStorageLayoutAsm;
                payload = storageLayoutAsmPayload('data-dg-lun-layout', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT) {
                apiCall = optimizeOracleStorageLayoutAsm;
                payload = storageLayoutAsmPayload('redolog-dg-lun-layout', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT) {
                apiCall = optimizeOracleStorageLayoutAsm;
                payload = storageLayoutAsmPayload('fra-dg-lun-layout', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT) {
                apiCall = optimizeOracleStorageLayoutAsm;
                payload = storageLayoutAsmPayload('archivelog-dg-lun-layout', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
                apiCall = optimizeOracleOs;
                if (operation === ACTION_TYPE.BULK) {
                    payload = {
                        type: 'storage-sizing',
                        hostsToOptimize: [
                            {
                                configurationName: 'headroom',
                                databaseHosts: Object.values(
                                    rowData.reduce(
                                        (
                                            acc: Record<
                                                string,
                                                {
                                                    id: string;
                                                    credentialsId: string;
                                                    region: string;
                                                    databases: string[];
                                                }
                                            >,
                                            {
                                                databaseHostId,
                                                instanceId,
                                                credentialId,
                                                regionId
                                            }: {
                                                databaseHostId: string;
                                                instanceId: string;
                                                credentialId: string;
                                                regionId: string;
                                            }
                                        ) => {
                                            const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                            if (!acc[uniqueRow]) {
                                                acc[uniqueRow] = {
                                                    id: databaseHostId,
                                                    credentialsId: credentialId,
                                                    region: regionId,
                                                    databases: []
                                                };
                                            }
                                            acc[uniqueRow].databases.push(instanceId);
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
                        type: 'storage-sizing',
                        hostsToOptimize: [
                            {
                                configurationName: 'headroom',
                                databaseHosts: [
                                    {
                                        id: rowData?.databaseHostId,
                                        credentialsId: rowData?.credentialId,
                                        region: rowData?.regionId,
                                        databases: [rowData?.instanceId]
                                    }
                                ]
                            }
                        ]
                    };
                }
            } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
                apiCall = optimizeOracleOs;
                const { selectedAWSBackup } = state.getWellOptimize;

                payload = {
                    type: 'aws-backup',
                    hostsToOptimize: [
                        {
                            configurationName: 'aws-backup',
                            databaseHosts: [
                                {
                                    id: rowData?.databaseHostId,
                                    region: rowData?.regionId,
                                    credentialsId: rowData?.credentialId,
                                    fsxFileSystemId: rowData?.data?.assessments?.metadata?.fileSystemId,
                                    databases: [rowData?.instanceId],
                                    backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                    backupStartTime: backupStartTime(selectedAWSBackup)
                                }
                            ]
                        }
                    ]
                };
            } else if (type === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES) {
                apiCall = optimizeOracleOs;
                payload = computeHostOsPayload('transparent-hugepages', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS) {
                apiCall = optimizeOracleOs;
                payload = computeHostOsPayload('tcp-advanced-options', rowData);
            } else if (type === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT) {
                apiCall = optimizeOracleOs;
                payload = computeHostOsPayload('multiblock-readcount', rowData);
            } else {
                // ToDo - More type will come like optimize for sizing and layout here
                apiCall = optimizeStorageConfig;
                if (operation === ACTION_TYPE.BULK) {
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
        } else if (type === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) {
            if (operation === ACTION_TYPE.BULK) {
                apiCall = optimizeComputeConfigForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'compute',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                sqlServerInstances: string[];
                                                instanceType: string;
                                                credentialsId: string;
                                                region: string;
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            hostName,
                                            credentialId,
                                            regionId
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            hostName: string;
                                            credentialId: string;
                                            regionId: string;
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                sqlServerInstances: [],
                                                credentialsId: credentialId,
                                                region: regionId,
                                                instanceType: recommendedInstanceInBulk?.[hostName]?.value || ''
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
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
        } else if (type === ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION) {
            if (operation === ACTION_TYPE.BULK) {
                apiCall = optimizeComputeConfigForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: Object.values(
                                // @ts-ignore
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                sqlServerInstances: string[];
                                                credentialsId: string;
                                                region: string;
                                                networkAdapters: string[];
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            credentialId,
                                            regionId,
                                            networkAdapters
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            credentialId: string;
                                            regionId: string;
                                            networkAdapters: any;
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                sqlServerInstances: [],
                                                networkAdapters: [],
                                                credentialsId: credentialId,
                                                region: regionId
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
                                        acc[uniqueRow].networkAdapters.push(...networkAdapters);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                };
            } else {
                apiCall = optimizeComputeConfigForBulk;
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: [
                                {
                                    id: rowData?.databaseHostId,
                                    sqlServerInstances: [rowData?.instanceId],
                                    networkAdapters: rowData?.networkAdapters,
                                    credentialsId: rowData?.credentialId,
                                    region: rowData?.regionId
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
            if (operation === ACTION_TYPE.BULK) {
                apiCall = optimizeStorageSizingForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            configurationName:
                                type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
                                    ? 'log-drive-size'
                                    : type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
                                    ? 'headroom'
                                    : 'tempdb-drive-size',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                credentialsId: string;
                                                region: string;
                                                sqlServerInstances: string[];
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            credentialId,
                                            regionId
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            credentialId: string;
                                            regionId: string;
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                credentialsId: credentialId,
                                                region: regionId,
                                                sqlServerInstances: []
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
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
                    configurationName:
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE
                            ? 'log-drive-size'
                            : type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM
                            ? 'headroom'
                            : 'tempdb-drive-size'
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            if (operation === ACTION_TYPE.BULK) {
                apiCall = optimizeStorageTierForBulk;

                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'storage-tier',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                credentialsId: string;
                                                region: string;
                                                sqlServerInstances: string[];
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            credentialId,
                                            regionId
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            credentialId: string;
                                            regionId: string;
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                credentialsId: credentialId,
                                                region: regionId,
                                                sqlServerInstances: []
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
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
                payload = {
                    configurationName: 'storage-tier'
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) {
            apiCall = optimizeResiliency;
            const state = store.getState();
            const { selectedSnapshot } = state.getWellOptimize;

            payload = {
                configurationName: ['snapshot-policy'],
                params: [
                    {
                        snapshotPolicy: {
                            uuid: selectedSnapshot?.data?.uuid,
                            name: selectedSnapshot?.data?.name
                        },
                        volumes: rowData?.objectsInViolation
                    }
                ]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
            apiCall = optimizeAwsBackup;
            const state = store.getState();
            const { selectedAWSBackup } = state.getWellOptimize;

            payload = {
                hostsToOptimize: [
                    {
                        configurationName: ['aws-backup'],
                        databaseHosts: [
                            {
                                id: rowData?.databaseHostId,
                                sqlServerInstances: [rowData?.instanceId],
                                fsxFileSystemId: rowData?.data?.assessments?.metadata?.fileSystemId,
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup),
                                credentialsId: rowData?.credentialId,
                                region: rowData?.regionId
                            }
                        ]
                    }
                ]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiCall = optimizeMaxdopConfigForBulk;
            if (operation === ACTION_TYPE.BULK) {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'max-dop',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                credentialsId: string;
                                                region: string;
                                                sqlServerInstances: string[];
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            credentialId,
                                            regionId
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            credentialId: string;
                                            regionId: string;
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                sqlServerInstances: [],
                                                credentialsId: credentialId,
                                                region: regionId
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
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
                            configurationName: 'max-dop',
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
        } else if (type === ASSESSMENT_CONFIG_NAMES.MTU) {
            apiCall = optimizeMTUConfigForBulk;
            if (operation === ACTION_TYPE.BULK) {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'mtu-alignment',
                            databaseHosts: Object.values(
                                rowData.reduce(
                                    (
                                        acc: Record<
                                            string,
                                            {
                                                id: string;
                                                credentialsId: string;
                                                region: string;
                                                sqlServerInstances: string[];
                                                interfaceNames: string[];
                                            }
                                        >,
                                        {
                                            databaseHostId,
                                            instanceId,
                                            credentialId,
                                            regionId,
                                            objectsInViolation
                                        }: {
                                            databaseHostId: string;
                                            instanceId: string;
                                            credentialId: string;
                                            regionId: string;
                                            objectsInViolation: string[];
                                        }
                                    ) => {
                                        const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                        if (!acc[uniqueRow]) {
                                            acc[uniqueRow] = {
                                                id: databaseHostId,
                                                sqlServerInstances: [],
                                                credentialsId: credentialId,
                                                region: regionId,
                                                interfaceNames: []
                                            };
                                        }
                                        acc[uniqueRow].sqlServerInstances.push(instanceId);
                                        if (objectsInViolation) {
                                            acc[uniqueRow].interfaceNames.push(...objectsInViolation);
                                        }
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
                            configurationName: 'mtu-alignment',
                            databaseHosts: [
                                {
                                    id: rowData?.databaseHostId,
                                    sqlServerInstances: [rowData?.instanceId],
                                    credentialsId: rowData?.credentialId,
                                    region: rowData?.regionId,
                                    interfaceNames: rowData?.objectsInViolation || []
                                }
                            ]
                        }
                    ]
                };
            }
        } else {
            // ToDo - More type will come like optimize for sizing and layout here
            apiCall = optimizeStorageConfig;
            if (operation === ACTION_TYPE.BULK) {
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
        if (operation === ACTION_TYPE.BULK) {
            const hostIds = payload.hostsToOptimize[0].databaseHosts.map((host: any) => host.id);
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [type]: [...(inProgressHostData[type] || []), ...hostIds]
                })
            );
            const hostinstances = payload.hostsToOptimize.flatMap((host: any) =>
                host.databaseHosts.flatMap((databaseHost: any) => {
                    const instances = databaseHost.sqlServerInstances || databaseHost.databases;
                    return instances.map((instance: any) => `${databaseHost.id}_${instance}`);
                })
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
                        `${selectedResourceId}_${selectedDatabaseInstance}`
                    ]
                })
            );
        }
        if (configEngineType === DBType.ORACLE) {
            formatOracleWellArchitectedData(dispatch, rowData?.assessments);
        } else {
            formatGetWellData(dispatch, rowData?.assessments);
        }

        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`${t('databases.well-architect.fixing-process-initiated-for')} ${type}. ${t(
                            'databases.well-architect.process-can-take-min'
                        )} `}
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
                            {t('databases.general.job-monitoring')}.
                        </Button>
                    </div>
                )
            })
        );

        let apiData = {};
        if (operation === ACTION_TYPE.BULK) {
            apiData = {
                payload
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.MAXDOP) {
            apiData = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                payload
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.MTU) {
            apiData = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                payload
            };
        } else {
            apiData = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                payload
            };
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
                        {t('databases.general.view-job-monitoring')}.
                    </Button>
                </div>
            );
            if (!res.error) {
                if (operation === ACTION_TYPE.BULK) {
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
            if (operation === ACTION_TYPE.BULK) {
                handleOptimizeStorageJob(
                    res,
                    {},
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    type,
                    operation,
                    getBulkInstanceList(payload?.hostsToOptimize, type),
                    false,
                    configEngineType
                );
            } else {
                handleOptimizeStorageJob(
                    res,
                    {
                        id: nameToIdConfigMapping(type),
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
                    operation,
                    null,
                    false,
                    configEngineType
                );
            }
        });
    };

    const getBulkInstanceList = (jobData: any[], name: string) => {
        const instanceList: any = [];

        jobData.forEach((hostOptimizeConfig: any) => {
            const databaseHosts = hostOptimizeConfig.databaseHosts || [];
            const configType = hostOptimizeConfig.type;

            databaseHosts.forEach((host: any) => {
                const instances = host.sqlServerInstances || host.databases;
                instances.forEach((instanceId: string) => {
                    instanceList.push({
                        id: configType,
                        name,
                        hostId: host.id,
                        instanceId,
                        credentialId: host?.credentialsId,
                        regionId: host?.region
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

    const handleSingleDismissPostpone = (rowData: any, type: string, operation: string, configEngineType?: string) => {
        const dismissApi = configEngineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment;
        if (operation === CONFIG_STATE_ACTIONS.DISMISS) {
            setDialog(
                <DialogComponent
                    header={engineTypeBasedResourceStr(
                        configEngineType,
                        t('databases.dismiss.dismiss-instance'),
                        t('databases.dismiss.dismiss-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {engineTypeBasedResourceStr(
                                    configEngineType,
                                    t('databases.dismiss.dialog-text-1'),
                                    t('databases.dismiss.dialog-text-database-1')
                                )}{' '}
                                {rowData?.data?.databaseInstanceName} ?
                            </DsTypography>
                            <DsTypography variant="Regular_14">{t('databases.dismiss.dialog-text-2')}</DsTypography>
                        </div>
                    }
                    primaryButton={t('databases.dismiss.dismiss')}
                    secondaryButton={t('databases.dismiss.cancel')}
                    callback={() => {
                        callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, configEngineType);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operation === CONFIG_STATE_ACTIONS.POSTPONED) {
            setDialog(
                <DialogComponent
                    header={engineTypeBasedResourceStr(
                        configEngineType,
                        t('databases.dismiss.postpone-days'),
                        t('databases.dismiss.postpone-days-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {engineTypeBasedResourceStr(
                                    configEngineType,
                                    t('databases.dismiss.postpone-line-1'),
                                    t('databases.dismiss.postpone-line-database-1')
                                )}{' '}
                                {rowData?.data?.databaseInstanceName} ?
                            </DsTypography>
                            <DsTypography variant="Regular_14">{t('databases.dismiss.dialog-text-2')}</DsTypography>
                        </div>
                    }
                    primaryButton={t('databases.dismiss.dismiss')}
                    secondaryButton={t('databases.dismiss.cancel')}
                    callback={() => {
                        callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, configEngineType);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operation === CONFIG_STATE_ACTIONS.ACTIVE) {
            callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, configEngineType);
        }
    };

    const handleDialog = (type: string, rowData: any, operation?: string) => {
        type = resolveConfigDisplayName(type);
        if (type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
            let cloneViolationsList: any = [];
            if (rowData?.objectsInViolation) {
                // get violations clone details for single selected instance. From dashboard single instance.
                cloneViolationsList =
                    rowData?.cloneDetails
                        ?.filter((clone: any) => rowData?.objectsInViolation?.includes(clone.cloneDatabaseName))
                        ?.map((obj: any) => ({
                            ...obj,
                            isOptimized:
                                cloneIsOptimizedRows?.[
                                    `${rowData?.databaseHostId}_${rowData?.instanceId}_${obj?.cloneDatabaseName}`
                                ],
                            credentialId: rowData?.credentialId,
                            regionId: rowData?.regionId,
                            resourceId: rowData?.databaseHostId,
                            hostName: rowData?.hostName,
                            instanceId: rowData?.instanceId,
                            serverInstanceName: rowData?.serverInstanceName
                        })) || [];
                dispatch(
                    setCloneDashboardData({
                        type: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                        objectsInViolation: cloneViolationsList,
                        severity: rowData?.severity,
                        tags: rowData?.tags,
                        recommendation: cardDataDefault?.clone_management?.recommendation
                    })
                );
            } else {
                // get violations clone details for all selected instance. From dashboard bulk selection.
                // Filter only not optimized row for clone
                const filteredRowData = rowData.filter(
                    (row: any) => row?.assessmentStatus !== GETWELL_STATUS.OPTIMIZED
                );
                filteredRowData?.map((item: any) => {
                    cloneViolationsList = [
                        ...cloneViolationsList,
                        ...(item?.cloneDetails
                            ?.filter((clone: any) => item?.objectsInViolation?.includes(clone.cloneDatabaseName))
                            ?.map((obj: any) => ({
                                ...obj,
                                isOptimized:
                                    cloneIsOptimizedRows?.[
                                        `${item?.databaseHostId}_${item?.instanceId}_${obj?.cloneDatabaseName}`
                                    ],
                                credentialId: item?.credentialId,
                                regionId: item?.regionId,
                                resourceId: item?.databaseHostId,
                                hostName: item?.hostName,
                                instanceId: item?.instanceId,
                                serverInstanceName: item?.serverInstanceName
                            })) || [])
                    ];
                });
                dispatch(
                    setCloneDashboardData({
                        type: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                        objectsInViolation: cloneViolationsList,
                        severity: rowData?.[0]?.severity,
                        tags: rowData?.[0]?.tags,
                        recommendation: cardDataDefault?.clone_management?.recommendation
                    })
                );
            }
            dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_OPTIMIZE_INNER_PAGE));
        } else {
            const assessmentStatusConsistent = getAssessmentStatusConsistency(rowData);
            // Check if ALL rows are WAD (offline assessment) instances - only disable if there are no fixable rows
            // A row is fixable if it's online (!isWad, status='Up') and not already optimized
            const allRowsAreWad = Array.isArray(rowData)
                ? rowData.every((row: any) => row?.isWad || row?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP)
                : rowData?.isWad || rowData?.status !== INVENTORY_STATUS.CASE_SENSITIVE_UP;

            setDialog(
                <DialogComponent
                    header={`${type}`}
                    content={
                        <DialogContent
                            type={type}
                            recommendationOptions={rowData?.recommendationOptions}
                            missingPermissions={rowData?.missingPermissions}
                            recommendedSizeInGib={rowData?.recommendedSizeInGib}
                            bulkRecommendationOptions={rowData}
                            operation={operation}
                            objectsInViolation={rowData?.objectsInViolation}
                            engineType={configEngineType}
                            assessmentStatus={assessmentStatusConsistent}
                        />
                    }
                    dialogFrom={FROM_DIALOG.OPTIMIZE}
                    primaryButton={t('databases.general.continue')}
                    secondaryButton={t('databases.general.cancel')}
                    callback={() => {
                        callOptimizeApi(type, rowData, operation);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                    customClass={type !== ASSESSMENT_CONFIG_NAMES.MAXDOP ? 'innerPage' : ''}
                    primaryButtonDisabled={allRowsAreWad}
                    primaryButtonTooltip={allRowsAreWad ? t('databases.wad.tab-disabled-message') : ''}
                    hidePrimaryButton={
                        (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                            type === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH ||
                            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE ||
                            type === ASSESSMENT_CONFIG_NAMES.SWAP_SPACE ||
                            type === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
                            type === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
                            type === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS ||
                            type === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT) &&
                        rowData?.missingPermissions &&
                        rowData?.missingPermissions.length > 0
                    }
                />
            );
        }
    };

    useEffect(() => {
        if (selectedConfig) {
            setOptimizeInnerpageSummary(selectedConfig, assessmentConfigData, dispatch, configEngineType);
        }
    }, [selectedConfig, assessmentConfigData, configEngineType, dispatch]);

    useEffect(() => {
        if (!selectedConfig) {
            return;
        }

        if (hasConfigStats(assessmentConfigData, selectedConfig, configEngineType)) {
            setValueCardData((prev: any) => ({
                ...selectedConfigSummary,
                configurationState: selectedConfigSummary.configState,
                cardHeight: prev.cardHeight || '136px',
                tagHeight: prev.tagHeight || '233px',
                data: {
                    title: 'Recommendations',
                    description: configItem?.recommendation ?? ''
                },
                cardName: selectedConfig
            }));
        }
    }, [selectedConfig, selectedConfigSummary, assessmentConfigData, configEngineType, configItem]);

    const lastColDetails = (
        name: string,
        data?: any,
        inProgressOptimizationData?: any,
        inProgressHostData?: any,
        showDismissed?: boolean,
        isFixEnabled?: boolean
    ) => ({
        id: '8',
        Header: '',
        accessor: '',
        isSticky: true,
        width: showDismissed ? '416px' : '242px',
        renderCell: (cellData: any, rowData: any) => {
            // If showing dismissed items, show Reactivate button
            if (
                showDismissed &&
                (rowData?.configState === CONFIG_STATES.DISMISSED || rowData?.configState === CONFIG_STATES.POSTPONED)
            ) {
                return (
                    <div className={styles.reactiveButtonContainer}>
                        <div className={styles.postpone}>
                            {rowData?.configState === CONFIG_STATES.POSTPONED && (
                                <div className={styles.postponeContainer}>
                                    <div>
                                        <Schedule />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.postponed-for-30-days')}
                                    </DsTypography>
                                    {rowData?.configObj?.endTime &&
                                        rowData?.configObj?.startTime &&
                                        (() => {
                                            const postponeInfo = calculatePostponeInfo(rowData?.configObj);
                                            return postponeInfo ? (
                                                <TooltipInfo isAppendedToBody>
                                                    <DsTypography variant="Regular_13">
                                                        {t('databases.well-architect.postpone-date')}{' '}
                                                        {postponeInfo.postponeDate}.
                                                    </DsTypography>
                                                    <DsTypography variant="Regular_13">
                                                        {postponeInfo.daysLeft}{' '}
                                                        {t('databases.well-architect.days-left')}
                                                    </DsTypography>
                                                </TooltipInfo>
                                            ) : null;
                                        })()}
                                </div>
                            )}
                            {rowData?.configState !== CONFIG_STATES.POSTPONED && <div style={{ width: '204px' }} />}
                        </div>
                        <div>
                            <DsButton
                                isThin
                                variant="secondary"
                                isDisabled={selectedRowsForOptimize?.length > 0}
                                onClick={() => {
                                    handleSingleDismissPostpone(
                                        rowData,
                                        name,
                                        CONFIG_STATE_ACTIONS.ACTIVE,
                                        configEngineType
                                    );
                                }}
                            >
                                {t('databases.well-architect.reactivate')}
                            </DsButton>
                        </div>
                    </div>
                );
            }

            // Original logic for non-dismissed items
            let isDisabled = false;
            let errorMessage = '';
            if (!isFixEnabled) {
                isDisabled = true;
                errorMessage = t('databases.well-architect.fix-disabled');
            } else {
                ({ isDisabled, errorMessage } = checkIfDisableForOptimize(
                    inProgressHostData,
                    name,
                    rowData,
                    t,
                    selectedRowsForOptimize,
                    configEngineType
                ));
            }

            const isInProgress = inProgressOptimizationData?.[name]?.includes(rowData?.id);
            return (
                <div className={styles.buttonContainer}>
                    {isInProgress ? (
                        <div className={styles['optimize-in-progress']}>
                            <DsFlashingDotsLoader />
                            <DsTypography variant="Regular_14">{t('databases.well-architect.fixing')}</DsTypography>
                        </div>
                    ) : isDisabled && errorMessage ? (
                        <Popover
                            popoverClass={CommonStyles.popover}
                            isAppendedToBody
                            children={<DsTypography variant="Regular_14">{errorMessage}</DsTypography>}
                            trigger="hover"
                            delayHide={200}
                            interactive
                            container={
                                <DsButton variant="secondary" isDisabled>
                                    {t('databases.well-architect.fix')}
                                </DsButton>
                            }
                        />
                    ) : (
                        <DsButton
                            isThin
                            variant="secondary"
                            isDisabled={
                                isDisabled || rowData?.assessmentStatus === GETWELL_STATUS.OPTIMIZED || !isFixEnabled
                            }
                            onClick={() => {
                                optimizeAction(rowData);
                                handleDialog(name, rowData, 'single');
                            }}
                        >
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    )}
                </div>
            );
        }
    });

    const handleBulkAction = (type: string, rowData: any) => {
        handleDialog(type, rowData, ACTION_TYPE.BULK);
    };

    // Function to handle dismiss bulk and postpone bulk action
    const handleBulkDismissPostpone = (
        type: string,
        rowData: any,
        operationType: string,
        configEngineType?: string
    ) => {
        const dismissApi = configEngineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment;
        // Filter out WAD (offline assessment) rows for dismiss and postpone operations
        const filteredRowData =
            operationType === CONFIG_STATE_ACTIONS.DISMISS || operationType === CONFIG_STATE_ACTIONS.POSTPONED
                ? rowData?.filter((row: any) => row?.isWad !== true)
                : rowData;

        // If no rows left after filtering, don't proceed
        if (!filteredRowData?.length) {
            return;
        }

        if (operationType === CONFIG_STATE_ACTIONS.DISMISS) {
            setDialog(
                <DialogComponent
                    header={engineTypeBasedResourceStr(
                        configEngineType,
                        t('databases.dismiss.dismiss-instance'),
                        t('databases.dismiss.dismiss-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {t('databases.dismiss.dialog-bulk-text-1')} {filteredRowData?.length}{' '}
                                {engineTypeBasedResourceStr(
                                    configEngineType,
                                    t('databases.dismiss.selected-instances'),
                                    t('databases.dismiss.selected-databases')
                                )}
                            </DsTypography>
                            <DsTypography variant="Regular_14">{t('databases.dismiss.dialog-text-2')}</DsTypography>
                        </div>
                    }
                    primaryButton={t('databases.dismiss.dismiss')}
                    secondaryButton={t('databases.dismiss.cancel')}
                    callback={() => {
                        callDashboardDismissApi(
                            type,
                            filteredRowData,
                            operationType,
                            dismissApi,
                            dispatch,
                            t,
                            configEngineType
                        );
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operationType === CONFIG_STATE_ACTIONS.POSTPONED) {
            setDialog(
                <DialogComponent
                    header={engineTypeBasedResourceStr(
                        configEngineType,
                        t('databases.dismiss.postpone-days'),
                        t('databases.dismiss.postpone-days-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {t('databases.dismiss.postpone-bulk-line-1')} {filteredRowData?.length}{' '}
                                {engineTypeBasedResourceStr(
                                    configEngineType,
                                    t('databases.dismiss.selected-instances'),
                                    t('databases.dismiss.selected-databases')
                                )}
                            </DsTypography>
                            <DsTypography variant="Regular_14">{t('databases.dismiss.dialog-text-2')}</DsTypography>
                        </div>
                    }
                    primaryButton={t('databases.dismiss.dismiss')}
                    secondaryButton={t('databases.dismiss.cancel')}
                    callback={() => {
                        callDashboardDismissApi(
                            type,
                            filteredRowData,
                            operationType,
                            dismissApi,
                            dispatch,
                            t,
                            configEngineType
                        );
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operationType === CONFIG_STATE_ACTIONS.ACTIVE) {
            callDashboardDismissApi(type, rowData, operationType, dismissApi, dispatch, t, configEngineType);
        }
    };

    const renderTable = () => {
        if (!selectedConfig) {
            return null;
        }

        return (
            <DashboardConfigsTable
                configType={selectedConfig}
                lastColDetails={lastColDetails}
                handleBulkAction={handleBulkAction}
                handleSingleDismissPostpone={handleSingleDismissPostpone}
                handleBulkDismissPostpone={handleBulkDismissPostpone}
            />
        );
    };

    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={styles.breadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: `${t('databases.general.well-architected')}`,
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.WELL_ARCHITECTED_TAB));
                                }
                            },
                            {
                                title: `${t('databases.well-architect.fix-configuration')} (${configDisplayName})`,
                                dataTestId: 'wlm-db-optimize-configuration'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${(configDisplayName || selectedConfig).toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_24"
                        style={{ lineHeight: 'unset' }}
                    >
                        {configDisplayName}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard valueCardData={valueCardData} configEngineType={configEngineType} />

                        <div className={styles.recommendation}>
                            <div ref={recommendationRef}>
                                <RecommendationText
                                    data={valueCardData?.data}
                                    from="dashboard"
                                    cardName={valueCardData?.cardName}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={styles.rightSection} style={{ width: '32%' }}>
                        <TagComponent
                            tagHeight={valueCardData.tagHeight}
                            engineType={configEngineType}
                            severity={valueCardData?.severity}
                            categories={configCategories}
                        />
                    </div>
                </div>

                {linkedConfigNames.length > 0 && (
                    <LinkedConfigBanner linkedConfigNames={linkedConfigNames} configName={selectedConfig} />
                )}

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default DashboardInnerPage;
