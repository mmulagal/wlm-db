import { useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
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
