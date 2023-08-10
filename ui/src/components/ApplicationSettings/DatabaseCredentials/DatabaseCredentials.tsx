import { useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../utils/appConstants';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { useDispatch } from 'react-redux';
import { setDBCredentialsName, setDBCredentialsPassword } from '../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../store/storeHooks';

import styles from './DatabaseCredentials.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const DatabaseCredentials = () => {
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();
    const isDBPasswordFilled = useAppSelector(state => state.msSqlAction.dbCredentialPasswordSelected);
    //Set the Header text here
    const setHeader = () => {
        if (!userName || !password) {
            return <ActionRequired error={!isDBPasswordFilled ? true : false} />;
        } else {
            return <Typography variant="Regular_14">{userName}</Typography>;
        }
    };

    const tooltipText = () => {
        return (
            <Typography variant="Regular_13" className={styles.infoMsg}>
                <Typography variant="Regular_13">{GENERAL.PASSWORD_CRED_1}</Typography>
                <Typography variant="Regular_13">{GENERAL.PASSWORD_CRED_2}</Typography>
                <Typography variant="Regular_13">{GENERAL.PASSWORD_CRED_3}</Typography>
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

    const checkForErrorPassword = () => {
        if (password.length) {
            const categories = [
                /[A-Z]/, // Latin uppercase letters
                /[a-z]/, // Latin lowercase letters
                /[0-9]/, // Base 10 digits
                /[!$#%]/ // Non-alphanumeric characters
            ];

            const metCategories = categories.filter(category => category.test(password));

            if (password.length >= 8 && metCategories.length >= 3) {
                return '';
            } else {
                return GENERAL.PASSWORD_ERROR_CHECK;
            }
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUserName(e.target.value);
                                    dispatch(setDBCredentialsName(e.target.value));
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <PasswordField
                                label={GENERAL.PASSWORD}
                                error={!isDBPasswordFilled ? GENERAL.ACTION_REQUIRED : '' || checkForErrorPassword()}
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
