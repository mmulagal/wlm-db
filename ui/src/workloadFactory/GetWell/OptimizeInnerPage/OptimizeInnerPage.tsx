import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useMatch, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    GETWELL_STATUS,
    WLF_TABS
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import StorageTierOptimizeTable from './InnerTables/StorageTierOptimizeTable';
import store from '../../../store/store';
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
import { setCrrPrefetchLoading } from '../../../store/workloadFactory/crrRedirectionSlice';
import {
    formatAssessmentData,
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
    getLinkedConfigNames
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import LinkedConfigBanner from '../../../common/LinkedConfigBanner/LinkedConfigBanner';
import FileSystemHeadroomOptimizeTable from './InnerTables/FileSystemHeaderoomOptimizeTable';
import LogDriveSizeOptimizeTable from './InnerTables/LogDriveSizeOptimizeTable';
import TempDbDriveSizeOptimizeTable from './InnerTables/TempDbDriveSizeOptimizeTable';
import DataFilesOptimizeTable from './InnerTables/DataFilesOptimizeTable';
import LogFilesOptimizeTable from './InnerTables/LogFilesOptimizeTable';
import TempDbFilesOptimizeTable from './InnerTables/TempDbFilesOptimizeTable';
import RSSOptimizeTable from './InnerTables/RSSOptimizeTable';
import ScheduledLocalSnapshotOptimizeTable from './InnerTables/ScheduledLocalSnapshotTable';
import CRROptimizeTable from './InnerTables/CRROptimizeTable';
import CloneTabs from './CloneTabs';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import MTUOptimizeTable from './InnerTables/MTUOptimizeTable';
import StorageLayoutOracleTable from './InnerTables/StorageLayoutOracleTable';

import { useAssociateCrrLinkPrefetch } from './CRRRedirectionContent/associateCrrLinkPrefetch';
import {
    decodeVolumeParam,
    findCrrRowDataByVolumeName,
    INVENTORY_FSX_DEEP_LINK_PATH,
    INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME,
    OPEN_FIX_VOLUME_QUERY,
    pathnameWithoutTrailingSplat,
    pathnameWithoutVolumeNameSegment
} from './CRRRedirectionContent/CRRUtils';

const OptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const matchInventoryFsxDeepLinkDatabasesVol = useMatch({
        path: `/databases${INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME}`,
        end: true
    });
    const matchInventoryFsxDeepLinkDatabases = useMatch({
        path: `/databases${INVENTORY_FSX_DEEP_LINK_PATH}`,
        end: true
    });
    const matchInventoryFsxDeepLinkFsxdbVol = useMatch({
        path: `/fsxdb${INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME}`,
        end: true
    });
    const matchInventoryFsxDeepLinkFsxdb = useMatch({ path: `/fsxdb${INVENTORY_FSX_DEEP_LINK_PATH}`, end: true });
    const isInventoryFsxDeepLinkRoute = Boolean(
        matchInventoryFsxDeepLinkDatabasesVol ??
            matchInventoryFsxDeepLinkDatabases ??
            matchInventoryFsxDeepLinkFsxdbVol ??
            matchInventoryFsxDeepLinkFsxdb
    );
    const { setDialog, closeDialog } = useDialog();
    const { runAssociateLinkPrefetch } = useAssociateCrrLinkPrefetch(setDialog, closeDialog);
    const closeOptimizeDialog = () => {
        dispatch(setCrrPrefetchLoading(false));
        closeDialog();
    };
    const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
    const [cardHeight, setCardHeight] = useState({
        recommendationSection: '',
        tagSection: ''
    });
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { isWorkloadFactory, isDemoMode } = useAppSelector(state => state?.auth);
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
    const crrDeepLinkFixOpenedRef = useRef(false);

    useEffect(() => {
        if (selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
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
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setCardHeight({
                    recommendationSection: '228px',
                    tagSection: '324px'
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
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
            case ASSESSMENT_CONFIG_NAMES.CRR:
            case ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT:
                setCardHeight({
                    recommendationSection: '160px',
                    tagSection: '256px'
                });

                break;
            case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
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

    const handleCRRRedirectionDialog = useCallback(
        (_type: any, _operation: string, rowData: any) => {
            const dialogHeader = (
                <div className={styles.headerClass} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <DsTypography variant="Regular_16">{t('databases.well-architect.associate-link')}</DsTypography>
                    <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                        {t('databases.inventory.step-1-out-of')}
                    </DsTypography>
                </div>
            );
            void runAssociateLinkPrefetch(rowData, dialogHeader);
        },
        [runAssociateLinkPrefetch, t]
    );

    const openOracleCrrFixDialogForRow = (rowData: any) => {
        handleDialog(
            setDialog,
            selectedOptimizeConfig?.type,
            handleCRRRedirectionDialog,
            closeOptimizeDialog,
            selectedOptimizeConfig?.data,
            'single',
            rowData,
            selectedOptimizeConfig?.engineType,
            isWad
        );
    };

    useEffect(() => {
        if (!isInventoryFsxDeepLinkRoute) return;
        if (crrDeepLinkFixOpenedRef.current) return;

        const volumeFromQuery = searchParams.get(OPEN_FIX_VOLUME_QUERY)?.trim();
        const volumeFromPath = params.volumeName?.trim();
        const splatVolume = (params as Record<string, string | undefined>)['*']?.trim();
        const volumeToOpen = volumeFromPath;

        if (!volumeToOpen) return;
        if (selectedOptimizeConfig?.type !== ASSESSMENT_CONFIG_NAMES.CRR) return;
        if (selectedOptimizeConfig?.engineType !== DBType.ORACLE) return;
        if (isDemoMode) return;

        const objects = selectedOptimizeConfig?.data?.objectsInViolation;
        if (objects === undefined) return;

        const clearDeepLinkFromUrl = () => {
            if (volumeFromQuery) {
                const next = new URLSearchParams(searchParams);
                next.delete(OPEN_FIX_VOLUME_QUERY);
                setSearchParams(next, { replace: true });
            } else if (volumeFromPath) {
                navigate(
                    { pathname: pathnameWithoutVolumeNameSegment(location.pathname), search: location.search },
                    { replace: true }
                );
            } else if (splatVolume) {
                const basePath = pathnameWithoutTrailingSplat(location.pathname, splatVolume);
                navigate({ pathname: basePath, search: location.search }, { replace: true });
            }
        };

        const rowData = findCrrRowDataByVolumeName(volumeToOpen, selectedOptimizeConfig?.data);
        if (!rowData) {
            crrDeepLinkFixOpenedRef.current = true;
            if (objects.length > 0) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: `Could not find impacted volume "${decodeVolumeParam(volumeToOpen)}" for this link.`
                    })
                );
            }
            clearDeepLinkFromUrl();
            return;
        }

        crrDeepLinkFixOpenedRef.current = true;
        handleDialog(
            setDialog,
            selectedOptimizeConfig?.type,
            handleCRRRedirectionDialog,
            closeOptimizeDialog,
            selectedOptimizeConfig?.data,
            'single',
            rowData,
            selectedOptimizeConfig?.engineType,
            isWad
        );

        clearDeepLinkFromUrl();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- CRR data / deep-link hints; omit dialog handlers to avoid re-running on each render
    }, [
        dispatch,
        isDemoMode,
        isInventoryFsxDeepLinkRoute,
        navigate,
        location.pathname,
        location.search,
        params,
        searchParams,
        selectedOptimizeConfig?.type,
        selectedOptimizeConfig?.engineType,
        selectedOptimizeConfig?.data,
        setSearchParams
    ]);

    const buttonComponent = (rowData: any) => {
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CRR &&
            selectedOptimizeConfig?.engineType === DBType.ORACLE
        ) {
            if (isDemoMode) {
                return (
                    <Popover
                        isAppendedToBody
                        children={
                            <DsTypography variant="Regular_14">
                                {t('databases.inventory.fix-not-available')}
                            </DsTypography>
                        }
                        trigger="hover"
                        container={
                            <DsButton variant="secondary" isDisabled isThin>
                                {t('databases.well-architect.fix')}
                            </DsButton>
                        }
                    />
                );
            }
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    onClick={() => {
                        openOracleCrrFixDialogForRow(rowData);
                    }}
                >
                    {t('databases.well-architect.fix')}
                </DsButton>
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        <DsTypography variant="Regular_14">{t('databases.well-architect.fix-disabled')}</DsTypography>
                    }
                    trigger="hover"
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CRR &&
            selectedOptimizeConfig?.engineType === DBType.MSSQL
        ) {
            return (
                <DsButton isThin variant="secondary" isDisabled>
                    {t('databases.well-architect.fix')}
                </DsButton>
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
            (rowData?.status === GETWELL_STATUS.OVER_PROVISIONED || rowData?.status === GETWELL_STATUS.SHARED_DRIVE)
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        rowData?.status === GETWELL_STATUS.OVER_PROVISIONED ? (
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.log-drive-over-provisioned-error')}
                            </DsTypography>
                        ) : (
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.not-optimized-shared-drive')}
                            </DsTypography>
                        )
                    }
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE &&
            (rowData?.status === GETWELL_STATUS.OVER_PROVISIONED || rowData?.status === GETWELL_STATUS.SHARED_DRIVE)
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        rowData?.status === GETWELL_STATUS.OVER_PROVISIONED ? (
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.tempdb-drive-over-provisioned-error')}
                            </DsTypography>
                        ) : (
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.not-optimized-shared-drive')}
                            </DsTypography>
                        )
                    }
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    }
                />
            );
        }
        if (selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.bulk-action-enabled-on-selected')}
                        </DsTypography>
                    }
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT &&
            selectedOptimizeConfig?.engineType === DBType.ORACLE
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        <DsTypography variant="Regular_14">{t('databases.well-architect.fix-disabled')}</DsTypography>
                    }
                    trigger="hover"
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {t('databases.well-architect.fix')}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.MTU ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ) {
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    isDisabled={
                        rowData?.status === GETWELL_STATUS.OVER_PROVISIONED ||
                        rowData?.status === GETWELL_STATUS.SHARED_DRIVE
                    }
                    onClick={() => {
                        // optimizeAction(rowData);
                        handleDialog(
                            setDialog,
                            selectedOptimizeConfig?.type,
                            callOptimizeApi,
                            closeOptimizeDialog,
                            selectedOptimizeConfig?.data,
                            'single',
                            rowData,
                            selectedOptimizeConfig?.engineType,
                            isWad
                        );
                    }}
                >
                    {t('databases.well-architect.fix')}
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
                            closeOptimizeDialog,
                            selectedOptimizeConfig?.data,
                            'single',
                            rowData,
                            DBType.ORACLE,
                            isWad
                        );
                    }}
                >
                    {t('databases.well-architect.fix')}
                </DsButton>
            );
        }
        return (
            <Popover
                isAppendedToBody
                children={
                    <DsTypography variant="Regular_14">{t('databases.well-architect.fix-disabled')}</DsTypography>
                }
                trigger="hover"
                delayHide={200}
                interactive
                container={
                    <DsButton variant="secondary" isDisabled isThin>
                        {t('databases.well-architect.fix')}
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
        if (type === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION) {
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
        } else if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
            apiCall = optimizeStorageSizing;
            payload = {
                configurationName: selectedOptimizeConfig?.data?.id
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) {
            apiCall = optimizeStorageSizing;

            if (operation === 'bulk') {
                payload = {
                    configurationName: 'tempdb-drive-size',
                    objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.tempdbAccessPath)
                };
            } else {
                payload = {
                    configurationName: 'tempdb-drive-size',
                    objectsToOptimize: [singleRowData?.tempdbAccessPath]
                };
            }
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
                        {`${t('databases.well-architect.fixing-process-initiated-for')} ${type}. ${t(
                            'databases.well-architect.process-can-take-min'
                        )}`}
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
                            {t('databases.general.job-monitoring')}.
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
                    {type} {t('databases.well-architect.failed-to-optimize')}
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
                        {t('databases.general.view-job-monitoring')}.
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
            closeOptimizeDialog,
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
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return (
                    <StorageTierOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return (
                    <FileSystemHeadroomOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                return (
                    <LogDriveSizeOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                return (
                    <TempDbDriveSizeOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                return (
                    <DataFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                return (
                    <LogFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                return (
                    <TempDbFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
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
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                return (
                    <ScheduledLocalSnapshotOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        isWad={isWad}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.CRR:
            case ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT:
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

    const setHeading = () => selectedOptimizeConfig?.type;

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
                                    t('databases.well-architect.host-name-instance-name'),
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
                                title: `${setHeading()}`,
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
                    />
                )}

                {selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT && <CloneTabs />}

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default OptimizeInnerPage;
