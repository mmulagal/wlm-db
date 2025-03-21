import React, { useMemo } from 'react';
import styles from './DialogContent.module.scss';
import { Button, DsTypography, TextField } from '@netapp/design-system';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedAWSBackup } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const ScheduledAWSBackupDialog = ({ type }: any) => {
    const dispatch = useDispatch();
    const { selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);

    //Function to generate the options for Select Field
    const generateHour = useMemo<optionType[]>((): optionType[] => {
        const arr = Array.from({ length: 24 }, (_, i) => (i < 10 ? `0${i}` : `${i}`));
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    //Function to generate the options for Select Field
    const generateMinutes = useMemo<optionType[]>((): optionType[] => {
        const arr = Array.from({ length: 60 }, (_, i) => (i < 10 ? `0${i}` : `${i}`));
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    const handleDaysChange = (value: string | number) => {
        dispatch(setSelectedAWSBackup({ ...selectedAWSBackup, numberOfDays: value.toString() }));
    };

    const checkDaysError = () => {
        if (Number(selectedAWSBackup?.numberOfDays) < 1 || Number(selectedAWSBackup?.numberOfDays) > 90) {
            return 'Please enter a value between 1 and 90';
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
                            className={styles.keyFieldDays}
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
                            <SelectField
                                label={'Hours'}
                                isClearable={false}
                                defaultValue={
                                    selectedAWSBackup?.hour
                                        ? [
                                              generateOptionType(
                                                  selectedAWSBackup?.hour,
                                                  selectedAWSBackup?.hour,
                                                  '',
                                                  false,
                                                  '',
                                                  selectedAWSBackup?.hour
                                              )
                                          ]
                                        : [generateHour[0]]
                                }
                                onChange={(selectedOptions: any): void => {
                                    dispatch(
                                        setSelectedAWSBackup({
                                            ...selectedAWSBackup,
                                            hour: selectedOptions?.label.toString()
                                        })
                                    );
                                }}
                                className={styles.keyField}
                                isSearchable={false}
                                options={generateHour}
                            />
                        </div>
                        <span>:</span>
                        <div>
                            <SelectField
                                label={'Minutes'}
                                isClearable={false}
                                defaultValue={
                                    selectedAWSBackup?.minute
                                        ? [
                                              generateOptionType(
                                                  selectedAWSBackup?.minute,
                                                  selectedAWSBackup?.minute,
                                                  '',
                                                  false,
                                                  '',
                                                  selectedAWSBackup?.minute
                                              )
                                          ]
                                        : [generateMinutes[0]]
                                }
                                onChange={(selectedOptions: any): void => {
                                    dispatch(
                                        setSelectedAWSBackup({
                                            ...selectedAWSBackup,
                                            minute: selectedOptions?.label.toString()
                                        })
                                    );
                                }}
                                className={styles.keyField}
                                isSearchable={false}
                                options={generateMinutes}
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
                                A retention policy of daily backup copies will be set
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
                                Daily automatic backup window: {selectedAWSBackup?.hour}:{selectedAWSBackup?.minute} UTC
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
                                You can still manually initiate backup and restore operations via workload factory.
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                The retention period and scheduling can be modified as needed for FSx for ONTAP in AWS
                                console.
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledAWSBackupDialog;
