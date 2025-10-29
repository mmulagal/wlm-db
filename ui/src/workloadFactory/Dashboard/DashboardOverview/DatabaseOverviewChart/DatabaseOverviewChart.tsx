import { Chart, registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { DsFlashingDotsLoader } from '@netapp/design-system';
import { DsTypography } from '@tlveng/wlm-ds';
import styles from './DatabaseOverviewChart.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

Chart.register(...registerables);

type ChartType = {
    color1: string;
    color2: string;
    color3: string;
    data1: any;
    data2: any;
    data3: any;
    centerText: string;
    centerValue?: string | number;
    loading?: boolean;
    isDisabled?: boolean;
};

const DatabaseOverviewChart = ({
    color1,
    color2,
    color3,
    data1,
    data2,
    data3,
    centerText,
    centerValue,
    loading,
    isDisabled = false
}: ChartType) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const chartInstanceRef = useRef<any>(null);

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        cutout: '80%', // This creates the doughnut hole
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
                    data: [data1, data2, data3],
                    backgroundColor: [color1, color2, color3]
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
        <div className={styles.chart} id="chart-item">
            <div className={styles['center-text']}>
                <DsTypography
                    variant="Regular_24"
                    style={{ lineHeight: 'unset' }}
                    className={isDisabled ? CommonStyles.notAvailable : ''}
                >
                    {centerValue}
                </DsTypography>

                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset', marginTop: '4px' }}>
                    {centerText}
                </DsTypography>

                {loading && (
                    <div style={{ marginTop: '6px' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
            </div>
            {/* {loading && <div className={styles.emptyCircle} />} */}
            <canvas ref={ref} id="chart-area" />
        </div>
    );
};

export default DatabaseOverviewChart;
