import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { DsSelect } from '@tlveng/wlm-ds';
import { DsTypography, TextField } from '@netapp/design-system';
import styles from './AnalyzeCustomTimeframe.module.scss';

import {
    setCustomAnalysisDurationInHours,
    setCustomAnalysisStartTime,
    setCustomAnalysisTime,
    setCustomAnalysisTimeFrameUnit
} from '../../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { timeUnits } from '../../../../../../utils/consts';
import Datepicker from '../../../../../../common/Datepicker/Datepicker';

const AnalyzeCustomTimeframe = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        selectedCustomAnalysisTimeFrameUnit,
        selectedCustomAnalysisTime,
        durationCustomAnalysis,
        startCustomAnalysisTime
    } = useAppSelector(state => state.agenticAI);
    const [selectedDate, setSelectedDate] = useState<Date>(startCustomAnalysisTime || new Date());

    const now = new Date();
    const isTodaySelected = selectedDate.toDateString() === now.toDateString();
    const isCurrentTimeAM = now.getHours() < 12;
    // Disable PM only if selected date is today AND current time still in AM
    const disablePm = isTodaySelected && isCurrentTimeAM;

    const generateUnitsForTimeFrame = [
        {
            id: 1,
            label: 'AM',
            value: 'AM'
        },
        {
            id: 2,
            label: 'PM',
            value: 'PM',
            isDisabled: disablePm
        }
    ];

    const generateTimeForTimeFrame = timeUnits;

    useEffect(() => {
        dispatch(setCustomAnalysisTime(generateTimeForTimeFrame[0]));
    }, [generateTimeForTimeFrame]);

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        dispatch(setCustomAnalysisStartTime(date));
    };

    const utilDateFunction = () => {
        if (
            !startCustomAnalysisTime ||
            !selectedCustomAnalysisTime ||
            !selectedCustomAnalysisTimeFrameUnit ||
            !durationCustomAnalysis
        ) {
            return null;
        }

        const endDate = new Date(startCustomAnalysisTime);

        const [hours, minutes] =
            selectedCustomAnalysisTime &&
            selectedCustomAnalysisTime?.label &&
            selectedCustomAnalysisTime?.label?.split(':')?.map(Number);

        let hour24 = hours;
        if (selectedCustomAnalysisTimeFrameUnit.label === 'PM' && hours !== 12) {
            hour24 = hours + 12;
        } else if (selectedCustomAnalysisTimeFrameUnit.label === 'AM' && hours === 12) {
            hour24 = 0;
        }

        endDate.setHours(hour24, minutes || 0, 0, 0);

        endDate.setHours(endDate.getHours() - Number(durationCustomAnalysis));

        return endDate;
    };

    const formString = () => {
        const startTimeDate =
            startCustomAnalysisTime &&
            startCustomAnalysisTime.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });

        const endDate = utilDateFunction();
        const endTimeDate = endDate?.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        const endTimeHours = endDate?.getHours();
        const endTimeMinutes = endDate?.getMinutes();
        const endTimeAmPm = endTimeHours !== undefined && endTimeHours >= 12 ? 'PM' : 'AM';
        const endTimeHours12 = endTimeHours !== undefined ? endTimeHours % 12 || 12 : '';
        const endTimeFormatted = `${endTimeHours12}:${endTimeMinutes?.toString().padStart(2, '0')}`;

        return `${startTimeDate}, ${selectedCustomAnalysisTime?.label} ${selectedCustomAnalysisTimeFrameUnit?.label} - ${endTimeDate}, ${endTimeFormatted} ${endTimeAmPm}`;
    };

    const checkError = () => {
        if (!durationCustomAnalysis || durationCustomAnalysis === '') {
            return t('databases.log-analyzer.error-msg');
        }
        const duration = Number(durationCustomAnalysis);
        if (duration < 1 || duration > 24) {
            return t('databases.log-analyzer.error-msg');
        }
        return '';
    };

    return (
        <div className={styles['custom-timeframe']}>
            <DsTypography variant="Regular_14" className={styles.secondText}>
                {t('databases.log-analyzer.custom-timeframe-text-1')}
            </DsTypography>

            <Datepicker value={selectedDate} onChange={handleDateChange} />
            <div className={styles.mainContainer}>
                <div className={styles.timeContainer}>
                    <DsSelect
                        title={t('databases.log-analyzer.starting-time')}
                        isCleanable={false}
                        placeholder="Placeholder text"
                        options={generateTimeForTimeFrame}
                        selectionType="single"
                        className={styles.selectFieldTime}
                        onSelect={(option: any) => dispatch(setCustomAnalysisTime(option[0]))}
                        selectedOptionIds={selectedCustomAnalysisTime ? [selectedCustomAnalysisTime?.id] : [1]}
                    />

                    <DsSelect
                        title="Unit"
                        isCleanable={false}
                        placeholder="Placeholder text"
                        options={generateUnitsForTimeFrame}
                        selectionType="single"
                        className={styles.selectFieldUnit}
                        onSelect={(option: any) => dispatch(setCustomAnalysisTimeFrameUnit(option[0]))}
                        selectedOptionIds={
                            selectedCustomAnalysisTimeFrameUnit ? [selectedCustomAnalysisTimeFrameUnit?.id] : [0]
                        }
                    />
                </div>

                <TextField
                    label={t('databases.log-analyzer.duration')}
                    placeholder="Duration"
                    onChange={(event: React.FormEvent<HTMLInputElement>) => {
                        const { value } = event.target as HTMLInputElement;

                        if (value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 24)) {
                            dispatch(setCustomAnalysisDurationInHours(value));
                        }
                    }}
                    value={durationCustomAnalysis?.toString() || ''}
                    className={styles.textFieldStyle}
                    error={checkError()}
                />
            </div>

            <div className={styles.timeFrameContainer}>
                <DsTypography variant="Semibold_14">{t('databases.log-analyzer.selected-timeframe')}:</DsTypography>
                <DsTypography variant="Regular_14">
                    {/* November 12, 2025, 12:00 AM - November 11, 2025, 12:00 AM */}
                    {formString()}
                </DsTypography>
            </div>
        </div>
    );
};

export default AnalyzeCustomTimeframe;
