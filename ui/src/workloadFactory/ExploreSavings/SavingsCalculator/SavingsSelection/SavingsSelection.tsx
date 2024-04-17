import { DsTypography, SelectField, TextField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './SavingsSelection.module.scss';
import { useMemo } from 'react';
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

const SavingsSelection = () => {
    const dispatch = useDispatch();
    const { selectedSnapshotFrequency, numberOfClonedCopies, selectedCloneRefresh, monthlyChangeRate, loading } =
        useAppSelector(state => state.exploreSavings);
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
    return (
        <div className={styles.savingsSelection}>
            <DsTypography variant="Regular_14">
                Provide clone and snapshot values to calculate the cost savings if you use FSx for ONTAP volumes.
            </DsTypography>

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
                    isSearchable={generateSnapshotFrequency.length > 5}
                    options={generateSnapshotFrequency}
                    className={styles.widthSet}
                />
            </div>

            <div className={styles.secondRow}>
                <TextField
                    label={'Number of cloned copies'}
                    isDisabled={loading}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        dispatch(setNumberOfClonedCopies(e.target.value));
                    }}
                    value={numberOfClonedCopies}
                    className={styles.widthSet}
                />
                <SelectField
                    label={'Clone refresh'}
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
                <TextField
                    label={'Monthly change rate (%)'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        dispatch(setMonthlyChangeRate(e.target.value));
                    }}
                    isDisabled={loading}
                    value={monthlyChangeRate ? monthlyChangeRate : ''}
                    className={styles.widthSet}
                />
                <div className={styles.notice}>
                    <div className={styles.setSVG}>
                        <InfoIcon />
                    </div>
                    <DsTypography variant="Regular_14" className={styles.contentWidth}>
                        This field refer to clones and snapshots
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SavingsSelection;
