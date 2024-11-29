import { Chart } from 'chart.js';
import { registerables } from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import styles from './OptimizationChart.module.scss';
import { DsFlashingDotsLoader, DsTypography, Typography } from '@netapp/design-system';
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
                    data: [hostData?.percent || 0, 100 - (hostData?.percent || 0)],
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
                        <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }} isDisabled={true}>
                            {GENERAL.NOT_AVAILABLE}
                        </DsTypography>
                    ))}
                {optimizePageLoading && (
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        {hostData?.percent || 0}%
                    </DsTypography>
                )}
                <DsTypography
                    variant="Regular_14"
                    isDisabled={!optimizePageLoading && !isAssessmentAvailable ? true : false}
                >
                    Optimization score
                </DsTypography>
                {optimizePageLoading && <DsFlashingDotsLoader />}
            </div>
            {(!isAssessmentAvailable || optimizePageLoading) && <div className={styles.emptyCircle}></div>}
            {isAssessmentAvailable && !optimizePageLoading ? (
                <canvas ref={ref} id="chart-area" width={200} height={200}></canvas>
            ) : null}
        </div>
    );
};

export default OptimizationChart;
