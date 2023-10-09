import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const LineChart = () => {
    const chartRef = useRef(null);

    useEffect(() => {
        //@ts-ignore
        const ctx = chartRef?.current?.getContext('2d');

        var gradientStroke = ctx.createLinearGradient(0, 50, 0, 400);
        gradientStroke.addColorStop(0, '#68C6B3');
        gradientStroke.addColorStop(1, 'rgba(104, 198, 179, 0.00)');

        var gradientFill = ctx.createLinearGradient(0, 50, 0, 332);
        gradientFill.addColorStop(0, '#68C6B3');
        gradientFill.addColorStop(1, 'rgba(104, 198, 179, 0.00)');
        //@ts-ignore
        var mayBarChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['January', 'February', 'March', 'April', 'May'],
                datasets: [
                    {
                        label: 'CPU Data',
                        data: [25, 20, 15, 20, 18],
                        borderColor: gradientStroke,

                        pointBackgroundColor: gradientStroke,
                        pointHoverBackgroundColor: gradientStroke,
                        pointHoverBorderColor: gradientStroke,
                        pointBorderWidth: 2,
                        pointBorderColor: 'white',
                        // pointHoverRadius: 10,
                        // pointHoverBorderWidth: 1,
                        pointRadius: 5,
                        fill: true,
                        backgroundColor: gradientFill,
                        borderWidth: 4
                    }
                ]
            },
            options: {
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
        <div>
            <canvas ref={chartRef} width={100} height={100}></canvas>

            <div>24 hours trend</div>
        </div>
    );
};

export default LineChart;
