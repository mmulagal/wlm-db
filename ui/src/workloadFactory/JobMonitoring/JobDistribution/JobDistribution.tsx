import { Typography } from '@netapp/design-system';
import styles from './JobDistribution.module.scss';

const JobDistribution = () => {
    return (
        <div className={styles.jobDistribution}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    Job Distributions
                </Typography>
            </div>
        </div>
    );
};

export default JobDistribution;
