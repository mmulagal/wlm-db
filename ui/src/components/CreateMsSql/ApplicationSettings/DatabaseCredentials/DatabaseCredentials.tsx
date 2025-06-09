import { useEffect, useRef, useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useDispatch } from 'react-redux';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { setDBCredentialsName, setDBCredentialsPassword } from '../../../../store/mssql/mssqlFormSlice';
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
    const userName = useAppSelector(state => state.mssqlForm.dbCredentials.name);
    const password = useAppSelector(state => state.mssqlForm.dbCredentials.password);

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
        if (!credName || !password) {
            return <ActionRequired error={!isDBPasswordFilled} />;
        }
        if (dbPassVal(password) || isValidUserName(credName)) {
            return <AccordionError />;
        }
        return <Typography variant="Regular_14">{credName}</Typography>;
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
                                error={!isDBPasswordFilled ? GENERAL.ACTION_REQUIRED : dbPassVal(password)}
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
                                className={styles.textField}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseCredentials;
