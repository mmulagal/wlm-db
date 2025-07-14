import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './JobDistribution.module.scss';
import JobDoughnutChart from '../../DatabaseHomePage/JobStatus/JobDoughnut/JobDoughnutChart';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import useResize from '../../../common/hooks/useResize';


const JobDistribution = () => {
    const jobsSummaryData = useAppSelector(state => state.jobMonitoring.jmJobsSummary);
    const jobsSummaryLoading = useAppSelector(state => state.jobMonitoring.jmJobsSummaryLoading);
    const windowSize = useResize();
    return (
        <div
            className={
                window.innerWidth <= 1500
                    ? `${styles.jobDistribution} ${styles.minWidthClass}`
                    : `${styles.jobDistribution} ${styles.maxWidthClass}`
            }
        >
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.headStatus}>
                    {GENERAL.JOB_DISTRIBUTION}
                     {jobsSummaryLoading && <FlashingDotsLoader />}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart jobsSummaryData={jobsSummaryData} jobsSummaryLoading={jobsSummaryLoading} />
                {windowSize.width <= 1500 && (
                    <div className={styles.rightSection}>
                        <div className={styles.jobSeparator} />
                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                 <Typography variant="Regular_14">{GENERAL.JM_COMPLETED}</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-6)' }} />
                               <Typography variant="Regular_14">Completed with issues</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.warning || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_RUNNING}</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
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
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />
                    </div>
                )}

                {windowSize.width >= 1500 && (
                    <div className={styles.rightSection}>
                        <div className={styles.jobSeparator} />
                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_COMPLETED}</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                             <Typography variant="Semibold_14">
                                {(jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-6)' }} />
                                <Typography variant="Regular_14">Completed with issues</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                             <Typography variant="Semibold_14">
                                {(jobsSummaryData?.warning || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14">{GENERAL.JM_RUNNING}</Typography>
                                {jobsSummaryLoading && <FlashingDotsLoader />}
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
                                {jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14">
                                {(jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobDistribution;
