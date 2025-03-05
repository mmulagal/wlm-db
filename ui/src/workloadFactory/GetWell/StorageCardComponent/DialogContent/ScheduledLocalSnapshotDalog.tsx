import React, { useEffect, useMemo, useState } from 'react';
import styles from './DialogContent.module.scss';
import { Button, DsTypography } from '@netapp/design-system';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useLazyGetSnapshotPoliciesQuery } from '../../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setSelectedSnapshot, setSelectedSnapshotPolicy } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

const ScheduledLocalSnapshotDalog = ({ type }: any) => {
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const dispatch = useDispatch();
    const { selectedResourceId, selectedDatabaseInstance, selectedSnapshot, selectedSnapshotPolicy } = useAppSelector(
        state => state.getWellOptimize
    );
    const [getSnapshotPolicies] = useLazyGetSnapshotPoliciesQuery();
    const [loadPolicies, setLoadPolicies] = useState(false);

    useEffect(() => {
        async function getPolicies() {
            setLoadPolicies(true);
            const response = await getSnapshotPolicies({
                credentialId: headerSelectedCred?.data?.credentialsId,
                region: headerSelectedRegion?.label2,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            dispatch(setSelectedSnapshotPolicy(response?.data?.snapshotPolicies));
            setLoadPolicies(false);
        }
        if (selectedSnapshotPolicy === null || selectedSnapshotPolicy.length === 0) {
            getPolicies();
        }
    }, [selectedSnapshotPolicy]);

    const generateSnapshotPolicies = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        selectedSnapshotPolicy?.map((val: any, idx: number) => {
            const snapshotName = val?.name || '';
            const option = generateOptionType(snapshotName, snapshotName, '', false, '', val);
            options.push(option);
        });

        return options;
    }, [selectedSnapshotPolicy]);

    useEffect(() => {
        if (!selectedSnapshot) {
            dispatch(setSelectedSnapshot(generateSnapshotPolicies[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSnapshotPolicy]);

    const openCredentialTab = () => {
        const url = 'https://docs.netapp.com/us-en/workload-fsx-ontap/create-snapshot-policy.html';
        window.open(url, '_blank', 'noopener');
    };
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">Action summary</DsTypography>
                <DsTypography variant="Regular_14">
                    Workload Factory recommends enabling local snapshots on your FSx for ONTAP filesystem volumes by
                    applying a snapshot policy to each volume serving the SQL Server workload. Local snapshots are
                    instantaneous, capacity-efficient, point-in-time images of your volumes.
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <DsTypography variant="Regular_14">
                            Select one of the existing snapshot policies to create scheduled snapshots.
                            <Button
                                Component="button"
                                variant="link"
                                className={CommonStyles.buttonClass}
                                onClick={openCredentialTab}
                            >
                                Learn how to create new snapshot policy
                            </Button>
                        </DsTypography>
                    </div>
                    <div className={styles.selectField}>
                        <SelectField
                            label={'Snapshot policy name'}
                            isClearable={false}
                            value={selectedSnapshot ? [selectedSnapshot] : [generateSnapshotPolicies[0]]}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedSnapshot(selectedOptions));
                            }}
                            isSearchable={generateSnapshotPolicies.length > 5}
                            options={generateSnapshotPolicies}
                            isLoading={loadPolicies}
                        />
                    </div>
                </div>
            </div>

            <div className={styles['first-section']} style={{ marginTop: '-30px' }}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    What will happen
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            A snapshot policy will be assigned to a volume or several volumes.
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            Local snapshots would be created automatically based on the assigned policy.
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
                        <DsTypography variant="Regular_14">Snapshot policies can be modified later.</DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            Snapshots are crash-consistent, and it is recommended to add application consistency using
                            NetApp SnapCenter.
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            No disruption to your service is expected during this process.
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            Click Continue to authorize Workload Factory to automatically perform these actions on your
                            behalf.
                        </DsTypography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledLocalSnapshotDalog;
