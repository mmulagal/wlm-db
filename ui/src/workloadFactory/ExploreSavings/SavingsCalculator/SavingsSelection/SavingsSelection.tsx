import { DsTypography, SelectField, TextField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './SavingsSelection.module.scss';
import { useEffect, useMemo, useState } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import {
    setMonthlyChangeRate,
    setNumberOfClonedCopies,
    setSelectedCloneRefresh,
    setSelectedSnapshotFrequency
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';

const SavingsSelection = ({ printState }: any) => {
    const dispatch = useDispatch();
    const { selectedSnapshotFrequency, numberOfClonedCopies, selectedCloneRefresh, monthlyChangeRate, loading } =
        useAppSelector(state => state.exploreSavings);

    const [noOfClonedCopies, setNoOfClonedCopies] = useState<any>(numberOfClonedCopies);
    const [monthlyChangeRateNo, setMonthlyChangeRateNo] = useState<any>(monthlyChangeRate);

    // Debounce variable
    const [clonedText, setClonedText] = useSearchDebounce(1000);
    const [changeRateText, setChangeRateText] = useSearchDebounce(1000);

    useEffect(() => {
        setClonedText(noOfClonedCopies);
    }, [noOfClonedCopies]);

    useEffect(() => {
        setChangeRateText(monthlyChangeRateNo);
    }, [monthlyChangeRateNo]);

    // Debounce variable update
    useEffect(() => {
        if (clonedText || clonedText === '') {
            dispatch(setNumberOfClonedCopies(clonedText));
        }
    }, [clonedText]);

    useEffect(() => {
        if (changeRateText || changeRateText === '') {
            dispatch(setMonthlyChangeRate(changeRateText));
        }
    }, [changeRateText]);

    //Function to generate the options for Select Field
    const generateSnapshotFrequency = useMemo<optionType[]>((): optionType[] => {
        const frequency = ['No snapshot storage', 'Hourly', 'Daily', '2*Daily', 'Weekly', 'Monthly'];
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!selectedSnapshotFrequency) {
            dispatch(setSelectedSnapshotFrequency(generateSnapshotFrequency[2]));
        }
    }, [generateSnapshotFrequency]);

    //Function to generate the options for Select Field
    const generateCloneRefresh = useMemo<optionType[]>((): optionType[] => {
        const frequency = ['Daily', 'Weekly', 'Monthly'];
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!selectedCloneRefresh) {
            dispatch(setSelectedCloneRefresh(generateCloneRefresh[0]));
        }
    }, [generateCloneRefresh]);

    return (
        <div className={styles.savingsSelection}>
            <DsTypography variant="Regular_14">{GENERAL.ES_SAVINGS_SELECTION_TEXT}</DsTypography>

            <div className={styles.firstRow}>
                <SelectField
                    label={'Snapshot frequency'}
                    isDisabled={loading}
                    isClearable={false}
                    defaultValue={
                        selectedSnapshotFrequency ? selectedSnapshotFrequency : [generateSnapshotFrequency[2]]
                    }
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedSnapshotFrequency(selectedOptions));
                    }}
                    info={
                        selectedSnapshotFrequency &&
                        selectedSnapshotFrequency.label === 'No snapshot storage' &&
                        GENERAL.TOOLTIP_MESSAGE_SNAPSHOT_FREQ
                    }
                    isSearchable={generateSnapshotFrequency.length > 5}
                    options={generateSnapshotFrequency}
                    className={styles.widthSet}
                />
            </div>

            <div className={styles.secondRow}>
                {printState && (
                    <div className={styles.mockInput}>
                        <DsTypography variant="Regular_14" className={styles.mockLabel}>
                            {GENERAL.NUMBER_OF_CLONED_COPIES}
                        </DsTypography>
                        <div className={styles.inputField}>{noOfClonedCopies}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        label={GENERAL.NUMBER_OF_CLONED_COPIES}
                        isDisabled={loading}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setNoOfClonedCopies(e.target.value);
                        }}
                        value={noOfClonedCopies}
                        className={styles.widthSet}
                    />
                )}
                <SelectField
                    label={'Clone refresh frequency'}
                    isClearable={false}
                    isDisabled={loading}
                    defaultValue={selectedCloneRefresh ? selectedCloneRefresh : [generateCloneRefresh[0]]}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedCloneRefresh(selectedOptions));
                    }}
                    isSearchable={generateCloneRefresh.length > 5}
                    options={generateCloneRefresh}
                    className={styles.widthSet}
                />
            </div>

            <div className={styles.secondRow}>
                {printState && (
                    <div className={styles.mockInput}>
                        <DsTypography variant="Regular_14" className={styles.mockLabel}>
                            {GENERAL.MONTHLY_CHANGE_RATE}
                        </DsTypography>
                        <div className={styles.inputField}>{monthlyChangeRateNo}</div>
                    </div>
                )}
                {!printState && (
                    <TextField
                        label={GENERAL.MONTHLY_CHANGE_RATE}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setMonthlyChangeRateNo(e.target.value);
                        }}
                        isDisabled={loading}
                        value={monthlyChangeRateNo ? monthlyChangeRateNo : ''}
                        className={styles.widthSet}
                        info={GENERAL.MONTHLY_CHANGE_RATE_TOOLTIP}
                    />
                )}
                <div className={styles.notice}>
                    <div className={styles.setSVG}>
                        <InfoIcon />
                    </div>
                    <DsTypography variant="Regular_14" className={styles.contentWidth}>
                        {GENERAL.REFER_SNAPSHOTS}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SavingsSelection;
