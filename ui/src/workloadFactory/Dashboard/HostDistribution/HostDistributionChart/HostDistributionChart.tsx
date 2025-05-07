import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './HostDistributionChart.module.scss';
import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';

Chart.register(...registerables);

type ChartType = {
    color1: string;
    color2: string;
    data1: any;
    data2: any;
    centerText: string;
    centerValue?: string;
    loading?: boolean;
};

const HostDistributionChart = ({ color1, color2, data1, data2, centerText, centerValue, loading }: ChartType) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();

    const doughnutOptions = {
        plugins: {
            legend: {
                display: false
            }
        }
    };

    var config = {
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
            //@ts-ignore
            var myDoughnut = new Chart(ref.current, config);
            setDoughnutChart(myDoughnut);
        }
        return () => {
            if (myDoughnut) {
                myDoughnut.destroy();
            }
        };
    }, []);

    return (
        <div className={styles.inventoryChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    {centerValue}
                </Typography>

                {loading && (
                    <div style={{ marginTop: '6px' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
            </div>
            {/* {!totalHosts && <div className={styles.emptyCircle}></div>} */}
            <canvas ref={ref} id="chart-area" width={200} height={200}></canvas>
        </div>
    );
};

export default HostDistributionChart;
