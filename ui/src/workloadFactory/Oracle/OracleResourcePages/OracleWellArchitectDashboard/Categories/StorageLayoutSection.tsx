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
import { CONFIG_STATES, FSXN_STORAGE_PROTOCOLS } from '../../../../../utils/consts';

const StorageLayoutSection = ({
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

    const isASMManaged = useMemo(() => cardData?.isASMManaged, [cardData]);
    const isIscsi = useMemo(() => cardData?.storageProtocol === FSXN_STORAGE_PROTOCOLS.ISCSI, [cardData]);
    const isStorageLayoutFra = useMemo(() => cardData?.isStorageLayoutFra, [cardData]);

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

    // Helper function to check storage layout card states
    const storageLayoutCardStates = useMemo(() => {
        if (!oracleCardData) return { hasActiveCards: false, hasDismissedCards: false };

        // Define all storage layout card keys
        const storageLayoutKeys = [
            'oracle_binary_placement',
            'datafiles_placement',
            'controlfiles_placement',
            'redologs_placement',
            'templogs_placement',
            'archive_placement',
            'data_dg_lun_layout',
            'log_dg_lun_layout',
            'fra_dg_lun_layout',
            'archivelog_dg_lun_layout'
        ];

        let hasActiveCards = false;
        let hasDismissedCards = false;

        storageLayoutKeys.forEach(key => {
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
            }

            // Check for dismissed/postponed cards (dismissed view)
            if (configState === CONFIG_STATES.DISMISSED || configState === CONFIG_STATES.POSTPONED) {
                hasDismissedCards = true;
            }
        });

        return { hasActiveCards, hasDismissedCards };
    }, [oracleCardData]);

    // Determine if header should be shown based on current view mode
    const shouldShowHeader = useMemo(() => {
        if (showDismissedConfigurations) {
            // In dismissed view, show header if there are dismissed/postponed cards
            return storageLayoutCardStates.hasDismissedCards;
        }
        // In normal view, show header if there are active/activating cards
        return storageLayoutCardStates.hasActiveCards;
    }, [showDismissedConfigurations, storageLayoutCardStates]);

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
                        {t('databases.oracle-inner-page.storage-layout')}
                    </DsTypography>
                </div>
            )}

            <div className={styles.accordionGroups}>
                {oracleCardData?.oracle_binary_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.oracle_binary_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="1"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.oracle_binary_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.oracle_binary_placement?.tags?.map(
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
                                    {renderPostponeActivatingInfo('oracle_binary_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.oracle_binary_placement?.block_two?.value ? (
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
                                                !oracleCardData?.oracle_binary_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.oracle_binary_placement?.recommendation} />
                            }
                        />
                    </div>
                )}

                {oracleCardData?.datafiles_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.datafiles_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="2"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.datafiles_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('2', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('2', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('2')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.datafiles_placement?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('datafiles_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.datafiles_placement?.block_two?.value ? (
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
                                                !oracleCardData?.datafiles_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.datafiles_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.controlfiles_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.controlfiles_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="3"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.controlfiles_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('3', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('3', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('3')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.controlfiles_placement?.tags?.map(
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
                                    {renderPostponeActivatingInfo('controlfiles_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.controlfiles_placement?.block_two?.value ? (
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
                                                !oracleCardData?.controlfiles_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.controlfiles_placement?.recommendation} />
                            }
                        />
                    </div>
                )}

                {oracleCardData?.redologs_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.redologs_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="4"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.redologs_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('4', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('4', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('4')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.redologs_placement?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('redologs_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.redologs_placement?.block_two?.value ? (
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
                                                !oracleCardData?.redologs_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.redologs_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.templogs_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.templogs_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="5"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.templogs_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('5', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('5', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('5')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.templogs_placement?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('templogs_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.templogs_placement?.block_two?.value ? (
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
                                                !oracleCardData?.templogs_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.templogs_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.archive_placement && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.archive_placement}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="6"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.archive_placement?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('6', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('6', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('6')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.archive_placement?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('archive_placement')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.archive_placement?.block_two?.value ? (
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
                                                !oracleCardData?.archive_placement?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.archive_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.data_dg_lun_layout && isASMManaged && isIscsi && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.data_dg_lun_layout}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="7"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.data_dg_lun_layout?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('7', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('7', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('7')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.data_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('data_dg_lun_layout')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.data_dg_lun_layout?.block_two?.value ? (
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
                                                !oracleCardData?.data_dg_lun_layout?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.data_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.log_dg_lun_layout && isASMManaged && isIscsi && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.log_dg_lun_layout}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="8"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.log_dg_lun_layout?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('8', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('8', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('8')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.log_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('log_dg_lun_layout')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.log_dg_lun_layout?.block_two?.value ? (
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
                                                !oracleCardData?.log_dg_lun_layout?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.log_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.fra_dg_lun_layout && isASMManaged && isStorageLayoutFra && isIscsi && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.fra_dg_lun_layout}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="9"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.fra_dg_lun_layout?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('9', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('9', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('9')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.fra_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                                    {renderPostponeActivatingInfo('fra_dg_lun_layout')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.fra_dg_lun_layout?.block_two?.value ? (
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
                                                !oracleCardData?.fra_dg_lun_layout?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationText data={oracleCardData?.fra_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.archivelog_dg_lun_layout && isASMManaged && isIscsi && !isStorageLayoutFra && (
                    <div>
                        <OracleCardComponent
                            cardData={oracleCardData.archivelog_dg_lun_layout}
                            showDismissedConfigurations={showDismissedConfigurations}
                            setShowDismissedConfigurations={setShowDismissedConfigurations}
                            driftAssessmentData={driftAssessmentData}
                        />
                        <DsAccordion
                            id="12"
                            variant="Default"
                            isDisabled={
                                loading ||
                                showDismissedConfigurations ||
                                !oracleCardData?.archivelog_dg_lun_layout?.block_two?.value
                            }
                            isExpanded={isAccordionExpanded('12', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('12', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('12')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.archivelog_dg_lun_layout?.tags?.map(
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
                                    {renderPostponeActivatingInfo('archivelog_dg_lun_layout')}
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ||
                                        showDismissedConfigurations ||
                                        !oracleCardData?.archivelog_dg_lun_layout?.block_two?.value ? (
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
                                                !oracleCardData?.archivelog_dg_lun_layout?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.archivelog_dg_lun_layout?.recommendation} />
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageLayoutSection;
