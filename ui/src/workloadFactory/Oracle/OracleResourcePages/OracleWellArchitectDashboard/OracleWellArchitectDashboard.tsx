import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DsPopover, DsSpinner, DsToggleSwitch, DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector, useAppDispatch } from '../../../../store/storeHooks';
import TotalOptimizationScore from '../../../GetWell/TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from '../../../GetWell/OptimizationBreakdown/OptimizationBreakdown';
import styles from './OracleWellArchitectDashboard.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import StorageLayoutSection from './Categories/StorageLayoutSection';
import StorageSizingSection from './Categories/StorageSizingSection';
import OracleFilterComponent from './FilterComponent/OracleFilterComponent';
import useOracleWellArchitectApi from './OracleWellArchitectApi';
import StorageConfigurationSection from './Categories/StorageConfigurationSection';
import OracleExportPDF from './ExportPDFComponent/OracleExportPDF';
import OracleWellArchitectBanner from './OracleWellArchitectBanner';
import { checkHasDismissedConfigurations } from '../../../GetWell/GetWellHelper';
import {
    generateOracleDynamicFilterOptions,
    oracleApplyFilter,
    checkAllOracleConfigurationsDismissed
} from './OracleWellArchitectedUtils';
import { DBType } from '../../../../utils/consts';
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
        selectedDatabaseStorageType
    } = useAppSelector(state => state.getWellOptimize);

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

    useEffect(() => {
        handleFilterClearAll();
        setShowDismissedConfigurations(false);
    }, []);

    const toggleDismissedConfiguration = () => {
        setShowDismissedConfigurations(!showDismissedConfigurations);
    };

    // Helper function to check if there are any dismissed configurations
    const hasDismissedConfigurations = useMemo(() => {
        const result = checkHasDismissedConfigurations(cardData, driftAssessmentData);
        return result;
    }, [cardData, driftAssessmentData]);

    // Helper function to check if all configurations are dismissed
    const allConfigurationsDismissed = useMemo(
        () => checkAllOracleConfigurationsDismissed(cardData, driftAssessmentData),
        [cardData, driftAssessmentData]
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

                        {(filteredCardData?.file_system_headroom || filteredCardData?.swap_space) && (
                            <div className={styles.sectionTwo}>
                                <div className={styles.sectionClass}>
                                    <StorageSizingSection
                                        styles={styles}
                                        isAccordionExpanded={isAccordionExpanded}
                                        setClickedAccordionId={setClickedAccordionId}
                                        loading={loading}
                                        handleAccordionExpanded={handleAccordionExpanded}
                                        isDarkTheme={isDarkTheme}
                                        optimizePrintState={optimizePrintState}
                                        oracleCardData={filteredCardData}
                                        showDismissedConfigurations={showDismissedConfigurations}
                                        setShowDismissedConfigurations={setShowDismissedConfigurations}
                                        driftAssessmentData={driftAssessmentData}
                                    />
                                </div>
                            </div>
                        )}

                        {(filteredCardData?.redologs_placement ||
                            filteredCardData?.templogs_placement ||
                            filteredCardData?.archive_placement ||
                            filteredCardData?.datafiles_placement ||
                            filteredCardData?.controlfiles_placement ||
                            filteredCardData?.oracle_binary_placement ||
                            filteredCardData?.data_dg_lun_layout ||
                            filteredCardData?.log_dg_lun_layout ||
                            filteredCardData?.fra_dg_lun_layout ||
                            filteredCardData?.archivelog_dg_lun_layout) && (
                            <div className={styles.sectionTwo}>
                                <div className={styles.sectionClass}>
                                    <StorageLayoutSection
                                        styles={styles}
                                        isAccordionExpanded={isAccordionExpanded}
                                        setClickedAccordionId={setClickedAccordionId}
                                        loading={loading}
                                        handleAccordionExpanded={handleAccordionExpanded}
                                        isDarkTheme={isDarkTheme}
                                        optimizePrintState={optimizePrintState}
                                        oracleCardData={filteredCardData}
                                        showDismissedConfigurations={showDismissedConfigurations}
                                        setShowDismissedConfigurations={setShowDismissedConfigurations}
                                        driftAssessmentData={driftAssessmentData}
                                    />
                                </div>
                            </div>
                        )}

                        {(filteredCardData?.ontap_configuration || filteredCardData?.os_configuration) && (
                            <div className={styles.sectionTwo}>
                                <div className={styles.sectionClass}>
                                    <StorageConfigurationSection
                                        styles={styles}
                                        isAccordionExpanded={isAccordionExpanded}
                                        setClickedAccordionId={setClickedAccordionId}
                                        loading={loading}
                                        handleAccordionExpanded={handleAccordionExpanded}
                                        isDarkTheme={isDarkTheme}
                                        optimizePrintState={optimizePrintState}
                                        oracleCardData={filteredCardData}
                                        showDismissedConfigurations={showDismissedConfigurations}
                                        setShowDismissedConfigurations={setShowDismissedConfigurations}
                                        driftAssessmentData={driftAssessmentData}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default OracleWellArchitectDashboard;
