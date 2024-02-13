import React from 'react';
import { Chart, ChartOptions } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './InventoryChart.module.scss';
import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';

Chart.register(...registerables);

const InventoryChart = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();

    const doughnutOptions = {
        cutout: 65,
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
                    data: [15, 5],
                    backgroundColor: ['#68C6B3', '#5E8DCD']
                },
                {
                    data: [10, 5, 5],
                    backgroundColor: ['#A815F3', '#DE9EFF', '#FFF']
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
        <div className={styles.inventoryChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    20
                </Typography>
                <Typography variant="Regular_14">{GENERAL.DATABASE_HOSTS}</Typography>
            </div>
            <canvas ref={ref} id="chart-area" width={196} height={196}></canvas>
        </div>
    );
};

export default InventoryChart;
