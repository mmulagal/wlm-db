import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

import styles from './GetWellChart.module.scss';

Chart.register(...registerables);

type colorCodes = {
    startColor: string;
    endColor: string;
};

const GetWellChart = ({ startColor, endColor }: colorCodes) => {
    const chartRef = useRef(null);

    useEffect(() => {
        // @ts-ignore
        const ctx = chartRef?.current?.getContext('2d');

        const gradientStroke = ctx.createLinearGradient(0, 50, 0, 400);
        gradientStroke.addColorStop(0, '#0BAFFC');
        gradientStroke.addColorStop(1, endColor);

        const gradientFill = ctx.createLinearGradient(0, 0, 0, 150);
        gradientFill.addColorStop(0, '#0BAFFC');
        gradientFill.addColorStop(1, endColor);

        // Create a gradient fill
        const gradientBG = ctx.createLinearGradient(0, 0, 0, 70);
        gradientBG.addColorStop(0, 'rgba(11, 175, 252, 0.5)'); // Color at top
        gradientBG.addColorStop(1, 'rgba(11, 175, 252, 0.04)'); // Transparent at bottom

        // @ts-ignore
        const mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
                datasets: [
                    {
                        label: 'value',
                        data: [70, 50, 70, 50, 70, 55, 45, 55, 60, 35, 55, 58, 52],
                        borderColor: '#0BAFFC',

                        pointBackgroundColor: gradientStroke,
                        // pointHoverBackgroundColor: gradientStroke,
                        // pointHoverBorderColor: gradientStroke,
                        // pointBorderWidth: 0,
                        // pointBorderColor: 'white',
                        // pointHoverRadius: 10,
                        // pointHoverBorderWidth: 1,
                        pointRadius: 0,
                        fill: true,
                        backgroundColor: gradientBG,
                        borderWidth: 2,
                        tension: 0.2
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
                        display: false, // Hide X axis labels
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#404040'
                        }
                    },

                    y: {
                        display: false,
                        beginAtZero: true,

                        ticks: {
                            color: '#404040'
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
    }, []);

    return (
        <div className={styles.getWellChart}>
            <canvas ref={chartRef} width={271} height={80} />
        </div>
    );
};

export default GetWellChart;
