import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    Title,
    Tooltip,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import React, { useMemo, useState } from 'react';
import styles from './ChartStyles.module.scss';

import { Span } from '../../../../ui-components/Typography';
import { useCurrentTheme } from '../../../../common/ThemeProvider/ThemeProvider2';
import {
    ChartColor,
    hexToRgb,
    XCategories,
    YTickFormatter,
    XYData
} from '../../../../ui-components/Charts/chartCommon';
import { useAppSelector } from '../../../../store/storeHooks';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const LineGraph = React.memo(
    ({
        color = '#A815F3',
        data,
        height = 200,
        categories,
        yTickFormatter,
        legend
    }: {
        color?: any;
        data: number[] | XYData[] | number[][];
        legend?: string[];
        categories?: XCategories;
        height?: number;
        yTickFormatter?: YTickFormatter;
    }) => {
        const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

        const [chartContext, setChartContext] = useState<any>(null);
        const { tokens } = useCurrentTheme();

        const state = useMemo(() => {
            if (!chartContext) {
                return {
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    },
                    data: { labels: categories, datasets: [] }
                };
            }

            const gradient = () => {
                const colorAsRgb = hexToRgb(color);
                // @ts-ignore
                const gradient = chartContext.createLinearGradient(0, 0, 0, legend ? height - 20 : height);
                gradient.addColorStop(0, `rgba(${colorAsRgb[0]},${colorAsRgb[1]},${colorAsRgb[2]}, 0.1)`);
                gradient.addColorStop(1, `rgba(${colorAsRgb[0]},${colorAsRgb[1]},${colorAsRgb[2]}, 0)`);

                return gradient;
            };

            const labels = categories;

            const datasets = (!Array.isArray(data[0]) ? [data] : data).map((values, index, arr) => {
                const colorRgb = Array.isArray(color) ? color[index] : color;

                return {
                    data: values,
                    pointBackgroundColor: colorRgb,
                    backgroundColor: arr.length === 1 ? undefined : colorRgb,
                    fill: arr.length === 1,
                    pointBorderColor: tokens['--content-background'],
                    borderColor: colorRgb,
                    label: legend?.[index]
                };
            });

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 50,
                layout: {
                    padding: 0
                },
                fill: true,
                elements: {
                    line: {
                        backgroundColor: datasets.length > 1 ? 'transparent' : gradient()
                    },
                    point: {
                        radius: 6,
                        pointHoverRadius: 8,
                        pointHoverBorderWidth: 2,
                        pointHoverBorderColor: 'white',
                        borderWidth: 2,
                        borderColor: 'white'
                    }
                },
                scales: {
                    x: {
                        border: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            padding: 0,
                            backdropPadding: 0,
                            color: isDarkTheme ? '#ffffff' : '#404040',
                            font: {
                                size: 13,
                                lineHeight: '20px',
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                            }
                        }
                    },
                    y: {
                        border: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: '#e0e0e0',
                            tickLength: 0
                        },
                        ticks: {
                            padding: 16,
                            backdropPadding: 0,
                            color: isDarkTheme ? '#ffffff' : '#404040',
                            callback: yTickFormatter,
                            font: {
                                size: 13,
                                lineHeight: '20px',
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        enabled: false
                    },
                    legend: {
                        display: false
                    }
                }
            };

            return { options, data: { labels, datasets } };
        }, [tokens, data, categories, legend, color, height, yTickFormatter, chartContext]);

        return (
            <div className={styles.base} style={{ height: legend ? height - 20 : height }}>
                {legend && (
                    <div className={styles.legend}>
                        {legend.map((label, index) => {
                            const backgroundColor = Array.isArray(color) ? color[index] : color;
                            return (
                                <div key={label}>
                                    <div className={styles.box} style={{ backgroundColor }} />
                                    <Span level={13}>{label}</Span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <Line
                    ref={chart => chart?.ctx && setChartContext(chart.ctx)}
                    options={state.options}
                    data={state.data}
                />
            </div>
        );
    }
);

export default LineGraph;
