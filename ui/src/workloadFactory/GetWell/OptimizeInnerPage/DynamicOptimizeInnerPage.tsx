/**
 * DynamicOptimizeInnerPage - Single Dynamic Inner Page for ALL GetWell Configs
 *
 * Replaces the switch-case based OptimizeInnerPage.tsx and all individual table components.
 * Fully data-driven: columns from CONFIG_COLUMN_MAP, recommendation from JSON, data from API.
 */

import { Button, DsTypography, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    setLandingFromInnerPage,
    setOptimizingInstanceData,
    setOptimizingData,
    setInProgressOptimizationData,
    setInProgressHostData,
    setJobToInstanceMap
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import {
    DBType,
    WLF_TABS,
    ASSESSMENT_CONFIG_NAMES,
    ACTION_TYPE,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import {
    instanceBreadCrumbSelectedFrom,
    selectHeaderTabFromBreadCrumb,
    formatAssessmentData,
    handleOptimizeStorageJob
} from '../GetWellUtils';
import { getColumnConfig, hasFixSupport } from '../../../utils/getWellConfigRegistry';
import DynamicInnerTable from './DynamicInnerTable/DynamicInnerTable';
import NestedDynamicInnerTable from './DynamicInnerTable/NestedDynamicInnerTable';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import LinkedConfigBanner from '../../../common/LinkedConfigBanner/LinkedConfigBanner';
import {
    isLinkedConfig,
    getLinkedConfigNames
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import { handleConfigDialog, checkLinkedConfigAcknowledge } from '../StorageCardComponent/optimizeUtils';
import {
    useOptimizeOperatingSystemMutation,
    useOptimizeOracleOperatingSystemMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeOracleStorageConfigMutation,
    useOptimizeHAMssqlMutation,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import store from '../../../store/store';

const DynamicOptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();

    // API hooks for optimize operations
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOracleStorageConfig] = useOptimizeOracleStorageConfigMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    // Redux state
    const { selectedOptimizeConfig, breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const {
        selectedDatabaseInstance,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        optimizingData,
        inProgressOptimizationData,
        inProgressHostData
    } = useAppSelector(state => state.getWellOptimize);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    // Extract config data from selected config
    const configId = selectedOptimizeConfig?.type;
    const configData = selectedOptimizeConfig?.data || {};
    const engineType = selectedOptimizeConfig?.engineType || DBType.MSSQL;
    const isWad = configData?.isWad || false;

    // Flat API always provides the display name in the 'name' attribute
    const displayName = configData?.name || '';

    // Get column configuration from registry
    const columnConfig = useMemo(() => {
        if (!configId) return undefined;
        return getColumnConfig(configId);
    }, [configId]);

    // Determine if optimization is supported
    const canOptimize = useMemo(() => {
        if (!configId) return false;
        return hasFixSupport(configId, engineType, configData?.status?.toLowerCase(), configData?.missingPermissions);
    }, [configId, engineType, configData]);

    // Linked config banner (Oracle)
    const linkedConfigNames = useMemo(() => {
        if (configId && engineType === DBType.ORACLE && isLinkedConfig(configId)) {
            return getLinkedConfigNames(configId);
        }
        return [];
    }, [configId, engineType]);

    // Build Oracle OS payload helper
    const getOracleOsPayload = useCallback(
        (configurationName: string) => ({
            type: 'storage-operating-system',
            hostsToOptimize: [
                {
                    configurationName,
                    databaseHosts: [
                        {
                            id: selectedResourceId,
                            region: selectedGwInstanceRegionId,
                            credentialsId: selectedGwInstanceCredId,
                            databases: [selectedDatabaseInstance]
                        }
                    ]
                }
            ]
        }),
        [selectedResourceId, selectedGwInstanceRegionId, selectedGwInstanceCredId, selectedDatabaseInstance]
    );

    // Build HA payload helper
    const getHaPayload = useCallback(
        (configName: string) => ({
            hostsToOptimize: [
                {
                    id: selectedResourceId,
                    region: selectedGwInstanceRegionId,
                    credentialsId: selectedGwInstanceCredId,
                    databaseInstances: [selectedDatabaseInstance]
                }
            ],
            configurationName: configName
        }),
        [selectedResourceId, selectedGwInstanceRegionId, selectedGwInstanceCredId, selectedDatabaseInstance]
    );

    // Main API call handler for Continue button
    const callOptimizeApi = useCallback(
        (rowData: any) => {
            if (!configId) return;

            const technicalId = rowData?.id || configId;
            const configType = rowData?.type; // 'volume', 'lun', or undefined

            let apiCall: any = null;
            let apiInput = {};
            let statusType = '';

            // Determine config category and route to appropriate API
            // ONTAP storage configs (volume/lun) - both MSSQL and Oracle
            if (configType === 'volume' || configType === 'lun') {
                statusType = ASSESSMENT_CONFIG_NAMES.ONTAP;
                apiCall = engineType === DBType.ORACLE ? optimizeOracleStorageConfig : optimizeStorageConfig;
                apiInput = {
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId,
                    databaseHostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    payload: {
                        assessments: [
                            {
                                configurationName: technicalId,
                                objectsToOptimize: rowData?.objectsInViolation || []
                            }
                        ]
                    }
                };
            }
            // Oracle OS configurations - use bulk OS API with technical ID
            else if (engineType === DBType.ORACLE) {
                statusType = ASSESSMENT_CONFIG_NAMES.OS;
                apiCall = optimizeOracleOs;
                apiInput = {
                    payload: getOracleOsPayload(technicalId)
                };
            }
            // MSSQL HA configurations - use HA-specific API
            else if (
                technicalId === 'shared-storage' ||
                technicalId === 'cluster-quorum' ||
                technicalId === 'heartbeat-settings' ||
                technicalId === 'sqlserver-service'
            ) {
                statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
                apiCall = optimizeHAMssql;
                const configNameMap: Record<string, string> = {
                    'heartbeat-settings': 'heartbeat',
                    'sqlserver-service': 'sqlserver-service'
                };
                apiInput = {
                    configName: configNameMap[technicalId] || technicalId,
                    payload: getHaPayload(technicalId)
                };
            }
            // MSSQL OS configurations - default for all other MSSQL configs
            else {
                statusType = ASSESSMENT_CONFIG_NAMES.OS;
                apiCall = optimizeOs;
                apiInput = {
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId,
                    databaseHostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    payload: {
                        configurationName: technicalId
                    }
                };
            }

            if (!apiCall) {
                console.error('No API call configured for config:', technicalId);
                return;
            }

            // Set optimizing state
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

            // Show notification with Job Monitoring link
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.INFO,
                    message: (
                        <div>
                            {`Fixing process initiated for ${
                                rowData?.name || displayName
                            }. This process can take upto 2 minutes. Track progress in `}
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

            // Call the API
            apiCall(apiInput).then((res: any) => {
                const failedMsgData = (
                    <div>
                        {rowData?.name || displayName} failed to optimize.
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

                // Store job-to-instance mapping if successful
                if (!res.error) {
                    const state = store.getState();
                    dispatch(
                        setJobToInstanceMap({
                            ...state.getWellOptimize.jobToInstanceMap,
                            [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                        })
                    );
                }

                // Monitor the job and refresh assessment when complete
                handleOptimizeStorageJob(
                    res,
                    {
                        ...rowData,
                        hostId: selectedResourceId,
                        instanceId: selectedDatabaseInstance,
                        credentialId: selectedGwInstanceCredId,
                        regionId: selectedGwInstanceRegionId
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

                // Close the dialog
                closeDialog();
            });
        },
        [
            configId,
            engineType,
            displayName,
            selectedResourceId,
            selectedDatabaseInstance,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            optimizingData,
            inProgressOptimizationData,
            inProgressHostData,
            dispatch,
            t,
            isWorkloadFactory,
            getOracleOsPayload,
            getHaPayload,
            optimizeOs,
            optimizeOracleOs,
            optimizeStorageConfig,
            optimizeOracleStorageConfig,
            optimizeHAMssql,
            getJobDetailApi,
            closeDialog
        ]
    );

    // Navigate back to the Well-Architected page for this engine
    const handleBackToWellArchitected = useCallback(() => {
        if (engineType === DBType.ORACLE) {
            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
        } else {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        }
        dispatch(setLandingFromInnerPage(true));
    }, [dispatch, engineType]);

    // Bulk action handler - opens dialog with selected rows
    const handleBulkAction = useCallback(() => {
        if (!configId) return;

        handleConfigDialog(
            setDialog,
            callOptimizeApi,
            closeDialog,
            {
                engineType,
                data: {
                    ...configData,
                    name: displayName, // Ensure name is always present
                    id: configId
                }
            },
            'bulk',
            null,
            isWad
        );
    }, [configId, configData, displayName, engineType, isWad, setDialog, closeDialog, callOptimizeApi]);

    // Handle single row fix - opens dialog for individual row
    const handleRowFix = useCallback(
        (rowData: any) => {
            if (!configId) return;

            handleConfigDialog(
                setDialog,
                callOptimizeApi,
                closeDialog,
                {
                    engineType,
                    data: {
                        ...configData,
                        name: displayName, // Ensure name is always present
                        id: configId
                    }
                },
                'single',
                rowData,
                isWad
            );
        },
        [configId, configData, displayName, engineType, isWad, setDialog, closeDialog, callOptimizeApi]
    );

    // If no config is selected, go back
    if (!configId || !configData) {
        return (
            <div className={styles['optimize-inner-page']}>
                <DsTypography variant="Semibold_16">
                    {t('databases.well-architect.no-configuration-selected')}
                </DsTypography>
            </div>
        );
    }

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
                                onClick: handleBackToWellArchitected
                            },
                            {
                                title: displayName
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography variant="Semibold_20">{displayName}</DsTypography>
                    <DsTypography variant="Semibold_16">{selectedDatabaseInstanceName || ''}</DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.contentSection}>
                        <OptimizeCard />
                    </div>

                    <div className={styles.tagSection}>
                        <TagComponent categories={configData?.categories} />
                    </div>
                </div>

                {linkedConfigNames.length > 0 && (
                    <LinkedConfigBanner linkedConfigNames={linkedConfigNames} configName={configId} />
                )}

                {/* Dynamic Table - Route to nested or flat table based on config */}
                {columnConfig && (
                    <div className={styles.tableSection}>
                        {columnConfig.useNestedExpandable ? (
                            <NestedDynamicInnerTable
                                configId={configId}
                                data={configData}
                                columnConfig={columnConfig}
                                engineType={engineType}
                                isWad={isWad}
                            />
                        ) : (
                            <DynamicInnerTable
                                configId={configId}
                                data={configData}
                                columnConfig={columnConfig}
                                engineType={engineType}
                                isWad={isWad}
                                canOptimize={canOptimize}
                                handleBulkAction={handleBulkAction}
                                handleRowFix={handleRowFix}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DynamicOptimizeInnerPage;
