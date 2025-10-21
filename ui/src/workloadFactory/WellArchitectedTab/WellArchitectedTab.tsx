import styles from './WellArchitectedTab.module.scss';
import ManagedInstanceOptimization from './ManagedInstanceOptimization/ManagedInstanceOptimization';
import OptimizeByCategory from './OptimizeByCategory/OptimizeByCategory';
import ManagedInstanceOptimizationBreakdownByConfig from './ManagedInstanceOptimizationBreakdown/ManagedInstanceOptimizationBreakdownByConfig';

const WellArchitectedTab = () => (
    <div className={styles['well-architected-tab']}>
        <div className={styles.section}>
            <div className={styles.subSection}>
                <ManagedInstanceOptimization />
                <OptimizeByCategory />
            </div>

            <ManagedInstanceOptimizationBreakdownByConfig />
        </div>
    </div>
);

export default WellArchitectedTab;
