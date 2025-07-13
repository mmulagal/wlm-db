import React, { useMemo } from 'react';
import { DsPopover, DsTypography } from '@tlveng/wlm-ds';
import styles from './ErrorCountChart.module.scss';
import { formatTimeAMPM } from '../../../../../utils/utilityFunctions';
import { getFixedHourLabelsErrorCount } from '../ErrorInvestigationUtility';

type ErrorCountChartProps = {
    startTime: number;
    endTime: number;
    markedNumbers: string[];
};

const ErrorCountChart = ({ startTime, endTime, markedNumbers }: ErrorCountChartProps) => {
    // Always recalculate xAxisNumbers based on startTime and endTime for consistency with ErrorLineGraph
    const xAxisNumbers = useMemo(() => getFixedHourLabelsErrorCount(startTime, endTime), [startTime, endTime]);
    // Calculate denominator for proportional positioning
    const range = endTime - startTime <= 0 ? endTime - startTime + 24 : endTime - startTime;
    const denominator = range > 0 ? range : 1;
    // Helper to get hour from label string
    const getHour = (label: string) => parseInt(label.split(':')[0], 10);
    // Only draw markers for markedNumbers within the range
    const inRangeMarkedNumbers = markedNumbers.filter(num => {
        const hour = getHour(num);
        let pos = hour - startTime;
        if (pos < 0) pos += 24;
        return pos >= 0 && pos <= range;
    });
    // Prevent label overlap: only show every Nth label if too many
    const maxLabels = 13;
    let labelStep = 1;
    if (xAxisNumbers.length > maxLabels) {
        labelStep = Math.ceil(xAxisNumbers.length / maxLabels);
    }
    return (
        <div className={styles.errorCountChart}>
            <div className={styles.bar} />
            {inRangeMarkedNumbers.map(num => {
                const hour = getHour(num);
                let pos = hour - startTime;
                if (pos < 0) pos += 24;
                const leftPercent = (pos / denominator) * 100;
                return (
                    <div
                        key={`marker-${num}`}
                        className={styles.markerWrapper}
                        style={{
                            left: `calc(${leftPercent}%)`
                        }}
                    >
                        <DsPopover title={`Time: ${formatTimeAMPM(num)}`} trigger="hover" placement="top">
                            <div className={styles.marker} />
                        </DsPopover>
                    </div>
                );
            })}
            <div className={styles.labels}>
                {xAxisNumbers.map((num, idx) => {
                    const isLast = idx === xAxisNumbers.length - 1;
                    const isFirst = idx === 0;
                    // Calculate position for this label
                    let leftPercent;
                    if (isLast) {
                        leftPercent = 100;
                    } else {
                        const hourOffset =
                            getHour(num) - startTime < 0 ? getHour(num) - startTime + 24 : getHour(num) - startTime;
                        leftPercent = (hourOffset / denominator) * 100;
                    }
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
                                width: xAxisNumbers.length > 1 ? `max(40px, ${100 / denominator}%)` : 'auto',
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
