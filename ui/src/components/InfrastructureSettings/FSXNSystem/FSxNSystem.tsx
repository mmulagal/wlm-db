import { useState, useMemo, useEffect } from 'react';

import { AccordionCard, AccordionCardContent, RadioButton, TextField, Typography } from '@netapp/design-system';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './FSxNSystem.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setExistingFsxnName,
    setFsxNName,
    setFsxNPassword,
    setFsxNType,
    setFsxNUserName
} from '../../../store/mssql/mssqlFormSlice';

const FSxNSystem = () => {
    const dispatch = useDispatch();
    const selectedFsxnName = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxName);
    const selectedFsxnUserName = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxNUserName);
    const selectedFsxnPassword = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxNPassword);
    const isFsxNNameFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);
    const selectedExistingFsxnName = useAppSelector((state: any) => state.mssqlForm.fsxN.fsxNExistingName);

    const isFsxNotFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);

    const [fsxType, setFsxType] = useState(GENERAL.CREATE_NEW_FSXN);
    const [inputName, setInputName] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    //Code for select field
    const fsxList = ['myexistingFSx', 'FSx default'];

    //Function to generate the options for Select Field
    const generateExistingFsx = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        fsxList?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        dispatch(setExistingFsxnName(generateExistingFsx[0]));
    }, [generateExistingFsx]);
    //Set the Header text here
    const setHeader = () => {
        //Checking for the create new option
        if (fsxType === GENERAL.CREATE_NEW_FSXN) {
            if (!inputName || !userName || !password) {
                return <ActionRequired error={!isFsxNotFilled ? true : false} />;
            } else {
                return <Typography variant="Regular_14">{inputName}</Typography>;
            }
        } else {
            //Checking for the existing option
            if (!selectedExistingFsxnName?.label || !userName || !password) {
                return <ActionRequired />;
            } else {
                return <Typography variant="Regular_14">{selectedExistingFsxnName.label}</Typography>;
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
                                    dispatch(setFsxNType(GENERAL.CREATE_NEW_FSXN));
                                }}
                                children={GENERAL.CREATE_NEW_FSXN}
                                className=""
                            />
                            <RadioButton
                                isChecked={fsxType === GENERAL.SELECT_EXISTING_FSX}
                                onChange={() => {
                                    setFsxType(GENERAL.SELECT_EXISTING_FSX);
                                    dispatch(setFsxNType(GENERAL.SELECT_EXISTING_FSX));
                                }}
                                children={GENERAL.SELECT_EXISTING_FSX}
                                className=""
                            />
                        </div>
                        <div className={styles.firstContainer}>
                            {fsxType === GENERAL.CREATE_NEW_FSXN && (
                                <TextField
                                    label={GENERAL.FSXN_NAME}
                                    error={!isFsxNNameFilled ? 'Action Required' : ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setInputName(e.target.value);
                                        dispatch(setFsxNName(e.target.value));
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
                                        dispatch(setExistingFsxnName(selectedOptions));
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
                                    dispatch(setFsxNUserName(e.target.value));
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <TextField
                                label={GENERAL.FSX_PASSWORD}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                    dispatch(setFsxNPassword(e.target.value));
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
