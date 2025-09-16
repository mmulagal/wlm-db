import { useEffect, useState } from 'react';
import TotalOptimizationScore from '../../../GetWell/TotalOptimizationScore/TotalOptimizationScore';
import OracleConfigureCategory from './OracleConfigureCategory/OracleConfigureCategory';
import styles from './OracleWellArchitectDashboard.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import StorageLayoutSection from './Categories/StorageLayoutSection';
import OracleFilterComponent from './FilterComponent/OracleFilterComponent';
import useOracleWellArchitectApi from './OracleWellArchitectApi';
import StorageConfigurationSection from './Categories/StorageConfigurationSection';
import OracleExportPDF from './ExportPDFComponent/OracleExportPDF';
import OracleWellArchitectBanner from './OracleWellArchitectBanner';
import StorageConfigurationOSSection from './Categories/StorageConfigurationOSSection';

const OracleWellArchitectDashboard = () => {
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const [expandedValue, setExpandedValue] = useState(undefined);
    const [clickedAccordionId, setClickedAccordionId] = useState<string | undefined>(undefined);
    const [filteredCardData, setFilteredCardData] = useState<any>({});

    const {
        optimizationBreakDown,
        isAssessmentAvailable,
        // cardData,
        optimizePageLoading: loading,
        gwTimestamp
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

    return (
        <div className={styles['well-architected']} id="export-oracle-optimize-pdf">
            <OracleWellArchitectBanner />

            {showChartArea && (
                <>
                    <div className={styles.cards}>
                        <TotalOptimizationScore
                            loading={loading}
                            optimizationBreakDown={optimizationBreakDown}
                            isAssessmentAvailable={isAssessmentAvailable}
                        />
                        <OracleConfigureCategory />
                    </div>

                    <div className={styles.sectionTwo}>
                        <OracleExportPDF
                            optimizePrintState={optimizePrintState}
                            setOptimizePrintState={setOptimizePrintState}
                            loading={loading}
                            isAssessmentAvailable={isAssessmentAvailable}
                        />

                        <OracleFilterComponent setFilteredCardData={setFilteredCardData} />
                    </div>

                    {(filteredCardData?.redologs_placement ||
                        filteredCardData?.templogs_placement ||
                        filteredCardData?.archive_placement ||
                        filteredCardData?.datafiles_placement ||
                        filteredCardData?.controlfiles_placement ||
                        filteredCardData?.oracle_binary_placement) && (
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
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default OracleWellArchitectDashboard;
