import React, { useEffect, useMemo, useState } from 'react';
import styles from './DialogContent.module.scss';
import { Button, DsTypography } from '@netapp/design-system';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
// import { useLazyGetSnapshotPoliciesQuery } from '../../../../utils/apiService';
// import { useLazyGetAWSBackupPoliciesQuery } from '../../../../utils/apiService';
import { useDispatch } from 'react-redux';

import { setSelectedAWSBackup } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const ScheduledAWSBackupDialog = ({ type }: any) => {
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const dispatch = useDispatch();
    const { selectedResourceId, selectedDatabaseInstance, selectedAWSBackup } = useAppSelector(
        state => state.getWellOptimize
    );
    // const [getAWSBackupPolicies] = useLazyGetAWSBackupPoliciesQuery();
    const [loadPolicies, setLoadPolicies] = useState(false);

    // useEffect(() => {
    //     async function getPolicies() {
    //         setLoadPolicies(true);
    //         const response = await getAWSBackupPolicies({
    //             credentialId: headerSelectedCred?.data?.credentialsId,
    //             region: headerSelectedRegion?.label2,
    //             databaseHostId: selectedResourceId,
    //             instanceId: selectedDatabaseInstance
    //         });
    //         dispatch(selectedawsBackup(response?.data?.AWSBackupPolicies));
    //         setLoadPolicies(false);
    //     }
    //     if (selectedawsBackup === null || selectedawsBackup.length === 0) {
    //         getPolicies();
    //     }
    // }, [selectedawsBackup]);

    const generateAWSBAckupPolicies = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        selectedAWSBackup?.map((val: any, idx: number) => {
            const AWSBackupName = val?.name || '';
            const option = generateOptionType(AWSBackupName, AWSBackupName, '', false, '', val);
            options.push(option);
        });

        return options;
    }, [selectedAWSBackup]);

    useEffect(() => {
        if (!selectedAWSBackup) {
            dispatch(setSelectedAWSBackup(generateAWSBAckupPolicies[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAWSBackup]);

    const openCredentialTab = () => {
        const url = 'https://docs.netapp.com/us-en/workload-fsx-ontap/create-snapshot-policy.html';
        window.open(url, '_blank', 'noopener');
    };
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">Action summary</DsTypography>
                <DsTypography variant="Regular_14">
                    Workload Factory recommends enabling backup on your FSx for ONTAP filesystem to set retention based
                    scheduled backups of your data volumes
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
                        <input
                            type="number"
                            min={1}
                            max={90}
                            placeholder=""
                            required
                            style={{ width: '100px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                            onInput={e => {
                                const input = e.target as HTMLInputElement;
                                let value = parseInt(input.value, 10);
                                if (value > 90) {
                                    input.value = '90';
                                }
                            }}
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
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginRight: '5px'
                            }}
                        >
                            <DsTypography variant="Regular_14">Hours</DsTypography>
                            <input
                                type="number"
                                min={0}
                                max={23}
                                placeholder=""
                                required
                                style={{ width: '75px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                onInput={e => {
                                    const input = e.target as HTMLInputElement;
                                    let value = parseInt(input.value, 10);
                                    if (value > 23) {
                                        input.value = '23';
                                    }
                                }}
                            />
                        </div>
                        <span>:</span>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginLeft: '5px',
                                marginRight: '5px'
                            }}
                        >
                            <DsTypography variant="Regular_14">Minutes</DsTypography>
                            <input
                                type="number"
                                min={0}
                                max={59}
                                placeholder=""
                                required
                                style={{ width: '75px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                                onInput={e => {
                                    const input = e.target as HTMLInputElement;
                                    let value = parseInt(input.value, 10);
                                    if (value > 59) {
                                        input.value = '59';
                                    }
                                }}
                            />
                        </div>
                        <span>UTC</span>
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
                            <DsTypography variant="Regular_14">The backup window will be scheduled for</DsTypography>
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
