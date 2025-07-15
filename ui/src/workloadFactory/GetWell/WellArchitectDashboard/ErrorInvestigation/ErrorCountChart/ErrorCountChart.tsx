import React, { useMemo } from 'react';
import { DsPopover, DsTypography } from '@tlveng/wlm-ds';
import styles from './ErrorCountChart.module.scss';
import { formatTimeAMPM } from '../../../../../utils/utilityFunctions';

// New helper to generate hour labels between two timestamps (inclusive)
const getHourLabelsBetween = (start: number, end: number) => {
    const labels = [];
    for (let t = start; t <= end; t += 60 * 60 * 1000) {
        const date = new Date(t);
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        labels.push(`${hour}:${minute}`);
    }
    return labels;
};

type ErrorCountChartProps = {
    startTime: number;
    endTime: number;
    hourlyErrorCounts?: { hour: number; count: number }[];
};

const ErrorCountChart = ({ startTime, endTime, hourlyErrorCounts = [] }: ErrorCountChartProps) => {
    // Generate x-axis labels based on startTime and endTime
    const xAxisNumbers = useMemo(() => getHourLabelsBetween(startTime, endTime), [startTime, endTime]);
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
        const t = startTime + idx * 60 * 60 * 1000;
        return t - startTime;
    };
    // Prevent label overlap: only show every Nth label if too many
    const maxLabels = 13;
    let labelStep = 1;
    if (xAxisNumbers.length > maxLabels) {
        labelStep = Math.ceil(xAxisNumbers.length / maxLabels);
    }
    return (
        <div className={styles.errorCountChart}>
            <div className={styles.bar} />
            {markedNumbers.map(num => {
                const idx = xAxisNumbers.indexOf(num);
                const offset = getOffset(num, idx);
                const leftPercent = (offset / denominator) * 100;
                // Find the count for this hour
                const count = hourToCount[num] || 0;
                // Calculate previous hour for range
                const [hourStr, minuteStr] = num.split(':');
                const hour = Number(hourStr);
                let prevHour = hour - 1;
                if (prevHour < 0) prevHour = 23;
                // Format time range string
                const formatRange = (h1: number, h2: number, min: string) => {
                    const d1 = new Date();
                    d1.setHours(h1, Number(min), 0, 0);
                    const d2 = new Date();
                    d2.setHours(h2, Number(min), 0, 0);
                    // Remove AM/PM from the first part
                    const first = formatTimeAMPM(`${d1.getHours().toString().padStart(2, '0')}:${min}`).replace(
                        /\s?(AM|PM)/,
                        ''
                    );
                    const second = formatTimeAMPM(`${d2.getHours().toString().padStart(2, '0')}:${min}`);
                    return `${first} - ${second}`;
                };
                const timeRange = formatRange(prevHour, hour, minuteStr);
                return (
                    <div
                        key={`marker-${num}`}
                        className={styles.markerWrapper}
                        style={{ left: `calc(${leftPercent}%)` }}
                    >
                        <DsPopover title={`Time: ${timeRange} \nErrors: ${count}`} trigger="hover" placement="top">
                            <div className={styles.marker} style={{ width: `${Math.max(2, count * 4)}px` }} />
                        </DsPopover>
                    </div>
                );
            })}
            <div className={styles.labels}>
                {xAxisNumbers.map((num, idx) => {
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
                    return idx % labelStep === 0 || isLast ? (
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
                    ) : null;
                })}
            </div>
        </div>
    );
};

export default ErrorCountChart;
