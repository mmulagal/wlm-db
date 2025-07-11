import { useMemo, useState } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import EstimatedCost from '../DatabaseHomePage/EstimatedCost/EstimatedCost';
import StorageSavings from '../DatabaseHomePage/StorageSavings/StorageSavings';
import styles from './Dashboard.module.scss';
import DatabaseDistribution from './DatabaseDistribution/DatabaseDistribution';
import HostDistribution from './HostDistribution/HostDistribution';
import InstanceDistribution from './InstanceDistribution/InstanceDistribution';
import ManagedInstanceOptimization from './ManagedInstanceOptimization/ManagedInstanceOptimization';
import ManagedInstanceOptimizationBreakdownByConfig from './ManagedInstanceOptimizationBreakdown/ManagedInstanceOptimizationBreakdownByConfig';

import Sandboxes from './Sandboxes/Sandboxes';
import { getTotalManagedAggrStorageSavings } from '../DatabaseHomePage/DatabaseHomeUtils';
import OptimizeByCategory from './OptimizeByCategory/OptimizeByCategory';
import NewPotentialSavings from './PotentialSavings/NewPotentialSavings';

const Dashboard = () => {
    const mssqlHostStorageSavingsData: any = useAppSelector(state => state.databaseHome.aggregatedPgsqlStorageSavings);
    const pgsqlHostStorageSavingsData: any = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);
    const hostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const [openAccordion, setOpenAccordion] = useState(false);
    const mssqlHostDataLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.fullHostDataLoading);
    const pgsqlHostDataLoading = useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts.fullHostDataLoading);
    const savingsDataLoading = useAppSelector(state => state.inventoryV2.dashSandboxSavings.loading);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const hostStorageSavingsData = useMemo(
        () => getTotalManagedAggrStorageSavings(mssqlHostStorageSavingsData, pgsqlHostStorageSavingsData),
        [mssqlHostStorageSavingsData, pgsqlHostStorageSavingsData]
    );

    return (
        <div className={styles.dashboard}>
            <div className={styles.firstSection}>
                <HostDistribution />
                <InstanceDistribution />
                <DatabaseDistribution />
            </div>

            <div className={styles.secondSection}>
                <div className={styles.subSection}>
                    <ManagedInstanceOptimization openAccordion={openAccordion} setOpenAccordion={setOpenAccordion} />
                    <OptimizeByCategory />
                </div>

                <ManagedInstanceOptimizationBreakdownByConfig openAccordion={openAccordion} />
            </div>

            <div className={styles.firstSection}>
                {/* <PotentialSavings /> */}
                {/* To enable the new potential savings widget */}
                <NewPotentialSavings />
                <Sandboxes />
            </div>

            <div className={styles.fourthLevelContainer}>
                {/* Bar lines */}
                <div className={styles.barContainer}>
                    <div className={styles.commonContainer}>
                        <StorageSavings
                            hostData={hostStorageSavingsData}
                            hostsLoading={
                                mssqlHostDataLoading || pgsqlHostDataLoading || savingsDataLoading || multiDataLoading
                            }
                        />
                    </div>

                    <div className={styles.commonContainer}>
                        <EstimatedCost
                            hostData={hostCostData}
                            hostsLoading={mssqlHostDataLoading || pgsqlHostDataLoading || multiDataLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
