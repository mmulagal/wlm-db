import { DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByCategory.module.scss';

const ManagedInstanceOptimizationBreakdownByCategory = () => {
    return (
        <div className={styles.managedByCategory}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by category
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByCategory;
