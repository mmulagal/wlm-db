import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { Typography } from '@netapp/design-system';
import styles from './LineChart.module.scss';
import { last14Days, last30Days, lastSevenDays } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
const moment = require('moment');

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
        const dateStr = Date.now().toString();
        let hr =  moment(new Date(parseInt(dateStr))).format('HH');
        if (hr > 0 && hr <= 4) {
            return ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00'];
        } else if (hr > 4 && hr <= 8) {
            return ['12:00', '16:00', '20:00', '00:00', '04:00', '08:00'];
        } else if (hr > 8 && hr <= 12) {
            return ['16:00', '20:00', '00:00', '04:00', '08:00', '12:00'];
        } else if (hr > 12 && hr <= 16) {
            return ['20:00', '00:00', '04:00', '08:00', '12:00', '16:00'];
        } else if (hr > 16 && hr <= 20) {
            return ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
        } else if (hr > 20 && hr <= 24) {
            return ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'];
        }
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
        gradientStroke2.addColorStop(0, '#DA1E21');
        gradientStroke2.addColorStop(1, 'rgba(104, 198, 179, 0.00)');

        let gradientFill2;

        if (selectedTimeFrame === 'Last 30 days') {
            gradientFill2 = ctx.createLinearGradient(0, 0, 0, 185);
        } else {
            gradientFill2 = ctx.createLinearGradient(0, 0, 0, 165);
        }

        gradientFill2.addColorStop(0, '#DA1E21');
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
        //@ts-ignore
        var mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: constructLabel(),
                datasets: [
                    {
                        label: 'Success',
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
                        fill: true,
                        backgroundColor: 'rgba(104, 198, 179, 0.10)',
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
                        fill: true,
                        backgroundColor: gradientFill2,
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
                        callbacks: {
                            label: function (context) {
                                let label =
                                    context.dataset.label === 'Success' ? 'Completed jobs' : 'Failed jobs' || '';

                                if (context.parsed.y !== null) {
                                    label = `${context.label} | ${context.parsed.y} ${label}`;
                                }
                                if (selectedTimeFrame === 'Last 30 days') {
                                    return label;
                                } else {
                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                }
                            }
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
                        grace: 5,
                        ticks: {
                            color: isDarkTheme ? '#fff' : '#404040'
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
            <canvas ref={chartRef} width={336} height={131}></canvas>

            {/* <Typography variant="Semibold_14" className={styles.text}>
                24 hours trend
            </Typography> */}
        </div>
    );
};

export default LineChart;
