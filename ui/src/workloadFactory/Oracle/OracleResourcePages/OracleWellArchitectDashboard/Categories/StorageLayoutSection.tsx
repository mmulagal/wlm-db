import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import { oracleCardData } from '../OracleWellArchitectedUtils';
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
    optimizePrintState
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
                <div>
                    <OracleCardComponent cardData={oracleCardData.user_data_files} />
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
                                {oracleCardData.user_data_files?.tags?.map((perTag: string, index: number) => (
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
                        children={<RecommendationText data={oracleCardData?.user_data_files?.recommendation} />}
                    />
                </div>

                <div>
                    <OracleCardComponent cardData={oracleCardData.transaction_log_files} />
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
                                {oracleCardData.transaction_log_files?.tags?.map((perTag: string, index: number) => (
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
                        children={<RecommendationText data={oracleCardData?.transaction_log_files?.recommendation} />}
                    />
                </div>

                <div>
                    <OracleCardComponent cardData={oracleCardData.tempdb_files} />
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
                                {oracleCardData.tempdb_files?.tags?.map((perTag: string, index: number) => (
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
                        children={<RecommendationText data={oracleCardData?.tempdb_files?.recommendation} />}
                    />
                </div>
            </div>
        </div>
    );
};

export default StorageLayoutSection;
