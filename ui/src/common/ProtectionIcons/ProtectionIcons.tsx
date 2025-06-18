import { Popover } from '@netapp/design-system';
import { FC, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ProtectionIcons.module.scss';
import { ReactComponent as CameraIcon } from '../../assets/ic_camera.svg';
import { ReactComponent as CopyIcon } from '../../assets/ic_copy.svg';
import { ReactComponent as BackupIcon } from '../../assets/ic_backup.svg';
import { ReactComponent as ImmutableFilesIcon } from '../../assets/ic_immutable_files.svg';
import { ReactComponent as ImmutableSnapshotIcon } from '../../assets/ic_immutable_snapshot.svg';
import { ReactComponent as ArpAiIcon } from '../../assets/ic_arp_ai.svg';

interface IconConfig {
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    tooltipValue: boolean | number;
    tooltipLabel: string;
}

interface ProtectionData {
    isFsxOntapSnapshotsEnabled?: boolean;
    isCRREnabled?: boolean;
    isAwsBackupEnabled?: {
        fsxn?: boolean;
        fsxw?: boolean;
        ebs?: boolean;
    };
    isSqlNativeEnabled?: boolean;
    isAppConsistentBackupEnabled?: boolean;
}

const ProtectionIcons = ({ protectionData }: { protectionData: ProtectionData }) => {
    const { t } = useTranslation();
    const iconsConfig = [
        {
            Icon: CameraIcon,
            tooltipValue: protectionData?.isFsxOntapSnapshotsEnabled ?? false,
            tooltipLabel: t('databases.general.local-snapshots')
        },
        {
            Icon: CopyIcon,
            tooltipValue: protectionData?.isCRREnabled ?? false,
            tooltipLabel: t('databases.general.remote-replications')
        },
        {
            Icon: BackupIcon,
            tooltipValue: protectionData?.isAwsBackupEnabled?.fsxn ?? false,
            tooltipLabel: t('databases.general.fsx-for-ontap-backup')
        },
        {
            Icon: ImmutableFilesIcon,
            tooltipValue: protectionData?.isSqlNativeEnabled ?? false,
            tooltipLabel: t('databases.general.native-sql-server-backup')
        },
        {
            Icon: ImmutableSnapshotIcon,
            tooltipValue:
                (protectionData?.isSqlNativeEnabled ?? false) ||
                (protectionData?.isAwsBackupEnabled?.fsxn ?? false) ||
                (protectionData?.isCRREnabled ?? false) ||
                (protectionData?.isFsxOntapSnapshotsEnabled ?? false),
            tooltipLabel: t('databases.general.storage-consistent')
        },
        {
            Icon: ArpAiIcon,
            tooltipValue: protectionData?.isAppConsistentBackupEnabled ?? false,
            tooltipLabel: t('databases.general.application-consistent')
        }
    ];
    return (
        <>
            {iconsConfig.map(({ Icon, tooltipValue, tooltipLabel }, idx) => (
                <IconWithTooltip key={idx} Icon={Icon} tooltipValue={tooltipValue} tooltipLabel={tooltipLabel} />
            ))}
        </>
    );
};

const IconWithTooltip: FC<IconConfig> = ({ Icon, tooltipValue, tooltipLabel, ...iconProps }) => (
    <Popover
        children={<ProtectionTooltipItem label={tooltipLabel} value={tooltipValue} />}
        trigger="hover"
        container={<Icon {...iconProps} fill={tooltipValue === true ? 'var(--blue-70)' : 'var(--grey-45)'} />}
    />
);

const ProtectionTooltipItem = ({ label, value }: { label: string; value: boolean | number }) => {
    const { t } = useTranslation();
    return (
        <div>
            <div className={styles.protectionLabel}>{label}</div>
            <div className={styles.protectionStatus}>
                <span
                    className={`${styles.protectionIcon} ${value === true ? styles.protected : styles.notProtected}`}
                />
                <span>{value === true ? t('databases.general.protected') : t('databases.general.not_protected')}</span>
            </div>
        </div>
    );
};

export default ProtectionIcons;
