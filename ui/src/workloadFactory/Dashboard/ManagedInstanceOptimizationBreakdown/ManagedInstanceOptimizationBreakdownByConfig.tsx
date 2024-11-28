import { DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';

const ManagedInstanceOptimizationBreakdownByConfig = () => {
    return (
        <div className={styles.managedBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
