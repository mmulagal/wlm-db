import React from 'react';
import classNames from 'classnames';
import { Popover } from '@netapp/design-system/dist/components/Popover';
import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './ComparisonChart.module.scss';
import { Span } from '../Typography';
import { ChartColor, XCategories, fullColors, emptyColors, YTickFormatter } from './chartCommon';
import SeparatorComponent from '../../common/SeparatorComponent/SeparatorComponent';
import { compareDataAndCalculateDifference, formatNumberWithCustomComma } from '../../utils/utilityFunctions';

const ComparisonChartStack = React.memo(
    ({
        colors,
        data,
        categories,
        height = 200,
        yTickFormatter,
        tooltipHeading,
        tooltipText,
        tooltipHeadingFirst,
        tooltipTextFirst,
        loading = false,
        loadingWithNoData = false,
        marginTop = '150px',
        labelChange = false,
        labelChangeText = '',
        stackedBarColors
    }: {
        colors?: ChartColor[];
        data: number[][];
        categories: XCategories;
        height?: number;
        yTickFormatter?: YTickFormatter;
        tooltipHeading?: string[];
        tooltipText?: string[];
        tooltipHeadingFirst?: string[];
        tooltipTextFirst?: string[];
        loading?: boolean;
        loadingWithNoData?: boolean;
        marginTop?: string;
        labelChange?: boolean;
        labelChangeText?: string;
        stackedBarColors?: ChartColor[];
    }) => {
        let max = 0;
        for (const stack of data) {
            const stackSum = stack.reduce((acc, val) => acc + val, 0);
            max = Math.max(max, stackSum);
        }

        const hasData = max > 0;

        const compareArrayValues = compareDataAndCalculateDifference(data);

        return (
            <div className={styles.base} style={{ height, marginTop: loadingWithNoData ? marginTop : '0' }}>
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
                                        {!loadingWithNoData && (
                                            <Span bold>
                                                {yTickFormatter ? yTickFormatter(total, index, data) : total}
                                            </Span>
                                        )}
                                        {loadingWithNoData && <Span bold>$0</Span>}
                                        {loading && (
                                            <span>
                                                <DsFlashingDotsLoader />
                                            </span>
                                        )}
                                    </div>
                                )}
                                {stack.length === 1 && (
                                    <>
                                        {loadingWithNoData && (
                                            <div
                                                className={styles.datum}
                                                style={{
                                                    height: `${(stack[0] / max) * 100}%`,
                                                    backgroundColor: 'var(--chart-disabled)'
                                                }}
                                            />
                                        )}
                                        {!loadingWithNoData && (
                                            <div
                                                className={styles.datum}
                                                style={{
                                                    height: `${(stack[0] / max) * 100}%`,
                                                    backgroundColor: 'var(--chart-9)'
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                                {stack.length > 1 && (
                                    <div
                                        className={styles.datum}
                                        style={{
                                            height: `${(total / max) * 100}%`,
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        {[...stack].reverse().map((value, revIndex) => {
                                            const stackIndex = stack.length - 1 - revIndex;
                                            const percentage = total > 0 ? (value / total) * 100 : 0;
                                            const colorSet = index === 0 ? colors : (stackedBarColors || colors);
                                            const backgroundColor = colorSet
                                                ? `var(--${colorSet[stackIndex]})`
                                                : fullColors[stackIndex];

                                            return (
                                                <div
                                                    key={stackIndex}
                                                    style={{
                                                        height: `${percentage}%`,
                                                        width: '100%'
                                                    }}
                                                >
                                                    <Popover
                                                        popoverClass={styles.popover}
                                                        isAppendedToBody
                                                        placement="auto"
                                                        trigger="hover"
                                                        container={
                                                            <div
                                                                className={styles.stackSegment}
                                                                style={{
                                                                    height: '100%',
                                                                    backgroundColor
                                                                }}
                                                            />
                                                        }
                                                    >
                                                        <div className={styles.tooltipContainer}>
                                                        <div className={styles.tooltipContentRowFirst}>
                                                            <div
                                                                className={styles.squareChart2}
                                                                style={{ backgroundColor }}
                                                            />
                                                            {(index === 0
                                                                ? (tooltipHeadingFirst?.[stackIndex] || tooltipHeading?.[stackIndex])
                                                                : tooltipHeading?.[stackIndex]) && (
                                                                <>
                                                                    <DsTypography variant="Semibold_14">
                                                                        {index === 0
                                                                            ? (tooltipHeadingFirst?.[stackIndex] || tooltipHeading?.[stackIndex])
                                                                            : tooltipHeading?.[stackIndex]}
                                                                    </DsTypography>
                                                                    <SeparatorComponent variant="vertical" height="20px" />
                                                                </>
                                                            )}
                                                            <DsTypography variant="Semibold_14">
                                                                {index === 0
                                                                    ? (tooltipTextFirst?.[stackIndex] || tooltipText?.[stackIndex])
                                                                    : tooltipText?.[stackIndex]}
                                                            </DsTypography>
                                                        </div>
                                                            <DsTypography
                                                                variant="Semibold_14"
                                                                style={{ marginBottom: '8px' }}
                                                            >
                                                                ${formatNumberWithCustomComma(data[index]?.[stackIndex])}
                                                            </DsTypography>
                                                        </div>
                                                    </Popover>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {stack.length === 1 && (
                                <>
                                    {!loadingWithNoData && (
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
                                    {loadingWithNoData && index === 0 && (
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
                                    {loadingWithNoData && index > 0 && (
                                        <div className={styles.xLabel}>
                                            {labelChange && (
                                                <div className={styles.xContainer}>
                                                    <DsTypography variant="Semibold_14">{labelChangeText}</DsTypography>
                                                </div>
                                            )}
                                            {!labelChange && (
                                                <div className={styles.xContainer}>
                                                    <div className={styles.xContainerInner}>
                                                        <div className={styles.squareChart3} />
                                                        <DsTypography variant="Semibold_14">EBS</DsTypography>
                                                    </div>
                                                    <div className={styles.xContainerInner}>
                                                        <div className={styles.squareChart2} />
                                                        <DsTypography variant="Semibold_14">FSxW</DsTypography>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            {stack.length === 2 && (
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
                        </div>
                    );
                })}
            </div>
        );
    }
);

export default ComparisonChartStack;
