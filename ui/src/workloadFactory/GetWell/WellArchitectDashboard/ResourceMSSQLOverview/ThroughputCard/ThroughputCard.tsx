import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import LineGraph from '../../LineGraph/LineGraph';
import styles from './ThroughputCard.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import { useAppSelector } from '../../../../../store/storeHooks';

const ThroughputCard = () => {
    const { resourceDetails, resourceLoading } = useAppSelector(state => state.workloadFactoryResource);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [datasets, setDatasets] = useState<number[][]>([[], []]);
    const [readDataPoints, setReadDataPoints] = useState<{ statisticsDate: string; average: number }[]>([]);

    useEffect(() => {
        const readThroughput = Array.isArray(resourceDetails?.performance?.rwMetrics?.throughput?.read)
            ? resourceDetails.performance.rwMetrics.throughput.read
            : [];
        const writeThroughput = Array.isArray(resourceDetails?.performance?.rwMetrics?.throughput?.write)
            ? resourceDetails.performance.rwMetrics.throughput.write
            : [];

        setDatasets([readThroughput.map(item => item.value), writeThroughput.map(item => item.value)]);

        setReadDataPoints(
            readThroughput.map(item => ({
                statisticsDate: item.timestamp,
                average: item.value
            }))
        );
    }, [resourceDetails]);

    return (
        <div className={styles.throughputCard}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Throughput
                </DsTypography>

                <div className={styles.rightTopValue}>
                    <DsTypography variant="Regular_20">{resourceLoading && <DsFlashingDotsLoader />}</DsTypography>
                </div>
            </div>

            <div className={styles.mainSection}>
                <LineGraph
                    data={datasets}
                    categories={readDataPoints.map(datapoint => {
                        const date = new Date(datapoint.statisticsDate);
                        return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
                    })}
                    legend={['Read', 'Write']}
                    color={isDarkTheme ? ['#71B9E0', '#4066DA'] : ['#012CAD', '#0BAFFC']}
                />
            </div>
        </div>
    );
};

export default ThroughputCard;
