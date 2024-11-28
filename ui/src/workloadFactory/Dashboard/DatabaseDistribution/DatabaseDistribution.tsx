import { DsTypography } from '@netapp/design-system';
import styles from './DatabaseDistribution.module.scss';

const DatabaseDistribution = () => {
    return (
        <div className={styles.databaseDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Database distribution
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default DatabaseDistribution;
