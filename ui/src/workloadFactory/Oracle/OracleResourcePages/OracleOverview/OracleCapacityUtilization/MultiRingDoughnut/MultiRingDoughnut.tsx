import React from 'react';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './MultiRingDoughnut.module.scss';
import { byteToGiB } from '../../../../../../utils/utilityFunctions';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

type MRDProps = { resourceDetails: any; resourceLoading: boolean };

const MultiRingDoughnut = ({ resourceDetails, resourceLoading }: MRDProps) => {
    const { t } = useTranslation();
    const data = resourceDetails?.storage?.fsxn;
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

    const buildChartData = () => {
        if (!data) return null;

        return {
            datasets: [
                {
                    data: [byteToGiB(data?.used), byteToGiB(data?.size) - byteToGiB(data?.used)],
                    backgroundColor: ['#5E8DCD', '#E0E0E0']
                },
                {
                    data: [
                        byteToGiB(data?.ssd),
                        byteToGiB(data?.capacityPool),
                        byteToGiB(data?.physicalUsed) - (byteToGiB(data?.ssd) + byteToGiB(data?.capacityPool))
                    ],
                    backgroundColor: ['#0BAFFC', '#A815F3', '#FFF']
                }
            ]
        };
    };

    useEffect(() => {
        if (!ref.current) return;

        // Destroy existing chart if it exists
        if (doughnutChart) {
            doughnutChart.destroy();
            setDoughnutChart(null);
        }

        // Only create chart when data is available
        const chartData = buildChartData();
        if (chartData) {
            //@ts-ignore
            const myDoughnut = new Chart(ref.current, {
                type: 'doughnut',
                data: chartData,
                options: { ...doughnutOptions, animation: false }
            });
            setDoughnutChart(myDoughnut);
        }

        return () => {
            if (doughnutChart) doughnutChart.destroy();
        };
    }, [data]); // Re-run when data changes
    return (
        <div className={styles.chartItem} id="chart-item">
            <div className={styles['center-text']}>
                {resourceLoading && <DsFlashingDotsLoader />}
                {!resourceLoading && (
                    <div className={styles.textTop}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {byteToGiB(data?.size)}
                        </DsTypography>
                        <DsTypography variant="Regular_20" style={{ lineHeight: 'unset' }}>
                            {t('databases.oracle-inner-page.gib')}
                        </DsTypography>
                    </div>
                )}

                <DsTypography variant="Regular_14">{t('databases.oracle-inner-page.total-size')}</DsTypography>
            </div>
            {!resourceLoading && <canvas ref={ref} id="chart-area" width={184} height={184}></canvas>}
            {resourceLoading && <div className={styles.emptyCircle} />}
        </div>
    );
};

export default MultiRingDoughnut;
