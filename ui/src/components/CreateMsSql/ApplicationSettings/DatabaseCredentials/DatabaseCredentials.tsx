import { useEffect, useRef, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    PasswordField,
    TextField,
    DsTypography,
    Checkbox,
    DsTooltipInfo
} from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import {
    setDBCredentialsName,
    setDBCredentialsPassword,
    setDBCredentialsSsmArn,
    setActiveDirectoryFields
} from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';

import styles from './DatabaseCredentials.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import SsmArnTooltipContent from '../../../../common/SsmArnTooltipContent/SsmArnTooltipContent';

import AccordionError from '../../../../common/AccordionError/AccordionError';
import { dbPassVal, isValidUserName } from '../../../../utils/utilityFunctions';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { DBType, isValidSsmArn, POSTGRE_USERNAME, SQL_USERNAME, WIZARD_TYPE } from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

type DatabaseCredentialsProps = {
    wizardType?: string;
};

const DatabaseCredentials = ({ wizardType }: DatabaseCredentialsProps) => {
    const { t } = useTranslation();
    const userName = useAppSelector(state => state.mssqlForm.dbCredentials.name);
    const password = useAppSelector(state => state.mssqlForm.dbCredentials.password);
    const ssmParameterArn = useAppSelector(state => state.mssqlForm.dbCredentials.ssmParameterArn);
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const useManagedServiceAccount = useAppSelector(state => state.mssqlForm.activeDirectory.useManagedServiceAccount);
    const selectConfig = useAppSelector(state => state.mssqlForm.selectConfig);

    const passwordRef = useRef(null);

    const dispatch = useDispatch();
    const isDBPasswordFilled = useAppSelector(state => state.msSqlAction.dbCredentialPasswordSelected);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);

    const [credName, setCredName] = useState(wizardType === WIZARD_TYPE.MSSQL ? SQL_USERNAME : POSTGRE_USERNAME);

    useEffect(() => {
        if (wizardType === WIZARD_TYPE.MSSQL) {
            dispatch(setDBCredentialsName(SQL_USERNAME));
        } else {
            dispatch(setDBCredentialsName(POSTGRE_USERNAME));
        }
    }, []);

    useEffect(() => {
        setCredName(userName);
    }, [userName]);

    useEffect(() => {
        if (!isDBPasswordFilled && isCreateHit) {
            setTimeout(() => {
                // @ts-ignore
                passwordRef?.current?.focus();
            }, 60);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!isDBPasswordFilled, isCreateHit]);

    // Set the Header text here
    const setHeader = () => {
        if (isGovAccount) {
            if (!ssmParameterArn) {
                return <ActionRequired error={!isDBPasswordFilled} />;
            }
            if (!isValidSsmArn(ssmParameterArn)) {
                return <AccordionError />;
            }
            return (
                <DsTypography variant="Regular_14">{t('databases.register-flow.ssm-parameter-arn-label')}</DsTypography>
            );
        }

        // Password is only NOT required in MSSQL Advanced Create mode when managed service account is checked
        const isPasswordRequired =
            wizardType === WIZARD_TYPE.MSSQL
                ? !(selectConfig === SELECT_CONFIG.STANDARD_CREATE && useManagedServiceAccount)
                : true;

        // Check validation errors first (before checking if fields are empty)
        const passwordError = password && dbPassVal(password);
        const usernameError = isValidUserName(credName);

        if (passwordError || usernameError) {
            return <AccordionError />;
        }

        // Then check for required fields
        // Only check password if it's required (i.e., managed service account is NOT checked)
        if (!credName) {
            return <ActionRequired error={false} />;
        }

        if (isPasswordRequired && !password) {
            return <ActionRequired error={!isDBPasswordFilled} />;
        }

        return <DsTypography variant="Regular_14">{credName}</DsTypography>;
    };

    // Get password field error message
    const getPasswordError = () => {
        // Don't show error if in MSSQL Advanced Create mode with managed service account checked
        if (
            wizardType === WIZARD_TYPE.MSSQL &&
            selectConfig === SELECT_CONFIG.STANDARD_CREATE &&
            useManagedServiceAccount
        ) {
            return '';
        }
        if (!isDBPasswordFilled) {
            return GENERAL.ACTION_REQUIRED;
        }
        return dbPassVal(password);
    };

    const tooltipText = () => (
        <DsTypography variant="Regular_13" className={styles.infoMsg}>
            <DsTypography variant="Regular_13">{GENERAL.PASSWORD_CRED_1}</DsTypography>
            <div className={styles.list}>
                <div className={styles.listItem}>
                    <Bullet />
                    <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_1}</div>
                </div>
                <div className={styles.listItem}>
                    <Bullet />
                    <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_2}</div>
                </div>
                <div className={styles.listItem}>
                    <Bullet />
                    <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_3}</div>
                </div>
                <div className={styles.listItem}>
                    <Bullet />
                    <div className={styles.textWidth}>{GENERAL.PASSWORD_CRED_LI_4}</div>
                </div>
            </div>
            <DsTypography variant="Regular_13" className={styles.lastItem}>
                {GENERAL.PASSWORD_CRED_4}
            </DsTypography>
        </DsTypography>
    );

    return (
        <div className={styles.credentials}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="11"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_CREDENTIALS}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        {isGovAccount ? (
                            <div className={styles.secondContainer}>
                                <TextField
                                    label={t('databases.register-flow.ssm-parameter-arn-label')}
                                    info={
                                        <SsmArnTooltipContent
                                            tooltipKey="databases.register-flow.ssm-parameter-tooltip-db"
                                            tooltipJsonKey="databases.register-flow.ssm-tooltip-json-db"
                                        />
                                    }
                                    placeholder={t('databases.register-flow.ssm-parameter-arn-placeholder')}
                                    error={
                                        !isDBPasswordFilled && !ssmParameterArn
                                            ? GENERAL.ACTION_REQUIRED
                                            : ssmParameterArn && !isValidSsmArn(ssmParameterArn)
                                            ? t('databases.register-flow.ssm-parameter-arn-invalid')
                                            : ''
                                    }
                                    // @ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--error)'
                                            }}
                                        />
                                    }
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setDBCredentialsSsmArn(e.target.value));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    value={ssmParameterArn}
                                    className={styles.textField}
                                />
                            </div>
                        ) : (
                            <>
                                <DsTypography variant="Regular_14" className={styles.subtext}>
                                    {wizardType === WIZARD_TYPE.MSSQL
                                        ? t('databases.general.database-credential-text')
                                        : GENERAL.DATABASE_CREDENTIAL_TEXT_PGSQL}
                                </DsTypography>
                                {wizardType === WIZARD_TYPE.MSSQL && selectConfig === SELECT_CONFIG.STANDARD_CREATE && (
                                    <div className={styles.checkboxContainer}>
                                        <div className={styles.checkboxWrapper}>
                                            <Checkbox
                                                isChecked={useManagedServiceAccount}
                                                onChange={(checked: boolean) => {
                                                    dispatch(
                                                        setActiveDirectoryFields({
                                                            useManagedServiceAccount: checked
                                                        })
                                                    );
                                                    if (checked) {
                                                        dispatch(setDBCredentialsPassword(''));
                                                    }
                                                }}
                                            />
                                            <DsTypography variant="Regular_14" className={styles.checkboxLabel}>
                                                {t('databases.general.use-managed-service-account')}
                                            </DsTypography>
                                            <DsTooltipInfo className={styles.tooltipIcon} trigger="hover">
                                                {t('databases.general.managed-service-account-tooltip')}
                                            </DsTooltipInfo>
                                        </div>
                                    </div>
                                )}
                                <div className={styles.secondContainer}>
                                    <TextField
                                        label={GENERAL.USER_NAME}
                                        info={
                                            wizardType === WIZARD_TYPE.PGSQL ? (
                                                ''
                                            ) : (
                                                <div className={styles.userNameTooltip}>
                                                    <div className={styles.list}>
                                                        <div className={styles.listItem}>
                                                            <Bullet />
                                                            <div className={styles.textWidth}>
                                                                {t('databases.general.username-rules')}
                                                            </div>
                                                        </div>
                                                        <div className={styles.listItem}>
                                                            <Bullet />
                                                            <div className={styles.textWidth}>
                                                                {t('databases.general.username-not-admin')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        error={useDelayedError(isValidUserName(credName))}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            setCredName(e.target.value);
                                            dispatch(setDBCredentialsName(e.target.value));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={credName}
                                        className={styles.textField}
                                        isDisabled={wizardType === WIZARD_TYPE.PGSQL}
                                    />
                                    <PasswordField
                                        label={GENERAL.PASSWORD}
                                        ref={passwordRef}
                                        error={getPasswordError()}
                                        info={tooltipText()}
                                        // @ts-ignore
                                        isErrorPrefixHidden
                                        customErrorWarningIcon={
                                            <WarningIcon
                                                // @ts-ignore
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    '--icon-primary-color': 'var(--error)'
                                                }}
                                            />
                                        }
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setDBCredentialsPassword(e.target.value));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={password}
                                        className={`${styles.textField} ${
                                            wizardType === WIZARD_TYPE.MSSQL &&
                                            selectConfig === SELECT_CONFIG.STANDARD_CREATE &&
                                            useManagedServiceAccount
                                                ? styles.disabledTooltip
                                                : ''
                                        }`}
                                        isDisabled={
                                            wizardType === WIZARD_TYPE.MSSQL &&
                                            selectConfig === SELECT_CONFIG.STANDARD_CREATE &&
                                            useManagedServiceAccount
                                        }
                                    />
                                </div>
                            </>
                        )}
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseCredentials;
