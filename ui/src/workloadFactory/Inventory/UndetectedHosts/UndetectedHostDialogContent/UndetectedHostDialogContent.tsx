import { PasswordField, TextField, Typography } from '@netapp/design-system';
import styles from './UndetectedHostDialogContent.module.scss';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setDetectManagePassword, setDetectManageUserName } from '../../../../store/workloadFactory/inventorySlice';

const UndetectedHostDialogContent = () => {
    const dispatch = useDispatch();
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    return (
        <div className={styles.undetectedHostContent}>
            <Typography variant="Regular_14">
                Detect and manage Microsoft SQL Server deployed on EC2 instance with IP address
            </Typography>

            <div className={styles.textFieldContainer}>
                <TextField
                    label={'Microsoft SQL Server user name'}
                    value={userName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setUserName(e.target.value);
                        dispatch(setDetectManageUserName(e.target.value));
                    }}
                    className={styles.textFieldStyle}
                />

                <PasswordField
                    label={'Microsoft SQL Server password'}
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setPassword(e.target.value);
                        dispatch(setDetectManagePassword(e.target.value));
                    }}
                    className={styles.textFieldStyle}
                />
            </div>
        </div>
    );
};

export default UndetectedHostDialogContent;
