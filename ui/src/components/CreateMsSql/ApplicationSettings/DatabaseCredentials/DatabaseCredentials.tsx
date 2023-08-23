import { useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { useDispatch } from 'react-redux';
import { setDBCredentialsName, setDBCredentialsPassword } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';

import styles from './DatabaseCredentials.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

import AccordionError from '../../../../common/AccordionError/AccordionError';
import { dbPassVal } from '../../../../utils/utilityFunctions';

const DatabaseCredentials = () => {
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    const dispatch = useDispatch();
    const isDBPasswordFilled = useAppSelector(state => state.msSqlAction.dbCredentialPasswordSelected);
    //Set the Header text here
    const setHeader = () => {
        if (!userName || !password) {
            return <ActionRequired error={!isDBPasswordFilled ? true : false} />;
        } else if (dbPassVal(password)) {
            return <AccordionError />;
        } else {
            return <Typography variant="Regular_14">{userName}</Typography>;
        }
    };

    const tooltipText = () => {
        return (
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
    };

    const isValidUserName = () => {
        if (userName.length && (userName.length < 5 || !/^[a-zA-Z0-9]+$/.test(userName))) {
            return GENERAL.USERNAME_TOOLTIP;
        }
    };

    return (
        <div className={styles.credentials}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="11"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_CREDENTIALS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
                                info={GENERAL.USERNAME_TOOLTIP}
                                error={isValidUserName()}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUserName(e.target.value);
                                    dispatch(setDBCredentialsName(e.target.value));
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <PasswordField
                                label={GENERAL.PASSWORD}
                                error={!isDBPasswordFilled ? GENERAL.ACTION_REQUIRED : '' || dbPassVal(password)}
                                info={tooltipText()}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        //@ts-ignore
                                        style={{ width: '16px', height: '16px', '--icon-primary-color': 'var(--error' }}
                                    />
                                }
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                    dispatch(setDBCredentialsPassword(e.target.value));
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
