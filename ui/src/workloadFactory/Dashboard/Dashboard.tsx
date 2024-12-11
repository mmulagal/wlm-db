import { useMemo } from 'react';
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
    const mssqlHostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const pgsqlHostCostData: any = useAppSelector(state => state.databaseHome.aggregatedPgsqlCosts);
    const mssqlHostDataLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const pgsqlHostDataLoading = useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts.databaseHostsLoading);

    const hostCostData = useMemo(() => {
        let costData: any = {};
        Object.keys(mssqlHostCostData).map((key: string) => {
            costData[key] = (mssqlHostCostData[key] || 0) + (pgsqlHostCostData[key] || 0);
        });
        return costData;
    }, [mssqlHostCostData, pgsqlHostCostData]);

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
                        <EstimatedCost
                            hostData={hostCostData}
                            hostsLoading={mssqlHostDataLoading || pgsqlHostDataLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
