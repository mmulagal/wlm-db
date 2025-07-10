import { DsSelect, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import styles from './TimeSelect.module.scss';
import {
    setNoErrorsDetected,
    setNoLogAnalyzerData,
    setSelectedInvestigationDate
} from '../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { formatDateWithTime } from '../../../../../utils/utilityFunctions';

const TimeSelect = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedInvestigationDate, investigationDates, investigationDatesLoading } = useAppSelector(
        state => state.agenticAI
    );
    const dateOptions = useMemo(() => {
        const options = investigationDates.map(date => ({
            id: date.id,
            value: date.reportCreationTime,
            label: formatDateWithTime(date.reportCreationTime)
        }));
        dispatch(setSelectedInvestigationDate(options[0]));
        return options;
    }, [investigationDates]);

    return (
        <div className={styles.timeSelect}>
            <DsTypography variant="Semibold_14">{t('databases.log-analyzer.investigation-date')}:</DsTypography>
            <div className={styles.selectField}>
                <DsSelect
                    isLoading={investigationDatesLoading}
                    title=""
                    className={styles.multiSelect}
                    options={dateOptions}
                    selectionType="single"
                    isWithActions
                    variant="underline"
                    onSelect={(option: any) => {
                        dispatch(setNoLogAnalyzerData(false));
                        dispatch(setNoErrorsDetected(false));
                        dispatch(setSelectedInvestigationDate(option[0]));
                    }}
                    placeholder="No date selected"
                    isCleanable={false}
                    dropDown={{
                        isCloseOnClickOutside: true
                    }}
                    searchMethod={{
                        method: 'smart'
                    }}
                    selectedOptionIds={
                        selectedInvestigationDate && selectedInvestigationDate?.id
                            ? [selectedInvestigationDate?.id]
                            : [dateOptions?.[0]?.id]
                    }
                />
            </div>
        </div>
    );
};

export default TimeSelect;
