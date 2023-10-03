import React from 'react';
import { Chart, ChartOptions } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './MultiRingDoughnut.module.scss';
import { Typography } from '@netapp/design-system';

Chart.register(...registerables);

const MultiRingDoughnut = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();

    const doughnutOptions = {
        cutout: 60,
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
                    data: [80, 20],
                    backgroundColor: ['#68C6B3', '#FDC300']
                },
                {
                    data: [20, 20, 40, 20],
                    backgroundColor: ['#012CAD', '#A815F3', '#0BAFFC', '#FFF']
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
        <div className={styles.chartItem} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    80%
                </Typography>
                <Typography variant="Regular_14">Protection</Typography>
            </div>
            <canvas ref={ref} id="chart-area" width={162} height={162}></canvas>
        </div>
    );
};

export default MultiRingDoughnut;
