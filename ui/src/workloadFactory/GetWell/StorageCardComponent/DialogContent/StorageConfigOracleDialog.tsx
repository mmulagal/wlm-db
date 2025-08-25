import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createStandardDialog, createStandardNotesSection } from './DialogContentHelper';

const StorageConfigOracleDialog = ({
    type,
    createONTAPConfigSection
}: {
    type: string;
    createONTAPConfigSection: any;
}) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case 'Thin provisioning':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-thin-provisioning-action-summary'),
                    t('databases.well-architect.oracle-thin-provisioning-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Autosize':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-autosize-action-summary'),
                    t('databases.well-architect.oracle-autosize-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Autosize-mode':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-autosize-mode-action-summary'),
                    t('databases.well-architect.oracle-autosize-mode-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Fractional reserve':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-fractional-reserve-action-summary'),
                    t('databases.well-architect.oracle-fractional-reserve-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-policy-action-summary'),
                    t('databases.well-architect.oracle-snapshot-policy-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Snapshot copy reserve':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-copy-reserve-action-summary'),
                    t('databases.well-architect.oracle-snapshot-copy-reserve-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Snapshot autodelete':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-autodelete-action-summary'),
                    t('databases.well-architect.oracle-snapshot-autodelete-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Space management':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-management-action-summary'),
                    t('databases.well-architect.oracle-space-management-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Tiering policy':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-tiering-policy-action-summary'),
                    t('databases.well-architect.oracle-tiering-policy-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.COMPACTION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-compaction-action-summary'),
                    t('databases.well-architect.oracle-compaction-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-deduplication-action-summary'),
                    t('databases.well-architect.oracle-deduplication-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-compression-action-summary'),
                    t('databases.well-architect.oracle-compression-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Tiering minimum cooling days':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-tiering-min-cooling-days-action-summary'),
                    t('databases.well-architect.oracle-tiering-min-cooling-days-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );

            case 'OS type':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-os-type-action-summary'),
                    t('databases.well-architect.oracle-os-type-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Space reservation':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-reservation-action-summary'),
                    t('databases.well-architect.oracle-space-reservation-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
            case 'Space allocation':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-allocation-action-summary'),
                    t('databases.well-architect.oracle-space-allocation-what-will-happen'),
                    createStandardNotesSection(),
                    createONTAPConfigSection()
                );
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default StorageConfigOracleDialog;
