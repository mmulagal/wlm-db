import { DsBarLoader, DsTypography } from '@tlveng/wlm-ds';

import { useTranslation } from 'react-i18next';
import { ReactComponent as OnboardingIllustration } from '../../../../../../assets/Onbording illustration.svg';
import styles from './ActivatingScreen.module.scss';

const ActivatingScreen = ({ dbType }: { dbType: string }) => {
    const { t } = useTranslation();
    return (
        <div className={styles.activatingScreen}>
            <div className={styles.banner}>
                <div className={styles.image}>
                    <OnboardingIllustration />
                </div>

                <div className={styles.scanSection}>
                    <DsTypography variant="Semibold_16" className={styles.scanHeading}>
                        {t('databases.log-analyzer.scan-in-progress')}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.textContent}>
                        {t('databases.log-analyzer.this-process-takes-30-minutes')}
                    </DsTypography>
                    <DsBarLoader style={{ width: '600px' }} />
                </div>
            </div>
        </div>
    );
};

export default ActivatingScreen;
