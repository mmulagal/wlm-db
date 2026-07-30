import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './DialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedAWSBackup } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { DBType } from '../../../../utils/consts';

const ScheduledAWSBackupDialog = ({ type, engineType = DBType.MSSQL }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);

    // Function to generate the options for Select Field
    const generateHour = useMemo<optionType[]>((): optionType[] => {
        const arr = Array.from({ length: 24 }, (_, i) => (i < 10 ? `0${i}` : `${i}`));
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    // Function to generate the options for Select Field
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

    const isOracle = engineType === DBType.ORACLE;

    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {isOracle
                        ? t('databases.well-architect.oracle-aws-backup-action-summary')
                        : t('databases.well-architect.aws-backup-action-summary-content')}
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">
                    {t('databases.well-architect.oracle-aws-backup-option1-title')}
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {t('databases.well-architect.user-action-required')}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.aws-backup-user-action-content')}
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.aws-backup-number-of-days')}
                        </DsTypography>
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
                                {t('databases.well-architect.aws-backup-automatic-window')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.row} style={{ display: 'flex', alignItems: 'center' }}>
                        <div>
                            <SelectField
                                label="Hour"
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
                                label="Minute"
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
                        <DsTypography style={{ position: 'relative', top: '-5px' }} variant="Regular_16">
                            {t('databases.well-architect.aws-backup-utc')}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        {t('databases.well-architect.what-will-happen')}
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.aws-backup-what-will-happen-content1')}
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.aws-backup-what-will-happen-content2')}
                            </DsTypography>
                        </div>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.aws-backup-what-will-happen-content3')}
                            </DsTypography>
                        </div>

                        <div className={styles.row} style={{ marginLeft: '60px' }}>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.aws-backup-what-will-happen-content3a')}{' '}
                                {selectedAWSBackup?.hour}:{selectedAWSBackup?.minute}{' '}
                                {t('databases.well-architect.aws-backup-utc')}
                            </DsTypography>
                        </div>

                        <div className={styles.row} style={{ marginLeft: '60px' }}>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.aws-backup-what-will-happen-content3b')}{' '}
                                {selectedAWSBackup?.numberOfDays} {selectedAWSBackup?.numberOfDays > 1 ? 'days' : 'day'}
                            </DsTypography>
                        </div>
                    </div>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.well-architect.oracle-aws-backup-option2-title')}
                    </DsTypography>
                    <DsTypography variant="Regular_14">
                        {isOracle
                            ? t('databases.well-architect.oracle-aws-backup-option2-desc')
                            : t('databases.well-architect.aws-backup-option2-desc')}{' '}
                        <a
                            href="https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/using-backups.html#aws-backup-and-fsx"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t('databases.well-architect.oracle-aws-backup-option2-link')}
                        </a>
                    </DsTypography>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        {t('databases.well-architect.note')}
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {isOracle
                                    ? t('databases.well-architect.oracle-aws-backup-note1')
                                    : t('databases.well-architect.aws-backup-note1')}
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {isOracle
                                    ? t('databases.well-architect.oracle-aws-backup-note2')
                                    : t('databases.well-architect.aws-backup-note2')}
                            </DsTypography>
                        </div>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {isOracle
                                    ? t('databases.well-architect.oracle-aws-backup-note3')
                                    : t('databases.well-architect.aws-backup-note3')}
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {isOracle
                                    ? t('databases.well-architect.oracle-aws-backup-note4')
                                    : t('databases.well-architect.aws-backup-note4')}
                            </DsTypography>
                        </div>

                        {isOracle && (
                            <>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.oracle-aws-backup-note5')}
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.oracle-aws-backup-note6')}
                                    </DsTypography>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledAWSBackupDialog;
