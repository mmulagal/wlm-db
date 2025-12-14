import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import store from '../../../../store/store';
import {
    setEiRefreshPage,
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading,
    setLogAnalyzerState,
    setScanInProgress
} from '../../../../store/workloadFactory/agenticAISlice';
import { addAllLogAnalysisData } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    DBType,
    ERROR_ANALYZER_STATUS,
    JOB_MONITORING_STATUS,
    LOG_ANALYZER_POLLING_INTERVAL,
    MS_PER_HOUR,
    WLF_TABS
} from '../../../../utils/consts';
import { ErrorInvestigationGetApiResponse, ErrorInvestigationInstance } from '../../../../utils/types/agenticAITypes';

export const eiSeverityOptionList = {
    all: 'All severity levels',
    top5: 'Top 5 highest severity levels',
    '16-24': '16-24',
    '9-15': '9-15',
    '1-8': '1-8'
};

export const eiSeverityOptionListOracle = {
    all: 'All severity levels',
    critical: 'Critical',
    severe: 'Severe',
    important: 'Important'
};

export const eiErrorCodesOptions = {
    all: 'All error codes',
    top10: 'Top 10 frequent error codes',
    top5: 'Top 5 frequent error codes'
};

export const eiTimeOptions = {
    last24: 'Full analysis period',
    last12: 'Last 12 Hours of analysis',
    last6: 'Last 6 Hours of analysis',
    last1: 'Last 1 Hour of analysis',
    custom: 'Custom'
};

/**
 * Determines which time frame options should be enabled based on the analysis date time difference
 * @param startTime - Start time of the analysis period in milliseconds
 * @param endTime - End time of the analysis period in milliseconds
 * @returns Object with keys as option keys and values as boolean (true = enabled, false = disabled)
 */
export const getEnabledTimeOptions = (startTime: number, endTime: number): Record<string, boolean> => {
    const timeDifferenceMs = endTime - startTime;
    const timeDifferenceHours = timeDifferenceMs / MS_PER_HOUR;

    return {
        last24: true,
        last12: timeDifferenceHours >= 12,
        last6: timeDifferenceHours >= 6,
        last1: timeDifferenceHours >= 1,
        custom: true
    };
};

export const filterBySeverity = (
    data: ErrorInvestigationGetApiResponse[],
    selectedSeverity: string
): ErrorInvestigationGetApiResponse[] => {
    if (
        selectedSeverity &&
        selectedSeverity !== eiSeverityOptionList?.all &&
        selectedSeverity !== eiSeverityOptionList?.top5
    ) {
        const [min, max] = selectedSeverity.split('-').map(Number);
        return data.filter(obj => {
            const sev = Number(obj.severity);
            return sev >= min && sev <= max;
        });
    }
    if (selectedSeverity === eiSeverityOptionList?.top5) {
        const allSeverities = Array.from(
            new Set(
                data
                    .filter(
                        obj =>
                            obj.severity !== undefined && obj.severity !== null && !Number.isNaN(Number(obj.severity))
                    )
                    .map(obj => Number(obj.severity))
            )
        );
        allSeverities.sort((a, b) => b - a);
        const top5 = allSeverities.slice(0, 5);
        return data.filter(obj => obj?.severity && top5.includes(Number(obj.severity)));
    }
    return data;
};

export const filterBySeverityOracle = (
    data: ErrorInvestigationGetApiResponse[],
    selectedSeverity: string
): ErrorInvestigationGetApiResponse[] => {
    if (selectedSeverity && selectedSeverity !== eiSeverityOptionListOracle?.all) {
        return data?.filter(obj => obj?.severity?.toLowerCase() === selectedSeverity.toLowerCase());
    }
    return data;
};

