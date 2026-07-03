import { useDispatch } from 'react-redux';
import { DsTypography, useDialog, DsButton, Popover, TooltipInfo } from '@netapp/design-system';
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
    ASSESSMENT_CONFIG_IDS,
    CONFIG_STATE_ACTIONS,
    CONFIG_STATES,
    DBType,
    FROM_DIALOG,
    GETWELL_STATUS,
    INVENTORY_STATUS,
    WLF_TABS
} from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import {
    checkIfDisableForOptimize,
    formatGetWellDataFlat,
    handleOptimizeStorageJob,
    setOptimizeInnerpageSummary
} from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import { getRecommendation } from '../../../utils/recommendations';
import { ReactComponent as Schedule } from '../../../assets/Schedule.svg';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import {
    useLazyGetSubTaskListQuery,
    useDismissMssqlAssessmentMutation,
    useDismissOracleAssessmentMutation
} from '../../../utils/apiService';
import {
    useOptimizeMutations,
    buildOptimizeApiInput,
    buildOptimizeInfoNotification,
    buildOptimizeFailedMessage
} from '../../GetWell/optimizeApiUtils';
import {
    setCloneDashboardData,
    setGwPageLoadInstanceData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setIsInnerPageOptimize,
    setJobToInstanceMap,
    setJobToInstanceMapForBulk,
    setLandingFrom,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { findFlatConfigItem, hasConfigStats } from '../../WellArchitectedTab/assessmentFormatUtils';
import { getOptimizeApiConfig, hasFixSupport } from '../../../utils/configRegistry';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import {
    calculatePostponeInfo,
    callDashboardDismissApi,
    filterNotOptimizedRows,
    getAssessmentStatusConsistency
} from './DashboardInnerPageHelper';
import { checkLinkedConfigAcknowledge } from '../../GetWell/StorageCardComponent/optimizeUtils';
import DashboardConfigsTable from './RenderTables/DashboardConfigsTable';
import { formatOracleWellArchitectedData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { engineTypeBasedResourceStr } from '../../WellArchitectedTab/WellArchitectedTabUtils';

const DashboardInnerPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const {
        inProgressOptimizationData,
        inProgressHostData,
        cloneIsOptimizedRows,
        configEngineType,
        isInnerPageOptimize
    } = useAppSelector(state => state.getWellOptimize);
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

    // After a single-fix job completes, handleOptimizeStorageJob sets isInnerPageOptimize=true.
    // Clear the flag. The table and value-card counts update automatically because
    // updateFlatAssessmentStatus already patched the flat assessments[] array in inventoryV2
    // which DashboardConfigsTable reads via useMemo.
    useEffect(() => {
        if (isInnerPageOptimize) {
            dispatch(setIsInnerPageOptimize(false));
        }
    }, [isInnerPageOptimize, dispatch]);

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
    const mutationMap = useOptimizeMutations();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();
    const [dismissOracleAssessment] = useDismissOracleAssessmentMutation();

    // Builds the flat row list passed to handleOptimizeStorageJob for bulk operations.
    const getBulkInstanceList = (jobData: any[], configId: string) => {
        const instanceList: any = [];
        (jobData || []).forEach((hostOptimizeConfig: any) => {
            const databaseHosts = hostOptimizeConfig.databaseHosts || [];
            databaseHosts.forEach((host: any) => {
                const instances = host.sqlServerInstances || host.databases || [];
                instances.forEach((instanceId: string) => {
                    instanceList.push({
                        id: configId,
                        name: configDisplayName,
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

    const callOptimizeApi = (configId: string, fullRowData?: any, operation?: string) => {
        const rowData = Array.isArray(fullRowData) ? filterNotOptimizedRows(fullRowData) : fullRowData;
        const isBulk = operation === ACTION_TYPE.BULK;

        const state = store.getState();
        const {
            selectedDatabaseInstance,
            selectedResourceId,
            landingFrom,
            recommendedInstanceInBulk,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            selectedSnapshot,
            selectedAWSBackup,
            selectedRecommendedInstance
        } = state.getWellOptimize;

        const apiConfig = getOptimizeApiConfig(configId, configEngineType);
        if (!apiConfig) return;

        const apiCall = mutationMap[apiConfig.mutation];
        const credId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM;
        const regionId = landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM;

        const apiData = buildOptimizeApiInput(apiConfig, {
            configId,
            engineType: configEngineType,
            credentialId: credId,
            regionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            rowData,
            operation,
            selectedSnapshot,
            selectedAWSBackup,
            selectedRecommendedInstance,
            recommendedInstanceInBulk
        });
        if (!apiData) return;

        const { payload } = apiData;

        // ── Pre-call Redux state ──────────────────────────────────────────────
        dispatch(setOptimizingInstanceData(true));
        dispatch(setOptimizingData({ ...optimizingData, [configId]: 'optimizing' }));

        if (isBulk && payload?.hostsToOptimize) {
            const hostIds = payload.hostsToOptimize[0].databaseHosts.map((host: any) => host.id);
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [configId]: [...(inProgressHostData[configId] || []), ...hostIds]
                })
            );
            const hostInstances = payload.hostsToOptimize.flatMap((h: any) =>
                h.databaseHosts.flatMap((dh: any) => {
                    const instances = dh.sqlServerInstances || dh.databases;
                    return instances.map((inst: any) => `${dh.id}_${inst}`);
                })
            );
            dispatch(
                setInProgressOptimizationData({
                    ...inProgressOptimizationData,
                    [configId]: [...(inProgressOptimizationData[configId] || []), ...hostInstances]
                })
            );
        } else {
            dispatch(
                setInProgressHostData({
                    ...inProgressHostData,
                    [configId]: [...(inProgressHostData[configId] || []), selectedResourceId]
                })
            );
            dispatch(
                setInProgressOptimizationData({
                    ...inProgressOptimizationData,
                    [configId]: [
                        ...(inProgressOptimizationData[configId] || []),
                        `${selectedResourceId}_${selectedDatabaseInstance}`
                    ]
                })
            );
        }

        if (configEngineType === DBType.ORACLE) {
            formatOracleWellArchitectedData(dispatch, rowData?.assessments);
        } else {
            // All APIs return flat structure now
            formatGetWellDataFlat(dispatch, rowData?.assessments, false, false, false, t);
        }

        dispatch(buildOptimizeInfoNotification({ configName: configDisplayName, t, dispatch, isWorkloadFactory }));

        apiCall(apiData as Record<string, unknown>).then((res: any) => {
            const failedMsgData = buildOptimizeFailedMessage({
                configName: configDisplayName,
                t,
                dispatch,
                isWorkloadFactory,
                className: styles.notification
            });
            if (!res.error) {
                if (isBulk) {
                    dispatch(
                        setJobToInstanceMapForBulk({
                            ...state.getWellOptimize.jobToInstanceMap,
                            [res?.data?.jobId]: payload?.hostsToOptimize?.[0]
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
            if (isBulk) {
                handleOptimizeStorageJob(
                    res,
                    {},
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    configId,
                    operation,
                    getBulkInstanceList(payload?.hostsToOptimize, configId),
                    false,
                    configEngineType
                );
            } else {
                // Use IDs directly from the table row (sourced from allMssqlHostAssessmentData /
                // allOracleHostAssessmentData) so that updateFlatAssessmentStatus can locate
                // the correct host+instance entry.
                // selectedResourceId comes from inventoryTableData and may differ from
                // databaseHostId used as the primary key in the assessment store.
                handleOptimizeStorageJob(
                    res,
                    {
                        id: configId,
                        name: configDisplayName,
                        hostId: rowData?.databaseHostId ?? selectedResourceId,
                        instanceId: rowData?.instanceId ?? selectedDatabaseInstance,
                        credentialId: rowData?.credentialId ?? selectedGwInstanceCredId,
                        regionId: rowData?.regionId ?? selectedGwInstanceRegionId
                    },
                    failedMsgData,
                    getJobDetailApi,
                    dispatch,
                    configId,
                    operation,
                    null,
                    true,
                    configEngineType
                );
            }
        });
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

    const handleSingleDismissPostpone = (rowData: any, type: string, operation: string, rowEngineType?: string) => {
        const dismissApi = rowEngineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment;
        if (operation === CONFIG_STATE_ACTIONS.DISMISS) {
            setDialog(
                <DialogComponent
                    header={engineTypeBasedResourceStr(
                        rowEngineType,
                        t('databases.dismiss.dismiss-instance'),
                        t('databases.dismiss.dismiss-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {engineTypeBasedResourceStr(
                                    rowEngineType,
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
                        callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, rowEngineType);
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
                        rowEngineType,
                        t('databases.dismiss.postpone-days'),
                        t('databases.dismiss.postpone-days-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {engineTypeBasedResourceStr(
                                    rowEngineType,
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
                        callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, rowEngineType);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operation === CONFIG_STATE_ACTIONS.ACTIVE) {
            callDashboardDismissApi(type, [rowData], operation, dismissApi, dispatch, t, rowEngineType);
        }
    };

    const handleDialog = (configId: string, rowData: any, operation?: string) => {
        if (configId === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT) {
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
                        type: ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT,
                        objectsInViolation: cloneViolationsList,
                        severity: rowData?.severity,
                        tags: rowData?.tags,
                        recommendation: rowData?.recommendation // Flat API provides recommendation directly
                    })
                );
            } else {
                // get violations clone details for all selected instance. From dashboard bulk selection.
                // Filter only not optimized row for clone
                const filteredRowData = rowData.filter(
                    (row: any) => row?.assessmentStatus !== GETWELL_STATUS.OPTIMIZED
                );
                filteredRowData?.forEach((item: any) => {
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
                        type: ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT,
                        objectsInViolation: cloneViolationsList,
                        severity: rowData?.[0]?.severity,
                        tags: rowData?.[0]?.tags,
                        // @TODO: check this recommendation
                        recommendation: rowData?.[0]?.recommendation // Flat API provides recommendation directly
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
                    header={configDisplayName}
                    content={
                        <DialogContent
                            type={configId}
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
                        if (configEngineType === DBType.ORACLE && checkLinkedConfigAcknowledge()) {
                            return;
                        }
                        callOptimizeApi(configId, rowData, operation);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                    customClass={configId !== ASSESSMENT_CONFIG_IDS.MAXDOP ? 'innerPage' : ''}
                    primaryButtonDisabled={allRowsAreWad}
                    primaryButtonTooltip={allRowsAreWad ? t('databases.wad.tab-disabled-message') : ''}
                    hidePrimaryButton={
                        !hasFixSupport(configId, configEngineType, rowData?.status, rowData?.missingPermissions)
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
            const staticRec = getRecommendation(selectedConfig, configEngineType);
            const apiRecommendation = configItem?.recommendation;

            setValueCardData((prev: any) => ({
                ...selectedConfigSummary,
                configurationState: selectedConfigSummary.configState,
                cardHeight: prev.cardHeight || '136px',
                tagHeight: prev.tagHeight || '233px',
                data: staticRec
                    ? {
                          title: staticRec.title || 'Recommendations',
                          description: staticRec.description,
                          descriptionList: staticRec.descriptionList,
                          descriptionRssConfig: staticRec.descriptionRssConfig,
                          info: staticRec.info,
                          valuesHeading: staticRec.valuesHeading,
                          values: staticRec.values
                      }
                    : {
                          title: 'Recommendations',
                          description: apiRecommendation ?? ''
                      },
                cardName: selectedConfig
            }));
        }
    }, [selectedConfig, selectedConfigSummary, assessmentConfigData, configEngineType, configItem]);

    const lastColDetails = (
        name: string,
        data?: any,
        colInProgressOptimizationData?: any,
        colInProgressHostData?: any,
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
                    colInProgressHostData,
                    name,
                    rowData,
                    t,
                    selectedRowsForOptimize,
                    configEngineType
                ));
            }

            const isInProgress = colInProgressOptimizationData?.[name]?.includes(rowData?.id);

            let buttonContent;
            if (isInProgress) {
                buttonContent = (
                    <div className={styles['optimize-in-progress']}>
                        <DsFlashingDotsLoader />
                        <DsTypography variant="Regular_14">{t('databases.well-architect.fixing')}</DsTypography>
                    </div>
                );
            } else if (isDisabled && errorMessage) {
                buttonContent = (
                    <Popover
                        popoverClass={CommonStyles.popover}
                        isAppendedToBody
                        trigger="hover"
                        delayHide={200}
                        interactive
                        container={
                            <DsButton variant="secondary" isDisabled>
                                {t('databases.well-architect.fix')}
                            </DsButton>
                        }
                    >
                        <DsTypography variant="Regular_14">{errorMessage}</DsTypography>
                    </Popover>
                );
            } else {
                buttonContent = (
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
                );
            }

            return <div className={styles.buttonContainer}>{buttonContent}</div>;
        }
    });

    const handleBulkAction = (type: string, rowData: any) => {
        handleDialog(type, rowData, ACTION_TYPE.BULK);
    };

    // Function to handle dismiss bulk and postpone bulk action
    const handleBulkDismissPostpone = (type: string, rowData: any, operationType: string, bulkEngineType?: string) => {
        const dismissApi = bulkEngineType === DBType.ORACLE ? dismissOracleAssessment : dismissMssqlAssessment;
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
                        bulkEngineType,
                        t('databases.dismiss.dismiss-instance'),
                        t('databases.dismiss.dismiss-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {t('databases.dismiss.dialog-bulk-text-1')} {filteredRowData?.length}{' '}
                                {engineTypeBasedResourceStr(
                                    bulkEngineType,
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
                            bulkEngineType
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
                        bulkEngineType,
                        t('databases.dismiss.postpone-days'),
                        t('databases.dismiss.postpone-days-database')
                    )}
                    content={
                        <div className={styles.dismissDialog}>
                            <DsTypography variant="Regular_14">
                                {t('databases.dismiss.postpone-bulk-line-1')} {filteredRowData?.length}{' '}
                                {engineTypeBasedResourceStr(
                                    bulkEngineType,
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
                            bulkEngineType
                        );
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        }
        if (operationType === CONFIG_STATE_ACTIONS.ACTIVE) {
            callDashboardDismissApi(type, rowData, operationType, dismissApi, dispatch, t, bulkEngineType);
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
