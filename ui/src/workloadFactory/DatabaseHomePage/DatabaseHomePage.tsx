import { Typography } from '@netapp/design-system';
import { useState } from 'react';
import { GENERAL } from '../../utils/appConstants';
import styles from './DatabaseHomePage.module.scss';
import Sidebar from './Sidebar/Sidebar';
import DatabaseHost from './DatabaseHost/DatabaseHost';
import DatabaseTable from './DatabaseTable/DatabaseTable';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };
    return (
        <div className={styles.databaseHome}>
            <div className={styles.leftSide}>
                <Typography variant="Regular_24" className={styles.heading}>
                    {GENERAL.DATABASES}
                </Typography>
                <div className={styles.secondLevelContainer}>
                    <DatabaseHost />
                </div>
                {/* <div className={styles.ProtectionContainer}></div> */}

                <div className={styles.fourthLevelContainer}>
                    {/* Bar lines */}
                    {/* <div className={styles.barContainer}>
                        <div className={styles.commonContainer}></div>

                        <div className={styles.commonContainer}></div>
                    </div> */}

                    {/* Job status */}
                    {/* <div className={styles.jobContainer}></div> */}
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
