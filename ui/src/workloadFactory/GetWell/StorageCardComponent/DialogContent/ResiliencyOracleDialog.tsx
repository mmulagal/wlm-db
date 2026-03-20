import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createActionOptionSection, createSection } from './DialogContentHelper';

const ResiliencyOracleDialog = ({ type }: { type: string }) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.CRR:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-crr-action-summary')
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-crr-step1'),
                            t('databases.well-architect.oracle-crr-step2'),
                            t('databases.well-architect.oracle-crr-step3'),
                            t('databases.well-architect.oracle-crr-step4'),
                            t('databases.well-architect.oracle-crr-step5'),
                            t('databases.well-architect.oracle-crr-step6')
                        ])}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-crr-notes')
                        )}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-snapcenter-action-summary')
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-snapcenter-step1'),
                            t('databases.well-architect.oracle-snapcenter-step2'),
                            t('databases.well-architect.oracle-snapcenter-step3'),
                            t('databases.well-architect.oracle-snapcenter-step4'),
                            t('databases.well-architect.oracle-snapcenter-step5'),
                            t('databases.well-architect.oracle-snapcenter-step6')
                        ])}
                        {createSection(
                            t('databases.well-architect.notes'),
                            t('databases.well-architect.oracle-snapcenter-notes')
                        )}
                    </>
                );
            default:
                break;
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default ResiliencyOracleDialog;
