import { DsTypography, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './RebaseRollbackContent.module.scss';
import { useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const RebaseRollbackContent = () => {
    //Function to generate the options for Select Field
    const generateRollbackOptions = useMemo<optionType[]>((): optionType[] => {
        const frequency = [
            'DB 1 | May 1, 2024, 12:15:11',
            'DB 1 | May 2, 2024, 12:15:11',
            'DB 1 | May 3, 2024, 12:15:11',
            'DB 1 | May 4, 2024, 12:15:11'
        ];
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });
        return options;
    }, []);
    return (
        <div className={styles.rebaseRollBack}>
            <DsTypography variant="Regular_14">
                Select the snapshot you would like the database to Roll-back to
            </DsTypography>
            <SelectField
                label={'Original database snapshot'}
                isClearable={false}
                defaultValue={[generateRollbackOptions[0]]}
                onChange={(selectedOptions: any): void => {}}
                isSearchable={true}
                options={generateRollbackOptions}
                className={styles.widthSet}
            />
        </div>
    );
};

export default RebaseRollbackContent;
