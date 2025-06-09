import { DsTypography, PasswordField, Popover, RadioButton, TextField, useWizard } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import styles from './DetectContent.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { ACTION_TYPE, AUTHENTICATION_TYPE } from '../../../../../../utils/consts';
import {
    setAuthenticationType,
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPPassword,
    setDetectONTAPUserName
} from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useSearchDebounce } from '../../../../../../common/hooks/useSearchDebounce';
import { setIsDetectHostError } from '../../../../../../store/mssql/msSqlActionSlice';
import { getBulkDetectChecks } from '../../ManageInstanceUtils';
import { UseWizardReturn } from '../../../../../../utils/types/registerTypes';

const DetectContent = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { state, setState }: UseWizardReturn = useWizard();

    const {
        ontapUserNameFromWizard,
        ontapPasswordFromWizard,
        mssqlUserNameFromWizard,
        mssqlPasswordFromWizard,
        authenticationTypeSelected,
        hitNext
    } = state;

    const {
        authenticationType,
        manageSingleInstanceData,
        selectedMultiDetectInstances,
        detectManageUserName,
        detectManagePassword,
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

    useEffect(() => {
        dispatch(setIsDetectHostError(''));
    }, [detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword]);

    useEffect(() => {
        if (authenticationTypeSelected === undefined) {
            setState({ authenticationTypeSelected: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
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
                children={AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                className=""
            />
            <Popover
                children={t('databases.general.coming-soon')}
                trigger="hover"
                container={
                    <RadioButton
                        id="select-windows-authentication"
                        isDisabled // Currently windows auth is not supported
                        title="Windows authentication is not supported yet"
                        isChecked={authenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                        onChange={() => {
                            dispatch(setAuthenticationType(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION));
                            setState({
                                authenticationTypeSelected: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                            });
                        }}
                        children={AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                        className=""
                    />
                }
            />
        </div>
    );

    const mssqlInputFields = () => (
        <div className={styles.firstSection}>
            <DsTypography variant="Semibold_14">{t('databases.register-flow.detect-mssql-heading')}</DsTypography>
            <div className={styles.textFieldContainer}>
                <TextField
                    label={t('databases.register-flow.detect-mssql-username')}
                    value={detectUserName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setDetectUserName(e.target.value);
                        setState({ mssqlUserNameFromWizard: e.target.value });
                    }}
                    className={styles.textFieldStyle}
                    error={!detectManageUserName && hitNext ? t('databases.general.action-required') : ''}
                    placeholder={`${t('databases.general.enter')} ${t(
                        'databases.register-flow.detect-mssql-username'
                    )}`}
                />

                <PasswordField
                    label={t('databases.register-flow.detect-mssql-password')}
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
                    {!manageSingleInstanceData?.sqlServerAuthentication &&
                        !manageSingleInstanceData?.windowsAuthentication &&
                        authModeRadio()}

                    {!manageSingleInstanceData?.sqlServerAuthentication &&
                        !manageSingleInstanceData?.windowsAuthentication &&
                        mssqlInputFields()}

                    {manageSingleInstanceData?.fsxId && !manageSingleInstanceData?.isFsxRegistered && fsxInputFields()}
                </>
            )}

            {wizardOperationType === ACTION_TYPE.BULK && (
                <>
                    {!bulkInstanceData?.sqlServerAuthentication &&
                        !bulkInstanceData?.windowsAuthentication &&
                        authModeRadio()}

                    {!bulkInstanceData?.sqlServerAuthentication &&
                        !bulkInstanceData?.windowsAuthentication &&
                        mssqlInputFields()}

                    {bulkInstanceData?.fsxId && !bulkInstanceData?.isFsxRegistered && fsxInputFields()}
                </>
            )}
        </div>
    );
};

export default DetectContent;
