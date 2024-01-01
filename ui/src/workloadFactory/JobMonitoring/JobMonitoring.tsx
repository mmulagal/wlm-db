import { Typography } from '@netapp/design-system';
import LineChart from '../DatabaseHomePage/LineChart/LineChart';
import styles from './JobMonitoring.module.scss';
function JobMonitoring() {
    return (
        <div className={styles.jobMonitoring}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Overtime jobs
                </Typography>
            </div>
            <div className={styles.mainSection}>
                <LineChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
            </div>
        </div>
    );
}

export default JobMonitoring;
