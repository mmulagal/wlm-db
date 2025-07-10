import { useEffect, useRef, useState } from 'react';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ErrorInvestigation.module.scss';
import FilterComponent from './FilterComponent/FilterComponent';
import UniqueErrorsSeverity from './UniqueErrorsSeverity/UniqueErrorsSeverity';
import { ReactComponent as TableView } from '../../../../assets/ic_table_view.svg';
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
    getStartAndEndTime,
    eiErrorCodesOptions,
    eiSeverityOptionList,
    eiTimeOptions
} from './ErrorInvestigationUtility';

const ErrorInvestigation = () => {
    const { t } = useTranslation();
    const rightRef = useRef<HTMLDivElement>(null);
    const [rightHeight, setRightHeight] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
    const [filtersApplied, setFiltersApplied] = useState<number>(0);
    const [errorCardsData, setErrorCardsData] = useState<ErrorInvestigationGetApiResponse[]>([]);
    const [selectedErrorData, setSelectedErrorData] = useState<ErrorInvestigationGetApiResponse | null>(null);
    const [uniqueErrBySeverity, setUniqueErrBySeverity] = useState<Array<{ severity: string; count: number }>>([]);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);

    ErrorInvestigationApi();
    const { errorInvestigationData, errorInvestigationLoading: loading } = useAppSelector(
        state => state.agenticAI.errorInvestigation
    );
    const { noData, selectedSeverity, selectedErrorCodes, selectedTimeFrame, timeRange } = useAppSelector(
        state => state.agenticAI
    );

    useEffect(() => {
        const { startTime: newStartTime, endTime: newEndTime } = getStartAndEndTime(selectedTimeFrame, timeRange);
        setStartTime(newStartTime);
        setEndTime(newEndTime);
    }, [selectedTimeFrame, timeRange]);

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
            setErrorCardsData(codesFiltered);
            setSelectedErrorData(codesFiltered[0]);
            // Calculate unique errors by severity (top 5)
            setUniqueErrBySeverity(getUniqueErrBySeverity(timeFiltered));
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
            <LogAnalyserHeader />

            <FilterComponent />
            <div className={styles.sectionTwo}>
                <UniqueErrorsSeverity uniqueErrBySeverity={uniqueErrBySeverity} />
                <UniqueErrorGraph startTime={startTime} endTime={endTime} />
            </div>

            {loading && (
                <>
                    <div className={styles.countTextLoading}>
                        <DsTypography variant="Semibold_16">{t('databases.log-analyzer.unique-errors')}</DsTypography>
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

            {noData && (
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
                                <DsTypography variant="Regular_14">{t('databases.log-analyzer.n/a')}</DsTypography>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && !noData && (
                <>
                    <div className={styles.countText}>
                        {filtersApplied > 0 ? (
                            <DsTypography variant="Semibold_16">
                                {t('databases.log-analyzer.unique-errors')} ({errorCardsData?.length}/
                                {errorInvestigationData?.length}) | {t('databases.log-analyzer.filters-applied')} (
                                {filtersApplied})
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
        </div>
    );
};

export default ErrorInvestigation;
