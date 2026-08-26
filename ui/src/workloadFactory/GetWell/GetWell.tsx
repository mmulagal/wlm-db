import {
    DsAccordion,
    DsSelect,
    DsTypography,
    Spinner,
    DsButton,
    Button,
    useDialog,
    TooltipInfo
} from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DsPopover, DsToggleSwitch } from '@tlveng/wlm-ds';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';

import { ReactComponent as RowArrow } from '../../assets/row arrow-down.svg';
import { ReactComponent as Light } from '../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../assets/Light-Disabled.svg';
import { ReactComponent as Error } from '../../assets/error-icon.svg';
import { ReactComponent as Union } from '../../assets/Union.svg';
import { ReactComponent as Download } from '../../assets/download.svg';
import { ReactComponent as Close } from '../../assets/ic_close_blue.svg';
import { ReactComponent as Activating } from '../../assets/action-required.svg';

import {
    CONFIG_STATES,
    DBType,
    WELL_ARCHITECTED_CATEGORY_ORDER,
    WIZARD_TYPE,
    PATCH_SCAN_FIELD,
    ASSESSMENT_CONFIG_IDS
} from '../../utils/consts';
import Tag from '../../common/Tag/Tag';
import RecommendationText from './RecommendationText/RecommendationText';
import {
    applyFilter,
    resetGwValuesOnRefresh,
    generateDynamicFilterOptions,
    formatGetWellDataFlat,
    isAoagDeployment as checkIsAoagDeployment,
    groupConfigurationsByCategory,
    getCategoryTranslationKey
} from './GetWellUtils';
import { setDefaultFilterOptions, setOptimizeFilterTags } from '../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../store/storeHooks';
import GetWellApi from './GetWellApi';
import {
    setGwAdhocError,
    setGwRefreshPage,
    setIsInnerPageOptimize,
    setTriggerAssessmentInProgress
} from '../../store/workloadFactory/getWellOptimizeSlice';
// @ts-ignore
// import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';
import DialogComponent from '../../common/Dialog/DialogComponent';
import LearnHowDialog from '../ExploreSavings/SavingsCalculator/SavingsSelection/LearnHowDialog/LearnHowDialog';
import {
    useLazyGetSubTaskListQuery,
    useTriggerInstanceAssessmentMutation,
    useTriggerUnregisteredMssqlAssessmentMutation,
    getWellApi
} from '../../utils/apiService';
import AssessmentContainer from '../../common/AssessmentContainer/AssessmentContainer';
import PartialDataContainer from './PartialDataContainer/PartialDataContainer';
import { hasPartialRunPermission, resolveInstanceFsxLinkExists } from '../InventoryV2/InventoryUtilsV2';
import {
    handleSelectForFilter,
    removeEntry,
    removeObjectFromArray,
    handleTriggerAssessment,
    useWellArchitectRefresh
} from '../../utils/resourceUtils';
import {
    ActivatingInfo,
    PostponeInfo,
    checkHasDismissedConfigurations,
    calculateTotalConfigCount,
    calculatePostponeInfo,
    checkAllConfigurationsDismissed
} from './GetWellHelper';
import generateReport, { enrichAssessmentDataWithPatches } from '../../utils/generateWellArchitectedExcel';

