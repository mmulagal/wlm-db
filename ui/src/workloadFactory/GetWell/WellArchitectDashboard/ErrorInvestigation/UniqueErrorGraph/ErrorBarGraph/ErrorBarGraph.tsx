import { useMemo, useEffect } from 'react';
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
import { ErrorInvestigationGetApiResponse } from '../../../../../../utils/types/agenticAITypes';
import { ReactComponent as LoadingEmptyGraph } from '../../../../../../assets/loading_empty_graph.svg';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ErrorBarGraph: React.FC<{ errorCardsData?: ErrorInvestigationGetApiResponse[] }> = ({ errorCardsData }) => {
    const { t } = useTranslation();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { selectedErrorTags } = useAppSelector(state => state.agenticAI);
    const { noData, investigationDatesLoading } = useAppSelector(state => state?.agenticAI);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = errorInvestigationLoading || investigationDatesLoading;
    // Function to count tags from errorInvestigationData
    const tagCounts = useMemo(() => {
        const counts = {
            Compute: 0,
            Storage: 0,
            Network: 0,
            Security: 0
        };

        if (errorCardsData && errorCardsData.length > 0) {
            errorCardsData.forEach((errorItem: any) => {
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
    }, [errorCardsData]);

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

    const labels = ['Compute', 'Storage', 'Network', 'Security'];

    // If no filter is applied (empty or undefined), treat all tags as selected
    const effectiveSelected = selectedErrorTags && selectedErrorTags.length > 0 ? selectedErrorTags : labels;

    // Build displayed data array and per-bar colors: show counts only for selected tags
    const displayedData = [
        effectiveSelected.includes('Compute') ? tagCounts.Compute : 0,
        effectiveSelected.includes('Storage') ? tagCounts.Storage : 0,
        effectiveSelected.includes('Network') ? tagCounts.Network : 0,
        effectiveSelected.includes('Security') ? tagCounts.Security : 0
    ];

    const backgroundColors = labels.map((label, i) => (effectiveSelected.includes(label) ? '#FDC300' : 'transparent'));

    const data = {
        labels,
        datasets: [
            {
                label: 'Errors',
                data: displayedData,
                backgroundColor: backgroundColors,
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

        // Set text (but ignore unselected/transparent bars)
        if (tooltip.dataPoints && tooltip.dataPoints.length) {
            const dataPoint = tooltip.dataPoints[0];
            const ds = chart.data.datasets[dataPoint.datasetIndex];
            // dataset backgroundColor may be string or array; normalize to array
            const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[dataPoint.dataIndex] : ds.backgroundColor;

            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
                // hide tooltip for unselected bars
                tooltipEl.style.opacity = '0';
                return;
            }

            const value = dataPoint.raw ?? dataPoint.parsed?.y ?? dataPoint.parsed ?? '';
            tooltipEl.innerHTML = `<div class="${styles.tooltipInner}">Errors: ${value}</div>`;
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
                    color: disableColor()
                }
            },
            y: {
                border: {
                    color: isDarkTheme ? '#858C95' : '#222',
                    width: 1
                },
                beginAtZero: true,
                grid: {
                    color: '#e0e0e0',
                    tickLength: 0
                },
                grace: '5%',
                ticks: {
                    color: disableColor(),
                    stepSize: Math.max(1, Math.ceil(Math.max(...displayedData) / 5)) as unknown as number,
                    // callback signature: (this, value, index, ticks)
                    callback(this: any, tickValue: string | number) {
                        const value = typeof tickValue === 'string' ? Number(tickValue) : tickValue;
                        return `${value} Error${value !== 1 ? 's' : ''}`;
                    },
                    font: {
                        family: 'Inter, sans-serif',
                        size: 13
                    }
                }
            }
        }
    };

    // Ensure we remove any external tooltip element when the component unmounts
    useEffect(
        () => () => {
            const el = document.getElementById('chartjs-external-tooltip');
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        },
        []
    );

    return (
        <div className={styles.chartBarContainer}>
            {noData && (
                <div className={styles.noData}>
                    <LoadingEmptyGraph />
                    <DsTypography variant="Regular_14">{t('databases.log-analyzer.n/a')}</DsTypography>
                </div>
            )}
            {loading && (
                <div className={styles.noData}>
                    <LoadingEmptyGraph />
                    <div className={styles.loadingText}>
                        <DsTypography variant="Regular_14">{t('databases.log-analyzer.loading-data')}</DsTypography>
                        <DsFlashingDotsLoader />
                    </div>
                </div>
            )}
            <Bar data={data} options={options} />
        </div>
    );
};

export default ErrorBarGraph;
