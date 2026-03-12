import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './OracleCardComponent.module.scss';

const SectionFive = ({ cardData, loading, disableText }: any) => {
    const { t } = useTranslation();

    if (loading) {
        return (
            <div className={styles.loadingSection}>
                <DsFlashingDotsLoader />
            </div>
        );
    }
    if (cardData?.block_five?.count) {
        return (
            <DsTypography
                variant="Semibold_14"
                title={`${cardData?.block_five?.count?.totalObjectsInViolation || 0} out of ${
                    cardData?.block_five?.count?.totalObjectsAssessed || 0
                }`}
                className={`${styles.titleText} ${styles.centerTextContainer}`}
            >
                <span>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_five?.count?.totalObjectsInViolation || 0}
                    </DsTypography>
                </span>
                <span>
                    <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                        {' out of '}
                    </DsTypography>
                </span>
                <span>
                    <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                        {cardData?.block_five?.count?.totalObjectsAssessed || 0}
                    </DsTypography>
                </span>
            </DsTypography>
        );
    }
    return (
        <DsTypography
            variant="Semibold_14"
            title={cardData?.block_five?.value || t('databases.general.not-available-table-columns')}
            isDisabled={disableText}
            className={styles.titleText}
        >
            {cardData?.block_five?.value || t('databases.general.not-available-table-columns')}
        </DsTypography>
    );
};

export default SectionFive;
