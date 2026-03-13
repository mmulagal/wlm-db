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

const ApplicationSection = ({
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

    const applicationCardStates = useMemo(
        () => getOracleCardStates(oracleCardData, ['oracle_security_patch']),
        [oracleCardData]
    );

    const shouldShowHeader = useMemo(
        () => getShouldShowHeader(showDismissedConfigurations, applicationCardStates),
        [showDismissedConfigurations, applicationCardStates]
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
                        {t('databases.well-architect.application-oracle-server')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {oracleCardData?.oracle_security_patch && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.oracle_security_patch}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="oracle-security-patch-1"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.oracle_security_patch?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('oracle-security-patch-1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('oracle-security-patch-1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('oracle-security-patch-1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.oracle_security_patch?.tags?.map(
                                        (perTag: string, index: number) => (
                                            <div
                                                key={index}
                                                className={`${showDismissedConfigurations ? styles.dismissed : ''}`}
                                            >
                                                <Tag text={perTag} />
                                            </div>
                                        )
                                    )}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    {renderPostponeActivatingInfo('oracle_security_patch', showDismissedConfigurations)}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.oracle_security_patch?.block_two?.value ? (
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
                                                !oracleCardData?.oracle_security_patch?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.oracle_security_patch?.recommendation} />
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicationSection;
