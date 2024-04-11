import { ChartColor, XCategories, fullColors, emptyColors, YTickFormatter } from './chartCommon';
import React from 'react';
import styles from './ComparisonChart.module.scss';
import { Span } from '../Typography';
import classNames from 'classnames';

const ComparisonChart = React.memo(
    ({
        colors,
        data,
        categories,
        height = 200,
        yTickFormatter
    }: {
        colors?: ChartColor[];
        data: number[];
        categories: XCategories;
        height?: number;
        yTickFormatter?: YTickFormatter;
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
                                    </div>
                                )}
                                <div className={styles.datum} style={{ height: `${percentage}%`, backgroundColor }} />
                            </div>
                            <div className={styles.xLabel}>
                                <Span
                                    bold
                                    //ellipsis
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
