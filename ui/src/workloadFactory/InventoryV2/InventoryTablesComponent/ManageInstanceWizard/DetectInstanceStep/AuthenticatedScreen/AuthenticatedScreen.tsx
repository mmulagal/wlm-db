import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MultipleInstances } from '../../../../../../assets/Autectication.svg';
import styles from './AuthenticatedScreen.module.scss';

const AuthenticatedScreen = () => {
    const { t } = useTranslation();
    return (
        <div className={styles.authScreen}>
            <div className={styles.container}>
                <div className={styles.image}>
                    <MultipleInstances />
                </div>
                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_16">
                        {t('databases.register-flow.authenticated-page-content1')}
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={styles.description}>
                        {t('databases.register-flow.authenticated-page-content2')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default AuthenticatedScreen;
