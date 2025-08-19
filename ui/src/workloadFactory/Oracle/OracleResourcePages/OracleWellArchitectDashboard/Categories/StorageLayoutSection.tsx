import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import RecommendationText from '../../../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';

const StorageLayoutSection = ({
    styles,
    isAccordionExpanded,
    setClickedAccordionId,
    loading,
    handleAccordionExpanded,
    isDarkTheme,
    optimizePrintState,
    oracleCardData
}: any) => {
    const { t } = useTranslation();
    return (
        <div>
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

            <div className={styles.accordionGroups}>
                {oracleCardData?.redologs_temp_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.redologs_temp_placement} />
                        <DsAccordion
                            id="1"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('1', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('1', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('1')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.redologs_temp_placement?.tags?.map(
                                        (perTag: string, index: number) => (
                                            <div key={index}>
                                                <Tag text={perTag} />
                                            </div>
                                        )
                                    )}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ? <LightDisabled /> : <Light />}
                                    </div>
                                    <div
                                        style={{
                                            color: loading ? 'var(--text-disabled)' : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText data={oracleCardData?.redologs_temp_placement?.recommendation} />
                            }
                        />
                    </div>
                )}

                {oracleCardData?.archive_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.archive_placement} />
                        <DsAccordion
                            id="2"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('2', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('2', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('2')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.archive_placement?.tags?.map((perTag: string, index: number) => (
                                        <div key={index}>
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ? <LightDisabled /> : <Light />}
                                    </div>
                                    <div
                                        style={{
                                            color: loading ? 'var(--text-disabled)' : 'var(--text-button-primary)'
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

                {oracleCardData?.datafiles_controlfiles_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.datafiles_controlfiles_placement} />
                        <DsAccordion
                            id="3"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('3', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('3', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('3')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.datafiles_controlfiles_placement?.tags?.map(
                                        (perTag: string, index: number) => (
                                            <div key={index}>
                                                <Tag text={perTag} />
                                            </div>
                                        )
                                    )}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ? <LightDisabled /> : <Light />}
                                    </div>
                                    <div
                                        style={{
                                            color: loading ? 'var(--text-disabled)' : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendation')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationText
                                    data={oracleCardData?.datafiles_controlfiles_placement?.recommendation}
                                />
                            }
                        />
                    </div>
                )}

                {oracleCardData?.oracle_binary_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.oracle_binary_placement} />
                        <DsAccordion
                            id="4"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('4', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('4', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('4')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.oracle_binary_placement?.tags?.map(
                                        (perTag: string, index: number) => (
                                            <div key={index}>
                                                <Tag text={perTag} />
                                            </div>
                                        )
                                    )}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading ? <LightDisabled /> : <Light />}
                                    </div>
                                    <div
                                        style={{
                                            color: loading ? 'var(--text-disabled)' : 'var(--text-button-primary)'
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
            </div>
        </div>
    );
};

export default StorageLayoutSection;
