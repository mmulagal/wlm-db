import { Typography } from '@netapp/design-system';
import styles from './JobDistribution.module.scss';
import JobDoughnutChart from '../../DatabaseHomePage/JobStatus/JobDoughnut/JobDoughnutChart';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

const JobDistribution = () => {
    const jobsSummaryData = useAppSelector(state => state.jobMonitoring.jmJobsSummary);
    const jobsSummaryLoading  = useAppSelector(state => state.jobMonitoring.jmJobsSummaryLoading);
    return (
        <div
            className={
                window.innerWidth <= 1500
                    ? `${styles.jobDistribution} ${styles.minWidthClass}`
                    : `${styles.jobDistribution} ${styles.maxWidthClass}`
            }
        >
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.JOB_DISTRIBUTION}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart jobsSummaryData={jobsSummaryData} jobsSummaryLoading={jobsSummaryLoading}/>
                {window.innerWidth <= 1500 && (
                    <div className={styles.rightSection}>
                        <div className={styles.rowData} style={{ marginTop: '0' }}>
                            <Typography variant="Semibold_14">{GENERAL.JOBS_DISTRIBUTION}</Typography>
                        </div>

                        <div className={styles.jobSeparator} />
                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_COMPLETED}</Typography>
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_RUNNING}</Typography>
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.inProgress || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-8)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_FAILED}</Typography>
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />
                    </div>
                )}

                {window.innerWidth >= 1500 && (
                    <div className={styles.flexRightSection}>
                        <div className={styles.valueContainer} style={{ width: '143px' }}>
                            <Typography variant="Regular_24" className={styles.setLineHeight}>
                                {jobsSummaryData?.completed}
                            </Typography>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_COMPLETED}</Typography>
                            </div>
                        </div>
                        <div className={styles.jobDistributionSeparator} />
                        <div className={styles.valueContainer} style={{ width: '124px' }}>
                            <Typography variant="Regular_24" className={styles.setLineHeight}>
                                {jobsSummaryData?.inProgress}
                            </Typography>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_RUNNING}</Typography>
                            </div>
                        </div>
                        <div className={styles.jobDistributionSeparator} />
                        <div className={styles.valueContainer}>
                            <Typography variant="Regular_24" className={styles.setLineHeight}>
                                {jobsSummaryData?.failed}
                            </Typography>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-8)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_FAILED}</Typography>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobDistribution;
