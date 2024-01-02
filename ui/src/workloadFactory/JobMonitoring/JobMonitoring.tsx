import { Typography } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import LineChart from '../DatabaseHomePage/LineChart/LineChart';
import styles from './JobMonitoring.module.scss';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { GENERAL } from '../../utils/appConstants';
import JobMonitoringTable from './JobMonitoringTable/JobMonitoringTable';
function JobMonitoring() {
    const navigate = useNavigate();
    return (
        <div className={styles.jobMonitoring}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: GENERAL.DATABASES,
                            onClick: () => {
                                navigate('../databases');
                            }
                        },
                        {
                            title: 'Job monitoring'
                        }
                    ]}
                />
            </div>

            <div className={styles.headingContainer}>
                <Typography variant="Regular_24" className={styles.heading}>
                    Job monitoring
                </Typography>
            </div>

            <div className={styles.overtimeJobs}>
                <div className={styles.headSection}>
                    <Typography variant="Regular_16" className={styles.title}>
                        Overtime jobs
                    </Typography>
                </div>
                <div className={styles.mainSection}>
                    <LineChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
                </div>
            </div>
            <div className={styles.tableSection}>
                <JobMonitoringTable />
            </div>
        </div>
    );
}

export default JobMonitoring;
