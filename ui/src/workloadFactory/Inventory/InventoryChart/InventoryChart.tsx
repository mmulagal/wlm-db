import React, { useMemo } from 'react';
import { Chart, ChartOptions } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './InventoryChart.module.scss';
import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

Chart.register(...registerables);

const InventoryChart = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const { unManagedHosts, unIdentifiableHosts } = useAppSelector(state => state.inventory);
    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { discoverHostLoading } = useAppSelector(state => state.inventory.discoveredHosts);

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
                    data: [(databaseHostsData?.length || 0) + unManagedHosts.length, unIdentifiableHosts.length],
                    backgroundColor: ['#68C6B3', '#5E8DCD']
                },
                {
                    data: [databaseHostsData?.length || 0, unManagedHosts.length, unIdentifiableHosts.length],
                    backgroundColor: ['#A815F3', '#DE9EFF', '#FFF']
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
    }, [databaseHostsData, unManagedHosts, unIdentifiableHosts]);

    const totalHosts = (databaseHostsData?.length || 0) + unManagedHosts.length + unIdentifiableHosts.length;

    return (
        <div className={styles.inventoryChart} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    {(databaseHostsData?.length || 0) + unManagedHosts.length + unIdentifiableHosts.length}
                </Typography>
                <Typography variant="Regular_14">{GENERAL.DATABASE_HOSTS}</Typography>
                {discoverHostLoading && <DsFlashingDotsLoader />}
            </div>
            {!totalHosts && <div className={styles.emptyCircle}></div>}
            {totalHosts ? <canvas ref={ref} id="chart-area" width={196} height={196}></canvas> : null}
        </div>
    );
};

export default InventoryChart;