export const filterByTime = (
    data: ErrorInvestigationGetApiResponse[],
    selectedTimeFrame: string,
    timeRange: { from: string; to: string; fromPeriod: string; toPeriod: string }
): ErrorInvestigationGetApiResponse[] => {
    let result = data.map(obj => ({ ...obj }));
    if (selectedTimeFrame && !selectedTimeFrame.includes(' - ')) {
        let hours = 24;
        if (selectedTimeFrame === eiTimeOptions?.last12) hours = 12;
        else if (selectedTimeFrame === eiTimeOptions?.last6) hours = 6;
        else if (selectedTimeFrame === eiTimeOptions?.last1) hours = 1;
        let maxHour = 0;
        result.forEach(obj => {
            const hourly = obj.hourlyErrorCounts;
            if (Array.isArray(hourly) && hourly.length > 0) {
                const objMax = Math.max(...hourly.map(h => h.hour));
                if (objMax > maxHour) maxHour = objMax;
            }
        });
        const minHour = maxHour - (hours !== 24 ? hours : hours - 1) * MS_PER_HOUR;
        result = result.map(obj => {
            const hourly = obj.hourlyErrorCounts;
            return {
                ...obj,
                hourlyErrorCounts: Array.isArray(hourly)
                    ? hourly.filter(h => h.hour >= minHour && h.hour <= maxHour)
                    : []
            };
        });
    } else if (selectedTimeFrame.includes(' - ') && timeRange) {
        // Calculate minHour and maxHour from data
        let minHour = Number.POSITIVE_INFINITY;
        let maxHour = 0;
        result.forEach(obj => {
            const hourly = obj.hourlyErrorCounts;
            if (Array.isArray(hourly) && hourly.length > 0) {
                const objMin = Math.min(...hourly.map(h => h.hour));
                const objMax = Math.max(...hourly.map(h => h.hour));
                if (objMin < minHour) minHour = objMin;
                if (objMax > maxHour) maxHour = objMax;
            }
        });
        // Parse hour and period to get hour offset in ms
        const parseHour = (time: string, period: string) => {
            const [hourStr] = time.split(':');
            let hour = Number(hourStr);
            if (period === 'AM') {
                if (hour === 12) hour = 0;
            } else if (period === 'PM') {
                if (hour !== 12) hour += 12;
            }
            return hour;
        };
        // Use maxHour as reference date
        const refDate = new Date(maxHour);
        // Calculate start and end using timeRange, but clamp between minHour and maxHour
        const startHour = parseHour(timeRange.from, timeRange.fromPeriod);
        const endHour = parseHour(timeRange.to, timeRange.toPeriod);
        // Build start and end timestamps with the same date as refDate
        let start = new Date(refDate);
        start.setHours(startHour, 0, 0, 0);
        let end = new Date(refDate);
        end.setHours(endHour, 0, 0, 0);
        // Clamp start and end between minHour and maxHour
        if (start.getTime() < minHour) start = new Date(minHour);
        if (end.getTime() > maxHour) end = new Date(maxHour);
        result = result.map(obj => {
            const hourly = obj.hourlyErrorCounts;
            return {
                ...obj,
                hourlyErrorCounts: Array.isArray(hourly)
                    ? hourly.filter(h => h.hour >= start.getTime() && h.hour <= end.getTime())
                    : []
            };
        });
    }
    // Remove rows whose hourlyErrorCounts is empty
    result = result.filter(obj => Array.isArray(obj.hourlyErrorCounts) && obj.hourlyErrorCounts.length > 0);
    return result;
};

