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
import { FSXN_STORAGE_PROTOCOLS, ORACLE_ISCSI_ONLY_CARD_KEYS } from '../../../../../utils/consts';

const COMPUTE_CARDS: { cardDataKey: string; accordionId: string }[] = [
    { cardDataKey: 'host_os_patch', accordionId: 'host-os-patch-1' },
    { cardDataKey: 'transparent_hugepages', accordionId: 'transparent-hugepages-1' },
    { cardDataKey: 'tcp_advanced_options', accordionId: 'tcp-advanced-options-1' },
    { cardDataKey: 'filesystems_io_options', accordionId: 'filesystems-io-options-1' },
    { cardDataKey: 'multiblock_readcount', accordionId: 'multiblock-readcount-1' }
];

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

    const { cardData, renderPostponeActivatingInfo } = useOraclePostponeInfo();

    const isIscsi = useMemo(() => cardData?.storageProtocol === FSXN_STORAGE_PROTOCOLS.ISCSI, [cardData]);

    const computeCardStates = useMemo(
        () =>
            getOracleCardStates(
                oracleCardData,
                COMPUTE_CARDS.map(c => c.cardDataKey)
            ),
        [oracleCardData]
    );

    const shouldShowHeader = useMemo(
        () => getShouldShowHeader(showDismissedConfigurations, computeCardStates),
        [showDismissedConfigurations, computeCardStates]
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
                        {t('databases.oracle-inner-page.compute')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {COMPUTE_CARDS.filter(({ cardDataKey }) => {
                    if (!oracleCardData?.[cardDataKey]) return false;
                    if ((ORACLE_ISCSI_ONLY_CARD_KEYS as readonly string[]).includes(cardDataKey)) {
                        return isIscsi;
                    }
                    return true;
                }).map(({ cardDataKey, accordionId }) => (
                    <div key={cardDataKey}>
                        <OracleCardComponent
                            cardData={oracleCardData[cardDataKey]}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id={accordionId}
                            variant="Default"
                            isDisabled={loading || showDismissedConfigurations}
                            isExpanded={isAccordionExpanded(accordionId, optimizePrintState)}
                            onExpandChange={isExpanded => handleAccordionExpanded(accordionId, isExpanded)}
                            onClick={() => setClickedAccordionId(accordionId)}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData[cardDataKey]?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo(cardDataKey, showDismissedConfigurations)}
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
                            children={<RecommendationText data={oracleCardData?.[cardDataKey]?.recommendation} />}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComputeSection;
