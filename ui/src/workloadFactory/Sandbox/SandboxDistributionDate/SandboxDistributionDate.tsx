import { DsTypography } from '@netapp/design-system';
import styles from './SandboxDistributionDate.module.scss';
import SandboxChart from './SandboxChart/SandboxChart';

const SandboxDistributionDate = () => {
    return (
        <div className={styles.sandboxDate}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Sandboxes distribution by age
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <SandboxChart />
            </div>
        </div>
    );
};

export default SandboxDistributionDate;
