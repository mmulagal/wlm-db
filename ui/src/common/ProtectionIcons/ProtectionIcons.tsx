import { Popover } from '@netapp/design-system';
import { FC, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ProtectionIcons.module.scss';
import { ReactComponent as LocalSnapshots_StorageConsistent } from '../../assets/Local snapshots - Storage consistent.svg';
import { ReactComponent as LocalSnapshot_ApplicationConsistent } from '../../assets/Local snapshots - Application consistent.svg';
import { ReactComponent as RemoteReplication } from '../../assets/ic_copy.svg';
import { ReactComponent as FSx_ONTAP_backup } from '../../assets/FSx for ONTAP backup.svg';
import { ReactComponent as Native_SQL_Server_Backup } from '../../assets/SQL.svg';

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

interface ProtectionIconsProps {
    protectionData: ProtectionData;
    excludeIcons?: string[];
    comingSoonIcons?: string[];
}

const ProtectionIcons = ({ protectionData, excludeIcons = [], comingSoonIcons = [] }: ProtectionIconsProps) => {
    const { t } = useTranslation();
    const iconsConfig = [
        {
            Icon: LocalSnapshots_StorageConsistent,
            tooltipValue: protectionData?.isFsxOntapSnapshotsEnabled ?? false,
            tooltipLabel: t('databases.general.local-snapshots-storage-consistent')
        },
        {
            Icon: LocalSnapshot_ApplicationConsistent,
            tooltipValue: protectionData?.isAppConsistentBackupEnabled ?? false,
            tooltipLabel: t('databases.general.local-snapshots-application-consistent')
        },
        {
            Icon: RemoteReplication,
            tooltipValue: protectionData?.isCRREnabled ?? false,
            tooltipLabel: t('databases.general.remote-replications')
        },
        {
            Icon: FSx_ONTAP_backup,
            tooltipValue: protectionData?.isAwsBackupEnabled?.fsxn ?? false,
            tooltipLabel: t('databases.general.fsx-for-ontap-backup')
        },
        {
            Icon: Native_SQL_Server_Backup,
            tooltipValue: protectionData?.isSqlNativeEnabled ?? false,
            tooltipLabel: t('databases.general.sql-native-backup')
        }
    ];

    const filteredConfig = iconsConfig.filter(config => !excludeIcons.includes(config.tooltipLabel));
    return (
        <>
            {filteredConfig.map(({ Icon, tooltipValue, tooltipLabel }) => {
                const isComingSoon = comingSoonIcons.includes(tooltipLabel);

                return isComingSoon ? (
                    <IconWithComingSoonTooltip key={tooltipLabel} Icon={Icon} tooltipLabel={tooltipLabel} />
                ) : (
                    <IconWithTooltip
                        key={tooltipLabel}
                        Icon={Icon}
                        tooltipValue={tooltipValue}
                        tooltipLabel={tooltipLabel}
                    />
                );
            })}
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

const IconWithComingSoonTooltip: FC<{ Icon: React.FC<React.SVGProps<SVGSVGElement>>; tooltipLabel: string }> = ({
    Icon,
    tooltipLabel
}) => {
    const { t } = useTranslation();
    return (
        <Popover trigger="hover" container={<Icon fill="var(--grey-45)" />}>
            <div className={styles.protectionTooltip}>
                <div className={styles.protectionLabel}>{tooltipLabel}</div>
                <div className={styles.protectionStatus}>
                    <span>{t('databases.general.coming-soon')}</span>
                </div>
            </div>
        </Popover>
    );
};

const ProtectionTooltipItem = ({ label, value }: { label: string; value: boolean | number }) => {
    const { t } = useTranslation();
    return (
        <div className={styles.protectionTooltip}>
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
