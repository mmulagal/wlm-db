import React, { useState } from 'react';
import classNames from 'classnames';
import styles from './ComparisonChart.module.scss';
import { Span } from '../Typography';
import { ChartColor, XCategories, fullColors, emptyColors, YTickFormatter } from './chartCommon';
import { Popover } from '@netapp/design-system/dist/components/Popover';
import { DsTypography } from '@netapp/design-system';
import SeparatorComponent from '../../common/SeparatorComponent/SeparatorComponent';

const ComparisonChartStack = React.memo(
    ({
        colors,
        data,
        categories,
        height = 200,
        yTickFormatter,
        tooltipHeading,
        tooltipText
    }: {
        colors?: ChartColor[];
        data: number[][];
        categories: XCategories;
        height?: number;
        yTickFormatter?: YTickFormatter;
        tooltipHeading?: any;
        tooltipText?: any;
    }) => {
        let max = 0;
        for (const stack of data) {
            const stackSum = stack.reduce((acc, val) => acc + val, 0);
            max = Math.max(max, stackSum);
        }

        const hasData = max > 0;

        return (
            <div className={styles.base} style={{ height }}>
                {data.map((stack, index) => {
                    const total = stack.reduce((acc, val) => acc + val, 0);
                    return (
                        <div
                            key={index}
                            className={classNames(styles.column, { [styles.hasData]: hasData })}
                            style={{ height: hasData ? 'auto' : '96px' }}
                        >
                            <div className={styles.datumContainer}>
                                {hasData && (
                                    <div className={styles.yLabel} style={{ top: `${100 - (total / max) * 100}%` }}>
                                        <Span bold>{yTickFormatter ? yTickFormatter(total, index, data) : total}</Span>
                                    </div>
                                )}
                                {stack.length === 1 && (
                                    <div
                                        className={styles.datum}
                                        style={{
                                            height: `${(stack[0] / max) * 100}%`,
                                            backgroundColor: 'var(--chart-9)'
                                        }}
                                    />
                                )}
                                {stack.length > 1 && (
                                    <div className={styles.datum} style={{ height: `${100}%` }}>
                                        {stack.map((value, stackIndex) => {
                                            const percentage = (value / max) * 100;
                                            const backgroundColor = colors
                                                ? `var(--${colors[stackIndex]})`
                                                : fullColors[stackIndex];
                                            return (
                                                <Popover
                                                    popoverClass={styles['popover']}
                                                    isAppendedToBody={true}
                                                    placement="auto"
                                                    children={
                                                        <div className={styles.tooltipContainer}>
                                                            <div className={styles.tooltipContentRowFirst}>
                                                                {stackIndex === 1 && (
                                                                    <div className={styles.squareChart3} />
                                                                )}
                                                                {stackIndex === 0 && (
                                                                    <div className={styles.squareChart2} />
                                                                )}
                                                                <DsTypography variant="Semibold_14">
                                                                    {stackIndex === 1 ? tooltipHeading[0] : ''}
                                                                </DsTypography>
                                                                {stackIndex === 1 && (
                                                                    <SeparatorComponent
                                                                        variant="vertical"
                                                                        height="20px"
                                                                    />
                                                                )}
                                                                <DsTypography variant="Semibold_14">
                                                                    {stackIndex === 1 ? tooltipText[0] : tooltipText[1]}
                                                                </DsTypography>
                                                            </div>
                                                            <DsTypography
                                                                variant="Semibold_14"
                                                                style={{ marginBottom: '8px' }}
                                                            >
                                                                $6,475
                                                            </DsTypography>
                                                        </div>
                                                    }
                                                    trigger={'hover'}
                                                    container={
                                                        <div
                                                            key={stackIndex}
                                                            className={styles.stackSegment}
                                                            style={{
                                                                height: `${percentage}%`,
                                                                backgroundColor
                                                            }}
                                                        />
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {stack.length === 1 && (
                                <div className={styles.xLabel}>
                                    <Span
                                        bold
                                        className={styles.spanStyle}
                                        title={categories[index]}
                                        color={hasData ? undefined : 'text-disabled'}
                                    >
                                        {categories[index]}
                                    </Span>
                                </div>
                            )}
                            {stack.length === 2 && (
                                <div className={styles.xLabel}>
                                    <div className={styles.xContainer}>
                                        <div className={styles.xContainerInner}>
                                            <div className={styles.squareChart2} />
                                            <DsTypography variant="Semibold_14">EBS</DsTypography>
                                        </div>
                                        <div className={styles.xContainerInner}>
                                            <div className={styles.squareChart3} />
                                            <DsTypography variant="Semibold_14">FSxW</DsTypography>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }
);

export default ComparisonChartStack;
