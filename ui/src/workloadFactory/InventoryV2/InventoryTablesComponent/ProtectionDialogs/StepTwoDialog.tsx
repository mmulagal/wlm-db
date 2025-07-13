import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import styles from './ProtectionDialogs.module.scss';
import { ReactComponent as Complete } from '../../../../assets/complete-tick.svg';

const StepTwoDialog = () => {
    const { t } = useTranslation();
    return (
        <div className={styles.stepTwo}>
            <div className={styles.topSection}>
                <div className={styles.circleClass}>
                    <Complete />
                </div>
                <DsTypography variant="Semibold_14">{t('databases.inventory.protection-for-data')}</DsTypography>
            </div>

            <div className={styles.bottomSection}>
                <DsTypography variant="Semibold_14">{t('databases.inventory.next-steps')}</DsTypography>
                <div className={styles.row} style={{ marginTop: '16px' }}>
                    <div className={styles.item}>
                        <DsTypography variant="Semibold_14">1 |</DsTypography>
                        <DsTypography variant="Semibold_14">{t('databases.inventory.click-redirect')}</DsTypography>
                    </div>
                    <div className={styles.item}>
                        <div className={styles.extraSpace} />
                        <DsTypography variant="Regular_14">{t('databases.inventory.point-1-text')}</DsTypography>
                    </div>
                </div>

                <div className={styles.row} style={{ marginTop: '8px' }}>
                    <div className={styles.item}>
                        <DsTypography variant="Semibold_14">2 |</DsTypography>
                        <DsTypography variant="Semibold_14">{t('databases.inventory.add-agent')}</DsTypography>
                    </div>
                    <div className={styles.item}>
                        <div className={styles.extraSpace} />
                        <DsTypography variant="Semibold_14">{t('databases.inventory.assign-policy')}</DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StepTwoDialog;
