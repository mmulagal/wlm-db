import { Typography } from '@netapp/design-system';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './SandboxChart.module.scss';

Chart.register(...registerables);

const SandboxChart = () => {
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
                    data: [30, 30, 40, 20],
                    backgroundColor: ['#68C6B3', '#0BAFFC', '#A815F3', '#FDC300']
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
        };
    }, []);

    return (
        <div className={styles.sandboxChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    120
                </Typography>
                <Typography variant="Regular_14">{GENERAL.SANDBOXES}</Typography>
            </div>
            {/* @ts-ignore */}
            {false && <div className={styles.emptyCircle}></div>}

            <canvas ref={ref} id="chart-area" width={184} height={184}></canvas>
        </div>
    );
};

export default SandboxChart;
