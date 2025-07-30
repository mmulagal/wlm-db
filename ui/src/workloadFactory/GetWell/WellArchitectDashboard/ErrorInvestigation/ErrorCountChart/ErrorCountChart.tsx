import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DsPopover, DsTypography } from '@tlveng/wlm-ds';
import styles from './ErrorCountChart.module.scss';
import { formatTimeAMPM } from '../../../../../utils/utilityFunctions';
import { getHourLabelsBetween } from '../ErrorInvestigationUtility';
import { MS_PER_HOUR } from '../../../../../utils/consts';

type ErrorCountChartProps = {
    startTime: number;
    endTime: number;
    hourlyErrorCounts?: { hour: number; count: number }[];
};

const MIN_LEFT_PERCENT = 1; // Minimum left percent to avoid markers being too close to the left edge
const MAX_RIGHT_PERCENT = 97; // Maximum left percent to avoid markers being too close to the right edge

const ErrorCountChart = ({ startTime, endTime, hourlyErrorCounts = [] }: ErrorCountChartProps) => {
    // Generate x-axis labels based on startTime and endTime
    const xAxisNumbers = useMemo(() => getHourLabelsBetween(startTime, endTime), [startTime, endTime]);

    // State to track hovered marker
    const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

    // Map hour to count for quick lookup
    const hourToCount: Record<string, number> = {};
    hourlyErrorCounts.forEach(h => {
        const date = new Date(h.hour);
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        hourToCount[`${hour}:${minute}`] = h.count;
    });
    // Markers: only for hours with count > 0
    const markedNumbers = xAxisNumbers.filter(label => hourToCount[label] && hourToCount[label] > 0);
    const range = endTime - startTime;
    const denominator = range > 0 ? range : 1;
    // Helper to get hour offset in ms
    const getOffset = (label: string, idx: number) => {
        // Use the actual timestamp for the label, not just hour
        const laterTime = startTime + idx * MS_PER_HOUR;
        return laterTime - startTime;
    };
    // Prevent label overlap: only show every Nth label if too many
    const maxLabels = 13;
    let labelStep = 1;
    if (xAxisNumbers.length > maxLabels) {
        labelStep = Math.ceil(xAxisNumbers.length / maxLabels) + 1;
    }
    // Helper to format time range for marker popover
    const formatRange = (h1: number, h2: number, min: string) => {
        const d1 = new Date();
        d1.setHours(h1, Number(min), 0, 0);
        const d2 = new Date();
        d2.setHours(h2, Number(min), 0, 0);
        // Remove AM/PM from the first part
        const first = formatTimeAMPM(`${d1.getHours().toString().padStart(2, '0')}:${min}`).replace(/\s?(AM|PM)/, '');
        const second = formatTimeAMPM(`${d2.getHours().toString().padStart(2, '0')}:${min}`);
        return `${first} - ${second}`;
    };

    // Get chart width in px for accurate marker width calculation
    const chartRef = useRef<HTMLDivElement>(null);
    const [chartWidthPx, setChartWidthPx] = useState(0);
    useEffect(() => {
        if (chartRef && chartRef.current) {
            setChartWidthPx(chartRef.current.offsetWidth);
        }
    }, [startTime, endTime]);

    // Prepare marker data
    const markerData = markedNumbers.map(num => {
        const idx = xAxisNumbers.indexOf(num);
        const offset = getOffset(num, idx);
        let leftPercent = (offset / denominator) * 100;
        leftPercent = Math.max(MIN_LEFT_PERCENT, Math.min(leftPercent, MAX_RIGHT_PERCENT));
        const count = hourToCount[num] || 0;
        const [hourStr, minuteStr] = num.split(':');
        const hour = Number(hourStr);
        let prevHour = hour - 1;
        if (prevHour < 0) prevHour = 23;
        // Show marker at the start of the interval (prevHour:minuteStr)
        const prevLabel = `${prevHour.toString().padStart(2, '0')}:${minuteStr}`;
        const prevIdx = xAxisNumbers.indexOf(prevLabel);
        let markerLeftPercent = leftPercent;
        if (prevIdx !== -1) {
            const prevOffset = getOffset(prevLabel, prevIdx);
            markerLeftPercent = (prevOffset / denominator) * 100;
            markerLeftPercent = Math.max(MIN_LEFT_PERCENT, Math.min(markerLeftPercent, MAX_RIGHT_PERCENT));
        }
        const timeRange = formatRange(prevHour, hour, minuteStr);
        return {
            num,
            markerLeftPercent,
            leftPercent,
            count,
            timeRange
        };
    });

    // Calculate intervalPx for 2 data point (index 1 to 2)
    let intervalPx = 0;
    if (xAxisNumbers.length > 2 && chartWidthPx > 0) {
        const getLeftPercent = (idx: number) => {
            const offset = getOffset(xAxisNumbers[idx], idx);
            return (offset / denominator) * 100;
        };
        const leftPercent2 = Math.max(MIN_LEFT_PERCENT, Math.min(getLeftPercent(1), MAX_RIGHT_PERCENT));
        const leftPercent3 = Math.max(MIN_LEFT_PERCENT, Math.min(getLeftPercent(2), MAX_RIGHT_PERCENT));
        intervalPx = (Math.abs(leftPercent3 - leftPercent2) / 100) * chartWidthPx - 1;
    } else if (xAxisNumbers.length === 2 && chartWidthPx > 0) {
        // For last 1 hour (2 datapoints), interval is 40% of chart width
        intervalPx = 0.4 * chartWidthPx;
    }

    // Prepare label data
    const labelData = xAxisNumbers.map((num, idx) => {
        const isLast = idx === xAxisNumbers.length - 1;
        const isFirst = idx === 0;
        const offset = getOffset(num, idx);
        const leftPercent = (offset / denominator) * 100;
        let textAlign: 'left' | 'right' | 'center' = 'center';
        if (isFirst) textAlign = 'left';
        else if (isLast) textAlign = 'right';
        let transform = 'translateX(-50%)';
        if (isFirst) transform = 'translateX(0)';
        else if (isLast) transform = 'translateX(-100%)';
        return {
            num,
            idx,
            isFirst,
            isLast,
            leftPercent,
            textAlign,
            transform
        };
    });

    return (
        <div className={styles.errorCountChart} ref={chartRef}>
            <div className={styles.bar} />
            {markerData.map(({ num, markerLeftPercent, count, timeRange }) => (
                <div key={`marker-${num}`}>
                    {/* Interval boundary on hover */}
                    {hoveredMarker === num && (
                        <div
                            className={styles.intervalBoundary}
                            style={{
                                left: `calc(${markerLeftPercent}%)`,
                                width: `${intervalPx}px`
                            }}
                        />
                    )}
                    <div
                        className={styles.markerWrapper}
                        style={{ left: `calc(${markerLeftPercent}%)` }}
                        onMouseEnter={() => setHoveredMarker(num)}
                        onMouseLeave={() => setHoveredMarker(null)}
                    >
                        <DsPopover title={`Time: ${timeRange} \nErrors: ${count}`} trigger="hover" placement="top">
                            <div
                                className={styles.marker}
                                style={{ width: `${Math.min(Math.max(2, count * 4), intervalPx)}px` }}
                            />
                        </DsPopover>
                    </div>
                </div>
            ))}
            <div className={styles.labels}>
                {labelData.map(({ num, idx, isFirst, isLast, leftPercent, textAlign, transform }) =>
                    idx % labelStep === 0 || isLast ? (
                        <div
                            key={`label-${num}-${Math.round(leftPercent * 1000)}-${startTime}-${endTime}`}
                            className={styles.label}
                            style={{
                                left: `calc(${leftPercent}%)`,
                                width: xAxisNumbers.length > 1 ? `max(55px, ${100 / denominator}%)` : 'auto',
                                textAlign,
                                transform
                            }}
                        >
                            <DsTypography variant="Regular_12" className={styles.labelText}>
                                {formatTimeAMPM(num, isFirst || isLast)}
                            </DsTypography>
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
};

export default ErrorCountChart;
