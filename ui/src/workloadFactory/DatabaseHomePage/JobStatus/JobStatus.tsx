import { Typography } from '@netapp/design-system';
import styles from './JobStatus.module.scss';
import JobDoughnutChart from './JobDoughnut/JobDoughnutChart';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';

const JobStatus = () => {
    const { jobsSummaryData, jobsSummaryLoading } = useAppSelector(state => state.databaseHome.getJobsSummary);

    return (
        <div className={styles.jobStatus}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.JOB_STATUS}
                    {jobsSummaryLoading && (
                        <div className={styles.loadingPlacement}>
                            <LoadingComponent />
                        </div>
                    )}
                </Typography>

                <Typography variant="Regular_13" style={{ lineHeight: 'unset' }}>
                    {GENERAL.JOB_STATUS_DAYS}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart />

                {/* <div className={styles.jobSeparator} /> */}

                <div className={styles.rightSection}>
                    <div className={styles.rowData} style={{ marginTop: '0' }}>
                        <Typography variant="Semibold_14">{GENERAL.JOBS_DISTRIBUTION}</Typography>
                    </div>

                    <div className={styles.jobSeparator} />
                    <div className={styles.rowData}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                            <Typography variant="Regular_14">{GENERAL.JOB_STATUS_SUCCESS}</Typography>
                        </div>
                        <Typography variant="Semibold_14">
                            {(jobsSummaryData?.success || 0) + GENERAL.JOB_STATUS_JOBS}
                        </Typography>
                    </div>

                    <div className={styles.jobSeparator} />

                    <div className={styles.rowData}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <Typography variant="Regular_14">{GENERAL.JOB_STATUS_INITIALIZING}</Typography>
                        </div>
                        <Typography variant="Semibold_14">
                            {(jobsSummaryData?.initializing || 0) + GENERAL.JOB_STATUS_JOBS}
                        </Typography>
                    </div>

                    <div className={styles.jobSeparator} />

                    <div className={styles.rowData}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-8)' }} />
                            <Typography variant="Regular_14">{GENERAL.JOB_STATUS_FAILED}</Typography>
                        </div>
                        <Typography variant="Semibold_14">
                            {(jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
                        </Typography>
                    </div>

                    <div className={styles.jobSeparator} />
                </div>
            </div>
        </div>
    );
};

export default JobStatus;
