import { DsTypography, PasswordField, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { DsRadioButton } from '@tlveng/wlm-ds';
import styles from './ServerPasswordContent.module.scss';
import SsmArnTooltipContent from '../../../../common/SsmArnTooltipContent/SsmArnTooltipContent';
import {
    setSqlServerConfirmPassword,
    setSqlServerPassword,
    setSqlServerUserName,
    setSelectedAuthenticationType,
    setCredentialUpdateSsmArn,
    resetAllPasswords
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { isValidSqlUsername } from '../../../../utils/utilityFunctions';
import { AUTHENTICATION_TYPE, RESET_PASSWORD_TYPE, isValidSsmArn } from '../../../../utils/consts';
import { AppDispatch } from '../../../../store/store';

interface PasswordContentProps {
    type: string;
    password: string;
    confirmPassword: string;
    setPassword: (value: string) => void;
    setConfirmPassword: (value: string) => void;
    description: string;
    username: string;
}

interface ORACLEPasswordContentProps {
    type: string;
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

            {type === RESET_PASSWORD_TYPE.SQLSERVER && authModeRadio()}

            <div className={styles.textArea}>
                {(type === RESET_PASSWORD_TYPE.SQLSERVER || type === RESET_PASSWORD_TYPE.ORACLESERVER) && (
                    <TextField
                        label={t('databases.update-credentials.user-name-label')}
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
                        label={t('databases.update-credentials.password-label')}
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
                    label={t('databases.update-credentials.confirm-password-label')}
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

const GovCloudArnContent = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const credentialUpdateSsmArn = useAppSelector(state => state.workloadFactoryResource.credentialUpdateSsmArn);
    const [arnTouched, setArnTouched] = useState(false);

    const arnError = (() => {
        if (!arnTouched) return '';
        if (!credentialUpdateSsmArn) return t('databases.general.action-required');
        if (!isValidSsmArn(credentialUpdateSsmArn)) return t('databases.register-flow.ssm-parameter-arn-invalid');
        return '';
    })();

    return (
        <div className={styles['gov-cloud-arn-content']}>
            <div className={styles.textArea}>
                <TextField
                    label={t('databases.register-flow.ssm-parameter-arn-label')}
                    info={
                        <SsmArnTooltipContent
                            tooltipKey="databases.register-flow.ssm-parameter-tooltip-fsx"
                            tooltipJsonKey="databases.register-flow.ssm-tooltip-json-fsx"
                        />
                    }
                    value={credentialUpdateSsmArn}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        dispatch(setCredentialUpdateSsmArn(e.target.value))
                    }
                    onBlur={() => setArnTouched(true)}
                    error={arnError}
                    placeholder={t('databases.register-flow.ssm-parameter-arn-placeholder')}
                    className={styles.textField}
                />
            </div>
        </div>
    );
};

const OracleServerPasswordContent = ({ type }: ORACLEPasswordContentProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const { password: sqlPassword, confirmPassword: sqlConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.sqlServerPasswords
    );
    const { sqlServerUserName } = useAppSelector(state => state.workloadFactoryResource);

    if (isGovAccount) return <GovCloudArnContent />;

    return (
        <PasswordContent
            type={RESET_PASSWORD_TYPE.ORACLESERVER}
            password={sqlPassword}
            confirmPassword={sqlConfirmPassword}
            setPassword={(value: string) => dispatch(setSqlServerPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setSqlServerConfirmPassword(value))}
            description={t('databases.update-credentials.oracle-password-content')}
            username={sqlServerUserName}
        />
    );
};

const SQLServerPasswordContent = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const { password: sqlPassword, confirmPassword: sqlConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.sqlServerPasswords
    );
    const { sqlServerUserName } = useAppSelector(state => state.workloadFactoryResource);

    if (isGovAccount) return <GovCloudArnContent />;

    return (
        <PasswordContent
            type={RESET_PASSWORD_TYPE.SQLSERVER}
            password={sqlPassword}
            confirmPassword={sqlConfirmPassword}
            setPassword={(value: string) => dispatch(setSqlServerPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setSqlServerConfirmPassword(value))}
            description={t('databases.update-credentials.sql-password-content')}
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

export { SQLServerPasswordContent, OracleServerPasswordContent };
export default PasswordContent;
