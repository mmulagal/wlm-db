import { DsTypography, PasswordField, Popover, RadioButton, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import styles from './FSXPasswordContent.module.scss';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import {
    setFsxAdminConfirmPassword,
    setFsxAdminPassword,
    setSqlServerConfirmPassword,
    setSqlServerPassword,
    setSqlServerUserName,
    setSelectedAuthenticationType,
    setWindowsServerUserName,
    setWindowsServerPassword,
    setWindowsServerConfirmPassword
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { isValidPassword, isValidSqlUsername } from '../../../../utils/utilityFunctions';
import { AUTHENTICATION_TYPE } from '../../../../utils/consts';
import { AppDispatch } from '../../../../store/store';

interface PasswordContentProps {
    type: 'fsx' | 'sql';
    password: string;
    confirmPassword: string;
    setPassword: (value: string) => void;
    setConfirmPassword: (value: string) => void;
    description: string;
    username: string;
}

const PasswordContent = ({
    type,
    password,
    confirmPassword,
    setPassword,
    setConfirmPassword,
    description,
    username
}: PasswordContentProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedAuthenticationType } = useAppSelector(state => state.workloadFactoryResource);

    const tooltipText = () => (
        <DsTypography variant="Regular_13" className={styles.infoMsg}>
            <DsTypography variant="Regular_13">{t('databases.update-credentials.password-info-heading')}</DsTypography>
            <div className={styles.list}>
                {(Array.isArray(t('databases.update-credentials.password-info-list', { returnObjects: true }))
                    ? (t('databases.update-credentials.password-info-list', { returnObjects: true }) as string[])
                    : []
                ).map((item: string, index: number) => (
                    <div className={styles.listItem} key={index}>
                        <Bullet />
                        <div className={styles.textWidth}>{item}</div>
                    </div>
                ))}
            </div>
        </DsTypography>
    );

    const isValidConfirmPassword = (confirmPassword: string) => {
        if (confirmPassword.length > 0 && password !== confirmPassword) {
            return t('update-credentials.passwords-not-match');
        }
    };

    return (
        <div className={styles[`${type}-password`]}>
            <DsTypography variant="Regular_14" style={{ width: '800px' }}>
                {description}
            </DsTypography>

            {type === 'sql' && authModeRadio()}

            <div className={styles.textArea}>
                {type === 'fsx' && (
                    <TextField label={GENERAL.USER_NAME} value={username} className={styles.textField} isDisabled />
                )}
                {type === 'sql' && (
                    <TextField
                        label={GENERAL.USER_NAME}
                        value={username}
                        className={styles.textField}
                        isDisabled={false}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                                ? dispatch(setSqlServerUserName(e.target.value))
                                : dispatch(setWindowsServerUserName(e.target.value));
                        }}
                        error={useDelayedError(isValidSqlUsername(username))}
                    />
                )}
                <div className={styles.tooltipContainer}>
                    <PasswordField
                        label={GENERAL.PASSWORD}
                        error={useDelayedError(isValidPassword(password))}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setPassword(e.target.value);
                        }}
                        value={password}
                        className={styles.textField}
                    />
                    <div className={styles.dialogFooterDialog}>
                        <Popover
                            popoverClass=""
                            children={tooltipText()}
                            trigger="hover"
                            isAppendedToBody
                            container={<TooltipIcon />}
                        />
                    </div>
                </div>
                <PasswordField
                    label="Confirm password"
                    error={useDelayedError(isValidConfirmPassword(confirmPassword))}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setConfirmPassword(e.target.value);
                    }}
                    value={confirmPassword}
                    className={styles.textField}
                />
            </div>
        </div>
    );
};

const FSXPasswordContent = () => {
    const dispatch = useDispatch();
    const { password, confirmPassword } = useAppSelector(state => state.workloadFactoryResource.fsxAdminPasswords);

    return (
        <PasswordContent
            type="fsx"
            password={password}
            confirmPassword={confirmPassword}
            setPassword={(value: string) => dispatch(setFsxAdminPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setFsxAdminConfirmPassword(value))}
            description={GENERAL.FSX_PASSWORD_CONTENT}
            username="fsxadmin"
        />
    );
};

const SQLServerPasswordContent = () => {
    const dispatch = useDispatch();
    const { selectedAuthenticationType } = useAppSelector(state => state.workloadFactoryResource);
    const { password: sqlPassword, confirmPassword: sqlConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.sqlServerPasswords
    );
    const { password: windowsPassword, confirmPassword: windowsConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.windowsServerPasswords
    );
    const { sqlServerUserName, windowsServerUserName } = useAppSelector(state => state.workloadFactoryResource);

    // Mapping authentication types to their respective password and username handlers to be sent to the PasswordContent component
    const authMap = {
        [AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION]: {
            password: sqlPassword,
            confirmPassword: sqlConfirmPassword,
            username: sqlServerUserName,
            setPassword: (value: string) => dispatch(setSqlServerPassword(value)),
            setConfirmPassword: (value: string) => dispatch(setSqlServerConfirmPassword(value))
        },
        [AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION]: {
            password: windowsPassword,
            confirmPassword: windowsConfirmPassword,
            username: windowsServerUserName,
            setPassword: (value: string) => dispatch(setWindowsServerPassword(value)),
            setConfirmPassword: (value: string) => dispatch(setWindowsServerConfirmPassword(value))
        }
    };

    const { password, confirmPassword, username, setPassword, setConfirmPassword } =
        authMap[selectedAuthenticationType] || authMap[AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION];

    return (
        <PasswordContent
            type="sql"
            password={password}
            confirmPassword={confirmPassword}
            setPassword={setPassword}
            setConfirmPassword={setConfirmPassword}
            description={GENERAL.SQL_PASSWORD_CONTENT}
            username={username}
        />
    );
};

const resetSqlAndWindowsPasswords = (dispatch: AppDispatch) => {
    dispatch(setSqlServerUserName(''));
    dispatch(setSqlServerPassword(''));
    dispatch(setSqlServerConfirmPassword(''));
    dispatch(setWindowsServerUserName(''));
    dispatch(setWindowsServerPassword(''));
    dispatch(setWindowsServerConfirmPassword(''));
};

// Function to render the authentication mode radio buttons for SQL Server
const authModeRadio = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedAuthenticationType } = useAppSelector(state => state.workloadFactoryResource);

    useEffect(() => {
        if (!selectedAuthenticationType) {
            dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
        }
    }, []);

    return (
        <div className={styles['radio-container']}>
            <DsTypography variant="Semibold_14">{t('databases.register-flow.select-authentication-mode')}</DsTypography>
            <RadioButton
                id="select-sql-authentication"
                isChecked={selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                onChange={() => {
                    dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
                    resetSqlAndWindowsPasswords(dispatch);
                }}
                children={t('databases.register-flow.sql-server-authentication')}
                className=""
            />
            <RadioButton
                id="select-windows-authentication"
                isChecked={selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                onChange={() => {
                    dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION));
                    resetSqlAndWindowsPasswords(dispatch);
                }}
                children={t('databases.register-flow.windows-authentication')}
                className=""
            />
        </div>
    );
};

export { FSXPasswordContent, SQLServerPasswordContent };
export default PasswordContent;
