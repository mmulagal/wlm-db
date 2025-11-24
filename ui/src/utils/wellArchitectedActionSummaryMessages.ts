import { ASSESSMENT_CONFIG_NAMES } from './consts';
import { GENERAL, GETWELL_DIALOG_CONTENT } from './appConstants';
import enTranslations from '../../public/resources/i18n/en.json';
import { engineTypeText, ontapConfigTextSet } from './dialogContentUtils';

const wellArchitectMessages = enTranslations.databases['well-architect'];

function getActionSummaryMessages(configName: string, databaseType: string, objectsInViolation?: string[]): string {
    switch (configName) {
        case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
            return [
                wellArchitectMessages['rss-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['rss-what-will-happen-content1'],
                wellArchitectMessages['rss-what-will-happen-content2'],
                wellArchitectMessages['rss-what-will-happen-content3'],
                wellArchitectMessages['rss-what-will-happen-content4'],
                wellArchitectMessages['rss-what-will-happen-content5'],
                GETWELL_DIALOG_CONTENT.DOWNTIME_WARNING,
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[0],
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_STANDALONE[1]
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MTU:
            return [
                wellArchitectMessages['mtu-alignment-action-summary-heading'],
                wellArchitectMessages['mtu-alignment-action-summary'],
                wellArchitectMessages['mtu-alignment-what-will-happen-heading'],
                wellArchitectMessages['mtu-alignment-what-will-happen1'],
                wellArchitectMessages['mtu-alignment-what-will-happen2'],
                GENERAL.NOTE,
                wellArchitectMessages['mtu-alignment-note1'],
                wellArchitectMessages['mtu-alignment-note1-additional'],
                wellArchitectMessages['mtu-alignment-note1-final'],
                wellArchitectMessages['mtu-alignment-note2']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MAXDOP:
            return [
                wellArchitectMessages['maxdop-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['maxdop-what-will-happen'],
                wellArchitectMessages.note1
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
            return [
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_AS_DESC,
                GETWELL_DIALOG_CONTENT.USER_ACTION_REQUIRED,
                GETWELL_DIALOG_CONTENT.SELECT_INSTANCE,
                GETWELL_DIALOG_CONTENT.WHAT_WILL_HAPPEN,
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[0],
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_WWH_DESC_FCI[1],
                GENERAL.NOTE,
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_DTW_NOTES_FCI[0],
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[0],
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[1],
                GETWELL_DIALOG_CONTENT.COMPUTE_RS_LAST_POINT[2]
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            return [
                wellArchitectMessages['storage-tier-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['storage-tier-what-will-happen-content1'],
                wellArchitectMessages['storage-tier-what-will-happen-content2'],
                wellArchitectMessages['storage-tier-what-will-happen-content3'],
                wellArchitectMessages.note1
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
            return [
                wellArchitectMessages['file-system-headroom-action-summary'],
                wellArchitectMessages['action-required'],
                wellArchitectMessages['file-system-headroom-choose-option1'],
                wellArchitectMessages['file-system-headroom-option1-content'],
                wellArchitectMessages['drive-size-and-headroom-action-content1'],
                wellArchitectMessages['drive-size-and-headroom-action-content2'],
                wellArchitectMessages['drive-size-and-headroom-action-content3'],
                wellArchitectMessages['file-system-headroom-option2'],
                wellArchitectMessages['file-system-headroom-option2-content1'],
                wellArchitectMessages['file-system-headroom-option2-content2'],
                wellArchitectMessages['file-system-headroom-option2-content3'],
                wellArchitectMessages['file-system-headroom-option2-content4'],
                wellArchitectMessages['file-system-headroom-option2-content5']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
            return [
                wellArchitectMessages['log-drive-size-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['log-drive-size-what-will-happen'],
                wellArchitectMessages.note1
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
            return [
                wellArchitectMessages['tempdb-drive-size-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['tempdb-drive-size-what-will-happen'],
                wellArchitectMessages.note1
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE:
        case ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE:
        case ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE:
        case ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT:
        case ASSESSMENT_CONFIG_NAMES.TIERING_POLICY:
        case ASSESSMENT_CONFIG_NAMES.COMPACTION:
        case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
        case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
        case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
        case ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS: {
            const ontapConfigText1 = ontapConfigTextSet(configName, databaseType);
            const configSection1 = Array.isArray(ontapConfigText1) ? ontapConfigText1.join(' ') : ontapConfigText1;
            return [
                wellArchitectMessages['autosize-action-summary'].replace(
                    '{{engineType}}',
                    engineTypeText(databaseType)
                ),
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['autosize-what-will-happen'].replace(
                    '{{engineType}}',
                    engineTypeText(databaseType)
                ),
                wellArchitectMessages.note1,
                'Well-architected configuration:',
                configSection1
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.OS_TYPE:
        case ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION:
        case ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION: {
            const ontapConfigText2 = ontapConfigTextSet(configName, databaseType);
            const configSection2 = Array.isArray(ontapConfigText2) ? ontapConfigText2.join(' ') : ontapConfigText2;
            return [
                wellArchitectMessages['os-type-space-allocation-reservation-action-summary'].replace(
                    '{{engineType}}',
                    engineTypeText(databaseType)
                ),
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['os-type-space-allocation-reservation-what-will-happen'].replace(
                    '{{engineType}}',
                    engineTypeText(databaseType)
                ),
                wellArchitectMessages.note1,
                'Well-architected configuration:',
                configSection2
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_STATUS:
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY: {
            const ontapConfigText3 = ontapConfigTextSet(configName, databaseType);
            const configSection3 = Array.isArray(ontapConfigText3) ? ontapConfigText3.join(' ') : ontapConfigText3;
            return [
                wellArchitectMessages['mpio-status-policy-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['mpio-status-policy-what-will-happen'],
                wellArchitectMessages.note1,
                'Well-architected configuration:',
                configSection3
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_TIMEOUT: {
            const ontapConfigText4 = ontapConfigTextSet(configName, databaseType);
            const configSection4 = Array.isArray(ontapConfigText4) ? ontapConfigText4.join(' ') : ontapConfigText4;
            return [
                wellArchitectMessages['mpio-timeout-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['mpio-timeout-what-will-happen'],
                GENERAL.NOTE,
                wellArchitectMessages.note1,
                'Well-architected configuration:',
                configSection4
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS: {
            const ontapConfigText5 = ontapConfigTextSet(configName, databaseType);
            const configSection5 = Array.isArray(ontapConfigText5) ? ontapConfigText5.join(' ') : ontapConfigText5;
            return [
                wellArchitectMessages['mpio-session-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['mpio-session-what-will-happen'],
                wellArchitectMessages.note1,
                'Well-architected configuration:',
                configSection5
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE:
            return [
                wellArchitectMessages['ntfs-allocation-action-summary1'],
                wellArchitectMessages['ntfs-allocation-action-summary2'],
                wellArchitectMessages['downtime-warning'],
                wellArchitectMessages['ntfs-allocation-downtime-warning-content'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['ntfs-allocation-optimization-steps1'],
                wellArchitectMessages['ntfs-allocation-optimization-steps2'],
                wellArchitectMessages['ntfs-allocation-optimization-steps3'],
                wellArchitectMessages['ntfs-allocation-optimization-steps4'],
                wellArchitectMessages['ntfs-allocation-optimization-steps5']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
            return [
                wellArchitectMessages['failover-cluster-action-summary'],
                wellArchitectMessages['shared-storage-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['shared-storage-what-will-happen'],
                wellArchitectMessages['failover-cluster-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER: {
            const ontapConfigText6 = ontapConfigTextSet(configName, databaseType, objectsInViolation);
            const configSection6 = Array.isArray(ontapConfigText6) ? ontapConfigText6.join(' ') : ontapConfigText6;
            return [
                wellArchitectMessages['failover-cluster-action-summary'],
                wellArchitectMessages['drive-letter-action-summary1'],
                wellArchitectMessages['drive-letter-action-summary2'],
                wellArchitectMessages['drive-letter-note1'],
                'Well-architected configuration:',
                configSection6
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS:
            return [
                wellArchitectMessages['failover-cluster-action-summary'],
                wellArchitectMessages['heartbeat-setting-action-summary1'],
                wellArchitectMessages['heartbeat-setting-action-summary2'],
                wellArchitectMessages['heartbeat-setting-action-summary3'],
                wellArchitectMessages['heartbeat-setting-what-will-happen'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content1'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content2'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content3'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content4'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content5'],
                wellArchitectMessages['heartbeat-setting-what-will-happen-content6'],
                wellArchitectMessages['failover-cluster-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
            return [
                wellArchitectMessages['failover-cluster-action-summary'],
                wellArchitectMessages['cluster-quorum-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['cluster-quorum-what-will-happen'],
                wellArchitectMessages['failover-cluster-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE: {
            const ontapConfigText7 = ontapConfigTextSet(configName, databaseType, objectsInViolation);
            const configSection7 = Array.isArray(ontapConfigText7) ? ontapConfigText7.join(' ') : ontapConfigText7;
            return [
                wellArchitectMessages['sql-server-configuration-action-summary1'],
                wellArchitectMessages['sql-server-configuration-action-summary2'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['sql-server-configuration-what-will-happen'],
                wellArchitectMessages['failover-cluster-note1'],
                'Well-architected configuration:',
                configSection7
            ].join(' ');
        }

        case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH:
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
            return [wellArchitectMessages['what-will-happen'], wellArchitectMessages['failover-cluster-note3']].join(
                '. '
            );

        // Oracle specific configurations
        case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
            return [
                wellArchitectMessages['redologs-placement-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['oracle-storage-layout-optimization-step1'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
            return [
                wellArchitectMessages['temp-placement-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['oracle-storage-layout-optimization-step1'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
            return [
                wellArchitectMessages['archive-placement-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['oracle-storage-layout-optimization-step1'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
        case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
            return [
                wellArchitectMessages['datafile-placement-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['datafiles-optimization-step1'],
                wellArchitectMessages['datafiles-optimization-step1-options1'],
                wellArchitectMessages['datafiles-optimization-step1-options2'],
                wellArchitectMessages['datafiles-optimization-step1-options3'],
                wellArchitectMessages['datafiles-optimization-step1-options4'],
                wellArchitectMessages['datafiles-optimization-step1-options5'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
            return [
                wellArchitectMessages['controlfile-placement-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['controlfiles-optimization-step1'],
                wellArchitectMessages['controlfiles-optimization-step1-options1'],
                wellArchitectMessages['controlfiles-optimization-step1-options2'],
                wellArchitectMessages['controlfiles-optimization-step1-options3'],
                wellArchitectMessages['controlfiles-optimization-step1-options4'],
                wellArchitectMessages['controlfiles-optimization-step1-options5'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
            return [
                wellArchitectMessages['oracle-binary-action-summary'],
                wellArchitectMessages['optimization-steps'],
                wellArchitectMessages['oracle-binary-optimization-step1'],
                wellArchitectMessages['oracle-binary-optimization-step2'],
                wellArchitectMessages['oracle-binary-optimization-step3'],
                wellArchitectMessages['oracle-binary-optimization-step4'],
                wellArchitectMessages['oracle-binary-optimization-step5'],
                wellArchitectMessages['oracle-binary-optimization-step6'],
                wellArchitectMessages['oracle-binary-optimization-step7'],
                wellArchitectMessages['oracle-binary-optimization-step8'],
                wellArchitectMessages['oracle-binary-optimization-step9'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
            return [
                wellArchitectMessages['data-log-separation-action-summary'],
                wellArchitectMessages['data-log-separation-benefit1'],
                wellArchitectMessages['data-log-separation-recommendation1'],
                wellArchitectMessages['data-log-separation-requirement1'],
                GENERAL.NOTE,
                wellArchitectMessages['oracle-storagelayout-note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
            return [
                wellArchitectMessages['clone-refresh-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['clone-refresh-what-will-happen'],
                GENERAL.NOTE,
                wellArchitectMessages['note1']
            ].join('\n');

        // Oracle-specific configurations
        case ASSESSMENT_CONFIG_NAMES.SWAP_SPACE:
            return [
                wellArchitectMessages['oracle-swap-space-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-swap-space-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY:
            return [
                wellArchitectMessages['oracle-nfs-rootonly-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-nfs-rootonly-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY:
            return [
                wellArchitectMessages['oracle-export-policy-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-export-policy-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO:
            return [
                wellArchitectMessages['oracle-multipath-io-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-multipath-io-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES:
            return [
                wellArchitectMessages['oracle-host-utility-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-host-utility-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
            return [
                wellArchitectMessages['oracle-transparent-hugepages-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-transparent-hugepages-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.SELINUX:
            return [
                wellArchitectMessages['oracle-selinux-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-selinux-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT:
            return [
                wellArchitectMessages['oracle-iscsi-replacement-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-iscsi-replacement-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES:
            return [
                wellArchitectMessages['oracle-multipath-friendly-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-multipath-friendly-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
            return [
                wellArchitectMessages['oracle-kernel-parameters-action-summary'], // This maps to TCP slot table configuration
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-kernel-parameters-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
            return [
                wellArchitectMessages['oracle-filesystem-io-options-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-filesystem-io-options-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
            return [
                wellArchitectMessages['oracle-multiblock-readcount-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-multiblock-readcount-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION:
            return [
                wellArchitectMessages['oracle-multipath-config-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-multipath-config-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS:
            return [
                wellArchitectMessages['oracle-kernel-parameters-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-kernel-parameters-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES:
            return [
                wellArchitectMessages['oracle-nfs-mount-options-dbfiles-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-nfs-mount-options-dbfiles-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME:
            return [
                wellArchitectMessages['oracle-nfs-mount-options-adrhome-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-nfs-mount-options-adrhome-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS:
            return [
                wellArchitectMessages['oracle-nfs-caching-options-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-nfs-caching-options-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME:
            return [
                wellArchitectMessages['oracle-nfsv4-domain-name-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-nfsv4-domain-name-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ASM_SETUP:
            return [wellArchitectMessages['oracle-asm-setup-action-summary'], wellArchitectMessages['note1']].join(
                '\n'
            );

        case ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY:
            return [
                wellArchitectMessages['oracle-asm-external-redundancy-action-summary'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE:
            return [
                wellArchitectMessages['oracle-afd-logical-block-size-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-afd-logical-block-size-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE:
            return [
                wellArchitectMessages['oracle-asmlib-logical-block-size-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-asmlib-logical-block-size-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT:
            return [
                wellArchitectMessages['oracle-data-dg-lun-layout-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-data-dg-lun-layout-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT:
            return [
                wellArchitectMessages['oracle-log-dg-lun-layout-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-log-dg-lun-layout-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT:
            return [
                wellArchitectMessages['oracle-fra-dg-lun-layout-action-summary'],
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-fra-dg-lun-layout-what-will-happen'],
                wellArchitectMessages['note1']
            ].join('\n');

        case ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT:
            return [
                wellArchitectMessages['oracle-fra-dg-lun-layout-action-summary'], // Using FRA action summary as they are similar
                wellArchitectMessages['what-will-happen'],
                wellArchitectMessages['oracle-fra-dg-lun-layout-what-will-happen'], // Using FRA what will happen as they are similar
                wellArchitectMessages['note1']
            ].join('\n');

        default:
            return 'Action Summary messages are not available for this configuration type.';
    }
}

export default getActionSummaryMessages;
