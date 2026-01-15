import { ASSESSMENT_CONFIG_NAMES, DBType, ENGINE_TYPES } from './consts';
import enTranslations from '../../public/resources/i18n/en.json';

// Extract the well-architect translations for easier access
const wellArchitectMessages = enTranslations.databases['well-architect'];

const engineTypeText = (databaseType: string): string => {
    switch (databaseType) {
        case DBType.MSSQL:
            return ENGINE_TYPES.MSSQL;
        case DBType.ORACLE:
            return ENGINE_TYPES.ORACLE;
        case DBType.POSTGRESQL:
            return ENGINE_TYPES.POSTGRESQL;
        default:
            return '';
    }
};

const ontapConfigTextSet = (
    configName: string,
    databaseType: string,
    objectsInViolation?: string[]
): string | string[] => {
    const isOracle = databaseType === 'ORACLE' || databaseType === DBType.ORACLE;

    if (isOracle) {
        switch (configName) {
            case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
                return 'Thin provisioning (-space-guarantee = none)';
            case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
                return 'Autosize on';
            case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE:
                return 'Autosize-mode = grow';
            case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
                return 'Fractional reserve = 0%';
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE:
                return 'Snapshot copy reserve = 0%';
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
                return 'Snapshot autodelete (Volume/oldest first)';
            case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
                return 'Space-mgmt-try-first = volume_grow';
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
                return 'Snapshot policy = none';
            case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY:
                return [
                    "[Data] tiering policy='none'",
                    "[Redo Log] tiering policy='none'",
                    "[Archive] tiering policy='auto'"
                ];
            case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS:
                return [
                    '[Archive,RMAN-compressed] tiering-minimum-cooling-days=2',
                    '[Archive, RMAN uncompressed] tiering-minimum-cooling-days=14'
                ];
            case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
                return ['[Log] Compression= disabled', '[Data, Archive] Compression=Inline, adaptive'];
            case ASSESSMENT_CONFIG_NAMES.COMPACTION:
                return 'Compaction = enabled';
            case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
                return ['[Log] Deduplication = disabled', '[Data, Archive] Deduplication = Inline'];
            case ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY:
                return 'nfs-rootonly = disabled';
            case ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY:
                return ['superuser = sys', 'allow-suid=true'];
            case ASSESSMENT_CONFIG_NAMES.OS_TYPE:
                return 'OS type = linux';
            case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
                return 'Space reservation enabled ';
            case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION:
                return 'Space allocation enabled';
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO:
                return ['Install device-mapper-multipath', 'Start multipathd'];
            case ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES:
                return 'Install host utilities';
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION:
                return [
                    'user_friendly_names: yes',
                    'find_multipaths: yes',
                    'polling_interval: 5',
                    'path_grouping_policy: group_by_prio',
                    'path_selector: service-time 0',
                    'prio: ontap',
                    'features: 3 queue_if_no_path pg_init_retries 50',
                    'hardware_handler: 0',
                    'failback: immediate',
                    'rr_weight: uniform',
                    'no_path_retry: queue',
                    'fast_io_fail_tmo: 5',
                    'dev_loss_tmo: infinity',
                    'detect_prio: yes',
                    'flush_on_last_del: yes',
                    'retain_attached_hw_handler: yes',
                    'path_checker: tur',
                    'max_sectors_kb: 4096'
                ];
            case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
                return 'Transparent Hugepages disabled (enabled=never, defrag=never)';
            case ASSESSMENT_CONFIG_NAMES.SELINUX:
                return 'SELINUX=disabled';
            case ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT:
                return 'node.session.timeo.replacement_timeout = 5 in /etc/iscsi/iscsid.conf';
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES:
                return 'user_friendly_names = yes in /etc/multipath.conf';
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS:
                return '4 active iSCSI sessions per host';
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
                return 'db_file_multiblock_read_count unset in init.ora';
            case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
                return 'filesystemio_options = setall';
            case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
                return ['net.ipv4.tcp_timestamps = 1', 'net.ipv4.tcp_sack = 1', 'net.ipv4.tcp_window_scaling = 1'];
            case ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS:
                return ['sunrpc.tcp_max_slot_table_entries = 128', 'sunrpc.tcp_slot_table_entries = 128'];
            case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES:
                return ['rw,bg,hard,[vers=3,vers=4.1],proto=tcp,', 'timeo=600,rsize=262144,wsize=262144,', 'nointr'];
            case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME:
                return ['rw,bg,hard,[vers=3,vers=4.1],proto=tcp,', 'timeo=600,rsize=262144,wsize=262144'];
        }
    }

    // Common configurations for both Oracle and SQL Server
    switch (configName) {
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
            return 'Autosize on';
        case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
            return 'Thin provisioning (-space-guarantee = none)';
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE:
            return 'Autosize-mode = grow';
        case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
            return 'Fractional reserve = 0%';
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE:
            return 'Snapshot copy reserve = 0%';
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
            return 'Snapshot autodelete (Volume/oldest first)';
        case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
            return 'Space-mgmt-try-first = volume_grow';
        case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY:
            return 'Tiering-policy = snapshot-only';
        case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS:
            return 'Tiering-minimum-cooling-days = 7';
        case ASSESSMENT_CONFIG_NAMES.OS_TYPE:
            return 'OS type = windows_2008 ';
        case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
            return 'Space reservation enabled ';
        case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION:
            return 'Space allocation enabled';
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_STATUS:
            return 'Multipath I/O Status = Enabled';
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY:
            return 'Multipath I/O Policy = Round Robin';
        case 'Multipath I/O Sessions':
            return 'Multipath I/O Sessions = 5';
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_TIMEOUT:
            return 'Multipath I/O Timeout = 60 seconds';
        case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
            return 'Mapping on impacted LUNs will be updated to include initiator names of both EC2 nodes';
        case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER:
            return objectsInViolation && objectsInViolation.length > 0
                ? `Drives ${objectsInViolation.map(drive => drive.replace(':', '')).join(', ')} ${
                      wellArchitectMessages['drive-letter-conflicting-drives']
                  }`
                : wellArchitectMessages['drive-letter-no-violation'];
        case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
            return 'Quorum will be set to disk witness with node majority';
        case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE:
            return objectsInViolation && objectsInViolation.length > 0
                ? [
                      `${wellArchitectMessages['sql-service-startup-type-config']}${objectsInViolation.join(
                          ', node-'
                      )}`,
                      wellArchitectMessages['sql-service-role-ownership-config']
                  ]
                : [];
        default:
            return '';
    }
};

export { ontapConfigTextSet, engineTypeText };
