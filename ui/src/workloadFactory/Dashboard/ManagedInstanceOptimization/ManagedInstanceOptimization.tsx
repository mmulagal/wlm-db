import { DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimization.module.scss';

const ManagedInstanceOptimization = () => {
    return (
        <div className={styles.managedInstance}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization score
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default ManagedInstanceOptimization;
