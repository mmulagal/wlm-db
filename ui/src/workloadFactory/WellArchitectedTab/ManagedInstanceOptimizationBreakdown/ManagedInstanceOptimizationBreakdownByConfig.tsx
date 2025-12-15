import { DsButton, DsPopover, DsTypography, FlashingDotsLoader, RadioButton } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsCheckbox } from '@tlveng/wlm-ds';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_NAMES,
    categoryOptions,
    oracleCategoryOptions,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    DBType,
    severityOptions,
    oracleSeverityOptions,
    WLF_TABS
} from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import { ReactComponent as Filter } from '../../../assets/filter-icon.svg';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { setLandingFrom, setSelectedConfigEngineType } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import BarComponent from '../../Dashboard/BarComponent/BarComponent';
import {
    mssqlAssessmentKeys,
    oracleAssessmentKeys,
    derivedSeverity,
    derivedType,
    getCategoryForAssessment
} from '../../../utils/utilityFunctions';

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
    const [oracleAssessmentDynamicKeys, setOracleAssessmentDynamicKeys] = useState<string[]>(oracleAssessmentKeys);
    const [mssqlAssessmentDynamicKeys, setMssqlAssessmentDynamicKeys] = useState<string[]>(mssqlAssessmentKeys);

    // For popup
    const [isOpen, setIsOpen] = useState(false);
    // Maintain separate category selections/applied filters for MSSQL and Oracle
    const [selectedCategoriesMssql, setSelectedCategoriesMssql] = useState<string[]>(categoryOptions);
    const [appliedCategoriesMssql, setAppliedCategoriesMssql] = useState<string[]>(categoryOptions);
    // For Oracle: Storage should be checked and disabled; others unchecked and disabled
    const ORACLE_DEFAULT_SELECTED = ['Storage'];
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

    useEffect(() => {
        if (configEngineType === DBType.ORACLE) {
            // To calculate dynamic keys for Oracle assessments for "Score breakdown by configurations"
            setOracleAssessmentDynamicKeys(
                oracleAssessmentKeys.filter(key => {
                    if (
                        key === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
                        key === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT
                    ) {
                        if (configData?.isAsmEnable) {
                            return key;
                        }
                    } else if (key === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT) {
                        if (configData?.isAsmEnable && configData?.isFraEnable) {
                            return key;
                        }
                    } else if (key === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT) {
                        if (configData?.isAsmEnable && configData?.isArchiveEnable) {
                            return key;
                        }
                    } else {
                        return key;
                    }
                })
            );
        } else if (configEngineType === DBType.MSSQL) {
            setMssqlAssessmentDynamicKeys(
                mssqlAssessmentKeys.filter(key => {
                    if (key === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) {
                        if (configData?.isHaMssqlEnable) {
                            return key;
                        }
                    } else {
                        return key;
                    }
                })
            );
        }
    }, [oracleAssessmentKeys, mssqlAssessmentKeys, configData]);

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
        // For Oracle the category checkboxes are disabled, prevent toggling
        if (configEngineType === DBType.ORACLE) return;
        setSelectedCategoriesMssql(prev => (prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]));
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
    const shouldShowTile = (assessmentKey: string): boolean => {
        const currentAssessmentKeys =
            configEngineType === DBType.ORACLE ? oracleAssessmentDynamicKeys : mssqlAssessmentDynamicKeys;

        // Check if the assessment key belongs to the current engine type
        if (!currentAssessmentKeys.includes(assessmentKey)) {
            return false;
        }

        const tileCategory = getCategoryForAssessment(assessmentKey);
        const tileSeverity = derivedSeverity(assessmentKey);

        // If no filters are applied, show nothing
        const appliedCats = configEngineType === DBType.ORACLE ? appliedCategoriesOracle : appliedCategoriesMssql;
        const appliedSev = configEngineType === DBType.ORACLE ? appliedSeverityOracle : appliedSeverityMssql;
        if (appliedCats.length === 0 && appliedSev.length === 0) {
            return false;
        }

        // Check category match
        const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;

        // Check severity match
        const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;

        // Show tile if it matches both category AND severity (AND logic)
        return categoryMatch && severityMatch;
    };

    // Get current engine-specific assessment keys
    const currentAssessmentKeys =
        configEngineType === DBType.ORACLE ? oracleAssessmentDynamicKeys : mssqlAssessmentDynamicKeys;

    const filteredConfigurations = currentAssessmentKeys.filter(key => shouldShowTile(key)).length;

    // Calculate separate counts for MSSQL and Oracle radio buttons using per-engine applied categories
    const mssqlTotalConfigurations = useMemo(() => mssqlAssessmentDynamicKeys.length, [mssqlAssessmentDynamicKeys]);
    const mssqlFilteredConfigurations = useMemo(
        () =>
            mssqlAssessmentDynamicKeys.filter(key => {
                const tileCategory = getCategoryForAssessment(key);
                const tileSeverity = derivedSeverity(key);
                const appliedCats = appliedCategoriesMssql;
                const appliedSev = appliedSeverityMssql;
                if (appliedCats.length === 0 && appliedSev.length === 0) return false;
                const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;
                const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;
                return categoryMatch && severityMatch;
            }).length,
        [mssqlAssessmentDynamicKeys, appliedCategoriesMssql, appliedSeverityMssql]
    );

    const oracleTotalConfigurations = useMemo(() => oracleAssessmentDynamicKeys.length, [oracleAssessmentDynamicKeys]);

    const oracleFilteredConfigurations = useMemo(
        () =>
            oracleAssessmentDynamicKeys.filter(key => {
                const tileCategory = getCategoryForAssessment(key);
                const tileSeverity = derivedSeverity(key);
                const appliedCats = appliedCategoriesOracle;
                const appliedSev = appliedSeverityOracle;
                if (appliedCats.length === 0 && appliedSev.length === 0) return false;
                const categoryMatch = appliedCats.length > 0 ? appliedCats.includes(tileCategory) : false;
                const severityMatch = appliedSev.length > 0 && tileSeverity ? appliedSev.includes(tileSeverity) : false;
                return categoryMatch && severityMatch;
            }).length,
        [oracleAssessmentDynamicKeys, appliedCategoriesOracle, appliedSeverityOracle]
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

    const naCheck = useMemo(() => {
        if (configData?.total === 0 && configData?.oracleTotal !== 0) {
            dispatch(setSelectedConfigEngineType(DBType.ORACLE));
        }
        if (showNA) {
            return true;
        }
        if (!loading && configData?.oracleTotal + configData?.total === 0) {
            return true;
        }
        return false;
    }, [configData, showNA]);

    const renderOptimizationBar = (
        assessmentKey: string,
        headingText: string,
        key: string,
        type: string = DBType.MSSQL
    ) => {
        const optimizedCount =
            (configData?.[key]?.optimized || 0) +
            (configData?.[key]?.dismissed || 0) +
            (configData?.[key]?.activating || 0);
        const configStateKey = configData?.configState?.[key] || [];
        const dismissedOrPostponedText = hasDismissedOrPosponed(configStateKey);
        let total = 0;
        let afterOutOfTotal = 0;
        if (type === DBType.ORACLE) {
            if (
                headingText === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
                headingText === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
                headingText === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
                headingText === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
            ) {
                // For ASM configs total is calculated dynamically as all databases does not have ASM setup
                total = configData?.[key]?.total || 1;
                afterOutOfTotal = configData?.[key]?.total;
            } else {
                total = configData?.oracleTotal || 1;
                afterOutOfTotal = configData?.oracleTotal;
            }
        } else if (headingText === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) {
            total = configData?.[key]?.total || 1;
            afterOutOfTotal = configData?.[key]?.total;
        } else {
            total = configData?.total || 1;
            afterOutOfTotal = configData?.total;
        }
        let optimizePercentage = 0;
        let runningConfigType: string | undefined;
        let optimizeLoading = false;

        // Determine the DBType by checking resource IDs from inProgressOptimizationData
        const inProgressList = inProgressOptimizationData?.[assessmentKey];
        if (inProgressList && inProgressList.length > 0) {
            // Extract resource IDs from the list (format: "resource-id_value")
            const resourceIds = inProgressList.map((item: string) => item.split('_')[0]);

            // Check if any resource ID matches databaseHostId in MSSQL data
            const hasMssqlMatch = resourceIds.some((resourceId: string) =>
                Object.keys(allmssqlHostAssessmentData || {}).some((key: string) => {
                    const hostData = allmssqlHostAssessmentData[key];
                    return hostData?.databaseHostId === resourceId;
                })
            );

            // Check if any resource ID matches databaseHostId in Oracle data
            const hasOracleMatch = resourceIds.some((resourceId: string) =>
                Object.keys(allOracleHostAssessmentData || {}).some((key: string) => {
                    const hostData = allOracleHostAssessmentData[key];
                    return hostData?.databaseHostId === resourceId;
                })
            );

            // Set runningConfigType based on matches
            if (hasMssqlMatch) {
                runningConfigType = DBType.MSSQL;
            } else if (hasOracleMatch) {
                runningConfigType = DBType.ORACLE;
            }
        }

        if (type === runningConfigType) {
            optimizePercentage = Math.round(((inProgressOptimizationData?.[assessmentKey]?.length || 0) / total) * 100);
            optimizeLoading = (inProgressOptimizationData?.[assessmentKey]?.length || 0) > 0;
        }

        const isLoading = loading || optimizeLoading;
        const width = windowSize.width > 1700 ? '328px' : '248px';
        const identifyType = derivedType(assessmentKey);
        const identifySeverity = derivedSeverity(assessmentKey);

        let perTypeCheck = false;
        if (naCheck) {
            perTypeCheck = true;
        } else if (type === DBType.ORACLE && configData?.oracleTotal === 0) {
            perTypeCheck = true;
        } else if (type !== DBType.ORACLE && configData?.total === 0) {
            perTypeCheck = true;
        }

        return (
            <BarComponent
                color="#5E8DCD"
                headingText={headingText}
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

    // Helper function to render Oracle configuration tiles
    const renderOracleConfigTile = (
        assessmentConfigName: string,
        dataKey: string,
        testId: string,
        displayName?: string,
        optimizeHandler?: string,
        isAlwaysDisabled?: boolean
    ) => {
        if (!shouldShowTile(assessmentConfigName)) return null;

        const titleText = displayName || assessmentConfigName;
        const handleOptimizeClick = optimizeHandler || assessmentConfigName;
        const isDisabled = isAlwaysDisabled !== undefined ? isAlwaysDisabled : true;

        return (
            <div className={styles.tile}>
                {renderOptimizationBar(assessmentConfigName, titleText, dataKey, DBType.ORACLE)}

                <SeparatorComponent variant="vertical" height="60px" />

                <div className={styles.buttonContainer}>
                    {isDisabled && (
                        <DsPopover trigger="hover" title={t('databases.general.coming-soon')} placement="bottom">
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {}}
                                data-testid={testId}
                                isDisabled={isDisabled || configData?.oracleTotal === 0}
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </DsPopover>
                    )}
                    {!isDisabled && (
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(handleOptimizeClick, DBType.ORACLE);
                            }}
                            data-testid={testId}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[assessmentConfigName]?.length > 0 ||
                                configData?.oracleTotal === 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    )}
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
                    />
                </div>

                <div className={styles.rightSide}>
                    <div className={`${styles.imageFilter} ${loading ? styles.loading : ''}`} ref={buttonRef}>
                        <Filter />
                        <DsButton isDisabled={loading} type="text" onClick={() => setIsOpen(!isOpen)}>
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
                                            const isOracle = configEngineType === DBType.ORACLE;
                                            // For Oracle: Storage should be selected and all options disabled
                                            const isDisabled = isOracle;
                                            const isSelected = isOracle
                                                ? ORACLE_DEFAULT_SELECTED.includes(option)
                                                : currentSelectedCategories.includes(option);
                                            return (
                                                <div className={styles.itemWrapper} key={option}>
                                                    <DsCheckbox
                                                        id={option}
                                                        title={option}
                                                        isSelected={isSelected}
                                                        onSelect={() => toggleCategory(option)}
                                                        className={styles.item}
                                                        isDisabled={isDisabled}
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

                    <DsButton onClick={handleReset} type="text" isDisabled={isResetDisabled}>
                        {t('databases.well-architected-tab.reset-to-default')}
                    </DsButton>
                </div>
            </div>

            <div
                ref={mainSectionRef}
                className={`${styles.mainSection} ${hasScrollbar ? styles.withScrollbar : styles.withoutScrollbar}`}
            >
                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) && (
                    <div className={`${styles.tile} ${styles.firstTile}`}>
                        {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER, 'Storage tier', 'storageTier')}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER);
                                }}
                                data-testid="wlm-db-optimize-storage-tier"
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
                            'File system headroom',
                            'fileSystemHeadroom'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-file-system-headroom"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length >
                                        0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
                            'Log drive size',
                            'logDriveSize'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
                                }}
                                data-testid="wlm-db-optimize-log-drive-size"
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
                            'TempDB drive size',
                            'tempdbDriveSize'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-temdb-drive-size"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
                            'Data files (.mdf)',
                            'userDataFiles'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                data-testid="wlm-db-optimize-data-files"
                                variant="secondary"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF, 'Log files (.ldf)', 'logFiles')}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                data-testid="wlm-db-optimize-log-files"
                                variant="secondary"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                            ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                            'tempdbPlacement'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                data-testid="wlm-db-optimize-temdb-placement"
                                variant="secondary"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.ONTAP) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.ONTAP, 'ONTAP', 'ontapConfiguration')}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-ontap"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS);
                                }}
                                isDisabled={loading || configData?.total === 0}
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.OS) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.OS, 'Operating system', 'operatingSystem')}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-operating-system"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM);
                                }}
                                isDisabled={loading || configData?.total === 0}
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
                            ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
                            'computeRightsizing'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-compute-right-sizing"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]?.length >
                                        0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL &&
                    shouldShowTile(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH) && (
                        <div className={styles.tile}>
                            {renderOptimizationBar(
                                ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                                ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                                'operatingSystemPatch'
                            )}

                            <SeparatorComponent variant="vertical" height="60px" />

                            <div className={styles.buttonContainer}>
                                <DsButton
                                    data-testid="wlm-db-optimize-operating-system-patch"
                                    isThin
                                    variant="secondary"
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH);
                                    }}
                                    isDisabled={
                                        loading ||
                                        inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]
                                            ?.length > 0 ||
                                        configData?.total === 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </div>
                    )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
                            ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
                            'rssConfiguration'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION);
                                }}
                                data-testid="wlm-db-optimize-rss-configuration"
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}
                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.MTU) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.MTU,
                            t('databases.general.mtu'),
                            'mtuConfiguration'
                        )}
                        <SeparatorComponent variant="vertical" height="60px" />
                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                data-testid="wlm-db-optimize-mtu"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.MTU);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MTU]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}
                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.LICENSE) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.LICENSE,
                            ASSESSMENT_CONFIG_NAMES.LICENSE,
                            'applicationSqlServer'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                data-testid="wlm-db-optimize-license-sql-server"
                                isThin
                                variant="secondary"
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.LICENSE);
                                }}
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LICENSE]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL &&
                    shouldShowTile(ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH) && (
                        <div className={styles.tile}>
                            {renderOptimizationBar(
                                ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                                ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                                'mssqlPatch'
                            )}

                            <SeparatorComponent variant="vertical" height="60px" />

                            <div className={styles.buttonContainer}>
                                <DsButton
                                    data-testid="wlm-db-optimize-microsoft-sql-server"
                                    variant="secondary"
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH);
                                    }}
                                    isDisabled={
                                        loading ||
                                        inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]
                                            ?.length > 0 ||
                                        configData?.total === 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </div>
                    )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.MAXDOP) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.MAXDOP,
                            ASSESSMENT_CONFIG_NAMES.MAXDOP,
                            'maxdopPatch'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.MAXDOP);
                                }}
                                data-testid="wlm-db-optimize-maxdop"
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MAXDOP]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL &&
                    shouldShowTile(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) && (
                        <div className={styles.tile}>
                            {renderOptimizationBar(
                                ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                                ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                                'scheduledLocalSnapshot'
                            )}

                            <SeparatorComponent variant="vertical" height="60px" />

                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT);
                                    }}
                                    data-testid="wlm-db-optimize-snapshot"
                                    isDisabled={
                                        loading ||
                                        inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]
                                            ?.length > 0 ||
                                        configData?.total === 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </div>
                    )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.CRR) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.CRR, 'Cross-Region Replication (CRR)', 'crr')}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <TooltipComponent title="" placement="bottom" width="120px" height="30px">
                                <div>
                                    <DsButton
                                        data-testid="wlm-db-optimize-crr"
                                        variant="secondary"
                                        isThin
                                        onClick={() => {
                                            handleOptimize(ASSESSMENT_CONFIG_NAMES.CRR);
                                        }}
                                        isDisabled={
                                            loading ||
                                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CRR]?.length > 0 ||
                                            configData?.total === 0
                                        }
                                    >
                                        {t('databases.well-architect.view-and-fix')}
                                    </DsButton>
                                </div>
                            </TooltipComponent>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.MSSQL &&
                    shouldShowTile(ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) && (
                        <div className={styles.tile}>
                            {renderOptimizationBar(
                                ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                                ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                                'scheduledawsBackup'
                            )}

                            <SeparatorComponent variant="vertical" height="60px" />

                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS);
                                    }}
                                    data-testid="wlm-db-optimize-awsbackup"
                                    isDisabled={
                                        loading ||
                                        inProgressOptimizationData[
                                            ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS
                                        ]?.length > 0 ||
                                        configData?.total === 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </div>
                    )}
                {configEngineType === DBType.MSSQL &&
                    configData?.isHaMssqlEnable &&
                    shouldShowTile(ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) && (
                        <div className={styles.tile}>
                            {renderOptimizationBar(
                                ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY,
                                t('databases.general.mssql-high-availability'),
                                'mssqlhighAvailability'
                            )}

                            <SeparatorComponent variant="vertical" height="60px" />

                            <div className={styles.buttonContainer}>
                                <DsButton
                                    variant="secondary"
                                    isThin
                                    data-testid="wlm-db-optimize-mssql-high-availability"
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY);
                                    }}
                                    isDisabled={
                                        loading ||
                                        inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]
                                            ?.length > 0 ||
                                        configData?.total === 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </div>
                    )}

                {configEngineType === DBType.MSSQL && shouldShowTile(ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) && (
                    <div className={styles.tile}>
                        {renderOptimizationBar(
                            ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                            ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                            'clone'
                        )}

                        <SeparatorComponent variant="vertical" height="60px" />

                        <div className={styles.buttonContainer}>
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    handleOptimize(ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT);
                                }}
                                data-testid="wlm-db-optimize-clone"
                                isDisabled={
                                    loading ||
                                    inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0 ||
                                    configData?.total === 0
                                }
                            >
                                {t('databases.well-architect.view-and-fix')}
                            </DsButton>
                        </div>
                    </div>
                )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
                        'oracleFileSystemHeadroom',
                        'wlm-db-optimize-oracle-file-system-headroom',
                        'File system headroom',
                        ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
                        'oracleSwapSpace',
                        'wlm-db-optimize-oracle-swap-space',
                        'Swap space',
                        ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
                        'oracleBinaryPlacement',
                        'wlm-db-optimize-oracle-binary-placement',
                        ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
                        'datafilesPlacement',
                        'wlm-db-optimize-datafiles-placement',
                        ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
                        'controlfilesPlacement',
                        'wlm-db-optimize-controlfiles-placement',
                        ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
                        'redoLogsPlacement',
                        'wlm-db-optimize-redo-logs-placement',
                        ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
                        'tempLogsPlacement',
                        'wlm-db-optimize-temp-logs-placement',
                        ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
                        'archivePlacement',
                        'wlm-db-optimize-archive-placement',
                        ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    configData?.isAsmEnable &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
                        'dataDgLunLayout',
                        'wlm-db-optimize-data-dg-lun-layout',
                        ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
                        ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    configData?.isAsmEnable &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
                        'logDgLunLayout',
                        'wlm-db-optimize-log-dg-lun-layout',
                        ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
                        ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    configData?.isAsmEnable &&
                    configData?.isFraEnable &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
                        'fraDgLunLayout',
                        'wlm-db-optimize-fra-dg-lun-layout',
                        ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
                        ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    configData?.isAsmEnable &&
                    configData?.isArchiveEnable &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
                        'archiveLogDgLunLayout',
                        'wlm-db-optimize-archive-dg-lun-layout',
                        ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
                        ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.ONTAP,
                        'oracleOntapConfiguration',
                        'wlm-db-optimize-oracle-ontap',
                        'ONTAP',
                        ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS,
                        false
                    )}

                {configEngineType === DBType.ORACLE &&
                    renderOracleConfigTile(
                        ASSESSMENT_CONFIG_NAMES.OS,
                        'oracleOperatingSystem',
                        'wlm-db-optimize-oracle-operating-system',
                        'Operating system',
                        ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM,
                        false
                    )}
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
