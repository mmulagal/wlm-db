import { PasswordField, TextField, Typography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './UndetectedHostDialogContentV2.module.scss';
import {
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPUserName,
    setDetectONTAPPassword
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsDetectHostError } from '../../../../store/mssql/msSqlActionSlice';
import { GENERAL } from '../../../../utils/appConstants';

import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';

type DialogProps = {
    rowData: any;
};

const UndetectedHostDialogContentV2 = ({ rowData }: DialogProps) => {
    const dispatch = useDispatch();
    const { detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword } = useAppSelector(
        state => state.inventoryV2
    );

    const [textSearch, setTextSearch] = useSearchDebounce(1000);
    const [ontapPasswordSearch, setOntapPasswordSearch] = useSearchDebounce(1000);
    const [detectUserNameSearch, setDetectUserNameSearch] = useSearchDebounce(1000);
    const [detectPasswordSearch, setDetectPasswordSearch] = useSearchDebounce(1000);

    const [ontapUserName, setOntapUserName] = useState('');
    const [ontapPassword, setOntapPassword] = useState('');
    const [detectUserName, setDetectUserName] = useState('');
    const [detectPassword, setDetectPassword] = useState('');
    const topRowValuesNotFilled = useAppSelector(state => state.inventoryV2.valuesNotFilled);

    useEffect(() => {
        dispatch(setIsDetectHostError(''));
    }, [detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword]);

    // Use effect for ontap username
    useEffect(() => {
        setTextSearch(ontapUserName);
    }, [ontapUserName]);

    useEffect(() => {
        dispatch(setDetectONTAPUserName(textSearch));
    }, [textSearch]);

    // Use effect for detect username
    useEffect(() => {
        setDetectUserNameSearch(detectUserName);
    }, [detectUserName]);

    useEffect(() => {
        dispatch(setDetectManageUserName(detectUserNameSearch));
    }, [detectUserNameSearch]);

    // Use effect for ontap password
    useEffect(() => {
        setOntapPasswordSearch(ontapPassword);
    }, [ontapPassword]);

    useEffect(() => {
        dispatch(setDetectONTAPPassword(ontapPasswordSearch));
    }, [ontapPasswordSearch]);

    // useEffect for detect password
    useEffect(() => {
        setDetectPasswordSearch(detectPassword);
    }, [detectPassword]);

    useEffect(() => {
        dispatch(setDetectManagePassword(detectPasswordSearch));
    }, [detectPasswordSearch]);

    return (
        <div className={styles.undetectedHostContent}>
            <div className={styles.dialogMsg}>
                <Typography variant="Regular_14">
                    {rowData &&
                    (rowData?.fileSystemType === GENERAL.FSX_FOR_WINDOWS || rowData?.fileSystemType === GENERAL.EBS)
                        ? GENERAL.DETECT_ONLY_INSTANCE
                        : GENERAL.DETECT_INSTANCE_DESC}
                </Typography>
                &nbsp;
                <Typography variant="Semibold_14">{rowData?.databaseInstanceName}</Typography>
            </div>

            {/* MSSQL credential is asked when it is not yet registered */}
            {!rowData?.sqlServerAuthentication && !rowData?.windowsAuthentication && (
                <div className={styles.firstSection}>
                    <Typography variant="Semibold_14">{GENERAL.DETECT_MSSQL_HEADING}</Typography>
                    <div className={styles.textFieldContainer}>
                        <TextField
                            label={GENERAL.DETECT_MSSQL_USERNAME}
                            value={detectUserName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setDetectUserName(e.target.value);
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectManageUserName ? GENERAL.ACTION_REQUIRED : ''}
                        />

                        <PasswordField
                            label={GENERAL.DETECT_MSSQL_PASSWORD}
                            value={detectPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setDetectPassword(e.target.value);
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectManagePassword ? GENERAL.ACTION_REQUIRED : ''}
                        />
                    </div>
                </div>
            )}

            {/* FSx credential is asked when this instance has FSx and its credential is not yet registered */}
            {rowData?.fsxId && !rowData?.isFsxRegistered && (
                <div className={styles.secondSection}>
                    <Typography variant="Semibold_14">{GENERAL.DETECT_FSX_HEADING}</Typography>
                    <div className={styles.textFieldContainer}>
                        <TextField
                            label={GENERAL.DETECT_FSX_USERNAME}
                            value={ontapUserName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setOntapUserName(e.target.value);
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectOntapUsername ? GENERAL.ACTION_REQUIRED : ''}
                        />

                        <PasswordField
                            label={GENERAL.DETECT_FSX_PASSWORD}
                            value={ontapPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setOntapPassword(e.target.value);
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectOntapPassword ? GENERAL.ACTION_REQUIRED : ''}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UndetectedHostDialogContentV2;
