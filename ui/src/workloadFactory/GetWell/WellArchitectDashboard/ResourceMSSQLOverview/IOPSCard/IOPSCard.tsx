import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './IOPSCard.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import LineGraph from '../../LineGraph/LineGraph';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useEffect, useState } from 'react';

const IOPSCard = () => {
    const { resourceDetails, resourceLoading } = useAppSelector(state => state.workloadFactoryResource);

    const [datasets, setDatasets] = useState<number[][]>([[], []]);
    const [readDataPoints, setReadDataPoints] = useState<{ statisticsDate: string; average: number }[]>([]);

    useEffect(() => {
        const readIOPS = resourceDetails?.resourceTrend?.readIops || [];
        const writeIOPS = resourceDetails?.resourceTrend?.writeIops || [];

        setDatasets([readIOPS.map(item => item.value), writeIOPS.map(item => item.value)]);

        setReadDataPoints(
            readIOPS.map(item => ({
                statisticsDate: item.timestamp,
                average: item.value
            }))
        );
    }, [resourceDetails]);

    return (
        <div className={styles.iops}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    IOPS
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

export default IOPSCard;
