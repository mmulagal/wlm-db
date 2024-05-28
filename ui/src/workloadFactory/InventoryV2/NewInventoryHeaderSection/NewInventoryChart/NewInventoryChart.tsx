import React, { useMemo } from 'react';
import { Chart, ChartOptions } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './NewInventoryChart.module.scss';
import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';

Chart.register(...registerables);

type ChartType = {
    color1: string;
    color2: string;
    data1: any;
    data2: any;
    centerText: string;
};

const NewInventoryChart = ({ color1, color2, data1, data2, centerText }: ChartType) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const { unManagedHosts, unIdentifiableHosts } = useAppSelector(state => state.inventory);
    const databaseHostsList: any = useAppSelector(state => state.databaseHome.databaseHostsList);
    const { discoverHostLoading } = useAppSelector(state => state.inventory.discoveredHosts);

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
    }, [databaseHostsList, unManagedHosts, unIdentifiableHosts]);

    const totalHosts = (databaseHostsList?.length || 0) + unManagedHosts.length + unIdentifiableHosts.length;

    return (
        <div className={styles.inventoryChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    {(databaseHostsList?.length || 0) + unManagedHosts.length + unIdentifiableHosts.length}
                </Typography>
                <Typography variant="Regular_14">{centerText}</Typography>
                {discoverHostLoading && <DsFlashingDotsLoader />}
            </div>
            {!totalHosts && <div className={styles.emptyCircle}></div>}
            {totalHosts ? <canvas ref={ref} id="chart-area" width={196} height={196}></canvas> : null}
        </div>
    );
};

export default NewInventoryChart;
