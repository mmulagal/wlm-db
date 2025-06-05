import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './LatencyCard.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import LineGraph from '../../LineGraph/LineGraph';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';

const LatencyCard = () => {
    const { resourceDetails, resourceLoading } = useAppSelector(state => state.workloadFactoryResource);

    const [datasets, setDatasets] = useState<number[][]>([[], []]);
    const [readDataPoints, setReadDataPoints] = useState<{ statisticsDate: string; average: number }[]>([]);

    useEffect(() => {
        const readLatency = resourceDetails?.resourceTrend?.readLatency || [];
        const writeLatency = resourceDetails?.resourceTrend?.writeLatency || [];

        setDatasets([readLatency.map(item => item.value), writeLatency.map(item => item.value)]);

        setReadDataPoints(
            readLatency.map(item => ({
                statisticsDate: item.timestamp,
                average: item.value
            }))
        );
    }, [resourceDetails]);

    return (
        <div className={styles.latencyCard}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Latency
                </DsTypography>

                <div className={styles.rightTopValue}>
                    <DsTypography variant="Regular_20">
                        R:{' '}
                        {resourceLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            datasets.length > 0 && datasets[0].length > 0 && `${datasets[0][datasets[1].length - 1]} ms`
                        )}
                    </DsTypography>

                    <SeparatorComponent variant="vertical" height="20px" />

                    <DsTypography variant="Regular_20">
                        W:{' '}
                        {resourceLoading ? (
                            <DsFlashingDotsLoader />
                        ) : (
                            datasets.length > 0 && datasets[1].length > 0 && `${datasets[1][datasets[1].length - 1]} ms`
                        )}
                    </DsTypography>
                </div>
            </div>

            <div className={styles.mainSection}>
                <LineGraph
                    data={datasets}
                    categories={readDataPoints.map(datapoint => {
                        const date = new Date(datapoint.statisticsDate);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                    })}
                    legend={['Read', 'Write']}
                    color={['#012CAD', '#0BAFFC']}
                />
            </div>
        </div>
    );
};

export default LatencyCard;
