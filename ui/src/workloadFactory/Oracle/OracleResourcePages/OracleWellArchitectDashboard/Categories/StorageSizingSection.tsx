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

const StorageSizingSection = ({
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

    // Helper function to check storage sizing card states
    const storageSizingCardStates = useMemo(() => {
        if (!oracleCardData) return { hasActiveCards: false, hasDismissedCards: false };

        // Define storage sizing card keys
        const storageSizingKeys = ['file_system_headroom', 'swap_space'];

        let hasActiveCards = false;
        let hasDismissedCards = false;

        storageSizingKeys.forEach(key => {
            const card = oracleCardData[key];
            if (!card) return;

            const configState = card.dismissedObj?.configState;
            const hasValidAssessment = card.block_two?.value; // Check if card has actual assessment data

            // Only consider cards with valid assessment data
            if (!hasValidAssessment) return;

            // Check for active/activating cards (normal view)
            // If dismissedObj is null/undefined or configState is ACTIVE/ACTIVATING, it's an active card
            if (!configState || configState === CONFIG_STATES.ACTIVE || configState === CONFIG_STATES.ACTIVATING) {
                hasActiveCards = true;
            } else if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
                // Check for dismissed/postponed cards (dismissed view)
                hasDismissedCards = true;
            }
        });

        return { hasActiveCards, hasDismissedCards };
    }, [oracleCardData]);

    // Determine if header should be shown based on current view mode
    const shouldShowHeader = useMemo(() => {
        if (showDismissedConfigurations) {
            // In dismissed view, show header if there are dismissed/postponed cards
            return storageSizingCardStates.hasDismissedCards;
        }
        // In normal view, show header if there are active/activating cards
        return storageSizingCardStates.hasActiveCards;
    }, [showDismissedConfigurations, storageSizingCardStates]);

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
                        {t('databases.oracle-inner-page.storage-sizing')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {/* File System Headroom Card */}
                {oracleCardData?.file_system_headroom && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.file_system_headroom}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="storage-sizing-1"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.file_system_headroom?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('storage-sizing-1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('storage-sizing-1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('storage-sizing-1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.file_system_headroom?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('file_system_headroom')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.file_system_headroom?.block_two?.value ? (
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
                                                !oracleCardData?.file_system_headroom?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.file_system_headroom?.recommendation} />
                            }
                        />
                    </div>
                )}

                {/* Swap Space Card */}
                {oracleCardData?.swap_space && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.swap_space}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="storage-sizing-2"
                            variant="Default"
                            isDisabled={
                                loading || showDismissedConfigurations || !oracleCardData?.swap_space?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('storage-sizing-2', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('storage-sizing-2', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('storage-sizing-2')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.swap_space?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('swap_space')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.swap_space?.block_two?.value ? (
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
                                                !oracleCardData?.swap_space?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.swap_space?.recommendation} />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageSizingSection;
