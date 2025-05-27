import { DsTypography } from '@netapp/design-system';
import { ReactComponent as MultipleInstances } from '../../../../../../assets/Autectication.svg';
import styles from './AuthenticatedScreen.module.scss';

const AuthenticatedScreen = () => {
    return (
        <div className={styles.authScreen}>
            <div className={styles.container}>
                <div className={styles.image}>
                    <MultipleInstances />
                </div>
                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_16">All the selected instances are authenticated</DsTypography>
                    <DsTypography variant="Regular_14" className={styles.description}>
                        Continue to the next step
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default AuthenticatedScreen;
