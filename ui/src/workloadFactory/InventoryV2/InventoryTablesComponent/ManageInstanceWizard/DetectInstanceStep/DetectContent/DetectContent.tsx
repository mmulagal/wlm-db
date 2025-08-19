import { DsTypography, PasswordField, Popover, RadioButton, TextField, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './DetectContent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { ACTION_TYPE, AUTHENTICATION_TYPE, DBType } from '../../../../../../utils/consts';
import {
    setAuthenticationType,
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPPassword,
    setDetectONTAPUserName,
    setDetectWindowsAuthentication
} from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useSearchDebounce } from '../../../../../../common/hooks/useSearchDebounce';
import { getBulkDetectChecks } from '../../ManageInstanceUtils';
import { UseWizardReturn } from '../../../../../../utils/types/registerTypes';
import { authenticationFieldsTexts } from '../DetectInstanceHelper';
import { isAuthRequiredForInstance } from './DetectContentHelper';

const DetectContent = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: UseWizardReturn = useWizard();

    const {
        ontapUserNameFromWizard,
        ontapPasswordFromWizard,
        mssqlUserNameFromWizard,
        mssqlPasswordFromWizard,
        windowsAuthenticationUsernameFromWizard,
        windowsAuthenticationPasswordFromWizard,
        authenticationTypeSelected,
        hitNext
    } = state;

    const {
        authenticationType,
        manageSingleInstanceData,
        selectedMultiDetectInstances,
        detectManageUserName,
        detectManagePassword,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword
    } = useAppSelector(state => state.inventoryV2);

    const bulkInstanceData = useMemo(
        () => getBulkDetectChecks(selectedMultiDetectInstances),
        [selectedMultiDetectInstances]
    );

    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    const [textSearch, setTextSearch] = useSearchDebounce(100);
    const [ontapPasswordSearch, setOntapPasswordSearch] = useSearchDebounce(100);
    const [detectUserNameSearch, setDetectUserNameSearch] = useSearchDebounce(100);
    const [detectPasswordSearch, setDetectPasswordSearch] = useSearchDebounce(100);

    const [ontapUserName, setOntapUserName] = useState(ontapUserNameFromWizard || '');
    const [ontapPassword, setOntapPassword] = useState(ontapPasswordFromWizard || '');
    const [detectUserName, setDetectUserName] = useState(mssqlUserNameFromWizard || '');
    const [detectPassword, setDetectPassword] = useState(mssqlPasswordFromWizard || '');
    const [windowsAuthenticationUsername, setWindowsAuthenticationUsername] = useState(
        windowsAuthenticationUsernameFromWizard || ''
    );
    const [windowsAuthenticationPassword, setWindowsAuthenticationPassword] = useState(
        windowsAuthenticationPasswordFromWizard || ''
    );

    useEffect(() => {
        if (authenticationTypeSelected === undefined) {
            setState({ authenticationTypeSelected: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            dispatch(setAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
        }
    }, []);

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

    useEffect(() => {
        dispatch(setDetectWindowsAuthentication({ username: windowsAuthenticationUsername }));
    }, [windowsAuthenticationUsername]);

    useEffect(() => {
        dispatch(setDetectWindowsAuthentication({ password: windowsAuthenticationPassword }));
    }, [windowsAuthenticationPassword]);

    const authModeRadio = () => (
        <div className={styles['radio-container']}>
            <DsTypography variant="Semibold_14">{t('databases.register-flow.select-authentication-mode')}</DsTypography>
            <RadioButton
                id="select-sql-authentication"
                isChecked={authenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                onChange={() => {
                    dispatch(setAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
                    setState({ authenticationTypeSelected: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
                }}
                children={t('databases.register-flow.sql-server-authentication')}
                className=""
            />
            <RadioButton
                id="select-windows-authentication"
                isChecked={authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                onChange={() => {
                    dispatch(setAuthenticationType(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION));
                    setState({
                        authenticationTypeSelected: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                    });
                }}
                children={t('databases.register-flow.windows-authentication')}
                className=""
            />
        </div>
    );

    const mssqlInputFields = (hostType: string) => {
        const config = authenticationFieldsTexts[hostType] || authenticationFieldsTexts[DBType.MSSQL];
        return (
            <div className={hostType === DBType.ORACLE ? styles.secondSection : styles.firstSection}>
                <DsTypography variant="Semibold_14">{t(config.heading)}</DsTypography>
                <div className={styles.textFieldContainer}>
                    <TextField
                        label={t(config.usernameLabel)}
                        value={detectUserName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDetectUserName(e.target.value);
                            setState({ mssqlUserNameFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectManageUserName && hitNext ? t('databases.general.action-required') : ''}
                        placeholder={`${t('databases.general.enter')} ${t(config.usernameLabel)}`}
                    />

                    <PasswordField
                        label={t(config.passwordLabel)}
                        value={detectPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDetectPassword(e.target.value);
                            setState({ mssqlPasswordFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={!detectManagePassword && hitNext ? t('databases.general.action-required') : ''}
                        placeholder={t('databases.general.enter-password')}
                    />
                </div>
            </div>
        );
    };

    const windowsAuthInputFields = () => (
        <div className={styles.firstSection}>
            <DsTypography variant="Semibold_14"> {t('databases.register-flow.detect-windows-heading')}</DsTypography>
            <div className={styles.textFieldContainer}>
                <TextField
                    label={t('databases.register-flow.detect-windows-username')}
                    value={windowsAuthenticationUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setWindowsAuthenticationUsername(e.target.value);
                        setState({ windowsAuthenticationUsernameFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={
                        authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        !detectWindowsAuthentication?.username &&
                        hitNext
                            ? t('databases.general.action-required')
                            : ''
                    }
                    placeholder={`Enter ${t('databases.register-flow.detect-windows-username')}`}
                />

                <PasswordField
                    label={t('databases.register-flow.detect-windows-password')}
                    value={windowsAuthenticationPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setWindowsAuthenticationPassword(e.target.value);
                        setState({ windowsAuthenticationPasswordFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={
                        authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        !detectWindowsAuthentication?.password &&
                        hitNext
                            ? t('databases.general.action-required')
                            : ''
                    }
                    placeholder={t('databases.general.enter-password')}
                />
            </div>
        </div>
    );

    const fsxInputFields = () => (
        <div className={styles.secondSection}>
            <DsTypography variant="Semibold_14">{t('databases.register-flow.detect-fsx-heading')}</DsTypography>
            <div className={styles.textFieldContainer}>
                <TextField
                    label={t('databases.register-flow.detect-fsx-username')}
                    value={ontapUserName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setOntapUserName(e.target.value);
                        setState({ ontapUserNameFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={!detectOntapUsername && hitNext ? t('databases.general.action-required') : ''}
                    placeholder={`${t('databases.general.enter')} ${t('databases.register-flow.detect-fsx-username')}`}
                />

                <PasswordField
                    label={t('databases.register-flow.detect-fsx-password')}
                    value={ontapPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setOntapPassword(e.target.value);
                        setState({ ontapPasswordFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={!detectOntapPassword && hitNext ? t('databases.general.action-required') : ''}
                    placeholder={t('databases.general.enter-password')}
                />
            </div>
        </div>
    );

    return (
        <div className={styles.detectContent}>
            {wizardOperationType === ACTION_TYPE.SINGLE && (
                <>
                    {/* When Action Type is Single and all the 3 types of authentication are false, we show the authentication mode radio buttons and based on authentication type selected, we show the respective input fields */}
                    {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                        manageSingleInstanceData?.hostType === DBType.MSSQL &&
                        authModeRadio()}

                    {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                        authenticationTypeSelected === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION &&
                        mssqlInputFields(manageSingleInstanceData?.hostType)}

                    {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                        authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        windowsAuthInputFields()}

                    {manageSingleInstanceData?.fsxId && !manageSingleInstanceData?.isFsxRegistered && fsxInputFields()}
                </>
            )}

            {wizardOperationType === ACTION_TYPE.BULK && (
                <>
                    {/* When Action Type is Bulk and all the 3 types of authentication are false, we show the authentication mode radio buttons and based on authentication type selected, we show the respective input fields */}
                    {isAuthRequiredForInstance(bulkInstanceData, bulkInstanceData?.hostType) &&
                        bulkInstanceData.hostType === DBType.MSSQL &&
                        authModeRadio()}

                    {isAuthRequiredForInstance(bulkInstanceData, bulkInstanceData?.hostType) &&
                        authenticationTypeSelected === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION &&
                        mssqlInputFields(bulkInstanceData?.hostType)}

                    {isAuthRequiredForInstance(bulkInstanceData, bulkInstanceData?.hostType) &&
                        authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        windowsAuthInputFields()}

                    {bulkInstanceData?.fsxId && !bulkInstanceData?.isFsxRegistered && fsxInputFields()}
                </>
            )}
        </div>
    );
};

export default DetectContent;
