import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import styles from './IOPSCard.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import LineGraph from '../../LineGraph/LineGraph';
import { useAppSelector } from '../../../../../store/storeHooks';

type IOPSCardProps = { resourceDetails: any; resourceLoading: boolean };

const IOPSCard = ({ resourceDetails, resourceLoading }: IOPSCardProps) => {
    const { t } = useTranslation();

    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [datasets, setDatasets] = useState<number[][]>([[], []]);
    const [readDataPoints, setReadDataPoints] = useState<{ statisticsDate: string; average: number }[]>([]);

    useEffect(() => {
        const readIOPS = Array.isArray(resourceDetails?.performance?.rwMetrics?.iops?.read)
            ? resourceDetails.performance.rwMetrics.iops.read
            : [];
        const writeIOPS = Array.isArray(resourceDetails?.performance?.rwMetrics?.iops?.write)
            ? resourceDetails.performance.rwMetrics.iops.write
            : [];

        setDatasets([
            Array.isArray(readIOPS) ? readIOPS.map(item => item.value) : [],
            Array.isArray(writeIOPS) ? writeIOPS.map(item => item.value) : []
        ]);

        setReadDataPoints(
            Array.isArray(readIOPS)
                ? readIOPS.map(item => ({
                      statisticsDate: item.timestamp,
                      average: item.value
                  }))
                : []
        );
    }, [resourceDetails]);

    return (
        <div className={styles.iops}>
            <div className={styles.headSection}>
                <div className={CommonStyles.textWithTooltip}>
                    <DsTypography variant="Regular_16" className={styles.title}>
                        IOPS
                    </DsTypography>
                    <TooltipInfo>{t('databases.resource-overview.iops-tooltip')}</TooltipInfo>
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

export default IOPSCard;
