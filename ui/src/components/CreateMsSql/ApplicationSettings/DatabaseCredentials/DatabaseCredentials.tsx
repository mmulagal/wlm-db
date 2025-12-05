import { useEffect, useRef, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    PasswordField,
    TextField,
    Typography,
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
    setActiveDirectoryFields
} from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';

import styles from './DatabaseCredentials.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

import AccordionError from '../../../../common/AccordionError/AccordionError';
import { dbPassVal, isValidUserName } from '../../../../utils/utilityFunctions';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { DBType, POSTGRE_USERNAME, SQL_USERNAME, WIZARD_TYPE } from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

type DatabaseCredentialsProps = {
    wizardType?: string;
};

const DatabaseCredentials = ({ wizardType }: DatabaseCredentialsProps) => {
    const { t } = useTranslation();
    const userName = useAppSelector(state => state.mssqlForm.dbCredentials.name);
    const password = useAppSelector(state => state.mssqlForm.dbCredentials.password);
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

        return <Typography variant="Regular_14">{credName}</Typography>;
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
        <Typography variant="Regular_13" className={styles.infoMsg}>
            <Typography variant="Regular_13">{GENERAL.PASSWORD_CRED_1}</Typography>
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
            <Typography variant="Regular_13" className={styles.lastItem}>
                {GENERAL.PASSWORD_CRED_4}
            </Typography>
        </Typography>
    );

    return (
        <div className={styles.credentials}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="11"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_CREDENTIALS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14" className={styles.subtext}>
                            {wizardType === WIZARD_TYPE.MSSQL
                                ? GENERAL.DATABASE_CREDENTIAL_TEXT
                                : GENERAL.DATABASE_CREDENTIAL_TEXT_PGSQL}
                        </Typography>
                        {wizardType === WIZARD_TYPE.MSSQL && selectConfig === SELECT_CONFIG.STANDARD_CREATE && (
                            <div className={styles.checkboxContainer}>
                                <div className={styles.checkboxWrapper}>
                                    <Checkbox
                                        isChecked={useManagedServiceAccount}
                                        onChange={(checked: boolean) => {
                                            dispatch(setActiveDirectoryFields({ useManagedServiceAccount: checked }));
                                            // Clear password when checkbox is checked
                                            if (checked) {
                                                dispatch(setDBCredentialsPassword(''));
                                            }
                                        }}
                                    />
                                    <Typography variant="Regular_14" className={styles.checkboxLabel}>
                                        {t('databases.general.use-managed-service-account')}
                                    </Typography>
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
                                                    <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP1}</div>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <div className={styles.textWidth}>{GENERAL.USERNAME_TOOLTIP2}</div>
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
                                        style={{ width: '16px', height: '16px', '--icon-primary-color': 'var(--error' }}
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
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseCredentials;
