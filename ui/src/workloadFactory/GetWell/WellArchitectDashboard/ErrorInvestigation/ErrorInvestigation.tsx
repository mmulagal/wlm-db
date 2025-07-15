import { useEffect, useRef, useState } from 'react';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ErrorInvestigation.module.scss';
import FilterComponent from './FilterComponent/FilterComponent';
import UniqueErrorsSeverity from './UniqueErrorsSeverity/UniqueErrorsSeverity';
import { ReactComponent as TableView } from '../../../../assets/ic_table_view.svg';
import { ReactComponent as NoErrorDetected } from '../../../../assets/no_error_detected.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import UniqueErrorGraph from './UniqueErrorGraph/UniqueErrorGraph';
import AIInvestigation from './AIInvestigation/AIInvestigation';
import ErrorCards from './ErrorCards/ErrorCards';
import LogAnalyserHeader from './LogAnalyserHeader/LogAnalyserHeader';
import TimeSelect from './TimeSelect/TimeSelect';
import { useAppSelector } from '../../../../store/storeHooks';
import ErrorInvestigationApi from './ErrorInvestigationApi';
import { ErrorInvestigationGetApiResponse } from '../../../../utils/types/agenticAITypes';
import {
    filterBySeverity,
    filterByTime,
    filterByErrorCodes,
    getUniqueErrBySeverity,
    eiErrorCodesOptions,
    eiSeverityOptionList,
    eiTimeOptions,
    recalculateErrorFields,
    getStartAndEndTimeFromRange
} from './ErrorInvestigationUtility';
import { formatDateWithTime } from '../../../../utils/utilityFunctions';