const GetWell = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { optimizeFilterTags, defaultFilterOptions } = useAppSelector(state => state.inventoryV2);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const accountId = useAppSelector(state => state.auth.accountId);
    const totalConfigCount = useAppSelector(state => state.getWellOptimize.optimizationBreakDown?.total?.total);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const {
        cardData,
        isAssessmentAvailable,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedDatabaseInstanceName,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseStorageType,
        isInnerPageOptimize,
        gwTimestamp,
        gwAdhocError,
        optimizationBreakDown,
        driftAssessmentData,
        isWad: isWadFromStore,
        isUnregistered: isUnregisteredFromStore,
        hostManageReadiness,
        fsxLinkExists: fsxLinkExistsFromStore,
        triggerAssessmentInProgress
    } = useAppSelector(state => state.getWellOptimize);
    const { inventoryTableData } = useAppSelector(state => state.inventoryV2);
    const isUnregistered = isUnregisteredFromStore || !!cardData?.isUnregistered;
    const fsxLinkExists = useMemo(
        () =>
            resolveInstanceFsxLinkExists({
                fsxLinkExistsFromStore,
                inventoryTableData,
                resourceId: selectedResourceId,
                credId: selectedGwInstanceCredId,
                regionId: selectedGwInstanceRegionId,
                instanceId: selectedDatabaseInstance,
                instanceName: selectedDatabaseInstanceName
            }),
        [
            fsxLinkExistsFromStore,
            inventoryTableData,
            selectedResourceId,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            selectedDatabaseInstance,
            selectedDatabaseInstanceName
        ]
    );
    const showPartialPermissionBanner = isUnregistered && hasPartialRunPermission(hostManageReadiness);
    const showMissingLinkBanner = !isWadFromStore && !cardData?.isWad && !isUnregistered && fsxLinkExists === false;
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
    const [instanceDeploymentType, setInstanceDeploymentType] = useState<string>('');
    const [configCount, setConfigCount] = useState(0);
    const [showChartArea, setShowChartArea] = useState(true);
    const [showDismissedConfigurations, setShowDismissedConfigurations] = useState(false);
    const { setDialog, closeDialog } = useDialog();
    // @ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [triggerAssessmentApi] = useTriggerInstanceAssessmentMutation();
    const [triggerUnregisteredAssessmentApi] = useTriggerUnregisteredMssqlAssessmentMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    useEffect(() => {
        handleFilterClearAll();
        dispatch(setGwAdhocError(''));
        setShowDismissedConfigurations(false);
    }, []);

    useEffect(() => {
        if (!loading) {
            setShowChartArea(Boolean(gwTimestamp && gwTimestamp !== '0'));
        } else {
            setShowChartArea(true);
        }
    }, [loading]);

    // Clear filtered card data when loading starts to prevent showing stale data
    useEffect(() => {
        if (loading) {
            setFilteredCardData({});
        }
    }, [loading]);

    const handleSelect = (filters: any, filterLabel: any) => {
        handleSelectForFilter(
            filters,
            filterLabel,
            optimizeFilterTags,
            dispatch,
            setOptimizeFilterTags,
            setDefaultFilterOptions
        );
    };

    const handleCancelFilter = (option: any) => {
        const defaultFilterRemove = removeEntry(defaultFilterOptions, option);
        const updatedOptimizeFilter = removeObjectFromArray(optimizeFilterTags, option);
        dispatch(setOptimizeFilterTags(updatedOptimizeFilter));
        dispatch(setDefaultFilterOptions(defaultFilterRemove));
    };

    const createNotificationMessage = (handleJobMonitoringClick: () => void) => (
        <div>
            {t('databases.well-architect.assessment-track-in-progress')}{' '}
            <Button Component="button" variant="text" onClick={handleJobMonitoringClick}>
                {GENERAL.JOB_MONITORING}.
            </Button>
        </div>
    );

    const triggerAssessmentHandler = () => {
        handleTriggerAssessment({
            setTriggerAssessmentInProgress: (inProgress: boolean) =>
                dispatch(setTriggerAssessmentInProgress(inProgress)),
            triggerAssessmentApi,
            triggerUnregisteredAssessmentApi,
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            selectedResourceId,
            selectedDatabaseInstance,
            instanceName: selectedDatabaseInstanceName,
            accountId,
            isUnregistered,
            dispatch,
            isWorkloadFactory,
            getJobDetailApi,
            refreshGetWellPage,
            setGwAdhocError,
            t,
            createNotificationMessage
        });
    };

    const printDocument = async () => {
        try {
            const patchConfigs = [
                { id: ASSESSMENT_CONFIG_IDS.OPERATING_SYSTEM_PATCH, field: PATCH_SCAN_FIELD.HOST_OS_PATCH },
                { id: ASSESSMENT_CONFIG_IDS.MICROSOFT_SQL_SERVER_PATCH, field: PATCH_SCAN_FIELD.MSSQL_PATCH }
            ];

            const enrichedData = await enrichAssessmentDataWithPatches(
                driftAssessmentData,
                patchConfigs,
                WIZARD_TYPE.MSSQL,
                selectedGwInstanceCredId,
                selectedGwInstanceRegionId,
                selectedResourceId,
                selectedDatabaseInstance,
                dispatch,
                getWellApi
            );

            await generateReport(JSON.stringify(enrichedData), DBType.MSSQL, cardData?.isWad || false);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: GENERAL.REPORT_DOWNLOAD_SUCCESS
                })
            );
        } catch (error) {
            console.error('Error generating Excel report:', error);
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: `${GENERAL.REPORT_DOWNLOAD_FAIL}: ${String(error)}`
                })
            );
        }
    };

    const toggleDismissedConfiguration = () => {
        setShowDismissedConfigurations(!showDismissedConfigurations);
    };

    // Helper function to check if there are any dismissed configurations
    const hasDismissedConfigurations = useMemo(() => {
        const result = checkHasDismissedConfigurations(cardData);
        return result;
    }, [cardData]);

    // Helper function to get total count based on dismissed configuration state
    const getTotalConfigCount = useMemo(
        () => calculateTotalConfigCount(cardData, showDismissedConfigurations),
        [cardData, showDismissedConfigurations]
    );

    // Helper function to calculate postpone information for configurations
    const getPostponeInfo = useMemo(() => (key: string) => calculatePostponeInfo(cardData, key, cardData), [cardData]);

    // Helper function to check if all configurations are dismissed
    const allConfigurationsDismissed = useMemo(() => checkAllConfigurationsDismissed(cardData), [cardData]);

    // Automatically enable dismissed toggle when all configurations are dismissed
    useEffect(() => {
        if (allConfigurationsDismissed) {
            setShowDismissedConfigurations(true);
        }
    }, [allConfigurationsDismissed]);

    // To apply filters on change of filters or card data
    useEffect(() => {
        const { data, configCount } = applyFilter(
            cardData,
            optimizeFilterTags,
            selectedDatabaseStorageType,
            showDismissedConfigurations,
            driftAssessmentData
        );
        setFilteredCardData(data);
        setInstanceDeploymentType(cardData?.deploymentType || '');
        setConfigCount(configCount);
    }, [cardData, optimizeFilterTags, selectedDatabaseStorageType, showDismissedConfigurations, driftAssessmentData]);

    // Update table data when dismissed view state changes
    useEffect(() => {
        if (driftAssessmentData) {
            // Pass skipDriftDataDispatch=true to prevent infinite loop
            formatGetWellDataFlat(dispatch, driftAssessmentData as any, showDismissedConfigurations, false, true, t);
        }
    }, [showDismissedConfigurations, driftAssessmentData]);

    // Group configurations by category for dynamic rendering
    const groupedConfigurations = useMemo(() => groupConfigurationsByCategory(filteredCardData), [filteredCardData]);

    const handleFilterClearAll = useCallback(() => {
        dispatch(setOptimizeFilterTags([]));
        dispatch(setDefaultFilterOptions({}));
        setShowDismissedConfigurations(false);
    }, []);

    const refreshGetWellPage = useWellArchitectRefresh({
        dispatch,
        resetGwValuesOnRefresh,
        setGwRefreshPage,
        handleFilterClearAll
    });

    useEffect(() => {
        if (isInnerPageOptimize) {
            // Don't refresh immediately - just reset the flag
            // The actual refresh will happen when job completes via setGwRefreshPage
            dispatch(setIsInnerPageOptimize(false));
        }
    }, [isInnerPageOptimize]);

    // Generate dynamic filter options based on actual card data
    const dynamicFilterOptions = useMemo(() => {
        if (!filteredCardData || Object.keys(filteredCardData).length === 0) {
            return {
                categories: [],
                subCategories: [],
                severities: [],
                tags: [],
                resourceTypes: [],
                statuses: []
            };
        }
        return generateDynamicFilterOptions(filteredCardData, instanceDeploymentType);
    }, [filteredCardData, instanceDeploymentType]);

    // Check if deployment type is AOAG - used to hide configurations not supported for AOAG
    const isAoagDeployment = useMemo(() => checkIsAoagDeployment(instanceDeploymentType), [instanceDeploymentType]);

    GetWellApi();

    const handleLearnHowClick = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LEARN_HOW_DIALOG.ASSESSMENT_TITLE}
                content={<LearnHowDialog type="assessment" />}
                primaryButton={GENERAL.CLOSE}
                callback={() => closeDialog()}
            />
        );
    };

    const [expandedAccordionId, setExpandedAccordionId] = useState<string | undefined>(undefined);

    const isAccordionExpanded = (id: string, optimizePrintState: any): boolean | undefined => {
        if (optimizePrintState) {
            return true;
        }

        return expandedAccordionId === id;
    };

    const toggleAccordion = (id: string) => {
        setExpandedAccordionId(previousId => (previousId === id ? undefined : id));
    };

    // Helper function to render a configuration card dynamically
    const renderConfigurationCard = (configKey: string, config: any, index: number) => {
        const accordionId = `${configKey}-${index}`;

        return (
            <div key={configKey} className={styles.combineComponent}>
                <StorageCardComponent
                    cardData={config}
                    optimizePrintState={optimizePrintState}
                    type={config.mapName}
                    showDismissedConfigurations={showDismissedConfigurations}
                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                    showMissingLinkBanner={showMissingLinkBanner}
                />
                <DsAccordion
                    id={accordionId}
                    variant="Default"
                    isDisabled={loading || showDismissedConfigurations || showMissingLinkBanner}
                    isExpanded={isAccordionExpanded(accordionId, optimizePrintState)}
                    onClick={() => toggleAccordion(accordionId)}
                    title={
                        config?.isMissingPermissions && config?.errorMessage ? (
                            <div className={styles.missingPermissionText}>
                                <Error />
                                <DsTypography variant="Semibold_14" style={{ marginLeft: '8px' }}>
                                    Error:
                                </DsTypography>
                                &nbsp;
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.actions.compute-rightsizing-unavailable')} missing
                                    permissions.
                                </DsTypography>
                                &nbsp;
                                <DsButton
                                    type="text"
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleLearnHowClick();
                                    }}
                                >
                                    {t('databases.well-architect.actions.learn-compute-rightsizing')}
                                </DsButton>
                            </div>
                        ) : (
                            <div className={styles.tagPlacement}>
                                {config?.tags?.map((perTag: string, tagIndex: number) => (
                                    <div
                                        className={`${showDismissedConfigurations ? styles.dismissed : ''}`}
                                        key={tagIndex}
                                    >
                                        <Tag text={perTag} />
                                    </div>
                                ))}
                            </div>
                        )
                    }
                    headerActions={[
                        <div className={styles.headerAction}>
                            {renderPostponeActivatingInfo(configKey)}
                            {/* DsAccordion blocks header-action clicks from reaching the header, so toggle here */}
                            <div
                                className={`${styles.viewRecommendation} ${
                                    loading || showDismissedConfigurations || showMissingLinkBanner
                                        ? styles.viewRecommendationDisabled
                                        : ''
                                }`}
                                onClick={() => {
                                    if (!loading && !showDismissedConfigurations && !showMissingLinkBanner) {
                                        toggleAccordion(accordionId);
                                    }
                                }}
                            >
                                <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                    {loading || showDismissedConfigurations || showMissingLinkBanner ? (
                                        <LightDisabled />
                                    ) : (
                                        <Light />
                                    )}
                                </div>
                                <div
                                    style={{
                                        color:
                                            loading || showDismissedConfigurations || showMissingLinkBanner
                                                ? 'var(--text-disabled)'
                                                : 'var(--text-button-primary)'
                                    }}
                                >
                                    {t('databases.well-architect.actions.view-recommendation')}
                                </div>
                            </div>
                        </div>
                    ]}
                    children={<RecommendationText data={config?.recommendation} />}
                />
            </div>
        );
    };

    // Helper function to render PostponeInfo/ActivatingInfo based on showDismissedConfigurations
    const renderPostponeActivatingInfo = (configKey: string) => {
        // Check config state to show appropriate component
        const configState = cardData[configKey]?.dismissedObj?.configState;
        const isPostponed = configState === CONFIG_STATES.POSTPONED;

        return (
            <>
                {showDismissedConfigurations && isPostponed && (
                    <PostponeInfo configKey={configKey} getPostponeInfo={getPostponeInfo} translation={t} />
                )}

                {!showDismissedConfigurations && (
                    <ActivatingInfo configKey={configKey} cardData={cardData} translation={t} />
                )}
            </>
        );
    };

    return (
        <div style={{ height: 'inherit', overflow: 'auto', backgroundColor: 'var(--main-background)' }}>
            {optimizePrintState && (
                <>
                    <div className={commonStyles.loaderOverlay} />
                    <div className={commonStyles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div className={styles.getWell} id="export-optimize-pdf">
                {/* Partial data warning here - based on condition */}

                {showMissingLinkBanner && (
                    <PartialDataContainer variant="missingAssociatedLink" resourceType="instance" />
                )}

                {cardData?.compute_rightsizing?.isMissingPermissions && <PartialDataContainer />}

                {showPartialPermissionBanner && (
                    <PartialDataContainer variant="missingExtensiveRunPermission" resourceType="instance" />
                )}

                {/* Assessment Section here */}
                <AssessmentContainer
                    onClick={triggerAssessmentHandler}
                    isLoading={triggerAssessmentInProgress || false}
                    gwTimestamp={gwTimestamp || ''}
                    gwAdhocError={gwAdhocError || ''}
                    optimizePageLoading={loading || false}
                    isWad={isWadFromStore || cardData?.isWad || false}
                    isUnregistered={isUnregistered}
                    dbType={DBType.MSSQL}
                />
                {showChartArea && (
                    <>
                        <div className={styles.getWellSecondLevel}>
                            <TotalOptimizationScore
                                loading={loading}
                                optimizationBreakDown={optimizationBreakDown}
                                isAssessmentAvailable={isAssessmentAvailable}
                                allConfigurationsDismissed={allConfigurationsDismissed}
                                isWad={isWadFromStore || cardData?.isWad || false}
                            />
                            <OptimizationBreakdown allConfigurationsDismissed={allConfigurationsDismissed} />
                        </div>

                        <div className={styles.sectionTwo}>
                            <div className={styles.downloadSectionHeader}>
                                {!optimizePrintState && (
                                    <div
                                        className={
                                            loading || !isAssessmentAvailable
                                                ? styles.downloadSectionDisable
                                                : styles.downloadSection
                                        }
                                    >
                                        <div className={styles.configurationText}>
                                            <DsTypography variant="Semibold_16">
                                                {showDismissedConfigurations
                                                    ? t('databases.well-architect.dismiss.dismissed-configuration')
                                                    : t('databases.well-architect.dismiss.configuration')}
                                            </DsTypography>
                                        </div>
                                        <div className={styles.rightSection}>
                                            <div
                                                id="assessment-export-pdf"
                                                className={styles.buttonStyle}
                                                onClick={loading || !isAssessmentAvailable ? () => {} : printDocument}
                                            >
                                                <div>
                                                    <Download />
                                                </div>
                                                <DsTypography
                                                    style={{
                                                        color:
                                                            loading || !isAssessmentAvailable
                                                                ? 'var(--text-disabled)'
                                                                : 'var(--text-button-primary)'
                                                    }}
                                                    variant="Semibold_14"
                                                >
                                                    {t('databases.well-architect.export-report')}
                                                </DsTypography>
                                            </div>
                                            <div>
                                                {isWadFromStore ? (
                                                    <DsPopover
                                                        trigger="hover"
                                                        title={t('databases.wad.tab-disabled-message')}
                                                        monitorPosition="all"
                                                        placement="bottom"
                                                    >
                                                        <DsToggleSwitch
                                                            id="dismissed-configuration-toggle"
                                                            data-testid="dismissed-configuration-toggle"
                                                            onClick={() => {}}
                                                            title="Dismissed configuration"
                                                            isDisabled
                                                        />
                                                    </DsPopover>
                                                ) : !hasDismissedConfigurations ? (
                                                    <DsPopover
                                                        trigger="hover"
                                                        title={t(
                                                            'databases.well-architect.dismiss.no-dismissed-configurations'
                                                        )}
                                                        monitorPosition="all"
                                                        placement="bottom"
                                                    >
                                                        <DsToggleSwitch
                                                            id="dismissed-configuration-toggle"
                                                            data-testid="dismissed-configuration-toggle"
                                                            onClick={() => {}}
                                                            title="Dismissed configuration"
                                                            isDisabled
                                                        />
                                                    </DsPopover>
                                                ) : allConfigurationsDismissed ? (
                                                    <DsPopover
                                                        trigger="hover"
                                                        title={t(
                                                            'databases.well-architect.dismiss.all-configurations-dismissed-tooltip'
                                                        )}
                                                        monitorPosition="all"
                                                        placement="bottom"
                                                    >
                                                        <DsToggleSwitch
                                                            id="dismissed-configuration-toggle"
                                                            data-testid="dismissed-configuration-toggle"
                                                            onClick={() => {}}
                                                            title="Dismissed configuration"
                                                            isDisabled
                                                            value
                                                        />
                                                    </DsPopover>
                                                ) : (
                                                    <DsToggleSwitch
                                                        id="dismissed-configuration-toggle"
                                                        data-testid="dismissed-configuration-toggle"
                                                        onClick={
                                                            loading || !isAssessmentAvailable
                                                                ? () => {}
                                                                : toggleDismissedConfiguration
                                                        }
                                                        title="Dismissed configuration"
                                                        value={showDismissedConfigurations}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className={styles.filterComponent}>
                                    <DsAccordion
                                        id="100"
                                        variant="Default"
                                        isDisabled={loading || !isAssessmentAvailable}
                                        onExpandChange={setsAccordionOpen}
                                        expandCollapseIcon={{
                                            className: styles['expand-collapse-icon'],
                                            collapsedIcon: <RowArrow />,
                                            expandedIcon: (
                                                <div style={{ transform: 'rotate(180deg)' }}>
                                                    <RowArrow />
                                                </div>
                                            )
                                        }}
                                        title={
                                            <div className={styles.filterHeaderStyle}>
                                                <div className={isDarkTheme ? styles['dark-theme-union'] : ''}>
                                                    <Union />
                                                </div>
                                                <DsTypography
                                                    style={{
                                                        color:
                                                            loading || !isAssessmentAvailable
                                                                ? 'var(--text-disabled)'
                                                                : 'var(--text-primary)'
                                                    }}
                                                    variant="Semibold_14"
                                                >
                                                    Configurations:{' '}
                                                    {loading
                                                        ? GENERAL.NOT_AVAILABLE
                                                        : `${
                                                              getTotalConfigCount === configCount
                                                                  ? `All(${getTotalConfigCount})`
                                                                  : `${configCount}/${getTotalConfigCount}`
                                                          }`}
                                                </DsTypography>
                                            </div>
                                        }
                                        children={
                                            <div
                                                className={styles.mainSection}
                                                style={{ gap: optimizeFilterTags.length > 0 ? '42px' : '0px' }}
                                            >
                                                <div className={styles.dropdownList}>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions['all-catagories']
                                                                    ? defaultFilterOptions['all-catagories']
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Categories: ${
                                                                    !defaultFilterOptions['all-catagories']?.length ||
                                                                    defaultFilterOptions['all-catagories'].length ===
                                                                        dynamicFilterOptions.categories.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions['all-catagories']?.length > 0
                                                                        ? defaultFilterOptions['all-catagories']?.length
                                                                        : dynamicFilterOptions.categories.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={dynamicFilterOptions.categories}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'all-catagories')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div
                                                        className={`${styles.dropDown} ${styles['optimized-drop-down']}`}
                                                    >
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.status
                                                                    ? defaultFilterOptions.status
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Status: ${
                                                                    !defaultFilterOptions.status?.length ||
                                                                    defaultFilterOptions.status.length ===
                                                                        dynamicFilterOptions.statuses.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.status?.length > 0
                                                                        ? defaultFilterOptions.status?.length
                                                                        : dynamicFilterOptions.statuses.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={dynamicFilterOptions.statuses}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'status')}
                                                            variant="underline"
                                                            formatOptionLabel={(option: any) => {
                                                                if (option?.label === 'Optimized') {
                                                                    return <div>{option?.label}</div>;
                                                                }
                                                                return (
                                                                    <div className={styles['not-optimized-tooltip']}>
                                                                        <div>{option?.label}</div>
                                                                        <TooltipInfo trigger="hover" isAppendedToBody>
                                                                            {' '}
                                                                            Not optimized includes over-provisioned and
                                                                            under-provisioned instances.
                                                                        </TooltipInfo>
                                                                    </div>
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.severity
                                                                    ? defaultFilterOptions.severity
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Severity: ${
                                                                    !defaultFilterOptions.severity?.length ||
                                                                    defaultFilterOptions.severity.length ===
                                                                        dynamicFilterOptions.severities.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.severity?.length > 0
                                                                        ? defaultFilterOptions.severity?.length
                                                                        : dynamicFilterOptions.severities.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={dynamicFilterOptions.severities}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'severity')}
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.tags
                                                                    ? defaultFilterOptions.tags
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Tags: ${
                                                                    !defaultFilterOptions.tags?.length ||
                                                                    defaultFilterOptions.tags.length ===
                                                                        dynamicFilterOptions.tags.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.tags?.length > 0
                                                                        ? defaultFilterOptions.tags?.length
                                                                        : dynamicFilterOptions.tags.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={dynamicFilterOptions.tags}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'tags')}
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.resourceType
                                                                    ? defaultFilterOptions.resourceType
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Resource type: ${
                                                                    !defaultFilterOptions.resourceType?.length ||
                                                                    defaultFilterOptions.resourceType.length ===
                                                                        dynamicFilterOptions.resourceTypes.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.resourceType?.length > 0
                                                                        ? defaultFilterOptions.resourceType?.length
                                                                        : dynamicFilterOptions.resourceTypes.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={dynamicFilterOptions.resourceTypes}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'resourceType')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                </div>

                                                <div className={styles.filtersOption}>
                                                    <div className={styles.tagsContainer}>
                                                        {optimizeFilterTags.map((item: any, index: number) => (
                                                            <div className={styles.filterTag} key={index}>
                                                                <DsTypography
                                                                    style={{ color: 'var(--header-notification-text)' }}
                                                                    variant="Semibold_13"
                                                                >
                                                                    {item.label}
                                                                </DsTypography>
                                                                <div
                                                                    onClick={() => handleCancelFilter(item)}
                                                                    className={styles.closeButton}
                                                                >
                                                                    <Close />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {optimizeFilterTags.length ? (
                                                        <div className={styles.clearAll}>
                                                            <DsButton type="text" onClick={handleFilterClearAll}>
                                                                {GENERAL.CLEAR_ALL}
                                                            </DsButton>
                                                        </div>
                                                    ) : (
                                                        ''
                                                    )}
                                                </div>
                                            </div>
                                        }
                                        value={
                                            <div className={styles.filterHeader}>
                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Categories:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions['all-catagories']?.length ||
                                                        defaultFilterOptions['all-catagories']?.length ===
                                                            dynamicFilterOptions.categories.length
                                                            ? `All(${dynamicFilterOptions.categories.length})`
                                                            : `${defaultFilterOptions['all-catagories']?.length}/${dynamicFilterOptions.categories.length}`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Status:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.status?.length ||
                                                        defaultFilterOptions.status?.length ===
                                                            dynamicFilterOptions.statuses.length
                                                            ? `All(${dynamicFilterOptions.statuses.length})`
                                                            : `${defaultFilterOptions.status?.length}/${dynamicFilterOptions.statuses.length}`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Severity:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.severity?.length ||
                                                        defaultFilterOptions.severity?.length ===
                                                            dynamicFilterOptions.severities.length
                                                            ? `All(${dynamicFilterOptions.severities.length})`
                                                            : `${defaultFilterOptions.severity?.length}/${dynamicFilterOptions.severities.length}`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Tags:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.tags?.length ||
                                                        defaultFilterOptions.tags?.length ===
                                                            dynamicFilterOptions.tags.length
                                                            ? `All(${dynamicFilterOptions.tags.length})`
                                                            : `${defaultFilterOptions.tags?.length}/${dynamicFilterOptions.tags.length}`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Resource type:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.resourceType?.length ||
                                                        defaultFilterOptions.resourceType?.length ===
                                                            dynamicFilterOptions.resourceTypes.length
                                                            ? `All(${dynamicFilterOptions.resourceTypes.length})`
                                                            : `${defaultFilterOptions.resourceType?.length}/${dynamicFilterOptions.resourceTypes.length}`}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                            </div>

                            {/* Adding dummy div to have consistent spacing after filters */}
                            <div style={{ marginTop: '40px' }} />

                            {/* Loading state for configuration cards */}
                            {loading && Object.keys(filteredCardData).length === 0 && (
                                <div className={styles.sectionClass}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            padding: '60px 0',
                                            minHeight: '200px'
                                        }}
                                    >
                                        <Spinner isLarge />
                                    </div>
                                </div>
                            )}

                            {/* Dynamic configuration sections - Renders ALL configurations from API grouped by category */}
                            {!loading && Object.keys(filteredCardData).length > 0 && (
                                <>
                                    {WELL_ARCHITECTED_CATEGORY_ORDER.map(category => {
                                        const configs = groupedConfigurations[category] || [];

                                        if (configs.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <div
                                                key={category}
                                                className={styles.sectionClass}
                                                style={{ marginTop: category !== 'storage' ? '40px' : '0' }}
                                            >
                                                <div className={styles['header-buttons']}>
                                                    <DsTypography
                                                        style={{
                                                            padding: '0 0 8px'
                                                        }}
                                                        variant="Semibold_16"
                                                    >
                                                        {t(getCategoryTranslationKey(category))}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.accordionGroups}>
                                                    {configs.map(({ key, config }, index) =>
                                                        renderConfigurationCard(key, config, index)
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GetWell;
