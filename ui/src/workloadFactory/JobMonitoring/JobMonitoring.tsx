import { useEffect, useMemo, useState } from 'react';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useNavigate } from 'react-router-dom';
import LineChart from '../DatabaseHomePage/LineChart/LineChart';
import styles from './JobMonitoring.module.scss';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { GENERAL } from '../../utils/appConstants';
import JobMonitoringTable from './JobMonitoringTable/JobMonitoringTable';
import JobDistribution from './JobDistribution/JobDistribution';
import { generateOptionType, resetDBHomePageState } from '../../utils/utilityFunctions';
import JobMonitoringApi from './JobMonitoringApi';
import { setFromTime, setTimeInterval, setToTime } from '../../store/workloadFactory/jobMonitoringSlice';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';

const JobMonitoring = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const timelineData = useAppSelector(state => state.jobMonitoring.jobsSummaryTimeline);
    const timelineLoading = useAppSelector(state => state.jobMonitoring.jobsSummaryTimelineLoading);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);

    const [dropDownValue, setDropdownValue] = useState('Last 24 hours');

    //Function to generate the options for Select Field for License
    const generateSelectFieldOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['Last 24 hours', 'Last 7 days', 'Last 14 days', 'Last 30 days'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    const setTimeRange = (selectedTime: string) => {
        let days = 1;
        if (selectedTime === 'Last 7 days') {
            days = 7;
        } else if (selectedTime === 'Last 14 days') {
            days = 14;
        } else if (selectedTime === 'Last 30 days') {
            days = 30;
        }
        dispatchTimeInterval(days);
    };

    const dispatchTimeInterval = (days: number) => {
        const toDate = Date.now();
        const fromDate = toDate - days * (3600 * 1000 * 24);
        dispatch(setFromTime(fromDate));
        dispatch(setToTime(toDate));
        dispatch(setTimeInterval(days));
    };

    useEffect(() => {
        dispatchTimeInterval(1);
    }, []);

    useEffect(() => {
        dispatchTimeInterval(1);
    }, [refreshTime]);

    JobMonitoringApi();

    return (
        <div className={styles.jobMonitoring}>
            {/* <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: GENERAL.DATABASES,
                            onClick: () => {
                                resetDBHomePageState(dispatch);
                                navigate('../databases');
                            }
                        },
                        {
                            title: GENERAL.JOB_MONITORING
                        }
                    ]}
                />
            </div> */}

            <div className={styles.headingContainer}>
                {/* <Typography variant="Regular_24" className={styles.heading}>
                    {GENERAL.JOB_MONITORING}
                </Typography> */}
                <div />

                <div className={styles.selectContainer}>
                    <SelectField
                        isClearable={false}
                        onChange={(selectedOptions: any): void => {
                            setDropdownValue(selectedOptions?.value);
                            setTimeRange(selectedOptions?.value);
                        }}
                        isSearchable={false}
                        variant="underline"
                        options={generateSelectFieldOptions}
                        defaultValue={[generateSelectFieldOptions[0]]}
                    />
                </div>
            </div>

            <div className={styles.chartContainer}>
                <div>
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
                            selectedTimeFrame={dropDownValue}
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
