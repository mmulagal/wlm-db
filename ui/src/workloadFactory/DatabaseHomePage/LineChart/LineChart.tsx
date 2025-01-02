import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { ReactComponent as NoData } from '../../../assets/empty table message.svg';
import styles from './LineChart.module.scss';
import { getShiftedHoursList, last14Days, last30Days, lastSevenDays } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';

Chart.register(...registerables);

type colorCodes = {
    startColor: string;
    endColor: string;
    selectedTimeFrame: string;
    timelineData: any;
};

const LineChart = ({ startColor, endColor, selectedTimeFrame, timelineData }: colorCodes) => {
    const chartRef = useRef(null);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    // Formatting the dates as "Month Day"
    const formattedLast7DaysDates = lastSevenDays.map(date => {
        const month = date.toLocaleString('default', { month: 'short' });
        const day = date.getDate();
        return `${month}. ${day}`;
    });

    const formattedLast14DaysDates = last14Days.map(date => {
        const month = date.toLocaleString('default', { month: 'short' });
        const day = date.getDate();
        return `${month}. ${day}`;
    });

    const formattedLast30DaysDates = last30Days.map(date => {
        const month = date.toLocaleString('default', { month: 'long' });
        const day = date.getDate();
        return `${month} ${day}`;
    });

    const formattedLast24Hour = () => {
        const baseList = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
        return getShiftedHoursList(baseList);
    };

    useEffect(() => {
        //@ts-ignore
        const ctx = chartRef?.current?.getContext('2d');

        var gradientStroke = ctx.createLinearGradient(0, 50, 0, 400);
        gradientStroke.addColorStop(0, '#68C6B3');
        gradientStroke.addColorStop(1, endColor);

        var gradientFill = ctx.createLinearGradient(0, 0, 0, 150);
        gradientFill.addColorStop(0, '#68C6B3');
        gradientFill.addColorStop(1, endColor);

        var gradientStroke2 = ctx.createLinearGradient(0, 50, 0, 400);
        gradientStroke2.addColorStop(0, '#FE5502');
        gradientStroke2.addColorStop(1, 'rgba(104, 198, 179, 0.00)');

        let gradientFill2;

        if (selectedTimeFrame === 'Last 30 days') {
            gradientFill2 = ctx.createLinearGradient(0, 0, 0, 185);
        } else {
            gradientFill2 = ctx.createLinearGradient(0, 0, 0, 165);
        }

        gradientFill2.addColorStop(0, '#FE5502');
        gradientFill2.addColorStop(1, 'rgba(255, 0, 0, 0.00)');

        const constructLabel = () => {
            if (selectedTimeFrame === 'Last 7 days') {
                return formattedLast7DaysDates;
            } else if (selectedTimeFrame === 'Last 14 days') {
                return formattedLast14DaysDates;
            } else if (selectedTimeFrame === 'Last 30 days') {
                return formattedLast30DaysDates;
            } else {
                return formattedLast24Hour();
            }
        };

        const constructDataSuccess = () => {
            return timelineData?.completed;
        };

        const constructDataFailed = () => {
            return timelineData?.failed;
        };

        const constructDataWarning = () => {
            return timelineData?.warning;
        };

        const setMaxGraceValue = () => {
            if (
                timelineData?.completed &&
                timelineData?.completed.length &&
                timelineData?.failed &&
                timelineData?.failed.length &&
                timelineData?.warning &&
                timelineData?.warning.length
            ) {
                const combinedArr = [...timelineData?.completed, ...timelineData?.failed, ...timelineData?.warning];
                const maxVal = Math.max(...combinedArr);
                switch (true) {
                    case maxVal === 1:
                    case maxVal === 3:
                    case maxVal === 7:
                    case maxVal === 6:
                        return 1;
                    case maxVal === 2:
                    case maxVal === 5:
                        return 2;
                    case maxVal === 4:
                        return 4;
                    case maxVal < 100:
                        return 10;
                    default:
                        return 100;
                }
            } else {
                return 1;
            }
        };
        //@ts-ignore
        var mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: constructLabel(),
                datasets: [
                    {
                        label: 'Completed',
                        data: constructDataSuccess(),
                        borderColor: '#68C6B3',

                        pointBackgroundColor: gradientStroke,
                        pointHoverBackgroundColor: gradientStroke,
                        pointHoverBorderColor: gradientStroke,
                        pointBorderWidth: 1,
                        pointBorderColor: 'white',
                        // pointHoverRadius: 10,
                        // pointHoverBorderWidth: 1,
                        pointRadius: 4,
                        fill: false,
                        // backgroundColor: 'rgba(104, 198, 179, 0.10)',
                        borderWidth: 3
                    },
                    {
                        label: 'Completed with issues',
                        data: constructDataWarning(),
                        borderColor: '#FDC300',

                        pointBackgroundColor: '#FDC300',
                        pointHoverBackgroundColor: '#FDC300',
                        pointHoverBorderColor: '#FDC300',
                        pointBorderWidth: 1,
                        pointBorderColor: 'white',
                        pointRadius: 4,
                        fill: false,
                        // backgroundColor: gradientFill2,
                        borderWidth: 3
                    },
                    {
                        label: 'Failed',
                        data: constructDataFailed(),
                        borderColor: gradientStroke2,

                        pointBackgroundColor: gradientStroke2,
                        pointHoverBackgroundColor: gradientStroke2,
                        pointHoverBorderColor: gradientStroke2,
                        pointBorderWidth: 1,
                        pointBorderColor: 'white',
                        pointRadius: 4,
                        fill: false,
                        // backgroundColor: gradientFill2,
                        borderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    filler: {
                        propagate: false
                    },
                    tooltip: {
                        enabled: false, // Disable the default tooltip
                        external: function (context) {
                            // Tooltip Element
                            let tooltipEl = document.getElementById('chartjs-tooltip');

                            // Create an element if it doesn't exist
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
                                tooltipEl.style.zIndex = '10';
                                tooltipEl.style.boxShadow = '4px 4px 12px 0px #E0E0E0';
                                document.body.appendChild(tooltipEl);
                            }

                            // Hide tooltip if no data
                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                //@ts-ignore
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            // Set position
                            const position = context.chart.canvas.getBoundingClientRect();
                            tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                            tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                            //@ts-ignore
                            tooltipEl.style.opacity = 1;

                            // Build custom HTML content
                            const body = tooltipModel.body
                                .map(item => {
                                    let label = item.lines[0]; // Tooltip content
                                    let color = 'black';
                                    if (label.includes('issues')) {
                                        color = '#FDC300';
                                    } else if (label.includes('Completed')) {
                                        color = '#68C6B3';
                                    } else if (label.includes('Failed')) {
                                        color = '#FE5502';
                                    }

                                    if (selectedTimeFrame === 'Last 30 days') {
                                        label = context.tooltip.title[0] + ' | ' + label;
                                    }

                                    return `<div style="color: ${color}; display: flex; align-items: center; ">
                                            <span style="width: 8px; height: 8px; background: ${color}; border-radius: 50%; margin-right: 10px;"></span>
                                            <span style="font-size: 13px; color: var(--text-primary)">${label}</span>
                                        </div>`;
                                })
                                .join('');

                            tooltipEl.innerHTML = `<div style=" display: flex; flex-direction: column; gap: 16px; justify-content: center; border: none  ">${body}</div>`;
                        }
                    }
                },

                scales: {
                    x: {
                        display: selectedTimeFrame === 'Last 30 days' ? false : true, // Hide X axis labels
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: isDarkTheme ? '#fff' : '#404040'
                        }
                    },

                    y: {
                        //display: false,
                        beginAtZero: true,
                        grace: setMaxGraceValue(),

                        ticks: {
                            color: isDarkTheme ? '#fff' : '#404040',

                            maxTicksLimit: 5
                        }
                        // stacked: true
                    }
                },

                interaction: {
                    intersect: false
                }
            }
        });

        return () => {
            mayBarChart.destroy();
        };
    }, [selectedTimeFrame, timelineData]);

    return (
        <div className={styles.lineChart}>
            {!timelineData ||
                (timelineData?.completed?.length === 0 && (
                    <div className={styles.noData}>
                        <NoData />
                    </div>
                ))}
            <canvas ref={chartRef} width={336} height={131}></canvas>

            {/* <Typography variant="Semibold_14" className={styles.text}>
                24 hours trend
            </Typography> */}
        </div>
    );
};

export default LineChart;
