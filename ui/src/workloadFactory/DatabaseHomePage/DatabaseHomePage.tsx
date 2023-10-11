import { Button, Typography } from '@netapp/design-system';
import { useState } from 'react';
import { GENERAL } from '../../utils/appConstants';
import styles from './DatabaseHomePage.module.scss';
import Sidebar from './Sidebar/Sidebar';
import DatabaseHost from './DatabaseHost/DatabaseHost';
import DatabaseTable from './DatabaseTable/DatabaseTable';
import StorageSavings from './StorageSavings/StorageSavings';
import EstimatedCost from './EstimatedCost/EstimatedCost';
import MultiRingDoughnut from './MultiRingDoughnut/MultiRingDoughnut';
import ProtectionSection from './ProtectSection/ProtectionSection';
import JobStatus from './JobStatus/JobStatus';
import DatabaseHomeApis from './DatabaseHomeApis';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    DatabaseHomeApis();

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };
    
    return (
        <div className={styles.databaseHome}>
            <div className={styles.leftSide}>
                <div className={styles.topContainer}>
                    <Typography variant="Regular_24" className={styles.heading}>
                        {GENERAL.DATABASES}
                    </Typography>
                    <div>
                        <Button variant="primary">Deploy new database</Button>
                    </div>
                </div>

                <div className={styles.secondLevelContainer}>
                    <DatabaseHost />
                </div>
                <div className={styles.ProtectionContainer}>
                    <ProtectionSection />
                </div>

                <div className={styles.fourthLevelContainer}>
                    {/* Bar lines */}
                    <div className={styles.barContainer}>
                        <div className={styles.commonContainer}>
                            <StorageSavings />
                        </div>

                        <div className={styles.commonContainer}>
                            <EstimatedCost />
                        </div>
                    </div>

                    {/* Job status */}
                    <div className={styles.jobContainer}>
                        <JobStatus />
                    </div>
                </div>
                <div className={styles.secondLevelContainer}>
                    <DatabaseTable />
                </div>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
        </div>
    );
};

export default DatabaseHomePage;
