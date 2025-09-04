import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createActionOptionSection, createSection } from './DialogContentHelper';

const StorageLayoutOracleDialog = ({ type }: { type: string }) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.redologs-placement-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            t('databases.well-architect.redologs-placement-optimization-step1')
                        )}
                        {createActionOptionSection(t('databases.well-architect.redo-logs-placement-step1'), [
                            t('databases.well-architect.redo-logs-placement-step1-options1'),
                            t('databases.well-architect.redo-logs-placement-step1-options2'),
                            t('databases.well-architect.redo-logs-placement-step1-options3')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.temp-placement-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createSection(t('databases.well-architect.optimization-steps'), '')}
                        {createActionOptionSection(t('databases.well-architect.temp-placement-step1'), [
                            t('databases.well-architect.temp-placement-step1-options1'),
                            t('databases.well-architect.temp-placement-step1-options2'),
                            t('databases.well-architect.temp-placement-step1-options3'),
                            t('databases.well-architect.temp-placement-step1-options4'),
                            t('databases.well-architect.temp-placement-step1-options5'),
                            t('databases.well-architect.temp-placement-step1-options6')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.archive-placement-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            t('databases.well-architect.redologs-placement-optimization-step1')
                        )}
                        {createActionOptionSection(t('databases.well-architect.archive-placement-step1'), [
                            t('databases.well-architect.archive-placement-step1-options1'),
                            t('databases.well-architect.archive-placement-step1-options2'),
                            t('databases.well-architect.archive-placement-step1-options3'),
                            t('databases.well-architect.archive-placement-step1-options4'),
                            t('databases.well-architect.archive-placement-step1-options5'),
                            t('databases.well-architect.archive-placement-step1-options6')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.datafile-placement-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            t('databases.well-architect.data-control-file-optimization-step1')
                        )}
                        {createActionOptionSection(t('databases.well-architect.datafiles-optimization-step1'), [
                            t('databases.well-architect.datafiles-optimization-step1-options1'),
                            t('databases.well-architect.datafiles-optimization-step1-options2'),
                            t('databases.well-architect.datafiles-optimization-step1-options3'),
                            t('databases.well-architect.datafiles-optimization-step1-options4'),
                            t('databases.well-architect.datafiles-optimization-step1-options5')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.controlfile-placement-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            t('databases.well-architect.data-control-file-optimization-step1')
                        )}
                        {createActionOptionSection(t('databases.well-architect.controlfiles-optimization-step1'), [
                            t('databases.well-architect.controlfiles-optimization-step1-options1'),
                            t('databases.well-architect.controlfiles-optimization-step1-options2'),
                            t('databases.well-architect.controlfiles-optimization-step1-options3'),
                            t('databases.well-architect.controlfiles-optimization-step1-options4'),
                            t('databases.well-architect.controlfiles-optimization-step1-options5')
                        ])}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-binary-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-storagelayout-note1')
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-binary-optimization-step1'),
                            t('databases.well-architect.oracle-binary-optimization-step2'),
                            t('databases.well-architect.oracle-binary-optimization-step3'),
                            t('databases.well-architect.oracle-binary-optimization-step4'),
                            t('databases.well-architect.oracle-binary-optimization-step5'),
                            t('databases.well-architect.oracle-binary-optimization-step6'),
                            t('databases.well-architect.oracle-binary-optimization-step7'),
                            t('databases.well-architect.oracle-binary-optimization-step8'),
                            t('databases.well-architect.oracle-binary-optimization-step9')
                        ])}
                    </>
                );
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default StorageLayoutOracleDialog;
