import { useTranslation } from 'react-i18next';
import { DsTypography } from '@netapp/design-system';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES, GETWELL_STATUS } from '../../../../utils/consts';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import {
    createActionOptionSection,
    createSection,
    createStandardDialog,
    createContentWithBullets,
    createStandardNotesSection
} from './DialogContentHelper';

const StorageSizingOracleDialog = ({
    type,
    status,
    missingPermissions,
    recommendedSizeInGib,
    isWad = false
}: {
    type: string;
    status?: string;
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    isWad?: boolean;
}) => {
    const { t } = useTranslation();
    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                // Over-provisioned - show manual reduction steps
                if (status === GETWELL_STATUS.OVER_PROVISIONED) {
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
                            {!isWad &&
                                createSection(
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
                        </>
                    );
                }

                // Under-provisioned with missing permissions
                if (missingPermissions && missingPermissions.length) {
                    return (
                        <>
                            {createSection(
                                t('databases.well-architect.action-summary'),
                                t(
                                    'databases.well-architect.oracle-file-system-headroom-missing-permissions-action-summary'
                                )
                            )}

                            {createSection(
                                t('databases.well-architect.action-required'),
                                t(
                                    'databases.well-architect.oracle-file-system-headroom-missing-permissions-action-required'
                                ),
                                { width: '712px' }
                            )}

                            {createSection(
                                t('databases.well-architect.oracle-file-system-headroom-option1'),
                                <>
                                    <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                        {t('databases.well-architect.oracle-file-system-headroom-option1-description')}
                                    </DsTypography>
                                    {createContentWithBullets([
                                        t('databases.well-architect.oracle-file-system-headroom-option1-step1'),
                                        t('databases.well-architect.oracle-file-system-headroom-option1-step2')
                                    ])}
                                    <div className={styles['dialog-body']}>
                                        <div className={styles['code-box']}>
                                            <div className={styles.code}>
                                                <DsTypography variant="Regular_14">
                                                    {missingPermissions.map((permission: string) => (
                                                        <DsTypography key={permission} variant="Regular_14">
                                                            {permission}
                                                        </DsTypography>
                                                    ))}
                                                </DsTypography>
                                                <div className={styles.copy}>
                                                    <CopyToClipboardCommon
                                                        value={missingPermissions}
                                                        iconProvided={
                                                            <div className={styles.menuItem}>
                                                                <CopyIcon />
                                                            </div>
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>,
                                { width: '712px' }
                            )}

                            {createSection(
                                t('databases.well-architect.oracle-file-system-headroom-option2'),
                                <>
                                    <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                                        {t('databases.well-architect.oracle-file-system-headroom-option2-description')}
                                    </DsTypography>
                                    {createActionOptionSection('', [
                                        t('databases.well-architect.oracle-file-system-headroom-option2-step1'),
                                        t('databases.well-architect.oracle-file-system-headroom-option2-step2'),
                                        t('databases.well-architect.oracle-file-system-headroom-option2-step3'),
                                        t('databases.well-architect.oracle-file-system-headroom-option2-step4')
                                    ])}
                                </>,
                                { width: '712px' }
                            )}
                        </>
                    );
                }

                // Under-provisioned with permissions
                return createStandardDialog(
                    t,
                    t('databases.well-architect.file-system-headroom-with-permission'),
                    `${t('databases.well-architect.file-system-headroom-with-permission-content')}${
                        recommendedSizeInGib ? ` to ${recommendedSizeInGib} GiB.` : '.'
                    }`,
                    createStandardNotesSection(t, isWad),
                    '',
                    false,
                    isWad
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
