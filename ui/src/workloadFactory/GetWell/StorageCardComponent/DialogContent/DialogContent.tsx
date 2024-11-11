import styles from './DialogContent.module.scss';
import { DsTypography, SelectField } from '@netapp/design-system';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedRecommendedInstance } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { useDispatch } from 'react-redux';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';

type DialogType = {
    type: string;
    recommendationOptions?: any;
};

const DialogContent = ({ type, recommendationOptions = null }: DialogType) => {
    const dispatch = useDispatch();
    const { selectedRecommendedInstance, selectedDatabaseStorageType } = useAppSelector(state => state.getWellOptimize);

    const generateRecommendedInstanceTypes = useMemo<optionType[]>((): optionType[] => {
        let options: optionType[] = [];
        recommendationOptions?.map((option: any) => {
            let label2 = "Savings opportunity: " + option?.savingsOpportunity?.savingsOpportunityPercentage + "%";
            options.push(
                generateOptionType(option?.instanceType, option?.instanceType, label2, false, '')
            );
        });
        if (options.length > 1) {
            dispatch(setSelectedRecommendedInstance(options[0]));
        }
        return options;
    }, [recommendationOptions]);

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
    const setContent = () => {
        switch (type) {
            case 'Storage tier':
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
                                        Data movement: The data will be moved gradually from the capacity tier to the
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
            case 'File system headroom':
                return (
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
                                        increased.
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
            case 'Log drive size':
                return (
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
            case 'TempDB drive size':
                return (
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
                                Optimized configuration
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
                                Optimized configuration
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
                                Optimized configuration
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
                                Optimized configuration
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

            case 'Compute rightsizing':
                return (
                    <div className={styles['storage-tier-block']}>
                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14">Action summary</DsTypography>
                            <DsTypography variant="Regular_14">
                                Workload Factory is ready to migrate your SQL Server EC2 instance from the current
                                instance type to the recommended instance type
                            </DsTypography>
                        </div>

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                User action required
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <DsTypography variant="Regular_14">
                                        Select one of the recommended instance types.
                                    </DsTypography>
                                </div>
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
                            </div>
                        </div>

                        {selectedDatabaseStorageType === 'FCI' ? (
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
                                            Instance type change: Workload Factory will change the instance type for
                                            your Amazon EC2 instance from the current instance type to the recommended
                                            instance type on both SQL Server Always On Failover Cluster Instances (FCI)
                                            nodes. Migration effort {'<AWS migration effort>'}.
                                        </DsTypography>
                                    </div>

                                    <div className={styles.row}>
                                        <div>
                                            <Bullet />
                                        </div>
                                        <DsTypography variant="Regular_14">
                                            Failover and Failback: The migration will involve failing over and falling
                                            back from the primary node in your SQL Server Always On Failover Cluster
                                            Instances (FCI) to ensure a smooth transition.
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles['first-section']}>
                                <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                    What will happen
                                </DsTypography>
                                <div className={styles.content}>
                                    <div className={styles.row}>
                                        <DsTypography variant="Regular_14">
                                            Workload Factory will change the instance type for your Amazon EC2 instance
                                            from the current instance type to the recommended instance type. Migration
                                            effort
                                            {'<AWS migration effort>'}
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles['first-section']}>
                            <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
                                Downtime Warning
                            </DsTypography>
                            <div className={styles.content}>
                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            No disruption to your services is expected during this process.
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            This process will require a temporary downtime of your SQL Server EC2
                                            instance. Perform necessary backups and notify affected users, to avoid any
                                            unintended downtime or data loss.
                                        </DsTypography>
                                    )}
                                </div>

                                <div className={styles.row}>
                                    <div>
                                        <Bullet />
                                    </div>
                                    {selectedDatabaseStorageType === 'FCI' ? (
                                        <DsTypography variant="Regular_14">
                                            Click Continue to authorize Workload Factory to automatically perform these
                                            actions on your behalf.
                                        </DsTypography>
                                    ) : (
                                        <DsTypography variant="Regular_14">
                                            Click Continue to authorize Workload Factory to automatically perform these
                                            actions on your behalf and acknowledge the required downtime.
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
