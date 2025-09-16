import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';
import { DBType, WLF_TABS } from '../../../../../utils/consts';
import { useAppSelector } from '../../../../../store/storeHooks';
import RecommendationTableOracle from '../../../../GetWell/RecommendationTable/RecommendationTableOracle';

const StorageConfigurationSection = ({
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
    const { ontapConfigTableData, osConfigTableData } = useAppSelector(state => state.getWellOptimize);
    return (
        <div>
            <div className={styles['header-buttons']}>
                <DsTypography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                >
                    {t('databases.oracle-inner-page.storage-configuration')}
                </DsTypography>
            </div>

            <div className={styles.accordionGroups}>
                {oracleCardData.ontap_configuration && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.ontap_configuration} />

                        <DsAccordion
                            id="10"
                            variant="Default"
                            isDisabled={loading || !oracleCardData?.ontap_configuration?.block_two?.value}
                            isExpanded={isAccordionExpanded('10', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('10', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('10')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData?.ontap_configuration?.tags?.map((perTag: string, index: number) => (
                                        <div key={index}>
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading || !oracleCardData?.ontap_configuration?.block_two?.value ? (
                                            <LightDisabled />
                                        ) : (
                                            <Light />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            color:
                                                loading || !oracleCardData?.ontap_configuration?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendations-optimizations')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationTableOracle
                                    tableData={ontapConfigTableData}
                                    isLoading={loading}
                                    optimizePrintState={optimizePrintState}
                                    from={WLF_TABS.INVENTORY}
                                    engineType={DBType.ORACLE}
                                />
                            }
                        />
                    </div>
                )}

                {oracleCardData.os_configuration && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.os_configuration} />

                        <DsAccordion
                            id="11"
                            variant="Default"
                            isDisabled={loading || !oracleCardData?.os_configuration?.block_two?.value}
                            isExpanded={isAccordionExpanded('11', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('11', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('11')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData?.os_configuration?.tags?.map((perTag: string, index: number) => (
                                        <div key={index}>
                                            <Tag text={perTag} />
                                        </div>
                                    ))}
                                </div>
                            }
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
                                        {loading || !oracleCardData?.os_configuration?.block_two?.value ? (
                                            <LightDisabled />
                                        ) : (
                                            <Light />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            color:
                                                loading || !oracleCardData?.os_configuration?.block_two?.value
                                                    ? 'var(--text-disabled)'
                                                    : 'var(--text-button-primary)'
                                        }}
                                    >
                                        {t('databases.oracle-inner-page.view-recommendations-optimizations')}
                                    </div>
                                </div>
                            ]}
                            children={
                                <RecommendationTableOracle
                                    tableData={osConfigTableData}
                                    isLoading={loading}
                                    optimizePrintState={optimizePrintState}
                                    from={WLF_TABS.INVENTORY}
                                    engineType={DBType.ORACLE}
                                />
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageConfigurationSection;
