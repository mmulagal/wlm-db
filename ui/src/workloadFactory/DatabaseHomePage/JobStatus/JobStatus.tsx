import { Typography } from '@netapp/design-system';
import styles from './JobStatus.module.scss';
import JobDoughnutChart from './JobDoughnut/JobDoughnutChart';

const JobStatus = () => {
    return (
        <div className={styles.jobStatus}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">Job status</Typography>
                <Typography variant="Regular_13" style={{ lineHeight: 'unset' }}>
                    Last 90 days
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart />

                <div className={styles.jobSeparator} />

                <div className={styles.rowData}>
                    <div className={styles.firstPart}>
                        <div className={styles.square} style={{ backgroundColor: '#68C6B3' }} />
                        <Typography variant="Regular_14">Success</Typography>
                    </div>
                    <Typography variant="Semibold_14">180 Jobs</Typography>
                </div>

                <div className={styles.jobSeparator} />

                <div className={styles.rowData}>
                    <div className={styles.firstPart}>
                        <div className={styles.square} style={{ backgroundColor: '#0BAFFC' }} />
                        <Typography variant="Regular_14">Initializing</Typography>
                    </div>
                    <Typography variant="Semibold_14">48 Jobs</Typography>
                </div>

                <div className={styles.jobSeparator} />

                <div className={styles.rowData}>
                    <div className={styles.firstPart}>
                        <div className={styles.square} style={{ backgroundColor: '#FE5502' }} />
                        <Typography variant="Regular_14">Failed</Typography>
                    </div>
                    <Typography variant="Semibold_14">48 Jobs</Typography>
                </div>

                <div className={styles.jobSeparator} />
            </div>
        </div>
    );
};

export default JobStatus;
