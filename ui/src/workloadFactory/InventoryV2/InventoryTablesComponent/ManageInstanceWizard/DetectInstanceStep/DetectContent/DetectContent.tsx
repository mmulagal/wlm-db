import { DsTypography, PasswordField, RadioButton, TextField, useWizard } from '@netapp/design-system';
import styles from './DetectContent.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { AUTHENTICATION_TYPE } from '../../../../../../utils/consts';
import {
    setAuthenticationType,
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPPassword,
    setDetectONTAPUserName
} from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useEffect, useState } from 'react';
import { useSearchDebounce } from '../../../../../../common/hooks/useSearchDebounce';
import { setIsDetectHostError } from '../../../../../../store/mssql/msSqlActionSlice';
import { GENERAL } from '../../../../../../utils/appConstants';

const DetectContent = () => {
    const dispatch = useDispatch();
    const { state, setState }: any = useWizard();
    const { ontapUserNameFromWizard, ontapPasswordFromWizard, mssqlUserNameFromWizard, mssqlPasswordFromWizard } =
        state;
    const { authenticationType } = useAppSelector(state => state.inventoryV2);

    const { detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword } = useAppSelector(
        state => state.inventoryV2
    );

    const [textSearch, setTextSearch] = useSearchDebounce(1000);
    const [ontapPasswordSearch, setOntapPasswordSearch] = useSearchDebounce(1000);
    const [detectUserNameSearch, setDetectUserNameSearch] = useSearchDebounce(1000);
    const [detectPasswordSearch, setDetectPasswordSearch] = useSearchDebounce(1000);

    const [ontapUserName, setOntapUserName] = useState(ontapUserNameFromWizard ? ontapUserNameFromWizard : '');
    const [ontapPassword, setOntapPassword] = useState(ontapPasswordFromWizard ? ontapPasswordFromWizard : '');
    const [detectUserName, setDetectUserName] = useState(mssqlUserNameFromWizard ? mssqlUserNameFromWizard : '');
    const [detectPassword, setDetectPassword] = useState(mssqlPasswordFromWizard ? mssqlPasswordFromWizard : '');

    useEffect(() => {
        dispatch(setIsDetectHostError(''));
    }, [detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword]);

    //Use effect for ontap username
    useEffect(() => {
        setTextSearch(ontapUserName);
    }, [ontapUserName]);

    useEffect(() => {
        dispatch(setDetectONTAPUserName(textSearch));
    }, [textSearch]);

    //Use effect for detect username
    useEffect(() => {
        setDetectUserNameSearch(detectUserName);
    }, [detectUserName]);

    useEffect(() => {
        dispatch(setDetectManageUserName(detectUserNameSearch));
    }, [detectUserNameSearch]);

    //Use effect for ontap password
    useEffect(() => {
        setOntapPasswordSearch(ontapPassword);
    }, [ontapPassword]);

    useEffect(() => {
        dispatch(setDetectONTAPPassword(ontapPasswordSearch));
    }, [ontapPasswordSearch]);

    //useEffect for detect password
    useEffect(() => {
        setDetectPasswordSearch(detectPassword);
    }, [detectPassword]);

    useEffect(() => {
        dispatch(setDetectManagePassword(detectPasswordSearch));
    }, [detectPasswordSearch]);
    return (
        <div className={styles.detectContent}>
            <div className={styles['radio-container']}>
                <DsTypography variant="Semibold_14">Select authentication type</DsTypography>
                <RadioButton
                    id="select-sql-authentication"
                    isChecked={authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                    onChange={() => {
                        dispatch(setAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
                    }}
                    children={AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                    className=""
                />
                <RadioButton
                    id="select-windows-authentication"
                    isChecked={authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                    onChange={() => {
                        dispatch(setAuthenticationType(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION));
                    }}
                    children={AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                    className=""
                />
            </div>

            <div className={styles.firstSection}>
                <DsTypography variant="Semibold_14">{GENERAL.DETECT_MSSQL_HEADING}</DsTypography>
                <div className={styles.textFieldContainer}>
                    <TextField
                        label={GENERAL.DETECT_MSSQL_USERNAME}
                        value={detectUserName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDetectUserName(e.target.value);
                            setState({ mssqlUserNameFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectManageUserName ? GENERAL.ACTION_REQUIRED : ''}
                    />

                    <PasswordField
                        label={GENERAL.DETECT_MSSQL_PASSWORD}
                        value={detectPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDetectPassword(e.target.value);
                            setState({ mssqlPasswordFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectManagePassword ? GENERAL.ACTION_REQUIRED : ''}
                    />
                </div>
            </div>

            <div className={styles.secondSection}>
                <DsTypography variant="Semibold_14">{GENERAL.DETECT_FSX_HEADING}</DsTypography>
                <div className={styles.textFieldContainer}>
                    <TextField
                        label={GENERAL.DETECT_FSX_USERNAME}
                        value={ontapUserName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setOntapUserName(e.target.value);
                            setState({ ontapUserNameFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectOntapUsername ? GENERAL.ACTION_REQUIRED : ''}
                    />

                    <PasswordField
                        label={GENERAL.DETECT_FSX_PASSWORD}
                        value={ontapPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setOntapPassword(e.target.value);
                            setState({ ontapPasswordFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectOntapPassword ? GENERAL.ACTION_REQUIRED : ''}
                    />
                </div>
            </div>
        </div>
    );
};

export default DetectContent;
