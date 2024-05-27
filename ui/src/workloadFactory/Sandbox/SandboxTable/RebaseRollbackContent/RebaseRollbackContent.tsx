import { DsRadioButton, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './RebaseRollbackContent.module.scss';
import { useMemo, useState } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';

const RebaseRollbackContent = () => {
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const [rollbackSelected, setRollbackSelected] = useState(false);
    //Function to generate the options for Select Field
    const generateRollbackOptions = useMemo<optionType[]>((): optionType[] => {
        const frequency = isDemoMode
            ? [
                  'DB 1 | May 1, 2024, 12:15:11',
                  'DB 1 | May 2, 2024, 12:15:11',
                  'DB 1 | May 3, 2024, 12:15:11',
                  'DB 1 | May 4, 2024, 12:15:11'
              ]
            : [];
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });
        return options;
    }, []);
    return (
        <div className={styles.rebaseRollBack}>
            <div className={styles.radioContainer}>
                <DsRadioButton
                    id="refresh-current-time"
                    isSelected={true}
                    title={GENERAL.REFRESH_CURRENT_RADIO}
                    variant="Default"
                />
                <DsRadioButton
                    id="refresh-snapshot"
                    isSelected={false}
                    isDisabled={true}
                    title={GENERAL.REFRESH_SNAPSHOT_RADIO}
                    variant="Default"
                />
            </div>
            <SelectField
                label={'Original database snapshot'}
                isClearable={false}
                defaultValue={[generateRollbackOptions[0]]}
                onChange={(selectedOptions: any): void => {}}
                isSearchable={true}
                options={generateRollbackOptions}
                className={styles.widthSet}
                isDisabled={!rollbackSelected}
            />
        </div>
    );
};

export default RebaseRollbackContent;