const ErrorInvestigation = () => {
    const { t } = useTranslation();
    const rightRef = useRef<HTMLDivElement>(null);
    const [rightHeight, setRightHeight] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
    const [filtersApplied, setFiltersApplied] = useState<number>(0);
    const [errorCardsData, setErrorCardsData] = useState<ErrorInvestigationGetApiResponse[]>([]);
    const [selectedErrorData, setSelectedErrorData] = useState<ErrorInvestigationGetApiResponse | null>(null);
    const [uniqueErrBySeverity, setUniqueErrBySeverity] = useState<Array<{ severity: string; count: number }>>([]);
    const [headerData, setheaderData] = useState({
        uniqueErrors: 0,
        totalErrors: 0,
        lastScan: ''
    });
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [totalHourlyErrorCounts, setTotalHourlyErrorCounts] = useState<Array<{ hour: number; count: number }>>([]);

    ErrorInvestigationApi();
    const { errorInvestigationData, errorInvestigationLoading } = useAppSelector(
        state => state.agenticAI.errorInvestigation
    );
    const {
        noData,
        selectedSeverity,
        selectedErrorCodes,
        selectedTimeFrame,
        timeRange,
        investigationDates,
        noErrorsDetected,
        investigationDatesLoading
    } = useAppSelector(state => state.agenticAI);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    useEffect(() => {
        if (errorInvestigationData) {
            // Filtering logic
            const filtered = filterBySeverity(errorInvestigationData, selectedSeverity);
            const timeFiltered = filterByTime(filtered, selectedTimeFrame, timeRange);
            const codesFiltered = filterByErrorCodes(timeFiltered, selectedErrorCodes);

            // Set filteredCount for UI
            let filteredCount = 0;
            if (selectedErrorCodes !== eiErrorCodesOptions?.all) filteredCount += 1;
            if (selectedSeverity !== eiSeverityOptionList?.all) filteredCount += 1;
            if (selectedTimeFrame !== eiTimeOptions?.last24) filteredCount += 1;
            setFiltersApplied(filteredCount);

            const newFilteredData = recalculateErrorFields(codesFiltered);
            setErrorCardsData(newFilteredData);
            setSelectedErrorData(newFilteredData[0]);

            // Calculate unique errors by severity (top 5)
            setUniqueErrBySeverity(getUniqueErrBySeverity(newFilteredData));

            // calculate start and end time
            const { startTime: newStartTime, endTime: newEndTime } = getStartAndEndTimeFromRange(
                newFilteredData,
                selectedTimeFrame,
                timeRange
            );
            setStartTime(newStartTime);
            setEndTime(newEndTime);

            // Calculate total hourly error counts with all timestamps present in all objects
            const allTimestampsSet = new Set<number>();
            newFilteredData.forEach(err => {
                (err.hourlyErrorCounts || []).forEach(h => {
                    if (h.hour) {
                        allTimestampsSet.add(new Date(h.hour).getTime());
                    }
                });
            });
            const allTimestamps = Array.from(allTimestampsSet).sort((a, b) => a - b);

            // For each timestamp, sum the count from all objects (0 if missing)
            const totalHourlyCounts = allTimestamps.map(ts => {
                const count = newFilteredData.reduce((sum, err) => {
                    const found = (err.hourlyErrorCounts || []).find(h => new Date(h.hour).getTime() === ts);
                    return sum + (found ? found.count || 0 : 0);
                }, 0);
                return { hour: ts, count };
            });
            setTotalHourlyErrorCounts(totalHourlyCounts);

            // Set header data
            const uniqueErrors = errorInvestigationData.length;
            // Calculate totalErrors as the sum of all hourlyErrorCounts.count values
            const totalErrors = errorInvestigationData.reduce((sum, err) => {
                if (Array.isArray(err.hourlyErrorCounts)) {
                    return sum + err.hourlyErrorCounts.reduce((acc, h) => acc + (h.count || 0), 0);
                }
                return sum;
            }, 0);
            const lastScan =
                investigationDates.length > 0 ? formatDateWithTime(investigationDates[0]?.creationTime) : '';
            setheaderData({ uniqueErrors, totalErrors, lastScan });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errorInvestigationData, selectedSeverity, selectedErrorCodes, selectedTimeFrame, timeRange]);

    const handleCardClick = (index: number) => {
        setSelectedIndex(index);
        setSelectedErrorData(errorCardsData[index]);
    };

    useEffect(() => {
        if (rightRef.current) {
            setRightHeight(rightRef.current.offsetHeight);
        }
    }, [selectedErrorData]);

    return (
        <div className={styles.errorInvestigation}>
            <TimeSelect />
            <LogAnalyserHeader headerData={headerData} />

            <FilterComponent />

            {!loading && noErrorsDetected && (
                <div className={styles.noErrorsDetected}>
                    <div className={styles.noErrorBlock}>
                        <NoErrorDetected />
                        <div className={styles.noErrorHeader}>
                            <Success />
                            <DsTypography variant="Semibold_16">
                                {t('databases.log-analyzer.no-errors-detected-header')}
                            </DsTypography>
                        </div>
                        <div className={styles.noErrorText}>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.no-errors-detected-content-1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.log-analyzer.no-errors-detected-content-2')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}
            {!noErrorsDetected && (
                <>
                    <div className={styles.sectionTwo}>
                        <UniqueErrorsSeverity uniqueErrBySeverity={uniqueErrBySeverity} />
                        <UniqueErrorGraph startTime={startTime} endTime={endTime} data={totalHourlyErrorCounts || []} />
                    </div>

                    {loading && (
                        <>
                            <div className={styles.countTextLoading}>
                                <DsTypography variant="Semibold_16">
                                    {t('databases.log-analyzer.unique-errors')}
                                </DsTypography>
                                <DsFlashingDotsLoader />
                            </div>

                            <div className={styles.loadingSection}>
                                <div className={styles.contentSection}>
                                    <TableView />
                                    <div className={styles.loadingView}>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.log-analyzer.loading-data')}
                                        </DsTypography>
                                        <DsFlashingDotsLoader />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {!loading && (noData || errorCardsData.length === 0) && (
                        <>
                            <div className={styles.countTextLoading}>
                                <DsTypography variant="Semibold_16" style={{ color: '#a7a7a7' }}>
                                    {t('databases.log-analyzer.unique-errors')}
                                </DsTypography>
                            </div>
                            <div className={styles.loadingSection}>
                                <div className={`${styles.contentSection} ${styles.noDataSection}`}>
                                    <TableView />
                                    <div className={styles.loadingView}>
                                        <DsTypography variant="Regular_14">
                                            {t('databases.log-analyzer.n/a')}
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {!loading && !noData && errorCardsData.length > 0 && (
                        <>
                            <div className={styles.countText}>
                                {filtersApplied > 0 ? (
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.unique-errors')} ({errorCardsData?.length}/
                                        {errorInvestigationData?.length}) |{' '}
                                        {t('databases.log-analyzer.filters-applied')} ({filtersApplied})
                                    </DsTypography>
                                ) : (
                                    <DsTypography variant="Semibold_16">
                                        {t('databases.log-analyzer.unique-errors')}
                                    </DsTypography>
                                )}
                            </div>

                            <div className={styles.sectionTwo} style={{ marginBottom: '40px' }}>
                                <div className={styles.errorCardSection} style={{ height: rightHeight }} ref={rightRef}>
                                    {errorCardsData.map((error, index) => (
                                        <ErrorCards
                                            key={error.errorCode || index}
                                            errorCode={error.errorCode}
                                            errorMessage={error.error}
                                            severity={error.severity}
                                            errorCount={error.count}
                                            filteredCount={error.totalFilteredCount}
                                            isSelected={selectedIndex === index}
                                            onClick={() => handleCardClick(index)}
                                        />
                                    ))}
                                </div>
                                <div className={styles.aiInvestigationSection} ref={rightRef}>
                                    <AIInvestigation
                                        selectedErrorData={selectedErrorData}
                                        startTime={startTime}
                                        endTime={endTime}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default ErrorInvestigation;
