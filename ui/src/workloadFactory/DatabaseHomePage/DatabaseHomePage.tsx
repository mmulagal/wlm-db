import { Spinner, Typography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../utils/appConstants';
import styles from './DatabaseHomePage.module.scss';
import Sidebar from './Sidebar/Sidebar';
import DatabaseHost from './DatabaseHost/DatabaseHost';
import DatabaseTable from './DatabaseTable/DatabaseTable';
import StorageSavings from './StorageSavings/StorageSavings';
import EstimatedCost from './EstimatedCost/EstimatedCost';
import ProtectionSection from './ProtectSection/ProtectionSection';
import JobStatus from './JobStatus/JobStatus';
import DatabaseHomeApis from './DatabaseHomeApis';
import TopBarButton from './TopBarButton/TopBarButton';
import { MARKETING_PAGE_URL } from '../../utils/consts';
import { useAppSelector } from '../../store/storeHooks';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const hostStorageSavingsData: any = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);
    const hostCostData: any = useAppSelector(state => state.databaseHome.aggregatedCosts);
    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);

    DatabaseHomeApis();

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className={styles.databaseHome}>
            <div className={styles.leftSide}>
                <div className={styles.buttonsContainer}>
                    <TopBarButton />
                </div>

                <div className={styles.secondLevelContainer}>
                    <DatabaseHost />
                </div>

                <div className={styles.thirdLevelContainer}>
                    <div className={styles.ProtectionContainer}>
                        <ProtectionSection />
                    </div>

                    {/* Job status */}
                    <div className={styles.jobContainer}>
                        <JobStatus />
                    </div>
                </div>

                <div className={styles.fourthLevelContainer}>
                    {/* Bar lines */}
                    <div className={styles.barContainer}>
                        <div className={styles.commonContainer}>
                            <StorageSavings hostData={hostStorageSavingsData} hostsLoading={databaseHostsLoading} />
                        </div>

                        <div className={styles.commonContainer}>
                            <EstimatedCost hostData={hostCostData} hostsLoading={databaseHostsLoading} />
                        </div>
                    </div>
                </div>
                {/*<div className={styles.secondLevelContainer}>
                    <DatabaseTable />
                </div> */}
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
        </div>
    );
};

export default DatabaseHomePage;