export const getStartAndEndTimeFromRange = (
    data: ErrorInvestigationGetApiResponse[],
    selectedTimeFrame: string,
    timeRange: { from: string; to: string; fromPeriod: string; toPeriod: string }
) => {
    const result = data;
    if (data?.length > 0 && selectedTimeFrame && !selectedTimeFrame.includes(' - ')) {
        let hours = 24;
        if (selectedTimeFrame === eiTimeOptions?.last12) hours = 12;
        else if (selectedTimeFrame === eiTimeOptions?.last6) hours = 6;
        else if (selectedTimeFrame === eiTimeOptions?.last1) hours = 1;
        let maxHour = 0;
        result.forEach(obj => {
            const hourly = obj.hourlyErrorCounts;
            if (Array.isArray(hourly) && hourly.length > 0) {
                const objMax = Math.max(...hourly.map(h => h.hour));
                if (objMax > maxHour) maxHour = objMax;
            }
        });
        const minHour = maxHour - (hours !== 24 ? hours : hours - 1) * MS_PER_HOUR;
        return {
            startTime: minHour,
            endTime: maxHour
        };
    }
    if (data?.length > 0 && selectedTimeFrame.includes(' - ') && timeRange) {
        // Calculate minHour and maxHour from data
        let maxHour = 0;
        result.forEach(obj => {
            const hourly = obj.hourlyErrorCounts;
            if (Array.isArray(hourly) && hourly.length > 0) {
                const objMax = Math.max(...hourly.map(h => h.hour));
                if (objMax > maxHour) maxHour = objMax;
            }
        });
        // Parse hour and period to get hour offset in ms
        const parseHour = (time: string, period: string) => {
            const [hourStr] = time.split(':');
            let hour = Number(hourStr);
            if (period === 'AM') {
                if (hour === 12) hour = 0;
            } else if (period === 'PM') {
                if (hour !== 12) hour += 12;
            }
            return hour;
        };
        const refDate = new Date(maxHour);
        const minuteStr = refDate.getMinutes().toString().padStart(2, '0');
        // Calculate start and end using timeRange, but clamp between minHour and maxHour
        const startHour = parseHour(timeRange.from, timeRange.fromPeriod);
        const endHour = parseHour(timeRange.to, timeRange.toPeriod);
        // Build start and end timestamps with the same date as refDate
        const start = new Date(refDate);
        start.setHours(startHour, Number(minuteStr), 0, 0);
        const end = new Date(refDate);
        // Adjust the end hour if there are minutes present in the reference date.
        // This ensures that the end time aligns correctly with the specified time range.
        const adjustedEndHour = Number(minuteStr) > 0 ? endHour - 1 : endHour;
        end.setHours(adjustedEndHour, Number(minuteStr), 0, 0);
        return {
            startTime: start.getTime(),
            endTime: end.getTime()
        };
    }
    return {
        startTime: 0,
        endTime: 0
    };
};

export const filterByErrorCodes = (
    data: ErrorInvestigationGetApiResponse[],
    selectedErrorCodes: string
): ErrorInvestigationGetApiResponse[] => {
    let result = [...data];
    if (selectedErrorCodes === eiErrorCodesOptions?.top5 || selectedErrorCodes === eiErrorCodesOptions?.top10) {
        result = result.map(obj => {
            const hourly = obj.hourlyErrorCounts;
            return {
                ...obj,
                totalFilteredCount: Array.isArray(hourly) ? hourly.reduce((sum, h) => sum + h.count, 0) : 0
            };
        });
        result.sort((a, b) => (b.totalFilteredCount ?? 0) - (a.totalFilteredCount ?? 0));
        const topN = selectedErrorCodes === eiErrorCodesOptions?.top5 ? 5 : 10;
        result = result.slice(0, topN);
    }
    // Remove helper property if present
    result = result.map(obj => {
        // Remove totalFilteredCount if present
        const { totalFilteredCount, ...rest } = obj as ErrorInvestigationGetApiResponse & {
            totalFilteredCount?: number;
        };
        return rest;
    });
    return result;
};

export const filterByErrorTags = (
    data: ErrorInvestigationGetApiResponse[],
    selectedErrorTags: string[]
): ErrorInvestigationGetApiResponse[] => {
    // If no tags are selected or selectedErrorTags is empty, return all data
    if (!selectedErrorTags || selectedErrorTags.length === 0) {
        return data;
    }

    // Filter data where error tags intersect with selected tags
    return data.filter(obj => {
        // If the error has no tags, exclude it when tags are selected
        if (!obj.tags || !Array.isArray(obj.tags) || obj.tags.length === 0) {
            return false;
        }

        // Check if any of the error's tags match any of the selected tags
        return obj.tags.some(tag => selectedErrorTags.includes(tag));
    });
};

export const recalculateErrorFields = (data: ErrorInvestigationGetApiResponse[]) => {
    let result = [...data];
    result = result.map(obj => {
        const hourly = obj.hourlyErrorCounts;
        return {
            ...obj,
            totalFilteredCount: Array.isArray(hourly) ? hourly.reduce((sum, h) => sum + h.count, 0) : 0
        };
    });
    return result;
};

