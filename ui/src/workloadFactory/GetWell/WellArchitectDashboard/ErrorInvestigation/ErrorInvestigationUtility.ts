import { MS_PER_HOUR } from '../../../../utils/consts';
import { ErrorInvestigationGetApiResponse } from '../../../../utils/types/agenticAITypes';

export const eiSeverityOptionList = {
    top5: 'Top 5 highest severity levels',
    all: 'All severity levels',
    '1-8': '1-8',
    '9-16': '9-16',
    '16-24': '16-24'
};

export const eiErrorCodesOptions = { all: 'All error codes', top10: 'Top 10 error codes', top5: 'Top 5 error codes' };

export const eiTimeOptions = {
    last24: 'Last 24 hours',
    last12: 'Last 12 hours',
    last6: 'Last 6 hours',
    last1: 'Last 1 hour',
    custom: 'Custom'
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
        const allSeverities = Array.from(new Set(data.map(obj => Number(obj.severity))));
        allSeverities.sort((a, b) => b - a);
        const top5 = allSeverities.slice(0, 5);
        return data.filter(obj => top5.includes(Number(obj.severity)));
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
