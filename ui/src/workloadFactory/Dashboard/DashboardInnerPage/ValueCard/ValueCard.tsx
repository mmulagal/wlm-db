import { DsTypography, Popover, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './ValueCard.module.scss';
import { ReactComponent as Edit } from '../../../../assets/ic_edit.svg';
import { GENERAL } from '../../../../utils/appConstants';

type ValueCardProps = {
    optimizedInstances?: string;
    notOptimizedInstances?: string;
    severity?: string;
    instances?: string;
    configurationState?: string;
    from?: string;
    tooltipText?: string;
    type?: string;
    handleEdit?: any;
    isAnalysisDisabled?: boolean;
};

const ValueCard = ({
    optimizedInstances,
    notOptimizedInstances,
    severity,
    instances,
    configurationState,
    from = 'innerPage',
    tooltipText,
    type,
    handleEdit,
    isAnalysisDisabled = false
}: ValueCardProps) => {
    const { t } = useTranslation();
    return (
        <>
            {from === 'innerPage' && (
                <div className={styles.valueCard}>
                    <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {optimizedInstances}
                        </DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.well-architected-instances')}
                        </DsTypography>
                    </div>

                    <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {notOptimizedInstances}
                        </DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.not-optimized-instances')}
                        </DsTypography>
                    </div>

                    <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Semibold_14">{severity}</DsTypography>
                        <DsTypography variant="Regular_14">{t('databases.well-architect.severity')}</DsTypography>
                    </div>

                    <div className={styles.block}>
                        <div className={styles.configState}>
                            <DsTypography variant="Semibold_14">{configurationState}</DsTypography>
                            <Popover
                                trigger="hover"
                                container={
                                    <div
                                        onClick={isAnalysisDisabled ? undefined : () => handleEdit(type)}
                                        onKeyDown={
                                            isAnalysisDisabled
                                                ? undefined
                                                : e => {
                                                      if (e.key === 'Enter' || e.key === ' ') handleEdit(type);
                                                  }
                                        }
                                        role="button"
                                        tabIndex={isAnalysisDisabled ? -1 : 0}
                                        className={`${styles.editButton} ${isAnalysisDisabled ? styles.disabled : ''}`}
                                    >
                                        <Edit />
                                    </div>
                                }
                            >
                                {isAnalysisDisabled
                                    ? GENERAL.COMING_SOON
                                    : t('databases.general.manage-analysis-state')}
                            </Popover>
                        </div>
                        <DsTypography variant="Regular_14">{t('databases.well-architect.analysis-state')}</DsTypography>
                    </div>
                </div>
            )}
            {from === 'dismissPage' && (
                <div className={styles.valueCard}>
                    <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {instances}
                        </DsTypography>
                        <DsTypography variant="Regular_14">{t('databases.well-architect.instances')}</DsTypography>
                    </div>

                    <div className={styles.block} style={{ borderRight: '1px solid var(--border)' }}>
                        <div className={styles.configContainer}>
                            {tooltipText && <TooltipInfo>{tooltipText}</TooltipInfo>}
                            <DsTypography variant="Semibold_14">{configurationState}</DsTypography>
                        </div>

                        <DsTypography variant="Regular_14">{t('databases.well-architect.analysis-state')}</DsTypography>
                    </div>

                    <div className={styles.block}>
                        <DsTypography variant="Semibold_14">{severity}</DsTypography>
                        <DsTypography variant="Regular_14">{t('databases.well-architect.severity')}</DsTypography>
                    </div>
                </div>
            )}
        </>
    );
};

export default ValueCard;
