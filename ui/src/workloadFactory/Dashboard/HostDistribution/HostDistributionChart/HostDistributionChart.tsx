import { Chart, registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './HostDistributionChart.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

Chart.register(...registerables);

type ChartType = {
    color1: string;
    color2: string;
    data1: any;
    data2: any;
    centerText: string;
    centerValue?: string;
    loading?: boolean;
    isDisabled?: boolean;
};

const HostDistributionChart = ({ color1, color2, data1, data2, centerText, centerValue, loading, isDisabled = false }: ChartType) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const chartInstanceRef = useRef<any>(null);

    const doughnutOptions = {
        plugins: {
            legend: {
                display: false
            }
        }
    };

    const config = {
        type: 'doughnut',
        data: {
            datasets: [
                {
                    data: [data1, data2],
                    backgroundColor: [color1, color2]
                }
            ]
            //   labels: label,
        },
        options: { ...doughnutOptions, animation: true }
    };

    useEffect(() => {
        if (ref.current) {
            // @ts-ignore
            chartInstanceRef.current = new Chart(ref.current, config);
        }
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, []);

    return (
        <div className={styles.inventoryChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant={isDisabled ? "Semibold_14" : "Regular_32"} style={{ lineHeight: 'unset' }} className={isDisabled ? CommonStyles.notAvailable : ''}>
                    {centerValue}
                </Typography>

                {loading && (
                    <div style={{ marginTop: '6px' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
            </div>
            {/* {!totalHosts && <div className={styles.emptyCircle}></div>} */}
            <canvas ref={ref} id="chart-area" width={200} height={200} />
        </div>
    );
};

export default HostDistributionChart;
