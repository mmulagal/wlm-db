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
import { getMaxGraceValueLineGraph } from '../ErrorInvestigationUtility';
import { formatTimeAMPM } from '../../../../../utils/utilityFunctions';

Chart.register(...registerables);

interface ErrorLineGraphProps {
    startTime: number;
    endTime: number;
    color: string;
    data: Array<{ hour: number; count: number }>;
}

const ErrorLineGraph = ({ startTime, endTime, color, data }: ErrorLineGraphProps) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { noData, investigationDatesLoading } = useAppSelector(state => state?.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    // Generate xLabels based on startTime and endTime (hourly)
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
    const allLabels = getHourLabelsBetween(startTime, endTime);
    // Only show first, middle, last labels, others are empty
    const xLabels = allLabels.map((label, idx) => {
        if (idx === 0) return formatTimeAMPM(label);
        if (idx === allLabels.length - 1) return formatTimeAMPM(label);
        if (idx === Math.floor((allLabels.length - 1) / 2)) return formatTimeAMPM(label);
        return '';
    });

    // Map hour to count for quick lookup
    const hourToCount: Record<string, number> = {};
    data.forEach(h => {
        const date = new Date(h.hour);
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        hourToCount[`${hour}:${minute}`] = h.count;
    });
    // Get errorCounts for each label (use allLabels for data, xLabels for display)
    const errorCounts = allLabels.map(label => hourToCount[label] || 0);

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
                            data: errorCounts, // use full errorCounts array
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
                                    // Use allLabels[dataIndex] for the correct time label
                                    const timeLabel = allLabels[dataIndex] ? formatTimeAMPM(allLabels[dataIndex]) : '';
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
    }, [startTime, endTime, noData, color, isDarkTheme, loading, data]);

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
