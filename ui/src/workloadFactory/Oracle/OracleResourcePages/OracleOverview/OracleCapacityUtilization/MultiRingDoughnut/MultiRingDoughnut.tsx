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

    var config = {
        type: 'doughnut',
        data: {
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
            <canvas ref={ref} id="chart-area" width={184} height={184}></canvas>
        </div>
    );
};

export default MultiRingDoughnut;
