import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import styles from './ErrorBarGraph.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ErrorBarGraph = () => {
    const { errorInvestigationData, errorInvestigationLoading } = useAppSelector(
        state => state.agenticAI.errorInvestigation
    );

    // Function to count tags from errorInvestigationData with memoization
    const tagCounts = React.useMemo(() => {
        const counts = {
            Compute: 0,
            Storage: 0,
            Network: 0,
            Security: 0
        };

        if (errorInvestigationData && errorInvestigationData.length > 0) {
            errorInvestigationData.forEach(errorItem => {
                if (errorItem.tags && Array.isArray(errorItem.tags)) {
                    errorItem.tags.forEach(tag => {
                        if (counts.hasOwnProperty(tag)) {
                            counts[tag as keyof typeof counts]++;
                        }
                    });
                }
            });
        }

        return counts;
    }, [errorInvestigationData]);

    const data = {
        labels: ['Compute', 'Storage', 'Network', 'Security'],
        datasets: [
            {
                label: 'Errors',
                data: [tagCounts.Compute, tagCounts.Storage, tagCounts.Network, tagCounts.Security],
                backgroundColor: '#FDC300',
                borderRadius: 16, // Rounded corners
                borderSkipped: 'bottom' as const, // Only top rounded
                barThickness: 24, // Fixed width of each bar
                borderWidth: 0
            }
        ]
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: 0
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false // hides tooltip for clean look
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        family: 'Inter, sans-serif',
                        size: 14
                    },
                    color: '#3C3C3C'
                }
            },
            y: {
                beginAtZero: true,
                grace: '5%',
                ticks: {
                    stepSize: Math.max(1, Math.ceil(Math.max(...Object.values(tagCounts)) / 5)),
                    callback: (value: number) => `${value} Error${value !== 1 ? 's' : ''}`,
                    font: {
                        family: 'Inter, sans-serif',
                        size: 13
                    },
                    color: '#3C3C3C'
                },
                grid: {
                    color: '#E6E6E6',
                    drawBorder: false
                }
            }
        }
    };

    return (
        <div className={styles.chartBarContainer}>
            <Bar data={data} options={options} />
        </div>
    );
};

export default ErrorBarGraph;
