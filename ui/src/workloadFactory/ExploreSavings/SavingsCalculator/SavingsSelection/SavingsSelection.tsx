import { DsTypography, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './SavingsSelection.module.scss';
import { useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const SavingsSelection = () => {
    //Function to generate the options for Select Field
    const generateKey = useMemo<optionType[]>((): optionType[] => {
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
                    isClearable={false}
                    defaultValue={[generateKey[0]]}
                    onChange={(selectedOptions: any): void => {}}
                    isSearchable={generateKey.length > 5}
                    options={generateKey}
                />
            </div>
        </div>
    );
};

export default SavingsSelection;
