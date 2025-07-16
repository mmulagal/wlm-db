import React from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './UniqueErrorGraph.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import ErrorLineGraph from './ErrorLineGraph';

const UniqueErrorGraph = ({
    startTime,
    endTime,
    data
}: {
    startTime: number;
    endTime: number;
    data: Array<{ hour: number; count: number }>;
}) => {
    const { t } = useTranslation();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    return (
        <div className={styles.graph}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.log-analyzer.unique-errors-over-time')}
                </DsTypography>
            </div>
            <div className={styles.mainSection}>
                <div className={styles['chart-container']}>
                    <ErrorLineGraph
                        startTime={startTime}
                        endTime={endTime}
                        data={data}
                        color={!isDarkTheme ? '#FDC300' : '#E7BE36'}
                    />
                </div>
            </div>
        </div>
    );
};

export default UniqueErrorGraph;
