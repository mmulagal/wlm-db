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
}: OracleCategorySectionProps) => {
    const { t } = useTranslation();

    const { renderPostponeActivatingInfo } = useOraclePostponeInfo();

    const storageSizingCardStates = useMemo(
        () => getOracleCardStates(oracleCardData, ['file_system_headroom', 'swap_space']),
        [oracleCardData]
    );

    const shouldShowHeader = useMemo(
        () => getShouldShowHeader(showDismissedConfigurations, storageSizingCardStates),
        [showDismissedConfigurations, storageSizingCardStates]
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
                                    {renderPostponeActivatingInfo('file_system_headroom', showDismissedConfigurations)}
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
                                    {renderPostponeActivatingInfo('swap_space', showDismissedConfigurations)}
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
