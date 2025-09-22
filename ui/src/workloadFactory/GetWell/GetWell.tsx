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

import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, WLF_TABS } from '../../utils/consts';
import RecommendationTable from './RecommendationTable/RecommendationTable';
import Tag from '../../common/Tag/Tag';
import RecommendationText from './RecommendationText/RecommendationText';
import {
    generateDate,
    applyFilter,
    resetGwValuesOnRefresh,
    generateDynamicFilterOptions,
    formatGetWellData
} from './GetWellUtils';
import { setDefaultFilterOptions, setOptimizeFilterTags } from '../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../store/storeHooks';
import GetWellApi from './GetWellApi';
import {
    setGwAdhocError,
    setGwRefreshPage,
    setIsInnerPageOptimize
} from '../../store/workloadFactory/getWellOptimizeSlice';
// @ts-ignore
// import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';
import DialogComponent from '../../common/Dialog/DialogComponent';
import LearnHowDialog from '../ExploreSavings/SavingsCalculator/SavingsSelection/LearnHowDialog/LearnHowDialog';
import downloadPdf from '../../common/pdfGenerator';
import { useLazyGetSubTaskListQuery, useTriggerInstanceAssessmentMutation } from '../../utils/apiService';
import AssessmentContainer from '../../common/AssessmentContainer/AssessmentContainer';
import PartialDataContainer from './PartialDataContainer/PartialDataContainer';
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
    areAllOntapSubConfigurationsActivating,
    areAllOsSubConfigurationsActivating,
    areAllHaSubConfigurationsActivating
} from './GetWellHelper';

