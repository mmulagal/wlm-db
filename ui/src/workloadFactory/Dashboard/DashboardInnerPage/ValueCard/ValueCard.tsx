import { DsTypography } from '@netapp/design-system';
import styles from './ValueCard.module.scss';

type ValueCardProps = {
    optimizationScore: string;
    optimizedInstances: string;
    notOptimizedInstances: string;
    severity: string;
};

const ValueCard = ({ optimizationScore, optimizedInstances, notOptimizedInstances, severity }: ValueCardProps) => {
    return (
        <div className={styles.valueCard}>
            <div className={styles.block} style={{ borderRight: '1px solid var(--border' }}>
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                    {optimizationScore}
                </DsTypography>
                <DsTypography variant="Regular_14">Optimization score</DsTypography>
            </div>

            <div className={styles.block} style={{ borderRight: '1px solid var(--border' }}>
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                    {optimizedInstances}
                </DsTypography>
                <DsTypography variant="Regular_14">Optimized instances</DsTypography>
            </div>

            <div className={styles.block} style={{ borderRight: '1px solid var(--border' }}>
                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                    {notOptimizedInstances}
                </DsTypography>
                <DsTypography variant="Regular_14">Not-optimized instances</DsTypography>
            </div>

            <div className={styles.block}>
                <DsTypography variant="Semibold_14">{severity}</DsTypography>
                <DsTypography variant="Regular_14">Severity</DsTypography>
            </div>
        </div>
    );
};

export default ValueCard;
