import { DsFlashingDotsLoader, Typography } from '@netapp/design-system';
import { Chart, registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './SandboxChart.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { getSandboxDistributionByAge } from '../../SandboxUtility';

Chart.register(...registerables);

const SandboxChart = ({ aggregatedSandboxList, loading }: any) => {
    const { t } = useTranslation();
    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();
    const { showNA } = useAppSelector(state => state.headers);

    const doughnutOptions = {
        plugins: {
            legend: {
                display: false
            }
        }
    };

    const config = {
        type: 'doughnut',
        data: {
            datasets: [
                {
                    data: Object.values(getSandboxDistributionByAge(aggregatedSandboxList)),
                    backgroundColor: ['#68C6B3', '#A815F3', '#FDC300']
                }
            ]
            //   labels: label,
        },
        options: { ...doughnutOptions, animation: false }
    };

    useEffect(() => {
        if (ref.current) {
            // @ts-ignore
            var myDoughnut = new Chart(ref.current, config);
            setDoughnutChart(myDoughnut);
        }
        return () => {
            if (myDoughnut) myDoughnut.destroy();
        };
    }, [aggregatedSandboxList]);

    return (
        <div className={styles.sandboxChart} id="chart-item">
            <div className={styles['center-text']}>
                {!showNA && (
                    <Typography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {aggregatedSandboxList.length}
                    </Typography>
                )}

                {showNA && (
                    <Typography variant="Regular_16" className={CommonStyles.notAvailable}>
                        {t('databases.general.not-available')}
                    </Typography>
                )}
                <Typography variant="Regular_14" className={showNA ? ` ${CommonStyles.notAvailable}` : ''}>
                    {GENERAL.SANDBOXES}
                </Typography>
                {loading && <DsFlashingDotsLoader />}
            </div>
            {/* @ts-ignore */}

            {(showNA || aggregatedSandboxList.length === 0) && <div className={styles.emptyCircle} />}

            {aggregatedSandboxList.length !== 0 && <canvas ref={ref} id="chart-area" width={184} height={184} />}
        </div>
    );
};

export default SandboxChart;
