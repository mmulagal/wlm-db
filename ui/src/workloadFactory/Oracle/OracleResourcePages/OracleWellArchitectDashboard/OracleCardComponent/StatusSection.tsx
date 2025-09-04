import { DsFlashingDotsLoader, DsTooltipInfo, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { CONFIG_STATES, GETWELL_STATUS } from '../../../../../utils/consts';
import styles from './OracleCardComponent.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as NotActive } from '../../../../../assets/ic_not_active.svg';
import { ReactComponent as Optimized } from '../../../../../assets/optimized.svg';
import { ReactComponent as UnderProvisioned } from '../../../../../assets/under-provisioned.svg';
import { ReactComponent as InProgress } from '../../../../../assets/In Progress.svg';

const StatusSection = ({ cardData, loading, disableText }: any) => {
    const { t } = useTranslation();
    const setImage = (value: string) => {
        if (value === GETWELL_STATUS.OPTIMIZED) {
            return <Optimized />;
        }
        if (value === GETWELL_STATUS.UNDER_PROVISIONED) {
            return <UnderProvisioned />;
        }
        if (value === GETWELL_STATUS.OVER_PROVISIONED) {
            return (
                <div style={{ transform: 'rotate(180deg)' }}>
                    <UnderProvisioned />
                </div>
            );
        }
        if (value === GETWELL_STATUS.NOT_OPTIMIZED) {
            return <NotActive />;
        }
        if (value === GETWELL_STATUS.OPTIMIZING || value === GETWELL_STATUS.ANALYZING) {
            return <InProgress />;
        }
    };

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
    return (
        <DsTypography
            variant="Semibold_14"
            className={styles.titleText}
            style={{
                whiteSpace: cardData?.errorMessage ? 'unset' : 'nowrap'
            }}
        >
            {cardData?.block_two?.value && cardData?.block_two?.value !== GENERAL.UNAVAILABLE ? (
                <>
                    <span className={styles.svgSection}>
                        {setImage(cardData?.block_two?.value || t('databases.general.not-available-table-columns'))}
                    </span>
                    <span
                        className={styles.valueSection}
                        title={cardData?.block_two?.value || t('databases.general.not-available-table-columns')}
                    >
                        {cardData?.block_two?.value || t('databases.general.not-available-table-columns')}
                    </span>
                </>
            ) : (
                <>
                    {cardData?.errorMessage ? (
                        <span className={styles.warningMsg}>
                            <DsTooltipInfo trigger="hover">
                                <DsTypography variant="Regular_14">{cardData?.errorMessage}</DsTypography>
                            </DsTooltipInfo>
                            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                                {GENERAL.UNAVAILABLE}
                            </DsTypography>
                        </span>
                    ) : (
                        <DsTypography variant="Semibold_14" isDisabled={disableText}>
                            {t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    )}
                </>
            )}
        </DsTypography>
    );
};

export default StatusSection;
