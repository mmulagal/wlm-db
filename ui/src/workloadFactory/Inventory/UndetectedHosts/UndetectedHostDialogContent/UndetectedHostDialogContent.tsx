import { PasswordField, TextField, Typography } from '@netapp/design-system';
import styles from './UndetectedHostDialogContent.module.scss';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPUserName,
    setDetectONTAPPassword
} from '../../../../store/workloadFactory/inventorySlice';
import { useAppSelector } from '../../../../store/storeHooks';

const UndetectedHostDialogContent = () => {
    const dispatch = useDispatch();
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const detectOntapUsername = useAppSelector(state => state.inventory.detectOntapUsername);
    const detectOntapPassword = useAppSelector(state => state.inventory.detectOntapPassword);
    return (
        <div className={styles.undetectedHostContent}>
            <Typography variant="Regular_14">
                Detect and manage Microsoft SQL Server deployed on EC2 instance with IP address
            </Typography>

            <div className={styles.firstSection}>
                <Typography variant="Semibold_14">Microsoft SQL Server</Typography>
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

            <div className={styles.secondSection}>
                <Typography variant="Semibold_14">Microsoft SQL Server</Typography>
                <div className={styles.textFieldContainer}>
                    <TextField
                        label={'ONTAP user name'}
                        value={detectOntapUsername}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            dispatch(setDetectONTAPUserName(e.target.value));
                        }}
                        className={styles.textFieldStyle}
                    />

                    <PasswordField
                        label={'ONTAP password'}
                        value={detectOntapPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            dispatch(setDetectONTAPPassword(e.target.value));
                        }}
                        className={styles.textFieldStyle}
                    />
                </div>
            </div>
        </div>
    );
};

export default UndetectedHostDialogContent;
