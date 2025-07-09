import { DsSelect, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import styles from './TimeSelect.module.scss';
import { setSelectedDates } from '../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../store/storeHooks';

const TimeSelect = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedDates } = useAppSelector(state => state.agenticAI);
    const dateOptions = [
        { id: '1', value: 'June 24, 2025, 00:00', label: 'June 24, 2025, 00:00' },
        { id: '2', value: 'June 23, 2025, 01:00', label: 'June 23, 2025, 01:00' },
        { id: '3', value: 'June 22, 2025, 02:00', label: 'June 22, 2025, 02:00' },
        { id: '4', value: 'June 21, 2025, 03:00', label: 'June 21, 2025, 03:00' }
    ];

    const labelForDate = () => {
        if (selectedDates && selectedDates.length > 0 && selectedDates.length < 2) {
            return `${selectedDates[0].value}`;
        }
        if (selectedDates && selectedDates.length > 1) {
            return `${selectedDates.length} dates selected`;
        }
        return dateOptions[0].value;
    };
    return (
        <div className={styles.timeSelect}>
            <DsTypography variant="Semibold_14">{t('databases.log-analyzer.investigation-date')}:</DsTypography>
            <div className={styles.selectField}>
                <DsSelect
                    isLoading={false}
                    title=""
                    className={styles.multiSelect}
                    options={dateOptions}
                    formatLabel={() => labelForDate()}
                    selectionType="multi"
                    isWithActions
                    variant="underline"
                    onSelect={(option: any) => {
                        dispatch(setSelectedDates(option));
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
                        selectedDates && selectedDates.length > 0
                            ? selectedDates.map((date: any) => date?.id)
                            : [dateOptions[0].id]
                    }
                />
            </div>
        </div>
    );
};

export default TimeSelect;
