import { useEffect, useState } from 'react';

import styles from './DatabaseHomePage.module.scss';

import StorageSavings from './StorageSavings/StorageSavings';
import EstimatedCost from './EstimatedCost/EstimatedCost';
import ProtectionSection from './ProtectSection/ProtectionSection';
import JobStatus from './JobStatus/JobStatus';
import { useAppSelector } from '../../store/storeHooks';
import DashboardSummary from './DashboardSummary/DashboardSummary';
import DashboardRibbon from './DashboardRibbon/DashboardRibbon';
import DashboardSandbox from './DashboardSandbox/DashboardSandbox';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const hostStorageSavingsData: any = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);
    const hostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const databaseHostsLoadingV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const fullHostDataLoadingV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.fullHostDataLoading);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(databaseHostsLoading || fullHostDataLoading || databaseHostsLoadingV2 || fullHostDataLoadingV2);
    }, [databaseHostsLoading, fullHostDataLoading, databaseHostsLoadingV2, fullHostDataLoadingV2]);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className={styles.databaseHome}>
            <div className={styles.leftSide}>
                <div className={styles.secondLevelContainer}>
                    <DashboardSummary />
                </div>

                <DashboardRibbon />

                <div className={styles.fourthLevelContainer}>
                    {/* Bar lines */}
                    <div className={styles.barContainer}>
                        <div className={styles.commonContainer}>
                            <StorageSavings hostData={hostStorageSavingsData} hostsLoading={loading} />
                        </div>

                        <div className={styles.commonContainer}>
                            <EstimatedCost hostData={hostCostData} hostsLoading={loading} />
                        </div>
                    </div>
                </div>

                <div className={styles.thirdLevelContainer}>
                    <div className={styles.ProtectionContainer}>
                        <ProtectionSection />
                    </div>

                    {/* Job status */}
                    <div className={styles.sandBoxContainer}>
                        <DashboardSandbox />
                    </div>
                </div>

                {/* Job status */}
                <div className={styles.jobContainer}>
                    <JobStatus />
                </div>
            </div>

            {/* <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} /> */}
        </div>
    );
};

export default DatabaseHomePage;
