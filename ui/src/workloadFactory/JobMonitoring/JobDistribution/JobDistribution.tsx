import { Typography } from '@netapp/design-system';
import styles from './JobDistribution.module.scss';
import JobDoughnutChart from '../../DatabaseHomePage/JobStatus/JobDoughnut/JobDoughnutChart';

const JobDistribution = () => {
    return (
        <div className={styles.jobDistribution}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Job Distributions
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart />
            </div>
        </div>
    );
};

export default JobDistribution;
