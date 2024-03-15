import { PasswordField, TextField, Typography } from '@netapp/design-system';
import styles from './UndetectedHostDialogContent.module.scss';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPUserName,
    setDetectONTAPPassword
} from '../../../../store/workloadFactory/inventorySlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsDetectHostError } from '../../../../store/mssql/msSqlActionSlice';
import { GENERAL } from '../../../../utils/appConstants';

type DialogProps = {
    rowData: any;
};

const UndetectedHostDialogContent = ({ rowData }: DialogProps) => {
    const dispatch = useDispatch();
    const detectManageUserName = useAppSelector(state => state.inventory.detectManageUserName);
    const detectManagePassword = useAppSelector(state => state.inventory.detectManagePassword);
    const detectOntapUsername = useAppSelector(state => state.inventory.detectOntapUsername);
    const detectOntapPassword = useAppSelector(state => state.inventory.detectOntapPassword);
    const topRowValuesNotFilled = useAppSelector(state => state.inventory.valuesNotFilled);

    useEffect(() => {
        dispatch(setIsDetectHostError(''));
    }, [detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword]);

    return (
        <div className={styles.undetectedHostContent}>
            <Typography variant="Regular_14">{`${GENERAL.DETECT_HOST_DESC} ${rowData?.instance}`}</Typography>

            {!rowData?.sqlServerInstances?.[0]?.windowsAuthentication && (
                <div className={styles.firstSection}>
                    <Typography variant="Semibold_14">{GENERAL.DETECT_MSSQL_HEADING}</Typography>
                    <div className={styles.textFieldContainer}>
                        <TextField
                            label={GENERAL.DETECT_MSSQL_USERNAME}
                            value={detectManageUserName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectManageUserName(e.target.value));
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectManageUserName ? GENERAL.ACTION_REQUIRED : ''}
                        />

                        <PasswordField
                            label={GENERAL.DETECT_MSSQL_PASSWORD}
                            value={detectManagePassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectManagePassword(e.target.value));
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectManagePassword ? GENERAL.ACTION_REQUIRED : ''}
                        />
                    </div>
                </div>
            )}

            {rowData?.fsxId && !rowData?.isFsxRegistered && (
                <div className={styles.secondSection}>
                    <Typography variant="Semibold_14">{GENERAL.DETECT_FSX_HEADING}</Typography>
                    <div className={styles.textFieldContainer}>
                        <TextField
                            label={GENERAL.DETECT_FSX_USERNAME}
                            value={detectOntapUsername}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectONTAPUserName(e.target.value));
                            }}
                            className={styles.textFieldStyle}
                        />

                        <PasswordField
                            label={GENERAL.DETECT_FSX_PASSWORD}
                            value={detectOntapPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectONTAPPassword(e.target.value));
                            }}
                            className={styles.textFieldStyle}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UndetectedHostDialogContent;
