import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Typography } from '@netapp/design-system';
import styles from './LineChart.module.scss';

Chart.register(...registerables);

type colorCodes = {
    startColor: string;
    endColor: string;
};

const LineChart = ({ startColor, endColor }: colorCodes) => {
    const chartRef = useRef(null);

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

        var gradientFill2 = ctx.createLinearGradient(0, 0, 0, 165);

        gradientFill2.addColorStop(0, '#DA1E21');
        gradientFill2.addColorStop(1, 'rgba(255, 0, 0, 0.00)');
        //@ts-ignore
        var mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [
                    {
                        label: 'Success',
                        data: [310, 270, 290, 300, 315, 210],
                        borderColor: '#68C6B3',

                        pointBackgroundColor: gradientStroke,
                        pointHoverBackgroundColor: gradientStroke,
                        pointHoverBorderColor: gradientStroke,
                        pointBorderWidth: 1,
                        pointBorderColor: 'white',
                        // pointHoverRadius: 10,
                        // pointHoverBorderWidth: 1,
                        pointRadius: 4,
                        fill: {
                            target: 'origin', // Set the fill options
                            above: 'rgba(104, 198, 179, 0.10)'
                        },
                        backgroundColor: 'rgba(104, 198, 179, 0.10)',
                        borderWidth: 3
                    },
                    {
                        label: 'Failed',
                        data: [100, 90, 110, 70, 85, 99],
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
                    }
                },

                scales: {
                    x: {
                        //display: false, // Hide X axis labels
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        //display: false,
                        beginAtZero: true,
                        grace: 100
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
    }, []);

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
