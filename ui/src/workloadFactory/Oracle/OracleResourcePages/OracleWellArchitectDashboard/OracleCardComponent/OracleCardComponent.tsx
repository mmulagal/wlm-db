import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { DsFlashingDotsLoader } from '@tlveng/wlm-ds';
import styles from './OracleCardComponent.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import StatusSection from './StatusSection';
import SectionSix from './SectionSix';
import SectionFive from './SectionFive';
import ViewAndFixButton from './ViewAndFixButton';

const OracleCardComponent = ({ cardData }: any) => {
    const { t } = useTranslation();

    const { isAssessmentAvailable, optimizePageLoading: loading } = useAppSelector(state => state.getWellOptimize);

    const [disableText, setDisableText] = useState(false);

    useEffect(() => {
        if (!loading && !isAssessmentAvailable) {
            setDisableText(true);
        } else {
            setDisableText(false);
        }
    }, [isAssessmentAvailable, loading]);

    return (
        <div className={styles['oracle-card']}>
            <div className={styles.cardContainer}>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography
                                variant="Semibold_14"
                                className={styles.labelText}
                                title={cardData?.block_one?.value || '-'}
                            >
                                {cardData?.block_one?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_one?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <StatusSection cardData={cardData} loading={loading} disableText={disableText} />
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_two?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            {loading && (
                                <div className={styles.loadingSection}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                            {!loading && (
                                <DsTypography variant="Semibold_14" className={styles.labelText}>
                                    {cardData?.block_four?.value || '-'}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_four?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <SectionFive cardData={cardData} loading={loading} disableText={disableText} />
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_five?.type}
                        </DsTypography>
                    </div>
                </div>

                {cardData?.block_one?.value !== 'ONTAP' && (
                    <div className={styles.itemContainer}>
                        <div className={styles.item}>
                            <div className={styles.summaryValue}>
                                <SectionSix cardData={cardData} loading={loading} disableText={disableText} />
                            </div>
                            <DsTypography variant="Regular_14" className={styles.descriptionText}>
                                {cardData?.block_six?.type}
                            </DsTypography>
                        </div>
                    </div>
                )}
                <ViewAndFixButton cardData={cardData} loading={loading ?? undefined} />
            </div>
        </div>
    );
};

export default OracleCardComponent;
