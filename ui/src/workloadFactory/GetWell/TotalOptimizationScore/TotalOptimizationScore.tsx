import { DsTypography } from '@netapp/design-system';
import styles from './TotalOptimizationScore.module.scss';

const TotalOptimizationScore = () => {
    return (
        <div className={styles.totalOptimizationScore}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Total optimization score
                </DsTypography>
            </div>
        </div>
    );
};

export default TotalOptimizationScore;