const GetWell = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { optimizeFilterTags, defaultFilterOptions } = useAppSelector(state => state.inventoryV2);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const totalConfigCount = useAppSelector(state => state.getWellOptimize.optimizationBreakDown?.total?.total);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const {
        cardData,
        ontapConfigTableData,
        osConfigTableData,
        mssqlHighAvailabilityTableData,
        isAssessmentAvailable,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseStorageType,
        isInnerPageOptimize,
        gwTimestamp,
        gwAdhocError,
        optimizationBreakDown,
        driftAssessmentData
    } = useAppSelector(state => state.getWellOptimize);
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
    const [instanceDeploymentType, setInstanceDeploymentType] = useState<string>('');
    const [configCount, setConfigCount] = useState(0);
    const [showChartArea, setShowChartArea] = useState(true);
    const [triggerAssessmentInProgress, setTriggerAssessmentInProgress] = useState(false);
    const [showDismissedConfigurations, setShowDismissedConfigurations] = useState(false);
    const { setDialog, closeDialog } = useDialog();
    // @ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [triggerAssessmentApi] = useTriggerInstanceAssessmentMutation();
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
            setTriggerAssessmentInProgress,
            triggerAssessmentApi,
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            selectedResourceId,
            selectedDatabaseInstance,
            dispatch,
            isWorkloadFactory,
            getJobDetailApi,
            refreshGetWellPage,
            setGwAdhocError,
            t,
            createNotificationMessage
        });
    };

    const printDocument = () => {
        setOptimizePrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-optimize-pdf') as HTMLElement;
            const options = {
                filename: `Optimization_Report_MSSQLSERVER_${generateDate()}.pdf`,
                compression: 'MEDIUM'
            };

            // @ts-ignore
            downloadPdf(elem, options, (pdf: any) => {
                setOptimizePrintState(false);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: GENERAL.REPORT_DOWNLOAD_SUCCESS
                    })
                );
            });
        }, 100);
    };

    const toggleDismissedConfiguration = () => {
        setShowDismissedConfigurations(!showDismissedConfigurations);
    };

    // Helper function to check if there are any dismissed configurations
    const hasDismissedConfigurations = useMemo(() => {
        const result = checkHasDismissedConfigurations(cardData, driftAssessmentData);
        return result;
    }, [cardData, driftAssessmentData]);

    // Helper function to get total count based on dismissed configuration state
    const getTotalConfigCount = useMemo(
        () => calculateTotalConfigCount(cardData, showDismissedConfigurations, driftAssessmentData),
        [cardData, showDismissedConfigurations, driftAssessmentData]
    );

    // Helper function to calculate postpone information for configurations
    const getPostponeInfo = useMemo(() => (key: string) => calculatePostponeInfo(cardData, key), [cardData]);

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
    }, [
        cardData,
        optimizeFilterTags,
        ontapConfigTableData,
        osConfigTableData,
        selectedDatabaseStorageType,
        showDismissedConfigurations,
        driftAssessmentData
    ]);

    // Update table data when dismissed view state changes
    useEffect(() => {
        if (driftAssessmentData) {
            formatGetWellData(dispatch, driftAssessmentData, showDismissedConfigurations);
        }
    }, [showDismissedConfigurations, driftAssessmentData]);

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
            refreshGetWellPage();
            dispatch(setIsInnerPageOptimize(false));
        }
    }, [isInnerPageOptimize, dispatch, refreshGetWellPage]);

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

    const generateSubCategoryOptions = useMemo(() => {
        const selectedCategories = optimizeFilterTags
            .filter((tag: any) => tag && tag.type === 'all-catagories')
            .map((tag: any) => tag.value);

        // Use dynamic subcategories filtered by selected categories
        const filteredOptions = selectedCategories.length
            ? dynamicFilterOptions.subCategories.filter((option: any) => selectedCategories.includes(option.category))
            : dynamicFilterOptions.subCategories;

        const selectedSubCategories =
            defaultFilterOptions['sub-catagories']?.filter((id: any) =>
                filteredOptions.find((option: any) => option.id === id)
            ) || [];
        const selectedOptimizeTags = optimizeFilterTags.filter(
            (tag: any) => tag.type !== 'sub-catagories' || filteredOptions.find((option: any) => option.id === tag.id)
        );
        if (optimizeFilterTags.length !== selectedOptimizeTags.length) {
            dispatch(setOptimizeFilterTags(selectedOptimizeTags));
        }
        dispatch(setDefaultFilterOptions({ ...defaultFilterOptions, 'sub-catagories': selectedSubCategories }));
        return filteredOptions;
    }, [optimizeFilterTags, dynamicFilterOptions.subCategories]);

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

    const [expandedValue, setExpandedValue] = useState(undefined);
    const [clickedAccordionId, setClickedAccordionId] = useState<string | undefined>(undefined);

    const isAccordionExpanded = (id: string, optimizePrintState: any): boolean | undefined => {
        if (optimizePrintState) {
            return true;
        }

        return clickedAccordionId === expandedValue && expandedValue === id;
    };

    const handleAccordionExpanded = (id: any, isExpanded: boolean) => {
        isExpanded && clickedAccordionId === id && setExpandedValue(id);
    };

    // Helper function to render PostponeInfo/ActivatingInfo based on showDismissedConfigurations
    const renderPostponeActivatingInfo = (configKey: string) => (
        <>
            {showDismissedConfigurations && (
                <PostponeInfo configKey={configKey} getPostponeInfo={getPostponeInfo} translation={t} />
            )}

            {!showDismissedConfigurations && (
                <ActivatingInfo configKey={configKey} cardData={cardData} translation={t} />
            )}
        </>
    );

    // Helper function to render ActivatingInfo for sub-configurations when all are in ACTIVATING state
    const renderSubConfigActivatingInfo = (configType: 'ontap' | 'os' | 'ha') => {
        if (showDismissedConfigurations) return null;

        let areAllActivating = false;

        switch (configType) {
            case ASSESSMENT_CONFIG_NAMES.ONTAP:
                areAllActivating = areAllOntapSubConfigurationsActivating(driftAssessmentData);
                break;
            case ASSESSMENT_CONFIG_NAMES.OS:
                areAllActivating = areAllOsSubConfigurationsActivating(driftAssessmentData);
                break;
            case ASSESSMENT_CONFIG_NAMES.HA:
                areAllActivating = areAllHaSubConfigurationsActivating(driftAssessmentData);
                break;
        }

        if (!areAllActivating) return null;

        return (
            <ActivatingInfo
                configKey={configType}
                cardData={{ [configType]: { dismissedObj: { configState: CONFIG_STATES.ACTIVATING } } }}
                translation={t}
            />
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
                {/* {!optimizePrintState && (
                    <div className={commonStyles.commonBreadCrumb} style={{ left: '0%', paddingLeft: '40px' }}>
                        <BreadCrumbs
                            items={[
                                {
                                    title: breadCrumbSelectedFrom === WLF_TABS.INVENTORY ? 'Inventory' : 'Dashboard',
                                    onClick: () => {
                                        if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                        } else {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                        }
                                        dispatch(resetGwData({}));
                                    }
                                },
                                {
                                    title:
                                        `${selectedHostname}/${selectedDatabaseInstanceName}` ||
                                        'Host name/instance name'
                                }
                            ]}
                        />
                    </div>
                )} */}
                {/* <div className={styles.header}>
                    <div className={styles['header-top-section']}>
                        <DsTypography
                            data-testid={`wlm-db-optimize-instance`}
                            className={styles.optimizeHeader}
                            variant="Semibold_16"
                        >
                            Well-architected dashboard
                        </DsTypography>

                        {!optimizePrintState &&
                            (loading || triggerAssessmentInProgress ? (
                                <div
                                    className={styles.refreshIconDisable}
                                    style={{ marginRight: '0px' }}
                                    id={'assessment-refresh'}
                                >
                                    <RefreshIcon />
                                </div>
                            ) : (
                                <Popover
                                    popoverClass={styles['copy-popover']}
                                    children={`Last update: ${gwRefreshTimestamp || GENERAL.NOT_AVAILABLE}`}
                                    trigger="hover"
                                    container={
                                        <div
                                            className={styles.refreshIcon}
                                            onClick={refreshGetWellPage}
                                            id={'assessment-refresh'}
                                        >
                                            <RefreshIcon />
                                        </div>
                                    }
                                />
                            ))}
                    </div>
                    {!optimizePrintState && (
                        <DsTypography
                            data-testid={`wlm-db-${selectedDatabaseInstanceName.toLowerCase().replace(/ /g, '-')}`}
                            variant="Regular_14"
                        >
                            {selectedDatabaseInstanceName || 'instance name'}
                        </DsTypography>
                    )}
                    {optimizePrintState && (
                        <div className={styles.reportSubHeading}>
                            <DsTypography className={styles.title} variant="Semibold_16">
                                Host name {selectedHostname}
                            </DsTypography>
                            <div className={styles.separator} />
                            <DsTypography className={styles.title} variant="Semibold_16">
                                instance name {selectedDatabaseInstanceName}
                            </DsTypography>
                            <div className={styles.separator} />
                            <DsTypography className={styles.title} variant="Semibold_16">
                                Report date {generateDate()}
                            </DsTypography>
                        </div>
                    )}
                </div> */}

                {/* Partial data warning here - based on condition */}

                {cardData?.compute_rightsizing?.errorMessage?.includes('not authorized') && <PartialDataContainer />}

                {/* Assessment Section here */}
                <AssessmentContainer
                    onClick={triggerAssessmentHandler}
                    isLoading={triggerAssessmentInProgress}
                    gwTimestamp={gwTimestamp || ''}
                    gwAdhocError={gwAdhocError || ''}
                    optimizePageLoading={loading || false}
                />
                {showChartArea && (
                    <>
                        <div className={styles.getWellSecondLevel}>
                            <TotalOptimizationScore
                                loading={loading}
                                optimizationBreakDown={optimizationBreakDown}
                                isAssessmentAvailable={isAssessmentAvailable}
                            />
                            <OptimizationBreakdown />
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
                                                    Export PDF
                                                </DsTypography>
                                            </div>
                                            <div>
                                                {!hasDismissedConfigurations ? (
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
                                                            onClick={() => {}}
                                                            title="Dismissed configuration"
                                                            isDisabled
                                                        />
                                                    </DsPopover>
                                                ) : (
                                                    <DsToggleSwitch
                                                        id="dismissed-configuration-toggle"
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
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions['sub-catagories']
                                                                    ? defaultFilterOptions['sub-catagories']
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            formatLabel={() =>
                                                                `Sub categories: ${
                                                                    !defaultFilterOptions['sub-catagories']?.length ||
                                                                    defaultFilterOptions['sub-catagories'].length ===
                                                                        generateSubCategoryOptions.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions['sub-catagories']?.length > 0
                                                                        ? defaultFilterOptions['sub-catagories']?.length
                                                                        : generateSubCategoryOptions.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            isCleanable={false}
                                                            options={generateSubCategoryOptions}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'sub-catagories')
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
                                                        Sub categories:
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
                                                        {!defaultFilterOptions['sub-catagories']?.length ||
                                                        defaultFilterOptions['sub-catagories']?.length ===
                                                            generateSubCategoryOptions.length
                                                            ? `All(${generateSubCategoryOptions.length})`
                                                            : `${defaultFilterOptions['sub-catagories']?.length}/${generateSubCategoryOptions.length}`}
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

                            {/* Section one */}
                            {(filteredCardData?.storage_tier ||
                                filteredCardData?.file_system_headroom ||
                                filteredCardData?.transaction_log_drive_size ||
                                filteredCardData?.tempdb_drive_size) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {t('databases.well-architect.sections.storage-sizing')}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.storage_tier && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.storage_tier}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.STORAGE_TIER}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="1"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.storage_tier?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('1', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('1', isExpanded);
                                                        // accordion.onExpandChange && accordion.onExpandChange(isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('1')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.storage_tier?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('storage_tier')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.storage_tier?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.storage_tier?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.storage_tier?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.file_system_headroom && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.file_system_headroom}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="2"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.file_system_headroom?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('2', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('2', isExpanded);
                                                        // accordion.onExpandChange && accordion.onExpandChange(isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('2')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.file_system_headroom?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('file_system_headroom')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.file_system_headroom?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.file_system_headroom?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.file_system_headroom?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.transaction_log_drive_size && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.transaction_log_drive_size}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="3"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.transaction_log_drive_size?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('3', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('3', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('3')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.transaction_log_drive_size?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('transaction_log_drive_size')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.transaction_log_drive_size?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.transaction_log_drive_size?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.transaction_log_drive_size
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.tempdb_drive_size && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.tempdb_drive_size}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="4"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.tempdb_drive_size?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('4', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('4', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('4')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.tempdb_drive_size?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('tempdb_drive_size')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.tempdb_drive_size?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.tempdb_drive_size?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.tempdb_drive_size?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section two */}
                            {(filteredCardData?.user_data_files ||
                                filteredCardData?.transaction_log_files ||
                                filteredCardData?.tempdb_files) && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {t('databases.well-architect.sections.storage-layout')}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.user_data_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.user_data_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="5"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.user_data_files?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('5', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('5', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('5')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.user_data_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('user_data_files')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.user_data_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.user_data_files?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.user_data_files?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.transaction_log_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.transaction_log_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="6"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.transaction_log_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.transaction_log_files?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('6', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('6', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('6')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('transaction_log_files')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.transaction_log_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.transaction_log_files?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.transaction_log_files?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.tempdb_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.tempdb_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="7"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.tempdb_files?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('7', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('7', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('7')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.tempdb_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('tempdb_files')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.tempdb_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.tempdb_files?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.tempdb_files?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section three */}
                            {(filteredCardData?.ontap_configuration || filteredCardData?.os_configuration) && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {t('databases.well-architect.sections.storage-configuration')}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.ontap_configuration && (
                                            <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.ontap_configuration}
                                                    optimizePrintState={optimizePrintState}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                    isAllSubConfigActivating={areAllOntapSubConfigurationsActivating(
                                                        driftAssessmentData
                                                    )}
                                                />
                                                <DsAccordion
                                                    id="9"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.ontap_configuration?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('9', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('9', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('9')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.ontap_configuration?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('ontap_configuration')}

                                                            {/* Show full ActivatingInfo if all sub-configs are activating */}
                                                            {areAllOntapSubConfigurationsActivating(
                                                                driftAssessmentData
                                                            ) &&
                                                                !showDismissedConfigurations &&
                                                                renderSubConfigActivatingInfo('ontap')}

                                                            {/* Show normal view button if not all sub-configs are activating or in dismissed view */}
                                                            {(!areAllOntapSubConfigurationsActivating(
                                                                driftAssessmentData
                                                            ) ||
                                                                showDismissedConfigurations) && (
                                                                <>
                                                                    <div
                                                                        className={
                                                                            isDarkTheme && !loading
                                                                                ? styles['dark-theme-light']
                                                                                : ''
                                                                        }
                                                                    >
                                                                        {loading ||
                                                                        !cardData?.ontap_configuration?.block_two
                                                                            ?.value ? (
                                                                            <LightDisabled />
                                                                        ) : (
                                                                            <Light />
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            color:
                                                                                loading ||
                                                                                !cardData?.ontap_configuration
                                                                                    ?.block_two?.value
                                                                                    ? 'var(--text-disabled)'
                                                                                    : 'var(--text-button-primary)'
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            'databases.well-architect.actions.view-recommendations-optimizations'
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationTable
                                                            tableData={ontapConfigTableData}
                                                            isLoading={loading}
                                                            optimizePrintState={optimizePrintState}
                                                            from={WLF_TABS.INVENTORY}
                                                            showDismissedConfigurations={showDismissedConfigurations}
                                                            setShowDismissedConfigurations={
                                                                setShowDismissedConfigurations
                                                            }
                                                            driftAssessmentData={driftAssessmentData}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.os_configuration && (
                                            <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.os_configuration}
                                                    optimizePrintState={optimizePrintState}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                    isAllSubConfigActivating={areAllOsSubConfigurationsActivating(
                                                        driftAssessmentData
                                                    )}
                                                />
                                                <DsAccordion
                                                    id="10"
                                                    isDisabled={
                                                        loading || !cardData?.os_configuration?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('10', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('10', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('10')}
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.os_configuration?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('os_configuration')}

                                                            {/* Show full ActivatingInfo if all sub-configs are activating */}
                                                            {areAllOsSubConfigurationsActivating(driftAssessmentData) &&
                                                                !showDismissedConfigurations &&
                                                                renderSubConfigActivatingInfo('os')}

                                                            {/* Show normal view button if not all sub-configs are activating or in dismissed view */}
                                                            {(!areAllOsSubConfigurationsActivating(
                                                                driftAssessmentData
                                                            ) ||
                                                                showDismissedConfigurations) && (
                                                                <>
                                                                    <div
                                                                        className={
                                                                            isDarkTheme && !loading
                                                                                ? styles['dark-theme-light']
                                                                                : ''
                                                                        }
                                                                    >
                                                                        {loading ||
                                                                        !cardData?.os_configuration?.block_two
                                                                            ?.value ? (
                                                                            <LightDisabled />
                                                                        ) : (
                                                                            <Light />
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            color:
                                                                                loading ||
                                                                                !cardData?.os_configuration?.block_two
                                                                                    ?.value
                                                                                    ? 'var(--text-disabled)'
                                                                                    : 'var(--text-button-primary)'
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            'databases.well-architect.actions.view-recommendations-optimizations'
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationTable
                                                            tableData={osConfigTableData}
                                                            isLoading={loading}
                                                            optimizePrintState={optimizePrintState}
                                                            from={WLF_TABS.INVENTORY}
                                                            showDismissedConfigurations={showDismissedConfigurations}
                                                            setShowDismissedConfigurations={
                                                                setShowDismissedConfigurations
                                                            }
                                                            driftAssessmentData={driftAssessmentData}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section four */}
                            {(filteredCardData?.compute_rightsizing ||
                                filteredCardData?.host_os_patch ||
                                filteredCardData?.rss_config ||
                                filteredCardData?.mtu) && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {t('databases.well-architect.sections.compute')}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.compute_rightsizing && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.compute_rightsizing}
                                                    optimizePrintState={optimizePrintState}
                                                    type={t('databases.well-architect.actions.compute-rightsizing')}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="11"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.compute_rightsizing?.block_two?.value ||
                                                        filteredCardData?.compute_rightsizing?.isMissingPermissions
                                                    }
                                                    onClick={() => setClickedAccordionId('11')}
                                                    isExpanded={isAccordionExpanded('11', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('11', isExpanded);
                                                    }}
                                                    title={
                                                        filteredCardData?.compute_rightsizing?.isMissingPermissions ? (
                                                            <div className={styles.missingPermissionText}>
                                                                <Error />
                                                                <DsTypography
                                                                    variant="Semibold_14"
                                                                    style={{ marginLeft: '8px' }}
                                                                >
                                                                    Error:
                                                                </DsTypography>
                                                                &nbsp;
                                                                <DsTypography variant="Regular_14">
                                                                    {t(
                                                                        'databases.well-architect.actions.compute-rightsizing-unavailable'
                                                                    )}
                                                                    missing permissions.
                                                                </DsTypography>
                                                                &nbsp;
                                                                <DsButton
                                                                    type="text"
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        handleLearnHowClick();
                                                                    }}
                                                                >
                                                                    {t(
                                                                        'databases.well-architect.actions.learn-compute-rightsizing'
                                                                    )}
                                                                </DsButton>
                                                            </div>
                                                        ) : (
                                                            <div className={styles.tagPlacement}>
                                                                {filteredCardData?.compute_rightsizing?.tags?.map(
                                                                    (perTag: string, index: number) => (
                                                                        <div
                                                                            className={`${
                                                                                showDismissedConfigurations
                                                                                    ? styles.dismissed
                                                                                    : ''
                                                                            }`}
                                                                            key={index}
                                                                        >
                                                                            <Tag text={perTag} />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('compute_rightsizing')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.compute_rightsizing?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.compute_rightsizing?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.compute_rightsizing?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.host_os_patch && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.host_os_patch}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.OPERATING_SYSTEM_PATCH}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="12"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.host_os_patch?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.host_os_patch?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('12', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('12', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('12')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('host_os_patch')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.host_os_patch?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.host_os_patch?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.host_os_patch?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.rss_config && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.rss_config}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.RSS_CONFIGURATION}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="13"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.rss_config?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.rss_config?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('13', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('13', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('13')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('rss_config')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.rss_config?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.rss_config?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.rss_config?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                        {filteredCardData?.mtu && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.mtu}
                                                    optimizePrintState={optimizePrintState}
                                                    type={t('databases.general.mtu')}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="21"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.mtu?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.mtu?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('21', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('21', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('21')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('mtu')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.mtu?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.mtu?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.mtu?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section five */}
                            {(filteredCardData?.sql_licenses ||
                                filteredCardData?.microsoft_sql_patch ||
                                filteredCardData?.maxdop) && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.APPLICATION}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.sql_licenses && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.sql_licenses}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.LICENSE_SQL_SERVER}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="14"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.sql_licenses?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('14', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('14', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('14')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.sql_licenses?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('sql_licenses')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.sql_licenses?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.sql_licenses?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.sql_licenses?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.microsoft_sql_patch && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.microsoft_sql_patch}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.MICROSOFT_SQL_PATCH}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="15"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.microsoft_sql_patch?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('15', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('15', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('15')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.microsoft_sql_patch?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('microsoft_sql_patch')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.microsoft_sql_patch?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.microsoft_sql_patch?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.microsoft_sql_patch?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.maxdop && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.maxdop}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.MAXDOP_PATCH}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="16"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.maxdop?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('16', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('16', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('16')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.maxdop?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('maxdop')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.maxdop?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.maxdop?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.maxdop?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section six */}
                            {(filteredCardData?.scheduled_local_snapshot ||
                                filteredCardData?.crr ||
                                (instanceDeploymentType === GENERAL.FCI &&
                                    filteredCardData?.mssql_high_availability)) && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.RESILIENCY}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.scheduled_local_snapshot && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.scheduled_local_snapshot}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.SCHEDULED_LOCAL_SNAPSHOT}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="17"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.scheduled_local_snapshot?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('17', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('17', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('17')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.scheduled_local_snapshot?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('scheduled_local_snapshot')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.scheduled_local_snapshot?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.scheduled_local_snapshot?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.scheduled_local_snapshot
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                        {filteredCardData?.crr && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.crr}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.CRR}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="18"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        showDismissedConfigurations ||
                                                        !cardData?.crr?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('18', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('18', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('18')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.crr?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div
                                                                        className={`${
                                                                            showDismissedConfigurations
                                                                                ? styles.dismissed
                                                                                : ''
                                                                        }`}
                                                                        key={index}
                                                                    >
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('crr')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                showDismissedConfigurations ||
                                                                !cardData?.crr?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        showDismissedConfigurations ||
                                                                        !cardData?.crr?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.crr?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.scheduled_fsx_for_ontap_backups && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.scheduled_fsx_for_ontap_backups}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="19"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        !cardData?.scheduled_fsx_for_ontap_backups?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('19', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('19', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('19')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.scheduled_fsx_for_ontap_backups?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo(
                                                                'scheduled_FSx_for_ONTAP_backups'
                                                            )}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.scheduled_fsx_for_ontap_backups?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.scheduled_fsx_for_ontap_backups
                                                                            ?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.scheduled_fsx_for_ontap_backups
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {instanceDeploymentType === GENERAL.FCI &&
                                            filteredCardData?.mssql_high_availability && (
                                                <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                    <StorageCardComponent
                                                        cardData={filteredCardData?.mssql_high_availability}
                                                        optimizePrintState={optimizePrintState}
                                                        type={GENERAL.MSSQL_HIGH_AVAILABILITY}
                                                        showDismissedConfigurations={showDismissedConfigurations}
                                                        setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                        isAllSubConfigActivating={areAllHaSubConfigurationsActivating(
                                                            driftAssessmentData
                                                        )}
                                                    />
                                                    <DsAccordion
                                                        id="22"
                                                        variant="Default"
                                                        isDisabled={
                                                            loading ||
                                                            !cardData?.mssql_high_availability?.block_two?.value
                                                        }
                                                        isExpanded={isAccordionExpanded('22', optimizePrintState)}
                                                        onExpandChange={isExpanded => {
                                                            handleAccordionExpanded('22', isExpanded);
                                                        }}
                                                        onClick={() => setClickedAccordionId('22')}
                                                        title={
                                                            <div className={styles.tagPlacement}>
                                                                {filteredCardData?.mssql_high_availability?.tags?.map(
                                                                    (perTag: string, index: number) => (
                                                                        <div
                                                                            className={`${
                                                                                showDismissedConfigurations
                                                                                    ? styles.dismissed
                                                                                    : ''
                                                                            }`}
                                                                            key={index}
                                                                        >
                                                                            <Tag text={perTag} />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        }
                                                        headerActions={[
                                                            <div className={styles.headerAction}>
                                                                {renderPostponeActivatingInfo(
                                                                    'mssql_high_availability'
                                                                )}

                                                                {/* Show full ActivatingInfo if all sub-configs are activating */}
                                                                {areAllHaSubConfigurationsActivating(
                                                                    driftAssessmentData
                                                                ) &&
                                                                    !showDismissedConfigurations &&
                                                                    renderSubConfigActivatingInfo('ha')}

                                                                {/* Show normal view button if not all sub-configs are activating or in dismissed view */}
                                                                {(!areAllHaSubConfigurationsActivating(
                                                                    driftAssessmentData
                                                                ) ||
                                                                    showDismissedConfigurations) && (
                                                                    <>
                                                                        <div
                                                                            className={
                                                                                isDarkTheme && !loading
                                                                                    ? styles['dark-theme-light']
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {loading ||
                                                                            !cardData?.mssql_high_availability
                                                                                ?.block_two?.value ? (
                                                                                <LightDisabled />
                                                                            ) : (
                                                                                <Light />
                                                                            )}
                                                                        </div>
                                                                        <div
                                                                            style={{
                                                                                color:
                                                                                    loading ||
                                                                                    !cardData?.mssql_high_availability
                                                                                        ?.block_two?.value
                                                                                        ? 'var(--text-disabled)'
                                                                                        : 'var(--text-button-primary)'
                                                                            }}
                                                                        >
                                                                            {t(
                                                                                'databases.well-architect.actions.view-recommendations-optimizations'
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ]}
                                                        children={
                                                            <RecommendationTable
                                                                tableData={mssqlHighAvailabilityTableData}
                                                                isLoading={loading}
                                                                optimizePrintState={optimizePrintState}
                                                                from={WLF_TABS.INVENTORY}
                                                                showDismissedConfigurations={
                                                                    showDismissedConfigurations
                                                                }
                                                                setShowDismissedConfigurations={
                                                                    setShowDismissedConfigurations
                                                                }
                                                                driftAssessmentData={driftAssessmentData}
                                                            />
                                                        }
                                                    />
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                            {/* Section seven */}
                            {filteredCardData?.clone_management && (
                                <div className={styles.sectionClass} style={{ marginTop: '40px' }}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.CLONING}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.clone_management && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.clone_management}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.CLONE_MANAGEMENT}
                                                    showDismissedConfigurations={showDismissedConfigurations}
                                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                                />
                                                <DsAccordion
                                                    id="20"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.clone_management?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('20', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('20', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('20')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.clone_management?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            {renderPostponeActivatingInfo('clone_management')}

                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.clone_management?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.clone_management?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                {t(
                                                                    'databases.well-architect.actions.view-recommendation'
                                                                )}
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.clone_management?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GetWell;
