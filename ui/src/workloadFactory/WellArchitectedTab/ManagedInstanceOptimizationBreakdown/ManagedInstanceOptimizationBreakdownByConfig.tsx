import { DsButton, DsTypography, FlashingDotsLoader, RadioButton } from '@netapp/design-system';
import { ReactComponent as NoDataIcon } from '@netapp/icons/ic_file.svg';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsCheckbox } from '@tlveng/wlm-ds';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    categoryOptions,
    oracleCategoryOptions,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    DBType,
    severityOptions,
    oracleSeverityOptions,
    ASSESSMENT_CONFIG_CATALOG_KEYS,
    WELL_ARCHITECTED_CATEGORY_LABELS,
    WellArchitectedCategory,
    WLF_TABS
} from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import { ReactComponent as Filter } from '../../../assets/filter-icon.svg';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { mapAssessmentSeverityToFilterLabel, getConfigStateList, getConfigStatsBucket } from '../assessmentFormatUtils';
import { setLandingFrom, setSelectedConfigEngineType } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import BarComponent from '../../Dashboard/BarComponent/BarComponent';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentData,
        allmssqlHostAssessmentLoading,
        allOracleHostAssessmentLoading,
        allOracleHostAssessmentData
    } = useAppSelector(state => state.inventoryV2);
    const { inProgressOptimizationData, configEngineType } = useAppSelector(state => state.getWellOptimize);
    const dispatch = useDispatch();
    const windowSize = useResize();
    const mainSectionRef = useRef<HTMLDivElement>(null);
    const [hasScrollbar, setHasScrollbar] = useState(false);

    // For popup
    const [isOpen, setIsOpen] = useState(false);
    // Maintain separate category selections/applied filters for MSSQL and Oracle
    const [selectedCategoriesMssql, setSelectedCategoriesMssql] = useState<string[]>(categoryOptions);
    const [appliedCategoriesMssql, setAppliedCategoriesMssql] = useState<string[]>(categoryOptions);
    const ORACLE_DEFAULT_SELECTED = ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning'];
    const [selectedCategoriesOracle, setSelectedCategoriesOracle] = useState<string[]>(ORACLE_DEFAULT_SELECTED);
    const [appliedCategoriesOracle, setAppliedCategoriesOracle] = useState<string[]>(ORACLE_DEFAULT_SELECTED);
    // Separate severity selections per engine so severity filtering affects only that engine
    const [selectedSeverityMssql, setSelectedSeverityMssql] = useState<string[]>(severityOptions);
    const [appliedSeverityMssql, setAppliedSeverityMssql] = useState<string[]>(severityOptions);
    const [selectedSeverityOracle, setSelectedSeverityOracle] = useState<string[]>(oracleSeverityOptions);
    const [appliedSeverityOracle, setAppliedSeverityOracle] = useState<string[]>(oracleSeverityOptions);
    const popupRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading]
    );

    const configData = useMemo(
        () => getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [allmssqlHostAssessmentData, allOracleHostAssessmentData]
    );

    const currentConfigIds = useMemo(
        () => (configEngineType === DBType.ORACLE ? configData.oracleConfigIds || [] : configData.mssqlConfigIds || []),
        [configData, configEngineType]
    );

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(e.target as Node) &&
                !buttonRef.current?.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCategory = (item: string) => {
        if (configEngineType === DBType.ORACLE) {
            setSelectedCategoriesOracle(prev => (prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]));
        } else {
            setSelectedCategoriesMssql(prev => (prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]));
        }
    };

    const toggleSeverity = (item: string) => {
        if (configEngineType === DBType.ORACLE) {
            setSelectedSeverityOracle(prev => (prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]));
        } else {
            setSelectedSeverityMssql(prev => (prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]));
        }
    };

    const handleApply = () => {
        // Apply the selected filters for the current engine
        if (configEngineType === DBType.ORACLE) {
            setAppliedCategoriesOracle(selectedCategoriesOracle);
            setAppliedSeverityOracle(selectedSeverityOracle);
        } else {
            setAppliedCategoriesMssql(selectedCategoriesMssql);
            setAppliedSeverityMssql(selectedSeverityMssql);
        }
        setIsOpen(false);
    };

    const handleReset = () => {
        // Reset filters only for the current engine
        if (configEngineType === DBType.ORACLE) {
            setSelectedCategoriesOracle(ORACLE_DEFAULT_SELECTED);
            setAppliedCategoriesOracle(ORACLE_DEFAULT_SELECTED);
            setSelectedSeverityOracle(oracleSeverityOptions);
            setAppliedSeverityOracle(oracleSeverityOptions);
        } else {
            setSelectedCategoriesMssql(categoryOptions);
            setAppliedCategoriesMssql(categoryOptions);
            setSelectedSeverityMssql(severityOptions);
            setAppliedSeverityMssql(severityOptions);
        }
    };

    // Determine current engine's category options and applied/selected values
    const currentCategoryOptions = configEngineType === DBType.ORACLE ? oracleCategoryOptions : categoryOptions;
    const currentAppliedCategories =
        configEngineType === DBType.ORACLE ? appliedCategoriesOracle : appliedCategoriesMssql;
    const currentSelectedCategories =
        configEngineType === DBType.ORACLE ? selectedCategoriesOracle : selectedCategoriesMssql;

    const currentAppliedSeverity = configEngineType === DBType.ORACLE ? appliedSeverityOracle : appliedSeverityMssql;

    const currentDefaultCategories = configEngineType === DBType.ORACLE ? ORACLE_DEFAULT_SELECTED : categoryOptions;
    const currentDefaultSeverity = configEngineType === DBType.ORACLE ? oracleSeverityOptions : severityOptions;

    const isResetDisabled =
        currentAppliedCategories.length === currentDefaultCategories.length &&
        currentAppliedCategories.every(category => currentDefaultCategories.includes(category)) &&
        currentAppliedSeverity.length === currentDefaultSeverity.length &&
        currentAppliedSeverity.every(s => currentDefaultSeverity.includes(s));

    // Function to check if a tile should be visible based on applied filters
    const shouldShowTile = (configId: string): boolean => {
        const catalogEntry = configData?.[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]?.[configId];
        if (!catalogEntry) {
            return false;
        }

        const tileCategory = WELL_ARCHITECTED_CATEGORY_LABELS[catalogEntry.type as WellArchitectedCategory];
        const tileSeverity = mapAssessmentSeverityToFilterLabel(catalogEntry.severity);
        const appliedCats = configEngineType === DBType.ORACLE ? appliedCategoriesOracle : appliedCategoriesMssql;
        const appliedSev = configEngineType === DBType.ORACLE ? appliedSeverityOracle : appliedSeverityMssql;

        if (appliedCats.length === 0 && appliedSev.length === 0) {
            return false;
        }

        const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;
        const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;

        return categoryMatch && severityMatch;
    };

    const filteredConfigurations = currentConfigIds.filter((configId: string) => shouldShowTile(configId)).length;

    const mssqlTotalConfigurations = useMemo(() => configData.mssqlConfigIds?.length || 0, [configData]);
    const mssqlFilteredConfigurations = useMemo(
        () =>
            (configData.mssqlConfigIds || []).filter((configId: string) => {
                const catalogEntry = configData?.[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]?.[configId];
                if (!catalogEntry) return false;
                const tileCategory = WELL_ARCHITECTED_CATEGORY_LABELS[catalogEntry.type as WellArchitectedCategory];
                const tileSeverity = mapAssessmentSeverityToFilterLabel(catalogEntry.severity);
                const appliedCats = appliedCategoriesMssql;
                const appliedSev = appliedSeverityMssql;
                if (appliedCats.length === 0 && appliedSev.length === 0) return false;
                const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;
                const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;
                return categoryMatch && severityMatch;
            }).length,
        [configData, appliedCategoriesMssql, appliedSeverityMssql]
    );

    const oracleTotalConfigurations = useMemo(() => configData.oracleConfigIds?.length || 0, [configData]);

    // Shared "no configurations" flags per engine, reused by radio-disable, selected-engine check, and auto-switch effect below.
    const mssqlHasNoConfigurations = mssqlTotalConfigurations === 0;
    const oracleHasNoConfigurations = oracleTotalConfigurations === 0;

    const selectedEngineHasNoConfigurations =
        !loading && (configEngineType === DBType.ORACLE ? oracleHasNoConfigurations : mssqlHasNoConfigurations);

    const oracleFilteredConfigurations = useMemo(
        () =>
            (configData.oracleConfigIds || []).filter((configId: string) => {
                const catalogEntry = configData?.[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]?.[configId];
                if (!catalogEntry) return false;
                const tileCategory = WELL_ARCHITECTED_CATEGORY_LABELS[catalogEntry.type as WellArchitectedCategory];
                const tileSeverity = mapAssessmentSeverityToFilterLabel(catalogEntry.severity);
                const appliedCats = appliedCategoriesOracle;
                const appliedSev = appliedSeverityOracle;
                if (appliedCats.length === 0 && appliedSev.length === 0) return false;
                const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;
                const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;
                return categoryMatch && severityMatch;
            }).length,
        [configData, appliedCategoriesOracle, appliedSeverityOracle]
    );

    // Check if no filters are applied (all categories and severities selected) per engine
    const noFiltersAppliedMssql =
        appliedCategoriesMssql.length === categoryOptions.length &&
        appliedSeverityMssql.length === severityOptions.length;

    const noFiltersAppliedOracle =
        appliedCategoriesOracle.length === ORACLE_DEFAULT_SELECTED.length &&
        appliedCategoriesOracle.every(category => ORACLE_DEFAULT_SELECTED.includes(category)) &&
        appliedSeverityOracle.length === oracleSeverityOptions.length;

    // Check if scrollbar is needed
    useEffect(() => {
        const checkScrollbar = () => {
            if (mainSectionRef.current) {
                const { scrollHeight, clientHeight } = mainSectionRef.current;
                setHasScrollbar(scrollHeight > clientHeight);
            }
        };

        checkScrollbar();
        // Recheck when content changes
        const timer = setTimeout(checkScrollbar, 100);
        return () => clearTimeout(timer);
    }, [
        filteredConfigurations,
        configEngineType,
        appliedCategoriesMssql,
        appliedCategoriesOracle,
        appliedSeverityMssql,
        appliedSeverityOracle
    ]); // Ends here

    const { showNA } = useAppSelector(state => state.headers);

    const handleOptimize = (type: string, dbType?: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setSelectedConfig(type));
        setOptimizeInnerpageSummary(type, configData, dispatch, dbType);
    };

    const hasDismissedOrPosponed = (state: any) => {
        if (state.includes(CONFIG_STATES.ACTIVE)) {
            return '';
        }
        if (state.includes(CONFIG_STATES.POSTPONED)) {
            return CONFIG_STATES_UI.POSTPONED;
        }
        if (state.includes(CONFIG_STATES.DISMISSED)) {
            return CONFIG_STATES_UI.DISMISSED;
        }
        return '';
    };

    const hasMixedState = (state: any) => {
        if (
            state.includes(CONFIG_STATES.ACTIVE) &&
            (state.includes(CONFIG_STATES.POSTPONED) || state.includes(CONFIG_STATES.DISMISSED))
        ) {
            return t('databases.well-architect.mixed-state-config-tooltip');
        }
        return '';
    };

    // naCheck = globally no data (both engines empty). The showNA branch intentionally ignores
    // `loading`: it reflects "no credentials/regions selected" (headers state), a case where no
    // fetch is in flight, so waiting on `loading` would never resolve.
    const naCheck = useMemo(() => {
        if (showNA && configData?.oracleTotal + configData?.total === 0) {
            return true;
        }
        if (!loading && configData?.oracleTotal + configData?.total === 0) {
            return true;
        }
        return false;
    }, [configData, showNA, loading]);

    // Radio isDisabled blocks manually selecting an empty engine; the effect below additionally
    // steers away from an engine that becomes empty while it's already selected (e.g. after a
    // data refresh). Both are needed since disabling a radio doesn't change the current selection.
    const isMssqlRadioDisabled = loading || mssqlHasNoConfigurations;
    const isOracleRadioDisabled = loading || oracleHasNoConfigurations;

    useEffect(() => {
        if (loading) {
            return;
        }

        if (mssqlHasNoConfigurations && oracleHasNoConfigurations) {
            if (configEngineType !== DBType.MSSQL) {
                dispatch(setSelectedConfigEngineType(DBType.MSSQL));
            }
            return;
        }

        if (configEngineType === DBType.MSSQL && mssqlHasNoConfigurations && !oracleHasNoConfigurations) {
            dispatch(setSelectedConfigEngineType(DBType.ORACLE));
        } else if (configEngineType === DBType.ORACLE && oracleHasNoConfigurations && !mssqlHasNoConfigurations) {
            dispatch(setSelectedConfigEngineType(DBType.MSSQL));
        }
    }, [loading, mssqlHasNoConfigurations, oracleHasNoConfigurations, configEngineType, dispatch]);

    // showNoDataSection covers both the global case (naCheck) and the case where only the
    // currently selected engine has no configurations (selectedEngineHasNoConfigurations);
    // it drives the main content area plus the filter/reset controls below.
    const showNoDataSection = naCheck || selectedEngineHasNoConfigurations;

    const renderConfigOptimizationBar = (configId: string, dbType: string = DBType.MSSQL) => {
        const catalogEntry =
            configData?.[
                dbType === DBType.ORACLE ? ASSESSMENT_CONFIG_CATALOG_KEYS.ORACLE : ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL
            ]?.[configId] || configData?.[ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]?.[configId];
        const configStats = getConfigStatsBucket(configData, configId, dbType);
        const nonScoringCount = configStats?.nonScoring || 0;
        const scorableTotal = Math.max((configStats?.total || 0) - nonScoringCount, 0);
        const optimizedCount =
            (configStats?.optimized || 0) + (configStats?.dismissed || 0) + (configStats?.activating || 0);
        const configStateKey = getConfigStateList(configData, configId, dbType);
        const dismissedOrPostponedText = hasDismissedOrPosponed(configStateKey);
        const total = scorableTotal || 1;
        const afterOutOfTotal = scorableTotal;
        let optimizePercentage = 0;
        let runningConfigType: string | undefined;
        let optimizeLoading = false;

        const inProgressList = inProgressOptimizationData?.[configId];
        if (inProgressList && inProgressList.length > 0) {
            const resourceIds = inProgressList.map((item: string) => item.split('_')[0]);
            const hasMssqlMatch = resourceIds.some((resourceId: string) =>
                Object.keys(allmssqlHostAssessmentData || {}).some((key: string) => {
                    const hostData = allmssqlHostAssessmentData[key];
                    return hostData?.databaseHostId === resourceId;
                })
            );
            const hasOracleMatch = resourceIds.some((resourceId: string) =>
                Object.keys(allOracleHostAssessmentData || {}).some((key: string) => {
                    const hostData = allOracleHostAssessmentData[key];
                    return hostData?.databaseHostId === resourceId;
                })
            );

            if (hasMssqlMatch) {
                runningConfigType = DBType.MSSQL;
            } else if (hasOracleMatch) {
                runningConfigType = DBType.ORACLE;
            }
        }

        if (dbType === runningConfigType) {
            optimizePercentage = Math.round(((inProgressOptimizationData?.[configId]?.length || 0) / total) * 100);
            optimizeLoading = (inProgressOptimizationData?.[configId]?.length || 0) > 0;
        }

        const isLoading = loading || optimizeLoading;
        const width = windowSize.width > 1700 ? '328px' : '248px';
        const identifyType = WELL_ARCHITECTED_CATEGORY_LABELS[catalogEntry?.type as WellArchitectedCategory];
        const identifySeverity = mapAssessmentSeverityToFilterLabel(catalogEntry?.severity);

        let perTypeCheck = false;
        if (naCheck) {
            perTypeCheck = true;
        } else if (scorableTotal === 0) {
            perTypeCheck = true;
        } else if (dbType === DBType.ORACLE && configData?.oracleTotal === 0) {
            perTypeCheck = true;
        } else if (dbType !== DBType.ORACLE && configData?.total === 0) {
            perTypeCheck = true;
        }

        return (
            <BarComponent
                color="#5E8DCD"
                headingText={catalogEntry?.name || configId}
                percentage={
                    perTypeCheck
                        ? t('databases.general.not-available')
                        : dismissedOrPostponedText
                        ? 0
                        : Math.round((optimizedCount / total) * 100)
                }
                beforeOutOf={perTypeCheck ? undefined : dismissedOrPostponedText ? undefined : optimizedCount}
                afterOutOf={perTypeCheck ? undefined : dismissedOrPostponedText ? undefined : afterOutOfTotal}
                bottomText={
                    perTypeCheck
                        ? undefined
                        : dismissedOrPostponedText
                        ? undefined
                        : t('databases.well-architected-tab.well-architected-resources')
                }
                width={width}
                from="dashboard"
                optimizePercentage={perTypeCheck ? 100 : dismissedOrPostponedText ? 0 : optimizePercentage}
                loading={dismissedOrPostponedText ? loading : isLoading}
                textMessage={perTypeCheck ? undefined : dismissedOrPostponedText || undefined}
                textMessageVariant={perTypeCheck ? 'Regular_14' : undefined}
                tooltipMessage={dismissedOrPostponedText ? undefined : hasMixedState(configStateKey)}
                isDisabled={perTypeCheck}
                type={identifyType}
                severity={identifySeverity}
            />
        );
    };

    const renderConfigTile = (configId: string, index: number, dbType: string = DBType.MSSQL) => {
        if (!shouldShowTile(configId)) {
            return null;
        }

        const instanceTotal = dbType === DBType.ORACLE ? configData?.oracleTotal : configData?.total;

        return (
            <div className={`${styles.tile} ${index === 0 ? styles.firstTile : ''}`} key={configId}>
                {renderConfigOptimizationBar(configId, dbType)}

                <SeparatorComponent variant="vertical" height="60px" />

                <div className={styles.buttonContainer}>
                    <DsButton
                        variant="secondary"
                        isThin
                        onClick={() => {
                            handleOptimize(configId, dbType);
                        }}
                        data-testid={`wlm-db-optimize-${configId}`}
                        isDisabled={loading || inProgressOptimizationData[configId]?.length > 0 || instanceTotal === 0}
                    >
                        {t('databases.well-architect.view-and-fix')}
                    </DsButton>
                </div>
            </div>
        );
    };

    return (
        <div className={`${styles.managedBreakdown} ${naCheck ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16">
                    {t('databases.dashboard.well-architected-breakdown-by-configurations')}{' '}
                </DsTypography>

                <div className={styles.rightSide}>{loading && <FlashingDotsLoader />}</div>
            </div>

            <div className={styles.filterSection}>
                <div className={styles.radioSection}>
                    <RadioButton
                        id="select-config-mssql"
                        isChecked={configEngineType === DBType.MSSQL}
                        onChange={() => {
                            dispatch(setSelectedConfigEngineType(DBType.MSSQL));
                        }}
                        children={`${DBType.MSSQL} ${
                            noFiltersAppliedMssql
                                ? `(${mssqlTotalConfigurations})`
                                : `(${mssqlFilteredConfigurations}/${mssqlTotalConfigurations})`
                        }`}
                        className=""
                        isDisabled={isMssqlRadioDisabled}
                    />
                    <RadioButton
                        id="select-config-oracle"
                        isChecked={configEngineType === DBType.ORACLE}
                        onChange={() => {
                            dispatch(setSelectedConfigEngineType(DBType.ORACLE));
                        }}
                        children={`${DBType.ORACLE} ${
                            noFiltersAppliedOracle
                                ? `(${oracleTotalConfigurations})`
                                : `(${oracleFilteredConfigurations}/${oracleTotalConfigurations})`
                        }`}
                        className=""
                        isDisabled={isOracleRadioDisabled}
                    />
                </div>

                <div className={styles.rightSide}>
                    <div
                        className={`${styles.imageFilter} ${loading || showNoDataSection ? styles.loading : ''}`}
                        ref={buttonRef}
                    >
                        <Filter />
                        <DsButton
                            isDisabled={loading || showNoDataSection}
                            type="text"
                            onClick={() => setIsOpen(!isOpen)}
                        >
                            {t('databases.well-architected-tab.filter-configuration')}
                        </DsButton>
                        {isOpen && (
                            <div className={styles.popup} ref={popupRef}>
                                <div className={styles.headerContainer}>
                                    <DsTypography variant="Semibold_14" className={styles.title}>
                                        {t('databases.well-architected-tab.filter-by-categories')}
                                    </DsTypography>
                                </div>

                                <div className={styles.filterGrid}>
                                    <div className={styles.column}>
                                        {currentCategoryOptions.map(option => {
                                            const isSelected = currentSelectedCategories.includes(option);
                                            return (
                                                <div className={styles.itemWrapper} key={option}>
                                                    <DsCheckbox
                                                        id={option}
                                                        title={option}
                                                        isSelected={isSelected}
                                                        onSelect={() => toggleCategory(option)}
                                                        className={styles.item}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className={styles.column}>
                                        {(configEngineType === DBType.ORACLE
                                            ? oracleSeverityOptions
                                            : severityOptions
                                        ).map(option => {
                                            const isSelected =
                                                configEngineType === DBType.ORACLE
                                                    ? selectedSeverityOracle.includes(option)
                                                    : selectedSeverityMssql.includes(option);
                                            return (
                                                <DsCheckbox
                                                    id={option}
                                                    key={option}
                                                    title={option}
                                                    isSelected={isSelected}
                                                    onSelect={() => toggleSeverity(option)}
                                                    className={styles.item}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={styles.footer}>
                                    <DsButton className={styles.buttonItem} type="text" onClick={handleApply}>
                                        {t('databases.well-architected-tab.apply')}
                                    </DsButton>
                                    <DsButton
                                        className={styles.buttonItem1}
                                        type="text"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {t('databases.well-architected-tab.cancel')}
                                    </DsButton>
                                </div>
                            </div>
                        )}
                    </div>
                    <SeparatorComponent variant="vertical" height="24px" />

                    <DsButton onClick={handleReset} type="text" isDisabled={isResetDisabled || showNoDataSection}>
                        {t('databases.well-architected-tab.reset-to-default')}
                    </DsButton>
                </div>
            </div>

            <div
                ref={mainSectionRef}
                className={`${styles.mainSection} ${hasScrollbar ? styles.withScrollbar : styles.withoutScrollbar}`}
            >
                {showNoDataSection ? (
                    <div className={styles.noDataSection}>
                        <NoDataIcon />
                        <DsTypography variant="Semibold_14" color="var(--text-secondary)">
                            {t('databases.dashboard.score-breakdown-no-data')}
                        </DsTypography>
                    </div>
                ) : (
                    currentConfigIds.map((configId: string, index: number) =>
                        renderConfigTile(configId, index, configEngineType)
                    )
                )}
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
