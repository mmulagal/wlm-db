import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import RecommendationText from '../../../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';
import { useAppSelector } from '../../../../../store/storeHooks';
import { ActivatingInfo, PostponeInfo, calculatePostponeInfo } from '../../../../GetWell/GetWellHelper';
import { CONFIG_STATES } from '../../../../../utils/consts';

const ResiliencySection = ({
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
}: any) => {
    const { t } = useTranslation();

    const { cardData } = useAppSelector(state => state.getWellOptimize);

    const getPostponeInfo = useMemo(() => (key: string) => calculatePostponeInfo(cardData, key), [cardData]);

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

    const resiliencyCardStates = useMemo(() => {
        if (!oracleCardData) return { hasActiveCards: false, hasDismissedCards: false };

        const resiliencyKeys = ['crr'];

        let hasActiveCards = false;
        let hasDismissedCards = false;

        resiliencyKeys.forEach(key => {
            const card = oracleCardData[key];
            if (!card) return;

            const configState = card.dismissedObj?.configState;
            const hasValidAssessment = card.block_two?.value;

            if (!hasValidAssessment && configState !== CONFIG_STATES.DISMISSED) {
                hasActiveCards = true;
            }

            if (!hasValidAssessment) return;

            if (!configState || configState === CONFIG_STATES.ACTIVE || configState === CONFIG_STATES.ACTIVATING) {
                hasActiveCards = true;
            } else if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
                hasDismissedCards = true;
            }
        });

        return { hasActiveCards, hasDismissedCards };
    }, [oracleCardData]);

    const shouldShowHeader = useMemo(() => {
        if (showDismissedConfigurations) {
            return resiliencyCardStates.hasDismissedCards;
        }
        return resiliencyCardStates.hasActiveCards;
    }, [showDismissedConfigurations, resiliencyCardStates]);

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
                        {t('databases.oracle-inner-page.resiliency')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {oracleCardData?.crr && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.crr}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="crr-1"
                            variant="Default"
                            isDisabled={
                                loading || showDismissedConfigurations || !oracleCardData?.crr?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('crr-1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('crr-1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('crr-1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.crr?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('crr')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.crr?.block_two?.value ? (
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
                                                !oracleCardData?.crr?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.crr?.recommendation} />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResiliencySection;
