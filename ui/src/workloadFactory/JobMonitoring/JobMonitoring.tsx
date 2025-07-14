import { useEffect } from 'react';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import LineChart from '../DatabaseHomePage/LineChart/LineChart';
import styles from './JobMonitoring.module.scss';
import { GENERAL } from '../../utils/appConstants';
import JobMonitoringTable from './JobMonitoringTable/JobMonitoringTable';
import JobDistribution from './JobDistribution/JobDistribution';
import { setFromTime, setTimeInterval, setToTime } from '../../store/workloadFactory/jobMonitoringSlice';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import JobMonitoringApi from './JobMonitoringApi';

const JobMonitoring = ({ setDropdownValue, generateSelectFieldOptions, dropDownValue }: any) => {
    const dispatch = useAppDispatch();

    const timelineData = useAppSelector(state => state.jobMonitoring.jobsSummaryTimeline);
    const timelineLoading = useAppSelector(state => state.jobMonitoring.jobsSummaryTimelineLoading);
    const refreshTimeJobMonitor = useAppSelector(state => state.headers.refreshTimeJobMonitor);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    JobMonitoringApi();

    const dispatchTimeInterval = (days: number) => {
        const toDate = Date.now();
        const fromDate = toDate - days * (3600 * 1000 * 24);
        dispatch(setFromTime(fromDate));
        dispatch(setToTime(toDate));
        dispatch(setTimeInterval(days));
    };

    useEffect(() => {
        setDropdownValue(isDemoMode ? generateSelectFieldOptions[1] : generateSelectFieldOptions[0]);

        dispatchTimeInterval(isDemoMode ? 7 : 1);
    }, [refreshTimeJobMonitor]);

    return (
        <div className={styles.jobMonitoring}>
            <div className={styles.chartContainer}>
                <div className={styles.chartSection}>
                    <JobDistribution />
                </div>

                {/* Line chart section */}
                <div className={styles.overtimeJobs}>
                    <div className={styles.headSection}>
                        <Typography variant="Regular_16" className={styles.title}>
                            {GENERAL.JOBS_STATUS_OVER_TIME}
                           {timelineLoading && <FlashingDotsLoader />}
                        </Typography>
                    </div>
                    <div className={styles.mainSection}>
                        <LineChart
                            startColor="#A815F3"
                            endColor="rgba(168, 21, 243, 0.00)"
                            selectedTimeFrame={dropDownValue?.value}
                            timelineData={timelineData}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.tableSection}>
                <JobMonitoringTable />
            </div>
        </div>
    );
};

export default JobMonitoring;
