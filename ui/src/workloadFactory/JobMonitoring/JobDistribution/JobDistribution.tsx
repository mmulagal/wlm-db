import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './JobDistribution.module.scss';
import JobDoughnutChart from '../../DatabaseHomePage/JobStatus/JobDoughnut/JobDoughnutChart';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import useResize from '../../../common/hooks/useResize';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const JobDistribution = () => {
    const jobsSummaryData = useAppSelector(state => state.jobMonitoring.jmJobsSummary);
    const jobsSummaryLoading = useAppSelector(state => state.jobMonitoring.jmJobsSummaryLoading);
    const { showNA } = useAppSelector(state => state.headers);
    const windowSize = useResize();
    return (
        <div
            className={
                window.innerWidth <= 1500
                    ? `${styles.jobDistribution} ${styles.minWidthClass} ${showNA ? CommonStyles.notAvailable : ''}`
                    : `${styles.jobDistribution} ${styles.maxWidthClass} ${showNA ? CommonStyles.notAvailable : ''}`
            }
        >
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.headStatus}>
                    {GENERAL.JOB_DISTRIBUTION}
                    {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                </Typography>
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart jobsSummaryData={showNA ? null : jobsSummaryData} jobsSummaryLoading={jobsSummaryLoading} showNA={showNA} />
                {windowSize.width <= 1500 && (
                    <div className={styles.rightSection}>
                        <div className={styles.jobSeparator} />
                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_COMPLETED}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-6)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>Completed with issues</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.warning || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_RUNNING}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.inProgress || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-8)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_FAILED}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
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
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_COMPLETED}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-6)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>Completed with issues</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.warning || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_RUNNING}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.inProgress || 0) + GENERAL.JOB_STATUS_JOBS}
                            </Typography>
                        </div>

                        <div className={styles.jobSeparator} />

                        <div className={styles.rowData}>
                            <div className={styles.firstPart}>
                                <div className={styles.square} style={{ backgroundColor: 'var(--chart-8)' }} />
                                <Typography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>{GENERAL.JM_FAILED}</Typography>
                                {!showNA && jobsSummaryLoading && <FlashingDotsLoader />}
                            </div>
                            <Typography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {showNA ? GENERAL.NOT_AVAILABLE : (jobsSummaryData?.failed || 0) + GENERAL.JOB_STATUS_JOBS}
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
