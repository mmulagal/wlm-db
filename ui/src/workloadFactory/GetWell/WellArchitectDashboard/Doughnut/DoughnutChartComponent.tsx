import React, { useState } from 'react';
import _ from 'lodash';
import styles from './DonutChart.module.scss';
import classNames from 'classnames';
import Measure from 'react-measure';

import { fullColorsToken, ChartColor, ValueFormatter, ChartDisabled } from './chartCommon';
import { Doughnut } from 'react-chartjs-2';

import { ArcElement, Chart as ChartJS } from 'chart.js';
import { useCurrentTheme } from '../../../../common/ThemeProvider/ThemeProvider2';
import { Heading, Span } from '../../../../ui-components/Typography';

type DonutSize = 'lg' | 'sm';

ChartJS.register(ArcElement);

const Total = ({
    valueFormatter,
    label,
    unit: _unit,
    value: _value,
    width
}: {
    unit?: string;
    value?: string | number;
    label?: string;
    valueFormatter?: ValueFormatter;
    width: any;
}) => {
    const [isSmallText, setSmallText] = useState(false);

    let unit = _unit;
    let value = _value;
    if (valueFormatter) {
        const formatted = valueFormatter(
            Number.isFinite(value) ? (value as number) : Number.parseFloat(value as string)
        );
        unit = formatted.unit;
        value = formatted.value;
    }

    return (
        <div className={styles.total}>
            {/* @ts-ignore */}
            <Measure bounds>
                {({ measureRef, contentRect }) => {
                    if ((contentRect?.bounds?.width ?? 0) > width - 40 && !isSmallText) {
                        setTimeout(() => {
                            setSmallText(true);
                        });
                    }
                    return (
                        <div ref={measureRef}>
                            <Heading
                                level={isSmallText ? 24 : 32}
                                style={{ lineHeight: isSmallText ? '28px' : '32px' }}
                            >
                                {value}
                            </Heading>
                            {unit && (
                                <Heading level={isSmallText ? 16 : 20} bold={false} style={{ lineHeight: '24px' }}>
                                    {unit}
                                </Heading>
                            )}
                        </div>
                    );
                }}
            </Measure>
            {label && <Span>{label}</Span>}
        </div>
    );
};

const DonutChart = React.memo(
    ({
        showTotal = true,
        data,
        unit,
        value,
        label,
        valueFormatter,
        colors = fullColorsToken,
        size = 'lg',
        includeTotalRing = false,
        totalRingColor = 'chart-disabled'
    }: {
        size?: DonutSize;
        showTotal?: boolean;
        data: number[] | number[][];
        unit?: string;
        value?: string | number;
        label?: string;
        valueFormatter?: ValueFormatter;
        colors?: any;
        includeTotalRing?: boolean;
        totalRingColor?: ChartColor | ChartDisabled;
    }) => {
        const tokens = useCurrentTheme().tokens;
        const isMulti = Array.isArray(data[0]);
        const sizePx = styles[`var_${size}`];

        const sum = isMulti ? _.sum(data[0] as number[]) : _.sum(data);

        let cutout = '80%';

        if (sum === 0) {
            cutout = '82%';
        } else if (isMulti) {
            cutout = '64%';
        }

        const options = {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: 0
            },
            cutout,
            borderAlign: 'inner',
            borderColor: tokens['--content-background'],
            borderWidth: sum === 0 ? 0 : 1,
            plugins: {
                tooltip: {
                    enabled: false
                },
                legend: {
                    display: false
                }
            }
        };

        const _data =
            sum === 0
                ? {
                      labels: [],
                      datasets: [
                          {
                              data: [1],
                              backgroundColor: [tokens['--chart-disabled']]
                          }
                      ]
                  }
                : {
                      labels: [],
                      datasets: (isMulti ? data : [data]).map((values, index) => {
                          let weight = undefined;

                          if (isMulti || includeTotalRing) {
                              weight = index === 0 ? 0.57 : 0.43;
                          }

                          return {
                              data: values,
                              backgroundColor: (Array.isArray(colors[0])
                                  ? (colors[index] as ChartColor[])
                                  : colors
                              ).map((color: any) => color),
                              weight
                          };
                      })
                  };

        if (includeTotalRing && sum !== 0) {
            // @ts-ignore
            _data.datasets = _data.datasets.concat([
                {
                    data: [sum],
                    backgroundColor: [tokens[`--${totalRingColor}`]],
                    weight: 0.1,
                    // @ts-ignore
                    borderWidth: 0
                }
            ]);
        }

        return (
            <div className={classNames(styles.base, styles[size])}>
                <Doughnut options={options} data={_data} />

                {showTotal && (
                    <Total
                        width={sizePx}
                        valueFormatter={valueFormatter}
                        label={label}
                        unit={unit}
                        value={value !== undefined ? value : sum}
                    />
                )}
            </div>
        );
    }
);

export default DonutChart;
