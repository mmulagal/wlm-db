import React from 'react';
import classNames from 'classnames';
import { Popover } from '@netapp/design-system/dist/components/Popover';
import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { ChartColor, XCategories, fullColors, emptyColors, YTickFormatter } from './chartCommon';
import styles from './ComparisonChart.module.scss';
import { Span } from '../Typography';
import { formatNumberWithCustomComma } from '../../utils/utilityFunctions';

const ComparisonChart = React.memo(
    ({
        colors,
        data,
        categories,
        height = 200,
        loading = false,
        yTickFormatter,
        tooltipText
    }: {
        colors?: ChartColor[];
        data: number[];
        categories: XCategories;
        height?: number;
        loading?: boolean;
        yTickFormatter?: YTickFormatter;
        tooltipText?: string[];
    }) => {
        let max = 0;
        for (const datum of data) {
            max = Math.max(max, datum);
        }

        const hasData = max > 0;

        return (
            <div className={styles.base} style={{ height }}>
                {data.map((datum, index) => {
                    const percentage = hasData ? (datum / max) * 100 : 100;
                    let backgroundColor = fullColors[index];
                    if (hasData) {
                        if (colors) {
                            backgroundColor = `var(--${colors[index]})`;
                        }
                    } else {
                        backgroundColor = emptyColors[0];
                    }

                    const barElement = (
                        <div className={styles.datum} style={{ height: `${percentage}%`, backgroundColor }} />
                    );

                    return (
                        <div
                            key={index}
                            className={classNames(styles.column, { [styles.hasData]: hasData })}
                            style={{ height: hasData ? 'auto' : '96px' }}
                        >
                            <div className={styles.datumContainer}>
                                {hasData && (
                                    <div className={styles.yLabel} style={{ top: `${100 - percentage}%` }}>
                                        <Span bold>{yTickFormatter ? yTickFormatter(datum, index, data) : datum}</Span>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                )}
                                {tooltipText?.[index] ? (
                                    <div style={{ height: `${percentage}%`, width: '100%', alignSelf: 'flex-end' }}>
                                        <Popover
                                            popoverClass={styles.popover}
                                            isAppendedToBody
                                            placement="auto"
                                            trigger="hover"
                                            container={
                                                <div
                                                    className={styles.datum}
                                                    style={{
                                                        height: '100%',
                                                        backgroundColor
                                                    }}
                                                />
                                            }
                                        >
                                            <div className={styles.tooltipContainer}>
                                                <div className={styles.tooltipContentRowFirst}>
                                                    <div className={styles.squareChart2} style={{ backgroundColor }} />
                                                    <DsTypography variant="Semibold_14">
                                                        {tooltipText[index]}
                                                    </DsTypography>
                                                </div>
                                                <DsTypography variant="Semibold_14" style={{ marginBottom: '8px' }}>
                                                    ${formatNumberWithCustomComma(datum)}
                                                </DsTypography>
                                            </div>
                                        </Popover>
                                    </div>
                                ) : (
                                    barElement
                                )}
                            </div>
                            <div className={styles.xLabel}>
                                <Span
                                    bold
                                    // ellipsis
                                    className={styles.spanStyle}
                                    title={categories[index]}
                                    color={hasData ? undefined : 'text-disabled'}
                                >
                                    {categories[index]}
                                </Span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
);

export default ComparisonChart;
