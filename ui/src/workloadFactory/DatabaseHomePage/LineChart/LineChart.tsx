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
        gradientStroke.addColorStop(0, startColor);
        gradientStroke.addColorStop(1, endColor);

        var gradientFill = ctx.createLinearGradient(0, 0, 0, 150);
        gradientFill.addColorStop(0, startColor);
        gradientFill.addColorStop(1, endColor);
        //@ts-ignore
        var mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['January', 'February', 'March', 'April', 'May', 'june', 'july', 'gust', 'sep', 'oct'],
                datasets: [
                    {
                        label: 'CPU Data',
                        data: [25, 20, 15, 20, 18, 25, 20, 15, 20, 18],
                        borderColor: gradientStroke,

                        pointBackgroundColor: gradientStroke,
                        pointHoverBackgroundColor: gradientStroke,
                        pointHoverBorderColor: gradientStroke,
                        pointBorderWidth: 1,
                        pointBorderColor: 'white',
                        // pointHoverRadius: 10,
                        // pointHoverBorderWidth: 1,
                        pointRadius: 4,
                        fill: true,
                        backgroundColor: gradientFill,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    x: {
                        display: false, // Hide X axis labels
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        beginAtZero: true
                    }
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

            <Typography variant="Semibold_14" className={styles.text}>
                24 hours trend
            </Typography>
        </div>
    );
};

export default LineChart;
