import { DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import styles from './CPUUtilizationCard.module.scss';
import LineGraph from '../../LineGraph/LineGraph';
import { twoFractionDigits } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';

const CPUUtilizationCard = () => {
    const { resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [dataPoints, setDataPoints] = useState<any[]>([]);

    useEffect(() => {
        setDataPoints(resourceDetails?.resourceUtilization?.cpu || []);
    }, [resourceDetails]);

    return (
        <div className={styles.cpuUtilization}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.CPU_UTILIZATION}
                </DsTypography>

                {/* <div className={styles.rightTopValue}>
                    <DsTypography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                        {!resourceLoading && dataPoints.length > 0 && `${dataPoints[dataPoints.length - 1].value} %`}
                    </DsTypography>
                    {resourceLoading && <DsFlashingDotsLoader />}
                </div> */}
            </div>

            <div className={styles.mainSection}>
                <LineGraph
                    data={dataPoints.map(datapoint => Number((datapoint.value || 0).toFixed(1)))}
                    categories={dataPoints.map(datapoint => {
                        const date = new Date(datapoint.timestamp);
                        return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
                    })}
                    yTickFormatter={twoFractionDigits}
                    color={!isDarkTheme ? '#A815F3' : '#DE9EFF'}
                />
            </div>
        </div>
    );
};

export default CPUUtilizationCard;
