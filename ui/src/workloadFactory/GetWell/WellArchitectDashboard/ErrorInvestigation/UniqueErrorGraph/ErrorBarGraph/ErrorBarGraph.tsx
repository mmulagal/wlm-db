import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
    TooltipModel
} from 'chart.js';
import styles from './ErrorBarGraph.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ErrorBarGraph: React.FC = () => {
    const { errorInvestigationData, errorInvestigationLoading } = useAppSelector(
        (state: any) => state.agenticAI.errorInvestigation
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
            errorInvestigationData.forEach((errorItem: any) => {
                if (errorItem.tags && Array.isArray(errorItem.tags)) {
                    errorItem.tags.forEach((tag: string) => {
                        if (Object.prototype.hasOwnProperty.call(counts, tag)) {
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

    // External tooltip handler to render a React-controlled HTML tooltip
    const externalTooltipHandler = (context: { tooltip: TooltipModel<'bar'> }) => {
        const { chart, tooltip } = context as any;
        let tooltipEl = document.getElementById('chartjs-external-tooltip');

        // Create element on first render
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-external-tooltip';
            tooltipEl.className = styles.externalTooltip;
            tooltipEl.style.pointerEvents = 'none';
            document.body.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Set text
        if (tooltip.dataPoints && tooltip.dataPoints.length) {
            const dataPoint = tooltip.dataPoints[0];
            const value = dataPoint.raw ?? dataPoint.parsed?.y ?? dataPoint.parsed ?? '';
            tooltipEl.innerHTML = `<div class=\"${styles.tooltipInner}\">Error: ${value}</div>`;
        }

        const canvasRect = chart.canvas.getBoundingClientRect();

        // Position the tooltip above the bar
        const bodyFont = ChartJS.defaults.font;
        const tooltipWidth = tooltipEl.offsetWidth;

        const top = window.scrollY + canvasRect.top + (tooltip.caretY ?? 0) - 10;
        const left = window.scrollX + canvasRect.left + (tooltip.caretX ?? 0) - tooltipWidth / 2;

        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = `${Math.max(0, left)}px`;
        tooltipEl.style.top = `${Math.max(0, top)}px`;
    };

    const options: ChartOptions<'bar'> = {
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
                // disable native tooltip drawing to use external HTML tooltip only
                enabled: false,
                position: 'nearest',
                external: externalTooltipHandler,
                intersect: true,
                // keep callbacks minimal
                callbacks: {
                    label: () => ''
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
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
                    // stepSize expects number | undefined
                    stepSize: Math.max(1, Math.ceil(Math.max(...Object.values(tagCounts)) / 5)) as unknown as number,
                    // callback signature: (this, value, index, ticks)
                    callback: function (this: any, tickValue: string | number) {
                        const value = typeof tickValue === 'string' ? Number(tickValue) : tickValue;
                        return `${value} Error${value !== 1 ? 's' : ''}`;
                    },
                    font: {
                        family: 'Inter, sans-serif',
                        size: 13
                    },
                    color: '#3C3C3C'
                },
                grid: {
                    color: '#E6E6E6'
                }
            }
        }
    };

    // Ensure we remove any external tooltip element when the component unmounts
    React.useEffect(() => {
        return () => {
            const el = document.getElementById('chartjs-external-tooltip');
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    }, []);

    return (
        <div className={styles.chartBarContainer}>
            <Bar data={data} options={options} />
        </div>
    );
};

export default ErrorBarGraph;
