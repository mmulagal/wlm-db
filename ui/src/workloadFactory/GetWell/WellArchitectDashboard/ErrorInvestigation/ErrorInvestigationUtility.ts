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
        const minHour = maxHour - (hours - 1) * 60 * 60 * 1000;
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
        // Parse hour string and period to hour in ms
        const parseHour = (time: string, period: string) => {
            const [hourStr] = time.split(':');
            let hour = Number(hourStr);
            if (period === 'AM') {
                if (hour === 12) hour = 0;
            } else if (period === 'PM') {
                if (hour !== 12) hour += 12;
            }
            return hour * 60 * 60 * 1000;
        };
        const start = parseHour(timeRange.from, timeRange.fromPeriod);
        const end = parseHour(timeRange.to, timeRange.toPeriod);
        result = result.map(obj => {
            const hourly = obj.hourlyErrorCounts;
            return {
                ...obj,
                hourlyErrorCounts: Array.isArray(hourly) ? hourly.filter(h => h.hour >= start && h.hour <= end) : []
            };
        });
    }
    return result;
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

export const getStartAndEndTime = (
    selectedTimeFrame: string,
    timeRange: { from: string; to: string; fromPeriod: string; toPeriod: string }
) => {
    // Get the current time and calculate the next whole hour
    const now = new Date();
    const endHour = now.getHours();
    const endDay = now.getDate();
    const endMonth = now.getMonth();
    const endYear = now.getFullYear();
    const nextHour = endHour + 1; // Next whole hour (e.g., if 14:44, endTime = 15)
    let startTime;

    if (selectedTimeFrame === eiTimeOptions?.last24) {
        // For last 24 hours, startTime is 24 hours before endTime, possibly on previous day
        const endDate = new Date(endYear, endMonth, endDay, nextHour, 0, 0, 0);
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        startTime = startDate.getHours();
        return {
            startTime,
            endTime: nextHour
        };
    }
    if (selectedTimeFrame === eiTimeOptions?.last12) {
        const endDate = new Date(endYear, endMonth, endDay, nextHour, 0, 0, 0);
        const startDate = new Date(endDate.getTime() - 12 * 60 * 60 * 1000);
        startTime = startDate.getHours();
        return {
            startTime,
            endTime: nextHour
        };
    }
    if (selectedTimeFrame === eiTimeOptions?.last6) {
        const endDate = new Date(endYear, endMonth, endDay, nextHour, 0, 0, 0);
        const startDate = new Date(endDate.getTime() - 6 * 60 * 60 * 1000);
        startTime = startDate.getHours();
        return {
            startTime,
            endTime: nextHour
        };
    }
    if (selectedTimeFrame === eiTimeOptions?.last1) {
        const endDate = new Date(endYear, endMonth, endDay, nextHour, 0, 0, 0);
        const startDate = new Date(endDate.getTime() - 1 * 60 * 60 * 1000);
        startTime = startDate.getHours();
        return {
            startTime,
            endTime: nextHour
        };
    }
    // Helper to parse hour string and period to 24-hour number
    const parseHour = (time: string, period: string) => {
        const [hourStr] = time.split(':');
        const hour = Number(hourStr);
        if (period === 'AM') {
            if (hour === 12) return 0;
            return hour;
        }
        if (period === 'PM') {
            if (hour === 12) return 12;
            return hour + 12;
        }
        return hour;
    };
    const from = parseHour(timeRange.from, timeRange.fromPeriod);
    const to = parseHour(timeRange.to, timeRange.toPeriod);
    return {
        startTime: from,
        endTime: to
    };
};

// Helper to get x-axis labels for custom range (show all hours, not just 3 points, but max 13 labels, only fixed hours like 02:00, 03:00)
export const getFixedHourLabelsErrorCount = (start: number, end: number) => {
    let range = end - start;
    if (range <= 0) range += 24;
    const totalPoints = range + 1;
    const maxLabels = 13;
    let step = 1;
    if (totalPoints > maxLabels) {
        step = Math.ceil(totalPoints / maxLabels);
    }
    const labels = [];
    for (let i = 0; i < totalPoints; i += step) {
        const hour = (start + i) % 24;
        labels.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    // Always include the last hour if not already included and not equal to the first label
    const lastHour = (start + range) % 24;
    const lastLabel = `${lastHour.toString().padStart(2, '0')}:00`;
    if (labels[labels.length - 1] !== lastLabel && labels[0] !== lastLabel) {
        labels.push(lastLabel);
    }
    return labels;
};

// Helper to get x-axis labels for custom range (show start, mid, end)
export const getCustomRangeLabelsLineGraph = (start: number, end: number) => {
    // If end < start, it means the range crosses midnight (e.g., 15 to 15 for 24h)
    let range = end - start;
    if (range <= 0) range += 24;
    const labels = Array(range + 1).fill('');
    const midIndex = Math.floor(labels.length / 2);
    const formatHour = (h: number) => {
        const hour24 = h % 24;
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const period = hour24 < 12 ? 'AM' : 'PM';
        return `${hour12 < 10 ? '0' : ''}${hour12}:00 ${period}`;
    };
    labels[0] = formatHour(start);
    labels[midIndex] = formatHour((start + midIndex) % 24);
    labels[labels.length - 1] = formatHour(end % 24);
    return labels;
};

export const getMaxGraceValueLineGraph = (data: number[]) => {
    const maxVal = Math.max(...data, 1);
    if ([1, 3, 6, 7].includes(maxVal)) return 1;
    if ([2, 5].includes(maxVal)) return 2;
    if (maxVal === 4) return 4;
    if (maxVal < 100) return 10;
    return 100;
};
