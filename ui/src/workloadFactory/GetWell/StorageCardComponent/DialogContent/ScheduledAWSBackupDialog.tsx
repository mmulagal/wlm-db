import React from 'react';
import styles from './DialogContent.module.scss';
import { Button, DsTypography, TextField } from '@netapp/design-system';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedAWSBackup } from '../../../../store/workloadFactory/getWellOptimizeSlice';

const ScheduledAWSBackupDialog = ({ type }: any) => {
    const dispatch = useDispatch();
    const { selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);

    const handleDaysChange = (value: string | number) => {
        dispatch(setSelectedAWSBackup({ ...selectedAWSBackup, numberOfDays: value.toString() }));
    };

    const handleHoursChange = (value: string | number) => {
        dispatch(setSelectedAWSBackup({ ...selectedAWSBackup, hour: value.toString() }));
    };

    const handleMinutesChange = (value: string | number) => {
        dispatch(setSelectedAWSBackup({ ...selectedAWSBackup, minute: value.toString() }));
    };

    const checkDaysError = () => {
        if (Number(selectedAWSBackup?.numberOfDays) < 1 || Number(selectedAWSBackup?.numberOfDays) > 90) {
            return 'Please enter a value between 1 and 90';
        }
    };
    const checkHoursError = () => {
        if (Number(selectedAWSBackup?.hour) < 1 || Number(selectedAWSBackup?.hour) > 24) {
            return 'Please enter a value between 1 and 24';
        }
    };

    const checkMinutesError = () => {
        if (Number(selectedAWSBackup?.minute) < 0 || Number(selectedAWSBackup?.minute) > 60) {
            return 'Please enter a value between 0 and 60';
        }
    };

    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">Action summary</DsTypography>
                <DsTypography variant="Regular_14">
                    Workload Factory recommends enabling AWS backup on your FSx for ONTAP filesystem to set retention
                    based scheduled backups of your data volumes.
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            Choose the number of days (between 1 and 90 days) that FSx for ONTAP should retain automatic
                            backups for the serving file system.
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">Number of days.</DsTypography>
                    </div>
                    <div className={styles.row}>
                        <TextField
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const inputVal = e.target.value.replace(/[^0-9.,]/g, '');
                                handleDaysChange(inputVal);
                            }}
                            placeholder={GENERAL.TAG_KEY_PLACEHOLDER}
                            value={selectedAWSBackup?.numberOfDays}
                            className={styles.keyField}
                            // @ts-ignore
                            maxlength={90}
                            error={checkDaysError()}
                        />
                    </div>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <DsTypography variant="Regular_14">
                                Select start time for 30-minute daily automatic backup window.
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.row} style={{ display: 'flex', alignItems: 'center' }}>
                        <div>
                            <DsTypography variant="Regular_14">Hours</DsTypography>

                            <TextField
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const inputVal = e.target.value.replace(/[^0-9.,]/g, '');
                                    handleHoursChange(inputVal);
                                }}
                                placeholder={GENERAL.TAG_KEY_PLACEHOLDER}
                                value={selectedAWSBackup?.hour}
                                className={styles.keyField}
                                // @ts-ignore
                                maxlength={24}
                                error={checkHoursError()}
                            />
                        </div>
                        <span>:</span>
                        <div>
                            <DsTypography variant="Regular_14">Minutes</DsTypography>

                            <TextField
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const inputVal = e.target.value.replace(/[^0-9.,]/g, '');
                                    handleMinutesChange(inputVal);
                                }}
                                placeholder={GENERAL.TAG_KEY_PLACEHOLDER}
                                value={selectedAWSBackup?.minute}
                                className={styles.keyField}
                                // @ts-ignore
                                maxlength={24}
                                error={checkMinutesError()}
                            />
                        </div>
                        <DsTypography style={{ position: 'relative', top: '-5px' }} variant="Regular_20">
                            UTC
                        </DsTypography>
                    </div>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        What will happen
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                The FSx for ONTAP backup feature will be enabled on the FSx for ONTAP filesystem
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                A retention policy of X daily backup copies will be set
                            </DsTypography>
                        </div>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">The backup window will be scheduled for:</DsTypography>
                        </div>

                        <div className={styles.row} style={{ marginLeft: '60px' }}>
                            <DsTypography variant="Regular_14">
                                Daily automatic backup window:{' '}
                                {selectedAWSBackup?.hour < 10 ? `0${selectedAWSBackup?.hour}` : selectedAWSBackup?.hour}
                                :
                                {selectedAWSBackup?.minute < 10
                                    ? `0${selectedAWSBackup?.minute}`
                                    : selectedAWSBackup?.minute}{' '}
                                UTC
                            </DsTypography>
                        </div>

                        <div className={styles.row} style={{ marginLeft: '60px' }}>
                            <DsTypography variant="Regular_14">
                                Automatic backup retention period: {selectedAWSBackup?.numberOfDays}{' '}
                                {selectedAWSBackup?.numberOfDays > 1 ? 'days' : 'day'}
                            </DsTypography>
                        </div>
                    </div>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        {GENERAL.NOTE}
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">Backups are crash-consistent.</DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">Offline volumes cannot be backed up.</DsTypography>
                        </div>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                You can still manually initiate backup and restore operations via Workload Factory.
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                The retention period and scheduling can be modified as needed.
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledAWSBackupDialog;