export const getUniqueErrBySeverity = (
    data: ErrorInvestigationGetApiResponse[]
): Array<{ severity: string; count: number }> => {
    const severityMap: Record<string, number> = {};
    data.forEach(obj => {
        const sev = String(obj.severity);
        const hourly = obj.hourlyErrorCounts;
        const sum = Array.isArray(hourly) ? hourly.reduce((acc, h) => acc + h.count, 0) : 0;
        if (severityMap[sev] == null) severityMap[sev] = 0;
        severityMap[sev] += sum;
    });
    return Object.entries(severityMap)
        .map(([severity, count]) => ({ severity, count }))
        .sort((a, b) => Number(b.severity) - Number(a.severity))
        .slice(0, 5);
};

export const getMaxGraceValueLineGraph = (data: number[]) => {
    const maxVal = Math.max(...data, 1);
    if ([1, 3, 6, 7].includes(maxVal)) return 1;
    if ([2, 5].includes(maxVal)) return 2;
    if (maxVal === 4) return 4;
    if (maxVal < 100) return 10;
    return 100;
};

// New helper to generate hour labels between two timestamps (inclusive)
export const getHourLabelsBetween = (start: number, end: number) => {
    const labels = [];
    if (start === 0 && end === 0) {
        return []; // Return empty if start and end are 0
    }
    for (let t = start; t <= end; t += MS_PER_HOUR) {
        const date = new Date(t);
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        labels.push(`${hour}:${minute}`);
    }
    return labels;
};

export const calculateTotalHourlyErrorCounts = (newFilteredData: ErrorInvestigationGetApiResponse[]) => {
    // Build a map of timestamp -> total count in one pass for performance
    const timestampCountMap = new Map<number, number>();
    newFilteredData.forEach(err => {
        (err.hourlyErrorCounts || []).forEach(h => {
            if (h.hour) {
                const ts = new Date(h.hour).getTime();
                timestampCountMap.set(ts, (timestampCountMap.get(ts) || 0) + (h.count || 0));
            }
        });
    });
    // Ensure all timestamps are present (even if missing in some objects)
    const allTimestamps = Array.from(timestampCountMap.keys()).sort((a, b) => a - b);
    const totalHourlyCounts = allTimestamps.map(ts => ({ hour: ts, count: timestampCountMap.get(ts) || 0 }));
    return totalHourlyCounts;
};

const removeLogAnalyzerFailedRow = (dispatch: any, newObj: ErrorInvestigationInstance | null) => {
    const state = store.getState();
    const { allLogAnalysisData } = state.inventoryV2;
    // Remove the failed newObj based on unique identifiers
    const filteredData = allLogAnalysisData.filter(
        (item: ErrorInvestigationInstance) =>
            !(
                item.credentialId === newObj?.credentialId &&
                item.databaseHostId === newObj?.databaseHostId &&
                item.databaseInstanceId === newObj?.databaseInstanceId &&
                item.regionId === newObj?.regionId
            )
    );
    dispatch(addAllLogAnalysisData(filteredData));
};

const updateLogAnalyzerRow = (dispatch: any, newObj: ErrorInvestigationInstance | null) => {
    const state = store.getState();
    const { allLogAnalysisData } = state.inventoryV2;
    // Find existing row based on unique identifiers and update it, or add new row
    const existingRowIndex = allLogAnalysisData.findIndex(
        (item: ErrorInvestigationInstance) =>
            item.credentialId === newObj?.credentialId &&
            item.databaseHostId === newObj?.databaseHostId &&
            item.databaseInstanceId === newObj?.databaseInstanceId &&
            item.regionId === newObj?.regionId
    );

    let updatedLogAnalysisData;
    if (existingRowIndex !== -1) {
        // Update existing row
        updatedLogAnalysisData = [...allLogAnalysisData];
        updatedLogAnalysisData[existingRowIndex] = {
            ...updatedLogAnalysisData[existingRowIndex],
            ...newObj
        };
    } else {
        // Add new row
        updatedLogAnalysisData = [...allLogAnalysisData, newObj];
    }
    dispatch(addAllLogAnalysisData(updatedLogAnalysisData));
};

