import { DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './ValueCard.module.scss';
import { engineTypeBasedResourceStr } from '../../../WellArchitectedTab/WellArchitectedTabUtils';

type ValueCardProps = {
    valueCardData: {
        optimizedInstances?: number;
        notOptimizedInstances?: number;
        totalInstances?: number;
        dismissedInstances?: number;
        activatingInstances?: number;
        severity?: string;
    };
    configEngineType?: string;
};

const ValueCard = ({ valueCardData, configEngineType }: ValueCardProps) => {
    const {
        optimizedInstances,
        notOptimizedInstances,
        totalInstances,
        dismissedInstances,
        activatingInstances,
        severity
    } = valueCardData;
    const { t } = useTranslation();
    return (
        <div className={styles.valueCard}>
            <div className={styles.cardContent}>
                <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {totalInstances}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.total-instances'),
                            t('databases.well-architect.total-databases')
                        )}
                        variant="Regular_14"
                    >
                        {engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.total-instances'),
                            t('databases.well-architect.total-databases')
                        )}
                    </DsTypography>
                </div>

                <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {optimizedInstances}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.well-architected-instances'),
                            t('databases.well-architect.well-architected-databases')
                        )}
                        variant="Regular_14"
                    >
                        {engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.well-architected-instances'),
                            t('databases.well-architect.well-architected-databases')
                        )}
                    </DsTypography>
                </div>

                <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {notOptimizedInstances}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.not-optimized-instances'),
                            t('databases.well-architect.not-optimized-databases')
                        )}
                        variant="Regular_14"
                    >
                        {engineTypeBasedResourceStr(
                            configEngineType,
                            t('databases.well-architect.not-optimized-instances'),
                            t('databases.well-architect.not-optimized-databases')
                        )}
                    </DsTypography>
                </div>

                {dismissedInstances !== 0 && (
                    <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                            {dismissedInstances}
                        </DsTypography>
                        <DsTypography
                            className={styles.label}
                            title={engineTypeBasedResourceStr(
                                configEngineType,
                                t('databases.well-architect.dismissed-instances'),
                                t('databases.well-architect.dismissed-databases')
                            )}
                            variant="Regular_14"
                        >
                            {engineTypeBasedResourceStr(
                                configEngineType,
                                t('databases.well-architect.dismissed-instances'),
                                t('databases.well-architect.dismissed-databases')
                            )}
                        </DsTypography>
                    </div>
                )}

                {activatingInstances !== 0 && (
                    <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                            {activatingInstances}
                        </DsTypography>
                        <DsTypography
                            className={styles.label}
                            title={engineTypeBasedResourceStr(
                                configEngineType,
                                t('databases.well-architect.pending-instances'),
                                t('databases.well-architect.pending-databases')
                            )}
                            variant="Regular_14"
                        >
                            {engineTypeBasedResourceStr(
                                configEngineType,
                                t('databases.well-architect.pending-instances'),
                                t('databases.well-architect.pending-databases')
                            )}
                        </DsTypography>
                    </div>
                )}

                <div className={styles.column} style={{ borderRight: 'none' }}>
                    <DsTypography variant="Semibold_14" className={styles.titleText}>
                        {severity}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={t('databases.well-architect.severity')}
                        variant="Regular_14"
                    >
                        {t('databases.well-architect.severity')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default ValueCard;
