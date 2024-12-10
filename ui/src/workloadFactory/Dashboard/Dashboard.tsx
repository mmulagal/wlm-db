import { useAppSelector } from '../../store/storeHooks';
import EstimatedCost from '../DatabaseHomePage/EstimatedCost/EstimatedCost';
import StorageSavings from '../DatabaseHomePage/StorageSavings/StorageSavings';
import styles from './Dashboard.module.scss';
import DatabaseDistribution from './DatabaseDistribution/DatabaseDistribution';
import HostDistribution from './HostDistribution/HostDistribution';
import InstanceDistribution from './InstanceDistribution/InstanceDistribution';
import ManagedInstanceOptimization from './ManagedInstanceOptimization/ManagedInstanceOptimization';
import ManagedInstanceOptimizationBreakdownByConfig from './ManagedInstanceOptimizationBreakdown/ManagedInstanceOptimizationBreakdownByConfig';
import ManagedInstanceOptimizationBreakdownByCategory from './ManagedInstanceOptimizationBreakdownByCategory/ManagedInstanceOptimizationBreakdownByCategory';
import PotentialSavings from './PotentialSavings/PotentialSavings';
import Sandboxes from './Sandboxes/Sandboxes';

const Dashboard = () => {
    const hostStorageSavingsData: any = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);
    const hostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    return (
        <div className={styles.dashboard}>
            <div className={styles.firstSection}>
                <HostDistribution />
                <InstanceDistribution />
                <DatabaseDistribution />
            </div>

            <div className={styles.secondSection}>
                <div className={styles.subSection}>
                    <ManagedInstanceOptimization />
                    <ManagedInstanceOptimizationBreakdownByCategory />
                </div>

                <ManagedInstanceOptimizationBreakdownByConfig />
            </div>

            <div className={styles.firstSection}>
                <PotentialSavings />
                <Sandboxes />
            </div>

            <div className={styles.fourthLevelContainer}>
                {/* Bar lines */}
                <div className={styles.barContainer}>
                    <div className={styles.commonContainer}>
                        <StorageSavings hostData={hostStorageSavingsData} hostsLoading={false} />
                    </div>

                    <div className={styles.commonContainer}>
                        <EstimatedCost hostData={hostCostData} hostsLoading={false} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
