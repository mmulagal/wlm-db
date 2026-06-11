import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DsCheckbox } from '@tlveng/wlm-ds';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createStandardDialog, createStandardNotesSection, createSection } from './DialogContentHelper';
import {
    isOntapConfig,
    getFilteredLinkedConfigNames
} from '../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import LinkedConfigBanner from '../../../../common/LinkedConfigBanner/LinkedConfigBanner';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    setRequireAcknowledge,
    setDialogErrorWithTooltip,
    resetDialogComponent
} from '../../../../store/workloadFactory/dialogComponentSlice';

const StorageConfigOracleDialog = ({
    type,
    createONTAPConfigSection,
    isWad = false
}: {
    type: string;
    createONTAPConfigSection: any;
    isWad?: boolean;
}) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const driftAssessmentData = useAppSelector(state => state.getWellOptimize.driftAssessmentData);

    const linkedConfigNames = isOntapConfig(type) ? getFilteredLinkedConfigNames(type, driftAssessmentData) : [];
    const showDependencyWarning = linkedConfigNames.length > 0;
    const [acknowledged, setAcknowledged] = useState(false);

    useEffect(() => {
        if (showDependencyWarning && !isWad) {
            dispatch(setRequireAcknowledge(true));
        }
        return () => {
            dispatch(resetDialogComponent());
        };
    }, [dispatch, showDependencyWarning]);

    const handleCheckboxChange = () => {
        const newValue = !acknowledged;
        setAcknowledged(newValue);
        dispatch(setRequireAcknowledge(!newValue));
        if (newValue) {
            dispatch(setDialogErrorWithTooltip({ showDialogError: false, showTooltipInfo: false }));
        }
    };

    const setContent = () => {
        switch (type) {
            case 'Thin provisioning':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-thin-provisioning-action-summary'),
                    t('databases.well-architect.oracle-thin-provisioning-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Autosize':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-autosize-action-summary'),
                    t('databases.well-architect.oracle-autosize-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Autosize-mode':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-autosize-mode-action-summary'),
                    t('databases.well-architect.oracle-autosize-mode-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Fractional reserve':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-fractional-reserve-action-summary'),
                    t('databases.well-architect.oracle-fractional-reserve-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-policy-action-summary'),
                    t('databases.well-architect.oracle-snapshot-policy-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Snapshot copy reserve':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-copy-reserve-action-summary'),
                    t('databases.well-architect.oracle-snapshot-copy-reserve-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Snapshot autodelete':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-snapshot-autodelete-action-summary'),
                    t('databases.well-architect.oracle-snapshot-autodelete-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Space management':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-mgmt-action-summary'),
                    t('databases.well-architect.oracle-space-mgmt-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Tiering policy':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-tiering-policy-action-summary'),
                    t('databases.well-architect.oracle-tiering-policy-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.COMPACTION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-compaction-action-summary'),
                    t('databases.well-architect.oracle-compaction-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.DEDUPLICATION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-deduplication-action-summary'),
                    t('databases.well-architect.oracle-deduplication-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.COMPRESSION:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-compression-action-summary'),
                    t('databases.well-architect.oracle-compression-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Tiering minimum cooling days':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-tiering-min-cooling-days-action-summary'),
                    t('databases.well-architect.oracle-tiering-min-cooling-days-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );

            case 'OS type':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-os-type-action-summary'),
                    t('databases.well-architect.oracle-os-type-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Space reservation':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-reservation-action-summary'),
                    t('databases.well-architect.oracle-space-reservation-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case 'Space allocation':
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-space-allocation-action-summary'),
                    t('databases.well-architect.oracle-space-allocation-what-will-happen'),
                    createStandardNotesSection(t, isWad),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY:
                return createStandardDialog(
                    t,
                    t('databases.well-architect.oracle-nfs-rootonly-action-summary'),
                    t('databases.well-architect.oracle-nfs-rootonly-what-will-happen'),
                    createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-nfs-root-only-note')
                    ),
                    createONTAPConfigSection(),
                    false,
                    isWad
                );
            case ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-export-policy-action-summary')
                        )}
                        {!isWad &&
                            createSection(
                                t('databases.well-architect.what-will-happen'),
                                t('databases.well-architect.oracle-export-policy-what-will-happen')
                            )}
                        {createONTAPConfigSection()}
                        {createStandardNotesSection(t, isWad)}
                    </>
                );
            default:
                return null;
        }
    };
    return (
        <div className={styles['storage-tier-block']}>
            {showDependencyWarning && (
                <div className={styles.dependencyWarningSection}>
                    <LinkedConfigBanner linkedConfigNames={linkedConfigNames} configName={type} />
                    {!isWad && (
                        <div className={styles.acknowledgeCheckbox}>
                            <DsCheckbox
                                id="wlm-db-linked-config-acknowledge"
                                title={t('databases.well-architect.linked-config.acknowledge-checkbox')}
                                onSelect={handleCheckboxChange}
                                isSelected={acknowledged}
                            />
                        </div>
                    )}
                </div>
            )}
            {setContent()}
        </div>
    );
};

export default StorageConfigOracleDialog;
