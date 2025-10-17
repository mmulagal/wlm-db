import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import {
    createStandardDialog,
    createStandardNotesSection,
    createSection,
    createNumberedActionSteps,
    createActionOptionSection
} from './DialogContentHelper';

const StorageConfigOSOracleDialog = ({ type, createOSConfigSection }: { type: string; createOSConfigSection: any }) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-multipath-io-action-summary'),
                    t('databases.well-architect.oracle-multipath-io-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-host-utility-action-summary'),
                    t('databases.well-architect.oracle-host-utility-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-transparent-hugepages-action-summary'),
                    t('databases.well-architect.oracle-transparent-hugepages-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.SELINUX:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-selinux-action-summary'),
                    t('databases.well-architect.oracle-selinux-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-iscsi-replacement-action-summary'),
                    t('databases.well-architect.oracle-iscsi-replacement-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-multipath-friendly-action-summary'),
                    t('databases.well-architect.oracle-multipath-friendly-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-tcp-action-summary'),
                    t('databases.well-architect.oracle-tcp-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-filesystem-io-options-action-summary'),
                    t('databases.well-architect.oracle-filesystem-io-options-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-multiblock-readcount-action-summary'),
                    t('databases.well-architect.oracle-multiblock-readcount-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-multipath-io-sessions-action-summary'),
                    t('databases.well-architect.oracle-multipath-io-sessions-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-multipath-config-action-summary'),
                    t('databases.well-architect.oracle-multipath-config-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.ASM_SETUP:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-asm-setup-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-asm-setup-note')
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-asm-setup-optimization-step1'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step2'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step3'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step4'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step5'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step6'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step7'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step8'),
                            t('databases.well-architect.oracle-asm-setup-optimization-step9')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-asm-external-redundancy-action-summary')
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step1'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step2'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step3'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step4'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step5'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step6'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step7'),
                            t('databases.well-architect.oracle-asm-external-redundancy-optimization-step8')
                        ])}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-asm-setup-note')
                        )}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-afd-logical-block-size-action-summary'),
                    t('databases.well-architect.oracle-afd-logical-block-size-what-will-happen'),
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-afd-logical-block-size-note')
                    ),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-asmlib-logical-block-size-action-summary'),
                    t('databases.well-architect.oracle-asmlib-logical-block-size-what-will-happen'),
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-afd-logical-block-size-note')
                    ),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-kernel-parameters-action-summary'),
                    t('databases.well-architect.oracle-kernel-parameters-what-will-happen'),
                    createStandardNotesSection(),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-nfs-mount-options-dbfiles-action-summary'),
                    <>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.oracle-nfs-mount-options-dbfiles-what-will-happen')}
                        </DsTypography>
                        {createNumberedActionSteps([
                            t('databases.well-architect.oracle-nfs-mount-options-dbfiles-step1'),
                            t('databases.well-architect.oracle-nfs-mount-options-dbfiles-step2'),
                            t('databases.well-architect.oracle-nfs-mount-options-dbfiles-step3')
                        ])}
                    </>,
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-nfs-mount-options-dbfiles-note')
                    ),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-nfs-mount-options-adrhome-action-summary'),
                    <>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.oracle-nfs-mount-options-adrhome-what-will-happen')}
                        </DsTypography>
                        {createNumberedActionSteps([
                            t('databases.well-architect.oracle-nfs-mount-options-adrhome-step1'),
                            t('databases.well-architect.oracle-nfs-mount-options-adrhome-step2'),
                            t('databases.well-architect.oracle-nfs-mount-options-adrhome-step3'),
                            t('databases.well-architect.oracle-nfs-mount-options-adrhome-step4')
                        ])}
                    </>,
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-nfs-mount-options-adrhome-note')
                    ),
                    createOSConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME:
                return (
                    <div className={styles['storage-tier-block']}>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-nfsv4-domain-name-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.user-action-required'),
                            t('databases.well-architect.oracle-nfsv4-domain-name-user-action-required')
                        )}
                        {createSection(
                            t('databases.well-architect.what-will-happen'),
                            t('databases.well-architect.oracle-nfsv4-domain-name-what-will-happen')
                        )}
                        {createSection(
                            t('databases.well-architect.note'),
                            t('databases.well-architect.oracle-nfsv4-domain-name-note')
                        )}
                    </div>
                );
            case ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-nfs-caching-options-action-summary'),
                    t('databases.well-architect.oracle-nfs-caching-options-what-will-happen'),
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-nfs-caching-options-note')
                    )
                );
            default:
                return null;
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default StorageConfigOSOracleDialog;
