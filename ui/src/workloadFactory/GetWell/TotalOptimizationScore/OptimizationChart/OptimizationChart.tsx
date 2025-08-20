import { Chart, registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { DsFlashingDotsLoader, DsTypography, Typography } from '@netapp/design-system';
import styles from './OptimizationChart.module.scss';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';

Chart.register(...registerables);

type MultiRingDoughnutPropType = {
    unProtectColor?: string;
    hostData?: any;
};

const OptimizationChart = ({ unProtectColor, hostData }: MultiRingDoughnutPropType) => {
    const { optimizePageLoading, isAssessmentAvailable } = useAppSelector(state => state.getWellOptimize);
    const unProtectedColor = '#E0E0E0';

    const ref = useRef<HTMLCanvasElement>(null);
    const [doughnutChart, setDoughnutChart] = useState<any>();

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        cutout: '80%',
        plugins: {
            legend: {
                display: false
            }
        }
    };

    const setColor = (value: any) => {
        if (value <= 25) {
            return '#FE5502';
        }
        if (value > 25 && value <= 50) {
            return '#F7941D';
        }
        if (value > 50 && value <= 75) {
            return '#FDC300';
        }
        if (value > 75 && value < 100) {
            return '#68C6B3';
        }
        return unProtectedColor;
    };

    const config = {
        type: 'doughnut',
        data: {
            datasets: [
                {
                    data: [hostData?.percent || 0, 100 - (hostData?.percent || 0)],
                    backgroundColor: [setColor(hostData?.percent), unProtectedColor]
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
            if (myDoughnut) {
                myDoughnut.destroy();
            }
            // if (hostData?.protectedPercent !== 0 || hostData?.unprotectedPercent !== 0) myDoughnut.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostData]);

    return (
        <div className={styles.optimizationChart} id="chart-item">
            <div className={styles['center-text']}>
                {!optimizePageLoading &&
                    (isAssessmentAvailable ? (
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {hostData?.percent || 0}%
                        </DsTypography>
                    ) : (
                        <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }} isDisabled>
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    ))}
                {optimizePageLoading && (
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {hostData?.percent || 0}%
                    </DsTypography>
                )}

                {optimizePageLoading && <DsFlashingDotsLoader />}
            </div>
            {(!isAssessmentAvailable || optimizePageLoading) && <div className={styles.emptyCircle} />}
            {isAssessmentAvailable && !optimizePageLoading ? <canvas ref={ref} id="chart-area" /> : null}
        </div>
    );
};

export default OptimizationChart;
