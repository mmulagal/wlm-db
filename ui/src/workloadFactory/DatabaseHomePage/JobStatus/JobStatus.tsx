import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './JobStatus.module.scss';
import JobDoughnutChart from './JobDoughnut/JobDoughnutChart';
import { ReactComponent as JM_ARROW } from '../../../assets/ic_arrow_right_JM.svg';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { useDispatch } from 'react-redux';

const JobStatus = () => {
    const { jobsSummaryData, jobsSummaryLoading } = useAppSelector(state => state.databaseHome.getJobsSummary);

    const dispatch = useDispatch();

    return (
        <div className={styles.jobStatus}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.JOB_STATUS}
                </Typography>

                {jobsSummaryLoading ? (
                    <FlashingDotsLoader />
                ) : (
                    <div
                        className={styles.buttonContainer}
                        onClick={() => {
                            dispatch(setSelectedHeaderTab('Job monitoring'));
                        }}
                    >
                        <Typography variant="Regular_14" style={{ lineHeight: 'unset' }} className={styles.buttonStyle}>
                            {GENERAL.VIEW_JOB_MONITORING}
                        </Typography>
                        <JM_ARROW />
                    </div>
                )}
            </div>

            <div className={styles.mainSection}>
                <JobDoughnutChart jobsSummaryData={jobsSummaryData} jobsSummaryLoading={jobsSummaryLoading} />

                {/* <div className={styles.jobSeparator} /> */}

                <div className={styles.rightSection}>
                    <div className={styles.rowData} style={{ marginTop: '0' }}>
                        <Typography variant="Semibold_14">{GENERAL.JOBS_DISTRIBUTION}</Typography>
                        <Typography variant="Regular_13">{GENERAL.JOB_STATUS_DAYS}</Typography>
                    </div>

                    <div className={styles.jobSeparator} />
                    <div className={styles.rowData}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                            <Typography variant="Regular_14">{GENERAL.JOB_STATUS_COMPLETED}</Typography>
                        </div>
                        <Typography variant="Semibold_14">
                            {(jobsSummaryData?.completed || 0) + GENERAL.JOB_STATUS_JOBS}
                        </Typography>
                    </div>

                    <div className={styles.jobSeparator} />

                    <div className={styles.rowData}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <Typography variant="Regular_14">{GENERAL.JOB_STATUS_RUNNING}</Typography>
                        </div>
                        <Typography variant="Semibold_14">
                            {(jobsSummaryData?.inProgress || 0) + GENERAL.JOB_STATUS_JOBS}
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
