import React, { useState, useCallback, useRef } from 'react';
import { Button, DsButton, DsTypography, Popover, Table, useTable, useDialog } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import useResize from '../../../common/hooks/useResize';
import styles from './RecommendationTable.module.scss';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Active } from '../../../assets/success.svg';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import Tag from '../../../common/Tag/Tag';
import RecommendationTooltip from '../RecommendationTooltip/RecommendationTooltip';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import ImpactedResourceDialog from '../../Dashboard/DashboardInnerPage/RenderTables/ImpactedResourceDialog/ImpactedResourceDialog';
import { DismissDialog } from '../StorageCardComponent/DismissDialog/DismissDialog';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import {
    calculatePostponeInfo,
    PostponeInfo,
    isTableRowConfigurationActivating,
    isTableRowConfigurationInState,
    ActivatingInfo
} from '../GetWellHelper';
import {
    useDismissMssqlAssessmentMutation,
    useDismissOracleAssessmentMutation,
    useLazyGetSubTaskListQuery,
    useOptimizeHAMssqlMutation,
    useOptimizeOperatingSystemMutation,
    useOptimizeOracleOperatingSystemMutation,
    useOptimizeOracleStorageConfigMutation,
    useOptimizeStorageConfigMutation
} from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';
import {
    handleSingleAction as handleSingleActionHelper,
    addSuccessNotification as addSuccessNotificationHelper,
    handleDismissResponse as handleDismissResponseHelper,
    handleDismissError as handleDismissErrorHelper
} from '../StorageCardComponent/StorageCardComponentHelper';

