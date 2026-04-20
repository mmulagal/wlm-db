import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import RecommendationText from '../../../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';
import useOraclePostponeInfo from '../OraclePostponeActivatingInfo';
import { getOracleCardStates, getShouldShowHeader, OracleCategorySectionProps } from '../../../../GetWell/GetWellUtils';

const CloningSection = ({
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

    const { renderPostponeActivatingInfo } = useOraclePostponeInfo();

    const cloningCardStates = useMemo(
        () => getOracleCardStates(oracleCardData, ['clone_management']),
        [oracleCardData]
    );

    const shouldShowHeader = useMemo(
        () => getShouldShowHeader(showDismissedConfigurations, cloningCardStates),
        [showDismissedConfigurations, cloningCardStates]
    );

    return (
        <div>
            {shouldShowHeader && (
                <div className={styles['header-buttons']}>
                    <DsTypography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                    >
                        {t('databases.oracle-inner-page.cloning')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {oracleCardData?.clone_management && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.clone_management}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="clone_management-1"
                            variant="Default"
                            isDisabled={loading || showDismissedConfigurations}
                            isExpanded={isAccordionExpanded('clone_management-1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('clone_management-1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('clone_management-1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.clone_management?.tags?.map((perTag: string, index: number) => (
                                        <div
                                            key={index}
                                            className={`${showDismissedConfigurations ? styles.dismissed : ''}`}
                                        >
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    {renderPostponeActivatingInfo('clone_management', showDismissedConfigurations)}

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
                            children={<RecommendationText data={oracleCardData?.clone_management?.recommendation} />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloningSection;
