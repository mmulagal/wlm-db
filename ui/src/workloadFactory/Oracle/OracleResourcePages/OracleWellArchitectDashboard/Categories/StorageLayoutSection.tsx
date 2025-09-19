import { DsAccordion, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import OracleCardComponent from '../OracleCardComponent/OracleCardComponent';
import Tag from '../../../../../common/Tag/Tag';
import RecommendationText from '../../../../GetWell/RecommendationText/RecommendationText';
import { ReactComponent as Light } from '../../../../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../../../../assets/Light-Disabled.svg';
import { useAppSelector } from '../../../../../store/storeHooks';

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

    const { cardData } = useAppSelector(state => state.getWellOptimize);

    const isASMManaged = useMemo(() => cardData?.isASMManaged, [cardData]);
    const isStorageLayoutFra = useMemo(() => cardData?.isStorageLayoutFra, [cardData]);

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
                {oracleCardData?.oracle_binary_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.oracle_binary_placement} />
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

                {oracleCardData?.datafiles_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.datafiles_placement} />
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
                                    {oracleCardData.datafiles_placement?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.datafiles_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.controlfiles_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.controlfiles_placement} />
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
                                    {oracleCardData.controlfiles_placement?.tags?.map(
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
                                <RecommendationText data={oracleCardData?.controlfiles_placement?.recommendation} />
                            }
                        />
                    </div>
                )}

                {oracleCardData?.redologs_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.redologs_placement} />
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
                                    {oracleCardData.redologs_placement?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.redologs_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.templogs_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.templogs_placement} />
                        <DsAccordion
                            id="5"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('5', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('5', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('5')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.templogs_placement?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.templogs_placement?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.archive_placement && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.archive_placement} />
                        <DsAccordion
                            id="6"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('6', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('6', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('6')}
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

                {oracleCardData?.data_dg_lun_layout && isASMManaged && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.data_dg_lun_layout} />
                        <DsAccordion
                            id="7"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('7', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('7', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('7')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.data_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.data_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.log_dg_lun_layout && isASMManaged && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.log_dg_lun_layout} />
                        <DsAccordion
                            id="8"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('8', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('8', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('8')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.log_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.log_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.fra_dg_lun_layout && isASMManaged && isStorageLayoutFra && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.fra_dg_lun_layout} />
                        <DsAccordion
                            id="9"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('9', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('9', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('9')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.fra_dg_lun_layout?.tags?.map((perTag: string, index: number) => (
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
                            children={<RecommendationText data={oracleCardData?.fra_dg_lun_layout?.recommendation} />}
                        />
                    </div>
                )}

                {oracleCardData?.archivelog_dg_lun_layout && isASMManaged && !isStorageLayoutFra && (
                    <div>
                        <OracleCardComponent cardData={oracleCardData.archivelog_dg_lun_layout} />
                        <DsAccordion
                            id="12"
                            variant="Default"
                            isDisabled={false} // Todo add condition
                            isExpanded={isAccordionExpanded('12', optimizePrintState)}
                            onExpandChange={isExpanded => {
                                handleAccordionExpanded('12', isExpanded);
                            }}
                            onClick={() => setClickedAccordionId('12')}
                            title={
                                <div className={styles.tagPlacement}>
                                    {oracleCardData.archivelog_dg_lun_layout?.tags?.map(
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