import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { formatGetWellDataFlat, handleOptimizeStorageJob } from '../GetWellUtils';
import { formatOracleWellArchitectedData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import oracleConfigRegistry from '../../../utils/configRegistry/oracleConfigRegistry.json';
import mssqlConfigRegistry from '../../../utils/configRegistry/mssqlConfigRegistry.json';
import {
    ACTION_TYPE,
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    GETWELL_STATUS,
    GW_CONFIG_OPTIMIZE_NA,
    MSSQL_IMPACTED_DRIVE_CONFIGS,
    ONLINE_INSTANCE_STATUSES,
    ORACLE_IMPACTED_DRIVE_CONFIGS,
    WLF_TABS,
    MSSQL_UNSUPPORTED_FIX_TYPES,
    ORACLE_UNSUPPORTED_FIX_TYPES,
    OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES,
    UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES
} from '../../../utils/consts';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    setDriftAssessmentData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import store from '../../../store/store';
import { checkLinkedConfigAcknowledge } from '../StorageCardComponent/optimizeUtils';
import { callDashboardDismissApi } from '../../Dashboard/DashboardInnerPage/DashboardInnerPageHelper';
import { GENERAL } from '../../../utils/appConstants';

const CellWrapper = ({
    children,
    isDisabled,
    onMouseEnter,
    onMouseLeave
}: {
    children: React.ReactNode;
    isDisabled: boolean;
    onMouseEnter?: (event?: React.MouseEvent) => void;
    onMouseLeave?: (event?: React.MouseEvent) => void;
}) => (
    <div
        onMouseEnter={isDisabled ? undefined : onMouseEnter}
        onMouseLeave={isDisabled ? undefined : onMouseLeave}
        role="button"
        tabIndex={0}
        className={`${styles.cellClickable} ${isDisabled ? styles.disabledCell : ''}`}
    >
        {children}
    </div>
);

const RecommendationTable = ({
    tableData,
    isLoading,
    optimizePrintState,
    from,
    hostId,
    instanceId,
    engineType = DBType.MSSQL,
    // Adding undefined by default to stop showing dismiss button in Dashboard
    showDismissedConfigurations = undefined,
    setShowDismissedConfigurations,
    driftAssessmentData,
    customStyles,
    dashboardInstanceData,
    divWidth
}: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const windowSize = useResize();
    const { setDialog, closeDialog } = useDialog();
    const [dismissAction, setDismissAction] = useState(false);
    const [showDismissButton, setShowDismissButton] = useState(false);
    const [activeRowId, setActiveRowId] = useState<string | null>(null);

    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        optimizingData,
        optimizingInstanceData,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId
    } = useAppSelector(state => state.getWellOptimize);
    const { selectedHeaderTab } = useAppSelector(state => state.inventoryV2);
    // Get the full card data to check dismissed configurations count
    const fullCardData = useAppSelector(state => state.getWellOptimize.cardData);
    const isWad = (from === WLF_TABS.DASHBOARD ? dashboardInstanceData?.isWad : fullCardData?.isWad) || false;
    const instanceStatus = useAppSelector(state => state.getWellOptimize.instanceStatus);
    const currentInstanceStatus = from === WLF_TABS.DASHBOARD ? dashboardInstanceData?.status : instanceStatus;
    const normalizedInstanceStatus = currentInstanceStatus?.toLowerCase();
    const isInstanceOffline = !!normalizedInstanceStatus && !ONLINE_INSTANCE_STATUSES.has(normalizedInstanceStatus);

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOracleStorageConfig] = useOptimizeOracleStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();
    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();

    const getHaPayload = (configurationName: string) => ({
        hostsToOptimize: [
            {
                configurationName,
                databaseHosts: [
                    {
                        id: selectedResourceId || hostId,
                        sqlServerInstances: [selectedDatabaseInstance || instanceId],
                        credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                        region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                    }
                ]
            }
        ]
    });

    const getSharedStoragePayload = (rowData: any) => ({
        hostsToOptimize: [
            {
                configurationName: 'shared-storage',
                databaseHosts: [
                    {
                        id: selectedResourceId || hostId,
                        sqlServerInstances: [
                            {
                                databaseInstanceId: selectedDatabaseInstance || instanceId,
                                ontapLunPaths: rowData?.objectsInViolation
                            }
                        ],
                        credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                        region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                    }
                ]
            }
        ]
    });

    const getOracleOsPayload = (configurationName: string) => ({
        type: 'storage-operating-system',
        hostsToOptimize: [
            {
                configurationName,
                databaseHosts: [
                    {
                        id: selectedResourceId || hostId,
                        region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                        credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                        databases: [selectedDatabaseInstance || instanceId]
                    }
                ]
            }
        ]
    });

    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any) => {
        // Only 1 config can be passed at a time
        const state = store.getState();
        let payload = {};
        let apiInput = {};
        let apiCall = null;
        let statusType = '';

        if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multipath-io');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('host-utilities');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.SELINUX) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('selinux');
            apiInput = { payload };
        } else if (
            engineType === DBType.ORACLE &&
            rowData?.name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT
        ) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('iscsi-replacement-timeout');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multipath-io-sessions');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multipath-configuration');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multipath-friendly-names');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE) {
            statusType = ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('afd-logical-block-size');
            apiInput = { payload };
        } else if (
            engineType === DBType.ORACLE &&
            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE
        ) {
            statusType = ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('asmlib-logical-block-size');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('kernel-parameters');
            apiInput = { payload };
        } else if (
            engineType === DBType.ORACLE &&
            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME
        ) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('nfs-mount-options-adrhome');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('nfs-caching-options');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('nfsv4-domain-name');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && (rowData?.type === 'volume' || rowData?.type === 'lun')) {
            statusType = ASSESSMENT_CONFIG_NAMES.ONTAP;
            apiCall = optimizeOracleStorageConfig;
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || hostId,
                instanceId: selectedDatabaseInstance || instanceId,
                payload: {
                    assessments: [
                        {
                            configurationName: rowData?.id,
                            objectsToOptimize: rowData?.objectsInViolation
                        }
                    ]
                }
            };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getSharedStoragePayload(rowData);
            apiInput = { configName: 'shared-storage', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('cluster-quorum');
            apiInput = { configName: 'cluster-quorum', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('heartbeat-settings');
            apiInput = { configName: 'heartbeat', payload };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE) {
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getHaPayload('sqlServer-service');
            apiInput = { configName: 'sqlserver-service', payload };
        } else if (rowData?.type === 'volume' || rowData?.type === 'lun') {
            statusType = ASSESSMENT_CONFIG_NAMES.ONTAP;
            apiCall = optimizeStorageConfig;
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || hostId,
                instanceId: selectedDatabaseInstance || instanceId,
                payload: {
                    assessments: [
                        {
                            configurationName: rowData?.id,
                            objectsToOptimize: rowData?.objectsInViolation
                        }
                    ]
                }
            };
        } else {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOs;
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || hostId,
                instanceId: selectedDatabaseInstance || instanceId,
                payload: {
                    configurationName: rowData?.id
                }
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [statusType]: [
                    ...(inProgressOptimizationData[statusType] || []),
                    `${selectedResourceId}_${selectedDatabaseInstance}`
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [statusType]: [...(inProgressHostData[statusType] || []), selectedResourceId]
            })
        );
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${rowData?.name}. This process can take upto 2 minutes. Track progress in `}
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

        apiCall(apiInput).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {rowData?.name} failed to optimize.
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
                dispatch(
                    setJobToInstanceMap({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                    })
                );
            }
            handleOptimizeStorageJob(
                res,
                {
                    ...rowData,
                    hostId: selectedResourceId || hostId,
                    instanceId: selectedDatabaseInstance || instanceId,
                    credentialId: selectedGwInstanceCredId || credIdFromJM,
                    regionId: selectedGwInstanceRegionId || regionFromJM
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                statusType,
                ACTION_TYPE.SINGLE,
                {},
                false,
                engineType
            );
        });
    };
    // Get config metadata from registry (replaces hardcoded innerPageOracleCheck, innerPageCheck, innerPageText)
    const getConfigMetadata = (configName: string) => {
        const registry = engineType === DBType.ORACLE ? oracleConfigRegistry : mssqlConfigRegistry;
        return registry[configName as keyof typeof registry] || { hasInnerPage: true, viewOnly: false };
    };

    const canNavigateToInnerPage = (name: string) => {
        // Dashboard view never navigates to inner page
        if (from === WLF_TABS.DASHBOARD) {
            return false;
        }
        const metadata = getConfigMetadata(name);
        return metadata.hasInnerPage === true;
    };

    const getInnerPageButtonText = (name: string) => {
        const metadata = getConfigMetadata(name);
        return metadata.viewOnly ? t('databases.well-architect.view') : t('databases.well-architect.view-and-fix');
    };

    // Function to check if configuration is activating
    const isRowConfigurationActivating = (rowData: any) => isTableRowConfigurationActivating(rowData, fullCardData);

    const handleOntapDialog = (rowData: any) => {
        // Oracle configs in ORACLE_UNSUPPORTED_FIX_TYPES should show Close button (includes placement, ASM, NFS, patches, etc.)
        const isOracleWithUnsupportedFix =
            engineType === DBType.ORACLE && ORACLE_UNSUPPORTED_FIX_TYPES.has(rowData?.name);
        const isMssqlWithUnsupportedFix = engineType === DBType.MSSQL && MSSQL_UNSUPPORTED_FIX_TYPES.has(rowData?.name);

        // Check if this is a configuration that should only have a Close button
        const isCloseButton =
            isWad ||
            isOracleWithUnsupportedFix ||
            isMssqlWithUnsupportedFix ||
            (OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(rowData?.name) &&
                rowData?.status === GETWELL_STATUS.OVER_PROVISIONED) ||
            (UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(rowData?.name) &&
                rowData?.status === GETWELL_STATUS.UNDER_PROVISIONED &&
                rowData?.missingPermissions &&
                rowData?.missingPermissions.length > 0);
        if (isCloseButton) {
            setDialog(
                <DialogComponent
                    header={`${rowData?.name} `}
                    content={
                        <DialogContent
                            type={rowData?.name}
                            objectsInViolation={rowData?.objectsInViolation}
                            engineType={engineType}
                            isWad={isWad}
                            status={rowData?.status}
                            missingPermissions={rowData?.missingPermissions}
                        />
                    }
                    primaryButton={t('databases.general.close')}
                    callback={() => {
                        closeDialog();
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                    customClass="innerPage"
                />
            );
        } else {
            setDialog(
                <DialogComponent
                    header={`${rowData?.name}`}
                    content={
                        <DialogContent
                            type={rowData?.name}
                            objectsInViolation={rowData?.objectsInViolation}
                            engineType={engineType}
                            isWad={isWad}
                        />
                    }
                    primaryButton={t('databases.general.continue')}
                    secondaryButton={t('databases.general.cancel')}
                    callback={() => {
                        if (checkLinkedConfigAcknowledge()) {
                            return;
                        }
                        callOptimizeApi(rowData);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                    customClass="innerPage"
                />
            );
        }
    };

    const handleNavigateToOptimizePage = (rowData: any) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_ONTAP_INNER_PAGE));
        dispatch(setSelectedOptimizeConfig({ type: rowData?.name, data: rowData, hostId, instanceId, engineType }));
    };
    // This is for inner page
    const handleDifferentNavigation = (rowData: any) => {
        if (
            (selectedHeaderTab === WLF_TABS.OPTIMIZE ||
                selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED ||
                selectedHeaderTab === WLF_TABS.OPTIMIZE_FROM_WELL_ARCHITECTED_TAB ||
                selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB) &&
            canNavigateToInnerPage(rowData?.name)
        ) {
            handleNavigateToOptimizePage(rowData);
        } else {
            if (from === WLF_TABS.DASHBOARD && engineType === DBType.ORACLE) {
                const instanceAssessments = dashboardInstanceData?.instanceAssessments;
                if (instanceAssessments) {
                    dispatch(setDriftAssessmentData(instanceAssessments));
                } else {
                    // Reset to prevent stale data from a previous instance's dialog
                    dispatch(setDriftAssessmentData(null));
                }
            }
            handleOntapDialog(rowData);
        }
    };

    const handleCardHoverMouseLeave = useCallback(() => {
        // Hide dismiss button when mouse leaves the card
        if (showDismissedConfigurations !== undefined && !showDismissedConfigurations) {
            setActiveRowId(null);
            setShowDismissButton(false);
        }
    }, [showDismissedConfigurations]);

    const handleCardHoverMouseEnter = useCallback(
        (rowData: any) => {
            // Show dismiss button when mouse enters the card
            if (showDismissedConfigurations !== undefined || !showDismissedConfigurations) {
                setActiveRowId(rowData?.id);
                setShowDismissButton(true);
            }
        },
        [showDismissedConfigurations]
    );

    // Function to check if row should be disabled (activating, dismissed, or postponed)
    const shouldApplyDisabledRowStyle = (rowData: any) => {
        if (from === WLF_TABS.DASHBOARD) {
            return showDismissedConfigurations || rowData?.configState === CONFIG_STATES.ACTIVATING;
        }
        return isTableRowConfigurationInState(rowData, fullCardData, [
            CONFIG_STATES.ACTIVATING,
            CONFIG_STATES.DISMISSED,
            CONFIG_STATES.POSTPONED
        ]);
    };

    // Function For Dismiss
    const handleSingleAction = (action: string, rowData: any) => {
        if (!rowData) return;

        if (from === WLF_TABS.DASHBOARD) {
            const dismissApi = engineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment;
            const newRowData = {
                ...rowData,
                ...dashboardInstanceData
            };
            callDashboardDismissApi(rowData?.id, [newRowData], action, dismissApi, dispatch, t, engineType);
        } else {
            // Create a wrapper function that passes rowData to handleDismissResponse
            const handleDismissResponseWithRowData = (res: any, actionParam: string) => {
                handleDismissResponse(res, actionParam, rowData);
            };

            handleSingleActionHelper(
                action,
                rowData,
                selectedResourceId || hostId,
                selectedDatabaseInstance || instanceId,
                selectedGwInstanceCredId || credIdFromJM,
                selectedGwInstanceRegionId || regionFromJM,
                engineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment,
                setDismissAction,
                handleDismissResponseWithRowData,
                handleDismissError
            );
        }
    };

    const addSuccessNotification = (action: string, cardName?: string) => {
        addSuccessNotificationHelper(action, cardName || '', dispatch, t, false);
    };

    const handleDismissResponse = (res: any, action: string, rowData: any) => {
        if (!rowData) return;

        // Use the appropriate format function based on engine type
        // Wrap formatGetWellDataFlat to match the expected signature (dispatch, data, showDismissedView)
        const formatFunction =
            engineType === DBType.ORACLE
                ? formatOracleWellArchitectedData
                : (dispatch: any, data?: any, showDismissedView?: boolean) => {
                      formatGetWellDataFlat(dispatch, data, showDismissedView || false, false, false, t);
                  };

        handleDismissResponseHelper(
            res,
            action,
            rowData,
            selectedGwInstanceCredId || credIdFromJM,
            selectedResourceId || hostId,
            selectedDatabaseInstance || instanceId,
            selectedGwInstanceRegionId || regionFromJM,
            showDismissedConfigurations,
            setShowDismissedConfigurations,
            fullCardData,
            dispatch,
            false, // false as it is a sub configuration so to show sub-config in the notification
            addSuccessNotification,
            t,
            formatFunction,
            engineType
        );
    };

    const handleDismissError = (err: any) => {
        handleDismissErrorHelper(err, dispatch, setDismissAction);
    };

    const handleDismissButtonClick = (rowData: any) => {
        if (!rowData) return;

        setDialog(
            <DismissDialog
                type="single"
                storageTier={rowData?.name}
                callback={(selectedAction: string) => {
                    handleSingleAction(selectedAction, rowData);
                }}
                closeCallback={closeDialog}
            />
        );
    };

    const dismissDisableButton = (rowData: any) => {
        if (!rowData) return true;

        // Disable button if configuration is already dismissed or postponed
        return (
            rowData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
            rowData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED
        );
    };

    // Helper function to check if a configuration is postponed
    const isConfigurationPostponed = (rowData: any) => rowData?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

    // Helper function to check if a configuration is dismissed (but not postponed)
    const isConfigurationDismissed = (rowData: any) => rowData?.dismissedObj?.configState === CONFIG_STATES.DISMISSED;

    // Helper function to calculate postpone info for a specific configuration using existing logic
    const calculateConfigPostponeInfo = (rowData: any) => {
        const configState = rowData?.dismissedObj?.configState;
        if (configState !== CONFIG_STATES.POSTPONED && configState !== CONFIG_STATES.DISMISSED) {
            return null;
        }

        // Create a structure that matches what calculatePostponeInfo expects
        const mockCardData = {
            config: {
                dismissedObj: rowData.dismissedObj,
                block_one: { value: rowData.name },
                category: rowData.category || ''
            }
        };

        // Reuse the existing calculatePostponeInfo function with fullCardData
        return calculatePostponeInfo(mockCardData, 'config', fullCardData);
    };

    // Component to render postpone/dismiss indicator for individual configurations
    const renderConfigDismissInfo = (rowData: any) => {
        const isPostponed = isConfigurationPostponed(rowData);
        const isDismissed = isConfigurationDismissed(rowData);

        if (!isPostponed && !isDismissed) return null;

        // Create a getPostponeInfo function that returns the calculated postpone info
        const getPostponeInfo = () => calculateConfigPostponeInfo(rowData);

        return (
            <div className={styles.postponeInfoContainer}>
                {isPostponed && (
                    <PostponeInfo
                        configKey="config"
                        getPostponeInfo={getPostponeInfo}
                        translation={t}
                        placement="bottom"
                    />
                )}
            </div>
        );
    };

    // Dismiss button component
    const renderDismissButton = (rowData: any) => {
        // Don't show dismiss button when in dismissed configuration mode or when row is activating
        if (
            isWad ||
            showDismissedConfigurations === undefined ||
            showDismissedConfigurations ||
            shouldApplyDisabledRowStyle(rowData)
        )
            return null;

        if (activeRowId !== rowData?.id) return null;
        if (showDismissButton) {
            return (
                <div className={styles.buttonSection}>
                    <DsButton
                        type="text"
                        onClick={() => handleDismissButtonClick(rowData)}
                        isDisabled={isLoading || dismissAction || dismissDisableButton(rowData)}
                    >
                        {t('databases.general.dismiss')}
                    </DsButton>
                </div>
            );
        }
        return null;
    };

    const statusValue = (cellData: string) => {
        if (cellData === GETWELL_STATUS.OPTIMIZED) {
            return GETWELL_STATUS.OPTIMIZED;
        }
        if (cellData === GETWELL_STATUS.OPTIMIZING) {
            return GETWELL_STATUS.OPTIMIZING;
        }
        return cellData || t('databases.general.not-available');
    };

    const lastColWidth = () => {
        if (from === WLF_TABS.DASHBOARD) {
            if (windowSize.width > 1847) {
                return showDismissedConfigurations ? '25%' : '22%';
            }
            if (showDismissedConfigurations) {
                return '403px';
            }
            return '393px';
        }
        if (showDismissedConfigurations) {
            return '25%';
        }
        return '22%';
    };

    // In case of error message coming from API we would display the Unavailable with tooltip
    const showUnavailableWithTooltip = (rowData: any) => (
        <div className={styles.tooltipContainer}>
            <div className={styles.tooltip}>
                <div className={styles.errorMessage}>
                    <Popover
                        popoverClass=""
                        children={rowData?.errorMessage}
                        trigger="hover"
                        isAppendedToBody={false}
                        container={<TooltipIcon />}
                        placement="bottom"
                    />
                </div>
            </div>

            {t('databases.well-architect.unavailable')}
        </div>
    );

    const handleImpactedResourceDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={t('databases.well-architect.impacted-resources')}
                content={<ImpactedResourceDialog data={rowData} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };

    const impactedResourceDialogCheck = (rowData: any) => {
        if (
            from === WLF_TABS.DASHBOARD &&
            ((engineType === DBType.MSSQL && MSSQL_IMPACTED_DRIVE_CONFIGS.includes(rowData?.name)) ||
                (engineType === DBType.ORACLE && ORACLE_IMPACTED_DRIVE_CONFIGS.includes(rowData?.name)))
        ) {
            return true;
        }
        return false;
    };

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.well-architect.recommendation-table.headers.configuration'),
            accessor: 'name',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? '15%' : '240px') : '15%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper
                    isDisabled={shouldApplyDisabledRowStyle(rowData)}
                    onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                    onMouseLeave={handleCardHoverMouseLeave}
                >
                    {cellData || t('databases.general.not-available')}
                </CellWrapper>
            )
        },
        {
            id: '2',
            Header: t('databases.well-architect.recommendation-table.headers.status'),
            accessor: 'status',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? '13%' : '180px') : '13%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper
                    isDisabled={shouldApplyDisabledRowStyle(rowData)}
                    onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                    onMouseLeave={handleCardHoverMouseLeave}
                >
                    {/* Show "n/a" when viewing dismissed configurations or when the category is in Activating state */}
                    {showDismissedConfigurations === true ||
                    isRowConfigurationActivating(rowData) ||
                    rowData?.configState === CONFIG_STATES.ACTIVATING ? (
                        t('databases.general.not-available')
                    ) : (
                        <>
                            {rowData?.errorMessage && showUnavailableWithTooltip(rowData)}

                            {cellData && !rowData?.errorMessage && (
                                <div className={styles.statusCol}>
                                    <div>
                                        {cellData === GETWELL_STATUS.OPTIMIZED && (
                                            <Active className={styles.statusIcon} />
                                        )}
                                        {cellData === GETWELL_STATUS.NOT_OPTIMIZED && (
                                            <NotActive className={styles.statusIcon} />
                                        )}
                                        {(cellData === GETWELL_STATUS.OPTIMIZING ||
                                            cellData === GETWELL_STATUS.ANALYZING) && (
                                            <InProgress className={styles.statusIcon} />
                                        )}
                                    </div>
                                    <div>{statusValue(cellData)}</div>
                                </div>
                            )}
                        </>
                    )}
                </CellWrapper>
            )
        },
        {
            id: '3',
            Header: t('databases.well-architect.recommendation-table.headers.severity'),
            accessor: 'severity',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? '8%' : '140px') : '8%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.errorMessage) {
                    return (
                        <CellWrapper
                            isDisabled={shouldApplyDisabledRowStyle(rowData)}
                            onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                            onMouseLeave={handleCardHoverMouseLeave}
                        >
                            {showUnavailableWithTooltip(rowData)}
                        </CellWrapper>
                    );
                }

                if (!cellData || cellData === GENERAL.NOT_AVAILABLE) {
                    return (
                        <CellWrapper
                            isDisabled={shouldApplyDisabledRowStyle(rowData)}
                            onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                            onMouseLeave={handleCardHoverMouseLeave}
                        >
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.well-architect.unavailable')}
                            </DsTypography>
                        </CellWrapper>
                    );
                }

                return (
                    <CellWrapper
                        isDisabled={shouldApplyDisabledRowStyle(rowData)}
                        onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                        onMouseLeave={handleCardHoverMouseLeave}
                    >
                        <div className={styles.statusCol}>
                            <div>
                                {cellData === GETWELL_STATUS.OPTIMIZED && <Active className={styles.statusIcon} />}
                                {cellData === GETWELL_STATUS.NOT_OPTIMIZED && (
                                    <NotActive className={styles.statusIcon} />
                                )}
                                {(cellData === GETWELL_STATUS.OPTIMIZING || cellData === GETWELL_STATUS.ANALYZING) && (
                                    <InProgress className={styles.statusIcon} />
                                )}
                            </div>
                            <div>{statusValue(cellData)}</div>
                        </div>
                    </CellWrapper>
                );
            }
        },
        {
            id: '4',
            Header: t('databases.well-architect.recommendation-table.headers.impacted-resources'),
            accessor: 'totalObjectsInViolation',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? '15%' : '200px') : '15%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                let type = '';
                if (engineType === DBType.ORACLE) {
                    if (rowData?.type === 'volume') {
                        type = 'volumes';
                    } else if (rowData?.type === 'lun') {
                        type = 'LUN path';
                    } else if (rowData?.type === 'os') {
                        if (
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.SELINUX ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.DNFS_CONSISTENT_IP_RESOLUTION ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.DNFS_ENABLEMENT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE
                        ) {
                            type = 'EC2 instances';
                        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY) {
                            type = 'Disk Group';
                        } else if (
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS
                        ) {
                            type = 'databases';
                        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS) {
                            type = 'volumes';
                        }
                    }
                } else if (rowData?.type === 'volume') {
                    type = 'volumes';
                } else if (rowData?.type === 'lun') {
                    type = 'LUN path';
                } else if (rowData?.type === 'os') {
                    type = 'drives';
                }

                return (
                    <CellWrapper
                        isDisabled={shouldApplyDisabledRowStyle(rowData)}
                        onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                        onMouseLeave={handleCardHoverMouseLeave}
                    >
                        {/* Show "n/a" when viewing dismissed configurations or when the category is in Activating state */}
                        {showDismissedConfigurations === true ||
                        isRowConfigurationActivating(rowData) ||
                        rowData?.configState === CONFIG_STATES.ACTIVATING ? (
                            t('databases.general.not-available')
                        ) : (
                            <>
                                {(engineType === DBType.MSSQL &&
                                    rowData?.name !== 'Multipath I/O Sessions' &&
                                    rowData?.name !== ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_STATUS &&
                                    rowData?.name !== ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_TIMEOUT) ||
                                engineType === DBType.ORACLE ? (
                                    <div>
                                        {impactedResourceDialogCheck(rowData) &&
                                        rowData?.totalObjectsInViolation > 0 ? (
                                            <div className={CommonStyles.impactedDrivesCell}>
                                                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                                    {`${rowData?.totalObjectsInViolation || 0} out of ${
                                                        rowData?.totalObjectsAssessed || 0
                                                    } ${type}`}
                                                </DsTypography>
                                                <Button
                                                    variant="text"
                                                    onClick={() => handleImpactedResourceDialog(rowData)}
                                                >
                                                    {t('databases.dashboard.view')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                                {`${rowData?.totalObjectsInViolation || 0} out of ${
                                                    rowData?.totalObjectsAssessed || 0
                                                } ${type}`}
                                            </DsTypography>
                                        )}
                                    </div>
                                ) : (
                                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                        {t('databases.general.storage-multipath')}
                                    </DsTypography>
                                )}
                            </>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            id: '5',
            Header: t('databases.well-architect.recommendation-table.headers.tags'),
            accessor: 'tags',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? '10%' : '140px') : '10%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper
                    isDisabled={shouldApplyDisabledRowStyle(rowData)}
                    onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                    onMouseLeave={handleCardHoverMouseLeave}
                >
                    <div className={styles.tooltipContainer}>
                        {cellData?.length > 0 && (
                            <div className={styles.tooltip}>
                                <Popover
                                    popoverClass=""
                                    children={
                                        <div className={styles.tags}>
                                            {cellData?.map((perTag: string) => (
                                                <Tag text={perTag} />
                                            ))}
                                        </div>
                                    }
                                    trigger="hover"
                                    delayHide={200}
                                    interactive
                                    isAppendedToBody={false}
                                    container={<TooltipIcon />}
                                />
                            </div>
                        )}
                        {cellData?.length === 0 && (
                            <div>
                                <DisabledTooltipIcon />
                            </div>
                        )}

                        <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                            {`Tags (${cellData.length})`}
                        </DsTypography>
                    </div>
                </CellWrapper>
            )
        },
        {
            id: '6',
            Header: t('databases.well-architect.recommendation-table.headers.recommendations'),
            accessor: 'recommendation',
            width: from === WLF_TABS.DASHBOARD ? (windowSize.width > 1847 ? 'auto' : '232px') : 'auto',
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper
                    isDisabled={shouldApplyDisabledRowStyle(rowData)}
                    onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                    onMouseLeave={handleCardHoverMouseLeave}
                >
                    <div className={styles.recommendation}>
                        <div className={styles.tooltipContainer}>
                            {cellData?.length === 0 && (
                                <div>
                                    <DisabledTooltipIcon />
                                </div>
                            )}
                            {cellData?.length > 0 && (
                                <div className={styles.tooltip}>
                                    <Popover
                                        popoverClass=""
                                        children={cellData && <RecommendationTooltip data={cellData} />}
                                        trigger="hover"
                                        delayHide={200}
                                        container={<TooltipIcon />}
                                        placement="bottom"
                                    />
                                </div>
                            )}
                            <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                {t('databases.well-architect.recommendation-table.recommendation')}
                            </DsTypography>
                        </div>
                    </div>
                </CellWrapper>
            )
        },
        {
            id: '7',
            Header: '',
            accessor: '',
            isSticky: true,
            width: lastColWidth(),
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper
                    isDisabled={shouldApplyDisabledRowStyle(rowData)}
                    onMouseEnter={() => handleCardHoverMouseEnter(rowData)}
                    onMouseLeave={handleCardHoverMouseLeave}
                >
                    <div className={styles.buttonGroup}>
                        {renderDismissButton(rowData)}

                        {/* Reactivate button for dismissed configurations */}
                        {showDismissedConfigurations && (
                            <div className={styles.reactivateButtonContainer}>
                                {/* Show postpone/dismiss indicator if configuration is dismissed or postponed */}
                                {renderConfigDismissInfo(rowData)}

                                <div
                                    className={styles.buttonSection}
                                    style={{
                                        position: 'relative',
                                        zIndex: 1000,
                                        pointerEvents: 'auto'
                                    }}
                                    onClick={(e: any) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleSingleAction(CONFIG_STATE_ACTIONS.ACTIVE, rowData);
                                    }}
                                >
                                    <DsButton
                                        variant="secondary"
                                        onClick={(e: any) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleSingleAction(CONFIG_STATE_ACTIONS.ACTIVE, rowData);
                                        }}
                                        isDisabled={isLoading || dismissAction}
                                    >
                                        {t('databases.well-architect.dismiss.reactivate')}
                                    </DsButton>
                                </div>
                            </div>
                        )}

                        {/* Regular action buttons for non-dismissed configurations */}
                        {!showDismissedConfigurations && (
                            <div className={styles.recommendation}>
                                {!optimizePrintState &&
                                    (isRowConfigurationActivating(rowData) ||
                                    rowData?.configState === CONFIG_STATES.ACTIVATING ? (
                                        // Show activating info instead of View and fix buttons
                                        // As we known this configuration is in activating state as we have called isRowConfigurationActivating so can send dummy configKey with activation status
                                        <ActivatingInfo
                                            configKey="dummy"
                                            cardData={{
                                                dummy: { dismissedObj: { configState: CONFIG_STATES.ACTIVATING } }
                                            }}
                                            translation={t}
                                            showFullContent={false}
                                        />
                                    ) : GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name) &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                                        <Popover
                                            popoverClass={styles['copy-popover']}
                                            children={t('databases.well-architect.fix-disabled')}
                                            trigger="hover"
                                            isAppendedToBody
                                            container={
                                                <div>
                                                    <DsButton variant="secondary" isDisabled>
                                                        {t('databases.well-architect.view-and-fix')}
                                                    </DsButton>
                                                </div>
                                            }
                                        />
                                    ) : optimizingInstanceData &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZING ? (
                                        <TooltipComponent
                                            title={t('databases.well-architected-tab.fix-after-operation-ends')}
                                            placement="bottom"
                                            width="310px"
                                            height="50px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {getInnerPageButtonText(rowData?.name)}
                                                </DsButton>
                                            </div>
                                        </TooltipComponent>
                                    ) : isInstanceOffline && rowData?.status === GETWELL_STATUS.NOT_OPTIMIZED ? (
                                        <TooltipComponent
                                            title={t('databases.well-architect.only-online-resource-fix')}
                                            placement="bottom"
                                            width="260px"
                                            height="30px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {getInnerPageButtonText(rowData?.name)}
                                                </DsButton>
                                            </div>
                                        </TooltipComponent>
                                    ) : (
                                        <div id={`${engineType}-${rowData?.id}-optimize`}>
                                            <DsButton
                                                variant="secondary"
                                                onClick={(e: any) => {
                                                    e.stopPropagation();
                                                    handleDifferentNavigation(rowData);
                                                }}
                                                isDisabled={rowData?.status !== GETWELL_STATUS.NOT_OPTIMIZED}
                                            >
                                                {getInnerPageButtonText(rowData?.name)}
                                            </DsButton>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </CellWrapper>
            )
        }
    ];

    // Filter table data based on dismissed state for dashboard
    const filteredTableDataDash = React.useMemo(() => {
        if (!tableData) return [];

        // Apply standard dismissed configuration filtering for non-ONTAP/OS/MSSQL HA tables
        return tableData.filter((row: any) => {
            const isDismissed =
                row?.configState === CONFIG_STATES.DISMISSED || row?.configState === CONFIG_STATES.POSTPONED;

            // Show dismissed rows only when in dismissed configuration mode
            if (showDismissedConfigurations) {
                return isDismissed;
            }
            // Show non-dismissed rows in normal mode
            return !isDismissed;
        });
    }, [tableData]);

    // Filter table data based on dismissed state
    const filteredTableData = React.useMemo(() => {
        if (!tableData) return [];

        // First apply ONTAP/OS/MSSQL HA subcategory filtering if applicable
        const filtered = tableData;
        let isOntapOrOsTable = false;
        const isMssqlHighAvailabilityTable = false;

        if (showDismissedConfigurations !== undefined) {
            // Apply ONTAP/OS subcategory filtering for ONTAP and OS configurations
            isOntapOrOsTable = tableData.some(
                (row: any) => row?.type === 'volume' || row?.type === 'lun' || row?.type === 'os'
            );
        }

        // Apply standard dismissed configuration filtering for all tables (flat API)
        return filtered.filter((row: any) => {
            const isDismissed =
                row?.dismissedObj?.configState === CONFIG_STATES.DISMISSED ||
                row?.dismissedObj?.configState === CONFIG_STATES.POSTPONED;

            // Show dismissed rows only when in dismissed configuration mode
            if (showDismissedConfigurations) {
                return isDismissed;
            }
            // Show non-dismissed rows in normal mode
            return !isDismissed;
        });
    }, [tableData, showDismissedConfigurations, fullCardData, driftAssessmentData]);

    const tableProps = useTable({
        isSorting: false,
        columns: ColDefs,
        rows: from === WLF_TABS.DASHBOARD ? filteredTableDataDash : filteredTableData,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    const getTableClassName = () => {
        const baseClass = styles.recommendationTable;
        const dismissedClass =
            showDismissedConfigurations === true ? styles.dismissedTableBackground : styles.dismissedTableBackground;
        const paddingClass = from === WLF_TABS.INVENTORY ? styles.inventoryClass : styles.dashboardClass;

        return `${baseClass} ${dismissedClass} ${paddingClass}`.trim();
    };

    return (
        <div
            className={getTableClassName()}
            style={
                from === WLF_TABS.DASHBOARD
                    ? { width: `${divWidth - 80}px`, maxWidth: `${divWidth - 80}px` }
                    : undefined
            }
        >
            {from === WLF_TABS.DASHBOARD ? (
                <span
                    className={styles.managedSubTable}
                    style={{ width: `${divWidth - 80}px`, maxWidth: `${divWidth - 80}px` }}
                >
                    <Table
                        // @ts-expect-error - Table props type mismatch
                        tableProps={tableProps}
                    />
                </span>
            ) : (
                <Table
                    // @ts-expect-error - Table props type mismatch
                    tableProps={tableProps}
                />
            )}
        </div>
    );
};

export default RecommendationTable;
