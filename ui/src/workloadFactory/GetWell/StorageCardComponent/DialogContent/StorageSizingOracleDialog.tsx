import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import { createActionOptionSection, createSection, createContentWithBullets } from './DialogContentHelper';

const StorageSizingOracleDialog = ({ type }: { type: string }) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-filesystem-headroom-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.oracle-filesystem-headroom-action-summary-heading'),
                            createContentWithBullets([
                                t('databases.well-architect.oracle-filesystem-headroom-action-summary-bullet1'),
                                t('databases.well-architect.oracle-filesystem-headroom-action-summary-bullet2'),
                                t('databases.well-architect.oracle-filesystem-headroom-action-summary-bullet3')
                            ])
                        )}
                        {createSection(
                            t('databases.well-architect.what-will-happen'),
                            t('databases.well-architect.oracle-filesystem-headroom-what-will-happen')
                        )}
                        {createSection(
                            t('databases.well-architect.optimization-steps'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-steps')
                        )}
                        {createActionOptionSection('', [
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step1'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step2'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step3'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step4'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step5'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step6'),
                            t('databases.well-architect.oracle-filesystem-headroom-optimization-step7')
                        ])}
                        {createSection(
                            t('databases.well-architect.note'),
                            createContentWithBullets([
                                t('databases.well-architect.note1'),
                                t('databases.well-architect.oracle-filesystem-headroom-note')
                            ])
                        )}
                    </>
                );
            case ASSESSMENT_CONFIG_NAMES.SWAP_SPACE:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-swap-space-action-summary')
                        )}
                        {createSection(
                            t('databases.well-architect.oracle-swap-space-action-summary-heading'),
                            createContentWithBullets([
                                t('databases.well-architect.oracle-swap-space-action-summary-bullet1'),
                                t('databases.well-architect.oracle-swap-space-action-summary-bullet2'),
                                t('databases.well-architect.oracle-swap-space-action-summary-bullet3')
                            ])
                        )}
                        {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                            t('databases.well-architect.oracle-swap-space-optimization-step1'),
                            t('databases.well-architect.oracle-swap-space-optimization-step2'),
                            t('databases.well-architect.oracle-swap-space-optimization-step3'),
                            t('databases.well-architect.oracle-swap-space-optimization-step4'),
                            t('databases.well-architect.oracle-swap-space-optimization-step5')
                        ])}
                        {createSection(
                            t('databases.well-architect.note'),
                            t('databases.well-architect.oracle-swap-space-note')
                        )}
                    </>
                );
            default:
                return null;
        }
    };
    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default StorageSizingOracleDialog;
