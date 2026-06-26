import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DsAccordion, DsPopover, DsSpinner, DsToggleSwitch, DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector, useAppDispatch } from '../../../../store/storeHooks';
import TotalOptimizationScore from '../../../GetWell/TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from '../../../GetWell/OptimizationBreakdown/OptimizationBreakdown';
import styles from './OracleWellArchitectDashboard.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import OracleCardComponent from './OracleCardComponent/OracleCardComponent';
import Tag from '../../../../common/Tag/Tag';
import RecommendationText from '../../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Light } from '../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../assets/Light-Disabled.svg';
import useOraclePostponeInfo from './OraclePostponeActivatingInfo';
import OracleFilterComponent from './FilterComponent/OracleFilterComponent';
import useOracleWellArchitectApi from './OracleWellArchitectApi';
import OracleExportPDF from './ExportPDFComponent/OracleExportPDF';
import OracleWellArchitectBanner from './OracleWellArchitectBanner';
import { checkHasDismissedConfigurations } from '../../../GetWell/GetWellHelper';
import { getCategoryTranslationKey } from '../../../GetWell/GetWellUtils';
import {
    generateOracleDynamicFilterOptions,
    oracleApplyFilter,
    checkAllOracleConfigurationsDismissed,
    groupOracleConfigurationsByCategory
} from './OracleWellArchitectedUtils';
import { DBType, WELL_ARCHITECTED_CATEGORY_ORDER } from '../../../../utils/consts';
import {
    setOracleOptimizeFilterTags,
    setOracleDefaultFilterOptions
} from '../../../../store/workloadFactory/oracleSlice';

