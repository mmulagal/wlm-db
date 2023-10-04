import { Typography } from '@netapp/design-system';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './JobDoughnutchart.module.scss';

Chart.register(...registerables);

const JobDoughnutChart = () => {
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
                    data: [80, 10, 10],
                    backgroundColor: ['#68C6B3', '#0BAFFC', '#FE5502']
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
        <div className={styles.jobChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    276
                </Typography>
                <Typography variant="Regular_14">Jobs</Typography>
            </div>
            <canvas ref={ref} id="chart-area" width={162} height={162}></canvas>
        </div>
    );
};

export default JobDoughnutChart;
