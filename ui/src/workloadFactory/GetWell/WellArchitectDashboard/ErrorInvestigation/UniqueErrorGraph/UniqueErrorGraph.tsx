import React from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { RadioButton } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import styles from './UniqueErrorGraph.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { ErrorInvestigationGetApiResponse } from '../../../../../utils/types/agenticAITypes';
import ErrorLineGraph from './ErrorLineGraph';
import { setSelectedGraphType } from '../../../../../store/workloadFactory/agenticAISlice';
import ErrorBarGraph from './ErrorBarGraph/ErrorBarGraph';

const UniqueErrorGraph = ({
    startTime,
    endTime,
    data,
    errorCardsData
}: {
    startTime: number;
    endTime: number;
    data: Array<{ hour: number; count: number }>;
    errorCardsData: ErrorInvestigationGetApiResponse[];
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { uniqueErrorGraphType, investigationDatesLoading } = useAppSelector(state => state.agenticAI);

    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = errorInvestigationLoading || investigationDatesLoading;

    return (
        <div className={styles.graph}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.log-analyzer.unique-error-distribution')}
                </DsTypography>
            </div>
            <div className={styles.mainSection}>
                <div className={styles.radioSection}>
                    <RadioButton
                        id="select-unique-error-over-time"
                        isChecked={uniqueErrorGraphType === 'over-time'}
                        onChange={() => {
                            dispatch(setSelectedGraphType('over-time'));
                        }}
                        children={t('databases.log-analyzer.unique-errors-over-time')}
                        className=""
                        isDisabled={loading}
                    />
                    <RadioButton
                        id="select-unique-error-by-tags"
                        isChecked={uniqueErrorGraphType === 'by-tags'}
                        onChange={() => {
                            dispatch(setSelectedGraphType('by-tags'));
                        }}
                        children={t('databases.log-analyzer.unique-errors-by-tags')}
                        className=""
                        isDisabled={loading}
                    />
                </div>
                <div className={styles['chart-container']}>
                    {uniqueErrorGraphType === 'over-time' && (
                        <ErrorLineGraph
                            startTime={startTime}
                            endTime={endTime}
                            data={data}
                            color={!isDarkTheme ? '#FDC300' : '#E7BE36'}
                        />
                    )}
                    {uniqueErrorGraphType === 'by-tags' && <ErrorBarGraph errorCardsData={errorCardsData} />}
                </div>
            </div>
        </div>
    );
};

export default UniqueErrorGraph;
