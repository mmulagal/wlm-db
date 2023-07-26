import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './KepPair.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';

const KeyPair = () => {
    const keys = ['Key1', 'Key2'];
    const [key, setKey] = useState('');

    //Function to generate the options for Select Field
    const generateKey = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        keys?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        setKey(options[0].label);
        return options;
    }, []);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{key}</Typography>;
    };
    return (
        <div className={styles.key}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="12"
                title={<div className={CommonStyles.title}>{GENERAL.KEY_PAIR}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.selectField}>
                            <SelectField
                                label={GENERAL.KEY_PAIR_NAME}
                                isClearable={false}
                                defaultValue={[generateKey[0]]}
                                onChange={(selectedOptions: any): void => {
                                    setKey(selectedOptions.label);
                                }}
                                isSearchable={generateKey.length > 5}
                                options={generateKey}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default KeyPair;
