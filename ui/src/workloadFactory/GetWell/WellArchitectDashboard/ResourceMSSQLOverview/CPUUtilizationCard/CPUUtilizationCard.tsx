import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import styles from './CPUUtilizationCard.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import LineGraph from '../../LineGraph/LineGraph';
import { twoFractionDigits } from '../../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../../utils/appConstants';
import { useAppSelector } from '../../../../../store/storeHooks';

const CPUUtilizationCard = () => {
    const { t } = useTranslation();
    const { resourceDetails, resourceLoading } = useAppSelector(state => state.workloadFactoryResource);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [dataPoints, setDataPoints] = useState<any[]>([]);

    useEffect(() => {
        setDataPoints(resourceDetails?.resourceUtilization?.cpu || []);
    }, [resourceDetails]);

    return (
        <div className={styles.cpuUtilization}>
            <div className={styles.headSection}>
                <div className={CommonStyles.textWithTooltip}>
                    <DsTypography variant="Regular_16" className={styles.title}>
                        {GENERAL.CPU_UTILIZATION}
                    </DsTypography>

                    <TooltipInfo>{t('databases.resource-overview.capacity-tooltip')}</TooltipInfo>
                </div>

                <div className={styles.rightTopValue}>{resourceLoading && <DsFlashingDotsLoader />}</div>
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
