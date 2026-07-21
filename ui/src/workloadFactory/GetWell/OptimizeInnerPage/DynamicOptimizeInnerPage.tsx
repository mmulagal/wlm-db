/**
 * DynamicOptimizeInnerPage - Single Dynamic Inner Page for ALL GetWell Configs
 *
 * Replaces the switch-case based OptimizeInnerPage.tsx and all individual table components.
 * Fully data-driven: columns from CONFIG_COLUMN_MAP, recommendation from JSON, data from API.
 */

import { DsTypography, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    setLandingFromInnerPage,
    setOptimizingData,
    setInProgressOptimizationData,
    setInProgressHostData,
    setJobToInstanceMap,
    setIsInnerPageOptimize,
    setCloneDashboardData,
    setCardData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import {
    DBType,
    WLF_TABS,
    ACTION_TYPE,
    ASSESSMENT_CONFIG_IDS,
    GETWELL_STATUS,
    WELL_ARCHITECTED_STATUS
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import {
    instanceBreadCrumbSelectedFrom,
    selectHeaderTabFromBreadCrumb,
    handleOptimizeStorageJob
} from '../GetWellUtils';
import {
    getColumnConfig,
    isViewOnlyConfig,
    getOptimizeApiConfig,
    OptimizeApiConfig,
    getConfigEntry
} from '../../../utils/configRegistry';
import {
    useOptimizeMutations,
    buildOptimizeApiInput,
    buildOptimizeInfoNotification,
    buildOptimizeFailedMessage
} from '../optimizeApiUtils';
import DynamicInnerTable from './DynamicInnerTable/DynamicInnerTable';
import NestedDynamicInnerTable from './DynamicInnerTable/NestedDynamicInnerTable';
import CloneTabs from './CloneTabs';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import LinkedConfigBanner from '../../../common/LinkedConfigBanner/LinkedConfigBanner';
import {
    isLinkedConfig,
    getLinkedConfigNames
} from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import { handleConfigDialog } from '../StorageCardComponent/optimizeUtils';
import { useLazyGetSubTaskListQuery } from '../../../utils/apiService';
import store from '../../../store/store';
import { useAssociateCrrLinkPrefetch } from './CRRRedirectionContent/associateCrrLinkPrefetch';

const DynamicOptimizeInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const { runAssociateLinkPrefetch } = useAssociateCrrLinkPrefetch(setDialog, closeDialog);

    const mutationMap = useOptimizeMutations();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    // Redux state
    const { selectedOptimizeConfig, breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const {
        selectedDatabaseInstance,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        optimizingData,
        inProgressOptimizationData,
        inProgressHostData,
        isInnerPageOptimize,
        optimizingInstanceData,
        isWad: isWadFromStore,
        selectedRowFsxId,
        driftAssessmentData
    } = useAppSelector(state => state.getWellOptimize);
    const { crrPrefetchLoading } = useAppSelector(state => state.crrRedirection);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    // Extract config data from selected config
    const configId = selectedOptimizeConfig?.type;
    const configData = selectedOptimizeConfig?.data || {};
    const engineType = selectedOptimizeConfig?.engineType || DBType.MSSQL;
    // Check isWad from config data (API response) OR from Redux store (set on WAD navigation)
    const isWad = configData?.isWad || isWadFromStore || false;

    // Flat API provides display name in the 'name' field of the response
    const displayName = configData?.name || configId || '';

    // Populate cloneDashboardData for CloneTabs when navigating from Well-Architected page
    useEffect(() => {
        if (configId === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT && configData?.cloneDetails) {
            const cloneViolations = configData.cloneDetails.map((item: any) => ({
                ...item,
                resourceId: item.databaseHostId,
                instanceId: item.databaseInstanceName,
                regionId: item.regionId || selectedGwInstanceRegionId,
                credentialId: item.credentialId || selectedGwInstanceCredId
            }));
            dispatch(
                setCloneDashboardData({
                    type: configData?.name || 'Clone cleanup',
                    objectsInViolation: cloneViolations,
                    severity: configData?.severity,
                    tags: configData?.tags || configData?.categories,
                    recommendation: configData?.recommendation
                })
            );
        }
    }, [configId, configData, dispatch, selectedGwInstanceRegionId, selectedGwInstanceCredId]);

    // When job is initiated from inner page, navigate back immediately (don't refresh yet)
    useEffect(() => {
        if (isInnerPageOptimize) {
            dispatch(setIsInnerPageOptimize(false));
            dispatch(setLandingFromInnerPage(true));
            if (engineType === DBType.ORACLE) {
                dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
            } else {
                dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
            }
            // Don't trigger refresh here - status is already set to Optimizing
            // Refresh will happen when job completes via setGwRefreshPage in handleOptimizeStorageJob
        }
    }, [isInnerPageOptimize, dispatch, engineType]);

    // Get column configuration from registry
    const columnConfig = useMemo(() => {
        if (!configId) return undefined;
        return getColumnConfig(configId, engineType);
    }, [configId, engineType]);

    // Check if this is a patch config (they don't have columnConfig but should still render)
    const isPatchConfig = useMemo(() => {
        if (!configId) return false;
        const configEntry = getConfigEntry(configId, engineType);
        return configEntry?.dialogContent?.features?.showPatchTable ?? false;
    }, [configId, engineType]);

    // Determine if optimization is supported for inner page row-level fixes
    // Check if optimizeApi exists (not the fixSupported flag which is for dashboard bulk)
    const canOptimize = useMemo(() => {
        if (!configId) return false;
        return !!getOptimizeApiConfig(configId, engineType);
    }, [configId, engineType]);

    // View-only configs show a "View" button that opens dialog with "Fix not supported" banner
    const isViewOnly = useMemo(() => {
        if (!configId) return false;
        return isViewOnlyConfig(configId, engineType);
    }, [configId, engineType]);

    // Linked config banner (Oracle) - only show for layout placement configs
    const linkedConfigNames = useMemo(() => {
        if (!configId || engineType !== DBType.ORACLE) return [];
        const configEntry = getConfigEntry(configId, engineType);
        if (configEntry?.dialogContent?.features?.showLinkedConfigBanner && isLinkedConfig(configId)) {
            return getLinkedConfigNames(configId);
        }
        return [];
    }, [configId, engineType]);

    // Main API call handler for Continue button — registry-driven
    const callOptimizeApi = useCallback(
        (rowData: Record<string, unknown>, operation?: string, singleRowData?: Record<string, unknown>) => {
            if (!configId) return;

            // Use row-specific ID if available (e.g., for ASM layouts), otherwise use configId
            const technicalId = (rowData?.id as string) || configId;

            const apiConfig = getOptimizeApiConfig(configId, engineType);
            const { mutation, statusType } = apiConfig as OptimizeApiConfig;
            const apiCall = mutationMap[mutation];

            // For bulk operations, enrich selectedRowsForOptimizeInnerPage with host/instance context
            // For single row fixes, use singleRowData; otherwise use full rowData
            const effectiveRowData =
                operation === ACTION_TYPE.BULK
                    ? (() => {
                          const apiConfig = getOptimizeApiConfig(configId, engineType);

                          // For credential-scoped configs (thin-provision, compression, etc.),
                          // collect all objectNames into a single objectsInViolation array
                          if (apiConfig?.payloadScope === 'credential-scoped') {
                              const allObjects = selectedRowsForOptimizeInnerPage
                                  .map((row: any) => row.objectName)
                                  .filter(Boolean);
                              return {
                                  ...rowData,
                                  objectsInViolation: allObjects
                              };
                          }

                          // For standard bulk configs (MTU, RSS, etc.), enrich each row with host/instance metadata
                          return selectedRowsForOptimizeInnerPage.map((row: any) => {
                              const enrichedRow: any = {
                                  ...row,
                                  databaseHostId: selectedResourceId,
                                  credentialId: selectedGwInstanceCredId,
                                  regionId: selectedGwInstanceRegionId,
                                  instanceId: selectedDatabaseInstance
                              };

                              // For RSS config, wrap adapter name string into networkAdapters array
                              if (configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION && row.adapterName) {
                                  enrichedRow.networkAdapters = [row.adapterName];
                              }
                              // For other configs (MTU, etc.), wrap objectName into objectsInViolation array
                              else if (row.objectName) {
                                  enrichedRow.objectsInViolation = [row.objectName];
                              }
                              // Fallback: use existing objectsInViolation if present
                              else if (!enrichedRow.objectsInViolation) {
                                  enrichedRow.objectsInViolation = row.objectsInViolation || [];
                              }

                              return enrichedRow;
                          });
                      })()
                    : operation === ACTION_TYPE.SINGLE && singleRowData
                    ? configId === ASSESSMENT_CONFIG_IDS.RSS_CONFIGURATION && singleRowData.adapterName
                        ? { ...rowData, networkAdapters: [singleRowData.adapterName as string] }
                        : singleRowData.objectName
                        ? { ...rowData, objectsInViolation: [singleRowData.objectName] }
                        : rowData // Fallback: if no objectName/adapterName, pass rowData as-is
                    : rowData;

            const apiInput = buildOptimizeApiInput(apiConfig as OptimizeApiConfig, {
                configId: technicalId,
                engineType,
                credentialId: selectedGwInstanceCredId,
                regionId: selectedGwInstanceRegionId,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                rowData: effectiveRowData,
                operation,
                selectedRowFsxId,
                driftAssessmentData
            });

            // Set optimizing state
            dispatch(
                setOptimizingData({
                    ...optimizingData,
                    [technicalId]: WELL_ARCHITECTED_STATUS.OPTIMIZING
                })
            );

            // Update cardData to show "Optimizing" status immediately
            const currentCardData = store.getState().getWellOptimize.cardData;
            if (currentCardData && technicalId && currentCardData[technicalId]) {
                dispatch(
                    setCardData({
                        ...currentCardData,
                        [technicalId]: {
                            ...currentCardData[technicalId],
                            block_two: {
                                ...currentCardData[technicalId].block_two,
                                value: GETWELL_STATUS.OPTIMIZING
                            }
                        }
                    })
                );
            }

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
                buildOptimizeInfoNotification({
                    configName: (rowData?.name as string) || displayName,
                    t,
                    dispatch,
                    isWorkloadFactory
                })
            );

            // Call the API
            (apiCall(apiInput as Record<string, unknown>) as Promise<Record<string, unknown>>).then(
                (res: Record<string, unknown>) => {
                    const failedMsgData = buildOptimizeFailedMessage({
                        configName: (rowData?.name as string) || displayName,
                        t,
                        dispatch,
                        isWorkloadFactory
                    });

                    if (!res.error) {
                        const state = store.getState();
                        const data = res?.data as Record<string, unknown> | undefined;
                        dispatch(
                            setJobToInstanceMap({
                                ...state.getWellOptimize.jobToInstanceMap,
                                [data?.jobId as string]: {
                                    hostId: selectedResourceId,
                                    instanceId: selectedDatabaseInstance
                                }
                            })
                        );
                    }

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
                        true,
                        engineType
                    );

                    closeDialog();
                }
            );
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
            mutationMap,
            getJobDetailApi,
            closeDialog,
            selectedRowsForOptimizeInnerPage,
            selectedRowFsxId,
            driftAssessmentData
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

        // Extract objectName from each selected row
        const selectedObjectNames = selectedRowsForOptimizeInnerPage.map((row: any) => row.objectName).filter(Boolean);

        handleConfigDialog(
            setDialog,
            callOptimizeApi,
            closeDialog,
            {
                engineType,
                data: {
                    ...configData,
                    name: displayName, // Ensure name is always present
                    id: configId,
                    // Override objectsInViolation with only selected objects
                    objectsInViolation:
                        selectedObjectNames.length > 0 ? selectedObjectNames : configData?.objectsInViolation
                }
            },
            'bulk',
            null,
            isWad
        );
    }, [
        configId,
        configData,
        displayName,
        engineType,
        isWad,
        selectedRowsForOptimizeInnerPage,
        setDialog,
        closeDialog,
        callOptimizeApi
    ]);

    // Handle single row fix - opens dialog for individual row
    const handleRowFix = useCallback(
        (rowData: Record<string, unknown>) => {
            if (!configId) return;

            // Special handling for Oracle CRR - show explanation dialog first, then Associate Link dialog
            if (engineType === DBType.ORACLE && configId === ASSESSMENT_CONFIG_IDS.CRR) {
                // Pre-compute translated strings to avoid context issues
                const associateLinkText = t('databases.well-architect.associate-link');
                const stepText = t('databases.inventory.step-1-out-of');

                // Create a custom callback that will show the Associate Link dialog after prefetch
                const showAssociateLinkDialog = () => {
                    // Map row data to expected format for CRR flow
                    const crrRowData = {
                        ...rowData,
                        volumeName: rowData.ontapVolumeName || rowData.objectName,
                        volumeId: rowData.ontapVolumeUuid || rowData.fsxVolumeId || ''
                    };

                    // Create header with "Associate Link" and "Step 1 out of 2"
                    const associateLinkHeader = (
                        <div className={styles.dialogHeaderRow}>
                            <DsTypography variant="Regular_14">{associateLinkText}</DsTypography>
                            <DsTypography variant="Regular_14">{stepText}</DsTypography>
                        </div>
                    );

                    // Call prefetch which will set loading state
                    // The first dialog will stay open with loading button until prefetch completes
                    // When prefetch completes, it will call setDialog which replaces the first dialog with the second
                    runAssociateLinkPrefetch(crrRowData, associateLinkHeader, isWad);
                };

                // First dialog: Show CRR explanation dialog with Continue button enabled
                handleConfigDialog(
                    setDialog,
                    showAssociateLinkDialog, // This will be called on Continue
                    closeDialog,
                    {
                        engineType,
                        data: {
                            ...configData,
                            name: displayName,
                            id: configId
                        }
                    },
                    'single',
                    rowData,
                    isWad,
                    true // forceEnableInnerPage - enables Continue button for Oracle CRR
                );
                return;
            }

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
        [
            configId,
            configData,
            displayName,
            engineType,
            isWad,
            setDialog,
            closeDialog,
            callOptimizeApi,
            runAssociateLinkPrefetch,
            t
        ]
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
                        <TagComponent categories={configData?.categories || configData?.tags} />
                    </div>
                </div>

                {linkedConfigNames.length > 0 && (
                    <LinkedConfigBanner linkedConfigNames={linkedConfigNames} configName={configId} />
                )}

                {/* Clone management uses its own dedicated component */}
                {configId === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT && (
                    <CloneTabs fromPage="innerPage" engineType={engineType} />
                )}

                {/* Dynamic Table - Route to nested or flat table based on config */}
                {/* Render if: has columnConfig OR is a patch config */}
                {configId !== ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT && (columnConfig || isPatchConfig) && (
                    <div className={styles.tableSection}>
                        {columnConfig?.useNestedExpandable ? (
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
                                isViewOnly={isViewOnly}
                                handleBulkAction={handleBulkAction}
                                handleRowFix={handleRowFix}
                                crrPrefetchLoading={crrPrefetchLoading}
                                optimizingInstanceData={optimizingInstanceData}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DynamicOptimizeInnerPage;