const OracleWellArchitectDashboard = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const [expandedValue, setExpandedValue] = useState(undefined);
    const [clickedAccordionId, setClickedAccordionId] = useState<string | undefined>(undefined);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
    const [showDismissedConfigurations, setShowDismissedConfigurations] = useState(false);
    const [configCount, setConfigCount] = useState(0);
    const [instanceDeploymentType, setInstanceDeploymentType] = useState<string>('');

    const { oracleOptimizeFilterTags, oracleDefaultFilterOptions } = useAppSelector(state => state.oracleSlice);

    const {
        optimizationBreakDown,
        isAssessmentAvailable,
        cardData,
        optimizePageLoading: loading,
        gwTimestamp,
        driftAssessmentData,
        selectedDatabaseStorageType,
        isWad: isWadFromStore
    } = useAppSelector(state => state.getWellOptimize);

    // Check if this is a WAD (offline assessment) instance
    // Use Redux store flag which is set when navigating to WAD assessment
    const isWad = isWadFromStore || cardData?.isWad || false;

    const [showChartArea, setShowChartArea] = useState(true);

    useOracleWellArchitectApi();

    const isAccordionExpanded = (id: string, optimizePrintState: any): boolean | undefined => {
        if (optimizePrintState) {
            return true;
        }

        return clickedAccordionId === expandedValue && expandedValue === id;
    };

    const handleAccordionExpanded = (id: any, isExpanded: boolean) => {
        isExpanded && clickedAccordionId === id && setExpandedValue(id);
    };

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

    useEffect(() => {
        handleFilterClearAll();
        setShowDismissedConfigurations(false);
    }, []);

    const toggleDismissedConfiguration = () => {
        setShowDismissedConfigurations(!showDismissedConfigurations);
    };

    // Helper function to check if there are any dismissed configurations
    const hasDismissedConfigurations = useMemo(() => {
        const result = checkHasDismissedConfigurations(cardData);
        return result;
    }, [cardData]);

    // Helper function to check if all configurations are dismissed
    const allConfigurationsDismissed = useMemo(() => checkAllOracleConfigurationsDismissed(cardData), [cardData]);

    // Group configurations by category for dynamic rendering
    const groupedConfigurations = useMemo(
        () => groupOracleConfigurationsByCategory(filteredCardData),
        [filteredCardData]
    );

    // Automatically enable dismissed toggle when all configurations are dismissed
    // and allow it to be turned off when not all configurations are dismissed
    useEffect(() => {
        if (allConfigurationsDismissed) {
            setShowDismissedConfigurations(true);
        } else {
            // Only auto-disable if currently showing dismissed view and not all configs are dismissed
            if (showDismissedConfigurations && !hasDismissedConfigurations) {
                setShowDismissedConfigurations(false);
            }
        }
    }, [allConfigurationsDismissed, hasDismissedConfigurations, showDismissedConfigurations]);

    // To apply filters on change of filters or card data
    useEffect(() => {
        const { data, configCount } = oracleApplyFilter(
            cardData,
            oracleOptimizeFilterTags,
            showDismissedConfigurations,
            driftAssessmentData
        );
        setFilteredCardData(data);
        setInstanceDeploymentType(cardData?.deploymentType || '');
        setConfigCount(configCount);
    }, [
        cardData,
        oracleOptimizeFilterTags,
        selectedDatabaseStorageType,
        showDismissedConfigurations,
        driftAssessmentData
    ]);

    const handleFilterClearAll = useCallback(() => {
        dispatch(setOracleOptimizeFilterTags([]));
        dispatch(setOracleDefaultFilterOptions({}));
        setShowDismissedConfigurations(false);
    }, [dispatch]);

    const { renderPostponeActivatingInfo } = useOraclePostponeInfo();

    const renderConfigurationCard = useCallback(
        (configKey: string, config: any, index: number) => {
            const accordionId = `${configKey}-${index}`;

            return (
                <div key={configKey}>
                    <OracleCardComponent
                        cardData={config}
                        showDismissedConfigurations={showDismissedConfigurations}
                        setShowDismissedConfigurations={setShowDismissedConfigurations}
                        driftAssessmentData={driftAssessmentData}
                    />
                    <DsAccordion
                        id={accordionId}
                        variant="Default"
                        isDisabled={loading || showDismissedConfigurations}
                        isExpanded={isAccordionExpanded(accordionId, optimizePrintState)}
                        onExpandChange={(isExpanded: boolean) => {
                            handleAccordionExpanded(accordionId, isExpanded);
                        }}
                        onClick={() => setClickedAccordionId(accordionId)}
                        title={
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
                        }
                        headerActions={[
                            <div className={styles.headerAction}>
                                {renderPostponeActivatingInfo(configKey, showDismissedConfigurations)}
                                <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                    {loading || showDismissedConfigurations ? <LightDisabled /> : <Light />}
                                </div>
                                <div
                                    style={{
                                        color:
                                            loading || showDismissedConfigurations
                                                ? 'var(--text-disabled)'
                                                : 'var(--text-button-primary)'
                                    }}
                                >
                                    {t('databases.oracle-inner-page.view-recommendation')}
                                </div>
                            </div>
                        ]}
                        children={<RecommendationText data={config?.recommendation} />}
                    />
                </div>
            );
        },
        [
            showDismissedConfigurations,
            driftAssessmentData,
            loading,
            optimizePrintState,
            isDarkTheme,
            renderPostponeActivatingInfo,
            isAccordionExpanded,
            handleAccordionExpanded,
            t
        ]
    );

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
        return generateOracleDynamicFilterOptions(filteredCardData, instanceDeploymentType);
    }, [filteredCardData, instanceDeploymentType]);

    return (
        <div style={{ width: '100%' }}>
            {optimizePrintState && (
                <>
                    <div className={commonStyles.loaderOverlay} />
                    <div className={commonStyles.spinnerPlacement}>
                        <DsSpinner isLarge />
                    </div>
                </>
            )}
            <div className={styles['well-architected']} id="export-oracle-optimize-pdf">
                <OracleWellArchitectBanner />

                {showChartArea && (
                    <>
                        <div className={styles.cards}>
                            <TotalOptimizationScore
                                loading={loading}
                                optimizationBreakDown={optimizationBreakDown}
                                isAssessmentAvailable={isAssessmentAvailable}
                                allConfigurationsDismissed={allConfigurationsDismissed}
                                isWad={isWad}
                            />
                            <OptimizationBreakdown
                                allConfigurationsDismissed={allConfigurationsDismissed}
                                engineType={DBType.ORACLE}
                            />
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
                                            <OracleExportPDF
                                                optimizePrintState={optimizePrintState}
                                                setOptimizePrintState={setOptimizePrintState}
                                                loading={loading}
                                                isAssessmentAvailable={isAssessmentAvailable}
                                            />
                                            {/* Dismissed configurations toggle */}
                                            <div>
                                                {!hasDismissedConfigurations ? (
                                                    <DsPopover
                                                        trigger="hover"
                                                        title={
                                                            isWad
                                                                ? t('databases.wad.tab-disabled-message-oracle')
                                                                : t(
                                                                      'databases.well-architect.dismiss.no-dismissed-configurations'
                                                                  )
                                                        }
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
                                                        title={
                                                            isWad
                                                                ? t('databases.wad.tab-disabled-message-oracle')
                                                                : t(
                                                                      'databases.well-architect.dismiss.all-configurations-dismissed-tooltip'
                                                                  )
                                                        }
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
                            </div>

                            <OracleFilterComponent
                                setFilteredCardData={setFilteredCardData}
                                showDismissedConfigurations={showDismissedConfigurations}
                                driftAssessmentData={driftAssessmentData}
                                dynamicFilterOptions={dynamicFilterOptions}
                            />
                        </div>

                        {/* Adding dummy div to have consistent spacing after filters */}
                        <div style={{ marginBottom: '20px' }} />

                        {/* Loading state for configuration cards */}
                        {loading && Object.keys(filteredCardData).length === 0 && (
                            <div className={styles.sectionTwo}>
                                <div className={styles.sectionClass}>
                                    <div className={styles.loadingSpinner}>
                                        <DsSpinner isLarge />
                                    </div>
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
                                        <div key={category} className={styles.sectionTwo}>
                                            <div className={styles.sectionClass}>
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
                                                    {configs.map(
                                                        (
                                                            { key, config }: { key: string; config: any },
                                                            index: number
                                                        ) => renderConfigurationCard(key, config, index)
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default OracleWellArchitectDashboard;
