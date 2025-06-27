import { DsTypography, PasswordField, Popover, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { DsRadioButton } from '@tlveng/wlm-ds';
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
    resetAllPasswords
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { isValidSqlUsername } from '../../../../utils/utilityFunctions';
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
    const [passwordTouched, setPasswordTouched] = useState(false);

    const isValidConfirmPassword = (confirmPassword: string) => {
        if (confirmPassword.length > 0 && password !== confirmPassword) {
            return t('databases.update-credentials.passwords-not-match');
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            dispatch(setSqlServerUserName(e.target.value))
                        }
                        error={useDelayedError(isValidSqlUsername(username, t))}
                    />
                )}
                <div className={styles.tooltipContainer}>
                    <PasswordField
                        label={GENERAL.PASSWORD}
                        error={useDelayedError(
                            passwordTouched && password.length === 0 ? t('databases.general.action-required') : false
                        )}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setPassword(e.target.value);
                        }}
                        onBlur={() => setPasswordTouched(true)}
                        value={password}
                        className={styles.textField}
                    />
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
    const { password: sqlPassword, confirmPassword: sqlConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.sqlServerPasswords
    );
    const { sqlServerUserName } = useAppSelector(state => state.workloadFactoryResource);

    return (
        <PasswordContent
            type="sql"
            password={sqlPassword}
            confirmPassword={sqlConfirmPassword}
            setPassword={(value: string) => dispatch(setSqlServerPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setSqlServerConfirmPassword(value))}
            description={GENERAL.SQL_PASSWORD_CONTENT}
            username={sqlServerUserName}
        />
    );
};

const resetSqlAndWindowsPasswords = (dispatch: AppDispatch) => {
    dispatch(resetAllPasswords());
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
            <DsRadioButton
                id="select-sql-authentication"
                variant="Default"
                title={t('databases.register-flow.sql-server-authentication')}
                isSelected={selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION}
                onClick={() => {
                    dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION));
                    resetSqlAndWindowsPasswords(dispatch);
                }}
            />
            <DsRadioButton
                id="select-windows-authentication"
                variant="Default"
                title={t('databases.register-flow.windows-authentication')}
                isSelected={selectedAuthenticationType === AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION}
                onClick={() => {
                    dispatch(setSelectedAuthenticationType(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION));
                    resetSqlAndWindowsPasswords(dispatch);
                }}
            />
        </div>
    );
};

export { FSXPasswordContent, SQLServerPasswordContent };
export default PasswordContent;
