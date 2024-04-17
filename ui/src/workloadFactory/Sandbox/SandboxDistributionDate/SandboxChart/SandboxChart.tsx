import { Typography } from '@netapp/design-system';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './SandboxChart.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { getSandboxDistributionByAge } from '../../SandboxUtility';

Chart.register(...registerables);

const SandboxChart = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const { isNA } = useAppSelector(state => state.sandbox);
    const { aggregatedSandboxList } = useAppSelector(state => state.sandbox);

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
                    data: Object.values(getSandboxDistributionByAge(aggregatedSandboxList)),
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
    }, [aggregatedSandboxList]);

    return (
        <div className={styles.sandboxChart} id="chart-item">
            <div className={styles['center-text']}>
                {!isNA && (
                    <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {aggregatedSandboxList.length}
                    </Typography>
                )}

                {isNA && (
                    <Typography variant="Regular_16" className={CommonStyles.notAvailable}>
                        {GENERAL.NOT_AVAILABLE}
                    </Typography>
                )}
                <Typography variant="Regular_14" className={isNA ? ` ${CommonStyles.notAvailable}` : ''}>
                    sandboxes
                </Typography>
            </div>
            {/* @ts-ignore */}
            {aggregatedSandboxList.length === 0 && <div className={styles.emptyCircle}></div>}
            {isNA && <div className={styles.emptyCircle}></div>}

            {!isNA && <canvas ref={ref} id="chart-area" width={184} height={184}></canvas>}
        </div>
    );
};

export default SandboxChart;
