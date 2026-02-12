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
}: any) => {
    const { t } = useTranslation();

    const { cardData } = useAppSelector(state => state.getWellOptimize);

    // Helper function to calculate postpone information for configurations
    const getPostponeInfo = useMemo(() => (key: string) => calculatePostponeInfo(cardData, key), [cardData]);

    // Helper function to render PostponeInfo/ActivatingInfo based on showDismissedConfigurations
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

    // Helper function to check compute card states
    const computeCardStates = useMemo(() => {
        if (!oracleCardData) return { hasActiveCards: false, hasDismissedCards: false };

        // Define compute card keys
        const computeKeys = ['host_os_patch'];

        let hasActiveCards = false;
        let hasDismissedCards = false;

        computeKeys.forEach(key => {
            const card = oracleCardData[key];
            if (!card) return;

            const configState = card.dismissedObj?.configState;
            const hasValidAssessment = card.block_two?.value;
            const hasError = card.errorMessage;

            if (!hasValidAssessment && configState !== CONFIG_STATES.DISMISSED && hasError) {
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

    // Determine if header should be shown based on current view mode
    const shouldShowHeader = useMemo(() => {
        if (showDismissedConfigurations) {
            return computeCardStates.hasDismissedCards;
        }
        return computeCardStates.hasActiveCards;
    }, [showDismissedConfigurations, computeCardStates]);

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
                        {t('databases.oracle-inner-page.compute')}
                    </DsTypography>
                </div>
            )}

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
                                    {renderPostponeActivatingInfo('host_os_patch')}
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
