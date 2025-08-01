import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { Button } from '@netapp/design-system';
import styles from './ProtectionDialogs.module.scss';

const NoAgentDialog = () => {
    const { t } = useTranslation();

    const learnMore = () => {
        window.open(
            'https://docs.netapp.com/us-en/bluexp-setup-admin/concept-connectors.html',
            '_blank',
            'noopener,noreferrer'
        );
    };
    return (
        <div className={styles.protectionDialogs}>
            <div className={styles.topSection}>
                <DsTypography variant="Semibold_14">{t('databases.inventory.redirect-to-netapp')}</DsTypography>
                <DsTypography variant="Regular_14">{t('databases.inventory.top-section-text')}</DsTypography>
            </div>

            <div className={styles.midSection}>
                <DsTypography variant="Semibold_14">{t('databases.inventory.agent-req')}</DsTypography>
                <DsTypography variant="Regular_14">{t('databases.inventory.agent-req-text')}</DsTypography>
                <Button variant="link" onClick={learnMore}>
                    {t('databases.inventory.learn-about-bxp-connectors')}
                </Button>
            </div>

            <div className={styles.bottomSection}>
                <DsTypography variant="Semibold_14">{t('databases.inventory.steps-to-follow')}</DsTypography>
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
                        <DsTypography variant="Regular_14">{t('databases.inventory.point-2-text')}</DsTypography>
                    </div>
                </div>

                <div className={styles.row} style={{ marginTop: '8px' }}>
                    <div className={styles.item}>
                        <DsTypography variant="Semibold_14">3 |</DsTypography>
                        <DsTypography variant="Semibold_14">{t('databases.inventory.assign-policy')}</DsTypography>
                    </div>
                    <div className={styles.item}>
                        <div className={styles.extraSpace} />
                        <DsTypography variant="Regular_14">{t('databases.inventory.point-3-text')}</DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NoAgentDialog;
