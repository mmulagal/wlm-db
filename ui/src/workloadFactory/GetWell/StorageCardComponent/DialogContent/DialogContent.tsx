import { Button, DsTypography, SelectField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setRecommendedInstanceInBulk,
    setSelectedRecommendedInstance
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_NAMES, AWS_RESIZE_URL, MSSQL_HIGH_AVAILABILITY_CONFIGS } from '../../../../utils/consts';
import MSSQLPatchDialog from './MSSQLPatchDialog';

import ScheduledLocalSnapshotDalog from './ScheduledLocalSnapshotDalog';
import ScheduledAWSBackupDialog from './ScheduledAWSBackupDialog';

type DialogType = {
    type: string;
    recommendationOptions?: any;
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    bulkRecommendationOptions?: Array<any>;
    missingPatchList?: Array<any>;
    operation?: string;
};

const DialogContent = ({
    type,
    recommendationOptions = null,
    missingPermissions,
    recommendedSizeInGib,
    bulkRecommendationOptions = [],
    missingPatchList = [],
    operation = 'single'
}: DialogType) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedRecommendedInstance, selectedDatabaseStorageType, recommendedInstanceInBulk } = useAppSelector(
        state => state.getWellOptimize
    );

    const generateRecommendedInstanceTypes = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        recommendationOptions?.forEach((option: any) => {
            const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1) {
            dispatch(setSelectedRecommendedInstance(options[0]));
        }
        return options;
    }, [recommendationOptions, dispatch]); // Added 'dispatch' to the dependency array to comply with React Hooks rules and prevent stale closures

    const generateRecommendedInstanceTypesForHost = (instance: any) => {
        const options: optionType[] = [];
        instance?.recommendationOptions?.forEach((option: any) => {
            const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1 && !recommendedInstanceInBulk?.[instance?.hostName]) {
            dispatch(setRecommendedInstanceInBulk({ type: instance?.hostName, value: options[0] }));
        }
        return options;
    };

    const ontapConfigTextSet = () => {
        switch (type) {
            case 'Autosize':
                return 'Autosize on';
            case 'Thin provisioning':
                return 'Thin provisioninig (-space-guarantee = none)';
            case 'Autosize-mode':
                return 'Autosize-mode = grow';
            case 'Fractional reserve':
                return 'Fractional reserve = 0%';
            case 'Snapshot copy reserve':
                return 'Snapshot copy reserve = 0%';
            case 'Snapshot autodelete':
                return 'Snapshot autodelete (Volume/oldest first)';
            case 'Space management':
                return 'Space-mgmt-try-first = volume_grow';
            case 'Tiering policy':
                return 'Tiering-policy = snapshot-only';
            case 'Tiering minimum cooling days':
                return 'Tiering-minimum-cooling-days = 7';
            case 'OS type':
                return 'OS type = windows_2008 ';
            case 'Space reservation':
                return 'Space reservation enabled ';
            case 'Space allocation':
                return 'Space allocation enabled';
            case 'Multipath I/O Status':
                return 'Multipath I/O Status = Enabled';
            case 'Multipath I/O Policy':
                return 'Multipath I/O Policy = Round Robin';
            case 'Multipath I/O Sessions':
                return 'Multipath I/O Sessions = 5';
            case 'Multipath I/O Timeout':
                return 'Multipath I/O Timeout = 60 seconds';
            case 'Shared storage':
                return 'Driveletter mounted to nodename';
            case 'Drive Letter':
                return 'Driveletter changed to Driveletter';
            case 'Heartbeat Settings':
                return 'Heartbeat Settings enabled';
            case 'Cluster Quorum':
                return 'Cluster Quorum enabled';
            case 'SQL Server Services':
                return 'SQL Server Services = Running';
            default:
                return '';
        }
    };

    const driveSizeMissingPermissions = (missingPermissionsList: Array<string>) => (
        <div className={styles['storage-tier-block']}>
            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
                <DsTypography variant="Regular_14">
                    {t('databases.well-architect.drive-size-missing-permission-action-summary')}
                </DsTypography>
            </div>

            <div className={styles['first-section']}>
                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                    {t('databases.well-architect.action-required')}
                </DsTypography>
                <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                    {t('databases.well-architect.drive-size-and-headroom-action-content1')}
                </DsTypography>
                <div className={styles.content}>
                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.drive-size-and-headroom-action-content2')}
                        </DsTypography>
                    </div>
                    <div className={styles.row}>
                        <div>
                            <Bullet />
                        </div>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.drive-size-and-headroom-action-content3')}
                        </DsTypography>
                    </div>
                    <div className={styles['dialog-body']}>
                        <div className={styles['code-box']}>
                            <div className={styles.code}>
                                <DsTypography variant="Regular_14">
                                    {missingPermissionsList.map((permission: string) => (
                                        <DsTypography variant="Regular_14">{permission}</DsTypography>
                                    ))}
                                </DsTypography>
                                <div className={styles.copy}>
                                    <CopyToClipboardCommon
                                        value={missingPermissionsList}
                                        iconProvided={
                                            <div className={styles.menuItem}>
                                                <CopyIcon />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const setContent = () => {
        switch (type) {
            case GENERAL.CLONE_MANAGEMENT_REFRESH:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.clone-refresh-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.clone-refresh-what-will-happen')}
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case GENERAL.CLONE_MANAGEMENT_DELETE:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.clone-delete-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.clone-delete-what-will-happen')}
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.storage-tier-action-summary')}
                            </DsTypography>
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
                                        {t('databases.well-architect.storage-tier-what-will-happen-content1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.storage-tier-what-will-happen-content2')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.storage-tier-what-will-happen-content3')}
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return missingPermissions && missingPermissions.length ? (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.file-system-headroom-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.action-required')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.file-system-headroom-choose-option1')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.file-system-headroom-option1-content')}
                            </DsTypography>
                            <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.drive-size-and-headroom-action-content1')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.drive-size-and-headroom-action-content2')}
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.drive-size-and-headroom-action-content3')}
                                    </DsTypography>
                                </div>
                                <div className={styles['dialog-body']}>
                                    <div className={styles['code-box']}>
                                        <div className={styles.code}>
                                            <DsTypography variant="Regular_14">
                                                {missingPermissions.map((permission: string) => (
                                                    <DsTypography variant="Regular_14">{permission}</DsTypography>
                                                ))}
                                            </DsTypography>
                                            <div className={styles.copy}>
                                                <CopyToClipboardCommon
                                                    value={missingPermissions}
                                                    iconProvided={
                                                        <div className={styles.menuItem}>
                                                            <CopyIcon />
                                                        </div>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.file-system-headroom-option2')}
                            </DsTypography>
                            <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.file-system-headroom-option2-content1')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">1|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.file-system-headroom-option2-content2')}
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">2|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.file-system-headroom-option2-content3')}
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">3|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.file-system-headroom-option2-content4')}
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">4|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.file-system-headroom-option2-content5')}
                                        {recommendedSizeInGib ? `${recommendedSizeInGib} GiB.` : '.'}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends increasing the FSx for ONTAP file system capacity to
                                maintain the right headroom.
                            </DsTypography>
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
                                        Storage capacity update: The capacity of your FSx for ONTAP file system will be
                                        increased {recommendedSizeInGib ? ` to ${recommendedSizeInGib} GiB.` : '.'}
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                return missingPermissions && missingPermissions.length ? (
                    driveSizeMissingPermissions(missingPermissions)
                ) : (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.log-drive-size-action-summary')}
                            </DsTypography>
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
                                        {t('databases.well-architect.log-drive-size-what-will-happen')}
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                return missingPermissions && missingPermissions.length ? (
                    driveSizeMissingPermissions(missingPermissions)
                ) : (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.tempdb-drive-size-action-summary')}
                            </DsTypography>
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
                                        {t('databases.well-architect.tempdb-drive-size-what-will-happen')}
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete':
            case 'Space management':
            case 'Tiering policy':
            case 'Tiering minimum cooling days':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.autosize-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.autosize-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'OS type':
            case 'Space reservation':
            case 'Space allocation':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.os-type-space-allocation-reservation-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t(
                                            'databases.well-architect.os-type-space-allocation-reservation-what-will-happen'
                                        )}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'Multipath I/O Status':
            case 'Multipath I/O Policy':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mpio-status-policy-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.mpio-status-policy-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">{GENERAL.OS_NOTE_POINT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.OS_NOTE_POINT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'Multipath I/O Timeout':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mpio-timeout-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.mpio-timeout-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {GENERAL.NOTE}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.note1')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'Microsoft SQL Server patch':
                return <MSSQLPatchDialog type="mssqlPatch" missingPatchList={missingPatchList} />;

            case 'Operating system patch':
                return <MSSQLPatchDialog type="osPatch" missingPatchList={missingPatchList} />;

            case 'Multipath I/O Sessions':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.mpio-sessions-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.mpio-sessions-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'NTFS allocation unit size':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.ntfs-allocation-action-summary1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.ntfs-allocation-action-summary2')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.downtime-warning')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.ntfs-allocation-downtime-warning-content')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.optimization-steps')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.ntfs-allocation-optimization-steps1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.ntfs-allocation-optimization-steps2')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.ntfs-allocation-optimization-steps3')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.ntfs-allocation-optimization-steps4')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.ntfs-allocation-optimization-steps5')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'Shared storage':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.failover-cluster-action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.shared-storage-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.shared-storage-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Drive Letter':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.failover-cluster-action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.drive-letter-action-summary1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.drive-letter-action-summary2')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.drive-letter-note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Heartbeat Settings':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.failover-cluster-action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.heartbeat-setting-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.heartbeat-setting-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Cluster Quorum':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.failover-cluster-action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.cluster-quorum-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.cluster-quorum-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'SQL Server Services':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.failover-cluster-action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.sql-server-configuration-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.sql-server-configuration-what-will-happen')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.well-architected-configuration')}
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles.code}>
                                        <DsTypography variant="Regular_14">{ontapConfigTextSet()}</DsTypography>
                                    </div>
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
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.failover-cluster-note2')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                return <ScheduledLocalSnapshotDalog type={type} data={bulkRecommendationOptions} />;
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">{GETWELL_DIALOG_CONTENT.ACTION_SUMMARY}</DsTypography>
                            <DsTypography variant="Regular_14">
                                {GETWELL_DIALOG_CONTENT.COMPUTE_RS_AS_DESC}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {GETWELL_DIALOG_CONTENT.SELECT_INSTANCE}
                                    </DsTypography>
                                </div>
                                {operation === 'single' && (
                                    <div className={styles.instanceTypeContainer}>
                                        <SelectField
                                            label={GENERAL.RECOMMENDED_INSTANCE_TYPE}
                                            isClearable={false}
                                            isDisabled={recommendationOptions?.missingPermissions}
                                            variant="two-lines"
                                            value={selectedRecommendedInstance}
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setSelectedRecommendedInstance(selectedOptions));
                                            }}
                                            isSearchable={generateRecommendedInstanceTypes?.length > 5}
                                            options={generateRecommendedInstanceTypes}
                                            className={`${styles.widthSet}`}
                                        />
                                    </div>
                                )}

                                {operation === 'bulk' &&
                                    bulkRecommendationOptions
                                        ?.reduce((acc: any[], perInstance: any) => {
                                            if (!acc.some(item => item.hostName === perInstance.hostName)) {
                                                acc.push(perInstance);
                                            }
                                            return acc;
                                        }, [])
                                        ?.map((perInstance: any) => (
                                            <div className={styles.instanceTypeContainer}>
                                                <SelectField
                                                    label={GENERAL.RECOMMENDED_INSTANCE_TYPE}
                                                    isClearable={false}
                                                    isDisabled={perInstance?.missingPermissions}
                                                    variant="two-lines"
                                                    value={recommendedInstanceInBulk?.[perInstance?.hostName]}
                                                    onChange={(selectedOptions: any): void => {
                                                        dispatch(
                                                            setRecommendedInstanceInBulk({
                                                                type: perInstance?.hostName,
                                                                value: selectedOptions
                                                            })
                                                        );
                                                    }}
                                                    isSearchable={
                                                        generateRecommendedInstanceTypesForHost(perInstance)?.length > 5
                                                    }
                                                    options={generateRecommendedInstanceTypesForHost(perInstance)}
                                                    className={`${styles.widthSet}`}
                                                />
                                            </div>
                                        ))}
                            </div>
                        </div>

                        {selectedDatabaseStorageType === 'FCI' ? (
                            <div className={styles['first-section']}>
                                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                    {GETWELL_DIALOG_CONTENT.WHAT_WILL_HAPPEN}
                                </DsTypography>
                                <div className={styles.content}>
                                    <div className={styles.row}>
                                        <div>
                                            <Bullet />
                                        </div>
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[0]}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.row}>
                                        <div>
                                            <Bullet />
                                        </div>
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[1]}
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles['first-section']}>
                                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                    {GETWELL_DIALOG_CONTENT.WHAT_WILL_HAPPEN}
                                </DsTypography>
                                <div className={styles.content}>
                                    <div className={styles.row}>
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_STANDALONE}
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {selectedDatabaseStorageType === 'FCI'
                                    ? GENERAL.NOTE
                                    : GETWELL_DIALOG_CONTENT.DOWNTIME_WARNING}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[0]}
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[0]}
                                        </DsTypography>
                                    )}
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[1]}
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[1]}
                                        </DsTypography>
                                    )}
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>

                                    <DsTypography variant="Regular_14">
                                        {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[0]}

                                        <Button
                                            Component="button"
                                            variant="link"
                                            className={CommonStyles.buttonClass}
                                            onClick={() => {
                                                // To open new tab with AWS resize page on click of credential link
                                                window.open(AWS_RESIZE_URL, '_blank', 'noopener');
                                            }}
                                        >
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[1]}
                                        </Button>
                                        {GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[2]}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return <ScheduledAWSBackupDialog type={type} />;

            case ASSESSMENT_CONFIG_NAMES.MAXDOP:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.maxdop-action-summary')}
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {t('databases.well-architect.what-will-happen')}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.maxdop-what-will-happen')}
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
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_ONE}</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">{GENERAL.NOTE_PONT_TWO}</DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.action-summary')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architect.rss-action-summary')}
                            </DsTypography>
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
                                        {t('databases.well-architect.rss-what-will-happen-content1')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.rss-what-will-happen-content2')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.rss-what-will-happen-content3')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.rss-what-will-happen-content4')}
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        {t('databases.well-architect.rss-what-will-happen-content5')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                {selectedDatabaseStorageType === 'FCI'
                                    ? GENERAL.NOTE
                                    : GETWELL_DIALOG_CONTENT.DOWNTIME_WARNING}
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[0]}
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[0]}
                                        </DsTypography>
                                    )}
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[1]}
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            {GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[1]}
                                        </DsTypography>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <DsTypography variant="Regular_14">
                        {t('databases.well-architect.no-configurations-available')}
                    </DsTypography>
                );
        }
    };

    return <div className={styles.dialogContent}>{setContent()}</div>;
};

export default DialogContent;
