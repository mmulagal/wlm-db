import { Typography } from '@netapp/design-system';
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
import { useGetStatusQuery } from '../../utils/apiService';
import { useNavigate } from 'react-router-dom';

const DatabaseHomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [statusChk, setStatusChk] = useState(false);

    const navigate = useNavigate();
    
    const {
        data: statusData,
        isFetching: statusLoading,
        isError: statusError
    } = useGetStatusQuery('');

    useEffect(() => {
        if(statusData && statusData?.isActive) {
            setStatusChk(true);
        } else {
            setStatusChk(false);
            navigate("https://workloads.netapp.com/database-workloads?hs_preview=YHevsPEM-140577339549");
        }
    }, [statusData]);

    DatabaseHomeApis();

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        statusLoading ? <div>Loading...</div> :
        (statusChk && 
        <div className={styles.databaseHome}>
            <div className={styles.leftSide}>
                <div className={styles.topContainer}>
                    <Typography variant="Regular_24" className={styles.heading}>
                        {GENERAL.DATABASES}
                    </Typography>
                    <div>
                        <TopBarButton />
                    </div>
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
                            <StorageSavings />
                        </div>

                        <div className={styles.commonContainer}>
                            <EstimatedCost />
                        </div>
                    </div>
                </div>
                <div className={styles.secondLevelContainer}>
                    <DatabaseTable />
                </div>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
        </div>)
    );
};

export default DatabaseHomePage;
