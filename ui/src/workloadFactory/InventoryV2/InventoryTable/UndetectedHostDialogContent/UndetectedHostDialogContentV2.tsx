import { PasswordField, TextField, Typography } from '@netapp/design-system';
import styles from './UndetectedHostDialogContentV2.module.scss';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    setDetectManagePassword,
    setDetectManageUserName,
    setDetectONTAPUserName,
    setDetectONTAPPassword
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsDetectHostError } from '../../../../store/mssql/msSqlActionSlice';
import { GENERAL } from '../../../../utils/appConstants';

type DialogProps = {
    rowData: any;
};

const UndetectedHostDialogContentV2 = ({ rowData }: DialogProps) => {
    const dispatch = useDispatch();
    const { detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword } = useAppSelector(
        state => state.inventoryV2
    );
    const topRowValuesNotFilled = useAppSelector(state => state.inventoryV2.valuesNotFilled);

    useEffect(() => {
        dispatch(setIsDetectHostError(''));
    }, [detectManageUserName, detectManagePassword, detectOntapUsername, detectOntapPassword]);

    return (
        <div className={styles.undetectedHostContent}>
            <div className={styles.dialogMsg}>
                <Typography variant="Regular_14">{GENERAL.DETECT_INSTANCE_DESC}</Typography>&nbsp;
                <Typography variant="Semibold_14">{rowData?.databaseInstanceName}</Typography>
            </div>

            {/* MSSQL credential is asked when it is not yet registered */}
            {!rowData?.sqlServerAuthentication && !rowData?.windowsAuthentication && (
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

            {/* FSx credential is asked when this instance has FSx and its credential is not yet registered */}
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
                            error={topRowValuesNotFilled && !detectOntapUsername ? GENERAL.ACTION_REQUIRED : ''}
                        />

                        <PasswordField
                            label={GENERAL.DETECT_FSX_PASSWORD}
                            value={detectOntapPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                dispatch(setDetectONTAPPassword(e.target.value));
                            }}
                            className={styles.textFieldStyle}
                            error={topRowValuesNotFilled && !detectOntapPassword ? GENERAL.ACTION_REQUIRED : ''}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UndetectedHostDialogContentV2;
