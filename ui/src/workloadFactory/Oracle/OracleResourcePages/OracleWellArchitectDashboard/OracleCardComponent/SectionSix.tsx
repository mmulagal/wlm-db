import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import styles from './OracleCardComponent.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { CONFIG_STATES } from '../../../../../utils/consts';

const SectionSix = ({ cardData, loading, disableText }: any) => {
    if (loading) {
        return (
            <div className={styles.loadingSection}>
                <DsFlashingDotsLoader />
            </div>
        );
    }
    if (cardData?.dismissedObj?.configState && cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVE) {
        // Condition to show n/a if state is not active
        return (
            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                {GENERAL.NOT_AVAILABLE}
            </DsTypography>
        );
    }
    if (cardData?.block_six?.count) {
        return (
            <div className={styles.warningMsg}>
                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                    {cardData?.block_six?.count?.totalObjectsInViolation || 0}
                </DsTypography>
                <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                    {' out of '}
                </DsTypography>
                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                    {cardData?.block_six?.count?.totalObjectsAssessed || 0}
                </DsTypography>
            </div>
        );
    }

    if (cardData?.block_six?.smallFont || !cardData?.block_six?.value) {
        return (
            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
            </DsTypography>
        );
    }
    return (
        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
            {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
        </DsTypography>
    );
};

export default SectionSix;
