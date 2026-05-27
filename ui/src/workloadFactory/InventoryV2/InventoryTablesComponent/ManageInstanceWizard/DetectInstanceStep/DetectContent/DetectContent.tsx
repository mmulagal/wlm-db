import { DsTypography, PasswordField, RadioButton, TextField, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import classNames from 'classnames';
import styles from './DetectContent.module.scss';
import SsmArnTooltipContent from '../../../../../../common/SsmArnTooltipContent/SsmArnTooltipContent';
import { useAppSelector } from '../../../../../../store/storeHooks';
import {
    ACTION_TYPE,
    AUTHENTICATION_TYPE,
    DBType,
    DETECT_HOST_VAR,
    isValidSsmArn
} from '../../../../../../utils/consts';
import {
    setAuthenticationType,
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectSsmParameterArn,
    setDetectONTAPPassword,
    setDetectONTAPUserName,
    setDetectONTAPSsmParameterArn,
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
        detectSsmParameterArn,
        detectWindowsAuthentication,
        detectOntapUsername,
        detectOntapPassword,
        detectOntapSsmParameterArn,
        detectCredentialErrors
    } = useAppSelector(state => state.inventoryV2);

    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);

    // Get loading state from msSqlAction slice to disable inputs during API calls
    const isDetectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

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
    const [ssmArn, setSsmArn] = useState(state.ssmArnFromWizard || '');
    const [ontapSsmArn, setOntapSsmArn] = useState(state.ontapSsmArnFromWizard || '');

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

    useEffect(() => {
        dispatch(setDetectSsmParameterArn(ssmArn));
    }, [ssmArn]);

    useEffect(() => {
        dispatch(setDetectONTAPSsmParameterArn(ontapSsmArn));
    }, [ontapSsmArn]);

    const SSM_WIZARD_KEY = 'ssmArnFromWizard';
    const ONTAP_SSM_WIZARD_KEY = 'ontapSsmArnFromWizard';

    const ssmArnInputFields = (section: 'db' | 'fsx') => {
        const isFsx = section === 'fsx';
        const value = isFsx ? ontapSsmArn : ssmArn;
        const setter = isFsx ? setOntapSsmArn : setSsmArn;
        const wizardKey = isFsx ? ONTAP_SSM_WIZARD_KEY : SSM_WIZARD_KEY;
        const storeValue = isFsx ? detectOntapSsmParameterArn : detectSsmParameterArn;
        const errorField = isFsx ? detectCredentialErrors?.fsxnError : detectCredentialErrors?.databaseServerError;
        const heading = isFsx
            ? t('databases.register-flow.detect-fsx-heading')
            : t('databases.register-flow.detect-sql-heading');

        const tooltipKey = isFsx
            ? 'databases.register-flow.ssm-parameter-tooltip-fsx'
            : 'databases.register-flow.ssm-parameter-tooltip-db';
        const jsonKey = isFsx
            ? 'databases.register-flow.ssm-tooltip-json-fsx'
            : 'databases.register-flow.ssm-tooltip-json-db';

        return (
            <div className={isFsx ? styles.secondSection : styles.firstSection}>
                <DsTypography variant="Semibold_14">{heading}</DsTypography>
                <div className={styles.textFieldContainer}>
                    <TextField
                        label={t('databases.register-flow.ssm-parameter-arn-label')}
                        info={<SsmArnTooltipContent tooltipKey={tooltipKey} tooltipJsonKey={jsonKey} />}
                        value={value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setter(e.target.value);
                            setState({ [wizardKey]: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={
                            errorField ||
                            (!storeValue && hitNext ? t('databases.general.action-required') : '') ||
                            (storeValue && !isValidSsmArn(storeValue)
                                ? t('databases.register-flow.ssm-parameter-arn-invalid')
                                : '')
                        }
                        isDisabled={isDetectHostLoading}
                        placeholder={t('databases.register-flow.ssm-parameter-arn-placeholder')}
                    />
                </div>
            </div>
        );
    };

    const authModeRadio = () => (
        <div className={classNames(styles['radio-container'], { [styles.disabled]: isDetectHostLoading })}>
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
                isDisabled={isDetectHostLoading}
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
                isDisabled={isDetectHostLoading}
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
                        error={
                            detectCredentialErrors?.databaseServerError ||
                            (!detectManageUserName && hitNext ? t('databases.general.action-required') : '')
                        }
                        placeholder={`${t('databases.general.enter')} ${t(config.usernameLabel)}`}
                        isDisabled={isDetectHostLoading}
                    />

                    <PasswordField
                        label={t(config.passwordLabel)}
                        value={detectPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDetectPassword(e.target.value);
                            setState({ mssqlPasswordFromWizard: e.target.value });
                        }}
                        className={styles.textFieldStyle}
                        error={
                            detectCredentialErrors?.databaseServerError ||
                            (!detectManagePassword && hitNext ? t('databases.general.action-required') : '')
                        }
                        placeholder={t('databases.general.enter-password')}
                        isDisabled={isDetectHostLoading}
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
                        detectCredentialErrors?.databaseServerError ||
                        (authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        !detectWindowsAuthentication?.username &&
                        hitNext
                            ? t('databases.general.action-required')
                            : '')
                    }
                    placeholder={`Enter ${t('databases.register-flow.detect-windows-username')}`}
                    isDisabled={isDetectHostLoading}
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
                        detectCredentialErrors?.databaseServerError ||
                        (authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                        !detectWindowsAuthentication?.password &&
                        hitNext
                            ? t('databases.general.action-required')
                            : '')
                    }
                    placeholder={t('databases.general.enter-password')}
                    isDisabled={isDetectHostLoading}
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
                    error={
                        detectCredentialErrors?.fsxnError ||
                        (!detectOntapUsername && hitNext ? t('databases.general.action-required') : '')
                    }
                    placeholder={`${t('databases.general.enter')} ${t('databases.register-flow.detect-fsx-username')}`}
                    isDisabled={isDetectHostLoading}
                />

                <PasswordField
                    label={t('databases.register-flow.detect-fsx-password')}
                    value={ontapPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setOntapPassword(e.target.value);
                        setState({ ontapPasswordFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={
                        detectCredentialErrors?.fsxnError ||
                        (!detectOntapPassword && hitNext ? t('databases.general.action-required') : '')
                    }
                    placeholder={t('databases.general.enter-password')}
                    isDisabled={isDetectHostLoading}
                />
            </div>
        </div>
    );

    return (
        <div className={styles.detectContent}>
            {wizardOperationType === ACTION_TYPE.SINGLE && (
                <>
                    {isGovAccount ? (
                        <>
                            {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                                ssmArnInputFields('db')}
                        </>
                    ) : (
                        <>
                            {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                                manageSingleInstanceData?.hostType === DBType.MSSQL &&
                                authModeRadio()}

                            {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                                (manageSingleInstanceData?.hostType === DBType.ORACLE ||
                                    authenticationTypeSelected === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION) &&
                                mssqlInputFields(manageSingleInstanceData?.hostType)}

                            {isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType) &&
                                manageSingleInstanceData?.hostType === DBType.MSSQL &&
                                authenticationTypeSelected === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION &&
                                windowsAuthInputFields()}
                        </>
                    )}
                </>
            )}

            {wizardOperationType === ACTION_TYPE.BULK && (
                <>
                    {isGovAccount ? (
                        <>
                            {isAuthRequiredForInstance(bulkInstanceData, bulkInstanceData?.hostType) &&
                                ssmArnInputFields('db')}
                            {bulkInstanceData?.fsxId && !bulkInstanceData?.isFsxRegistered && ssmArnInputFields('fsx')}
                        </>
                    ) : (
                        <>
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
                </>
            )}
        </div>
    );
};

export default DetectContent;
