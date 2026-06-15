import React, { useEffect, useMemo, useState } from 'react';
import { Button, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useLazyGetSnapshotPoliciesQuery } from '../../../../utils/apiService';
import { setSelectedSnapshot, setSelectedSnapshotPolicy } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { formatCronSchedule } from './cronUtils';

const ScheduledLocalSnapshotDalog = ({ type, data, isWad = false }: any) => {
    const { t } = useTranslation();
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

    useEffect(() => {
        async function getPolicies() {
            setLoadPolicies(true);
            const response = await getSnapshotPolicies({
                credentialId: selectedGwInstanceCredId || data?.credentialId,
                region: selectedGwInstanceRegionId || data?.regionId,
                databaseHostId: selectedResourceId || data?.databaseHostId,
                instanceId: selectedDatabaseInstance || data?.instanceId
            });
            dispatch(setSelectedSnapshotPolicy(response?.data?.snapshotPolicies));
            setLoadPolicies(false);
        }
        if (
            !isWad &&
            (selectedSnapshotPolicy === null || (selectedSnapshotPolicy && selectedSnapshotPolicy.length === 0))
        ) {
            getPolicies();
        }
    }, [selectedSnapshotPolicy]);

    const generateSnapshotPolicies = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        selectedSnapshotPolicy?.map((val: any, idx: number) => {
            const snapshotName = val?.name || '';
            const option = generateOptionType(snapshotName, snapshotName, '', false, '', val);
            if (option.label !== 'none') {
                options.push(option);
            }
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
                <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {t('databases.well-architect.scheduled-local-snapshot-action-summary')}
                </DsTypography>
            </div>

            {!isWad && (
                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        {GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED}
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.scheduled-local-snapshot-select-policy')}
                                <Button
                                    Component="button"
                                    variant="link"
                                    className={CommonStyles.buttonClass}
                                    onClick={openCredentialTab}
                                >
                                    {t('databases.well-architect.scheduled-local-snapshot-learn-link')}
                                </Button>
                            </DsTypography>
                        </div>
                        <div className={styles.selectField}>
                            <SelectField
                                label={t('databases.well-architect.scheduled-local-snapshot-policy-name')}
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
            )}

            {!isWad && (
                <div className={styles['first-section']} style={{ marginTop: '-30px' }}>
                    <div className={styles.ribbon}>
                        <div className={styles.leftSde}>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.scheduled-local-snapshot-policy-schedule')}
                            </DsTypography>
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
                                            <DsTypography variant="Regular_14">
                                                {formatCronSchedule(schedule)}
                                            </DsTypography>
                                        </div>
                                    ))}

                                {(selectedSnapshot?.data?.schedules === undefined ||
                                    (selectedSnapshot?.data?.schedules &&
                                        selectedSnapshot?.data?.schedules.length === 0)) && (
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.scheduled-local-snapshot-not-available')}
                                    </DsTypography>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!isWad && (
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
                                {t('databases.well-architect.scheduled-local-snapshot-what-happen-point1')}
                            </DsTypography>
                        </div>

                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.scheduled-local-snapshot-what-happen-point2')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            )}

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
                            {t('databases.well-architect.scheduled-local-snapshot-note1')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.scheduled-local-snapshot-note2')}
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.scheduled-local-snapshot-note3')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.scheduled-local-snapshot-note-aoag')}
                        </DsTypography>
                    </div>

                    {!isWad && (
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mtu-alignment-note3')}
                            </DsTypography>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduledLocalSnapshotDalog;
