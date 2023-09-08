import { Typography } from '@netapp/design-system';
import { useState } from 'react';
import { GENERAL } from '../../utils/appConstants';
import DatabaseActions from './DatabaseActions/DatabaseActions';
import DatabaseAWSIntegration from './DatabaseAWSIntegration/DatabaseAWSIntegration';
import styles from './DatabaseHomePage.module.scss';
import Sidebar from './Sidebar/Sidebar';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };
    return (
        <div className={styles.databaseHome}>
            <Typography variant="Regular_24" className={styles.heading}>
                {GENERAL.DATABASES}
            </Typography>
            <div className={styles.secondLevelContainer}>
                <DatabaseActions />
                <DatabaseAWSIntegration />
            </div>
            <div className={styles.thirdLevelContainer}></div>

            <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
        </div>
    );
};

export default DatabaseHomePage;
