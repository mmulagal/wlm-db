import { DsTypography, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './ValueCard.module.scss';

type ValueCardProps = {
    valueCardData: {
        optimizedInstances?: number;
        notOptimizedInstances?: number;
        totalInstances?: number;
        dismissedInstances?: number;
        activatingInstances?: number;
        severity?: string;
    };
};

const ValueCard = ({ valueCardData }: ValueCardProps) => {
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
                        title={t('databases.well-architect.total-instances')}
                        variant="Regular_14"
                    >
                        {t('databases.well-architect.total-instances')}
                    </DsTypography>
                </div>

                <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {optimizedInstances}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={t('databases.well-architect.well-architected-instances')}
                        variant="Regular_14"
                    >
                        {t('databases.well-architect.well-architected-instances')}
                    </DsTypography>
                </div>

                <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                    <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {notOptimizedInstances}
                    </DsTypography>
                    <DsTypography
                        className={styles.label}
                        title={t('databases.well-architect.not-optimized-instances')}
                        variant="Regular_14"
                    >
                        {t('databases.well-architect.not-optimized-instances')}
                    </DsTypography>
                </div>

                {dismissedInstances !== 0 && (
                    <div className={styles.column} style={{ borderRight: '1px solid var(--border)' }}>
                        <DsTypography variant="Regular_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                            {dismissedInstances}
                        </DsTypography>
                        <DsTypography
                            className={styles.label}
                            title={t('databases.well-architect.dismissed-instances')}
                            variant="Regular_14"
                        >
                            {t('databases.well-architect.dismissed-instances')}
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
                            title={t('databases.well-architect.pending-instances')}
                            variant="Regular_14"
                        >
                            {t('databases.well-architect.pending-instances')}
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
