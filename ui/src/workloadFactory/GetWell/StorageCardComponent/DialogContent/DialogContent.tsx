import styles from './DialogContent.module.scss';
import { Button, DsTypography, SelectField } from '@netapp/design-system';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { GENERAL, GETWELL_DIALOG_CONTENT } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setRecommendedInstanceInBulk,
    setSelectedRecommendedInstance
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { useDispatch } from 'react-redux';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { ASSESSMENT_CONFIG_NAMES, AWS_RESIZE_URL } from '../../../../utils/consts';
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
    const { selectedRecommendedInstance, selectedDatabaseStorageType, recommendedInstanceInBulk } = useAppSelector(
        state => state.getWellOptimize
    );

    const generateRecommendedInstanceTypes = useMemo<optionType[]>((): optionType[] => {
        let options: optionType[] = [];
        recommendationOptions?.map((option: any) => {
            let label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? 'Savings opportunity: ' + option?.savingsOpportunity?.savingsOpportunityPercentage + '%'
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1) {
            dispatch(setSelectedRecommendedInstance(options[0]));
        }
        return options;
    }, [recommendationOptions]);

    const generateRecommendedInstanceTypesForHost = (instance: any) => {
        let options: optionType[] = [];
        instance?.recommendationOptions?.map((option: any) => {
            let label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? 'Savings opportunity: ' + option?.savingsOpportunity?.savingsOpportunityPercentage + '%'
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
        }
    };

    const driveSizeMissingPermissions = (missingPermissions: Array<string>) => {
        return (
            <div className={styles['storage-tier-block']}>
                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14">Action summary</DsTypography>
                    <DsTypography variant="Regular_14">
                        Workload Factory recommends increasing the FSx for ONTAP volume size. However, the required
                        modify permissions are currently missing.
                    </DsTypography>
                </div>

                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                        Action required
                    </DsTypography>
                    <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                        Grant the necessary FSx ONTAP modify permissions to Workload Factory to proceed with this
                        action.
                    </DsTypography>
                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                Sign in to the AWS Management Console and open the IAM service.
                            </DsTypography>
                        </div>
                        <div className={styles.row}>
                            <div>
                                <Bullet />
                            </div>
                            <DsTypography variant="Regular_14">
                                Edit the policy for role and add AWS FSx for ONTAP modify permissions.
                            </DsTypography>
                        </div>
                        <div className={styles['dialog-body']}>
                            <div className={styles['code-box']}>
                                <div className={styles['code']}>
                                    <DsTypography variant="Regular_14">
                                        {missingPermissions.map((permission: string) => (
                                            <DsTypography variant="Regular_14">{permission}</DsTypography>
                                        ))}
                                    </DsTypography>
                                    <div className={styles['copy']}>
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
            </div>
        );
    };

    const setContent = () => {
        switch (type) {
            case GENERAL.CLONE_MANAGEMENT_REFRESH:
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends managing old and costly clones by either deleting or
                                refreshing them.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Workload Factory will refresh the selected clones. Refreshing a clone will
                                        synchronize it with its source, making it identical and cost-efficient.
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
                                        No disruption to your services is expected during this process.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Select Continue to authorize Workload Factory to automatically perform these
                                        actions on your behalf.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends managing old and costly clones by either deleting or
                                refreshing them.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Workload Factory will delete the selected clones. Deleting a clone will remove
                                        it permanently, freeing up storage space and reducing costs.
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
                                        No disruption to your services is expected during this process.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Select Continue to authorize Workload Factory to automatically perform these
                                        actions on your behalf.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends optimizing your SQL Server's performance by adjusting its
                                storage tiers.
                            </DsTypography>
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
                                        Volume tiering policy change: The tiering policy for your SQL Server volumes
                                        will be modified.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Cloud retrieval policy update: The cloud retrieval policy will be updated.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Data movement: The data will move gradually from the capacity tier to the
                                        performance tier.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends increasing the FSx for ONTAP file system capacity to
                                maintain the right headroom. However, the required modify permissions are currently
                                missing.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Action required
                            </DsTypography>
                            <DsTypography variant="Regular_14">Choose one of the following options.</DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Option 1: Grant FSx for ONTAP modify permissions
                            </DsTypography>
                            <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                Grant the necessary FSx ONTAP modify permissions to Workload Factory to proceed with
                                this action.
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Sign in to the AWS Management Console and open the IAM service.
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Edit the policy for role and add AWS FSx for ONTAP modify permissions.
                                    </DsTypography>
                                </div>
                                <div className={styles['dialog-body']}>
                                    <div className={styles['code-box']}>
                                        <div className={styles['code']}>
                                            <DsTypography variant="Regular_14">
                                                {missingPermissions.map((permission: string) => (
                                                    <DsTypography variant="Regular_14">{permission}</DsTypography>
                                                ))}
                                            </DsTypography>
                                            <div className={styles['copy']}>
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
                                Option 2: AWS Management Console
                            </DsTypography>
                            <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                Increase the file system capacity directly from the AWS Management Console.
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">1|</DsTypography>
                                    <DsTypography variant="Regular_14">Open the Amazon FSx console.</DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">2|</DsTypography>
                                    <DsTypography variant="Regular_14">Choose File systems.</DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">3|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        Select the FSx for ONTAP file system that you want to update SSD storage
                                        capacity.
                                    </DsTypography>
                                </div>
                                <div className={styles.row}>
                                    <DsTypography variant="Semibold_14">4|</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        Update storage capacity to the desired capacity{' '}
                                        {recommendedSizeInGib ? `${recommendedSizeInGib} GiB.` : '.'}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends increasing the FSx for ONTAP file system capacity to
                                maintain the right headroom.
                            </DsTypography>
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends updating the provisioned capacity for your SQL Server log
                                volume and iSCSI LUN so that their sizing will be 25% of the user data volume.
                            </DsTypography>
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
                                        Log volume provisioned capacity update: The provisioned capacity of your SQL
                                        Server log volume and iSCSI LUN will be increased to maintain the right sizing
                                        relative to the user data volume.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends updating the provisioned capacity for your SQL Server TempDB
                                volume and iSCSI LUN so that their sizing will be 10% of the user data volume.
                            </DsTypography>
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
                                        TempDB volume provisioned capacity update: The provisioned capacity of your SQL
                                        Server TempDB volume and iSCSI LUN will be increased to maintain the right
                                        sizing relative to the user data volume.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends updating the FSx for ONTAP volumes configuration to meet
                                vendor best practices for SQL Server.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Configuration update: The FSx for ONTAP volume configuration will be updated to
                                        align with vendor best practices for SQL Server.
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Well-architected configuration
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles['code']}>
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends updating the FSx for ONTAP iSCSI LUNs configuration to meet
                                vendor best practices for SQL Server.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Configuration update: The FSx for ONTAP iSCSI LUNs configuration will be updated
                                        to align with vendor best practices for SQL Server.
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Well-architected configuration
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles['code']}>
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends updating Microsoft Multipath I/O configuration to meet
                                vendor best practices for SQL Server.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Configuration update: The Microsoft Multipath I/O configuration will be updated
                                        to align with vendor best practices for SQL Server.
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Well-architected configuration
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles['code']}>
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

            case 'Microsoft SQL Server patch':
                return <MSSQLPatchDialog type={'mssqlPatch'} missingPatchList={missingPatchList} />;

            case 'Operating system patch':
                return <MSSQLPatchDialog type={'osPatch'} missingPatchList={missingPatchList} />;

            case 'Multipath I/O Sessions':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory intends to update Microsoft Multipath I/O configuration to meet vendor
                                best practices for SQL Server.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Configuration update: The Microsoft Multipath I/O configuration will be updated
                                        to align with vendor best practices for SQL Server.
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Well-architected configuration
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles['code']}>
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

            case 'Multipath I/O Timeout':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory intends to update Microsoft Multipath I/O configuration to meet vendor
                                best practices for SQL Server.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Configuration update: The Microsoft Multipath I/O configuration will be updated
                                        to align with vendor best practices for SQL Server.
                                    </DsTypography>
                                </div>
                            </div>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Well-architected configuration
                            </DsTypography>
                            <div className={styles['dialog-body']}>
                                <div className={styles['code-box']}>
                                    <div className={styles['code']}>
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Before taking action, you should understand that changing the NTFS allocation unit size
                                to 64K requires reformatting the drives. This is a manual process that can only be done
                                by the user and can lead to data loss if not handled properly.
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                Please note the following important considerations:
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Downtime warning</DsTypography>
                            <DsTypography variant="Regular_14">
                                It is crucial that you schedule this task during a maintenance window to minimize
                                disruptions to your operations. This process could involve data loss and downtime. To
                                prepare, carefully verify that all data has been backed up, and ensure that all files
                                and data are moved to a different drive before starting the reformatting process.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Optimization steps
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">Open Windows Disk Management.</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Identify the SQL drives to format (Data, Log, TempDB).
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">Format one drive at a time.</DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Select 64K in the Allocation unit size drop-down menu.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        Repeat steps 1-4 for all SQL Server drives (Data, Log, TempDB)
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends optimizing your SQL Server's performance by adjusting the
                                MAXDOP value.
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                What will happen
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        SQL query will be executed to modify max degree of parallelism (MAXDOP) setting
                                        on the server.
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
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory recommends optimizing your MSSQL server's network performance by
                                adjusting its network adapter settings.
                            </DsTypography>
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
                                        All TCP offloading features will be disabled.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        The number of receive queues will be set to 8 if the number of vCPUs is greater
                                        than 8, or to the number of vCPUs if it is 8 or fewer.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        The RSS profile will be configured to NUMAStatic.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        The base processor number will be set to 2.
                                    </DsTypography>
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    <DsTypography variant="Regular_14">
                                        The system will be rebooted after changes to these network adapter settings.
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
        }
    };

    return <div className={styles.dialogContent}>{setContent()}</div>;
};

export default DialogContent;
