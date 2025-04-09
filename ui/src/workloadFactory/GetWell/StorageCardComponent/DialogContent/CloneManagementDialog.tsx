import React, { useEffect, useMemo, useState } from 'react';
import styles from './DialogContent.module.scss';
import { Button, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useLazyGetSnapshotPoliciesQuery } from '../../../../utils/apiService';
import { useDispatch } from 'react-redux';
import { setSelectedSnapshot, setSelectedSnapshotPolicy } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { formatCronSchedule } from './cronUtils';

const CloneManagementDialog = ({ type, data }: any) => {
    const dispatch = useDispatch();
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedSnapshot,
        selectedSnapshotPolicy,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId
    } = useAppSelector(state => state.getWellOptimize);
    const [getSnapshotPolicies] = useLazyGetSnapshotPoliciesQuery();
    const [loadPolicies, setLoadPolicies] = useState(false);

    // useEffect(() => {
    //     async function getPolicies() {
    //         setLoadPolicies(true);
    //         const response = await getSnapshotPolicies({
    //             credentialId: selectedGwInstanceCredId || data?.credentialId,
    //             region: selectedGwInstanceRegionId || data?.regionId,
    //             databaseHostId: selectedResourceId || data?.databaseHostId,
    //             instanceId: selectedDatabaseInstance || data?.instanceId
    //         });
    //         dispatch(setSelectedSnapshotPolicy(response?.data?.snapshotPolicies));
    //         setLoadPolicies(false);
    //     }
    //     if (selectedSnapshotPolicy === null || (selectedSnapshotPolicy && selectedSnapshotPolicy.length === 0)) {
    //         getPolicies();
    //     }
    // }, [selectedSnapshotPolicy]);

    // const generateSnapshotPolicies = useMemo<optionType[]>((): optionType[] => {
    //     const options: optionType[] = [];
    //     selectedSnapshotPolicy?.map((val: any, idx: number) => {
    //         const snapshotName = val?.name || '';
    //         const option = generateOptionType(snapshotName, snapshotName, '', false, '', val);
    //         if (option.label !== 'none') {
    //             options.push(option);
    //         }
    //     });

    //     return options;
    // }, [selectedSnapshotPolicy]);

    // useEffect(() => {
    //     if (!selectedSnapshot) {
    //         dispatch(setSelectedSnapshot(generateSnapshotPolicies[0]));
    //     }
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [selectedSnapshotPolicy]);

    // const openCredentialTab = () => {
    //     const url = 'https://docs.netapp.com/us-en/workload-fsx-ontap/create-snapshot-policy.html';
    //     window.open(url, '_blank', 'noopener');
    // };
    return (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">Action summary</DsTypography>
                <DsTypography variant="Regular_14">
                    Workload Factory recommends managing old and costly clones by either deleting or refreshing them.
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
                            // onClick={openCredentialTab}
                            >
                                Learn how to create new snapshot policy
                            </Button>
                        </DsTypography>
                    </div>
                    <div className={styles.selectField}>
                        {/* <SelectField
                            label={'Snapshot policy name'}
                            isClearable={false}
                            value={selectedSnapshot ? [selectedSnapshot] : [generateSnapshotPolicies[0]]}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedSnapshot(selectedOptions));
                            }}
                            isSearchable={generateSnapshotPolicies.length > 5}
                            options={generateSnapshotPolicies}
                            isLoading={loadPolicies}
                        /> */}
                    </div>
                </div>
            </div>

            <div className={styles['first-section']} style={{ marginTop: '-30px' }}>
                <div className={styles.ribbon}>
                    <div className={styles.leftSde}>
                        <DsTypography variant="Regular_14">Policy schedule:</DsTypography>
                    </div>

                    {loadPolicies ? (
                        <div className={styles.rightSide}>
                            <div style={{ position: 'relative', top: '8px' }}>
                                <DsFlashingDotsLoader />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.rightSide}>
                            {selectedSnapshot?.data?.schedules &&
                                selectedSnapshot?.data?.schedules.length > 0 &&
                                selectedSnapshot?.data?.schedules.map((schedule: any, idx: number) => (
                                    <div className={styles.row} key={idx}>
                                        <div>
                                            <Bullet />
                                        </div>
                                        <DsTypography variant="Regular_14">{formatCronSchedule(schedule)}</DsTypography>
                                    </div>
                                ))}

                            {(selectedSnapshot?.data?.schedules === undefined ||
                                (selectedSnapshot?.data?.schedules &&
                                    selectedSnapshot?.data?.schedules.length === 0)) && (
                                    <DsTypography variant="Regular_14">Not available</DsTypography>
                                )}
                        </div>
                    )}
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
                            Users can choose to delete the clone or refresh it to synchronize with the source, reducing additional storage costs.
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
                        <DsTypography variant="Regular_14">Refreshing a clone will synchronize it with its source, making it identical and cost-efficient.</DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            Deleting a clone will remove it permanently, freeing up storage space and reducing costs.

                        </DsTypography>
                    </div>
                    {/* <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            No disruption to your service is expected during this process.
                        </DsTypography>
                    </div> */}

                    {/* <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            Click Continue to authorize Workload Factory to automatically perform these actions on your
                            behalf.
                        </DsTypography>
                    </div> */}
                </div>
            </div>
        </div>
    );
};

export default CloneManagementDialog;
