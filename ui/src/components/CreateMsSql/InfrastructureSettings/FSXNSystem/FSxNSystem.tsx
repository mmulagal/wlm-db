import { useState, useMemo, useEffect } from 'react';

import {
    AccordionCard,
    AccordionCardContent,
    PasswordField,
    RadioButton,
    TextField,
    Typography
} from '@netapp/design-system';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { fsxPassVal, generateOptionType } from '../../../../utils/utilityFunctions';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import styles from './FSxNSystem.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setExistingFsxnName,
    setFsxNName,
    setFsxNPassword,
    setFsxNType,
    setFsxNExistingUserName
} from '../../../../store/mssql/mssqlFormSlice';
import { FSXADMIN } from '../../../../utils/consts';
import AccordionError from '../../../../common/AccordionError/AccordionError';

const FSxNSystem = () => {
    const dispatch = useDispatch();

    const { fsxnData, fsxnLoading } = useAppSelector(state => state.mssql.getFsxnList);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const selectedFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNName);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedFsxnNewUserName = useAppSelector(state => state.mssqlForm.fsxN.fsxNNewUserName);
    const selectedFsxnExistingUserName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingUserName);
    const selectedFsxnPassword = useAppSelector(state => state.mssqlForm.fsxN.fsxNPassword);
    const isFsxNNameFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);

    const isFsxNotFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);

    const [fsxType, setFsxType] = useState(selectedFsxnType);

    const [password, setPassword] = useState('');

    //Function to generate the options for Select Field
    const generateExistingFsx = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        fsxnData?.filesystems?.map((val, idx: number) => {
            const value = val?.fileSystemName || val?.fileSystemId || '';
            const data = {
                fileSystemId: val?.fileSystemId,
                fileSystemName: val?.fileSystemName
            };
            const option = generateOptionType(value, value, '', false, '', data);
            options.push(option);
        });

        return options;
    }, [fsxnData]);

    useEffect(() => {
        dispatch(setExistingFsxnName(generateExistingFsx[0]));
        dispatch(setFsxNExistingUserName(FSXADMIN));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateExistingFsx]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return '';
        } else if (!selectedVPCData) {
            return '';
        }

        //Checking for the create new option
        if (fsxType === GENERAL.CREATE_NEW_FSXN) {
            if (!selectedFsxnName || !selectedFsxnNewUserName || !selectedFsxnPassword) {
                return <ActionRequired error={!isFsxNotFilled ? true : false} />;
            } else if (fsxPassVal(password)) {
                return <AccordionError />;
            } else {
                return <Typography variant="Regular_14">{selectedFsxnName}</Typography>;
            }
        } else {
            //Checking for the existing option
            if (!selectedExistingFsxnName?.label || !selectedFsxnExistingUserName || !selectedFsxnPassword) {
                return <ActionRequired />;
            } else if (fsxPassVal(password)) {
                return <AccordionError />;
            } else {
                return <Typography variant="Regular_14">{selectedExistingFsxnName.label}</Typography>;
            }
        }
    };

    return (
        <div className={styles.fsx}>
            <AccordionCard
                isLoading={fsxnLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
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
                                    error={!isFsxNNameFilled && !selectedFsxnName ? GENERAL.ACTION_REQUIRED : ''}
                                    //@ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--error'
                                            }}
                                        />
                                    }
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setFsxNName(e.target.value));
                                    }}
                                    value={selectedFsxnName ? selectedFsxnName : ''}
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
                                    dispatch(setFsxNExistingUserName(e.target.value));
                                }}
                                value={
                                    fsxType === GENERAL.SELECT_EXISTING_FSX && selectedFsxnExistingUserName
                                        ? selectedFsxnExistingUserName
                                        : FSXADMIN
                                }
                                className={styles.textField}
                                isDisabled={fsxType === GENERAL.CREATE_NEW_FSXN}
                            />
                            <PasswordField
                                label={GENERAL.FSX_PASSWORD}
                                info={
                                    <Typography variant="Regular_13" className={styles.infoMsg}>
                                        <ul>
                                            <li>{GENERAL.PASSWORD_FSX_1}</li>
                                            <li>{GENERAL.PASSWORD_FSX_2}</li>
                                            <li>{GENERAL.PASSWORD_FSX_3}</li>
                                            <li>{GENERAL.PASSWORD_FSX_4}</li>
                                        </ul>
                                    </Typography>
                                }
                                error={fsxPassVal(password)}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                    dispatch(setFsxNPassword(e.target.value));
                                }}
                                value={selectedFsxnPassword}
                                className={styles.textFieldPassword}
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