export const handleLogAnalyzerJob = (
    dispatch: any,
    res: any,
    getJobDetailApi: any,
    t: any,
    firstScan: boolean,
    key: string,
    newObj: ErrorInvestigationInstance | null,
    dbType?: string
) => {
    const jobId = res?.data?.jobId;
    if (jobId) {
        const jobInterval = setInterval(() => {
            getJobDetailApi({
                id: jobId
            }).then((jobRes: any) => {
                const status = jobRes?.data?.status;
                if (status === JOB_MONITORING_STATUS.COMPLETED || status === JOB_MONITORING_STATUS.WARNING) {
                    logAnalyzerScanUpdate(key, false, dispatch);
                    clearInterval(jobInterval);
                    if (firstScan) {
                        const latestReport = jobRes?.data?.metadata?.latestReport || {};
                        dispatch(setLogAnalyzerState(ERROR_ANALYZER_STATUS.ACTIVE));
                        newObj = {
                            ...newObj,
                            id: latestReport?.id || '',
                            status: ERROR_ANALYZER_STATUS.ACTIVE,
                            latestReport: {
                                creationTime: latestReport?.creationTime || 0,
                                jobId: jobId || '',
                                errorCount: latestReport?.errorCount || 0,
                                severityCounts: {
                                    important: latestReport?.severityCounts?.important || 0,
                                    critical: latestReport?.severityCounts?.critical || 0,
                                    severe: latestReport?.severityCounts?.severe || 0
                                }
                            },
                            dbType
                        };
                        updateLogAnalyzerRow(dispatch, newObj);
                    }
                    dispatch(setEiRefreshPage(true));
                } else if (status === JOB_MONITORING_STATUS.FAILED) {
                    logAnalyzerScanUpdate(key, false, dispatch);
                    clearInterval(jobInterval);
                    dispatch(setLogAnalyzerState(ERROR_ANALYZER_STATUS.NOT_ACTIVE));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: jobRes?.data?.error || t('databases.log-analyzer.scan-failed')
                        })
                    );
                    if (firstScan) {
                        removeLogAnalyzerFailedRow(dispatch, newObj);
                    }
                }
            });
        }, LOG_ANALYZER_POLLING_INTERVAL);
    } else {
        dispatch(setLogAnalyzerState(ERROR_ANALYZER_STATUS.NOT_ACTIVE));
        if (firstScan) {
            removeLogAnalyzerFailedRow(dispatch, newObj);
        }
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.ERROR,
                message: t('databases.log-analyzer.scan-trigger-error')
            })
        );
        logAnalyzerScanUpdate(key, false, dispatch);
    }
};

export const logAnalyzerScanUpdate = (key: string, status: boolean, dispatch: any) => {
    const state = store.getState();
    const { scanInProgress } = state.agenticAI;

    // Update the specific key with the new status
    const updatedScanInProgress = {
        ...scanInProgress,
        [key]: status
    };

    // Dispatch the updated scanInProgress object
    dispatch(setScanInProgress(updatedScanInProgress));
};

export const runInvestigationPreReqApiCall = async (
    dbType: string,
    commonParams: { credentialId: string; regionId: string },
    selectedResourceId: string,
    selectedDatabaseInstance: string,
    dispatch: any,
    getLogAnalyzerPreReqOracleApi: any,
    getLogAnalyzerPreReqApi: any
) => {
    try {
        dispatch(setLogAnalyzerPreReqLoading(true));

        let result: { data?: any; error?: any };

        if (dbType === DBType.ORACLE) {
            result = await getLogAnalyzerPreReqOracleApi({
                ...commonParams,
                payload: {
                    items: [
                        {
                            databaseHostId: selectedResourceId,
                            databaseInstanceName: selectedDatabaseInstance
                        }
                    ]
                }
            });
        } else {
            result = await getLogAnalyzerPreReqApi({
                ...commonParams,
                type: 'databaseHostId',
                typeId: selectedResourceId
            });
        }

        // Common result handling
        if (result && !result?.error && result?.data?.items?.length > 0 && !result?.data?.items[0]?.errorMessage) {
            dispatch(setLogAnalyzerPreReqData(result?.data?.items[0]));
        } else {
            dispatch(setLogAnalyzerPreReqData(null));
        }
    } catch (error) {
        dispatch(setLogAnalyzerPreReqData(null));
    } finally {
        dispatch(setLogAnalyzerPreReqLoading(false));
    }
};
