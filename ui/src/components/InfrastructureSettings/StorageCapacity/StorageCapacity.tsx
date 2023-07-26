import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import styles from './StorageCapacity.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import AccordionError from '../../../common/AccordionError/AccordionError';

const StorageCapacity = () => {
    const [input, setInput] = useState('');

    const units = ['TiB', 'GiB'];
    const [unit, setUnit] = useState(GENERAL.SQL_SERVER_2016);

    //Function to generate the options for Select Field
    const generateUnitsForStorage = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    //Set the Header text here
    const setHeader = () => {
        if (checkError()) {
            return <AccordionError />;
        }
        return (
            <Typography variant="Regular_14">
                {input} {unit}
            </Typography>
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const re = /^[0-9\b]+$/;

        // if value is not blank, then test the regex

        if (e.target.value === '' || re.test(e.target.value)) {
            setInput(e.target.value);
        }
    };

    const checkError = () => {
        if (unit === 'TiB' && Number(input) > 192) {
            return GENERAL.ERROR_CAPACITY;
        }
    };
    return (
        <div className={styles['storage-capacity']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="16"
                title={<div className={CommonStyles.title}>{GENERAL.STORAGE_CAPACITY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.container}>
                            <TextField
                                label={GENERAL.CAPACITY}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    handleChange(e);
                                }}
                                value={input}
                                className={styles.textfield}
                                error={checkError()}
                            />
                            <SelectField
                                label={GENERAL.UNIT}
                                isClearable={false}
                                defaultValue={[generateUnitsForStorage[0]]}
                                onChange={(selectedOptions: any): void => {
                                    setUnit(selectedOptions.label);
                                }}
                                isSearchable={generateUnitsForStorage.length > 5}
                                options={generateUnitsForStorage}
                                className={styles.selectField}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default StorageCapacity;
