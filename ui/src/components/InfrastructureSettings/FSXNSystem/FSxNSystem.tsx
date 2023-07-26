import { useState, useMemo } from 'react';

import { AccordionCard, AccordionCardContent, RadioButton, TextField, Typography } from '@netapp/design-system';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './FSxNSystem.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const FSxNSystem = () => {
    const [fsxType, setFsxType] = useState(GENERAL.CREATE_NEW_FSXN);
    const [inputName, setInputName] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    //Code for select field
    const fsxList = ['myexistingFSx', 'FSx default'];
    const [selectedFsx, setSelectedFsx] = useState('');

    //Function to generate the options for Select Field
    const generateExistingFsx = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        fsxList?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        setSelectedFsx(options[0].label);
        return options;
    }, []);
    //Set the Header text here
    const setHeader = () => {
        //Checking for the create new option
        if (fsxType === GENERAL.CREATE_NEW_FSXN) {
            if (!inputName || !userName || !password) {
                return <ActionRequired />;
            } else {
                return <Typography variant="Regular_14">{inputName}</Typography>;
            }
        } else {
            //Checking for the existing option
            if (!selectedFsx || !userName || !password) {
                return <ActionRequired />;
            } else {
                return <Typography variant="Regular_14">{selectedFsx}</Typography>;
            }
        }
    };
    return (
        <div className={styles.fsx}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="15"
                title={<div className={CommonStyles.title}>{GENERAL.FSXN_SYSTEM}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={fsxType === GENERAL.CREATE_NEW_FSXN}
                                onChange={() => {
                                    setFsxType(GENERAL.CREATE_NEW_FSXN);
                                }}
                                children={GENERAL.CREATE_NEW_FSXN}
                                className=""
                            />
                            <RadioButton
                                isChecked={fsxType === GENERAL.SELECT_EXISTING_FSX}
                                onChange={() => {
                                    setFsxType(GENERAL.SELECT_EXISTING_FSX);
                                }}
                                children={GENERAL.SELECT_EXISTING_FSX}
                                className=""
                            />
                        </div>
                        <div className={styles.firstContainer}>
                            {fsxType === GENERAL.CREATE_NEW_FSXN && (
                                <TextField
                                    label={GENERAL.FSXN_NAME}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setInputName(e.target.value);
                                    }}
                                    value={inputName}
                                    className={styles.textField}
                                />
                            )}
                            {fsxType === GENERAL.SELECT_EXISTING_FSX && (
                                <SelectField
                                    label={GENERAL.FSXN_NAME}
                                    isClearable={false}
                                    defaultValue={[generateExistingFsx[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        setSelectedFsx(selectedOptions.label);
                                    }}
                                    isSearchable={generateExistingFsx.length > 5}
                                    options={generateExistingFsx}
                                    className={styles.textField}
                                />
                            )}
                        </div>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUserName(e.target.value);
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <TextField
                                label={GENERAL.FSX_PASSWORD}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                }}
                                value={password}
                                className={styles.textField}
                                //@ts-ignore
                                type="password"
                            />
                        </div>

                        <Typography variant="Regular_14" className={styles.bottomText}>
                            <span style={{ fontWeight: '590' }}>{GENERAL.NOTICE}</span>&nbsp;
                            {GENERAL.NOTICE_FSX_TEXT}
                        </Typography>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FSxNSystem;
