import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createActionOptionSection, createSection, createStandardDialog, createStandardNotesSection } from './DialogContentHelper';

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
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default StorageConfigOSOracleDialog;
