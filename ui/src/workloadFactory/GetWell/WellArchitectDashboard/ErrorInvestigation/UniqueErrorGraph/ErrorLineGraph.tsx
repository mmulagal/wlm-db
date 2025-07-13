/* eslint-disable consistent-return */
import React, { useEffect, useRef } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Chart, registerables } from 'chart.js';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import styles from './UniqueErrorGraph.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { hexToRgb } from '../../../../../ui-components/Charts/chartCommon';
import { ReactComponent as NoData } from '../../../../../assets/empty_table_message.svg';
import { ReactComponent as LoadingEmptyGraph } from '../../../../../assets/loading_empty_graph.svg';
import { getCustomRangeLabelsLineGraph, getMaxGraceValueLineGraph } from '../ErrorInvestigationUtility';

Chart.register(...registerables);

interface ErrorLineGraphProps {
    startTime: number;
    endTime: number;
    color: string;
}

const ErrorLineGraph = ({ startTime, endTime, color }: ErrorLineGraphProps) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { noData, investigationDatesLoading } = useAppSelector(state => state?.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    // Calculate correct number of points for the range, handling wrap-around

    const xLabels = getCustomRangeLabelsLineGraph(startTime, endTime);

    // Will update once we start getting actual values from the backend
    const errorCounts = Array.from({ length: xLabels.length }, () => Math.floor(Math.random() * 8)); // 24 hourly error counts

    const disableColor = () => {
        let tickColor;
        if (loading) {
            if (isDarkTheme) {
                tickColor = '#ffffff';
            } else {
                tickColor = '#1C1C1C';
            }
        } else if (isDarkTheme) {
            tickColor = '#858C95';
        } else {
            tickColor = '#A7A7A7';
        }
        return tickColor;
    };

    useEffect(() => {
        const ctx = chartRef.current?.getContext('2d');
        if (!ctx) return;
        // const chartColor = color;
        const colorAsRgb = hexToRgb(color);
        const gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0.8, `rgba(${colorAsRgb[0]},${colorAsRgb[1]},${colorAsRgb[2]}, 0.1)`);
        gradient.addColorStop(1, `rgba(${colorAsRgb[0]},${colorAsRgb[1]},${colorAsRgb[2]}, 0)`);

        let chart;
        if (noData || loading) {
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: xLabels,
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        filler: { propagate: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: disableColor(),
                                font: {
                                    size: 13,
                                    lineHeight: '20px',
                                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                                },
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0
                            },
                            offset: true
                        },
                        y: {
                            border: {
                                color: isDarkTheme ? '#858C95' : '#222',
                                width: 1
                            },
                            grid: {
                                color: '#e0e0e0',
                                tickLength: 0
                            },
                            beginAtZero: true,
                            grace: 12,
                            ticks: {
                                color: disableColor(),
                                font: {
                                    size: 13,
                                    lineHeight: '20px',
                                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                                },
                                maxTicksLimit: 5,
                                callback(value) {
                                    return `${value} Errors `;
                                }
                            }
                        }
                    },
                    interaction: { intersect: false }
                }
            });
        } else {
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: xLabels,
                    datasets: [
                        {
                            label: 'Errors',
                            data: errorCounts,
                            borderColor: '#FDC300',
                            backgroundColor: gradient,
                            pointBackgroundColor: color,
                            pointBorderColor: '#fff',
                            pointRadius: 6,
                            borderWidth: 3,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        filler: {
                            propagate: false
                        },
                        tooltip: {
                            enabled: false, // Disable the default tooltip
                            external(context) {
                                let tooltipEl = document.getElementById('chartjs-tooltip');

                                // Create the tooltip element if it doesn't exist
                                if (!tooltipEl) {
                                    tooltipEl = document.createElement('div');
                                    tooltipEl.id = 'chartjs-tooltip';
                                    tooltipEl.style.position = 'absolute';
                                    tooltipEl.style.background = 'var(--content-background)';
                                    tooltipEl.style.border = 'none';
                                    tooltipEl.style.padding = '8px 12px';
                                    tooltipEl.style.pointerEvents = 'none';
                                    tooltipEl.style.borderRadius = '5px';
                                    tooltipEl.style.fontSize = '13px';
                                    tooltipEl.style.zIndex = '20';
                                    tooltipEl.style.boxShadow = '4px 4px 12px 0px #E0E0E0';
                                    document.body.appendChild(tooltipEl);
                                }

                                const tooltipModel = context.tooltip;

                                // Hide the tooltip if there is no data
                                if (tooltipModel.opacity === 0) {
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-ignore
                                    tooltipEl.style.opacity = 0;
                                    return;
                                }

                                // Set tooltip position
                                const position = context.chart.canvas.getBoundingClientRect();
                                tooltipEl.style.left = `${position.left + window.pageXOffset + tooltipModel.caretX}px`;
                                tooltipEl.style.top = `${position.top + window.pageYOffset + tooltipModel.caretY}px`;
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                tooltipEl.style.opacity = 1;

                                // Clear existing content
                                while (tooltipEl.firstChild) {
                                    tooltipEl.removeChild(tooltipEl.firstChild);
                                }

                                // Build the tooltip content safely
                                tooltipModel.body.forEach(item => {
                                    const { dataIndex } = tooltipModel.dataPoints[0];
                                    const hour = (startTime + dataIndex) % 24; // for 24h wrap-around
                                    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
                                    const period = hour < 12 ? 'AM' : 'PM';
                                    const timeLabel = `${hour12 < 10 ? '0' : ''}${hour12}:00 ${period}`;
                                    const label = item.lines[0];

                                    // Row container
                                    const row = document.createElement('div');
                                    row.style.display = 'flex';
                                    row.style.flexDirection = 'column';
                                    row.style.gap = '10px';
                                    row.style.marginBottom = '8px';

                                    // First line - time text
                                    const timeText = document.createElement('span');
                                    timeText.style.fontSize = '13px';
                                    timeText.style.color = 'var(--text-primary)';
                                    timeText.textContent = `Time: ${timeLabel}`;

                                    // Second line - label text
                                    const labelText = document.createElement('span');
                                    labelText.style.fontSize = '13px';
                                    labelText.style.color = 'var(--text-primary)';
                                    labelText.textContent = label;

                                    row.appendChild(timeText);
                                    row.appendChild(labelText);
                                    tooltipEl.appendChild(row);
                                });
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: isDarkTheme ? '#ffffff' : '#1C1C1C',
                                font: {
                                    size: 13,
                                    lineHeight: '20px',
                                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                                },
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0
                            }
                        },
                        y: {
                            border: {
                                color: isDarkTheme ? '#ffffff' : '#A7A7A7',
                                width: 1
                            },
                            grid: {
                                color: '#e0e0e0',
                                tickLength: 0
                            },
                            beginAtZero: true,
                            grace: getMaxGraceValueLineGraph(errorCounts),
                            ticks: {
                                color: isDarkTheme ? '#ffffff' : '#1C1C1C',
                                font: {
                                    size: 13,
                                    lineHeight: '20px',
                                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
                                },
                                maxTicksLimit: 5,
                                callback(value) {
                                    return `${value} Errors `;
                                }
                            }
                        }
                    },
                    interaction: { intersect: false }
                }
            });
        }

        // Cleanup: destroy chart and remove tooltip
        return () => {
            chart.destroy();

            // Remove tooltip from DOM
            const tooltipEl = document.getElementById('chartjs-tooltip');
            if (tooltipEl && tooltipEl.parentNode) {
                tooltipEl.parentNode.removeChild(tooltipEl);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTime, endTime, noData, color, isDarkTheme, loading]);

    return (
        <>
            {noData && (
                <div className={styles.noData}>
                    <NoData />
                </div>
            )}
            {loading && (
                <div className={styles.noData}>
                    <LoadingEmptyGraph />
                    <div className={styles.loadingText}>
                        <DsTypography variant="Regular_14">Loading data</DsTypography>
                        <DsFlashingDotsLoader />
                    </div>
                </div>
            )}
            <canvas ref={chartRef} width={600} height={220} className={styles['chart-canvas']} />
        </>
    );
};

export default ErrorLineGraph;
