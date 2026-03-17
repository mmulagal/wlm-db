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

const ComputeSection = ({
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

    const computeCardStates = useMemo(() => getOracleCardStates(oracleCardData, ['host_os_patch']), [oracleCardData]);

    const shouldShowHeader = useMemo(
        () => getShouldShowHeader(showDismissedConfigurations, computeCardStates),
        [showDismissedConfigurations, computeCardStates]
    );

    return (
        <div>
            {shouldShowHeader ||
                (oracleCardData?.isWad && (
                    <div className={styles['header-buttons']}>
                        <DsTypography
                            style={{
                                padding: '0 0 8px'
                            }}
                            variant="Semibold_16"
                        >
                            {t('databases.oracle-inner-page.compute')}
                        </DsTypography>
                    </div>
                ))}

            <div className={styles.accordionGroups}>
                {/* Host OS Patch Card */}
                {oracleCardData?.host_os_patch && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.host_os_patch}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="host-os-patch-1"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.host_os_patch?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('host-os-patch-1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('host-os-patch-1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('host-os-patch-1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.host_os_patch?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('host_os_patch', showDismissedConfigurations)}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.host_os_patch?.block_two?.value ? (
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
                                                !oracleCardData?.host_os_patch?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.host_os_patch?.recommendation} />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComputeSection;
