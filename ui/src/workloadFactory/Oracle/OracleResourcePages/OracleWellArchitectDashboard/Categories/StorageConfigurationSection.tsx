import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';
import { DBType, WLF_TABS, CONFIG_STATES, ASSESSMENT_CONFIG_NAMES } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';
import RecommendationTable from '../../../../GetWell/RecommendationTable/RecommendationTable';
import {
    areAllOntapSubConfigurationsActivating,
    areAllOsSubConfigurationsActivating,
    ActivatingInfo
} from '../../../../GetWell/GetWellHelper';
import useOraclePostponeInfo from '../OraclePostponeActivatingInfo';
import { OracleCategorySectionProps } from '../../../../GetWell/GetWellUtils';

const StorageConfigurationSection = ({
    styles,
    isAccordionExpanded,
    setClickedAccordionId,
    loading,
    handleAccordionExpanded,
    isDarkTheme,
    optimizePrintState,
    oracleCardData,
    showDismissedConfigurations,
    setShowDismissedConfigurations,
    driftAssessmentData
}: OracleCategorySectionProps) => {
    const { t } = useTranslation();
    const { ontapConfigTableData, osConfigTableData } = useAppSelector(state => state.getWellOptimize);
    const { renderPostponeActivatingInfo } = useOraclePostponeInfo();

    // Memoize sub-configuration activation states to avoid redundant computation
    const areAllOntapActivating = useMemo(
        () => areAllOntapSubConfigurationsActivating(driftAssessmentData),
        [driftAssessmentData]
    );

    const areAllOsActivating = useMemo(
        () => areAllOsSubConfigurationsActivating(driftAssessmentData),
        [driftAssessmentData]
    );

    // Helper function to render sub-config activating info
    const renderSubConfigActivatingInfo = (configType: 'ontap' | 'os') => {
        if (showDismissedConfigurations) return null;

        let areAllActivating = false;

        switch (configType) {
            case ASSESSMENT_CONFIG_NAMES.ONTAP:
                areAllActivating = areAllOntapActivating;
                break;
            case ASSESSMENT_CONFIG_NAMES.OS:
                areAllActivating = areAllOsActivating;
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
        <div>
            <div className={styles['header-buttons']}>
                <DsTypography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                >
                    {t('databases.oracle-inner-page.storage-configuration')}
                </DsTypography>
            </div>

            <div className={styles.accordionGroups}>
                {oracleCardData.ontap_configuration && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.ontap_configuration}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            isAllSubConfigActivating={areAllOntapActivating}
                        />

                        <DsAccordion
                            id="10"
                            variant="Default"
                            isDisabled={loading || !oracleCardData?.ontap_configuration?.block_two?.value}
                            isExpanded={isAccordionExpanded('10', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('10', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('10')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData?.ontap_configuration?.tags?.map((perTag: string, index: number) => (
                                        <div
                                            className={`${showDismissedConfigurations ? styles.dismissed : ''}`}
                                            key={index}
                                        >
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    {renderPostponeActivatingInfo('ontap_configuration', showDismissedConfigurations)}

                                    {/* Show full ActivatingInfo if all sub-configs are activating */}
                                    {areAllOntapActivating &&
                                        !showDismissedConfigurations &&
                                        renderSubConfigActivatingInfo('ontap')}

                                    {/* Show normal view button if not all sub-configs are activating or in dismissed view */}
                                    {(!areAllOntapActivating || showDismissedConfigurations) && (
                                        <>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                                {loading || !oracleCardData?.ontap_configuration?.block_two?.value ? (
                                                    <LightDisabled />
                                                ) : (
                                                    <Light />
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    color:
                                                        loading ||
                                                        !oracleCardData?.ontap_configuration?.block_two?.value
                                                            ? 'var(--text-disabled)'
                                                            : 'var(--text-button-primary)'
                                                }}
                                            >
                                                {t('databases.oracle-inner-page.view-recommendations-optimizations')}
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
                                    engineType={DBType.ORACLE}
                                    showDismissedConfigurations={showDismissedConfigurations}
                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                    driftAssessmentData={driftAssessmentData}
                                    customStyles={styles}
                                />
                            }
                        />
                    </div>
                )}

                {oracleCardData.os_configuration && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.os_configuration}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            isAllSubConfigActivating={areAllOsActivating}
                        />

                        <DsAccordion
                            id="11"
                            variant="Default"
                            isDisabled={loading || !oracleCardData?.os_configuration?.block_two?.value}
                            isExpanded={isAccordionExpanded('11', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('11', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('11')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData?.os_configuration?.tags?.map((perTag: string, index: number) => (
                                        <div
                                            className={`${showDismissedConfigurations ? styles.dismissed : ''}`}
                                            key={index}
                                        >
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    {renderPostponeActivatingInfo('os_configuration', showDismissedConfigurations)}

                                    {/* Show full ActivatingInfo if all sub-configs are activating */}
                                    {areAllOsActivating &&
                                        !showDismissedConfigurations &&
                                        renderSubConfigActivatingInfo('os')}

                                    {/* Show normal view button if not all sub-configs are activating or in dismissed view */}
                                    {(!areAllOsActivating || showDismissedConfigurations) && (
                                        <>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                                {loading || !oracleCardData?.os_configuration?.block_two?.value ? (
                                                    <LightDisabled />
                                                ) : (
                                                    <Light />
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    color:
                                                        loading || !oracleCardData?.os_configuration?.block_two?.value
                                                            ? 'var(--text-disabled)'
                                                            : 'var(--text-button-primary)'
                                                }}
                                            >
                                                {t('databases.oracle-inner-page.view-recommendations-optimizations')}
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
                                    engineType={DBType.ORACLE}
                                    showDismissedConfigurations={showDismissedConfigurations}
                                    setShowDismissedConfigurations={setShowDismissedConfigurations}
                                    driftAssessmentData={driftAssessmentData}
                                    customStyles={styles}
                                />
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageConfigurationSection;
