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
import { DismissDialog } from '../StorageCardComponent/DismissDialog/DismissDialog';
import {
    calculatePostponeInfo,
    PostponeInfo,
    isTableRowConfigurationActivating,
    isTableRowConfigurationInState,
    ActivatingInfo
} from '../GetWellHelper';
import { GENERAL } from '../../../utils/appConstants';
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
import {
    formatGetWellData,
    handleOptimizeStorageJob,
    filterIndividualOntapOsConfigurations,
    filterIndividualMssqlHighAvailabilityConfigurations,
    formatAssessmentData
} from '../GetWellUtils';
import { formatOracleWellArchitectedData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
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
    WLF_TABS
} from '../../../utils/consts';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import store from '../../../store/store';

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
    customStyles
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

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOracleStorageConfig] = useOptimizeOracleStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();
    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();

    const isDialogPrimaryBtnDisabled = (rowData: any) =>
        rowData?.name === 'OS type' ||
        rowData?.name === 'NTFS allocation unit size' ||
        rowData?.name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER;

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

        if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('tcp-advanced-options');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multipath-io');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('host-utilities');
            apiInput = { payload };
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('transparent-hugepages');
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
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('filesystems-io-options');
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
        } else if (engineType === DBType.ORACLE && rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT) {
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOracleOs;
            payload = getOracleOsPayload('multiblock-readcount');
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
        formatAssessmentData(engineType, dispatch);
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
                            {GENERAL.JOB_MONITORING}.
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
    const innerPageOracleCheck = (name: string) => {
        if (
            engineType === DBType.ORACLE &&
            (name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO ||
                name === ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES ||
                name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION ||
                name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
                name === ASSESSMENT_CONFIG_NAMES.SELINUX ||
                name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT ||
                name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES ||
                name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
                name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
                name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS ||
                name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS ||
                name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
                name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
                name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
                name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS ||
                name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
                name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
                name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME)
        ) {
            return false;
        }
        return true;
    };

    const innerPageCheck = (name: string) => {
        if (
            (engineType === DBType.MSSQL &&
                (name === 'Multipath I/O Sessions' ||
                    name === 'Multipath I/O Status' ||
                    name === 'Multipath I/O Timeout' ||
                    name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER ||
                    name === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM ||
                    name === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS ||
                    name === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE)) ||
            from === WLF_TABS.DASHBOARD
        ) {
            return false;
        }
        return true;
    };

    const innerPageText = (name: string) => {
        if (
            name === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER ||
            name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
            name === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY ||
            name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
            name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
            name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
            name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
            name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS
        ) {
            return 'View';
        }
        return 'View and fix';
    };

    // Function to check if configuration is activating
    const isRowConfigurationActivating = (rowData: any) =>
        isTableRowConfigurationActivating(rowData, fullCardData, driftAssessmentData);

    const handleOntapDialog = (rowData: any) => {
        // Check if this is an ASM configuration that should only have a Close button
        const isCloseButton =
            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
            rowData?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS;
        if (isCloseButton) {
            setDialog(
                <DialogComponent
                    header={`${rowData?.name} `}
                    content={
                        <DialogContent
                            type={rowData?.name}
                            objectsInViolation={rowData?.objectsInViolation}
                            engineType={engineType}
                        />
                    }
                    primaryButton={GENERAL.CLOSE}
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
                        />
                    }
                    primaryButton={GENERAL.CONTINUE}
                    secondaryButton={GENERAL.CANCEL}
                    callback={() => {
                        callOptimizeApi(rowData);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                    customClass="innerPage"
                    primaryButtonDisabled={isDialogPrimaryBtnDisabled(rowData)}
                    primaryButtonTooltip={isDialogPrimaryBtnDisabled(rowData) ? GENERAL.COMING_SOON : ''}
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
            (selectedHeaderTab === WLF_TABS.OPTIMIZE || selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED) &&
            innerPageOracleCheck(rowData?.name) &&
            innerPageCheck(rowData?.name)
        ) {
            handleNavigateToOptimizePage(rowData);
        } else {
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
    const shouldApplyDisabledRowStyle = (rowData: any) =>
        isTableRowConfigurationInState(
            rowData,
            fullCardData,
            [CONFIG_STATES.ACTIVATING, CONFIG_STATES.DISMISSED, CONFIG_STATES.POSTPONED],
            driftAssessmentData
        );

    // Common cell wrapper component for consistent styling and click handling
    const CellWrapper = ({
        children,
        rowData,
        onMouseEnter = () => handleCardHoverMouseEnter(rowData),
        onMouseLeave = () => handleCardHoverMouseLeave()
    }: {
        children: React.ReactNode;
        rowData: any;
        onMouseEnter?: (event?: React.MouseEvent) => void;
        onMouseLeave?: (event?: React.MouseEvent) => void;
    }) => {
        const isDisabled = shouldApplyDisabledRowStyle(rowData);

        return (
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
    };

    // Function For Dismiss
    const handleSingleAction = (action: string, rowData: any) => {
        if (!rowData) return;

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
    };

    const addSuccessNotification = (action: string, cardName?: string) => {
        addSuccessNotificationHelper(action, cardName || '', dispatch, t, false);
    };

    const handleDismissResponse = (res: any, action: string, rowData: any) => {
        if (!rowData) return;

        // Use the appropriate format function based on engine type
        const formatFunction = engineType === DBType.ORACLE ? formatOracleWellArchitectedData : formatGetWellData;

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
                isSubConfiguration
                subConfigurationName={rowData?.name}
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

    // Helper function to calculate postpone info for a specific configuration using existing logic
    const calculateConfigPostponeInfo = (rowData: any) => {
        if (!isConfigurationPostponed(rowData)) return null;

        // Create a structure that matches what calculatePostponeInfo expects
        const mockCardData = {
            config: {
                dismissedObj: rowData.dismissedObj
            }
        };

        // Reuse the existing calculatePostponeInfo function
        return calculatePostponeInfo(mockCardData, 'config');
    };

    // Component to render postpone indicator for individual configurations
    const renderConfigPostponeInfo = (rowData: any) => {
        if (!isConfigurationPostponed(rowData)) return null;

        // Create a getPostponeInfo function that returns the calculated postpone info
        const getPostponeInfo = () => calculateConfigPostponeInfo(rowData);

        return (
            <div className={styles.postponeInfoContainer}>
                <PostponeInfo
                    configKey="config"
                    getPostponeInfo={getPostponeInfo}
                    translation={t}
                    placement="right"
                    customStyles={customStyles}
                />
            </div>
        );
    };

    // Dismiss button component
    const renderDismissButton = (rowData: any) => {
        // Don't show dismiss button when in dismissed configuration mode or when row is activating
        if (
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
                        {GENERAL.DISMISS}
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
        return cellData || GENERAL.NOT_AVAILABLE;
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

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.well-architect.recommendation-table.headers.configuration'),
            accessor: 'name',
            width: windowSize.width > 1700 ? '15%' : from === WLF_TABS.INVENTORY ? '268px' : '250px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>{cellData || GENERAL.NOT_AVAILABLE}</CellWrapper>
            )
        },
        {
            id: '2',
            Header: t('databases.well-architect.recommendation-table.headers.status'),
            accessor: 'status',
            width: windowSize.width > 1700 ? '10%' : '180px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
                    {/* Show "n/a" when viewing dismissed configurations or when the category is in Activating state */}
                    {showDismissedConfigurations === true || isRowConfigurationActivating(rowData) ? (
                        GENERAL.NOT_AVAILABLE
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
            width: windowSize.width > 1700 ? '10%' : from === WLF_TABS.INVENTORY ? '173px' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.errorMessage) {
                    return <CellWrapper rowData={rowData}>{showUnavailableWithTooltip(rowData)}</CellWrapper>;
                }

                if (!cellData || cellData === GENERAL.NOT_AVAILABLE) {
                    return (
                        <CellWrapper rowData={rowData}>
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.well-architect.unavailable')}
                            </DsTypography>
                        </CellWrapper>
                    );
                }

                return (
                    <CellWrapper rowData={rowData}>
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
            width: windowSize.width > 1700 ? '15%' : from === WLF_TABS.INVENTORY ? '220px' : '200px',
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
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.SELINUX ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME
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
                    <CellWrapper rowData={rowData}>
                        {/* Show "n/a" when viewing dismissed configurations or when the category is in Activating state */}
                        {showDismissedConfigurations === true || isRowConfigurationActivating(rowData) ? (
                            GENERAL.NOT_AVAILABLE
                        ) : (
                            <>
                                {(engineType === DBType.MSSQL &&
                                    rowData?.name !== 'Multipath I/O Sessions' &&
                                    rowData?.name !== 'Multipath I/O Status' &&
                                    rowData?.name !== 'Multipath I/O Timeout') ||
                                engineType === DBType.ORACLE ? (
                                    <div>
                                        <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                            {`${rowData?.totalObjectsInViolation || 0} out of ${
                                                rowData?.totalObjectsAssessed || 0
                                            } ${type}`}
                                        </DsTypography>
                                    </div>
                                ) : (
                                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                        Storage multipath
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
            width: windowSize.width > 1700 ? '10%' : from === WLF_TABS.INVENTORY ? '220px' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
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
            Header: '',
            accessor: 'recommendation',
            width: windowSize.width > 1700 ? '15%' : from === WLF_TABS.INVENTORY ? '202px' : '290px',
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
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
            width: showDismissedConfigurations
                ? windowSize.width > 1700
                    ? '30%'
                    : from === WLF_TABS.INVENTORY
                    ? '500px'
                    : '200px'
                : windowSize.width > 1700
                ? '22%'
                : from === WLF_TABS.INVENTORY
                ? '350px'
                : '200px',
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
                    <div className={styles.buttonGroup}>
                        {renderDismissButton(rowData)}

                        {/* Reactivate button for dismissed configurations */}
                        {showDismissedConfigurations && (
                            <div className={styles.reactivateButtonContainer}>
                                {/* Show postpone indicator if configuration is postponed */}
                                {renderConfigPostponeInfo(rowData)}

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
                                    (isRowConfigurationActivating(rowData) ? (
                                        // Show activating info instead of View and fix buttons
                                        // As we known this configuration is in activating state as we have called isRowConfigurationActivating so can send dummy configKey with activation status
                                        <ActivatingInfo
                                            configKey="dummy"
                                            cardData={{ dummy: { dismissedObj: { configState: 'ACTIVATING' } } }}
                                            translation={t}
                                            showFullContent={false}
                                            customStyles={customStyles}
                                        />
                                    ) : GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name) &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                                        <TooltipComponent
                                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                            placement="bottom"
                                            width="120px"
                                            height="30px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {innerPageCheck(rowData?.name) ? 'View & fix' : 'Fix'}
                                                </DsButton>
                                            </div>
                                        </TooltipComponent>
                                    ) : optimizingInstanceData &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZING ? (
                                        <TooltipComponent
                                            title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                                            placement="bottom"
                                            width="310px"
                                            height="50px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {innerPageText(rowData?.name)}
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
                                                isDisabled={rowData?.status !== 'Not optimized'}
                                            >
                                                {innerPageText(rowData?.name)}
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

    const ColDefsDashboard: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.well-architect.recommendation-table.headers.configuration'),
            accessor: 'name',
            width: windowSize.width > 1700 ? '15%' : '250px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>{cellData || GENERAL.NOT_AVAILABLE}</CellWrapper>
            )
        },

        {
            id: '3',
            Header: t('databases.well-architect.recommendation-table.headers.severity'),
            accessor: 'severity',
            width: windowSize.width > 1700 ? '15%' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.errorMessage) {
                    return <CellWrapper rowData={rowData}>{showUnavailableWithTooltip(rowData)}</CellWrapper>;
                }

                if (!cellData || cellData === GENERAL.NOT_AVAILABLE) {
                    return (
                        <CellWrapper rowData={rowData}>
                            <DsTypography variant="Regular_13" className={styles.colText}>
                                {t('databases.well-architect.unavailable')}
                            </DsTypography>
                        </CellWrapper>
                    );
                }

                return (
                    <CellWrapper rowData={rowData}>
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
            width: windowSize.width > 1700 ? '20%' : '200px',
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
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.SELINUX ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
                            rowData?.name === ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME
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
                    <CellWrapper rowData={rowData}>
                        {/* Show "n/a" when viewing dismissed configurations or when the category is in Activating state */}
                        {showDismissedConfigurations === true || isRowConfigurationActivating(rowData) ? (
                            GENERAL.NOT_AVAILABLE
                        ) : (
                            <>
                                {(engineType === DBType.MSSQL &&
                                    rowData?.name !== 'Multipath I/O Sessions' &&
                                    rowData?.name !== 'Multipath I/O Status' &&
                                    rowData?.name !== 'Multipath I/O Timeout') ||
                                engineType === DBType.ORACLE ? (
                                    <div>
                                        <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                            {`${rowData?.totalObjectsInViolation || 0} out of ${
                                                rowData?.totalObjectsAssessed || 0
                                            } ${type}`}
                                        </DsTypography>
                                    </div>
                                ) : (
                                    <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                        Storage multipath
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
            width: windowSize.width > 1700 ? '15%' : '200px',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
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
            Header: '',
            accessor: 'recommendation',
            width: windowSize.width > 1700 ? '15%' : '290px',
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
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
            width: windowSize.width > 1700 ? '20%' : '200px',
            renderCell: (cellData: any, rowData: any) => (
                <CellWrapper rowData={rowData}>
                    <div className={styles.buttonGroup}>
                        {renderDismissButton(rowData)}

                        {/* Reactivate button for dismissed configurations */}
                        {showDismissedConfigurations && (
                            <div className={styles.reactivateButtonContainer}>
                                {/* Show postpone indicator if configuration is postponed */}
                                {renderConfigPostponeInfo(rowData)}

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
                                    (isRowConfigurationActivating(rowData) ? (
                                        // Show activating info instead of View and fix buttons
                                        // As we known this configuration is in activating state as we have called isRowConfigurationActivating so can send dummy configKey with activation status
                                        <ActivatingInfo
                                            configKey="dummy"
                                            cardData={{ dummy: { dismissedObj: { configState: 'ACTIVATING' } } }}
                                            translation={t}
                                            showFullContent={false}
                                            customStyles={customStyles}
                                        />
                                    ) : GW_CONFIG_OPTIMIZE_NA.includes(rowData?.name) &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED ? (
                                        <TooltipComponent
                                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                                            placement="bottom"
                                            width="120px"
                                            height="30px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {innerPageCheck(rowData?.name) ? 'View & fix' : 'Fix'}
                                                </DsButton>
                                            </div>
                                        </TooltipComponent>
                                    ) : optimizingInstanceData &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZED &&
                                      rowData?.status !== GETWELL_STATUS.OPTIMIZING ? (
                                        <TooltipComponent
                                            title={GENERAL.OPTIMIZATION_IN_PROGRESS}
                                            placement="bottom"
                                            width="310px"
                                            height="50px"
                                        >
                                            <div>
                                                <DsButton variant="secondary" isDisabled>
                                                    {innerPageText(rowData?.name)}
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
                                                isDisabled={rowData?.status !== 'Not optimized'}
                                            >
                                                {innerPageText(rowData?.name)}
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

    // Filter table data based on dismissed state
    const filteredTableData = React.useMemo(() => {
        if (!tableData) return [];

        // First apply ONTAP/OS/MSSQL HA subcategory filtering if applicable
        let filtered = tableData;
        let isOntapOrOsTable = false;
        let isMssqlHighAvailabilityTable = false;

        if (showDismissedConfigurations !== undefined) {
            // Apply ONTAP/OS subcategory filtering for ONTAP and OS configurations
            isOntapOrOsTable = tableData.some(
                (row: any) => row?.type === 'volume' || row?.type === 'lun' || row?.type === 'os'
            );

            // Apply MSSQL High Availability subcategory filtering
            isMssqlHighAvailabilityTable = tableData.some((row: any) => row?.type === 'mssqlHighAvailability');

            if (isOntapOrOsTable) {
                // Use driftAssessmentData if available, otherwise fallback to fullCardData
                const assessmentData = driftAssessmentData || fullCardData;
                // Use individual configuration filtering
                filtered = filterIndividualOntapOsConfigurations(
                    tableData,
                    assessmentData,
                    showDismissedConfigurations
                );
                // For ONTAP/OS tables, return the filtered result without additional filtering
                // since individual configuration filtering has already been applied
                return filtered;
            }
            if (isMssqlHighAvailabilityTable) {
                // Use driftAssessmentData if available, otherwise fallback to fullCardData
                const assessmentData = driftAssessmentData || fullCardData;
                // Use individual configuration filtering for MSSQL HA
                filtered = filterIndividualMssqlHighAvailabilityConfigurations(
                    tableData,
                    assessmentData,
                    showDismissedConfigurations
                );
                // For MSSQL HA tables, return the filtered result without additional filtering
                // since individual configuration filtering has already been applied
                return filtered;
            }
        }

        // Apply standard dismissed configuration filtering for non-ONTAP/OS/MSSQL HA tables
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
        columns: from === WLF_TABS.INVENTORY ? ColDefs : ColDefsDashboard,
        rows: filteredTableData,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    const getTableClassName = () => {
        const baseClass =
            from === WLF_TABS.INVENTORY ? styles.recommendationTable : styles.recommendationTableDashboard;
        const dismissedClass = showDismissedConfigurations === true ? styles.dismissedTableBackground : '';
        return `${baseClass} ${dismissedClass}`.trim();
    };

    return (
        <div className={getTableClassName()}>
            <Table
                // @ts-expect-error - Table props type mismatch
                tableProps={tableProps}
                isDoubleRow
                // variant="innerTable"
            />
        </div>
    );
};

export default RecommendationTable;
