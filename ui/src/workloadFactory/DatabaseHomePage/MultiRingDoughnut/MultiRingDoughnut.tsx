import React from 'react';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './MultiRingDoughnut.module.scss';
import { Typography } from '@netapp/design-system';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';

Chart.register(...registerables);

type MultiRingDoughnutPropType = {
    unProtectColor?: string;
    hostData?: any;
};

const MultiRingDoughnut = ({
    unProtectColor,
    hostData
}: MultiRingDoughnutPropType) => {
    const unProtectedColor = unProtectColor ? '#E0E0E0' : '#FDC300';

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
                    data: [hostData?.protectedPercent, hostData?.unprotectedPercent],
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
            if (hostData?.protectedPercent !== 0 || hostData?.unprotectedPercent !== 0) myDoughnut.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostData]);

    return (
        <div className={styles.chartItem} id="chart-item">
            <div className={styles['center-text']}>
                <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                    {formatFractionalNumber(hostData?.protectedPercent)}%
                </Typography>
                <Typography variant="Regular_14">{GENERAL.PROTECTION}</Typography>
            </div>
            {(!hostData || (hostData?.protectedPercent === 0 && hostData?.unprotectedPercent === 0)) && (
                <div className={styles.emptyCircle}></div>
            )}
            {(hostData?.protectedPercent !== 0 || hostData?.unprotectedPercent !== 0) && (
                <canvas ref={ref} id="chart-area" width={162} height={162}></canvas>
            )}
        </div>
    );
};

export default MultiRingDoughnut;
