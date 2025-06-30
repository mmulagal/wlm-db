import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import styles from './LatencyCard.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import LineGraph from '../../LineGraph/LineGraph';
import { useAppSelector } from '../../../../../store/storeHooks';

const LatencyCard = () => {
    const { t } = useTranslation();

    const { resourceDetails, resourceLoading } = useAppSelector(state => state.workloadFactoryResource);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [datasets, setDatasets] = useState<number[][]>([[], []]);
    const [readDataPoints, setReadDataPoints] = useState<{ statisticsDate: string; average: number }[]>([]);

    useEffect(() => {
        const readLatency = Array.isArray(resourceDetails?.performance?.rwMetrics?.latency?.read)
            ? resourceDetails.performance.rwMetrics.latency.read
            : [];
        const writeLatency = Array.isArray(resourceDetails?.performance?.rwMetrics?.latency?.write)
            ? resourceDetails.performance.rwMetrics.latency.write
            : [];

        setDatasets([
            Array.isArray(readLatency) ? readLatency.map(item => item.value) : [],
            Array.isArray(writeLatency) ? writeLatency.map(item => item.value) : []
        ]);

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
                <div className={CommonStyles.textWithTooltip}>
                    <DsTypography variant="Regular_16" className={styles.title}>
                        Latency
                    </DsTypography>
                    <TooltipInfo>{t('databases.resource-overview.latency-tooltip')}</TooltipInfo>
                </div>

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

export default LatencyCard;
