import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './OptimizationChart.module.scss';
import { Typography } from '@netapp/design-system';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';

Chart.register(...registerables);

type MultiRingDoughnutPropType = {
    unProtectColor?: string;
    hostData?: any;
};

const OptimizationChart = ({ unProtectColor, hostData }: MultiRingDoughnutPropType) => {
    const unProtectedColor = '#E0E0E0';

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
                    data: [65, 35],
                    backgroundColor: ['#68C6B3', unProtectedColor]
                }
            ]
            //   labels: label,
        },
        options: { ...doughnutOptions, animation: false }
    };

    useEffect(() => {
        if (ref.current) {
            //@ts-ignore
            var myDoughnut = new Chart(ref.current, config);
            setDoughnutChart(myDoughnut);
        }
        return () => {
            myDoughnut.destroy();
            // if (hostData?.protectedPercent !== 0 || hostData?.unprotectedPercent !== 0) myDoughnut.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostData]);

    return (
        <div className={styles.optimizationChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    65%
                </Typography>
                <Typography variant="Regular_14">Optimization score</Typography>
            </div>

            {(hostData?.protectedPercent !== 0 || hostData?.unprotectedPercent !== 0) && (
                <canvas ref={ref} id="chart-area" width={200} height={200}></canvas>
            )}
        </div>
    );
};

export default OptimizationChart;
